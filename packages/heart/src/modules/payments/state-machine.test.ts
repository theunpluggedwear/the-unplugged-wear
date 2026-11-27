import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PgDialect } from 'drizzle-orm/pg-core';

const DB_STUB = `
export function getDb() { return globalThis.__tuwTestTx; }
export function getPool() { return globalThis.__tuwTestPool; }
export function withTransaction(fn) { return fn(globalThis.__tuwTestTx); }
export function closeDb() {}
export function connectionString() { return 'postgres://test'; }
export function checkDatabase() { return Promise.resolve({ ok: true, migrations: 0, latencyMs: 0 }); }
export const schema = {};
export const tables = {};
`;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export%20default%20%7B%7D', shortCircuit: true };
    if (specifier.endsWith('platform/db/index.ts')) return { url: `data:text/javascript,${encodeURIComponent(DB_STUB)}`, shortCircuit: true };
    return next(specifier, context);
  },
});

const dialect = new PgDialect();
const webhooks = await import('./webhooks.ts');
const payments = await import('./service.ts');
const returnsAdmin = await import('../returns/admin.ts');
const claims = await import('../fulfillment/claims.ts');

type Call = { text: string; params: unknown[] };
type Reply = { rows?: Record<string, unknown>[]; rowCount?: number };

function fakeTx(handler: (call: Call) => Reply) {
  const calls: Call[] = [];
  const tx = {
    async execute(query: unknown) {
      const built = dialect.sqlToQuery(query as never);
      const call: Call = { text: built.sql, params: built.params as unknown[] };
      calls.push(call);
      return handler(call) ?? { rows: [], rowCount: 0 };
    },
  };
  (globalThis as Record<string, unknown>).__tuwTestTx = tx;
  return { tx, calls };
}

function refundEvent(kind: 'refund_failed' | 'refund_processed') {
  return {
    provider: 'mock', providerEventId: `event-${kind}`, eventType: kind === 'refund_failed' ? 'refund.failed' : 'refund.processed',
    kind, raw: {}, providerRefundId: 'rfnd_1', amountPaise: 10_000, currency: 'INR',
  };
}

test('refund_failed never demotes a completed refund', async () => {
  const { calls } = fakeTx(({ text }) => {
    if (text.includes('FROM refunds WHERE payout_reference')) return { rows: [{ id: 'r1', status: 'completed', order_id: 'o1' }] };
    return { rows: [] };
  });
  await webhooks.processWebhookEvent(refundEvent('refund_failed'));
  assert.equal(calls.some((c) => c.text.includes("UPDATE refunds SET status='rejected'")), false);
});

test('refund_processed heals a rejected refund and settles through the shared helper', async () => {
  const { calls } = fakeTx(({ text }) => {
    if (text.includes('FROM refunds WHERE payout_reference')) return { rows: [{ id: 'r1', status: 'rejected', order_id: 'o1' }] };
    if (text.includes('SELECT (SELECT sum(amount) FROM payments')) return { rows: [{ captured: '100.00', refunded: '100.00' }] };
    return { rows: [], rowCount: 1 };
  });
  await webhooks.processWebhookEvent(refundEvent('refund_processed'));
  assert.equal(calls.some((c) => c.text.includes("UPDATE refunds SET status='completed'")), true);
  assert.equal(calls.some((c) => c.text.includes("UPDATE payments SET status='refunded'")), true);

  const source = readFileSync(fileURLToPath(new URL('./webhooks.ts', import.meta.url)), 'utf8');
  assert.match(source, /import \{ settleIfFullyRefunded \} from '\.\/service\.ts'/);
  assert.equal(/function settleIfFullyRefunded/.test(source), false);
});

test('settlement counts captured and refunded payments once each', async () => {
  const totals = (captured: string, refunded: string) => ({ rows: [{ captured, refunded }], rowCount: 1 });
  const partial = fakeTx(({ text }) => (text.includes('sum(amount) FROM payments') ? totals('100.00', '50.00') : { rows: [] }));
  assert.equal(await payments.settleIfFullyRefunded(partial.tx as never, 'o1'), false);
  assert.equal(partial.calls.some((c) => c.text.includes('UPDATE payments')), false);
  assert.equal(partial.calls[0]!.text.includes("status IN ('captured','refunded')"), true);

  const full = fakeTx(({ text }) => (text.includes('sum(amount) FROM payments') ? totals('100.00', '100.00') : { rows: [], rowCount: 1 }));
  assert.equal(await payments.settleIfFullyRefunded(full.tx as never, 'o1'), true);
  assert.equal(full.calls.some((c) => c.text.includes("UPDATE payments SET status='refunded'")), true);
});

test('a zero-difference follow-up order is claimable by the submit worker', async () => {
  const ret = {
    id: 'ret1', rma_number: 'RMA-1', type: 'replacement', status: 'approved', resolution: 'replacement',
    price_difference: '0.00', order_id: 'o1', order_number: 'TUW-1', ordered_by: 'u1', for_profile_id: 'p1',
    for_household_id: null, shipping_address: '{}', billing_address: '{}', payment_status: 'paid',
    replacement_order_id: null, refund_id: null,
  };
  const { tx, calls } = fakeTx(({ text }) => {
    if (text.includes('SELECT ri.order_item_id')) {
      return { rows: [{ order_item_id: 'oi1', product_id: 'pr1', variant_id: null, product_name: 'Tee', sku: 'SKU', options: {}, qty: 1, unit_price: '100.00', exchange_variant_id: null, variant_price: null, variant_sku: null }] };
    }
    return { rows: [], rowCount: 1 };
  });
  await returnsAdmin.createFollowUpOrder(tx as never, ret as never, 'staff1');
  const insert = calls.find((c) => c.text.includes('INSERT INTO orders'));
  assert.ok(insert, 'a follow-up order is inserted');
  const tail = insert.text.slice(insert.text.indexOf('cancellable_until'));
  assert.match(tail, /now\(\)/, 'zero difference is due immediately, not NULL');
  assert.equal(insert.params.includes('paid'), true);
  assert.equal(returnsAdmin.followUpDueImmediately(0), true);
  assert.equal(returnsAdmin.followUpDueImmediately(2000), false);
});

function claimRow(status: string, resolution: string | null) {
  return {
    id: 'c1', fulfillment_order_id: 'f1', order_number: 'TUW-1', type: 'damaged', status, resolution,
    claim_deadline: null, evidence_count: 1, has_unboxing_video: true, provider_ticket_ref: null,
    customer_note: null, staff_note: null, created_at: new Date().toISOString(), resolved_at: null, claim_amount: '50.00',
  };
}

function claimTx(finalResolution: string | null) {
  return fakeTx(({ text }) => {
    if (text.includes('FOR UPDATE')) return { rows: [claimRow('approved', 'reprint')] };
    if (text.includes('SELECT c.id, c.fulfillment_order_id')) return { rows: [claimRow('resolved', finalResolution)] };
    return { rows: [], rowCount: 1 };
  });
}

test('resolving a claim requires the resolution at that transition', async () => {
  claimTx('reprint');
  await assert.rejects(
    () => claims.updateClaim({ claimId: 'c1', status: 'resolved' }, 'staff1'),
    /Choose what the partner agreed to/,
  );
});

test('a wallet-credit resolution posts its ledger entry inside the claim transaction', async () => {
  const { calls } = claimTx('wallet_credit');
  const updated = await claims.updateClaim(
    { claimId: 'c1', status: 'resolved', resolution: 'wallet_credit', amountPaise: 5000 }, 'staff1',
  );
  assert.equal(updated.resolution, 'wallet_credit');
  const ledger = calls.find((c) => c.text.includes('INSERT INTO provider_wallet_ledger'));
  assert.ok(ledger, 'the ledger write happened in the same transaction');
  assert.equal(ledger.params.includes('claim_credit'), true);
  assert.equal(ledger.params.includes('50.00'), true);
  const update = calls.find((c) => c.text.includes('UPDATE fulfillment_claims'));
  assert.ok(update);
  assert.equal(update.params.includes('reprint'), false, 'the approved resolution is not reused at resolve');
});
