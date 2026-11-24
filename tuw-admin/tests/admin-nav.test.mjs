import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_GROUPS,
  getActiveGroupForPath,
  visibleFooterItems,
  visibleNavGroups,
} from '../src/lib/admin-nav.ts';

test('all four sections are defined with reachable items', () => {
  assert.deepEqual(NAV_GROUPS.map((group) => group.key), ['core', 'operations', 'merchandise', 'system']);
  assert.ok(NAV_GROUPS.every((group) => group.items.length > 0));
  assert.equal(new Set(NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href))).size,
    NAV_GROUPS.flatMap((group) => group.items).length);
});

test('permission filtering hides unavailable links and empty sections', () => {
  const groups = visibleNavGroups(['order.view']);
  assert.deepEqual(groups.map((group) => group.key), ['core', 'operations', 'merchandise']);
  assert.deepEqual(groups[0].items.map((item) => item.label), ['Dashboard', 'Orders', 'Products']);
  assert.deepEqual(groups[2].items.map((item) => item.label), ['Collections']);
  assert.deepEqual(visibleNavGroups([]).map((group) => group.key), ['core', 'merchandise']);
  assert.equal(visibleFooterItems([]).length, 1);
});

test('active group resolves from the current path', () => {
  assert.equal(getActiveGroupForPath('/dashboard'), 'core');
  assert.equal(getActiveGroupForPath('/products/categories'), 'core');
  assert.equal(getActiveGroupForPath('/shipments'), 'operations');
  assert.equal(getActiveGroupForPath('/content/navigation'), 'merchandise');
  assert.equal(getActiveGroupForPath('/notifications'), 'system');
  assert.equal(getActiveGroupForPath('/unknown'), null);
});
