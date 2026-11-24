import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_CAPS,
  getAtPath,
  moveWithinArray,
  patchAtPath,
  toRows,
  visibleRows,
} from '../src/lib/navigation-matrix.ts';

const mobile = [
  {
    label: 'Shop',
    href: '/shop',
    columns: [
      {
        title: 'Clothing',
        links: [
          { label: 'Hoodies', href: '/shop/hoodies' },
          { label: 'Tees', href: '/shop/tees' },
        ],
      },
      { title: 'Help', links: [{ label: 'Shipping', href: '/policies/shipping' }] },
    ],
  },
  { label: 'About', href: '/about', columns: [] },
];

const desktop = [
  {
    label: 'Men',
    href: '/shop?audience=men',
    columns: [
      {
        title: 'Clothing',
        links: [{ label: 'Hoodies', href: '/shop?audience=men&category=hoodies', filter: { audience: 'men' } }],
      },
    ],
    features: [{ productSlug: 'everyday-pullover-hoodie', title: 'Pullover' }],
    shopAll: { label: 'Shop all men', href: '/shop?audience=men', filter: { audience: 'men' } },
  },
];

test('toRows builds a three-level tree with capacities and parent links', () => {
  const rows = toRows(mobile);
  assert.equal(rows.length, 7);
  assert.equal(rows[0].kind, 'item');
  assert.equal(rows[0].capacity.used, 2);
  assert.equal(rows[0].capacity.max, NAV_CAPS.columns);
  assert.equal(rows[1].kind, 'column');
  assert.equal(rows[1].depth, 1);
  assert.equal(rows[1].parentId, '0');
  assert.equal(rows[2].kind, 'link');
  assert.equal(rows[2].depth, 2);
  assert.equal(rows[2].parentId, '0.c0');
  assert.equal(rows[2].path.join('.'), '0.columns.0.links.0');
});

test('toRows keeps desktop feature and shop-all rows without dropping opaque filters', () => {
  const rows = toRows(desktop);
  assert.deepEqual(rows.map((r) => r.kind), ['item', 'column', 'link', 'feature', 'shopAll']);
  assert.equal(rows[2].meta, 'Shop filter preserved');
  assert.equal(rows[3].meta, 'Desktop header only · other fields preserved');
  assert.equal(rows[4].href, '/shop?audience=men');
  assert.equal(rows[0].capacity.max, NAV_CAPS.columns);
  assert.equal(rows[1].capacity.max, NAV_CAPS.links);
});

test('visibleRows keeps ancestors of a cross-level match', () => {
  const rows = toRows(mobile);
  const result = visibleRows(rows, 'shipping', new Set());
  assert.deepEqual(result.rows.map((r) => r.id), ['0', '0.c1', '0.c1.l0']);
  assert.equal(result.matches, 1);
});

test('visibleRows matches labels at every level and honours collapse when not searching', () => {
  const rows = toRows(mobile);
  assert.deepEqual(visibleRows(rows, 'hoodies', new Set()).rows.map((r) => r.id), ['0', '0.c0', '0.c0.l0']);
  const collapsed = visibleRows(rows, '', new Set(['0']));
  assert.deepEqual(collapsed.rows.map((r) => r.id), ['0', '1']);
  assert.equal(collapsed.matches, rows.length);
});

test('patchAtPath is immutable and preserves sibling metadata', () => {
  const original = structuredClone(desktop);
  const next = patchAtPath(desktop, [0, 'columns', 0, 'links', 0], (link) => ({ ...link, label: 'Sweats' }));
  assert.equal(next[0].columns[0].links[0].label, 'Sweats');
  assert.deepEqual(next[0].columns[0].links[0].filter, { audience: 'men' });
  assert.deepEqual(next[0].features, original[0].features);
  assert.equal(original[0].columns[0].links[0].label, 'Hoodies');
  assert.equal(getAtPath(next, [0, 'shopAll', 'label']), 'Shop all men');
});

test('moveWithinArray swaps neighbours and is a no-op at the bounds', () => {
  assert.deepEqual(moveWithinArray([1, 2, 3], 0, 1), [2, 1, 3]);
  assert.deepEqual(moveWithinArray([1, 2, 3], 0, -1), [1, 2, 3]);
  assert.deepEqual(moveWithinArray([1, 2, 3], 2, 1), [1, 2, 3]);
});
