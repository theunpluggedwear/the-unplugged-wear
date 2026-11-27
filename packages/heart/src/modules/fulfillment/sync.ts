import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction, type Transaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { toRupees } from '../../platform/money/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { getFulfillmentPartner, type FulfillmentStatus, type ProviderOrderState } from '../../integrations/fulfillment/index.ts';
import { advanceOrderStatus, orderStatusFor } from './status.ts';
import { notifyStaff } from '../notifications/index.ts';

// Pulling provider state back (DOC/backend/16 §7). Qikink pushes nothing, so a
// job asks every open order for its status; each answer updates the provider
// row, the parcel and its timeline in one transaction. Repeating an answer is
// harmless — the shipment event insert is guarded.

export type ShipmentStatusValue = 'pending' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'returned';

const RANK: Record<ShipmentStatusValue, number> = {
  pending: 0, shipped: 1, in_transit: 2, out_for_delivery: 3, delivered: 4, exception: 5, returned: 5,
};

/** Provider state → parcel state. Unknown/hold states keep the parcel as is. */
const SHIPMENT_FOR: Partial<Record<FulfillmentStatus, ShipmentStatusValue>> = {
  submitted: 'pending',
  in_production: 'pending',
  on_hold: 'pending',
  shipped: 'shipped',
  delivery_exception: 'exception',
  delivered: 'delivered',
  rto_initiated: 'returned',
  returned: 'returned',
};

type OpenRow = {
  id: string; order_id: string; order_number: string; provider_slug: string; provider_order_id: string; status: FulfillmentStatus;
};

/**
 * Write one provider answer for one fulfilment row. Exported because the
 * manual "mark shipped" path writes the same parcel fields.
 */
export async function recordProviderState(tx: Transaction, row: { id: string; orderId: string; orderNumber?: string }, state: ProviderOrderState, options: { note?: string } = {}): Promise<void> {
  await tx.execute(sql`
    UPDATE fulfillment_orders SET
      status = ${state.status}, provider_status = ${state.providerStatus},
      provider_order_id = COALESCE(provider_order_id, ${state.providerOrderRef}),
      courier = COALESCE(${state.courier ?? null}, courier),
      awb = COALESCE(${state.awb ?? null}, awb),
      provider_cost = COALESCE(${state.providerCostPaise !== null && state.providerCostPaise !== undefined ? toRupees(state.providerCostPaise) : null}::numeric, provider_cost),
      delivered_at = CASE WHEN ${state.status} = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
      rto_storage_until = CASE WHEN ${state.status} = 'rto_initiated' AND rto_storage_until IS NULL
                          THEN current_date + 100 ELSE rto_storage_until END,
      raw_payload = raw_payload || ${JSON.stringify(state.raw ?? {})}::jsonb,
      synced_at = now(), last_error = NULL, updated_at = now()
    WHERE id = ${row.id}`);

  const target = SHIPMENT_FOR[state.status];
  if (target) await upsertShipment(tx, row.id, row.orderId, { status: target, carrier: state.courier ?? null, awb: state.awb ?? null }, options.note);

  const to = orderStatusFor(state.status);
  if (to && !(state.status === 'pending')) {
    await advanceOrderStatus(tx, row.orderId, to, options.note ?? `Provider status: ${state.providerStatus}`);
  }
  if (state.status === 'delivery_exception') {
    await notifyStaff(tx, 'shipment.manage', [{
      kind: 'order', title: `${row.orderNumber ?? 'Order'} has a delivery exception`,
      body: `The courier reported: ${state.providerStatus}. Call the customer before the parcel comes back.`,
      link: '/shipments', dedupeKey: `delivery-exception:${row.id}:${new Date().toISOString().slice(0, 10)}`,
    }]);
  }
}

async function upsertShipment(
  tx: Transaction,
  fulfillmentId: string,
  orderId: string,
  input: { status: ShipmentStatusValue; carrier: string | null; awb: string | null },
  note?: string,
): Promise<void> {
  const { rows: [existing] } = await tx.execute<{ id: string; status: ShipmentStatusValue }>(sql`
    SELECT id, status FROM shipments WHERE fulfillment_order_id = ${fulfillmentId} ORDER BY created_at LIMIT 1`);
  if (!existing) {
    if (!input.awb && input.status === 'pending') return; // nothing to tell the customer yet
    const id = uuidv7();
    await tx.execute(sql`
      INSERT INTO shipments (id, order_id, carrier, tracking_number, status, shipped_at, delivered_at, fulfillment_order_id)
      VALUES (${id}, ${orderId}, ${input.carrier}, ${input.awb}, ${input.status},
              ${input.status === 'pending' ? null : new Date()}::timestamptz,
              ${input.status === 'delivered' ? new Date() : null}::timestamptz, ${fulfillmentId})`);
    await addEvent(tx, id, input.status, null, note ?? `Parcel ${input.awb ? `handed to ${input.carrier ?? 'the courier'} · ${input.awb}` : 'created'}`);
    return;
  }
  const next = RANK[input.status] >= RANK[existing.status] ? input.status : existing.status;
  await tx.execute(sql`
    UPDATE shipments SET status = ${next},
      carrier = COALESCE(carrier, ${input.carrier}), tracking_number = COALESCE(tracking_number, ${input.awb}),
      shipped_at = CASE WHEN ${next} <> 'pending' THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
      delivered_at = CASE WHEN ${next} = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
      updated_at = now()
    WHERE id = ${existing.id}`);
  if (next !== existing.status) {
    await addEvent(tx, existing.id, next, null, note ?? `Courier status: ${next.replace(/_/g, ' ')}`);
  }
}

/** One timeline row per status per hour — a poll loop cannot spam the list. */
export async function addEvent(tx: Transaction, shipmentId: string, status: ShipmentStatusValue, location: string | null, description: string | null): Promise<void> {
  await tx.execute(sql`
    INSERT INTO shipment_events (id, shipment_id, status, location, description, occurred_at)
    SELECT ${uuidv7()}, ${shipmentId}, ${status}, ${location}, ${description}, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM shipment_events e WHERE e.shipment_id = ${shipmentId} AND e.status = ${status}
        AND e.occurred_at > now() - interval '1 hour')`);
}

async function loadOpen(ids: string[] | null, limit: number, tx?: Transaction): Promise<OpenRow[]> {
  const executor = tx ?? getDb();
  const { rows } = await executor.execute<OpenRow>(sql`
    SELECT f.id, f.order_id, o.order_number, ip.slug AS provider_slug, f.provider_order_id, f.status
    FROM fulfillment_orders f
    JOIN orders o ON o.id = f.order_id
    JOIN integration_providers ip ON ip.id = f.provider_id
    WHERE f.provider_order_id IS NOT NULL
      AND f.status NOT IN ('delivered', 'cancelled', 'returned', 'failed')
      AND ip.capabilities->>'tracking' = 'poll'
      -- Rows the simulator "created" have no order at Qikink; polling their
      -- refs would just overwrite the row with an error every cycle.
      AND f.provider_order_id NOT LIKE 'sim\_qk\_%'
      ${ids ? sql`AND f.id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
    ORDER BY f.synced_at ASC NULLS FIRST, f.created_at
    LIMIT ${limit} FOR UPDATE OF f SKIP LOCKED`);
  return rows;
}

/** Ask the provider about one order; returns the state it reported. */
export async function syncFulfillment(fulfillmentId: string): Promise<ProviderOrderState> {
  type Outcome = { state: ProviderOrderState } | { error: unknown };
  const outcome = await withTransaction(async (tx): Promise<Outcome> => {
    const [row] = await loadOpen([fulfillmentId], 1, tx);
    if (!row) return { error: new AppError('NOT_FOUND', 'That fulfilment order is not open, or does not exist.') };
    const partner = getFulfillmentPartner(row.provider_slug);
    try {
      const state = await partner.getOrder(row.provider_order_id);
      await recordProviderState(tx, { id: row.id, orderId: row.order_id, orderNumber: row.order_number }, state);
      return { state };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await tx.execute(sql`UPDATE fulfillment_orders SET last_error = ${message.slice(0, 1000)}, synced_at = now(), updated_at = now() WHERE id = ${row.id}`);
      return { error };
    }
  });
  if ('error' in outcome) throw outcome.error;
  return outcome.state;
}

/**
 * The poll job: every open order, stalest answer first. A provider error is
 * recorded on the row and does not stop the batch.
 */
export async function syncOpenFulfillment(limit = 50): Promise<{ processed: number; failed: number; note?: string }> {
  return withTransaction(async (tx) => {
    const rows = await loadOpen(null, limit, tx);
    let processed = 0;
    let failed = 0;
    for (const row of rows) {
      const partner = getFulfillmentPartner(row.provider_slug);
      try {
        const state = await partner.getOrder(row.provider_order_id);
        await recordProviderState(tx, { id: row.id, orderId: row.order_id, orderNumber: row.order_number }, state);
        processed += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        await tx.execute(sql`UPDATE fulfillment_orders SET last_error = ${message.slice(0, 1000)}, synced_at = now(), updated_at = now() WHERE id = ${row.id}`);
      }
    }
    return { processed, failed, note: rows.length === 0 ? 'No open provider orders.' : undefined };
  });
}
