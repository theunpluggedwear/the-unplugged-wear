import { test } from 'node:test';
import assert from 'node:assert/strict';
import { popoverReducer } from '../src/hooks/usePopoverAnimation.ts';

test('open becomes visible and close starts the exit phase', () => {
  let state = popoverReducer({ phase: 'closed' }, { type: 'OPEN' });
  assert.equal(state.phase, 'open');
  state = popoverReducer(state, { type: 'CLOSE' });
  assert.equal(state.phase, 'closing');
  state = popoverReducer(state, { type: 'EXPIRE' });
  assert.equal(state.phase, 'closed');
});

test('close from closed is a no-op and reopen during closing wins', () => {
  assert.deepEqual(popoverReducer({ phase: 'closed' }, { type: 'CLOSE' }), { phase: 'closed' });
  const closing = popoverReducer({ phase: 'open' }, { type: 'CLOSE' });
  assert.equal(popoverReducer(closing, { type: 'OPEN' }).phase, 'open');
  assert.equal(popoverReducer(closing, { type: 'EXPIRE' }).phase, 'closed');
});
