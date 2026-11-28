import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeLegacyMenu, sanitizeMenu } from '../../packages/heart/src/modules/content/menu-merge.ts';

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

test('sanitizeMenu keeps valid rows and drops only the invalid one', () => {
  const result = sanitizeMenu([
    { label: '', href: '/broken', columns: [] },
    { label: 'Valid', href: '/valid', columns: [{ title: 'Group', links: [{ label: 'Good', href: '/good' }] }] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'Valid');
  assert.equal(result[0].columns[0].links[0].href, '/good');
});

test('sanitizeMenu caps fields, drops bad children and preserves opaque metadata', () => {
  const result = sanitizeMenu([{
    label: 'Shop', href: '/shop',
    columns: [
      { title: 'Group', links: [
        { label: 'Good', href: '/good', filter: { category: 'hoodies' } },
        { label: '', href: '/bad' },
      ] },
      { title: '', links: [] },
    ],
    features: [{ productSlug: 'hoodie', imagePosition: '50% 0%' }, {}],
    shopAll: { label: 'All', href: '/all', filter: { audience: 'all' } },
  }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].columns.length, 1);
  assert.equal(result[0].columns[0].links.length, 1);
  assert.deepEqual(result[0].columns[0].links[0].filter, { category: 'hoodies' });
  assert.equal(result[0].features.length, 1);
  assert.equal(result[0].features[0].imagePosition, '50% 0%');
  assert.deepEqual(result[0].shopAll.filter, { audience: 'all' });
});

test('sanitizeMenu accepts over-cap data by clamping to the schema limits', () => {
  const result = sanitizeMenu(Array.from({ length: 25 }, (_, i) => ({ label: `Item ${i}`, href: `/i/${i}`, columns: [] })));
  assert.equal(result.length, 20);
  assert.deepEqual(sanitizeMenu('not-an-array'), []);
});

test('the merged list is capped at twenty items', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ label: `Item ${i}`, href: `/item-${i}`, columns: [] }));
  assert.equal(mergeLegacyMenu(many, []).length, 20);
});
