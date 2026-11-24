import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeLegacyMenu } from '../../packages/heart/src/modules/content/menu-merge.ts';

const mobile = [
  {
    label: 'Shop',
    href: '/shop',
    columns: [{ title: 'Clothing', links: [{ label: 'Hoodies', href: '/shop/hoodies' }] }],
  },
  { label: 'About', href: '/about', columns: [] },
];

const desktop = [
  {
    label: 'Shop',
    href: '/shop',
    columns: [{ title: 'Clothing', links: [{ label: 'Hoodies', href: '/shop/hoodies', filter: { category: 'hoodies' } }] }],
    features: [{ productSlug: 'everyday-pullover-hoodie', title: 'Pullover' }],
    shopAll: { label: 'Shop all', href: '/shop', filter: { audience: 'all' } },
  },
  { label: 'Journal', href: '/journal', columns: [], features: [], shopAll: undefined },
];

test('legacy mobile documents become menu items without desktop extras', () => {
  const merged = mergeLegacyMenu(mobile, []);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].columns[0].links[0].label, 'Hoodies');
  assert.equal(merged[0].features, undefined);
  assert.equal(merged[0].shopAll, undefined);
});

test('a matching desktop item enriches the shared item instead of duplicating it', () => {
  const merged = mergeLegacyMenu(mobile, desktop);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map((item) => item.label), ['Shop', 'About', 'Journal']);
  assert.deepEqual(merged[0].columns[0].links[0].filter, { category: 'hoodies' });
  assert.equal(merged[0].features[0].productSlug, 'everyday-pullover-hoodie');
  assert.deepEqual(merged[0].shopAll.filter, { audience: 'all' });
});

test('desktop-only items are appended and opaque fields are kept', () => {
  const merged = mergeLegacyMenu([], [desktop[1]]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].label, 'Journal');
});

test('malformed or missing legacy documents produce an empty menu', () => {
  assert.deepEqual(mergeLegacyMenu(undefined, undefined), []);
  assert.deepEqual(mergeLegacyMenu('not-an-array', 42), []);
});

test('the merged list is capped at twenty items', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ label: `Item ${i}`, href: `/item-${i}`, columns: [] }));
  assert.equal(mergeLegacyMenu(many, []).length, 20);
});
