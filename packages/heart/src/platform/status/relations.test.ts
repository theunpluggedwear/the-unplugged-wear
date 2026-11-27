import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_TRANSITIONS, canTransitionOrder, ORDER_PAYMENT_TRANSITIONS,
  canTransitionOrderPayment, REFUND_TRANSITIONS, canTransitionRefund,
  ORDER_STATUSES, ORDER_PAYMENT_STATUSES,
} from './index.ts';

test('order status relation is total and has terminal states', () => {
  for (const status of ORDER_STATUSES) {
    assert.ok(Array.isArray(ORDER_TRANSITIONS[status]));
    for (const next of ORDER_TRANSITIONS[status]) {
      assert.ok(ORDER_STATUSES.includes(next));
      assert.equal(canTransitionOrder(status, next), true);
    }
  }
  assert.deepEqual(ORDER_TRANSITIONS.delivered, []);
  assert.deepEqual(ORDER_TRANSITIONS.cancelled, []);
  assert.deepEqual(ORDER_TRANSITIONS.refunded, []);
  assert.equal(canTransitionOrder('delivered', 'cancelled'), false);
  assert.equal(canTransitionOrder('failed', 'confirmed'), true);
});

test('payment status relation never reopens a settled payment', () => {
  for (const status of ORDER_PAYMENT_STATUSES) {
    assert.ok(Array.isArray(ORDER_PAYMENT_TRANSITIONS[status]));
  }
  assert.deepEqual(ORDER_PAYMENT_TRANSITIONS.failed, []);
  assert.deepEqual(ORDER_PAYMENT_TRANSITIONS.refunded, []);
  assert.equal(canTransitionOrderPayment('paid', 'refunded'), true);
  assert.equal(canTransitionOrderPayment('paid', 'pending'), false);
});

test('refund terminal states cannot regress', () => {
  assert.deepEqual(REFUND_TRANSITIONS.completed, []);
  assert.equal(canTransitionRefund('completed', 'rejected'), false);
  assert.equal(canTransitionRefund('rejected', 'completed'), true);
  assert.equal(canTransitionRefund('processing', 'completed'), true);
});
