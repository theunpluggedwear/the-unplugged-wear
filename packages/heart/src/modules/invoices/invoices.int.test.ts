// Rigorous QA for provider-neutral invoices: creation, idempotency, webhooks,
// reconciliation, compensation and DB invariants. Throwaway schema.
import { test, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';

process.env.AUTH_SECRET ||= 'test-secret-that-is-definitely-longer-than-32-chars';

const { createTestDatabase, hasTestDatabase } = await import('../../platform/test/index.ts');
const auth = await import('../auth/index.ts');
const catalog = await import('../catalog/index.ts');
const cart = await import('../cart/index.ts');
const orders = await import('../orders/index.ts');
const payments = await import('../payments/index.ts');
const invoices = await import('./index.ts');
const { mockInvoiceProvider } = await import('../../integrations/invoices/mock.ts');
const { getDb } = await import('../../platform/db/index.ts');
const { uuidv7 } = await import('../../platform/ids/index.ts');
const { QA_DEMO_INVOICE_PROVIDER } = await import('../../platform/qa-demo-product/index.ts');

const skip = !hasTestDatabase() && 'no DATABASE_URL_UNPOOLED';
let drop: (() => Promise<void>) | undefined;
let actor = '';
const S = catalog.catalogSchemas;
const address = { fullName: 'QA Buyer', line1: '12 QA Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'India' as const, phone: '9876543210' };
const guest = () => ({ sessionId: uuidv7().replace(/-/g, '') });
const form = (key = uuidv7()) => orders.orderSchemas.placeOrder.parse({
  checkoutKey: key, email: 'invoice.qa@example.com', shippingAddress: address, method: 'card', speed: 'standard',
});
const one = async <T extends Record<string, unknown>>(q: ReturnType<typeof sql>) => (await getDb().execute<T>(q)).rows[0]!;
const count = async (q: ReturnType<typeof sql>) => Number((await one<{ n: number }>(q)).n);

let seq = 0;
async function product(stock = 10, price = 500, over: Record<string, unknown> = {}) {
  seq += 1;
  return catalog.adminCreateProduct(S.productFields.parse({
    name: `Invoice Product ${seq}`, slug: `invoice-product-${seq}`, category: 'Tees', price,
    colors: ['Black'], sizes: ['M'], partner: 'Custom Atelier', publicationStatus: 'published',
    description: 'QA fixture', variants: [{ color: 'Black', size: 'M', price, stock }], ...over,
  }), actor);
}
const add = (owner: Parameters<typeof cart.addLine>[0], p: { id: string }, qty = 1) =>
  cart.addLine(owner, { productRef: p.id, color: 'Black', size: 'M', qty });
async function qaDemoProduct(price = 999) {
  const suffix = seq + 1;
  const sku = `TUW-TEST-PRODUCT-49F1AA-${suffix}`;
  return product(5, price, { sku, variants: [{ color: 'Black', size: 'M', price, stock: 5, sku: `${sku}-BLACK-M` }] });
}
async function ready() {
  const p = await product(8, 500);
  const g = guest();
  await add(g, p, 1);
  return { p, g, input: form() };
}

before(async () => {
  if (skip) return;
  drop = (await createTestDatabase()).drop;
  actor = (await auth.bootstrapAdmin({ email: 'invoice-admin@example.com', password: 'admin pass 12', firstName: 'In', lastName: 'Voice' })).userId;
  await catalog.adminSaveCategory(S.categoryFields.parse({ name: 'Tees' }), actor);
}, { timeout: 180_000 });
after(async () => { await drop?.(); });
beforeEach(() => { process.env.INVOICE_PROVIDER = 'mock_invoice'; process.env.PAYMENT_PROVIDER = 'mock'; });
afterEach(() => { mock.restoreAll(); process.env.INVOICE_PROVIDER = ''; process.env.PAYMENT_PROVIDER = 'mock'; });

test('invoice checkout creates pending order, document and hosted URL before payment', { skip }, async () => {
  const { g, input } = await ready();
  const result = await invoices.prepareInvoiceCheckout(g, input);
  assert.match(result.invoiceUrl, /mock-invoice/);
  assert.equal(result.provider, 'mock_invoice');
  const o = await one<{ status: string; payment_status: string }>(sql`SELECT status, payment_status FROM orders WHERE id=${result.orderId}::uuid`);
  assert.deepEqual(o, { status: 'pending', payment_status: 'pending' });
  const doc = await invoices.getDocumentByOrder(result.orderId);
  assert.equal(doc?.status, 'issued');
  assert.equal(doc?.amountPaise, result.amountPaise);
  const intent = await payments.getIntentByCheckoutKey(input.checkoutKey);
  assert.ok(intent?.providerOrderId, 'provider order attached');
});

test('same checkout key replays the same invoice and document', { skip }, async () => {
  const { g, input } = await ready();
  const a = await invoices.prepareInvoiceCheckout(g, input);
  const b = await invoices.prepareInvoiceCheckout(g, input);
  assert.equal(a.invoiceUrl, b.invoiceUrl);
  assert.equal(a.orderId, b.orderId);
  assert.equal(b.replayed, true);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM payment_documents WHERE order_id=${a.orderId}::uuid`), 1);
});

test('failed first invoice attempt becomes retryable instead of a dead-end replay', { skip }, async () => {
  const { g, input } = await ready();
  mock.method(mockInvoiceProvider, 'create', async () => { throw new Error('invoice API down'); });
  await assert.rejects(invoices.prepareInvoiceCheckout(g, input), /invoice API down/);
  mock.restoreAll();
  const retry = await invoices.prepareInvoiceCheckout(g, input);
  assert.equal(retry.retryable, true);
  assert.equal(retry.invoiceUrl, '');
  assert.equal(retry.reason, 'PREVIOUS_ATTEMPT_FAILED');
});

test('invoice.paid webhook confirms paid order exactly once', { skip }, async () => {
  const { g, input } = await ready();
  const result = await invoices.prepareInvoiceCheckout(g, input);
  const doc = (await invoices.getDocumentByOrder(result.orderId))!;
  const event = {
    provider: 'razorpay', providerEventId: 'evt_qa_paid', kind: 'invoice_paid' as const, eventType: 'invoice.paid', raw: {},
    providerDocumentId: doc.providerDocumentId, providerOrderId: doc.providerOrderId ?? undefined,
    providerPaymentId: 'pay_qa_invoice', status: 'captured', paymentStatus: 'captured',
    amountPaise: result.amountPaise, currency: 'INR',
  };
  await payments.processWebhookEvent(event);
  await payments.processWebhookEvent(event);
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id=${result.orderId}::uuid`)).payment_status, 'paid');
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM payments WHERE order_id=${result.orderId}::uuid AND status='captured'`), 1);
  assert.equal((await invoices.getDocumentByOrder(result.orderId))?.status, 'paid');
});

test('invoice.expired webhook cancels pending order and releases stock', { skip }, async () => {
  const { p, g, input } = await ready();
  const result = await invoices.prepareInvoiceCheckout(g, input);
  const doc = (await invoices.getDocumentByOrder(result.orderId))!;
  await payments.processWebhookEvent({
    provider: 'razorpay', providerEventId: 'evt_qa_expired', kind: 'invoice_expired', eventType: 'invoice.expired', raw: {},
    providerDocumentId: doc.providerDocumentId, status: 'expired',
  });
  const o = await one<{ status: string; payment_status: string }>(sql`SELECT status, payment_status FROM orders WHERE id=${result.orderId}::uuid`);
  assert.equal(o.status, 'cancelled');
  assert.equal((await invoices.getDocumentByOrder(result.orderId))?.status, 'expired');
  assert.equal((await one<{ stock: number }>(sql`SELECT stock FROM product_variants WHERE product_id=${p.id}`)).stock, 8);
});

test('reconciliation confirms an invoice when the webhook is missed', { skip }, async () => {
  const { g, input } = await ready();
  const result = await invoices.prepareInvoiceCheckout(g, input);
  const doc = (await invoices.getDocumentByOrder(result.orderId))!;
  await getDb().execute(sql`UPDATE payment_documents SET created_at=now() - interval '2 minutes' WHERE id=${doc.id}::uuid`);
  mock.method(mockInvoiceProvider, 'fetch', async (id: string) => id === doc.providerDocumentId ? ({
    providerDocumentId: doc.providerDocumentId,
    providerOrderId: doc.providerOrderId ?? undefined,
    providerPaymentId: 'pay_qa_reconciled',
    status: 'paid' as const,
    amountPaise: result.amountPaise,
    raw: { currency: 'INR' },
  }) : ({
    providerDocumentId: id,
    status: 'issued' as const,
    amountPaise: result.amountPaise,
    raw: { currency: 'INR' },
  }));
  const r = await invoices.reconcileInvoiceDocuments();
  assert.equal(r.paid, 1);
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id=${result.orderId}::uuid`)).payment_status, 'paid');
});

test('provider failure compensates the pending order and releases stock', { skip }, async () => {
  const { p, g, input } = await ready();
  mock.method(mockInvoiceProvider, 'create', async () => { throw new Error('invoice API down'); });
  await assert.rejects(invoices.prepareInvoiceCheckout(g, input), /invoice API down/);
  const made = await one<{ id: string; status: string }>(sql`SELECT id, status FROM orders ORDER BY created_at DESC LIMIT 1`);
  assert.equal(made.status, 'cancelled');
  assert.equal((await one<{ stock: number }>(sql`SELECT stock FROM product_variants WHERE product_id=${p.id}`)).stock, 8);
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM payment_documents WHERE order_id=${made.id}::uuid`), 0);
});

test('QA demo product checkout is fixed at ₹1 and uses the local demo invoice', { skip }, async () => {
  const p = await qaDemoProduct(999);
  const g = guest();
  await add(g, p, 1);
  const made = await invoices.prepareInvoiceCheckout(g, form());
  assert.equal(made.amountPaise, 100);
  assert.equal(made.provider, QA_DEMO_INVOICE_PROVIDER);
  assert.match(made.invoiceUrl, /^\/demo-invoice\//);
  const doc = (await invoices.getDocumentByOrder(made.orderId))!;
  assert.equal(doc.provider, QA_DEMO_INVOICE_PROVIDER);
  assert.equal(doc.amountPaise, 100);

  await invoices.markInvoicePaid({
    provider: QA_DEMO_INVOICE_PROVIDER,
    providerDocumentId: doc.providerDocumentId,
    providerOrderId: doc.providerOrderId ?? undefined,
    providerPaymentId: `demo_pay_${doc.providerDocumentId}`,
    status: 'paid',
    paymentStatus: 'captured',
    amountPaise: 100,
    currency: 'INR',
    raw: { mode: 'qa_demo' },
  });
  assert.equal((await one<{ payment_status: string }>(sql`SELECT payment_status FROM orders WHERE id=${made.orderId}::uuid`)).payment_status, 'paid');
});

test('QA demo product cannot be mixed with normal products', { skip }, async () => {
  const qa = await qaDemoProduct(999);
  const normal = await product(5, 500);
  const g = guest();
  await add(g, qa, 1);
  await add(g, normal, 1);
  await assert.rejects(orders.createPendingOrder(g, form()), /by itself/);
});

test('invoice DB invariants', { skip }, async () => {
  assert.equal(await count(sql`SELECT count(*)::int AS n FROM payment_documents WHERE status='paid' AND amount_paise<=0`), 0);
  assert.equal(await count(sql`
    SELECT count(*)::int AS n FROM orders o JOIN payments p ON p.order_id=o.id
    WHERE p.status='captured' AND o.payment_status<>'paid'`), 0);
  assert.equal(await count(sql`
    SELECT count(*)::int AS n FROM (SELECT idempotency_key FROM payment_documents GROUP BY 1 HAVING count(*)>1) x`), 0);
});
