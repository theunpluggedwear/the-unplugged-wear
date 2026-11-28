import 'server-only';
import './events.ts';
import { sql, type SQL } from 'drizzle-orm';
import { getDb, withTransaction, type Transaction } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { emit } from '../../platform/events/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { toRupees } from '../../platform/money/index.ts';
import { recordAudit } from '../../platform/audit/index.ts';
import { getPaymentGateway } from '../../integrations/payments/index.ts';
import { reserve, syncProductStock } from '../inventory/index.ts';
import { nextOrderNumber } from '../orders/index.ts';
import { createRefund, type RefundMethod } from '../payments/index.ts';
import { notifyStaff } from '../notifications/index.ts';
import type { Disposition, ReturnStatus } from './schemas.ts';
import { RETURN_TRANSITIONS } from '../../platform/status/index.ts';

// Staff side of returns (DOC/backend/06, 13). Approving an exchange creates
// the follow-up order and charges (or refunds) the price difference; approving
// a replacement creates a free reprint order. Stock only moves when the
// warehouse marks a line restocked.

/** Who may move a request where. Refunds do not move the pipeline. */
export const NEXT_RETURN_STATUS: Record<ReturnStatus, ReturnStatus[]> = RETURN_TRANSITIONS as Record<ReturnStatus, ReturnStatus[]>;

const paise = (v: string | number | null) => (v === null ? 0 : Math.round(Number(v) * 100));
const like = (q?: string) => (q?.trim() ? `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null);

export interface AdminReturnRow {
  id: string;
  rmaNumber: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  type: 'exchange' | 'replacement';
  status: ReturnStatus;
  resolution: string;
  priceDifferencePaise: number;
  itemCount: number;
  createdAt: string;
  replacementOrderNumber: string | null;
  /** Still to be paid on an approved exchange. */
  duePaise: number;
}

export interface AdminReturnStats { requested: number; approved: number; inFlight: number; completed: number; rejected: number; total: number }

export interface AdminReturnLine {
  id: string;
  orderItemId: string;
  productName: string;
  variantLabel: string;
  qty: number;
  reasonCode: string;
  conditionNote: string | null;
  disposition: Disposition;
  exchangeVariantLabel: string | null;
}

export interface AdminReturnDetail extends AdminReturnRow {
  customerNote: string | null;
  rejectionReason: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  orderStatus: string;
  deliveredAt: string | null;
  evidence: { id: string; url: string; filename: string | null }[];
  lines: AdminReturnLine[];
  history: { from: string | null; to: string; note: string | null; actor: string; at: string }[];
  allowedNext: ReturnStatus[];
  refundId: string | null;
}

type RowSql = {
  id: string; rma_number: string; order_number: string; name: string | null; email: string | null;
  type: AdminReturnRow['type']; status: ReturnStatus; resolution: string; price_difference: string | null;
  created_at: string; items: number; replacement_order: string | null; replacement_total: string | null; replacement_payment: string | null;
};

const FROM = sql`FROM returns r
  JOIN orders o ON o.id = r.order_id
  LEFT JOIN users u ON u.id = o.placed_by_user_id
  LEFT JOIN profiles pr ON pr.user_id = o.placed_by_user_id`;

const SELECT = sql`SELECT r.id, r.rma_number, o.order_number,
    COALESCE(o.guest_name, NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), '')) AS name,
    COALESCE(o.guest_email, u.email) AS email,
    r.type, r.status, r.resolution, r.price_difference, r.created_at,
    (SELECT count(*)::int FROM return_items ri WHERE ri.return_id = r.id) AS items,
    (SELECT od.order_number FROM orders od WHERE od.id = r.replacement_order_id) AS replacement_order,
    (SELECT od.grand_total FROM orders od WHERE od.id = r.replacement_order_id) AS replacement_total,
    (SELECT od.payment_status FROM orders od WHERE od.id = r.replacement_order_id) AS replacement_payment`;

const toRow = (r: RowSql): AdminReturnRow => ({
  id: r.id, rmaNumber: r.rma_number, orderNumber: r.order_number, customerName: r.name || '—', customerEmail: r.email ?? '',
  type: r.type, status: r.status, resolution: r.resolution, priceDifferencePaise: paise(r.price_difference), itemCount: r.items,
  createdAt: new Date(r.created_at).toISOString(), replacementOrderNumber: r.replacement_order,
  duePaise: r.replacement_order && r.replacement_payment === 'pending' ? paise(r.replacement_total) : 0,
});

export async function adminListReturns(input: { q?: string; status?: ReturnStatus | 'all'; type?: 'exchange' | 'replacement' | 'all'; page?: number; perPage?: number }): Promise<{ rows: AdminReturnRow[]; total: number; stats: AdminReturnStats }> {
  const perPage = Math.min(Math.max(input.perPage ?? 20, 1), 200);
  const page = Math.max(input.page ?? 1, 1);
  const q = like(input.q);
  const search: SQL = q
    ? sql`(r.rma_number ILIKE ${q} OR o.order_number ILIKE ${q} OR u.email ILIKE ${q} OR o.guest_email ILIKE ${q}
        OR concat_ws(' ', pr.first_name, pr.last_name) ILIKE ${q})`
    : sql`true`;
  const status: SQL = input.status && input.status !== 'all' ? sql`r.status = ${input.status}` : sql`true`;
  const type: SQL = input.type && input.type !== 'all' ? sql`r.type = ${input.type}` : sql`true`;
  const where = sql`WHERE ${status} AND ${type} AND ${search}`;
  const db = getDb();
  const [{ rows }, { rows: [count] }, { rows: [stats] }] = await Promise.all([
    db.execute<RowSql>(sql`${SELECT} ${FROM} ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`),
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n ${FROM} ${where}`),
    db.execute<{ requested: number; approved: number; in_flight: number; completed: number; rejected: number; total: number }>(sql`
      SELECT count(*) FILTER (WHERE status = 'requested')::int AS requested,
             count(*) FILTER (WHERE status = 'approved')::int AS approved,
             count(*) FILTER (WHERE status IN ('pickup_scheduled','in_transit','received','inspected'))::int AS in_flight,
             count(*) FILTER (WHERE status = 'completed')::int AS completed,
             count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
             count(*)::int AS total FROM returns`),
  ]);
  return {
    rows: rows.map(toRow), total: count!.n,
    stats: { requested: stats!.requested, approved: stats!.approved, inFlight: stats!.in_flight, completed: stats!.completed, rejected: stats!.rejected, total: stats!.total },
  };
}

export async function adminGetReturn(returnId: string): Promise<AdminReturnDetail> {
  const db = getDb();
  const { rows: [r] } = await db.execute<RowSql & { customer_note: string | null; rejection_reason: string | null; carrier: string | null; tracking_number: string | null; refund_id: string | null; order_status: string; delivered_at: string | null }>(sql`
    ${SELECT}, r.customer_note, r.rejection_reason, r.carrier, r.tracking_number, r.refund_id, o.status AS order_status,
      (SELECT max(s.delivered_at) FROM shipments s WHERE s.order_id = o.id) AS delivered_at
    ${FROM} WHERE r.id = ${returnId}`);
  if (!r) throw new AppError('NOT_FOUND', 'That request does not exist.');
  const [{ rows: lines }, { rows: history }, { rows: evidence }] = await Promise.all([
    db.execute<{ id: string; order_item_id: string; product_name: string; options: Record<string, string> | null; qty: number; reason_code: string; condition_note: string | null; disposition: Disposition; exchange_variant: string | null }>(sql`
      SELECT ri.id, ri.order_item_id, oi.product_name, oi.options, ri.qty, ri.reason_code, ri.condition_note, ri.disposition,
             (SELECT coalesce(json_object_agg(d.slug, av.value)::text, '{}') FROM product_variant_attribute_values pvav
                JOIN attribute_definitions d ON d.id = pvav.definition_id JOIN attribute_values av ON av.id = pvav.value_id
                WHERE pvav.variant_id = ri.exchange_variant_id) AS exchange_variant
      FROM return_items ri JOIN order_items oi ON oi.id = ri.order_item_id WHERE ri.return_id = ${returnId} ORDER BY ri.created_at, ri.id`),
    db.execute<{ from_status: string | null; to_status: string; note: string | null; actor: string; created_at: string; actor_name: string | null }>(sql`
      SELECT h.from_status, h.to_status, h.note, h.actor, h.created_at,
             (SELECT COALESCE(NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''), u.email)
              FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id::text = h.actor) AS actor_name
      FROM return_status_history h WHERE h.return_id = ${returnId} ORDER BY h.created_at, h.id`),
    db.execute<{ id: string; url: string; filename: string | null }>(sql`
      SELECT m.id, m.url, m.filename FROM returns r, unnest(r.evidence_media_ids) AS ev(media_id)
      JOIN media m ON m.id = ev.media_id WHERE r.id = ${returnId}`),
  ]);
  const label = (options: Record<string, string> | null) => [options?.Color, options?.Size].filter(Boolean).join(' / ') || 'Standard';
  return {
    ...toRow(r),
    customerNote: r.customer_note, rejectionReason: r.rejection_reason, carrier: r.carrier, trackingNumber: r.tracking_number,
    orderStatus: r.order_status, deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null,
    evidence: evidence.map((e) => ({ id: e.id, url: e.url, filename: e.filename })),
    lines: lines.map((l) => ({
      id: l.id, orderItemId: l.order_item_id, productName: l.product_name, variantLabel: label(l.options), qty: l.qty,
      reasonCode: l.reason_code, conditionNote: l.condition_note, disposition: l.disposition,
      exchangeVariantLabel: l.exchange_variant ? label(JSON.parse(l.exchange_variant)) : null,
    })),
    history: history.map((h) => ({ from: h.from_status, to: h.to_status, note: h.note, actor: h.actor_name ?? h.actor, at: new Date(h.created_at).toISOString() })),
    allowedNext: NEXT_RETURN_STATUS[r.status],
    refundId: r.refund_id,
  };
}

interface LockedReturn {
  [key: string]: unknown;
  id: string; rma_number: string; type: 'exchange' | 'replacement'; status: ReturnStatus; resolution: string;
  price_difference: string | null; order_id: string; order_number: string; ordered_by: string | null;
  for_profile_id: string; for_household_id: string | null; shipping_address: string; billing_address: string;
  payment_status: string; replacement_order_id: string | null; refund_id: string | null;
}

async function lockReturn(tx: Transaction, returnId: string): Promise<LockedReturn> {
  const { rows: [r] } = await tx.execute<LockedReturn>(sql`
    SELECT r.id, r.rma_number, r.type, r.status, r.resolution, r.price_difference, r.order_id, o.order_number,
           o.placed_by_user_id AS ordered_by, r.requested_by_profile_id AS for_profile_id, o.for_household_id,
           o.shipping_address::text AS shipping_address, o.billing_address::text AS billing_address,
           o.payment_status, r.replacement_order_id, r.refund_id
    FROM returns r JOIN orders o ON o.id = r.order_id WHERE r.id = ${returnId} FOR NO KEY UPDATE OF r`);
  if (!r) throw new AppError('NOT_FOUND', 'That request does not exist.');
  return r;
}

export function followUpDueImmediately(grandTotalPaise: number): boolean {
  return grandTotalPaise === 0;
}

/** The follow-up order an approval creates: an exchange (pay the difference) or a free reprint. */
export async function createFollowUpOrder(tx: Transaction, ret: LockedReturn, actorId: string): Promise<{ orderId: string; orderNumber: string }> {
  if (ret.replacement_order_id) return { orderId: ret.replacement_order_id, orderNumber: '' };
  if (!ret.ordered_by) throw new AppError('RULE_VIOLATION', 'A replacement order needs a customer account on the original order.');
  const { rows: lines } = await tx.execute<{ order_item_id: string; product_id: string; variant_id: string | null; product_name: string; sku: string; options: Record<string, string> | null; qty: number; unit_price: string; exchange_variant_id: string | null; variant_price: string | null; variant_sku: string | null }>(sql`
    SELECT ri.order_item_id, oi.product_id, oi.variant_id, oi.product_name, oi.sku, oi.options, ri.qty, oi.unit_price,
           ri.exchange_variant_id, pv.price AS variant_price, pv.sku AS variant_sku
    FROM return_items ri JOIN order_items oi ON oi.id = ri.order_item_id
    LEFT JOIN product_variants pv ON pv.id = ri.exchange_variant_id
    WHERE ri.return_id = ${ret.id} ORDER BY ri.created_at, ri.id`);
  if (!lines.length) throw new AppError('RULE_VIOLATION', 'This request has no lines.');

  const isExchange = ret.type === 'exchange';
  const differencePaise = isExchange ? paise(ret.price_difference) : 0;
  const items = lines.map((l) => {
    const unit = isExchange ? paise(l.variant_price) : paise(l.unit_price);
    return {
      id: uuidv7(), productId: l.product_id, variantId: isExchange ? l.exchange_variant_id : l.variant_id,
      name: l.product_name, sku: isExchange ? (l.variant_sku ?? l.sku) : l.sku, unit, qty: l.qty, options: l.options,
    };
  });
  const subtotalPaise = items.reduce((n, i) => n + i.unit * i.qty, 0);
  const grandTotalPaise = Math.max(0, differencePaise);
  const dueImmediately = followUpDueImmediately(grandTotalPaise);
  // The difference the customer pays is shown as a discount on the full value,
  // so subtotal − discount = grand_total always holds (reports stay honest).
  const discountPaise = subtotalPaise - grandTotalPaise;

  const orderId = uuidv7();
  const orderNumber = await nextOrderNumber(tx);
  await tx.execute(sql`INSERT INTO orders (id, placed_by_user_id, for_profile_id, for_household_id, order_number, order_type, status,
      subtotal, shipping_fee, tax, discount, gift_card_amount, grand_total, payment_status, shipping_address, billing_address,
      idempotency_key, cancellable_until)
    VALUES (${orderId}, ${ret.ordered_by}, ${ret.for_profile_id}, ${ret.for_household_id}, ${orderNumber}, ${ret.type}, 'pending',
      ${toRupees(subtotalPaise)}, 0, 0, ${toRupees(Math.max(0, discountPaise))}, 0, ${toRupees(grandTotalPaise)},
      ${dueImmediately ? 'paid' : 'pending'}, ${ret.shipping_address}::jsonb, ${ret.billing_address}::jsonb,
      ${`return:${ret.rma_number}`}, ${dueImmediately ? sql`now()` : sql`NULL`})`);
  for (const item of items) {
    await tx.execute(sql`INSERT INTO order_items (id, order_id, product_id, variant_id, product_name, sku, unit_price, qty, line_total, options, exchange_policy)
      VALUES (${item.id}, ${orderId}, ${item.productId}, ${item.variantId}, ${item.name}, ${item.sku}, ${toRupees(item.unit)}, ${item.qty}, ${toRupees(item.unit * item.qty)}, ${JSON.stringify(item.options)}::jsonb, 'none')`);
  }
  if (items.some((i) => i.variantId)) {
    await reserve(tx, { orderId, lines: items.filter((i) => i.variantId).map((i) => ({ orderItemId: i.id, variantId: i.variantId!, qty: i.qty })) });
  }
  await tx.execute(sql`INSERT INTO order_status_history (id, order_id, from_status, to_status, note, actor)
    VALUES (${uuidv7()}, ${orderId}, NULL, 'pending', ${isExchange ? `Exchange for ${ret.rma_number}` : `Replacement for ${ret.rma_number}`}, ${actorId})`);
  await tx.execute(sql`UPDATE returns SET replacement_order_id = ${orderId}, updated_at = now() WHERE id = ${ret.id}`);
  return { orderId, orderNumber };
}

/** One staff decision. Rejection keeps the line open for a corrected request. */
export async function adminSetReturnStatus(
  change: { returnId: string; to: ReturnStatus; note?: string; rejectionReason?: string },
  actorId: string,
): Promise<{ replacementOrderNumber: string | null }> {
  const gateway = await getPaymentGateway();
  const result = await withTransaction(async (tx) => {
    const ret = await lockReturn(tx, change.returnId);
    if (ret.status === change.to) throw new AppError('RULE_VIOLATION', `This request is already ${change.to.replace('_', ' ')}.`);
    if (!NEXT_RETURN_STATUS[ret.status].includes(change.to)) {
      throw new AppError('RULE_VIOLATION', `A ${ret.status.replace('_', ' ')} request cannot be marked ${change.to.replace('_', ' ')}.`, [
        { field: 'to', message: `Allowed next: ${NEXT_RETURN_STATUS[ret.status].join(', ') || 'none'}` },
      ]);
    }
    const rejection = change.to === 'rejected' ? (change.rejectionReason?.trim().slice(0, 255) || '') : '';
    if (change.to === 'rejected' && rejection.length < 3) {
      throw new AppError('VALIDATION_FAILED', 'Say why the request is refused — the customer reads it.', [{ field: 'rejectionReason', message: 'A reason is required.' }]);
    }

    let replacementOrder: { orderId: string; orderNumber: string } | null = null;
    let resolution = ret.resolution;
    if (change.to === 'approved') {
      // The line is now used up, whatever happens to the parcel.
      const { rows } = await tx.execute<{ id: string }>(sql`
        UPDATE order_items oi SET returned_qty = oi.returned_qty + ri.qty
        FROM return_items ri
        WHERE ri.return_id = ${ret.id} AND oi.id = ri.order_item_id AND oi.returned_qty + ri.qty <= oi.qty
        RETURNING oi.id`);
      const { rows: [expected] } = await tx.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM return_items WHERE return_id = ${ret.id}`);
      if (rows.length !== expected!.n) {
        throw new AppError('CONFLICT', 'One of these items was already returned. Reload the request and check the quantities.');
      }
      replacementOrder = await createFollowUpOrder(tx, ret, actorId);
      resolution = ret.type;
      const differencePaise = ret.type === 'exchange' ? paise(ret.price_difference) : 0;
      if (differencePaise < 0) {
        if (ret.payment_status === 'paid') {
          const refund = await createRefund(tx, gateway, {
            orderId: ret.order_id, amountPaise: -differencePaise, reason: `Exchange price difference ${ret.rma_number}`,
            method: 'source', idempotencyKey: `return:${ret.rma_number}:difference`, actorId,
          });
          await tx.execute(sql`UPDATE returns SET refund_id = ${refund.refundId}, updated_at = now() WHERE id = ${ret.id}`);
        } else {
          await tx.execute(sql`INSERT INTO return_status_history (id, return_id, from_status, to_status, note, actor)
            VALUES (${uuidv7()}, ${ret.id}, ${ret.status}, 'approved', ${`Refund of ${toRupees(-differencePaise)} is due once the order is paid`}, 'system')`);
        }
      }
    }
    const note = change.note?.trim().slice(0, 500) || (change.to === 'rejected' ? rejection : null);
    await tx.execute(sql`UPDATE returns SET status = ${change.to}, resolution = ${resolution},
        rejection_reason = ${change.to === 'rejected' ? rejection : ret.status === 'rejected' ? sql`rejection_reason` : null},
        decided_by = ${['approved', 'rejected'].includes(change.to) ? actorId : sql`decided_by`},
        decided_at = ${['approved', 'rejected'].includes(change.to) ? sql`now()` : sql`decided_at`},
        updated_at = now()
      WHERE id = ${ret.id}`);
    await tx.execute(sql`INSERT INTO return_status_history (id, return_id, from_status, to_status, note, actor)
      VALUES (${uuidv7()}, ${ret.id}, ${ret.status}, ${change.to}, ${note}, ${actorId})`);
    await recordAudit(tx, {
      actorId, action: 'return.status', entity: 'returns', entityId: ret.id,
      diff: { status: { from: ret.status, to: change.to }, resolution: { from: ret.resolution, to: resolution } },
    });
    await notifyStaff(tx, 'return.view', [{
      kind: 'order', title: `${ret.rma_number} ${change.to.replace('_', ' ')}`,
      body: `${ret.order_number}${change.note ? ` — ${change.note.slice(0, 120)}` : ''}`, link: `/returns?open=${ret.rma_number}`,
      dedupeKey: `return.${change.to}:${ret.rma_number}`,
    }]);
    return { rmaNumber: ret.rma_number, status: change.to, replacementOrderNumber: replacementOrder?.orderNumber ?? null, returnId: ret.id };
  });
  void emit('return.decided', { returnId: result.returnId, rmaNumber: result.rmaNumber, status: result.status, replacementOrder: result.replacementOrderNumber });
  return { replacementOrderNumber: result.replacementOrderNumber };
}

/** Warehouse disposition. Restocking is the only path that puts stock back. */
export async function adminSetReturnItem(
  input: { returnId: string; itemId: string; disposition: Disposition; exchangeVariantId?: string },
  actorId: string,
): Promise<void> {
  await withTransaction(async (tx) => {
    const ret = await lockReturn(tx, input.returnId);
    if (['requested', 'rejected', 'cancelled'].includes(ret.status)) {
      throw new AppError('RULE_VIOLATION', 'Approve the request before deciding what happens to the items.');
    }
    const { rows: [item] } = await tx.execute<{ id: string; order_item_id: string; qty: number; disposition: Disposition; variant_id: string | null; product_id: string; exchange_variant_id: string | null }>(sql`
      SELECT ri.id, ri.order_item_id, ri.qty, ri.disposition, oi.variant_id, oi.product_id, ri.exchange_variant_id
      FROM return_items ri JOIN order_items oi ON oi.id = ri.order_item_id WHERE ri.id = ${input.itemId} AND ri.return_id = ${ret.id}`);
    if (!item) throw new AppError('NOT_FOUND', 'That line is not on this request.');
    if (input.disposition === 'restock' && item.disposition === 'restock') throw new AppError('RULE_VIOLATION', 'This line is already back in stock.');
    if ((input.disposition === 'exchange' || input.disposition === 'replacement') && !input.exchangeVariantId && !item.exchange_variant_id) {
      throw new AppError('VALIDATION_FAILED', 'Name the variant that replaces this one.');
    }
    if (input.disposition === 'restock' && item.variant_id) {
      const { rows: [v] } = await tx.execute<{ stock: number; product_id: string }>(sql`
        UPDATE product_variants SET stock = stock + ${item.qty}, updated_at = now() WHERE id = ${item.variant_id} RETURNING stock, product_id`);
      if (v) {
        await tx.execute(sql`INSERT INTO stock_movements (id, product_id, variant_id, order_item_id, qty_change, reason, qty_after)
          VALUES (${uuidv7()}, ${v.product_id}, ${item.variant_id}, ${item.order_item_id}, ${item.qty}, 'return', ${v.stock})`);
        await syncProductStock(tx, [v.product_id]);
      }
    }
    await tx.execute(sql`UPDATE return_items SET disposition = ${input.disposition},
        exchange_variant_id = ${input.exchangeVariantId ?? item.exchange_variant_id}, updated_at = now() WHERE id = ${item.id}`);
    await recordAudit(tx, {
      actorId, action: 'return.item', entity: 'return_items', entityId: item.id,
      diff: { disposition: { from: item.disposition, to: input.disposition } },
    });
  });
}

/** Refund that is not a price difference: an unfixable defect. One per request. */
export async function adminRefundReturn(
  input: { returnId: string; method: RefundMethod; destination?: string; refundKey: string },
  actorId: string,
): Promise<{ refundId: string }> {
  const gateway = await getPaymentGateway();
  const result = await withTransaction(async (tx) => {
    const ret = await lockReturn(tx, input.returnId);
    if (ret.refund_id) throw new AppError('CONFLICT', 'This request already has a refund.');
    if (['requested', 'rejected', 'cancelled'].includes(ret.status)) throw new AppError('RULE_VIOLATION', 'Approve the request before refunding it.');
    const { rows: [amount] } = await tx.execute<{ total: string | null }>(sql`
      SELECT sum(oi.unit_price * ri.qty) AS total FROM return_items ri JOIN order_items oi ON oi.id = ri.order_item_id WHERE ri.return_id = ${ret.id}`);
    const amountPaise = paise(amount?.total ?? null);
    if (amountPaise <= 0) throw new AppError('RULE_VIOLATION', 'There is nothing to refund on this request.');
    const refund = await createRefund(tx, gateway, {
      orderId: ret.order_id, amountPaise, reason: `Return ${ret.rma_number}`, method: input.method,
      destination: input.destination, idempotencyKey: input.refundKey, actorId,
    });
    await tx.execute(sql`UPDATE returns SET refund_id = ${refund.refundId}, resolution = 'refund', updated_at = now() WHERE id = ${ret.id}`);
    await recordAudit(tx, { actorId, action: 'return.refund', entity: 'returns', entityId: ret.id, diff: { refund: { from: null, to: refund.refundId } } });
    return { refundId: refund.refundId };
  });
  return result;
}
