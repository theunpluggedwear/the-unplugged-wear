import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  editorReducer, initialEditorState, isEditorOpen, editorProduct,
  editorIsCreating, editorOpeningId,
} from '../src/app/(dashboard)/products/_components/editor/editorMachine.ts';
import {
  asyncReducer, initialAsyncState, isAsyncBusy,
} from '../src/app/(dashboard)/products/_components/editor/asyncMachine.ts';

const product = { id: 'p1', name: 'Demo', publicationStatus: 'draft' };

test('opening state exists but keeps the drawer closed', () => {
  const opening = editorReducer(initialEditorState, { type: 'OPEN_EDIT_START', id: 'p1' });
  assert.equal(opening.status, 'opening');
  assert.equal(editorOpeningId(opening), 'p1');
  assert.equal(isEditorOpen(opening), false);
  assert.equal(editorProduct(opening), null);
  assert.equal(editorIsCreating(opening), false);
});

test('create and edit transitions expose the previous boolean flags', () => {
  const create = editorReducer(initialEditorState, { type: 'OPEN_CREATE' });
  assert.equal(isEditorOpen(create), true);
  assert.equal(editorIsCreating(create), true);
  assert.equal(editorProduct(create), null);

  const edit = editorReducer(create, { type: 'OPEN_EDIT_DONE', product });
  assert.equal(isEditorOpen(edit), true);
  assert.equal(editorIsCreating(edit), false);
  assert.equal(editorProduct(edit), product);
});

test('failed load returns to closed and a second open while opening is ignored by guard', () => {
  const opening = editorReducer(initialEditorState, { type: 'OPEN_EDIT_START', id: 'p1' });
  assert.equal(editorReducer(opening, { type: 'OPEN_EDIT_FAIL' }).status, 'closed');
  const reopened = editorReducer(opening, { type: 'OPEN_EDIT_START', id: 'p2' });
  assert.equal(editorOpeningId(reopened), 'p2');
});

test('close and bulk status patch preserve state shape', () => {
  const edit = editorReducer(initialEditorState, { type: 'OPEN_EDIT_DONE', product });
  const patched = editorReducer(edit, { type: 'PATCH_EDIT_PRODUCT', patch: { publicationStatus: 'published' } });
  assert.equal(editorProduct(patched).publicationStatus, 'published');
  assert.equal(editorReducer(patched, { type: 'PATCH_EDIT_PRODUCT', patch: {} }).status, 'edit');
  assert.equal(editorReducer(initialEditorState, { type: 'PATCH_EDIT_PRODUCT', patch: {} }).status, 'closed');
  assert.equal(editorReducer(patched, { type: 'CLOSE' }).status, 'closed');
});

test('open-create after an in-flight edit removes creating state', () => {
  const opening = editorReducer(initialEditorState, { type: 'OPEN_EDIT_START', id: 'p1' });
  const create = editorReducer(opening, { type: 'OPEN_CREATE' });
  assert.equal(editorIsCreating(create), true);
  assert.equal(editorOpeningId(create), null);
});

test('async machine records which save action is busy and always returns to idle', () => {
  for (const action of ['create', 'update', 'bulk-status', 'bulk-delete']) {
    const busy = asyncReducer(initialAsyncState, { type: 'START', action });
    assert.equal(isAsyncBusy(busy), true);
    assert.equal(busy.action, action);
    assert.equal(isAsyncBusy(asyncReducer(busy, { type: 'FINISH' })), false);
  }
  assert.equal(isAsyncBusy(initialAsyncState), false);
});
