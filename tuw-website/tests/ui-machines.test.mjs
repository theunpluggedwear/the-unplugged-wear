import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseReducer } from '../src/storefront/lib/purchase-machine.ts';
import { INTRO_PHASES, introFlags, nextIntroPhase } from '../src/storefront/lib/intro-machine.ts';

test('purchase feedback has one active reason', () => {
  assert.deepEqual(purchaseReducer({ kind: 'idle' }, { type: 'ADD' }), { kind: 'added' });
  assert.deepEqual(purchaseReducer({ kind: 'added' }, { type: 'BUY' }), { kind: 'buying' });
  assert.deepEqual(purchaseReducer({ kind: 'buying' }, { type: 'FAIL', message: 'x' }), { kind: 'error', message: 'x' });
  assert.deepEqual(purchaseReducer({ kind: 'error', message: 'x' }, { type: 'RESET' }), { kind: 'idle' });
});

test('intro is a linear six-state machine with derived flags', () => {
  assert.deepEqual(INTRO_PHASES, ['staged', 'emblem', 'letters', 'tagline', 'shutter', 'done']);
  assert.equal(nextIntroPhase('tagline'), 'shutter');
  assert.equal(nextIntroPhase('done'), 'done');
  assert.deepEqual(introFlags('staged'), { emblemVisible: false, lettersVisible: false, taglineVisible: false, shutterUp: false, done: false });
  assert.deepEqual(introFlags('shutter'), { emblemVisible: true, lettersVisible: true, taglineVisible: true, shutterUp: true, done: false });
});
