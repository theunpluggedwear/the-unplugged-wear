import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { razorpayInvoiceProvider } from './razorpay.ts';
import type { CreateInvoiceInput } from './types.ts';

process.env.RAZORPAY_KEY_ID ||= 'rzp_test_qa';
process.env.RAZORPAY_KEY_SECRET ||= 'qa-secret';

afterEach(() => mock.restoreAll());

const input: CreateInvoiceInput = {
  orderId: 'order-1',
  orderNumber: 'TUW-QA-00001',
  checkoutKey: 'ccce4f62-cbb6-4fb6-982e-11caf0372d2c',
  amountPaise: 15100,
  currency: 'INR',
  description: 'Order TUW-QA-00001',
  expiresAt: new Date(Date.now() + 30 * 60_000),
  idempotencyKey: 'invoice_ccce4f62-cbb6-4fb6-982e-11caf0372d2c',
  buyer: { name: 'Dharmil Gajjar', email: 'qa@example.com', phone: '+91 98765 43210' },
  billingAddress: { line1: '12 QA Street', line2: '', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'India' },
  shippingAddress: { line1: '12 QA Street', line2: '', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'India' },
  lines: [{ name: 'Order TUW-QA-00001', amountPaise: 15100, quantity: 1 }],
  notes: {},
};

test('Razorpay invoice create uses zipcode and no unsupported postalCode field', async () => {
  const captured: { body?: Record<string, unknown> } = {};
  mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    captured.body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return Response.json({
      id: 'inv_qa_1', entity: 'invoice', status: 'draft', order_id: 'order_qa_1',
      amount: 15100, amount_due: 15100, short_url: 'https://rzp.io/i/qa',
    });
  });
  await razorpayInvoiceProvider.create(input);
  const sent = captured.body;
  assert.ok(sent, 'request body captured');
  const customer = sent.customer as Record<string, unknown>;
  const billing = customer.billing_address as Record<string, unknown>;
  const shipping = customer.shipping_address as Record<string, unknown>;
  for (const address of [billing, shipping]) {
    assert.equal(address.zipcode, '560038');
    assert.equal('postalCode' in address, false);
    assert.deepEqual(Object.keys(address).sort(), ['city', 'country', 'line1', 'line2', 'state', 'zipcode']);
  }
  assert.equal(sent.partial_payment, false);
  assert.equal(sent.draft, '1');
});
