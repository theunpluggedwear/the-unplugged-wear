import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { profileIdForUser } from '../customers/index.ts';
import { getSetting } from '../settings/index.ts';

// What a shopper may ask for on one delivered order (DOC/backend/06):
// only after delivery, only inside the exchange window, exchanges only for
// another variant of the same product and only on lines the catalogue marked
// 'exchangeable'. Every line can still ask for a defect replacement.

export interface ExchangeVariant {
  id: string;
  label: string;
  sku: string;
  pricePaise: number;
  stock: number;
}

export interface ReturnableLine {
  orderItemId: string;
  productName: string;
  variantLabel: string;
  qty: number;
  returnedQty: number;
  unitPaise: number;
  exchangePolicy: 'defects_only' | 'exchangeable' | 'none';
  canExchange: boolean;
  canReplace: boolean;
  /** Why an exchange is not offered, in the customer's words. */
  exchangeReason: string | null;
  exchangeVariants: ExchangeVariant[];
}

export interface ExistingReturn {
  id: string;
  rmaNumber: string;
  type: 'exchange' | 'replacement';
  status: string;
  createdAt: string;
}

export interface ReturnEligibility {
  orderNumber: string;
  orderStatus: string;
  deliveredAt: string | null;
  windowDays: number;
  /** Last moment a request is accepted; null until the parcel is delivered. */
  deadline: string | null;
  canRequest: boolean;
  /** Why nothing can be requested right now, in the customer's words. */
  blockedReason: string | null;
  lines: ReturnableLine[];
  existing: ExistingReturn[];
}

const paise = (v: string | number | null) => (v === null ? 0 : Math.round(Number(v) * 100));
const ADD_DAYS = 86_400_000;

type OptionValues = Map<string, Map<string, string>>;

/** "Black / Oversized Fit / M": colour first, then the remaining option axes. */
function variantLabel(values: Map<string, string> | undefined, fallback: string): string {
  if (!values || values.size === 0) return fallback || 'Standard';
  const color = values.get('color');
  const rest = [...values.entries()].filter(([k]) => k !== 'color').map(([, v]) => v);
  return [color, ...rest].filter(Boolean).join(' / ') || fallback;
}

async function exchangeVariants(productIds: string[]): Promise<{ variants: Map<string, ExchangeVariant[]>; values: OptionValues }> {
  const db = getDb();
  if (!productIds.length) return { variants: new Map(), values: new Map() };
  const ids = sql.join(productIds.map((id) => sql`${id}::uuid`), sql`, `);
  const [{ rows: variants }, { rows: values }] = await Promise.all([
    db.execute<{ id: string; product_id: string; sku: string; price: string; stock: number; variant_key: string | null }>(sql`
      SELECT id, product_id, sku, price, stock, variant_key FROM product_variants
      WHERE product_id IN (${ids}) AND is_active ORDER BY price, sku`),
    db.execute<{ variant_id: string; slug: string; value: string }>(sql`
      SELECT pvav.variant_id, d.slug, av.value FROM product_variant_attribute_values pvav
      JOIN attribute_definitions d ON d.id = pvav.definition_id
      JOIN attribute_values av ON av.id = pvav.value_id
      WHERE pvav.product_id IN (${ids})`),
  ]);
  const valuesOf: OptionValues = new Map();
  for (const v of values) {
    const set = valuesOf.get(v.variant_id) ?? new Map<string, string>();
    set.set(v.slug, v.value);
    valuesOf.set(v.variant_id, set);
  }
  const byProduct = new Map<string, ExchangeVariant[]>();
  for (const v of variants) {
    const list = byProduct.get(v.product_id) ?? [];
    list.push({ id: v.id, label: variantLabel(valuesOf.get(v.id), v.variant_key ?? ''), sku: v.sku, pricePaise: paise(v.price), stock: v.stock });
    byProduct.set(v.product_id, list);
  }
  return { variants: byProduct, values: valuesOf };
}

/** The order, if this account may see it (placed by them, or for their household). */
async function loadOrder(userId: string, orderNumber: string) {
  const profileId = await profileIdForUser(userId);
  const { rows: [order] } = await getDb().execute<{
    id: string; order_number: string; status: string; order_type: string; placed_by_user_id: string | null;
    for_profile_id: string | null; for_household_id: string | null; shipping_address: unknown; delivered_at: string | null;
  }>(sql`
    SELECT o.id, o.order_number, o.status, o.order_type, o.placed_by_user_id, o.for_profile_id, o.for_household_id,
           o.shipping_address,
           (SELECT max(s.delivered_at) FROM shipments s WHERE s.order_id = o.id) AS delivered_at
    FROM orders o
    WHERE o.order_number = ${orderNumber}
      AND (o.placed_by_user_id = ${userId}
        OR o.for_household_id IN (SELECT hm.household_id FROM household_members hm WHERE hm.profile_id = ${profileId}))`);
  if (!order) throw new AppError('NOT_FOUND', 'We could not find that order.');
  return order;
}

export async function returnEligibility(userId: string, orderNumber: string): Promise<ReturnEligibility> {
  const order = await loadOrder(userId, orderNumber);
  const windowDays = await getSetting('exchange.window_days');
  const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : null;
  const deadline = deliveredAt ? new Date(deliveredAt.getTime() + windowDays * ADD_DAYS) : null;
  const db = getDb();
  const [{ rows: lines }, { rows: existing }] = await Promise.all([
    db.execute<{ id: string; product_id: string; product_name: string; options: Record<string, string> | null; unit_price: string; qty: number; returned_qty: number; exchange_policy: ReturnableLine['exchangePolicy']; requested: number }>(sql`
      SELECT oi.id, oi.product_id, oi.product_name, oi.options, oi.unit_price, oi.qty, oi.returned_qty, oi.exchange_policy,
             (SELECT coalesce(sum(ri.qty), 0)::int FROM return_items ri
               JOIN returns r ON r.id = ri.return_id
               WHERE ri.order_item_id = oi.id AND r.status NOT IN ('rejected', 'cancelled')) AS requested
      FROM order_items oi WHERE oi.order_id = ${order.id} ORDER BY oi.created_at, oi.id`),
    db.execute<{ id: string; rma_number: string; type: ExistingReturn['type']; status: string; created_at: string }>(sql`
      SELECT id, rma_number, type, status, created_at FROM returns WHERE order_id = ${order.id} ORDER BY created_at DESC`),
  ]);
  const { variants } = await exchangeVariants([...new Set(lines.map((l) => l.product_id))]);
  const open = order.status === 'delivered' && (!deliveredAt || deadline === null || Date.now() <= deadline.getTime());
  const blockedReason = order.status !== 'delivered'
    ? 'Exchanges and replacements open once the parcel is delivered.'
    : deadline && Date.now() > deadline.getTime()
      ? `The ${windowDays}-day window for this order has closed.`
      : null;
  return {
    orderNumber: order.order_number,
    orderStatus: order.status,
    deliveredAt: deliveredAt ? deliveredAt.toISOString() : null,
    windowDays,
    deadline: deadline ? deadline.toISOString() : null,
    canRequest: open,
    blockedReason,
    existing: existing.map((r) => ({ id: r.id, rmaNumber: r.rma_number, type: r.type, status: r.status, createdAt: new Date(r.created_at).toISOString() })),
    lines: lines.map((l) => {
      const remaining = Math.max(0, l.qty - Math.max(l.returned_qty, l.requested));
      const exchangeReason = l.exchange_policy !== 'exchangeable'
        ? l.exchange_policy === 'none' ? 'This item is final sale.' : 'This item can only be replaced if it arrives defective.'
        : remaining === 0 ? 'This item has already been returned or exchanged.' : null;
      return {
        orderItemId: l.id,
        productName: l.product_name,
        variantLabel: [l.options?.Color, l.options?.Size].filter(Boolean).join(' / ') || 'Standard',
        qty: l.qty,
        returnedQty: l.returned_qty,
        unitPaise: paise(l.unit_price),
        exchangePolicy: l.exchange_policy,
        canExchange: open && !exchangeReason && remaining > 0,
        canReplace: open && remaining > 0,
        exchangeReason,
        exchangeVariants: (variants.get(l.product_id) ?? []).filter((v) => v.stock > 0),
      };
    }),
  };
}

/** Every delivered order of this account that still has something to ask for. */
export async function returnableOrders(userId: string): Promise<{ orderNumber: string; deliveredAt: string; deadline: string | null; itemCount: number }[]> {
  const { rows } = await getDb().execute<{ order_number: string; delivered_at: string; deadline: string | null; items: number }>(sql`
    SELECT o.order_number, max(s.delivered_at) AS delivered_at,
           max(s.delivered_at) + (${await getSetting('exchange.window_days')} || ' days')::interval AS deadline,
           (SELECT count(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS items
    FROM orders o JOIN shipments s ON s.order_id = o.id
    WHERE o.placed_by_user_id = ${userId} AND o.status = 'delivered'
    GROUP BY o.id, o.order_number ORDER BY max(s.delivered_at) DESC LIMIT 50`);
  return rows.map((r) => ({ orderNumber: r.order_number, deliveredAt: new Date(r.delivered_at).toISOString(), deadline: r.deadline ? new Date(r.deadline).toISOString() : null, itemCount: r.items }));
}
