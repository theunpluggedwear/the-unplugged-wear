import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { createTestDatabase, hasTestDatabase } from '../../platform/test/index.ts';
import { getDb } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { retryFailedWebhooks } from './jobs.ts';
import { reconcilePendingPayments } from './reconcile.ts';

process.env.RAZORPAY_KEY_ID ||= 'rzp_test_claim_race';
process.env.RAZORPAY_KEY_SECRET ||= 'claim-race-secret';

const skip = !hasTestDatabase() && 'no database';
let drop: (() => Promise<void>) | undefined;
const db = () => getDb();

before(async () => {
  if (skip) return;
  drop = (await createTestDatabase()).drop;
}, { timeout: 180_000 });
after(async () => { await drop?.(); });
beforeEach(async () => {
  if (skip) return;
  await db().execute(sql`DELETE FROM webhook_events`);
  await db().execute(sql`DELETE FROM payment_intents`);
  await db().execute(sql`DELETE FROM orders`);
});

test('two retry runners claim one failed webhook exactly once', { skip }, async () => {
  const eventId = `evt_claim_race_${uuidv7().slice(0, 8)}`;
  await db().execute(sql`
    INSERT INTO webhook_events (id, provider, provider_event_id, event_type, signature_verified, payload, raw_payload, status, attempts, next_attempt_at)
    VALUES (${uuidv7()}, 'razorpay', ${eventId}, 'payment.captured', true,
      ${JSON.stringify({ kind: 'noop' })}::jsonb, '{}'::jsonb, 'failed', 1, now() - interval '1 minute')`);

  const [first, second] = await Promise.all([retryFailedWebhooks(), retryFailedWebhooks()]);
  assert.equal(first.processed + second.processed, 1);
  const { rows } = await db().execute<{ status: string; attempts: number }>(sql`
    SELECT status, attempts FROM webhook_events WHERE provider_event_id = ${eventId}`);
  assert.deepEqual([rows[0]!.status, rows[0]!.attempts], ['processed', 1]);
});

test('two reconciliation runners claim one pending intent exactly once', { skip }, async () => {
  const orderId = uuidv7();
  const providerOrderId = `order_claim_race_${uuidv7().slice(0, 8)}`;
  const providerPaymentId = `pay_claim_race_${uuidv7().slice(0, 8)}`;
  await db().execute(sql`
    INSERT INTO orders (id, order_number, subtotal, grand_total, shipping_address, billing_address, guest_email, guest_name)
    VALUES (${orderId}::uuid, ${`TUW-RACE-${orderId.slice(0, 8)}`}, 500, 500, '{}'::jsonb, '{}'::jsonb, 'race@example.com', 'Race Buyer')`);
  await db().execute(sql`
    INSERT INTO payment_intents (id, checkout_key, provider, provider_order_id, order_id, amount_paise, currency, status, provider_payment_id, created_at)
    VALUES (${uuidv7()}, ${uuidv7()}, 'razorpay', ${providerOrderId}, ${orderId}::uuid, 50000, 'INR', 'created', ${providerPaymentId}, now() - interval '2 minutes')`);

  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).includes(`/payments/${providerPaymentId}`)) {
      return new Response(JSON.stringify({ id: providerPaymentId, status: 'failed', amount: 50000, currency: 'INR' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  try {
    const [first, second] = await Promise.all([reconcilePendingPayments(), reconcilePendingPayments()]);
    assert.equal(first.failed + second.failed, 1);
  } finally {
    globalThis.fetch = original;
  }
  const { rows } = await db().execute<{ status: string; note: string | null }>(sql`
    SELECT status, note FROM payment_intents WHERE provider_order_id = ${providerOrderId}`);
  assert.deepEqual([rows[0]!.status, rows[0]!.note], ['failed', 'failed']);
});
