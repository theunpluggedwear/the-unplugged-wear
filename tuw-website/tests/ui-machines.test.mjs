import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseReducer } from '../src/storefront/lib/purchase-machine.ts';
import { navMenuReducer, initialNavMenu } from '../src/storefront/lib/nav-menu-machine.ts';
import { INTRO_PHASES, introFlags, nextIntroPhase } from '../src/storefront/lib/intro-machine.ts';

test('purchase feedback has one active reason', () => {
  assert.deepEqual(purchaseReducer({ kind: 'idle' }, { type: 'ADD' }), { kind: 'added' });
  assert.deepEqual(purchaseReducer({ kind: 'added' }, { type: 'BUY' }), { kind: 'buying' });
  assert.deepEqual(purchaseReducer({ kind: 'buying' }, { type: 'FAIL', message: 'x' }), { kind: 'error', message: 'x' });
  assert.deepEqual(purchaseReducer({ kind: 'error', message: 'x' }, { type: 'RESET' }), { kind: 'idle' });
});

test('storefront nav menu closes on click and suppresses rehover', () => {
  let s = navMenuReducer(initialNavMenu, { type: 'ENTER_GROUP', key: 'Men' });
  assert.equal(s.kind, 'open');
  s = navMenuReducer(s, { type: 'CLICK_TRIGGER', key: 'Men' });
  assert.deepEqual(s, { kind: 'closed', suppressed: 'Men' });
  assert.deepEqual(navMenuReducer(s, { type: 'ENTER_GROUP', key: 'Men' }), s);
  assert.equal(navMenuReducer(s, { type: 'NAVIGATE' }).kind, 'closed');
  assert.deepEqual(navMenuReducer(initialNavMenu, { type: 'NAVIGATE' }), initialNavMenu);
});

test('intro is a linear six-state machine with derived flags', () => {
  assert.deepEqual(INTRO_PHASES, ['staged', 'emblem', 'letters', 'tagline', 'shutter', 'done']);
  assert.equal(nextIntroPhase('tagline'), 'shutter');
  assert.equal(nextIntroPhase('done'), 'done');
  assert.deepEqual(introFlags('staged'), { emblemVisible: false, lettersVisible: false, taglineVisible: false, shutterUp: false, done: false });
  assert.deepEqual(introFlags('shutter'), { emblemVisible: true, lettersVisible: true, taglineVisible: true, shutterUp: true, done: false });
});
