import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { toRupees } from '../../platform/money/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { getFulfillmentPartner } from '../../integrations/fulfillment/index.ts';
import { notifyStaff } from '../notifications/index.ts';
import { getSetting } from '../settings/index.ts';
import { externalRef, planOrder, type PlannedGroup, type PlannedOrder } from './provider.ts';
import { advanceOrderStatus, orderStatusFor } from './status.ts';
import { postWalletEntry } from './wallet.ts';

// Handing an order to its print partner (DOC/backend/16 §6). The provider call
// is a network round trip, so it never happens inside a transaction: each
// order is prepared in one short transaction (row + lease), sent outside, then
// recorded in another. A retried job can therefore never print twice — the
// unique index on (order_id, provider_id) WHERE reason = 'initial' is the
// durable guard, and the lease (`submit_attempts`) stops two runners sending
// the same row at the same time.

const MAX_AUTO_ATTEMPTS = 3;

export interface GroupOutcome {
  provider: string;
  providerName: string;
  status: 'sent' | 'skipped' | 'failed';
  providerStatus?: string;
  error?: string;
}

export interface SubmitOutcome {
  orderNumber: string;
  groups: GroupOutcome[];
  skipped: { slug: string; reason: string }[];
}

interface Leased { id: string; ref: string; attempts: number; fallbackSkus: string[] }

/** Reserve the provider row for this worker; null means "already sent / done". */
async function lease(planned: { orderId: string; orderNumber: string; gateway: 'prepaid' | 'cod'; codAmountPaise: number | null }, group: PlannedGroup): Promise<Leased | null> {
  const { orderId, orderNumber, gateway, codAmountPaise } = planned;
  const fallbackSkus = group.lines.filter((l) => l.usedFallbackSku).map((l) => l.sku);
  return withTransaction(async (tx) => {
    // Two clicks on "Submit now" queue here, not at the provider.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`);
    const { rows: [existing] } = await tx.execute<{ id: string; status: string; external_ref: string }>(sql`
      SELECT id, status, external_ref FROM fulfillment_orders
      WHERE order_id = ${orderId} AND provider_id = ${group.provider.id} AND reason = 'initial'`);
    if (existing) {
      if (existing.status !== 'pending' && existing.status !== 'failed') return null;
      const { rows: [row] } = await tx.execute<{ id: string; external_ref: string; submit_attempts: number }>(sql`
        UPDATE fulfillment_orders SET submit_attempts = submit_attempts + 1, updated_at = now()
        WHERE id = ${existing.id} RETURNING id, external_ref, submit_attempts`);
      return { id: row.id, ref: row.external_ref, attempts: row.submit_attempts, fallbackSkus };
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const ref = externalRef(orderNumber, attempt);
      await tx.execute(sql`SAVEPOINT ref_try`);
      try {
        const { rows: [created] } = await tx.execute<{ id: string; external_ref: string; submit_attempts: number }>(sql`
          INSERT INTO fulfillment_orders (id, order_id, provider_id, external_ref, reason, status, gateway, cod_amount, provider_cost, submit_attempts)
          VALUES (${uuidv7()}, ${orderId}, ${group.provider.id}, ${ref}, 'initial', 'pending',
                  ${gateway}, ${codAmountPaise !== null ? toRupees(codAmountPaise) : null}::numeric, ${null}, 1)
          RETURNING id, external_ref, submit_attempts`);
        return { id: created.id, ref: created.external_ref, attempts: created.submit_attempts, fallbackSkus };
      } catch (error) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT ref_try`);
        const pg = error as { code?: string; cause?: { code?: string } };
        if ((pg.code ?? pg.cause?.code) !== '23505') throw error;
      }
    }
    throw new AppError('CONFLICT', 'Could not allocate a provider reference for this order.');
  });
}

/**
 * Send one already-planned order. Returns one outcome per provider group.
 * Errors are recorded on the row (and ring the ops bell) instead of throwing,
 * so a batch keeps going.
 */
export async function sendPlanned(orderId: string, force = false): Promise<SubmitOutcome> {
  // The Rs1 QA product is never manufactured, even if a deployed cron has a
  // different env from local dev. Check before planning so a missing partner
  // SKU mapping cannot get in the way. Covers automatic and manual sends.
  const testSkus = new Set(['TUW-TEST-PRODUCT-49F1AA', (process.env.CHECKOUT_TEST_SKU ?? '').trim()].filter(Boolean));
  const { rows: orderSkus } = await getDb().execute<{ order_number: string; sku: string }>(sql`
    SELECT o.order_number, oi.sku FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.id = ${orderId}`);
  if (orderSkus.some((r) => testSkus.has(r.sku) || [...testSkus].some((s) => r.sku.startsWith(`${s}-`)))) {
    return { orderNumber: orderSkus[0]?.order_number ?? '', groups: [], skipped: [{ slug: '*', reason: 'Test product — fulfilment submission is blocked.' }] };
  }

  if (process.env.FULFILLMENT_SUBMIT_ENABLED === 'false') {
    const planned = await planOrder(orderId);
    return { orderNumber: planned.orderNumber, groups: [], skipped: [{ slug: '*', reason: 'Fulfilment submission is disabled in this environment.' }] };
  }
  const planned = await planOrder(orderId);

  if (!force) {
    const { rows: [cap] } = await getDb().execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM fulfillment_orders WHERE order_id = ${orderId} AND submit_attempts >= ${MAX_AUTO_ATTEMPTS}`);
    if ((cap?.n ?? 0) > 0) {
      return { orderNumber: planned.orderNumber, groups: [], skipped: [{ slug: '*', reason: 'Automatic retries are exhausted — retry by hand from the fulfilment board.' }] };
    }
  }
  {
    const groups: GroupOutcome[] = [];
    for (const group of planned.groups) {
      const provider = group.provider;
      const reserved = await lease({ orderId: planned.orderId, orderNumber: planned.orderNumber, gateway: planned.gateway, codAmountPaise: planned.codAmountPaise }, group);
      if (!reserved) {
        groups.push({ provider: provider.slug, providerName: provider.name, status: 'skipped', providerStatus: 'already sent' });
        continue;
      }
      const partner = getFulfillmentPartner(provider.slug);
      try {
        const state = await partner.createOrder({
          reference: reserved.ref,
          gateway: planned.gateway,
          codAmountPaise: planned.codAmountPaise ?? undefined,
          totalPaise: planned.totalPaise,
          lines: group.lines,
          shipTo: planned.shipTo,
        });
        await recordSuccess({ orderId, planned, group, reserved, state, providerName: provider.name });
        groups.push({ provider: provider.slug, providerName: provider.name, status: 'sent', providerStatus: state.providerStatus });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordFailure({ planned, reserved, message, providerName: provider.name });
        groups.push({ provider: provider.slug, providerName: provider.name, status: 'failed', error: message });
      }
    }
    return { orderNumber: planned.orderNumber, groups, skipped: planned.skipped };
  }
}

async function recordSuccess(input: {
  orderId: string; planned: PlannedOrder; group: PlannedGroup;
  reserved: Leased; state: Awaited<ReturnType<ReturnType<typeof getFulfillmentPartner>['createOrder']>>; providerName: string;
}): Promise<void> {
  const { orderId, planned, group, reserved, state, providerName } = input;
  await withTransaction(async (tx) => {
    await tx.execute(sql`
      UPDATE fulfillment_orders SET
        status = ${state.status}, provider_status = ${state.providerStatus},
        provider_order_id = COALESCE(provider_order_id, ${state.providerOrderRef}),
        courier = COALESCE(${state.courier ?? null}, courier),
        awb = COALESCE(${state.awb ?? null}, awb),
        provider_cost = COALESCE(${state.providerCostPaise !== null && state.providerCostPaise !== undefined ? toRupees(state.providerCostPaise) : null}::numeric, provider_cost, ${group.costPaise !== null ? toRupees(group.costPaise) : null}::numeric),
        raw_payload = raw_payload || ${JSON.stringify({ ...(state.raw ?? {}), ...(reserved.fallbackSkus.length ? { fallbackSkus: reserved.fallbackSkus } : {}) })}::jsonb,
        submitted_at = COALESCE(submitted_at, now()), synced_at = now(), last_error = NULL, updated_at = now()
      WHERE id = ${reserved.id}`);
    for (const line of group.lines) {
      await tx.execute(sql`INSERT INTO fulfillment_order_items (id, fulfillment_order_id, order_item_id, qty, provider_sku, provider_payload)
        VALUES (${uuidv7()}, ${reserved.id}, ${line.orderItemId}, ${line.quantity}, ${line.sku}, ${JSON.stringify(line.payload ?? {})}::jsonb)
        ON CONFLICT (fulfillment_order_id, order_item_id) DO NOTHING`);
    }
    const cost = state.providerCostPaise ?? group.costPaise;
    if (cost !== null && cost !== undefined && cost > 0) {
      await postWalletEntry(tx, {
        providerId: group.provider.id, kind: 'order_debit', direction: 'debit', amountPaise: cost,
        fulfillmentOrderId: reserved.id, note: `${planned.orderNumber} sent to ${providerName}`, actor: 'system',
      });
    }
    const to = orderStatusFor(state.status) ?? 'confirmed';
    await advanceOrderStatus(tx, orderId, to, `Sent to ${providerName} (${state.providerStatus})`);
    if (state.status === 'on_hold') {
      await notifyStaff(tx, 'shipment.manage', [{
        kind: 'order', title: `${planned.orderNumber} is on hold at ${providerName}`,
        body: `Provider status: ${state.providerStatus}. Stock or artwork needs attention before it prints.`,
        link: '/fulfillment', dedupeKey: `fulfill-hold:${reserved.id}`,
      }]);
    }
  });
}

async function recordFailure(input: {
  planned: PlannedOrder; reserved: Leased; message: string; providerName: string;
}): Promise<void> {
  const { planned, message, reserved, providerName } = input;
  await withTransaction(async (tx) => {
    await tx.execute(sql`UPDATE fulfillment_orders SET status = 'failed', last_error = ${message.slice(0, 1000)},
      synced_at = now(), updated_at = now() WHERE id = ${reserved.id}`);
    await notifyStaff(tx, 'shipment.manage', [{
      kind: 'order', title: `${planned.orderNumber} failed at ${providerName}`,
      body: message.slice(0, 300), link: '/fulfillment',
      dedupeKey: `fulfill-fail:${reserved.id}:${reserved.attempts}`,
    }]);
  });
  // The order deliberately stays 'pending' — the customer keeps a normal
  // order, and staff retry from the board once the provider is reachable.
}

/**
 * Orders whose free-cancel window has closed and that are ready to print:
 * paid prepaid orders and COD orders (COD is submitted unpaid by design).
 * Orders whose automatic attempts are exhausted wait for a human.
 */
export async function submitDueOrders(limit = 25): Promise<{ processed: number; failed: number; note?: string }> {
  // Staff can hold every automatic send (Settings → Fulfilment) while they
  // watch the first live orders. Manual sends from the board still work.
  if (!(await getSetting('fulfillment.auto_submit'))) {
    return { processed: 0, failed: 0, note: 'Automatic submission is switched off in Settings → Fulfilment; orders wait for a manual send.' };
  }
  const { rows } = await getDb().execute<{ id: string }>(sql`
    SELECT o.id FROM orders o
    WHERE o.status = 'pending'
      AND o.cancellable_until IS NOT NULL AND o.cancellable_until <= now()
      AND (o.payment_status = 'paid' OR EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.method = 'cod'))
      AND NOT EXISTS (SELECT 1 FROM fulfillment_orders f WHERE f.order_id = o.id AND f.submit_attempts >= ${MAX_AUTO_ATTEMPTS})
    ORDER BY o.cancellable_until LIMIT ${limit}`);
  let processed = 0;
  let failed = 0;
  for (const order of rows) {
    try {
      const outcome = await sendPlanned(order.id);
      if (outcome.groups.some((g) => g.status === 'sent')) processed += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.error('[fulfillment] submit failed', order.id, error);
    }
  }
  return { processed, failed, note: rows.length === 0 ? 'No orders waiting.' : undefined };
}
