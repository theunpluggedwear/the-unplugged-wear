import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explore } from './state-machine-explorer.test.mjs';
import { navMenuReducer, initialNavMenu } from '../src/lib/nav-menu-machine.ts';
import { tooltipReducer, initialTooltip } from '../src/lib/tooltip-machine.ts';
import {
  editorReducer, initialEditorState, isEditorOpen,
} from '../src/app/(dashboard)/products/_components/editor/editorMachine.ts';
import {
  asyncReducer, initialAsyncState, isAsyncBusy, isAsyncRequestPending,
} from '../src/app/(dashboard)/products/_components/editor/asyncMachine.ts';
import {
  importReducer, initialImportState, isImportCancelRequested,
} from '../src/app/(dashboard)/products/_components/editor/importMachine.ts';

function reachable(initial, rules, predicate) {
  const hits = [];
  const result = explore(initial, rules, (state) => {
    if (predicate(state)) hits.push(state);
    return true;
  });
  assert.equal(result.ok, true);
  return hits;
}

const navRules = [
  { name: 'ENTER_GROUP', next: (s) => ['core', 'ops'].map((key) => navMenuReducer(s, { type: 'ENTER_GROUP', key })) },
  { name: 'CLICK_TRIGGER', next: (s) => ['core', 'ops'].map((key) => navMenuReducer(s, { type: 'CLICK_TRIGGER', key })) },
  { name: 'POINTER_LEAVE', next: (s) => [navMenuReducer(s, { type: 'POINTER_LEAVE' })] },
  { name: 'CLOSE_REQUEST', next: (s) => [navMenuReducer(s, { type: 'CLOSE_REQUEST' })] },
  { name: 'FINALIZE', next: (s) => [navMenuReducer(s, { type: 'FINALIZE' })] },
  { name: 'CANCEL_CLOSE', next: (s) => [navMenuReducer(s, { type: 'CANCEL_CLOSE' })] },
  { name: 'ESCAPE', next: (s) => [navMenuReducer(s, { type: 'ESCAPE' })] },
  { name: 'NAVIGATE', next: (s) => [navMenuReducer(s, { type: 'NAVIGATE' })] },
  { name: 'RESET_SUPPRESSION', next: (s) => [navMenuReducer(s, { type: 'RESET_SUPPRESSION' })] },
];

test('nav menu: suppression always escapes and an open menu can always finish closing', () => {
  const suppressed = navMenuReducer(
    navMenuReducer(initialNavMenu, { type: 'ENTER_GROUP', key: 'core' }),
    { type: 'ESCAPE' },
  );
  assert.deepEqual(suppressed, { kind: 'closed', suppressed: 'all' });

  const result = explore(suppressed, navRules, (s) => {
    if (s.kind === 'closed' && s.suppressed !== null
      && navMenuReducer(s, { type: 'RESET_SUPPRESSION' }).suppressed !== null) return false;
    if (s.kind === 'open' && navMenuReducer(s, { type: 'FINALIZE' }).kind !== 'open') return false;
    if (s.kind === 'closing' && navMenuReducer(s, { type: 'FINALIZE' }).kind !== 'closed') return false;
    return true;
  });
  assert.equal(result.ok, true);
  assert.equal(result.exhaustive, true);
  assert.ok(reachable(suppressed, navRules, (s) => s.kind === 'closed' && s.suppressed === null).length > 0);

  const open = navMenuReducer(initialNavMenu, { type: 'ENTER_GROUP', key: 'ops' });
  assert.ok(reachable(open, navRules, (s) => s.kind === 'closed').length > 0);
  assert.ok(reachable(open, navRules, (s) => s.kind === 'closing').length > 0);
});

const tooltipInit = { machine: initialTooltip, timer: false, left: false, over: false };
const tooltipRules = [
  {
    name: 'SCHEDULE',
    next: (s) => {
      if (s.over) return [];
      const machine = tooltipReducer(s.machine, { type: 'SCHEDULE' });
      return machine === s.machine ? [] : [{ machine, timer: true, left: false, over: true }];
    },
  },
  {
    name: 'POINTER_LEAVE',
    next: (s) => {
      const wasScheduled = s.machine.kind === 'scheduled';
      return [{
        machine: tooltipReducer(s.machine, { type: 'POINTER_LEAVE' }),
        timer: wasScheduled ? false : s.timer,
        left: wasScheduled ? true : false,
        over: false,
      }];
    },
  },
  {
    name: 'TIMER_FIRE',
    next: (s) => (s.timer && s.machine.kind === 'scheduled'
      ? [{ machine: tooltipReducer(s.machine, { type: 'OPEN', reason: 'hover' }), timer: false, left: s.left, over: s.over }]
      : []),
  },
  {
    name: 'HIDE',
    next: (s) => [{ machine: tooltipReducer(s.machine, { type: 'HIDE' }), timer: false, left: s.left, over: s.over }],
  },
  {
    name: 'BLUR',
    next: (s) => [{ machine: tooltipReducer(s.machine, { type: 'BLUR' }), timer: s.timer, left: s.left, over: s.over }],
  },
  {
    name: 'CLICK',
    next: (s) => (s.over
      ? [{ machine: tooltipReducer(s.machine, { type: 'CLICK' }), timer: s.timer, left: s.left, over: s.over }]
      : []),
  },
];

test('tooltip: SCHEDULE -> POINTER_LEAVE -> TIMER_FIRE can no longer show a ghost tooltip', () => {
  const result = explore(tooltipInit, tooltipRules, (s) => !(s.left && s.machine.kind === 'visible'));
  assert.equal(result.ok, true);
  assert.equal(result.exhaustive, true);
  assert.deepEqual(reachable(tooltipInit, tooltipRules, (s) => s.left && s.machine.kind === 'visible'), []);

  let model = { machine: tooltipReducer(initialTooltip, { type: 'SCHEDULE' }), timer: true, left: false, over: true };
  model = tooltipRules[1].next(model)[0];
  assert.equal(model.machine.kind, 'hidden');
  assert.equal(model.timer, false);
  assert.deepEqual(tooltipRules[2].next(model), []);
});

const editorStep = (state, action) => {
  const next = editorReducer(state, action);
  return next === state ? state : { ...next, sequence: next.sequence % 4 };
};

const editorRules = [
  {
    name: 'OPEN_CREATE',
    next: (m) => {
      const state = editorStep(m.state, { type: 'OPEN_CREATE' });
      return state === m.state ? [] : [{ state, started: null }];
    },
  },
  {
    name: 'OPEN_EDIT_START',
    next: (m) => {
      const sequence = (m.state.sequence + 1) % 4;
      const state = editorStep(m.state, { type: 'OPEN_EDIT_START', id: 'p1', sequence });
      return state === m.state ? [] : [{ state, started: { id: 'p1', sequence } }];
    },
  },
  {
    name: 'OPEN_EDIT_DONE',
    next: (m) => [{
      state: editorStep(m.state, {
        type: 'OPEN_EDIT_DONE',
        product: { id: 'p1', name: 'Demo' },
        sequence: m.started?.sequence ?? m.state.sequence,
      }),
      started: m.started,
    }],
  },
  {
    name: 'OPEN_EDIT_DONE_STALE',
    next: (m) => [{
      state: editorStep(m.state, { type: 'OPEN_EDIT_DONE', product: { id: 'p1', name: 'Demo' }, sequence: 0 }),
      started: m.started,
    }],
  },
  {
    name: 'CLOSE',
    next: (m) => [{ state: editorStep(m.state, { type: 'CLOSE' }), started: null }],
  },
  {
    name: 'PATCH_EDIT_PRODUCT',
    next: (m) => [{ ...m, state: editorStep(m.state, { type: 'PATCH_EDIT_PRODUCT', patch: { publicationStatus: 'published' } }) }],
  },
];

test('editor: stale loads cannot open or patch the drawer', () => {
  const result = explore({ state: initialEditorState, started: null }, editorRules, (m) => {
    if (m.state.status === 'opening' && m.started && m.state.id !== m.started.id) return false;
    if (m.state.status === 'edit' && m.started && m.state.product.id !== m.started.id) return false;
    if (m.state.status === 'edit' && m.started && m.state.sequence !== m.started.sequence) return false;
    return true;
  });
  assert.equal(result.ok, true);
  assert.equal(result.exhaustive, true);

  const opening = editorReducer(initialEditorState, { type: 'OPEN_EDIT_START', id: 'p1', sequence: 1 });
  assert.equal(editorReducer(initialEditorState, { type: 'OPEN_CREATE' }).status, 'create');
  assert.equal(editorReducer(editorReducer(initialEditorState, { type: 'OPEN_CREATE' }), { type: 'OPEN_EDIT_START', id: 'p1' }).status, 'create');
  assert.equal(editorReducer(opening, { type: 'OPEN_EDIT_DONE', product: { id: 'p2' }, sequence: 1 }).status, 'opening');
  assert.equal(editorReducer(opening, { type: 'OPEN_EDIT_DONE', product: { id: 'p1' }, sequence: 2 }).status, 'opening');
  const closed = editorReducer(opening, { type: 'CLOSE' });
  assert.equal(editorReducer(closed, { type: 'OPEN_EDIT_DONE', product: { id: 'p1' }, sequence: 1 }).status, 'closed');
  assert.equal(isEditorOpen(editorReducer(opening, { type: 'PATCH_EDIT_PRODUCT', patch: {} })), false);
});

const asyncRules = [
  { name: 'START', next: (s) => [1, 2, 3].map((id) => asyncReducer(s, { type: 'START', action: 'update', id })) },
  { name: 'FINISH_1', next: (s) => [asyncReducer(s, { type: 'FINISH', id: 1 })] },
  { name: 'FINISH_2', next: (s) => [asyncReducer(s, { type: 'FINISH', id: 2 })] },
  { name: 'FINISH_3', next: (s) => [asyncReducer(s, { type: 'FINISH', id: 3 })] },
  { name: 'FINISH_ALL', next: (s) => [asyncReducer(s, { type: 'FINISH' })] },
];

test('async: one FINISH cannot clear another request that is still running', () => {
  const result = explore(initialAsyncState, asyncRules, (s) => {
    if (s.kind === 'idle' && s.pending.length !== 0) return false;
    if (s.kind === 'busy' && s.pending.length === 0) return false;
    return true;
  });
  assert.equal(result.ok, true);
  assert.equal(result.exhaustive, true);

  let state = asyncReducer(initialAsyncState, { type: 'START', action: 'create', id: 1 });
  state = asyncReducer(state, { type: 'START', action: 'bulk-delete', id: 2 });
  const afterFirst = asyncReducer(state, { type: 'FINISH', id: 1 });
  assert.equal(isAsyncBusy(afterFirst), true);
  assert.deepEqual([...afterFirst.pending], [2]);
  assert.equal(isAsyncRequestPending(afterFirst, 1), false);
  assert.equal(isAsyncBusy(asyncReducer(afterFirst, { type: 'FINISH', id: 2 })), false);
});

const preview = { fileName: 'list.csv', groups: [], listing: [], errors: [], hasCategoryColumn: true };
const importRules = [
  { name: 'SHOW_PREVIEW', next: (s) => [importReducer(s, { type: 'SHOW_PREVIEW', preview })] },
  { name: 'START_IMPORT', next: (s) => [importReducer(s, { type: 'START_IMPORT' })] },
  { name: 'FINISH_IMPORT', next: (s) => [importReducer(s, { type: 'FINISH_IMPORT' })] },
  { name: 'CANCEL', next: (s) => [importReducer(s, { type: 'CANCEL' })] },
];

test('import: preview stays closed during import and a cancelled import finishes idle', () => {
  const result = explore(initialImportState, importRules, (s) => {
    if (s.status === 'importing' && importReducer(s, { type: 'SHOW_PREVIEW', preview }).status !== 'importing') return false;
    if (isImportCancelRequested(s) && importReducer(s, { type: 'FINISH_IMPORT' }).status !== 'idle') return false;
    return true;
  });
  assert.equal(result.ok, true);
  assert.equal(result.exhaustive, true);

  const shown = importReducer(initialImportState, { type: 'SHOW_PREVIEW', preview });
  const importing = importReducer(shown, { type: 'START_IMPORT' });
  assert.equal(importReducer(importing, { type: 'SHOW_PREVIEW', preview }), importing);
  const cancelled = importReducer(importing, { type: 'CANCEL' });
  assert.equal(isImportCancelRequested(cancelled), true);
  assert.equal(importReducer(cancelled, { type: 'FINISH_IMPORT' }).status, 'idle');
  assert.ok(reachable(initialImportState, importRules, (s) => s.status === 'idle' && importReducer(s, { type: 'FINISH_IMPORT' }) === s).length > 0);
});
