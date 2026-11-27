import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';

const DB_STUB = `
export function getDb() { return globalThis.__tuwTestTx; }
export function withTransaction(fn) { return fn(globalThis.__tuwTestTx); }
export function closeDb() {}
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

const service = await import('./service.ts');
const dialect = new PgDialect();

type Call = { text: string; params: unknown[] };

function harness() {
  const calls: Call[] = [];
  const reversals = new Set<string>();
  const balances: Record<string, string> = { cardA: '50.00', cardB: '50.00', cardC: '50.00' };
  const tx = {
    async execute(query: unknown) {
      const built = dialect.sqlToQuery(query as never);
      const text = built.sql;
      const params = built.params as unknown[];
      calls.push({ text, params });
      if (text.includes("type = 'redeem'")) return { rows: [{ id: 'txr', gift_card_id: 'cardR', amount: '20.00' }] };
      if (text.includes('SELECT 1 FROM gift_card_transactions') && text.includes('order_item_id')) {
        const cardId = String(params[0]);
        return { rows: reversals.has(cardId) ? [{ one: 1 }] : [] };
      }
      if (text.includes('SELECT 1 FROM gift_card_transactions')) return { rows: [{ one: 1 }] };
      if (text.includes('FROM order_items oi JOIN products p')) return { rows: [{ id: 'line1', qty: 3 }] };
      if (text.includes('purchased_order_item_id')) {
        const unit = Number(params.find((v) => typeof v === 'number'));
        const cardId = ['cardA', 'cardB', 'cardC'][unit - 1];
        return { rows: cardId ? [{ id: cardId, balance: balances[cardId]! }] : [] };
      }
      if (text.includes('INSERT INTO gift_card_transactions')) {
        reversals.add(String(params[1]));
        return { rows: [], rowCount: 1 };
      }
      if (text.includes('UPDATE gift_cards')) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  };
  return { tx, calls };
}

test('a multi-unit gift-card line is reversed once per unit and stays idempotent', async () => {
  const { tx, calls } = harness();
  const first = await service.reverseForOrder(tx as never, 'o1', 'staff1');
  assert.equal(first?.amountPaise, 15_000, 'three units of ₹50 are restored once each');
  const inserts = () => calls.filter((c) => c.text.includes('INSERT INTO gift_card_transactions'));
  assert.equal(inserts().length, 3);
  for (const cardId of ['cardA', 'cardB', 'cardC']) {
    assert.equal(inserts().filter((c) => c.params.includes(cardId)).length, 1, `${cardId} reversed exactly once`);
    assert.equal(inserts().find((c) => c.params.includes(cardId))?.params.includes('line1'), true, 'keyed to its order item');
  }
  assert.equal(inserts().some((c) => c.params.includes('cardR')), false, 'an already-reversed redeem stays untouched');

  const second = await service.reverseForOrder(tx as never, 'o1', 'staff1');
  assert.equal(second, null);
  assert.equal(inserts().length, 3, 'a retry adds no second reversal');
});
