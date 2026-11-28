import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navMenuReducer, initialNavMenu } from '../src/lib/nav-menu-machine.ts';
import { tooltipReducer, initialTooltip } from '../src/lib/tooltip-machine.ts';

test('nav menu: click closes a hover-opened menu and suppression blocks immediate rehover', () => {
  let s = navMenuReducer(initialNavMenu, { type: 'ENTER_GROUP', key: 'core' });
  assert.equal(s.kind, 'open');
  s = navMenuReducer(s, { type: 'CLICK_TRIGGER', key: 'core' });
  assert.deepEqual(s, { kind: 'closed', suppressed: 'core' });
  assert.deepEqual(navMenuReducer(s, { type: 'ENTER_GROUP', key: 'core' }), s);
  assert.equal(navMenuReducer(s, { type: 'POINTER_LEAVE' }).kind, 'closed');
});

test('nav menu: leave schedules close, re-enter cancels, escape closes globally', () => {
  let s = navMenuReducer(initialNavMenu, { type: 'ENTER_GROUP', key: 'ops' });
  s = navMenuReducer(s, { type: 'POINTER_LEAVE' });
  assert.equal(s.pendingClose, true);
  s = navMenuReducer(s, { type: 'CANCEL_CLOSE' });
  assert.equal(s.pendingClose, false);
  s = navMenuReducer(s, { type: 'CLOSE_REQUEST' });
  assert.equal(s.kind, 'closing');
  assert.deepEqual(navMenuReducer(s, { type: 'FINALIZE' }), { kind: 'closed', suppressed: null });
  assert.deepEqual(navMenuReducer(s, { type: 'ESCAPE' }), { kind: 'closed', suppressed: 'all' });
});

test('tooltip: hover leaves close, focus and pin survive pointer leave', () => {
  let s = tooltipReducer(initialTooltip, { type: 'SCHEDULE' });
  s = tooltipReducer(s, { type: 'OPEN', reason: 'hover' });
  assert.deepEqual(tooltipReducer(s, { type: 'POINTER_LEAVE' }), { kind: 'hidden' });
  const pinned = tooltipReducer(s, { type: 'CLICK' });
  assert.equal(pinned.reason, 'pin');
  assert.deepEqual(tooltipReducer(pinned, { type: 'POINTER_LEAVE' }), pinned);
  assert.deepEqual(tooltipReducer(pinned, { type: 'CLICK' }), { kind: 'hidden' });
});

test('tooltip: placement only sticks while visible', () => {
  const visible = tooltipReducer(initialTooltip, { type: 'OPEN', reason: 'focus' });
  const placed = tooltipReducer(visible, { type: 'PLACE', placement: { side: 'top', top: 1, left: 2 } });
  assert.deepEqual(placed.placement, { side: 'top', top: 1, left: 2 });
  assert.deepEqual(tooltipReducer({ kind: 'hidden' }, { type: 'PLACE', placement: { side: 'top', top: 1, left: 2 } }), { kind: 'hidden' });
});
