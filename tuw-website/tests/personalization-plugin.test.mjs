import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  personalizationReducer, initialPersonalizationState,
} from '../src/storefront/plugins/personalization/personalization-machine.ts';
import { previewUrlFor, validateMonogram, escapeXml } from '../src/storefront/plugins/personalization/preview-url.ts';

test('personalization FSM requires a preview before adding', () => {
  const editing = personalizationReducer(initialPersonalizationState, { type: 'ENABLE' });
  assert.equal(editing.kind, 'editing');
  assert.equal(personalizationReducer(editing, { type: 'ADD' }).kind, 'editing');
  const previewing = personalizationReducer(editing, { type: 'RENDER', previewUrl: '/api/previews?m=UK' });
  assert.equal(previewing.kind, 'previewing');
  const adding = personalizationReducer(previewing, { type: 'ADD' });
  assert.equal(adding.kind, 'adding');
  const approved = personalizationReducer(adding, { type: 'APPROVED', lineId: 'line-1' });
  assert.deepEqual(approved, { kind: 'approved', lineId: 'line-1' });
});

test('personalization FSM failure retains the shopper input', () => {
  const editing = personalizationReducer(initialPersonalizationState, { type: 'ENABLE' });
  const typed = personalizationReducer(editing, { type: 'SET_MONOGRAM', value: 'UK' });
  const previewing = personalizationReducer(typed, { type: 'RENDER', previewUrl: '/api/previews?m=UK' });
  const failed = personalizationReducer(previewing, { type: 'FAIL', message: 'Try again' });
  assert.equal(failed.kind, 'error');
  assert.equal(failed.monogram, 'UK');
  assert.equal(failed.previewUrl, '/api/previews?m=UK');
  assert.equal(personalizationReducer(failed, { type: 'RESET' }).kind, 'editing');
});

test('preview URLs are local paths and monograms stay within the product limit', () => {
  const url = previewUrlFor({ productId: 'p1', color: 'Black', size: 'M', monogram: 'A B', placement: 'Front' });
  assert.ok(url.startsWith('/api/previews?'));
  assert.ok(!url.startsWith('//'));
  assert.ok(new URL(url, 'https://example.test').searchParams.get('m') === 'A B');
  assert.equal(validateMonogram('UK', 3), null);
  assert.match(validateMonogram('ABCD', 3), /1 to 3 characters/);
  assert.match(validateMonogram('  ', 3), /1 to 3 characters/);
  assert.equal(escapeXml('<&-"'), '&lt;&amp;-&quot;');
});
