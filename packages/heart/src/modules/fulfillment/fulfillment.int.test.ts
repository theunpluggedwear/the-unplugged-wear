// Break-it tests for fulfilment: submission idempotency, the auto-submit gate,
// cancel credits, COD remittances, claims and manual dispatch (DOC/backend/16).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';

process.env.AUTH_SECRET ||= 'test-secret-that-is-definitely-longer-than-32-chars';
// Tests must never touch the real provider: the env file may carry live keys.
delete process.env.QIKINK_CLIENT_ID;
delete process.env.QIKINK_CLIENT_SECRET;

const { createTestDatabase, hasTestDatabase } = await import('../../platform/test/index.ts');
const auth = await import('../auth/index.ts');
const c = await import('../catalog/index.ts');
const cart = await import('../cart/index.ts');
const orders = await import('../orders/index.ts');
const settings = await import('../settings/index.ts');
const f = await import('./index.ts');
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
const many = async <T extends Record<string, unknown>>(q: ReturnType<typeof sql>) => (await db().execute<T>(q)).rows;
const address = { fullName: 'Asha Rao', line1: '12 100 Feet Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'India' as const, phone: '9876543210' };
let seq = 0;
/** A print-to-order tee at a partner, with a mapped SKU and a known cost. */
async function tee(partner: 'Qikink Direct API' | 'Custom Atelier' = 'Qikink Direct API') {
  seq += 1;
  const product = await c.adminCreateProduct(S.productFields.parse({
    name: `Fulfil Tee ${seq}`, slug: `fulfil-tee-${seq}`, category: 'Tees', price: 1000, colors: ['Black'], sizes: ['M'],
    partner, publicationStatus: 'published', description: 'd', exchangePolicy: 'exchangeable',
    variants: [{ color: 'Black', size: 'M', price: 1000, stock: 20 }],
  }), staff);
  const variant = await one<{ id: string }>(sql`SELECT id FROM product_variants WHERE product_id = ${product.id}`);
  const providerId = await one<{ id: string }>(sql`SELECT id FROM integration_providers WHERE slug = ${partner === 'Qikink Direct API' ? 'qikink' : 'custom_atelier'}`);
  await db().execute(sql`INSERT INTO provider_product_mappings (id, provider_id, variant_id, provider_sku, unit_cost)
    VALUES (${uuidv7()}, ${providerId.id}, ${variant.id}, ${`QK-TUW-${seq}`}, 300.00)`);
  return product;
}

/** Buys one tee and closes the free-cancel window so the submit job may send it. */
async function buyReady(product: { id: string }, method: 'card' | 'cod' = 'card') {
  await cart.addLine({ userId: shopper }, { productRef: product.id, color: 'Black', size: 'M', qty: 1 });
  const placed = await orders.placeOrder({ userId: shopper, email: 'fulfil.shopper@example.com' },
    orders.orderSchemas.placeOrder.parse({ checkoutKey: uuidv7(), shippingAddress: address, method }));
  await db().execute(sql`UPDATE orders SET cancellable_until = now() - interval '1 minute' WHERE id = ${placed.orderId}`);
  return placed;
}

const fulfillmentFor = async (orderId: string) => many<{ id: string; status: string; provider_order_id: string | null; provider_cost: string | null }>(
  sql`SELECT id, status, provider_order_id, provider_cost FROM fulfillment_orders WHERE order_id = ${orderId} ORDER BY created_at`);
const orderStatus = async (orderId: string) => (await one<{ status: string }>(sql`SELECT status FROM orders WHERE id = ${orderId}`)).status;
const ledger = async () => many<{ kind: string; direction: string; amount: string }>(sql`SELECT kind, direction, amount FROM provider_wallet_ledger`);

before(async () => {
  if (skip) return;
  drop = (await createTestDatabase()).drop;
  staff = (await auth.bootstrapAdmin({ email: 'fulfil-admin@example.com', password: 'admin pass 12', firstName: 'Ad', lastName: 'Min' })).userId;
  await c.adminSaveCategory(S.categoryFields.parse({ name: 'Tees' }), staff);
  await auth.register({ email: 'fulfil.shopper@example.com', password: 'shopper pass 12', firstName: 'Asha', lastName: 'Rao' }, meta);
  shopper = (await one<{ id: string }>(sql`SELECT id FROM users WHERE email = 'fulfil.shopper@example.com'`)).id;
}, { timeout: 180_000 });
after(async () => { await drop?.(); });

test('an unpaid paid-window order is skipped, a paid one is sent exactly once', { skip }, async () => {
  const product = await tee();
  await cart.addLine({ userId: shopper }, { productRef: product.id, color: 'Black', size: 'M', qty: 1 });
  const unpaid = await orders.placeOrder({ userId: shopper, email: 'fulfil.shopper@example.com' },
    orders.orderSchemas.placeOrder.parse({ checkoutKey: uuidv7(), shippingAddress: address, method: 'card' }));
  // Pretend the payment never captured: the job must not print it.
  await db().execute(sql`UPDATE orders SET payment_status = 'pending', cancellable_until = now() - interval '1 minute' WHERE id = ${unpaid.orderId}`);
  await f.submitDueOrders(10);
  assert.deepEqual(await fulfillmentFor(unpaid.orderId), []);

  await db().execute(sql`UPDATE orders SET payment_status = 'paid' WHERE id = ${unpaid.orderId}`);
  const first = await f.submitDueOrders(10);
  assert.ok(first.processed >= 1);
  const rows = await fulfillmentFor(unpaid.orderId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.status, 'submitted');
  assert.match(rows[0]!.provider_order_id ?? '', /^sim_qk_/);
  assert.equal(rows[0]!.provider_cost, '300.00');
  assert.equal(await orderStatus(unpaid.orderId), 'confirmed');

  // A second run must not create a second provider order or a second debit.
  await f.submitDueOrders(10);
  assert.equal((await fulfillmentFor(unpaid.orderId)).length, 1);
  const debits = (await ledger()).filter((l) => l.kind === 'order_debit');
  assert.equal(debits.length, 1);
  assert.equal(debits[0]!.direction, 'debit');

  // A simulator order never reached Qikink, so cancelling it is refused with a
  // note that names the real remedy instead of silently doing nothing.
  assert.equal(await code(f.adminCancelFulfillment({ fulfillmentId: rows[0]!.id }, staff)), 'RULE_VIOLATION');
});

test('the auto-submit gate holds orders until staff send them', { skip }, async () => {
  await settings.updateSettings('fulfillment', { 'fulfillment.auto_submit': false }, staff);
  try {
    const product = await tee();
    const placed = await buyReady(product);
    const run = await f.submitDueOrders(10);
    assert.equal(run.processed, 0);
    assert.match(run.note ?? '', /switched off/);
    assert.deepEqual(await fulfillmentFor(placed.orderId), []);

    // A manual send from the board still works while the gate is closed.
    const sent = await f.adminSubmitFulfillment({ orderNumber: placed.orderNumber });
    assert.equal(sent.sent, 1);
    assert.equal((await fulfillmentFor(placed.orderId))[0]!.status, 'submitted');
  } finally {
    await settings.updateSettings('fulfillment', { 'fulfillment.auto_submit': true }, staff);
  }
});

test('cancelling with the partner credits what we paid and closes the order', { skip }, async () => {
  const product = await tee('Custom Atelier');
  const placed = await buyReady(product);
  await f.submitDueOrders(10);
  const row = (await fulfillmentFor(placed.orderId))[0]!;
  assert.equal(row.provider_cost, '300.00');

  const result = await f.adminCancelFulfillment({ fulfillmentId: row.id, note: 'Customer asked' }, staff);
  assert.equal(result.providerStatus, 'cancelled');
  assert.equal(result.refundedPaise, 30000);
  const after = await fulfillmentFor(placed.orderId);
  assert.equal(after[0]!.status, 'cancelled');
  assert.equal(await orderStatus(placed.orderId), 'cancelled');
  const credit = (await ledger()).find((l) => l.kind === 'cancel_credit');
  assert.ok(credit);
  assert.equal(credit!.direction, 'credit');
});

test('manual dispatch writes a parcel + scan, and the order timeline sees it', { skip }, async () => {
  const product = await tee('Custom Atelier');
  const placed = await buyReady(product);
  await f.submitDueOrders(10);
  const row = (await fulfillmentFor(placed.orderId))[0]!;
  assert.equal(row.status, 'submitted');

  const added = await f.adminAddTracking({ orderNumber: placed.orderNumber, carrier: 'Delhivery', trackingNumber: 'AWB123456' });
  assert.equal(await orderStatus(placed.orderId), 'shipped');
  const view = await orders.getOrderForViewer(placed.orderNumber, { userId: shopper });
  assert.equal(view.shipments.length, 1);
  assert.equal(view.shipments[0]!.carrier, 'Delhivery');
  assert.equal(view.shipments[0]!.status, 'shipped');
  assert.ok(view.shipments[0]!.events.length >= 1);

  // The same move twice does not duplicate the scan.
  await f.adminSetShipmentStatus({ shipmentId: added.shipmentId, status: 'in_transit', location: 'Bengaluru hub' });
  await f.adminSetShipmentStatus({ shipmentId: added.shipmentId, status: 'delivered' });
  assert.equal(await orderStatus(placed.orderId), 'delivered');
  const detail = await f.adminGetShipment(added.shipmentId);
  assert.equal(detail.row.status, 'delivered');
  assert.equal(new Set(detail.events.map((e) => e.status)).size, detail.events.length);
});

test('claims need evidence and the unboxing video, then resolve with a wallet credit', { skip }, async () => {
  const product = await tee('Custom Atelier');
  const placed = await buyReady(product);
  await f.submitDueOrders(10);
  const row = (await fulfillmentFor(placed.orderId))[0]!;
  await f.adminSetFulfillmentState({ fulfillmentId: row.id, status: 'delivered' });

  const wrongItem = await code(f.createClaim({ fulfillmentId: row.id, type: 'wrong_item', evidenceMediaIds: [uuidv7()], hasUnboxingVideo: false }, staff));
  assert.equal(wrongItem, 'RULE_VIOLATION');

  const claim = await f.createClaim({ fulfillmentId: row.id, type: 'damaged', evidenceMediaIds: [uuidv7()], hasUnboxingVideo: false }, staff);
  assert.equal(claim.status, 'draft');
  // While one claim of a type is open, a second one is refused.
  assert.equal(await code(f.createClaim({ fulfillmentId: row.id, type: 'damaged', evidenceMediaIds: [uuidv7()], hasUnboxingVideo: false }, staff)), 'CONFLICT');
  await f.updateClaim({ claimId: claim.id, status: 'submitted' }, staff);
  await f.updateClaim({ claimId: claim.id, status: 'approved', resolution: 'wallet_credit' }, staff);
  const missingAmount = await code(f.updateClaim({ claimId: claim.id, status: 'resolved', resolution: 'wallet_credit' }, staff));
  assert.equal(missingAmount, 'VALIDATION_FAILED');
  const resolved = await f.updateClaim({ claimId: claim.id, status: 'resolved', resolution: 'wallet_credit', amountPaise: 30000 }, staff);
  assert.equal(resolved.status, 'resolved');
  const credit = (await ledger()).find((l) => l.kind === 'claim_credit');
  assert.ok(credit);
  assert.equal(credit!.amount, '300.00');
});

test('a COD transfer settles delivered parcels and can credit the wallet', { skip }, async () => {
  const product = await tee();
  const placed = await buyReady(product, 'cod');
  await f.submitDueOrders(10);
  const row = (await fulfillmentFor(placed.orderId))[0]!;
  await db().execute(sql`UPDATE fulfillment_orders SET status = 'delivered', delivered_at = now() WHERE id = ${row.id}`);

  const pending = await f.pendingCodParcels(50);
  assert.ok(pending.some((p) => p.id === row.id));

  const remittance = await f.recordCodRemittance({
    transferRef: `TR-${seq}-${Date.now()}`, amountPaise: 100000, feesPaise: 500, remittedTo: 'wallet',
    remittedAt: new Date().toISOString(), fulfillmentIds: [row.id],
  }, staff);
  assert.equal(remittance.parcels, 1);
  const settled = await one<{ cod_remittance_id: string | null }>(sql`SELECT cod_remittance_id FROM fulfillment_orders WHERE id = ${row.id}`);
  assert.equal(settled.cod_remittance_id, remittance.id);
  assert.equal((await f.pendingCodParcels(50)).some((p) => p.id === row.id), false);
  const credit = (await ledger()).find((l) => l.kind === 'cod_remittance');
  assert.ok(credit);
  assert.equal(credit!.amount, '995.00');

  // The same transfer id cannot be recorded twice.
  const duplicate = await code(f.recordCodRemittance({
    transferRef: remittance.transferRef, amountPaise: 100000, feesPaise: 0, remittedTo: 'bank',
    remittedAt: new Date().toISOString(), fulfillmentIds: [],
  }, staff));
  assert.equal(duplicate, 'CONFLICT');
});

test('the board reads waiting orders, shipped parcels and wallet totals', { skip }, async () => {
  const product = await tee();
  const placed = await buyReady(product);
  const waiting = await f.adminListFulfillment({ tab: 'waiting', q: placed.orderNumber, perPage: 10 });
  assert.equal(waiting.rows.length, 1);
  assert.equal(waiting.rows[0]!.status, 'waiting');
  assert.equal(waiting.rows[0]!.fulfillmentId, null);

  await f.submitDueOrders(10);
  const queue = await f.adminListFulfillment({ tab: 'queue', q: placed.orderNumber, perPage: 10 });
  assert.equal(queue.rows.length, 1);
  assert.ok(queue.stats.queue >= 1);

  const shipmentList = await f.adminListShipments({ status: 'all' });
  assert.ok(shipmentList.total >= 1);
  const wallet = await f.walletSummaries();
  assert.ok(wallet.some((w) => w.providerSlug === 'qikink'));
});
