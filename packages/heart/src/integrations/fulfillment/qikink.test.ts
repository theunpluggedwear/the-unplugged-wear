import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody, createQikinkClient, qikinkBackoffDelayMs } from './qikink.ts';
import type { FulfillmentOrderInput } from './adapters.ts';

const shipTo = {
  name: 'Asha Rao', line1: '12 100 Feet Road', city: 'Bengaluru', state: 'Karnataka',
  postalCode: '560038', phone: '9876543210', email: 'asha@example.com', country: 'India',
};

const design = {
  designCode: 'TUW-ONYX-01', designLink: '/images/pdp-figma/shirt/front.png',
  mockupLink: '/images/pdp-figma/shirt/back.png', placementSku: 'fr', widthInches: 12, heightInches: 16,
};

const makeInput = (payload: Record<string, unknown>): FulfillmentOrderInput => ({
  reference: 'TUW12345',
  gateway: 'prepaid',
  totalPaise: 389900,
  shipTo,
  lines: [{ sku: 'MRnHs-Bk-M', quantity: 2, unitPricePaise: 389900, payload }],
});

test('createBody sends normalised designs and never mixes them with store-SKU lines', () => {
  const body = createBody(makeInput({ printTypeId: 1, designs: [design] })) as { line_items: Record<string, unknown>[] };
  const line = body.line_items[0]!;
  assert.equal(line.search_from_my_products, 0);
  assert.equal(line.print_type_id, 1);
  assert.deepEqual(line.designs, [{
    design_code: 'TUW-ONYX-01', width_inches: 12, height_inches: 16, placement_sku: 'fr',
    design_link: '/images/pdp-figma/shirt/front.png', mockup_link: '/images/pdp-figma/shirt/back.png',
  }]);

  const store = createBody(makeInput({ searchFromMyProducts: 1, printTypeId: 1, designs: [design] })) as { line_items: Record<string, unknown>[] };
  assert.deepEqual(store.line_items[0], { quantity: '2', sku: 'MRnHs-Bk-M', price: '3899.00', search_from_my_products: 1 });
  assert.equal('designs' in store.line_items[0]!, false);
  assert.equal('print_type_id' in store.line_items[0]!, false);

  const plain = createBody(makeInput({})) as { line_items: Record<string, unknown>[] };
  assert.deepEqual(plain.line_items[0], store.line_items[0]);
});

test('a 401 retries once with a fresh token and keeps the order payload', async () => {
  const original = globalThis.fetch;
  const tokens: string[] = [];
  const paths: string[] = [];
  const sentTokens: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).replace('https://qikink.test', '');
    paths.push(path);
    const headers = new Headers(init?.headers);
    if (path === '/api/token') {
      tokens.push(`tok-${tokens.length + 1}`);
      return new Response(JSON.stringify({ Accesstoken: `tok-${tokens.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    sentTokens.push(headers.get('Accesstoken') ?? '');
    if (path === '/api/order/create' && sentTokens.length === 1) {
      return new Response(JSON.stringify({ error: 'Invalid AccessToken or Client Id' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ order_id: 7788, order_status: 'Live' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const client = createQikinkClient({ clientId: `retry-${Date.now()}`, clientSecret: 'secret', baseUrl: 'https://qikink.test' });
    const state = await client.createOrder(makeInput({}));
    assert.equal(tokens.length, 2);
    assert.deepEqual(sentTokens, ['tok-1', 'tok-2']);
    assert.equal(paths.filter((p) => p === '/api/order/create').length, 2);
    assert.equal(state.providerOrderRef, '7788');
    assert.equal(state.status, 'submitted');
  } finally {
    globalThis.fetch = original;
  }
});

test('the rate-limit helper returns a delay only when 30 calls fall in one minute', () => {
  const now = 1_000_000;
  const recent = Array.from({ length: 29 }, (_, i) => now - i * 1000);
  assert.equal(qikinkBackoffDelayMs(recent, now), 0);
  assert.equal(qikinkBackoffDelayMs([...recent, now - 29_000], now), 31_000);
  assert.equal(qikinkBackoffDelayMs(recent.map((at) => at - 120_000), now), 0);
});
