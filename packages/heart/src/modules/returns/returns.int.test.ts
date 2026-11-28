// Break-it tests: exchange/replacement rules, the window, abuse limits, approval, restock, refunds.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';

process.env.AUTH_SECRET ||= 'test-secret-that-is-definitely-longer-than-32-chars';

const { createTestDatabase, hasTestDatabase } = await import('../../platform/test/index.ts');
const auth = await import('../auth/index.ts');
const c = await import('../catalog/index.ts');
const cart = await import('../cart/index.ts');
const orders = await import('../orders/index.ts');
const returns = await import('./index.ts');
const { getDb } = await import('../../platform/db/index.ts');
const { uuidv7 } = await import('../../platform/ids/index.ts');

const skip = !hasTestDatabase() && 'no DATABASE_URL_UNPOOLED';
let drop: (() => Promise<void>) | undefined;
let staff = '';
let shopper = '';
const S = c.catalogSchemas;
const db = () => getDb();
const meta = { origin: 'https://shop.example.com' };
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return (e as { code?: string }).code ?? String(e); } };
const one = async <T extends Record<string, unknown>>(q: ReturnType<typeof sql>) => (await db().execute<T>(q)).rows[0]!;
const count = async (q: ReturnType<typeof sql>) => (await one<{ n: number }>(q)).n;
const address = { fullName: 'Asha Rao', line1: '12 100 Feet Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'India' as const, phone: '9876543210' };

let seq = 0;
/** A print-to-order tee with an M and an L. */
async function tee(over: Record<string, unknown> = {}) {
  seq += 1;
  return c.adminCreateProduct(S.productFields.parse({
    name: `Return Tee ${seq}`, slug: `return-tee-${seq}`, category: 'Tees', price: 1000, colors: ['Black'], sizes: ['M', 'L'],
    partner: 'Custom Atelier', publicationStatus: 'published', description: 'd', exchangePolicy: 'exchangeable',
    variants: [{ color: 'Black', size: 'M', price: 1000, stock: 20 }, { color: 'Black', size: 'L', price: 1200, stock: 20 }], ...over,
  }), staff);
}

async function variantId(productId: string, size: string) {
  return (await one<{ id: string }>(sql`SELECT id FROM product_variants WHERE product_id = ${productId} AND variant_key = ${`color=black|opt=${size.toLowerCase()}`}`)).id;
}

/** Buys a size for the shopper and marks the parcel delivered. */
async function buyAndDeliver(product: { id: string }, size: 'M' | 'L' = 'M', qty = 1) {
  await cart.addLine({ userId: shopper }, { productRef: product.id, color: 'Black', size, qty });
  const placed = await orders.placeOrder({ userId: shopper, email: 'returns.shopper@example.com' },
    orders.orderSchemas.placeOrder.parse({ checkoutKey: uuidv7(), shippingAddress: address, method: 'card' }));
  for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) {
    await db().execute(sql`UPDATE orders SET status = ${status} WHERE id = ${placed.orderId}`);
  }
  await db().execute(sql`INSERT INTO shipments (id, order_id, status, delivered_at) VALUES (${uuidv7()}, ${placed.orderId}, 'delivered', now())`);
  const line = await one<{ id: string }>(sql`SELECT id FROM order_items WHERE order_id = ${placed.orderId}`);
  return { ...placed, lineId: line.id };
}

const request = (orderNumber: string, o: { lineId: string; exchangeVariantId?: string; qty?: number }) => returns.returnSchemas.create.parse({
  orderNumber, type: 'exchange', requestKey: uuidv7(), evidenceMediaIds: [uuidv7()],
  items: [{ orderItemId: o.lineId, qty: o.qty ?? 1, reasonCode: 'size_fit', exchangeVariantId: o.exchangeVariantId }],
});

before(async () => {
  if (skip) return;
  drop = (await createTestDatabase()).drop;
  staff = (await auth.bootstrapAdmin({ email: 'returns-admin@example.com', password: 'admin pass 12', firstName: 'Ad', lastName: 'Min' })).userId;
  await c.adminSaveCategory(S.categoryFields.parse({ name: 'Tees' }), staff);
  await auth.register({ email: 'returns.shopper@example.com', password: 'shopper pass 12', firstName: 'Asha', lastName: 'Rao' }, meta);
  shopper = (await one<{ id: string }>(sql`SELECT id FROM users WHERE email = 'returns.shopper@example.com'`)).id;
}, { timeout: 180_000 });
after(async () => { await drop?.(); });

test('an exchange waits for delivery and only swaps within the same product', { skip }, async () => {
  const p = await tee();
  // A guest order is not the shopper's to return.
  const guest = { sessionId: uuidv7().replace(/-/g, '') };
  await cart.addLine(guest, { productRef: p.id, color: 'Black', size: 'M', qty: 1 });
  const guestOrder = await orders.placeOrder(guest, orders.orderSchemas.placeOrder.parse({ checkoutKey: uuidv7(), email: 'guest@example.com', shippingAddress: address, method: 'card' }));
  const guestLine = await one<{ id: string }>(sql`SELECT id FROM order_items WHERE order_id = ${guestOrder.orderId}`);
  assert.equal(await code(returns.createReturn(shopper, request(guestOrder.orderNumber, { lineId: guestLine.id }))), 'NOT_FOUND');

  const order = await buyAndDeliver(p);
  const other = await tee();
  assert.equal(await code(returns.createReturn(shopper, request(order.orderNumber, { lineId: order.lineId, exchangeVariantId: await variantId(other.id, 'L') }))), 'RULE_VIOLATION', 'another product is not an exchange');
  assert.equal(await code(returns.createReturn(shopper, request(order.orderNumber, { lineId: order.lineId, qty: 2, exchangeVariantId: await variantId(p.id, 'L') }))), 'CONFLICT', 'more than bought');
  assert.equal(await code(returns.createReturn(shopper, request(order.orderNumber, { lineId: order.lineId }))), 'VALIDATION_FAILED', 'an exchange line needs a variant');

  const made = await returns.createReturn(shopper, request(order.orderNumber, { lineId: order.lineId, exchangeVariantId: await variantId(p.id, 'L') }));
  assert.equal(made.priceDifferencePaise, 20_000, '₹1,200 − ₹1,000');
  assert.equal(made.rmaNumber.startsWith('RMA-'), true);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM return_status_history WHERE return_id = ${made.id}`), 1);
});

test('one exchange per line, and the 7-day window closes', { skip }, async () => {
  const p = await tee();
  const order = await buyAndDeliver(p);
  await returns.createReturn(shopper, request(order.orderNumber, { lineId: order.lineId, exchangeVariantId: await variantId(p.id, 'L') }));
  assert.equal(await code(returns.createReturn(shopper, request(order.orderNumber, { lineId: order.lineId, exchangeVariantId: await variantId(p.id, 'L') }))), 'CONFLICT');

  const late = await buyAndDeliver(p);
  await db().execute(sql`UPDATE shipments SET delivered_at = now() - interval '8 days' WHERE order_id = ${late.orderId}`);
  assert.equal(await code(returns.createReturn(shopper, request(late.orderNumber, { lineId: late.lineId, exchangeVariantId: await variantId(p.id, 'L') }))), 'RULE_VIOLATION');
  assert.equal(returns.returnSchemas.create.safeParse({ ...request(late.orderNumber, { lineId: late.lineId }), evidenceMediaIds: [] }).success, false, 'evidence is required');
});

test('a defect replacement needs evidence and the unboxing video for a wrong item', { skip }, async () => {
  const p = await tee({ exchangePolicy: 'defects_only' });
  const order = await buyAndDeliver(p);
  const replacement = (reasonCode: string, over: Record<string, unknown> = {}) => returns.returnSchemas.create.parse({
    orderNumber: order.orderNumber, type: 'replacement', requestKey: uuidv7(), evidenceMediaIds: [uuidv7()],
    items: [{ orderItemId: order.lineId, qty: 1, reasonCode }], ...over,
  });
  assert.equal(await code(returns.createReturn(shopper, replacement('wrong_item'))), 'VALIDATION_FAILED');
  assert.equal(await code(returns.createReturn(shopper, replacement('size_fit'))), 'VALIDATION_FAILED', 'an exchange reason is not a defect');
  const made = await returns.createReturn(shopper, replacement('wrong_item', { unboxingVideo: true }));
  assert.equal((await returns.getMyReturn(shopper, made.id)).type, 'replacement');
});

test('approval creates the follow-up order and the customer pays the difference', { skip }, async () => {
  const p = await tee();
  const order = await buyAndDeliver(p);
  const made = await returns.createReturn(shopper, request(order.orderNumber, { lineId: order.lineId, exchangeVariantId: await variantId(p.id, 'L') }));
  const result = await returns.adminSetReturnStatus({ returnId: made.id, to: 'approved' }, staff);
  assert.ok(result.replacementOrderNumber, 'a follow-up order is created');

  const followUp = await one<{ order_type: string; grand_total: string; payment_status: string; status: string }>(sql`
    SELECT order_type, grand_total, payment_status, status FROM orders WHERE id = (SELECT replacement_order_id FROM returns WHERE id = ${made.id})`);
  assert.deepEqual({ ...followUp, grand_total: Number(followUp.grand_total) }, { order_type: 'exchange', grand_total: 200, payment_status: 'pending', status: 'pending' });
  assert.equal((await one<{ returned_qty: number }>(sql`SELECT returned_qty FROM order_items WHERE id = ${order.lineId}`)).returned_qty, 1);
  assert.equal((await returns.returnEligibility(shopper, order.orderNumber)).lines[0]!.canExchange, false, 'the line is used up');

  const paid = await returns.payExchangeDifference(shopper, { returnId: made.id, method: 'upi' });
  assert.equal(paid.paidPaise, 20_000);
  assert.equal((await returns.getMyReturn(shopper, made.id)).duePaise, 0);
});

test('a negative difference is refunded and a restock returns stock exactly once', { skip }, async () => {
  const p = await tee();
  const order = await buyAndDeliver(p, 'L');
  const m = await variantId(p.id, 'M');
  const made = await returns.createReturn(shopper, request(order.orderNumber, { lineId: order.lineId, exchangeVariantId: m }));
  assert.equal(made.priceDifferencePaise, -20_000);
  await returns.adminSetReturnStatus({ returnId: made.id, to: 'approved' }, staff);
  assert.equal((await one<{ status: string }>(sql`SELECT status FROM refunds WHERE id = (SELECT refund_id FROM returns WHERE id = ${made.id})`)).status, 'completed');

  // The L the customer sends back is what goes into stock, not the M they get.
  const back = await one<{ variant_id: string }>(sql`SELECT variant_id FROM order_items WHERE id = ${order.lineId}`);
  const before = (await one<{ stock: number }>(sql`SELECT stock FROM product_variants WHERE id = ${back.variant_id}`)).stock;
  const item = await one<{ id: string }>(sql`SELECT id FROM return_items WHERE return_id = ${made.id}`);
  await returns.adminSetReturnItem({ returnId: made.id, itemId: item.id, disposition: 'restock' }, staff);
  assert.equal((await one<{ stock: number }>(sql`SELECT stock FROM product_variants WHERE id = ${back.variant_id}`)).stock, before + 1);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM stock_movements WHERE reason = 'return'`), 1);
  assert.equal(await code(returns.adminSetReturnItem({ returnId: made.id, itemId: item.id, disposition: 'restock' }, staff)), 'RULE_VIOLATION', 'no double restock');
});

test('a replacement is free, and its order line cannot be exchanged again', { skip }, async () => {
  const p = await tee();
  const order = await buyAndDeliver(p);
  const finalSale = () => count(sql`SELECT count(*)::int AS n FROM order_items WHERE exchange_policy = 'none'`);
  const finalSaleBefore = await finalSale();
  const made = await returns.createReturn(shopper, returns.returnSchemas.create.parse({
    orderNumber: order.orderNumber, type: 'replacement', requestKey: uuidv7(), evidenceMediaIds: [uuidv7()], unboxingVideo: true,
    items: [{ orderItemId: order.lineId, qty: 1, reasonCode: 'damaged' }],
  }));
  await returns.adminSetReturnStatus({ returnId: made.id, to: 'approved' }, staff);
  const followUp = await one<{ order_type: string; grand_total: string; payment_status: string }>(sql`
    SELECT order_type, grand_total, payment_status FROM orders WHERE id = (SELECT replacement_order_id FROM returns WHERE id = ${made.id})`);
  assert.deepEqual({ ...followUp, grand_total: Number(followUp.grand_total) }, { order_type: 'replacement', grand_total: 0, payment_status: 'paid' });
  assert.equal(await finalSale(), finalSaleBefore + 1, 'the reprint line is final sale');

  const admin = await returns.adminListReturns({});
  assert.equal(admin.stats.total >= 5, true);
  assert.equal(admin.rows[0]!.rmaNumber.startsWith('RMA-'), true);
});
