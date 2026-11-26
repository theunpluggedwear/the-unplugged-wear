import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placementReducer, initialPlacement } from '../src/storefront/lib/checkout-machine.ts';

test('placement cannot start twice while creating or awaiting the gateway', () => {
  let s = placementReducer(initialPlacement, { type: 'START' });
  assert.equal(s.kind, 'creating');
  assert.deepEqual(placementReducer(s, { type: 'START' }), s);
  s = placementReducer(s, { type: 'GATEWAY', orderNumber: 'T-1', receipt: 'r' });
  assert.equal(s.kind, 'awaiting_gateway');
  assert.deepEqual(placementReducer(s, { type: 'START' }), s);
});

test('retryable and failed states carry one message and reset to idle', () => {
  const retryable = placementReducer({ kind: 'creating' }, { type: 'RETRYABLE', message: 'try again' });
  assert.deepEqual(retryable, { kind: 'retryable', message: 'try again' });
  const failed = placementReducer({ kind: 'creating' }, { type: 'FAIL', message: 'nope' });
  assert.deepEqual(failed, { kind: 'failed', message: 'nope' });
  assert.deepEqual(placementReducer(failed, { type: 'RESET' }), initialPlacement);
});

test('placed is only reachable from creating', () => {
  assert.equal(placementReducer({ kind: 'creating' }, { type: 'PLACED' }).kind, 'placed');
  assert.deepEqual(placementReducer({ kind: 'retryable', message: 'x' }, { type: 'PLACED' }), { kind: 'retryable', message: 'x' });
});
