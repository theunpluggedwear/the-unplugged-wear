import 'server-only';
import './events.ts';
import { sql } from 'drizzle-orm';
import { withTransaction, getDb, type Transaction } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { emit } from '../../platform/events/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { toRupees } from '../../platform/money/index.ts';
import { recordAudit } from '../../platform/audit/index.ts';
import { getPaymentGateway } from '../../integrations/payments/index.ts';
import { profileIdForUser } from '../customers/index.ts';
import { notifyStaff } from '../notifications/index.ts';
import { takePayment } from '../payments/index.ts';
import { getSetting } from '../settings/index.ts';
import type { CreateReturnInput } from './schemas.ts';

// A customer's side of returns (DOC/backend/06, 13): one transaction writes
// the request, its lines and the first history row, or nothing at all.
// Exchanges are size/variant swaps inside the window; defects become a free
// replacement. Nobody gets money back except a negative exchange difference.

const RMA_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** RMA-2026-K7Q4M: the year plus five unambiguous characters. */
async function newRmaNumber(tx: Transaction): Promise<string> {
  const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4);
  for (let attempt = 0; attempt < 8; attempt++) {
    const tail = Array.from({ length: 5 }, () => RMA_ALPHABET[Math.floor(Math.random() * RMA_ALPHABET.length)]).join('');
    const candidate = `RMA-${year}-${tail}`;
    const { rows } = await tx.execute(sql`SELECT 1 FROM returns WHERE rma_number = ${candidate}`);
    if (!rows.length) return candidate;
  }
  throw new AppError('INTERNAL_ERROR', 'Could not number the request. Please try again.');
}

const paise = (v: string | number | null) => (v === null ? 0 : Math.round(Number(v) * 100));
const isUnique = (error: unknown, constraint: string) =>
  (error as { cause?: { code?: string; constraint?: string } }).cause?.code === '23505'
  && (error as { cause?: { constraint?: string } }).cause?.constraint === constraint;

/**
 * Uploads are a demo until object storage ships (TL-BE-11 phase): the chosen
 * files are recorded as media rows with a demo:// URL and no bytes. The
 * request then points at real rows, so nothing is invented at read time.
 */
export async function recordDemoEvidence(userId: string, files: { name: string; mimeType?: string; sizeBytes?: number }[]): Promise<string[]> {
  const clean = files.filter((f) => f.name.trim()).slice(0, 10);
  if (!clean.length) throw new AppError('VALIDATION_FAILED', 'Add at least one photo of the item.', [{ field: 'evidence', message: 'At least one photo is required.' }]);
  const ids: string[] = [];
  await withTransaction(async (tx) => {
    for (const file of clean) {
      const id = uuidv7();
      ids.push(id);
      const safe = file.name.trim().slice(0, 120).replace(/[^\w.\- ]/g, '_');
      await tx.execute(sql`INSERT INTO media (id, url, filename, size_bytes, mime_type, usage, uploaded_by)
        VALUES (${id}, ${`demo://returns/${id}/${safe}`}, ${safe}, ${file.sizeBytes && file.sizeBytes > 0 ? file.sizeBytes : null}, ${file.mimeType?.slice(0, 100) ?? null}, 'design', ${userId})`);
    }
  });
  return ids;
}

interface LockedOrder {
  [key: string]: unknown;
  id: string; order_number: string; status: string; placed_by_user_id: string | null;
  for_profile_id: string | null; for_household_id: string | null; delivered_at: string | null;
}

async function lockOrderForRequester(tx: Transaction, userId: string, orderNumber: string): Promise<LockedOrder> {
  const profileId = await profileIdForUser(userId, tx);
  const { rows: [order] } = await tx.execute<LockedOrder>(sql`
    SELECT o.id, o.order_number, o.status, o.placed_by_user_id, o.for_profile_id, o.for_household_id,
           (SELECT max(s.delivered_at) FROM shipments s WHERE s.order_id = o.id) AS delivered_at
    FROM orders o
    WHERE o.order_number = ${orderNumber}
      AND (o.placed_by_user_id = ${userId}
        OR o.for_household_id IN (SELECT hm.household_id FROM household_members hm WHERE hm.profile_id = ${profileId}))
    FOR NO KEY UPDATE OF o`);
  if (!order) throw new AppError('NOT_FOUND', 'We could not find that order.');
  return order;
}

export interface CreatedReturn {
  id: string;
  rmaNumber: string;
  priceDifferencePaise: number;
  replayed: boolean;
}

export async function createReturn(userId: string, input: CreateReturnInput): Promise<CreatedReturn> {
  const windowDays = await getSetting('exchange.window_days');
  try {
    const made = await withTransaction(async (tx) => {
      const order = await lockOrderForRequester(tx, userId, input.orderNumber);
      const profileId = order.for_profile_id ?? (await profileIdForUser(userId, tx));
      const { rows: [earlier] } = await tx.execute<{ id: string; rma_number: string; price_difference: string | null }>(sql`
        SELECT id, rma_number, price_difference FROM returns
        WHERE requested_by_profile_id = ${profileId} AND idempotency_key = ${input.requestKey}`);
      if (earlier) return { id: earlier.id, rmaNumber: earlier.rma_number, priceDifferencePaise: paise(earlier.price_difference), replayed: true, orderNumber: order.order_number };

      if (order.status !== 'delivered') throw new AppError('RULE_VIOLATION', 'Exchanges and replacements open once the parcel is delivered.');
      if (!order.delivered_at) throw new AppError('RULE_VIOLATION', 'We have no delivery date for this order yet.');
      const deadline = new Date(order.delivered_at).getTime() + windowDays * 86_400_000;
      if (Date.now() > deadline) throw new AppError('RULE_VIOLATION', `The ${windowDays}-day window for this order has closed.`);

      const ids = sql.join(input.items.map((i) => sql`${i.orderItemId}::uuid`), sql`, `);
      const { rows: lines } = await tx.execute<{
        id: string; product_id: string; variant_id: string | null; product_name: string; sku: string; options: Record<string, string> | null;
        unit_price: string; qty: number; returned_qty: number; exchange_policy: 'defects_only' | 'exchangeable' | 'none'; requested: number;
      }>(sql`
        SELECT oi.id, oi.product_id, oi.variant_id, oi.product_name, oi.sku, oi.options, oi.unit_price, oi.qty, oi.returned_qty, oi.exchange_policy,
               (SELECT coalesce(sum(ri.qty), 0)::int FROM return_items ri JOIN returns r ON r.id = ri.return_id
                 WHERE ri.order_item_id = oi.id AND r.status NOT IN ('rejected','cancelled')) AS requested
        FROM order_items oi WHERE oi.order_id = ${order.id} AND oi.id IN (${ids})`);
      if (lines.length !== input.items.length) throw new AppError('VALIDATION_FAILED', 'One of those items is not on this order.');

      // Exchange variants must exist, be in stock, and belong to the same product.
      const wanted = input.items.filter((i) => i.exchangeVariantId).map((i) => i.exchangeVariantId!);
      const variantById = new Map<string, { id: string; product_id: string; price: string; stock: number }>();
      if (wanted.length) {
        const { rows } = await tx.execute<{ id: string; product_id: string; price: string; stock: number }>(sql`
          SELECT id, product_id, price, stock FROM product_variants WHERE id IN (${sql.join(wanted.map((v) => sql`${v}::uuid`), sql`, `)}) AND is_active`);
        for (const v of rows) variantById.set(v.id, v);
      }

      let priceDifferencePaise = 0;
      const rowsToWrite = input.items.map((item) => {
        const line = lines.find((l) => l.id === item.orderItemId)!;
        // Reason codes are type-specific (also a DB CHECK): an exchange fixes
        // fit or variant, a replacement fixes a defect.
        const reasons = input.type === 'exchange' ? ['size_fit', 'wrong_variant'] : ['damaged', 'misprint', 'wrong_item', 'quality'];
        if (!reasons.includes(item.reasonCode)) {
          throw new AppError('VALIDATION_FAILED', input.type === 'exchange'
            ? 'An exchange is for fit or variant. Report a defect as a replacement instead.'
            : 'A replacement is for a defect. Use an exchange for fit or variant.', [{ field: item.orderItemId, message: 'Reason does not match the request type.' }]);
        }
        const remaining = line.qty - Math.max(line.returned_qty, line.requested);
        if (item.qty > remaining) {
          throw new AppError('CONFLICT', remaining > 0
            ? `Only ${remaining} of ${line.product_name} can still be returned.`
            : `${line.product_name} already has a request.`, [{ field: item.orderItemId, message: 'Quantity exceeds what is left.' }]);
        }
        if (input.type === 'exchange') {
          if (line.exchange_policy !== 'exchangeable') {
            throw new AppError('RULE_VIOLATION', line.exchange_policy === 'none'
              ? `${line.product_name} is final sale and cannot be exchanged.`
              : `${line.product_name} can only be replaced if it arrives defective.`);
          }
          if (!item.exchangeVariantId) throw new AppError('VALIDATION_FAILED', 'Choose the size or variant you want instead.', [{ field: item.orderItemId, message: 'Exchange variant required.' }]);
          const v = variantById.get(item.exchangeVariantId);
          if (!v) throw new AppError('VALIDATION_FAILED', 'That variant is no longer available.', [{ field: item.orderItemId, message: 'Unknown variant.' }]);
          if (v.product_id !== line.product_id) throw new AppError('RULE_VIOLATION', 'An exchange can only swap for another variant of the same product.');
          if (v.stock < item.qty) throw new AppError('STOCK_INSUFFICIENT', `Only ${v.stock} left in that variant.`, [{ field: item.orderItemId, message: 'Not enough stock.' }]);
          priceDifferencePaise += (paise(v.price) - paise(line.unit_price)) * item.qty;
        } else if (item.reasonCode === 'wrong_item' && !input.unboxingVideo) {
          throw new AppError('VALIDATION_FAILED', 'A wrong item needs the unboxing video — our print partner asks for it.', [{ field: 'unboxingVideo', message: 'Unboxing video required.' }]);
        }
        return {
          id: uuidv7(), orderItemId: line.id, qty: item.qty, reasonCode: item.reasonCode,
          conditionNote: item.conditionNote?.trim().slice(0, 500) ?? null,
          disposition: input.type === 'exchange' ? 'exchange' : 'replacement',
          exchangeVariantId: input.type === 'exchange' ? item.exchangeVariantId! : null,
        };
      });

      const id = uuidv7();
      const rmaNumber = await newRmaNumber(tx);
      await tx.execute(sql`INSERT INTO returns (id, rma_number, order_id, requested_by_profile_id, requested_by_user_id, type, status, resolution,
          price_difference, customer_note, evidence_media_ids, idempotency_key)
        VALUES (${id}, ${rmaNumber}, ${order.id}, ${profileId}, ${userId}, ${input.type}, 'requested', 'pending',
          ${input.type === 'exchange' ? toRupees(priceDifferencePaise) : null}, ${input.note?.trim().slice(0, 500) ?? null},
          ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(input.evidenceMediaIds)}::jsonb))::uuid[], ${input.requestKey})`);
      for (const row of rowsToWrite) {
        // Drizzle renders a bare JS null as '' in a raw template, which a uuid
        // column rejects — spell NULL out.
        const variant = row.exchangeVariantId ? sql`${row.exchangeVariantId}::uuid` : sql`NULL`;
        await tx.execute(sql`INSERT INTO return_items (id, return_id, order_item_id, request_type, qty, reason_code, condition_note, disposition, exchange_variant_id)
          VALUES (${row.id}, ${id}, ${row.orderItemId}, ${input.type}, ${row.qty}, ${row.reasonCode}, ${row.conditionNote}, ${row.disposition}, ${variant})`);
      }
      await tx.execute(sql`INSERT INTO return_status_history (id, return_id, from_status, to_status, note, actor)
        VALUES (${uuidv7()}, ${id}, NULL, 'requested', ${input.type === 'exchange' ? 'Exchange requested' : 'Replacement requested'}, ${userId})`);
      await recordAudit(tx, {
        actorId: userId, action: 'return.create', entity: 'returns', entityId: id,
        diff: { status: { from: null, to: 'requested' }, type: { from: null, to: input.type }, order: { from: null, to: order.order_number } },
      });
      await notifyStaff(tx, 'return.view', [{
        kind: 'order',
        title: input.type === 'exchange' ? 'New exchange request' : 'New replacement request',
        body: `${rmaNumber} — ${order.order_number}`,
        link: `/returns?open=${rmaNumber}`,
        dedupeKey: `return.requested:${rmaNumber}`,
      }]);
      return { id, rmaNumber, priceDifferencePaise, replayed: false, orderNumber: order.order_number };
    });
    if (!made.replayed) void emit('return.requested', { returnId: made.id, rmaNumber: made.rmaNumber, orderNumber: made.orderNumber });
    return { id: made.id, rmaNumber: made.rmaNumber, priceDifferencePaise: made.priceDifferencePaise, replayed: made.replayed };
  } catch (error) {
    if (isUnique(error, 'one_exchange_per_order_item')) throw new AppError('CONFLICT', 'This item has already been exchanged once. A defect can still be reported as a replacement.');
    if (isUnique(error, 'one_replacement_per_order_item')) throw new AppError('CONFLICT', 'This item already has a replacement request.');
    throw error;
  }
}

export interface ReturnSummary {
  id: string;
  rmaNumber: string;
  orderNumber: string;
  type: 'exchange' | 'replacement';
  status: string;
  resolution: string;
  priceDifferencePaise: number;
  createdAt: string;
  itemCount: number;
}

export interface ReturnLineView {
  id: string;
  orderItemId: string;
  productName: string;
  variantLabel: string;
  qty: number;
  reasonCode: string;
  conditionNote: string | null;
  disposition: string;
  exchangeVariantLabel: string | null;
  refundPaise: number | null;
}

export interface ReturnDetail extends ReturnSummary {
  customerNote: string | null;
  rejectionReason: string | null;
  evidence: number;
  carrier: string | null;
  trackingNumber: string | null;
  lines: ReturnLineView[];
  history: { status: string; note: string | null; at: string }[];
  /** The follow-up order an approval created, if any. */
  replacementOrderNumber: string | null;
  /** ₹ still to pay on an exchange before it is printed. */
  duePaise: number;
}

const SUMMARY_SELECT = sql`
  SELECT r.id, r.rma_number, o.order_number, r.type, r.status, r.resolution, r.price_difference, r.created_at,
         (SELECT count(*)::int FROM return_items ri WHERE ri.return_id = r.id) AS items,
         (SELECT od.order_number FROM orders od WHERE od.id = r.replacement_order_id) AS replacement_order,
         (SELECT od.grand_total FROM orders od WHERE od.id = r.replacement_order_id) AS replacement_total,
         (SELECT od.payment_status FROM orders od WHERE od.id = r.replacement_order_id) AS replacement_payment
  FROM returns r JOIN orders o ON o.id = r.order_id`;

async function hydrateSummary(rows: {
  id: string; rma_number: string; order_number: string; type: ReturnSummary['type']; status: string; resolution: string;
  price_difference: string | null; created_at: string; items: number; replacement_order: string | null;
  replacement_total: string | null; replacement_payment: string | null;
}[]): Promise<ReturnDetail[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const db = getDb();
  const [{ rows: lines }, { rows: history }] = await Promise.all([
    db.execute<{ return_id: string; id: string; order_item_id: string; product_name: string; options: Record<string, string> | null; qty: number; reason_code: string; condition_note: string | null; disposition: string; refund_amount: string | null; exchange_variant: string | null }>(sql`
      SELECT ri.return_id, ri.id, ri.order_item_id, oi.product_name, oi.options, ri.qty, ri.reason_code, ri.condition_note, ri.disposition, ri.refund_amount,
             (SELECT coalesce(json_object_agg(d.slug, av.value)::text, '{}') FROM product_variant_attribute_values pvav
                JOIN attribute_definitions d ON d.id = pvav.definition_id JOIN attribute_values av ON av.id = pvav.value_id
                WHERE pvav.variant_id = ri.exchange_variant_id) AS exchange_variant
      FROM return_items ri JOIN order_items oi ON oi.id = ri.order_item_id WHERE ri.return_id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`),
    db.execute<{ return_id: string; to_status: string; note: string | null; created_at: string }>(sql`
      SELECT return_id, to_status, note, created_at FROM return_status_history WHERE return_id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)}) ORDER BY created_at, id`),
  ]);
  const label = (options: Record<string, string> | null) => [options?.Color, options?.Size].filter(Boolean).join(' / ') || 'Standard';
  return rows.map((r) => ({
    id: r.id, rmaNumber: r.rma_number, orderNumber: r.order_number, type: r.type, status: r.status, resolution: r.resolution,
    priceDifferencePaise: paise(r.price_difference), createdAt: new Date(r.created_at).toISOString(), itemCount: r.items,
    customerNote: null, rejectionReason: null, evidence: 0, carrier: null, trackingNumber: null,
    replacementOrderNumber: r.replacement_order,
    duePaise: r.replacement_order && r.replacement_payment === 'pending' ? paise(r.replacement_total) : 0,
    lines: lines.filter((l) => l.return_id === r.id).map((l) => ({
      id: l.id, orderItemId: l.order_item_id, productName: l.product_name, variantLabel: label(l.options), qty: l.qty,
      reasonCode: l.reason_code, conditionNote: l.condition_note, disposition: l.disposition,
      exchangeVariantLabel: l.exchange_variant ? label(JSON.parse(l.exchange_variant)) : null,
      refundPaise: l.refund_amount === null ? null : paise(l.refund_amount),
    })),
    history: history.filter((h) => h.return_id === r.id).map((h) => ({ status: h.to_status, note: h.note, at: new Date(h.created_at).toISOString() })),
  }));
}

/** A customer's own requests, newest first. */
export async function listMyReturns(userId: string): Promise<ReturnDetail[]> {
  const { rows } = await getDb().execute<Parameters<typeof hydrateSummary>[0][number]>(sql`
    ${SUMMARY_SELECT} WHERE r.requested_by_user_id = ${userId} ORDER BY r.created_at DESC LIMIT 50`);
  return hydrateSummary(rows);
}

/** One request, for the account that asked (or whose household it was for). */
export async function getMyReturn(userId: string, returnId: string): Promise<ReturnDetail> {
  const { rows } = await getDb().execute<Parameters<typeof hydrateSummary>[0][number]>(sql`
    ${SUMMARY_SELECT} WHERE r.id = ${returnId} AND (r.requested_by_user_id = ${userId}
      OR o.for_household_id IN (SELECT hm.household_id FROM household_members hm WHERE hm.profile_id = r.requested_by_profile_id))`);
  const [detail] = await hydrateSummary(rows);
  if (!detail) throw new AppError('NOT_FOUND', 'We could not find that request.');
  const { rows: [extra] } = await getDb().execute<{ customer_note: string | null; rejection_reason: string | null; evidence: number; carrier: string | null; tracking_number: string | null }>(sql`
    SELECT customer_note, rejection_reason, cardinality(evidence_media_ids) AS evidence, carrier, tracking_number FROM returns WHERE id = ${returnId}`);
  return { ...detail, customerNote: extra?.customer_note ?? null, rejectionReason: extra?.rejection_reason ?? null, evidence: extra?.evidence ?? 0, carrier: extra?.carrier ?? null, trackingNumber: extra?.tracking_number ?? null };
}

/** The difference on an approved exchange: paid through the normal demo flow. */
export async function payExchangeDifference(userId: string, input: { returnId: string; method: 'card' | 'upi'; simulate?: 'decline' }): Promise<{ orderNumber: string; paidPaise: number }> {
  const gateway = await getPaymentGateway();
  const result = await withTransaction(async (tx) => {
    const { rows: [found] } = await tx.execute<{ order_id: string; replacement_order_id: string | null; grand_total: string; payment_status: string; order_number: string }>(sql`
      SELECT od.id AS order_id, r.replacement_order_id, od.grand_total, od.payment_status, od.order_number
      FROM returns r JOIN orders od ON od.id = r.replacement_order_id
      WHERE r.id = ${input.returnId} AND r.requested_by_user_id = ${userId}
      FOR NO KEY UPDATE OF od`);
    if (!found) throw new AppError('NOT_FOUND', 'There is nothing to pay for this request.');
    if (found.payment_status !== 'pending') throw new AppError('RULE_VIOLATION', 'This exchange is already paid.');
    const amountPaise = paise(found.grand_total);
    if (amountPaise <= 0) throw new AppError('RULE_VIOLATION', 'This exchange has no difference to pay.');
    const payment = await takePayment(tx, gateway, { orderId: found.order_id, method: input.method, amountPaise, reference: found.order_id, simulate: input.simulate });
    await tx.execute(sql`UPDATE orders SET payment_status = ${payment.captured ? 'paid' : 'pending'}, cancellable_until = now(), updated_at = now() WHERE id = ${found.order_id}`);
    await tx.execute(sql`INSERT INTO order_status_history (id, order_id, from_status, to_status, note, actor)
      VALUES (${uuidv7()}, ${found.order_id}, NULL, 'pending', ${payment.captured ? 'Exchange difference paid' : 'Exchange difference declined'}, ${userId})`);
    return { orderNumber: found.order_number, paidPaise: payment.captured ? amountPaise : 0 };
  });
  return result;
}
