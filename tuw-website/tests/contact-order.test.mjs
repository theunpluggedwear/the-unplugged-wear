import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiresOrderRef } from '../src/storefront/lib/contact-order.ts';

test('order-related topics require an order reference', () => {
  assert.equal(requiresOrderRef('An order'), true);
  assert.equal(requiresOrderRef('Returns & exchanges'), true);
  assert.equal(requiresOrderRef('order'), true);
  assert.equal(requiresOrderRef(' returns '), true);
});

test('other topics do not require an order reference', () => {
  assert.equal(requiresOrderRef('Size & fit'), false);
  assert.equal(requiresOrderRef('A product'), false);
  assert.equal(requiresOrderRef('Something else'), false);
  assert.equal(requiresOrderRef(''), false);
});
