import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { toPaise } from '../../platform/money/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { getFulfillmentPartner } from '../../integrations/fulfillment/index.ts';
import type { FulfillmentStatus } from '../../integrations/fulfillment/index.ts';
import { sendPlanned } from './submit.ts';
import { syncFulfillment, addEvent, type ShipmentStatusValue } from './sync.ts';
import { advanceOrderStatus, orderStatusFor } from './status.ts';
import { postWalletEntry } from './wallet.ts';
import { listClaimsFor } from './claims.ts';

// Read models + staff decisions for the fulfilment board and the shipments
// screen. Everything here needs `shipment.manage` (checked by the action
// layer); the customer never reaches these functions (DOC/backend/13 §admin).

export type BoardTab = 'all' | 'waiting' | 'queue' | 'hold' | 'in_production' | 'shipped' | 'issues';

export interface AdminFulfillmentRow {
  /** Fulfilment id, or the order id for a row that has not been sent yet. */
  id: string;
  fulfillmentId: string | null;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  provider: string | null;
  providerSlug: string | null;
  status: 'waiting' | FulfillmentStatus;
  providerStatus: string | null;
  gateway: 'prepaid' | 'cod';
  codPaise: number;
  providerCostPaise: number | null;
  awb: string | null;
  courier: string | null;
  itemCount: number;
  submitAttempts: number;
  lastError: string | null;
  submittedAt: string | null;
  syncedAt: string | null;
  createdAt: string;
  /** When the free-cancel window ends (waiting rows only). */
  cancellableUntil: string | null;
}

export interface AdminFulfillmentStats {
  waiting: number;
  queue: number;
  hold: number;
  inProduction: number;
  shipped: number;
  issues: number;
  delivered30d: number;
  codPendingPaise: number;
}

export interface AdminFulfillmentList {
  rows: AdminFulfillmentRow[];
  total: number;
  stats: AdminFulfillmentStats;
}

export async function adminFulfillmentStats(): Promise<AdminFulfillmentStats> {
  const { rows: [row] } = await getDb().execute<{
    waiting: number; queue: number; hold: number; production: number; shipped: number; issues: number; delivered: number; cod: string | null;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM orders o WHERE o.status = 'pending'
         AND (o.payment_status = 'paid' OR EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.method = 'cod'))
         AND NOT EXISTS (SELECT 1 FROM fulfillment_orders f WHERE f.order_id = o.id AND f.status NOT IN ('cancelled', 'failed'))) AS waiting,
      (SELECT count(*)::int FROM fulfillment_orders WHERE status IN ('pending', 'submitted')) AS queue,
      (SELECT count(*)::int FROM fulfillment_orders WHERE status = 'on_hold') AS hold,
      (SELECT count(*)::int FROM fulfillment_orders WHERE status = 'in_production') AS production,
      (SELECT count(*)::int FROM fulfillment_orders WHERE status IN ('shipped', 'delivery_exception', 'rto_initiated')) AS shipped,
      (SELECT count(*)::int FROM fulfillment_orders WHERE status = 'failed' OR last_error IS NOT NULL) AS issues,
      (SELECT count(*)::int FROM fulfillment_orders WHERE status = 'delivered' AND delivered_at > now() - interval '30 days') AS delivered,
      (SELECT SUM(cod_amount) FROM fulfillment_orders WHERE gateway = 'cod' AND status = 'delivered' AND cod_remittance_id IS NULL) AS cod`);
  return {
    waiting: row?.waiting ?? 0, queue: row?.queue ?? 0, hold: row?.hold ?? 0,
    inProduction: row?.production ?? 0, shipped: row?.shipped ?? 0, issues: row?.issues ?? 0,
    delivered30d: row?.delivered ?? 0, codPendingPaise: row?.cod ? toPaise(row.cod) : 0,
  };
}

const BOARD_WHERE: Record<Exclude<BoardTab, 'all' | 'waiting'>, SQL> = {
  queue: sql`f.status IN ('pending', 'submitted')`,
  hold: sql`f.status = 'on_hold'`,
  in_production: sql`f.status = 'in_production'`,
  shipped: sql`f.status IN ('shipped', 'delivery_exception', 'rto_initiated')`,
  issues: sql`(f.status = 'failed' OR f.last_error IS NOT NULL)`,
};

type BoardSql = {
  id: string; order_number: string; customer_name: string; customer_email: string; provider_name: string;
  provider_slug: string; status: FulfillmentStatus; provider_status: string | null; gateway: 'prepaid' | 'cod';
  cod_amount: string | null; provider_cost: string | null; awb: string | null; courier: string | null;
  item_count: number; submit_attempts: number; last_error: string | null; submitted_at: string | null;
  synced_at: string | null; created_at: string;
};

const customerName = sql`COALESCE(o.guest_name, NULLIF(trim(pr.first_name || ' ' || pr.last_name), ''), 'Customer')`;
const customerEmail = sql`COALESCE(o.guest_email, u.email, '')`;

export async function adminListFulfillment(input: { tab?: BoardTab | ''; q?: string; page?: number; perPage?: number } = {}): Promise<AdminFulfillmentList> {
  const tab: BoardTab = !input.tab || input.tab === 'all' ? 'all' : input.tab;
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 20;
  const offset = (page - 1) * perPage;
  const db = getDb();
  const stats = await adminFulfillmentStats();
  const search = input.q?.trim() ?? '';

  if (tab === 'waiting') {
    const where = sql`o.status = 'pending'
      AND (o.payment_status = 'paid' OR EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.method = 'cod'))
      AND NOT EXISTS (SELECT 1 FROM fulfillment_orders f WHERE f.order_id = o.id AND f.status NOT IN ('cancelled', 'failed'))
      ${search ? sql`AND (o.order_number ILIKE ${'%' + search + '%'} OR o.guest_name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'} OR pr.first_name ILIKE ${'%' + search + '%'})` : sql``}`;
    const [{ rows }, { rows: [count] }] = await Promise.all([
      db.execute<{
        id: string; order_number: string; customer_name: string; customer_email: string; gateway: 'prepaid' | 'cod';
        grand_total: string; item_count: number; created_at: string; cancellable_until: string | null;
      }>(sql`
        SELECT o.id, o.order_number, ${customerName} AS customer_name, ${customerEmail} AS customer_email,
               CASE WHEN EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.method = 'cod') THEN 'cod' ELSE 'prepaid' END AS gateway,
               o.grand_total,
               (SELECT count(*)::int FROM order_items oi JOIN products pd ON pd.id = oi.product_id
                 WHERE oi.order_id = o.id AND pd.product_kind <> 'gift_card') AS item_count,
               o.created_at, o.cancellable_until
        FROM orders o
        LEFT JOIN profiles pr ON pr.id = o.for_profile_id
        LEFT JOIN users u ON u.id = o.placed_by_user_id
        WHERE ${where}
        ORDER BY o.created_at LIMIT ${perPage} OFFSET ${offset}`),
      db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM orders o
        LEFT JOIN profiles pr ON pr.id = o.for_profile_id
        LEFT JOIN users u ON u.id = o.placed_by_user_id WHERE ${where}`),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.id, fulfillmentId: null, orderNumber: r.order_number, customerName: r.customer_name, customerEmail: r.customer_email,
        provider: null, providerSlug: null, status: 'waiting' as const, providerStatus: null, gateway: r.gateway,
        codPaise: r.gateway === 'cod' ? toPaise(r.grand_total) : 0, providerCostPaise: null, awb: null, courier: null,
        itemCount: r.item_count, submitAttempts: 0, lastError: null, submittedAt: null, syncedAt: null,
        createdAt: new Date(r.created_at).toISOString(), cancellableUntil: r.cancellable_until ? new Date(r.cancellable_until).toISOString() : null,
      })),
      total: count?.n ?? 0, stats,
    };
  }

  const where = sql`${tab === 'all' ? sql`TRUE` : BOARD_WHERE[tab]}
    ${search ? sql`AND (o.order_number ILIKE ${'%' + search + '%'} OR o.guest_name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'} OR pr.first_name ILIKE ${'%' + search + '%'} OR f.awb ILIKE ${'%' + search + '%'} OR f.external_ref ILIKE ${'%' + search + '%'})` : sql``}`;
  const [{ rows }, { rows: [count] }] = await Promise.all([
    db.execute<BoardSql>(sql`
      SELECT f.id, o.order_number, ${customerName} AS customer_name, ${customerEmail} AS customer_email,
             ip.name AS provider_name, ip.slug AS provider_slug, f.status, f.provider_status, f.gateway,
             f.cod_amount, f.provider_cost, f.awb, f.courier, f.submit_attempts, f.last_error,
             f.submitted_at, f.synced_at, f.created_at,
             (SELECT COALESCE(SUM(i.qty), 0)::int FROM fulfillment_order_items i WHERE i.fulfillment_order_id = f.id) AS item_count
      FROM fulfillment_orders f
      JOIN orders o ON o.id = f.order_id
      JOIN integration_providers ip ON ip.id = f.provider_id
      LEFT JOIN profiles pr ON pr.id = o.for_profile_id
      LEFT JOIN users u ON u.id = o.placed_by_user_id
      WHERE ${where}
      ORDER BY f.created_at DESC LIMIT ${perPage} OFFSET ${offset}`),
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM fulfillment_orders f
      JOIN orders o ON o.id = f.order_id
      LEFT JOIN profiles pr ON pr.id = o.for_profile_id
      LEFT JOIN users u ON u.id = o.placed_by_user_id
      WHERE ${where}`),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id, fulfillmentId: r.id, orderNumber: r.order_number, customerName: r.customer_name,
      customerEmail: r.customer_email, provider: r.provider_name, providerSlug: r.provider_slug, status: r.status,
      providerStatus: r.provider_status, gateway: r.gateway, codPaise: r.cod_amount ? toPaise(r.cod_amount) : 0,
      providerCostPaise: r.provider_cost ? toPaise(r.provider_cost) : null, awb: r.awb, courier: r.courier,
      itemCount: r.item_count, submitAttempts: r.submit_attempts, lastError: r.last_error,
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
      syncedAt: r.synced_at ? new Date(r.synced_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(), cancellableUntil: null,
    })),
    total: count?.n ?? 0, stats,
  };
}

export interface AdminFulfillmentDetail {
  row: AdminFulfillmentRow;
  orderId: string;
  items: { id: string; productName: string; sku: string; qty: number; unitPaise: number }[];
  wallet: { kind: string; direction: 'debit' | 'credit'; amountPaise: number; createdAt: string; note: string | null }[];
  claims: Awaited<ReturnType<typeof listClaimsFor>>;
  events: { status: string; description: string | null; location: string | null; at: string }[];
}

export async function adminGetFulfillment(fulfillmentId: string): Promise<AdminFulfillmentDetail> {
  const db = getDb();
  const { rows: [row] } = await db.execute<BoardSql & { order_id: string }>(sql`
    SELECT f.id, f.order_id, o.order_number, ${customerName} AS customer_name, ${customerEmail} AS customer_email,
           ip.name AS provider_name, ip.slug AS provider_slug, f.status, f.provider_status, f.gateway,
           f.cod_amount, f.provider_cost, f.awb, f.courier, f.submit_attempts, f.last_error,
           f.submitted_at, f.synced_at, f.created_at,
           (SELECT COALESCE(SUM(i.qty), 0)::int FROM fulfillment_order_items i WHERE i.fulfillment_order_id = f.id) AS item_count
    FROM fulfillment_orders f
    JOIN orders o ON o.id = f.order_id
    JOIN integration_providers ip ON ip.id = f.provider_id
    LEFT JOIN profiles pr ON pr.id = o.for_profile_id
    LEFT JOIN users u ON u.id = o.placed_by_user_id
    WHERE f.id = ${fulfillmentId}`);
  if (!row) throw new AppError('NOT_FOUND', 'That fulfilment order does not exist.');
  const [{ rows: items }, { rows: wallet }, { rows: events }, claims] = await Promise.all([
    db.execute<{ id: string; product_name: string; provider_sku: string; qty: number; unit_price: string }>(sql`
      SELECT fitem.id, oi.product_name, fitem.provider_sku, fitem.qty, oi.unit_price
      FROM fulfillment_order_items fitem JOIN order_items oi ON oi.id = fitem.order_item_id
      WHERE fitem.fulfillment_order_id = ${fulfillmentId} ORDER BY oi.created_at`),
    db.execute<{ kind: string; direction: 'debit' | 'credit'; amount: string; created_at: string; note: string | null }>(sql`
      SELECT kind, direction, amount, created_at, note FROM provider_wallet_ledger
      WHERE fulfillment_order_id = ${fulfillmentId} ORDER BY created_at`),
    db.execute<{ status: string; description: string | null; location: string | null; occurred_at: string }>(sql`
      SELECT e.status, e.description, e.location, e.occurred_at FROM shipment_events e
      JOIN shipments s ON s.id = e.shipment_id
      WHERE s.fulfillment_order_id = ${fulfillmentId} ORDER BY e.occurred_at`),
    listClaimsFor(fulfillmentId),
  ]);
  return {
    row: {
      id: row.id, fulfillmentId: row.id, orderNumber: row.order_number, customerName: row.customer_name,
      customerEmail: row.customer_email, provider: row.provider_name, providerSlug: row.provider_slug,
      status: row.status, providerStatus: row.provider_status, gateway: row.gateway,
      codPaise: row.cod_amount ? toPaise(row.cod_amount) : 0, providerCostPaise: row.provider_cost ? toPaise(row.provider_cost) : null,
      awb: row.awb, courier: row.courier, itemCount: row.item_count, submitAttempts: row.submit_attempts,
      lastError: row.last_error, submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
      syncedAt: row.synced_at ? new Date(row.synced_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(), cancellableUntil: null,
    },
    orderId: row.order_id,
    items: items.map((i) => ({ id: i.id, productName: i.product_name, sku: i.provider_sku, qty: i.qty, unitPaise: toPaise(i.unit_price) })),
    wallet: wallet.map((w) => ({ kind: w.kind, direction: w.direction, amountPaise: toPaise(w.amount), createdAt: new Date(w.created_at).toISOString(), note: w.note })),
    claims,
    events: events.map((e) => ({ status: e.status, description: e.description, location: e.location, at: new Date(e.occurred_at).toISOString() })),
  };
}

/** "Submit now" — either a waiting order (by number) or a failed row. */
export async function adminSubmitFulfillment(input: { orderNumber?: string; fulfillmentId?: string }): Promise<{ orderNumber: string; sent: number; failed: number; message: string }> {
  let orderId: string | null = null;
  if (input.orderNumber) {
    const { rows: [o] } = await getDb().execute<{ id: string }>(sql`SELECT id FROM orders WHERE order_number = ${input.orderNumber}`);
    if (!o) throw new AppError('NOT_FOUND', 'No order has that number.');
    orderId = o.id;
  } else if (input.fulfillmentId) {
    const { rows: [f] } = await getDb().execute<{ order_id: string }>(sql`SELECT order_id FROM fulfillment_orders WHERE id = ${input.fulfillmentId}`);
    if (!f) throw new AppError('NOT_FOUND', 'That fulfilment order does not exist.');
    orderId = f.order_id;
  }
  if (!orderId) throw new AppError('VALIDATION_FAILED', 'Name the order or the fulfilment row.');
  const outcome = await sendPlanned(orderId, true);
  const sent = outcome.groups.filter((g) => g.status === 'sent').length;
  const failed = outcome.groups.filter((g) => g.status === 'failed').length;
  const message = failed
    ? outcome.groups.filter((g) => g.status === 'failed').map((g) => `${g.providerName}: ${g.error}`).join(' · ')
    : outcome.skipped.length && !sent
      ? outcome.skipped.map((s) => s.reason).join(' · ')
      : sent ? `Sent to ${outcome.groups.filter((g) => g.status === 'sent').map((g) => g.providerName).join(', ')}.` : 'Nothing to send.';
  return { orderNumber: outcome.orderNumber, sent, failed, message };
}

export async function adminSyncFulfillment(fulfillmentId: string): Promise<{ status: string; providerStatus: string; courier: string | null; awb: string | null }> {
  const state = await syncFulfillment(fulfillmentId);
  return { status: state.status, providerStatus: state.providerStatus, courier: state.courier ?? null, awb: state.awb ?? null };
}

/** Cancel with the partner, then mirror it locally. Money already charged is credited back. */
export async function adminCancelFulfillment(input: { fulfillmentId: string; note?: string }, actorId: string): Promise<{ providerStatus: string; refundedPaise: number }> {
  const { rows: [row] } = await getDb().execute<{
    id: string; order_id: string; status: FulfillmentStatus; provider_order_id: string | null; provider_slug: string;
    provider_id: string; provider_cost: string | null; order_number: string;
  }>(sql`
    SELECT f.id, f.order_id, f.status, f.provider_order_id, ip.slug AS provider_slug, f.provider_id,
           f.provider_cost, o.order_number
    FROM fulfillment_orders f JOIN integration_providers ip ON ip.id = f.provider_id
    JOIN orders o ON o.id = f.order_id WHERE f.id = ${input.fulfillmentId}`);
  if (!row) throw new AppError('NOT_FOUND', 'That fulfilment order does not exist.');
  if (!['pending', 'submitted', 'on_hold', 'in_production', 'failed'].includes(row.status)) {
    throw new AppError('RULE_VIOLATION', `A ${row.status.replace(/_/g, ' ')} parcel can no longer be cancelled with the partner.`);
  }
  if (row.provider_order_id?.startsWith('sim_')) {
    throw new AppError('RULE_VIOLATION', 'This order was accepted by the built-in simulator before real keys existed — there is nothing to cancel at Qikink. Mark it cancelled locally instead.');
  }
  let providerStatus = 'cancelled';
  if (row.provider_order_id) {
    const partner = getFulfillmentPartner(row.provider_slug);
    const result = await partner.cancelOrder(row.provider_order_id);
    providerStatus = result.providerStatus;
    if (!result.cancelled) {
      await getDb().execute(sql`UPDATE fulfillment_orders SET last_error = ${`Cancel refused: provider is "${result.providerStatus}"`}, updated_at = now() WHERE id = ${row.id}`);
      throw new AppError('RULE_VIOLATION', `The partner refused the cancellation — the order is "${result.providerStatus}".`);
    }
  }
  const refunded = row.provider_cost ? toPaise(row.provider_cost) : 0;
  await withTransaction(async (tx) => {
    await tx.execute(sql`UPDATE fulfillment_orders SET status = 'cancelled', provider_status = ${providerStatus},
      synced_at = now(), last_error = NULL, updated_at = now() WHERE id = ${row.id}`);
    await advanceOrderStatus(tx, row.order_id, 'cancelled', input.note ?? `Cancelled at ${row.provider_slug} (${providerStatus})`, actorId);
    if (refunded > 0) {
      await postWalletEntry(tx, {
        providerId: row.provider_id, kind: 'cancel_credit', direction: 'credit', amountPaise: refunded,
        fulfillmentOrderId: row.id, note: `${row.order_number} cancelled at the partner`, actor: actorId,
      });
    }
  });
  return { providerStatus, refundedPaise: refunded };
}

// --------------------------------------------------------------- shipments

export interface AdminShipmentRow {
  id: string;
  orderNumber: string;
  customerName: string;
  carrier: string | null;
  trackingNumber: string | null;
  status: ShipmentStatusValue;
  pieces: number;
  shippedAt: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  eventCount: number;
}

export async function adminListShipments(input: { q?: string; status?: ShipmentStatusValue | 'all'; page?: number; perPage?: number } = {}): Promise<{ rows: AdminShipmentRow[]; total: number }> {
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 20;
  const search = input.q?.trim() ?? '';
  const where = sql`${input.status && input.status !== 'all' ? sql`s.status = ${input.status}` : sql`TRUE`}
    ${search ? sql`AND (o.order_number ILIKE ${'%' + search + '%'} OR s.tracking_number ILIKE ${'%' + search + '%'} OR s.carrier ILIKE ${'%' + search + '%'} OR o.guest_name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'})` : sql``}`;
  const db = getDb();
  const [{ rows }, { rows: [count] }] = await Promise.all([
    db.execute<{
      id: string; order_number: string; customer_name: string; carrier: string | null; tracking_number: string | null;
      status: ShipmentStatusValue; pieces: number; shipped_at: string | null; estimated_delivery_at: string | null;
      delivered_at: string | null; event_count: number;
    }>(sql`
      SELECT s.id, o.order_number, ${customerName} AS customer_name, s.carrier, s.tracking_number, s.status, s.pieces,
             s.shipped_at, s.estimated_delivery_at, s.delivered_at,
             (SELECT count(*)::int FROM shipment_events e WHERE e.shipment_id = s.id) AS event_count
      FROM shipments s
      JOIN orders o ON o.id = s.order_id
      LEFT JOIN profiles pr ON pr.id = o.for_profile_id
      LEFT JOIN users u ON u.id = o.placed_by_user_id
      WHERE ${where}
      ORDER BY COALESCE(s.shipped_at, s.created_at) DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`),
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM shipments s
      JOIN orders o ON o.id = s.order_id
      LEFT JOIN profiles pr ON pr.id = o.for_profile_id
      LEFT JOIN users u ON u.id = o.placed_by_user_id
      WHERE ${where}`),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id, orderNumber: r.order_number, customerName: r.customer_name, carrier: r.carrier,
      trackingNumber: r.tracking_number, status: r.status, pieces: r.pieces,
      shippedAt: r.shipped_at ? new Date(r.shipped_at).toISOString() : null,
      estimatedDeliveryAt: r.estimated_delivery_at ? new Date(r.estimated_delivery_at).toISOString().slice(0, 10) : null,
      deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null,
      eventCount: r.event_count,
    })),
    total: count?.n ?? 0,
  };
}

export async function adminGetShipment(shipmentId: string): Promise<{ row: AdminShipmentRow; events: { id: string; status: string; location: string | null; description: string | null; at: string }[] }> {
  const { rows: [row] } = await getDb().execute<{
    id: string; order_number: string; customer_name: string; carrier: string | null; tracking_number: string | null;
    status: ShipmentStatusValue; pieces: number; shipped_at: string | null; estimated_delivery_at: string | null;
    delivered_at: string | null;
  }>(sql`
    SELECT s.id, o.order_number, ${customerName} AS customer_name, s.carrier, s.tracking_number, s.status, s.pieces,
           s.shipped_at, s.estimated_delivery_at, s.delivered_at
    FROM shipments s JOIN orders o ON o.id = s.order_id
    LEFT JOIN profiles pr ON pr.id = o.for_profile_id
    LEFT JOIN users u ON u.id = o.placed_by_user_id
    WHERE s.id = ${shipmentId}`);
  if (!row) throw new AppError('NOT_FOUND', 'That shipment does not exist.');
  const { rows: events } = await getDb().execute<{ id: string; status: string; location: string | null; description: string | null; occurred_at: string }>(sql`
    SELECT id, status, location, description, occurred_at FROM shipment_events WHERE shipment_id = ${shipmentId} ORDER BY occurred_at DESC`);
  return {
    row: {
      id: row.id, orderNumber: row.order_number, customerName: row.customer_name, carrier: row.carrier,
      trackingNumber: row.tracking_number, status: row.status, pieces: row.pieces,
      shippedAt: row.shipped_at ? new Date(row.shipped_at).toISOString() : null,
      estimatedDeliveryAt: row.estimated_delivery_at ? new Date(row.estimated_delivery_at).toISOString().slice(0, 10) : null,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
      eventCount: events.length,
    },
    events: events.map((e) => ({ id: e.id, status: e.status, location: e.location, description: e.description, at: new Date(e.occurred_at).toISOString() })),
  };
}

/** Manual dispatch: in-house parcels, or a courier the partner did not report. */
export async function adminAddTracking(input: { orderNumber: string; carrier: string; trackingNumber: string; shippedAt?: string; estimatedDeliveryAt?: string; note?: string }): Promise<{ shipmentId: string; orderNumber: string }> {
  const { rows: [order] } = await getDb().execute<{ id: string; order_number: string }>(sql`SELECT id, order_number FROM orders WHERE order_number = ${input.orderNumber}`);
  if (!order) throw new AppError('NOT_FOUND', 'No order has that number.');
  const shipmentId = uuidv7();
  await withTransaction(async (tx) => {
    await tx.execute(sql`INSERT INTO shipments (id, order_id, carrier, tracking_number, status, pieces, shipped_at, estimated_delivery_at)
      VALUES (${shipmentId}, ${order.id}, ${input.carrier}, ${input.trackingNumber}, 'shipped', 1,
              ${input.shippedAt ?? new Date().toISOString()}, ${input.estimatedDeliveryAt ?? null})`);
    await addEvent(tx, shipmentId, 'shipped', null, input.note ?? `Handed to ${input.carrier} · ${input.trackingNumber}`);
    await advanceOrderStatus(tx, order.id, 'shipped', `Dispatched with ${input.carrier} (${input.trackingNumber})`);
  });
  return { shipmentId, orderNumber: order.order_number };
}

export async function adminSetShipmentStatus(input: { shipmentId: string; status: ShipmentStatusValue; location?: string; note?: string }): Promise<void> {
  const { rows: [shipment] } = await getDb().execute<{ id: string; order_id: string; order_number: string; status: ShipmentStatusValue }>(sql`
    SELECT s.id, s.order_id, o.order_number, s.status FROM shipments s JOIN orders o ON o.id = s.order_id WHERE s.id = ${input.shipmentId}`);
  if (!shipment) throw new AppError('NOT_FOUND', 'That shipment does not exist.');
  await withTransaction(async (tx) => {
    await tx.execute(sql`UPDATE shipments SET status = ${input.status},
        delivered_at = CASE WHEN ${input.status} = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
        shipped_at = CASE WHEN ${shipment.status} = 'pending' AND ${input.status} <> 'pending' THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
        updated_at = now() WHERE id = ${shipment.id}`);
    await addEvent(tx, shipment.id, input.status, input.location ?? null, input.note ?? `Marked ${input.status.replace(/_/g, ' ')} by staff`);
    const to = input.status === 'delivered' ? 'delivered' : input.status === 'returned' ? 'failed' : 'shipped';
    await advanceOrderStatus(tx, shipment.order_id, to, input.note ?? `Courier status: ${input.status.replace(/_/g, ' ')}`);
  });
}

/** Mirror a manual provider answer onto a fulfilment row (no HTTP call). */
export async function adminSetFulfillmentState(input: { fulfillmentId: string; status: FulfillmentStatus; note?: string }): Promise<void> {
  const { rows: [row] } = await getDb().execute<{ id: string; order_id: string; order_number: string }>(sql`
    SELECT f.id, f.order_id, o.order_number FROM fulfillment_orders f JOIN orders o ON o.id = f.order_id WHERE f.id = ${input.fulfillmentId}`);
  if (!row) throw new AppError('NOT_FOUND', 'That fulfilment order does not exist.');
  const note = input.note ?? `Moved to ${input.status.replace(/_/g, ' ')} by staff`;
  await withTransaction(async (tx) => {
    await tx.execute(sql`UPDATE fulfillment_orders SET status = ${input.status}, provider_status = ${input.status},
      delivered_at = CASE WHEN ${input.status} = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
      synced_at = now(), updated_at = now() WHERE id = ${row.id}`);
    const to = orderStatusFor(input.status);
    if (to) await advanceOrderStatus(tx, row.order_id, to, note);
  });
}
