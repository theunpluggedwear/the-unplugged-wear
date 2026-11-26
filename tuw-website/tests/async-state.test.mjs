import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncReducer, initialAsync } from '../src/storefront/lib/async-state.ts';

test('async request follows one valid path', () => {
  let s = asyncReducer(initialAsync, { type: 'START' });
  assert.equal(s.kind, 'loading');
  s = asyncReducer(s, { type: 'SUCCESS', data: { ok: true } });
  assert.deepEqual(s, { kind: 'success', data: { ok: true } });
  assert.deepEqual(asyncReducer(s, { type: 'RESET' }), { kind: 'idle' });
});

test('failure carries a message and cannot coexist with success', () => {
  const failed = asyncReducer({ kind: 'loading' }, { type: 'FAIL', message: 'nope' });
  assert.deepEqual(failed, { kind: 'error', message: 'nope' });
  assert.equal(asyncReducer({ kind: 'success', data: 1 }, { type: 'FAIL', message: 'x' }).kind, 'error');
});
