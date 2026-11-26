import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_STATUSES, ORDER_TRANSITIONS, RETURN_TRANSITIONS,
  normalizeLegacyFulfillment, paymentStatusForProvider,
} from './index.ts';

test('every order status has a transition entry', () => {
  assert.deepEqual(Object.keys(ORDER_TRANSITIONS).sort(), [...ORDER_STATUSES].sort());
  assert.deepEqual(ORDER_TRANSITIONS.delivered, []);
  assert.ok(ORDER_TRANSITIONS.failed.includes('confirmed'));
});

test('return transitions are finite and terminal states stay empty', () => {
  assert.deepEqual(RETURN_TRANSITIONS.completed, []);
  assert.deepEqual(RETURN_TRANSITIONS.cancelled, []);
  assert.ok(RETURN_TRANSITIONS.requested.includes('approved'));
});

test('legacy fulfilment words normalize to SQL vocabulary', () => {
  assert.equal(normalizeLegacyFulfillment('queued'), 'pending');
  assert.equal(normalizeLegacyFulfillment('printing'), 'in_production');
  assert.equal(normalizeLegacyFulfillment('submission_failed'), 'failed');
  assert.equal(normalizeLegacyFulfillment('shipped'), 'shipped');
  assert.equal(normalizeLegacyFulfillment('nonsense'), null);
});

test('provider payment states collapse into order payment states', () => {
  assert.equal(paymentStatusForProvider('captured'), 'paid');
  assert.equal(paymentStatusForProvider('authorized'), 'paid');
  assert.equal(paymentStatusForProvider('refunded'), 'refunded');
});
