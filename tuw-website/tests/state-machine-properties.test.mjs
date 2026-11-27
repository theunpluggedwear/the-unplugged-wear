import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { navMenuReducer, initialNavMenu } from '../src/storefront/lib/nav-menu-machine.ts';
import { personalizationReducer, initialPersonalizationState } from '../src/storefront/plugins/personalization/personalization-machine.ts';
import { placementReducer, initialPlacement } from '../src/storefront/lib/checkout-machine.ts';
import { purchaseReducer } from '../src/storefront/lib/purchase-machine.ts';

const key = (state) => JSON.stringify(state);

function reachable(initial, rules) {
  const seen = new Map([[key(initial), initial]]);
  const queue = [initial];
  while (queue.length) {
    const state = queue.shift();
    for (const rule of rules) {
      for (const next of rule.next(state)) {
        if (seen.has(key(next))) continue;
        seen.set(key(next), next);
        queue.push(next);
      }
    }
  }
  return [...seen.values()];
}

function canReach(initial, rules, matches) {
  const seen = new Set([key(initial)]);
  const queue = [initial];
  while (queue.length) {
    const state = queue.shift();
    if (matches(state)) return true;
    for (const rule of rules) {
      for (const next of rule.next(state)) {
        if (seen.has(key(next))) continue;
        seen.add(key(next));
        queue.push(next);
      }
    }
  }
  return false;
}

const navRules = [
  { name: 'ENTER_GROUP', next: (s) => ['Shop', 'Men'].map((k) => navMenuReducer(s, { type: 'ENTER_GROUP', key: k })) },
  { name: 'CLICK_TRIGGER', next: (s) => ['Shop', 'Men'].map((k) => navMenuReducer(s, { type: 'CLICK_TRIGGER', key: k })) },
  { name: 'POINTER_LEAVE', next: (s) => [navMenuReducer(s, { type: 'POINTER_LEAVE' })] },
  { name: 'CANCEL_CLOSE', next: (s) => [navMenuReducer(s, { type: 'CANCEL_CLOSE' })] },
  { name: 'CLOSE_REQUEST', next: (s) => [navMenuReducer(s, { type: 'CLOSE_REQUEST' })] },
  { name: 'FINALIZE', next: (s) => [navMenuReducer(s, { type: 'FINALIZE' })] },
  { name: 'ESCAPE', next: (s) => [navMenuReducer(s, { type: 'ESCAPE' })] },
  { name: 'NAVIGATE', next: (s) => [navMenuReducer(s, { type: 'NAVIGATE' })] },
  { name: 'RESET_SUPPRESSION', next: (s) => [navMenuReducer(s, { type: 'RESET_SUPPRESSION' })] },
];

describe('nav menu state machine properties', () => {
  test('no reachable state keeps permanent suppression', () => {
    const states = reachable(initialNavMenu, navRules);
    assert.ok(states.length > 4, `expected a non-trivial reachable space, got ${states.length}`);
    for (const state of states) {
      assert.notEqual(state.suppressed, 'all', `permanent suppression in ${key(state)}`);
    }
  });

  test('every reachable state can eventually close (liveness)', () => {
    for (const state of reachable(initialNavMenu, navRules)) {
      assert.equal(canReach(state, navRules, (s) => s.kind === 'closed'), true, `stuck in ${key(state)}`);
    }
  });

  test('hover-out finishes, cancels on re-entry, and the next hover opens', () => {
    let state = navMenuReducer(initialNavMenu, { type: 'ENTER_GROUP', key: 'Shop' });
    state = navMenuReducer(state, { type: 'POINTER_LEAVE' });
    assert.equal(state.pendingClose, true);
    assert.deepEqual(navMenuReducer(state, { type: 'CANCEL_CLOSE' }), { ...state, pendingClose: false });
    state = navMenuReducer(state, { type: 'FINALIZE' });
    assert.deepEqual(state, { kind: 'closed', suppressed: null });
    assert.equal(navMenuReducer(state, { type: 'ENTER_GROUP', key: 'Men' }).kind, 'open');
  });

  test('click suppression is reachable and resettable', () => {
    let state = navMenuReducer(initialNavMenu, { type: 'CLICK_TRIGGER', key: 'Shop' });
    assert.deepEqual(state, { kind: 'open', key: 'Shop', source: 'click', pendingClose: false, suppressed: null });
    state = navMenuReducer(state, { type: 'CLICK_TRIGGER', key: 'Shop' });
    assert.deepEqual(state, { kind: 'closed', suppressed: 'Shop' });
    assert.deepEqual(navMenuReducer(state, { type: 'ENTER_GROUP', key: 'Shop' }), state);
    assert.deepEqual(navMenuReducer(state, { type: 'RESET_SUPPRESSION' }), { kind: 'closed', suppressed: null });
    assert.equal(navMenuReducer(state, { type: 'NAVIGATE' }).suppressed, null);
  });
});

const personalizationRules = [
  { name: 'ENABLE', next: (s) => [personalizationReducer(s, { type: 'ENABLE' })] },
  { name: 'SET_MONOGRAM', next: (s) => ['A', 'AB'].map((value) => personalizationReducer(s, { type: 'SET_MONOGRAM', value })) },
  { name: 'SET_PLACEMENT', next: (s) => ['Front', 'Back'].map((value) => personalizationReducer(s, { type: 'SET_PLACEMENT', value })) },
  { name: 'INVALID', next: (s) => [personalizationReducer(s, { type: 'INVALID', message: 'bad' })] },
  { name: 'RENDER', next: (s) => [personalizationReducer(s, { type: 'RENDER', previewUrl: '/p' })] },
  { name: 'ADD', next: (s) => [personalizationReducer(s, { type: 'ADD' })] },
  { name: 'APPROVED', next: (s) => [personalizationReducer(s, { type: 'APPROVED', lineId: 'line-1' })] },
  { name: 'FAIL', next: (s) => [personalizationReducer(s, { type: 'FAIL', message: 'fail' })] },
  { name: 'RESET', next: (s) => [personalizationReducer(s, { type: 'RESET' })] },
];

describe('personalization state machine properties', () => {
  test('RESET returns to inactive from every reachable state', () => {
    for (const state of reachable(initialPersonalizationState, personalizationRules)) {
      assert.deepEqual(personalizationReducer(state, { type: 'RESET' }), { kind: 'inactive' }, `stuck in ${key(state)}`);
    }
  });

  test('APPROVED is guarded to adding and cannot regress', () => {
    for (const state of reachable(initialPersonalizationState, personalizationRules)) {
      const next = personalizationReducer(state, { type: 'APPROVED', lineId: 'line-1' });
      if (state.kind === 'adding') {
        assert.deepEqual(next, { kind: 'approved', lineId: 'line-1' });
      } else {
        assert.deepEqual(next, state, `approval regressed from ${key(state)}`);
      }
    }
  });

  test('editing inputs and validation stay live from error', () => {
    const error = { kind: 'error', monogram: 'UK', placement: 'Front', previewUrl: '/p', message: 'fail' };
    assert.deepEqual(personalizationReducer(error, { type: 'SET_MONOGRAM', value: 'A' }), { kind: 'editing', monogram: 'A', placement: 'Front', error: null });
    assert.deepEqual(personalizationReducer(error, { type: 'SET_PLACEMENT', value: 'Back' }), { kind: 'editing', monogram: 'UK', placement: 'Back', error: null });
    assert.equal(personalizationReducer(error, { type: 'INVALID', message: 'bad' }).message, 'bad');
    assert.equal(personalizationReducer(error, { type: 'RENDER', previewUrl: '/p2' }).kind, 'previewing');
  });
});

const placementEvents = [
  { type: 'START' },
  { type: 'GATEWAY', orderNumber: 'T-1', receipt: 'r' },
  { type: 'RETRYABLE', message: 'retry' },
  { type: 'FAIL', message: 'fail' },
  { type: 'PLACED' },
  { type: 'RESET' },
];

describe('checkout placement state machine properties', () => {
  test('placed is absorbing under every event', () => {
    const placed = { kind: 'placed' };
    for (const event of placementEvents) {
      assert.deepEqual(placementReducer(placed, event), placed, `regressed on ${event.type}`);
    }
  });

  test('RETRYABLE, FAIL and RESET cannot fire from idle or placed', () => {
    for (const state of [initialPlacement, { kind: 'placed' }]) {
      for (const type of ['RETRYABLE', 'FAIL', 'RESET']) {
        assert.deepEqual(placementReducer(state, { type, message: 'x' }), state);
      }
    }
  });
});

describe('purchase feedback state machine properties', () => {
  test('buy rejection reaches a visible error from buying', () => {
    const buying = purchaseReducer({ kind: 'idle' }, { type: 'BUY' });
    const failed = purchaseReducer(buying, { type: 'FAIL', message: 'declined' });
    assert.deepEqual(failed, { kind: 'error', message: 'declined' });
    assert.equal(purchaseReducer(buying, { type: 'RESET' }).kind, 'error');
  });

  test('a new purchase resets the error and can be retried', () => {
    const error = { kind: 'error', message: 'declined' };
    assert.deepEqual(purchaseReducer(error, { type: 'RESET' }), { kind: 'idle' });
    assert.deepEqual(purchaseReducer(error, { type: 'BUY' }), { kind: 'buying' });
  });
});
