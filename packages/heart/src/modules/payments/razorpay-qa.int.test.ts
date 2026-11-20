// Rigorous QA for the Razorpay checkout path: provider API failures, webhook
// failures/replays, reconciliation, compensation and DB invariants. Throwaway
// schema, mock/test keys only. Never talks to a live provider.
import { test, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';

process.env.AUTH_SECRET ||= 'test-secret-that-is-definitely-longer-than-32-chars';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.RAZORPAY_KEY_ID ||= 'rzp_test_qa_key';
process.env.RAZORPAY_KEY_SECRET ||= 'qa-key-secret';
process.env.RAZORPAY_WEBHOOK_SECRET ||= 'qa-webhook-secret';
delete process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS;

const { createTestDatabase, hasTestDatabase } = await import('../../platform/test/index.ts');
const auth = await import('../auth/index.ts');
const c = await import('../catalog/index.ts');
const cart = await import('../cart/index.ts');
const orders = await import('../orders/index.ts');
const fulfillment = await import('../fulfillment/index.ts');
const payments = await import('./index.ts');
const razorpay = await import('../../integrations/payments/razorpay.ts');
const adapters = await import('../../integrations/payments/adapters.ts');
const { getDb } = await import('../../platform/db/index.ts');
const { uuidv7 } = await import('../../platform/ids/index.ts');
const { toRupees } = await import('../../platform/money/index.ts');

const skip = !hasTestDatabase() && 'no DATABASE_URL_UNPOOLED';
let drop: (() => Promise<void>) | undefined;
let actor = '';
let seq = 0;
const S = c.catalogSchemas;
const db = () => getDb();
const address = { fullName: 'QA Buyer', line1: '12 QA Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'India' as const, phone: '9876543210' };
const guest = () => ({ sessionId: uuidv7().replace(/-/g, '') });
const form = (checkoutKey = uuidv7(), over: Record<string, unknown> = {}) =>
  orders.orderSchemas.placeOrder.parse({ checkoutKey, email: 'qa.buyer@example.com', shippingAddress: address, method: 'card', speed: 'standard', ...over });

const one = async <T extends Record<string, unknown>>(q: ReturnType<typeof sql>) => (await db().execute<T>(q)).rows[0]!;
const count = async (q: ReturnType<typeof sql>) => Number((await one<{ n: number }>(q)).n);
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return (e as { code?: string }).code ?? String(e); } };

async function product(stock = 10, price = 500, over: Record<string, unknown> = {}) {
  seq += 1;
  return c.adminCreateProduct(S.productFields.parse({
    name: `QA Product ${seq}`, slug: `qa-product-${seq}`, category: 'Tees', price,
    colors: ['Black'], sizes: ['M'], partner: 'Custom Atelier', publicationStatus: 'published',
    description: 'QA fixture', variants: [{ color: 'Black', size: 'M', price, stock }], ...over,
  }), actor);
}
const add = (owner: Parameters<typeof cart.addLine>[0], p: { id: string }, qty = 1) =>
  cart.addLine(owner, { productRef: p.id, color: 'Black', size: 'M', qty });
const stockOf = async (productId: string) => (await one<{ stock: number }>(sql`SELECT stock FROM product_variants WHERE product_id = ${productId}`)).stock;

async function discount(max: number | null = 10) {
  seq += 1;
  const id = uuidv7();
  const codeName = `QA${seq}`;
  await db().execute(sql`INSERT INTO discount_codes (id, code, discount_type, value, max_uses)
    VALUES (${id}, ${codeName}, 'fixed', 50, ${max})`);
  return { id, code: codeName };
}

async function pending(over: Record<string, unknown> = {}, attach = true) {
  const p = await product(10, 500);
  const g = guest();
  await add(g, p, 1);
  const f = form(uuidv7(), over);
  const created = await orders.createPendingOrder(g, f);
  const providerOrderId = `mock_order_${f.checkoutKey}`;
  if (attach) await payments.attachProviderOrder({ intentId: created.intentId, provider: 'mock', providerOrderId });
  return { p, g, f, created, providerOrderId };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

async function withFetch(handler: (...args: any[]) => Response | Promise<Response>, fn: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as any;
  try { await fn(); } finally { globalThis.fetch = original; }
}

function eventBody(input: { event: string; orderId: string; paymentId?: string; refundId?: string; amount: number; status: string; id?: string }) {
  return JSON.stringify({
    id: input.id ?? uuidv7(), event: input.event, created_at: Math.floor(Date.now() / 1000),
    payload: {
      payment: { entity: input.paymentId ? { id: input.paymentId, order_id: input.orderId, amount: input.amount, currency: 'INR', status: input.status } : {} },
      order: { entity: { id: input.orderId, amount: input.amount, currency: 'INR', status: 'paid' } },
      refund: { entity: input.refundId ? { id: input.refundId, amount: input.amount, currency: 'INR', status: input.status } : {} },
    },
  });
}
function signed(body: string, id = uuidv7()) {
  const sig = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest('hex');
  return new Headers({ 'x-razorpay-signature': sig, 'x-razorpay-event-id': id });
}

before(async () => {
  if (skip) return;
  drop = (await createTestDatabase()).drop;
  actor = (await auth.bootstrapAdmin({ email: 'qa-admin@example.com', password: 'admin pass 12', firstName: 'Qa', lastName: 'Admin' })).userId;
  await c.adminSaveCategory(S.categoryFields.parse({ name: 'Tees' }), actor);
}, { timeout: 180_000 });
after(async () => { await drop?.(); });
beforeEach(() => { process.env.PAYMENT_PROVIDER = 'mock'; });
afterEach(() => { mock.restoreAll(); process.env.PAYMENT_PROVIDER = 'mock'; });

// ---------------------------------------------------------------- API adapter

test('Razorpay adapter sends integer paise and an idempotency key; maps create/get/refund', { skip }, async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  await withFetch(async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/orders') && init.method === 'POST') return json({ id: 'order_qa_1', status: 'created' });
    if (String(url).includes('/payments/pay_qa_1/refund')) return json({ id: 'rfnd_qa_1', status: 'processed' });
    if (String(url).includes('/payments/pay_qa_1')) return json({ id: 'pay_qa_1', status: 'captured', amount: 100, currency: 'INR' });
    if (String(url).includes('/orders/order_qa_1/payments')) return json({ items: [{ id: 'pay_qa_1', status: 'captured', amount: 100, currency: 'INR' }] });
    throw new Error(`unexpected ${url}`);
  }, async () => {
    const created = await razorpay.razorpayGateway.createPayment({ reference: 'TUW-QA-API', amountPaise: 100, currency: 'INR' });
    assert.equal(created.providerRef, 'order_qa_1');
    assert.equal((calls[0]!.init.headers as Record<string, string>)['Idempotency-Key'], 'TUW-QA-API');
    assert.deepEqual(JSON.parse(String(calls[0]!.init.body)).amount, 100);

    assert.deepEqual(await razorpay.razorpayGateway.getPayment!('pay_qa_1'), { status: 'captured', amountPaise: 100, currency: 'INR' });
    assert.deepEqual(await razorpay.razorpayGateway.getOrderPayments!('order_qa_1'), [{ id: 'pay_qa_1', status: 'captured', amountPaise: 100, currency: 'INR' }]);
    const refund = await razorpay.razorpayGateway.refund({ providerRef: 'pay_qa_1', amountPaise: 100, reference: 'refund-qa-1' });
    assert.equal(refund.providerRef, 'rfnd_qa_1');
    assert.equal((calls.at(-1)!.init.headers as Record<string, string>)['Idempotency-Key'], 'refund-qa-1');
  });
});

test('Razorpay adapter rejects non-integer amounts and surfaces API failures without hiding them', { skip }, async () => {
  await assert.rejects(razorpay.razorpayGateway.createPayment({ reference: 'x', amountPaise: 100.5, currency: 'INR' }), /positive integer/);
  for (const [label, response] of [
    ['500', json({ error: { description: 'boom' } }, 500)],
    ['401', json({ error: { description: 'unauthorized' } }, 401)],
    ['malformed', new Response('<html>nope</html>', { status: 200 })],
  ] as const) {
    await withFetch(async () => response as Response, async () => {
      await assert.rejects(razorpay.razorpayGateway.getPayment!('pay_bad'), /Razorpay|JSON/);
    });
    void label;
  }
  await withFetch(async () => { throw new Error('network down'); }, async () => {
    await assert.rejects(razorpay.razorpayGateway.getPayment!('pay_bad'), /network down/);
  });
});

// ------------------------------------------------------------- pending order

test('pending order is written before any provider call, reserves stock and keeps payment pending', { skip }, async () => {
  process.env.PAYMENT_PROVIDER = 'razorpay';
  const p = await product(7, 900);
  const g = guest();
  await add(g, p, 2);
  let providerCalls = 0;
  await withFetch(async () => { providerCalls += 1; throw new Error('provider must not be called'); }, async () => {
    const made = await orders.createPendingOrder(g, form());
    assert.equal(providerCalls, 0);
    assert.equal(await stockOf(p.id), 5);
    const o = await one<{ status: string; payment_status: string }>(sql`SELECT status, payment_status FROM orders WHERE id = ${made.orderId}`);
    assert.deepEqual(o, { status: 'pending', payment_status: 'pending' });
    const pi = await one<{ status: string; order_id: string; provider_order_id: string | null }>(sql`
      SELECT status, order_id, provider_order_id FROM payment_intents WHERE id = ${made.intentId}`);
    assert.equal(pi.status, 'created');
    assert.equal(pi.order_id, made.orderId);
    assert.equal(pi.provider_order_id, null);
    const pay = await one<{ status: string }>(sql`SELECT status FROM payments WHERE order_id = ${made.orderId}`);
    assert.equal(pay.status, 'pending');
  });
});

// ------------------------------------------------------------------- webhooks

test('signed captured webhook confirms once; duplicates and late failures are inert', { skip }, async () => {
  const { p, f, created, providerOrderId } = await pending();
  const paymentId = `pay_${f.checkoutKey.slice(0, 8)}`;
  const amount = created.amountPaise;
  const firstBody = eventBody({ event: 'payment.captured', orderId: providerOrderId, paymentId, amount, status: 'captured' });
  const firstId = uuidv7();
  assert.equal((await payments.ingestWebhook('razorpay', firstBody, signed(firstBody, firstId))).status, 200);

  const o = await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id = ${created.orderId}`);
  assert.equal(o.payment_status, 'paid');
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM payments WHERE order_id = ${created.orderId} AND status = 'captured'`), 1);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM order_status_history WHERE order_id = ${created.orderId} AND note = 'Payment captured'`), 1);
  assert.equal(await stockOf(p.id), 9, 'expiry must not release a paid order');

  const duplicate = await payments.ingestWebhook('razorpay', firstBody, signed(firstBody, firstId));
  assert.deepEqual(duplicate, { status: 200, body: { received: true, ignored: true } });
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM webhook_events WHERE provider_event_id = ${firstId}`), 1);

  const lateFail = eventBody({ event: 'payment.failed', orderId: providerOrderId, paymentId, amount, status: 'failed' });
  assert.equal((await payments.ingestWebhook('razorpay', lateFail, signed(lateFail))).status, 200);
  const after = await one<{ payment_status: string; intent_status: string }>(sql`
    SELECT o.payment_status, (SELECT status FROM payment_intents WHERE order_id = o.id) AS intent_status
    FROM orders o WHERE o.id = ${created.orderId}`);
  assert.deepEqual(after, { payment_status: 'paid', intent_status: 'paid' });
});

test('forged/tampered webhooks are rejected before any DB write', { skip }, async () => {
  const { providerOrderId } = await pending();
  const body = eventBody({ event: 'payment.captured', orderId: providerOrderId, paymentId: 'pay_forged', amount: 50000, status: 'captured' });
  const before = await count(sql`SELECT count(*)::int AS n FROM webhook_events`);
  assert.equal((await payments.ingestWebhook('razorpay', body, new Headers({ 'x-razorpay-signature': 'deadbeef' }))).status, 401);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM webhook_events`), before);
  const headers = signed(body);
  headers.set('x-razorpay-signature', '0'.repeat(64));
  assert.equal((await payments.ingestWebhook('razorpay', body, headers)).status, 401);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM webhook_events`), before);
  assert.equal((await payments.ingestWebhook('razorpay', 'not json', signed('not json'))).status, 400);
});

test('authorized/pending events never confirm; amount mismatch is rejected and recorded', { skip }, async () => {
  const { f, created, providerOrderId } = await pending();
  const paymentId = `pay_auth_${f.checkoutKey.slice(0, 8)}`;
  for (const [event, status] of [['payment.authorized', 'authorized'], ['payment.pending', 'pending']] as const) {
    const body = eventBody({ event, orderId: providerOrderId, paymentId, amount: created.amountPaise, status });
    assert.equal((await payments.ingestWebhook('razorpay', body, signed(body))).status, 200);
  }
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id = ${created.orderId}`)).payment_status, 'pending');

  const bad = eventBody({ event: 'payment.captured', orderId: providerOrderId, paymentId, amount: created.amountPaise + 1, status: 'captured' });
  const result = await payments.ingestWebhook('razorpay', bad, signed(bad));
  assert.equal(result.status, 500);
  assert.match(result.body.error!, /does not match/);
  assert.equal((await one<{ status: string; attempts: number }>(sql`SELECT status, attempts FROM webhook_events WHERE error IS NOT NULL ORDER BY received_at DESC LIMIT 1`)).status, 'failed');
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id = ${created.orderId}`)).payment_status, 'pending');
});

test('a failed webhook is retried by the job and by a provider redelivery, but processed duplicates stay inert', { skip }, async () => {
  const { created, providerOrderId } = await pending();
  const paymentId = `pay_retry_${created.orderId.slice(0, 8)}`;
  const body = eventBody({ event: 'payment.captured', orderId: providerOrderId, paymentId, amount: created.amountPaise, status: 'captured' });
  const id = uuidv7();
  const headers = signed(body, id);

  // Force the first attempt to fail by temporarily breaking the amount in the
  // stored event, then fix it. This exercises real failure/retry bookkeeping.
  const badBody = eventBody({ event: 'payment.captured', orderId: providerOrderId, paymentId, amount: created.amountPaise + 5, status: 'captured' });
  const first = await payments.ingestWebhook('razorpay', badBody, signed(badBody, id));
  assert.equal(first.status, 500);
  const failedRow = await one<{ status: string; attempts: number; payload: unknown }>(sql`SELECT status, attempts, payload FROM webhook_events WHERE provider_event_id = ${id}`);
  assert.deepEqual([failedRow.status, failedRow.attempts], ['failed', 1]);

  // Provider redelivery of the same event id now reprocesses it.
  const retry = await payments.ingestWebhook('razorpay', body, headers);
  assert.equal(retry.status, 200);
  assert.equal((await one<{ status: string }>(sql`SELECT status FROM webhook_events WHERE provider_event_id = ${id}`)).status, 'processed');
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id = ${created.orderId}`)).payment_status, 'paid');
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM payments WHERE order_id = ${created.orderId} AND status = 'captured'`), 1);

  // The retry job also heals due failed events that the provider never redelivers.
  const other = await pending();
  const body2 = eventBody({ event: 'payment.captured', orderId: other.providerOrderId, paymentId: `pay_job_${other.created.orderId.slice(0, 8)}`, amount: other.created.amountPaise, status: 'captured' });
  const id2 = uuidv7();
  const badBody2 = eventBody({ event: 'payment.captured', orderId: other.providerOrderId, paymentId: `pay_job_${other.created.orderId.slice(0, 8)}`, amount: other.created.amountPaise + 9, status: 'captured' });
  assert.equal((await payments.ingestWebhook('razorpay', badBody2, signed(badBody2, id2))).status, 500);
  const normalized = {
    provider: 'razorpay', providerEventId: id2, eventType: 'payment.captured', kind: 'payment_captured',
    providerOrderId: other.providerOrderId, providerPaymentId: `pay_job_${other.created.orderId.slice(0, 8)}`,
    amountPaise: other.created.amountPaise, currency: 'INR', status: 'captured', raw: JSON.parse(body2),
  };
  await db().execute(sql`UPDATE webhook_events SET payload=${JSON.stringify(normalized)}::jsonb,
    amount_paise=${other.created.amountPaise}, next_attempt_at=now() - interval '1 second' WHERE provider_event_id=${id2}`);
  const job = await payments.retryFailedWebhooks();
  assert.ok(job.processed >= 1);
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id = ${other.created.orderId}`)).payment_status, 'paid');
});

test('webhook and callback firing together capture exactly once', { skip }, async () => {
  const { f, created, providerOrderId } = await pending();
  const paymentId = `pay_race_${f.checkoutKey.slice(0, 8)}`;
  const body = eventBody({ event: 'payment.captured', orderId: providerOrderId, paymentId, amount: created.amountPaise, status: 'captured' });
  const results = await Promise.all([
    payments.ingestWebhook('razorpay', body, signed(body)),
    orders.confirmPaidOrder({ providerOrderId, providerPaymentId: paymentId, amountPaise: created.amountPaise, currency: 'INR' }),
  ]);
  assert.equal(results[0]!.status, 200);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM payments WHERE order_id = ${created.orderId} AND status = 'captured'`), 1);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM order_status_history WHERE order_id = ${created.orderId} AND note = 'Payment captured'`), 1);
});

test('duplicate concurrent webhook deliveries create one row and one state change', { skip }, async () => {
  const { f, created, providerOrderId } = await pending();
  const paymentId = `pay_dup_${f.checkoutKey.slice(0, 8)}`;
  const body = eventBody({ event: 'payment.captured', orderId: providerOrderId, paymentId, amount: created.amountPaise, status: 'captured' });
  const id = uuidv7();
  const results = await Promise.all([0, 1, 2].map(() => payments.ingestWebhook('razorpay', body, signed(body, id))));
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM webhook_events WHERE provider_event_id = ${id}`), 1);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM payments WHERE order_id = ${created.orderId} AND status = 'captured'`), 1);
});

test('refund processed webhook settles the payment; duplicate is inert', { skip }, async () => {
  const { f, created, providerOrderId } = await pending();
  const paymentId = `pay_refund_${f.checkoutKey.slice(0, 8)}`;
  const body = eventBody({ event: 'payment.captured', orderId: providerOrderId, paymentId, amount: created.amountPaise, status: 'captured' });
  await payments.ingestWebhook('razorpay', body, signed(body));

  const refundId = `rfnd_${f.checkoutKey.slice(0, 8)}`;
  await db().execute(sql`INSERT INTO refunds (id, order_id, payment_id, amount, reason, payout_reference, status, actor)
    VALUES (${uuidv7()}, ${created.orderId}::uuid, (SELECT id FROM payments WHERE order_id = ${created.orderId}::uuid),
      ${toRupees(created.amountPaise)}, 'QA refund', ${refundId}, 'processing', ${actor}::uuid)`);
  const rb = eventBody({ event: 'refund.processed', orderId: providerOrderId, refundId, amount: created.amountPaise, status: 'processed' });
  const rbId = uuidv7();
  const rbHeaders = signed(rb, rbId);
  assert.equal((await payments.ingestWebhook('razorpay', rb, rbHeaders)).status, 200);
  assert.equal((await one<{ status: string }>(sql`SELECT status FROM refunds WHERE payout_reference = ${refundId}`)).status, 'completed');
  assert.equal((await one<{ status: string }>(sql`SELECT status FROM payments WHERE order_id = ${created.orderId}`)).status, 'refunded');
  assert.equal((await payments.ingestWebhook('razorpay', rb, rbHeaders)).status, 200);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM webhook_events WHERE event_type = 'refund.processed' AND provider_event_id = ${rbId}`), 1);
});

// --------------------------------------------------------------- reconciliation

test('reconciliation confirms a captured payment when both webhook and callback were lost', { skip }, async () => {
  const { p, f, created, providerOrderId } = await pending({}, false);
  const paymentId = `pay_lost_${f.checkoutKey.slice(0, 8)}`;
  await db().execute(sql`UPDATE payment_intents SET provider='razorpay', provider_order_id=${`order_lost_${f.checkoutKey.slice(0, 8)}`},
    provider_payment_id=${paymentId}, created_at=now() - interval '2 minutes' WHERE id=${created.intentId}`);

  await withFetch(async (url) => {
    if (String(url).includes(`/payments/${paymentId}`)) return json({ id: paymentId, status: 'captured', amount: created.amountPaise, currency: 'INR' });
    throw new Error(`unexpected ${url}`);
  }, async () => {
    const result = await payments.reconcilePendingPayments();
    assert.equal(result.processed, 1);
  });
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id = ${created.orderId}`)).payment_status, 'paid');
  assert.equal(await stockOf(p.id), 9);
  void providerOrderId;
});

test('reconciliation finds the payment by order payments when the id was never stored', { skip }, async () => {
  const { created, f } = await pending({}, false);
  const providerOrderId = `order_find_${f.checkoutKey.slice(0, 8)}`;
  const paymentId = `pay_find_${f.checkoutKey.slice(0, 8)}`;
  await db().execute(sql`UPDATE payment_intents SET provider='razorpay', provider_order_id=${providerOrderId},
    created_at=now() - interval '2 minutes' WHERE id=${created.intentId}`);
  await withFetch(async (url) => {
    if (String(url).includes('/payments/') && !String(url).includes('/orders/')) return json({ id: paymentId, status: 'captured', amount: created.amountPaise, currency: 'INR' });
    if (String(url).includes('/payments')) return json({ items: [{ id: paymentId, status: 'captured', amount: created.amountPaise, currency: 'INR' }] });
    throw new Error(`unexpected ${url}`);
  }, async () => {
    assert.equal((await payments.reconcilePendingPayments()).processed, 1);
  });
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id = ${created.orderId}`)).payment_status, 'paid');
});

test('provider API failures during reconciliation do not confirm and do not corrupt state', { skip }, async () => {
  const { created, f } = await pending({}, false);
  const paymentId = `pay_down_${f.checkoutKey.slice(0, 8)}`;
  await db().execute(sql`UPDATE payment_intents SET provider='razorpay', provider_order_id=${`order_down_${f.checkoutKey.slice(0, 8)}`},
    provider_payment_id=${paymentId}, created_at=now() - interval '2 minutes' WHERE id=${created.intentId}`);
  await withFetch(async () => { throw new Error('Razorpay down'); }, async () => {
    const result = await payments.reconcilePendingPayments();
    assert.equal(result.failed, 1);
    assert.equal(result.processed, 0);
  });
  assert.equal((await one<{ status: string }>(sql`SELECT status FROM payment_intents WHERE id = ${created.intentId}`)).status, 'created');
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id = ${created.orderId}`)).payment_status, 'pending');
});

test('abandoned intent is expired and releases stock, discount and the bag', { skip }, async () => {
  const d = await discount(5);
  const { p, f, created, providerOrderId } = await pending({ discountCode: d.code });
  await db().execute(sql`UPDATE payment_intents SET provider='razorpay', provider_order_id=${`order_expire_${f.checkoutKey.slice(0, 8)}`},
    created_at=now() - interval '31 minutes' WHERE id=${created.intentId}`);
  await withFetch(async () => json({ items: [] }) as Response, async () => {
    const result = await payments.reconcilePendingPayments();
    assert.equal(result.expired, 1);
  });
  const o = await one<{ status: string; payment_status: string }>(sql`SELECT status, payment_status FROM orders WHERE id = ${created.orderId}`);
  assert.deepEqual(o, { status: 'cancelled', payment_status: 'pending' });
  assert.equal((await one<{ status: string }>(sql`SELECT status FROM payment_intents WHERE id = ${created.intentId}`)).status, 'expired');
  assert.equal(await stockOf(p.id), 10);
  assert.equal((await one<{ uses_count: number }>(sql`SELECT uses_count FROM discount_codes WHERE id = ${d.id}`)).uses_count, 0);
  assert.equal((await one<{ status: string }>(sql`SELECT status FROM carts WHERE id = (SELECT (payload->>'cartId')::uuid FROM payment_intents WHERE id = ${created.intentId})`)).status, 'active');
  void providerOrderId;
});

// -------------------------------------------------------- compensation / races

test('provider order creation failure cancels the pending order immediately and releases everything', { skip }, async () => {
  process.env.PAYMENT_PROVIDER = 'razorpay';
  const d = await discount(5);
  const p = await product(6, 700);
  const g = guest();
  await add(g, p, 1);
  const f = form(uuidv7(), { discountCode: d.code });
  const before = await count(sql`SELECT count(*)::int AS n FROM orders`);
  await withFetch(async () => { throw new Error('POST /orders failed'); }, async () => {
    await assert.rejects(payments.prepareCheckout(g, f), /POST \/orders failed/);
  });
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM orders`), before + 1);
  const made = await one<{ id: string; status: string; payment_status: string }>(sql`
    SELECT id, status, payment_status FROM orders ORDER BY created_at DESC LIMIT 1`);
  assert.deepEqual([made.status, made.payment_status], ['cancelled', 'pending']);
  assert.equal((await one<{ status: string }>(sql`SELECT status FROM payment_intents WHERE order_id = ${made.id}`)).status, 'expired');
  assert.equal(await stockOf(p.id), 6);
  assert.equal((await one<{ uses_count: number }>(sql`SELECT uses_count FROM discount_codes WHERE id = ${d.id}`)).uses_count, 0);
});

test('provider order created but attach fails: compensation wins, no paid state', { skip }, async () => {
  process.env.PAYMENT_PROVIDER = 'razorpay';
  const p = await product(4, 600);
  const g = guest();
  await add(g, p, 1);
  const f = form();
  await withFetch(async () => json({ id: 'x'.repeat(200), status: 'created' }) as Response, async () => {
    await assert.rejects(payments.prepareCheckout(g, f));
  });
  const made = await one<{ id: string; status: string }>(sql`SELECT id, status FROM orders ORDER BY created_at DESC LIMIT 1`);
  assert.equal(made.status, 'cancelled');
  assert.equal((await one<{ status: string; provider_order_id: string | null }>(sql`
    SELECT status, provider_order_id FROM payment_intents WHERE order_id = ${made.id}`)).provider_order_id, null);
  assert.equal(await stockOf(p.id), 4);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM payments WHERE order_id = ${made.id} AND status = 'captured'`), 0);
});

test('three parallel Pay attempts with one checkout key make exactly one order and one provider order', { skip, timeout: 240_000 }, async () => {
  const p = await product(12, 800);
  const g = guest();
  await add(g, p, 1);
  const f = form();
  const results = await Promise.all([0, 1, 2].map(() => payments.prepareCheckout(g, f)));
  assert.equal(new Set(results.map((r) => r.orderId)).size, 1);
  assert.equal(new Set(results.map((r) => r.providerOrderId)).size, 1);
  assert.equal(results.filter((r) => !r.replayed).length, 1);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM orders WHERE idempotency_key = ${f.checkoutKey}`), 1);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM payment_intents WHERE checkout_key = ${f.checkoutKey}`), 1);
  assert.equal(await stockOf(p.id), 11);
});

test('currency mismatch never confirms an order', { skip }, async () => {
  const { created, providerOrderId } = await pending();
  await assert.rejects(orders.confirmPaidOrder({ providerOrderId, providerPaymentId: 'pay_currency', amountPaise: created.amountPaise, currency: 'USD' }), /currency/i);
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id = ${created.orderId}`)).payment_status, 'pending');
});

test('QA test SKU is never submitted to fulfilment, even when auto-submit is on', { skip }, async () => {
  // The production guard is env-driven; the QA fixture supplies the SKU here.
  const previousSku = process.env.CHECKOUT_TEST_SKU;
  process.env.CHECKOUT_TEST_SKU = 'TUW-TEST-PRODUCT-49F1AA';
  try {
    const p = await product(5, 100, {
      sku: 'TUW-TEST-PRODUCT-49F1AA',
      variants: [{ color: 'Black', size: 'M', price: 100, stock: 5, sku: 'TUW-TEST-PRODUCT-49F1AA-BLACK-M' }],
    });
    const g = guest();
    await add(g, p, 1);
    const f = form();
    const made = await orders.createPendingOrder(g, f);
    const providerOrderId = `mock_order_test_${f.checkoutKey.slice(0, 8)}`;
    await payments.attachProviderOrder({ intentId: made.intentId, provider: 'mock', providerOrderId });
    await orders.confirmPaidOrder({ providerOrderId, providerPaymentId: `pay_test_${f.checkoutKey.slice(0, 8)}`, amountPaise: made.amountPaise, currency: 'INR' });

    const outcome = await fulfillment.sendPlanned(made.orderId);
    assert.deepEqual(outcome.groups, []);
    assert.match(outcome.skipped[0]!.reason, /Test product/);
    assert.equal(await count(sql`SELECT count(*)::int AS n FROM fulfillment_orders WHERE order_id = ${made.orderId}`), 0);
  } finally {
    if (previousSku === undefined) delete process.env.CHECKOUT_TEST_SKU;
    else process.env.CHECKOUT_TEST_SKU = previousSku;
  }
});

test('DB invariants hold across the whole QA suite', { skip }, async () => {
  assert.equal(await count(sql`
    SELECT count(*)::int AS n FROM payment_intents WHERE status = 'paid' AND order_id IS NULL`), 0);
  assert.equal(await count(sql`
    SELECT count(*)::int AS n FROM orders o JOIN payments p ON p.order_id = o.id
    WHERE p.status = 'captured' AND o.payment_status <> 'paid'`), 0);
  assert.equal(await count(sql`
    SELECT count(*)::int AS n FROM (SELECT transaction_id FROM payments WHERE transaction_id IS NOT NULL
      GROUP BY transaction_id HAVING count(*) > 1) x`), 0);
  assert.equal(await count(sql`
    SELECT count(*)::int AS n FROM (SELECT order_id FROM payments WHERE status IN ('captured','refunded')
      GROUP BY order_id HAVING count(*) > 1) x`), 0);
  assert.equal(await count(sql`
    SELECT count(*)::int AS n FROM (SELECT order_id FROM order_status_history WHERE note = 'Payment captured'
      GROUP BY order_id HAVING count(*) > 1) x`), 0);
  assert.equal(await count(sql`
    SELECT count(*)::int AS n FROM fulfillment_orders`), 0, 'dev QA never submits to fulfilment');
  assert.equal(await code(Promise.resolve(adapters.mockGateway.createPayment({ reference: 'qa', amountPaise: 100, currency: 'INR' }))), 'ok');
});
