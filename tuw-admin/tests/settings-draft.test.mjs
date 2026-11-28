import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDraft } from '../src/app/(dashboard)/settings/_components/draft.ts';

const values = {
  'store.name': 'The Unplugged Wear',
  'store.currency': 'INR',
  'features.personalization': false,
  'shipping.free_threshold': 300000,
};

test('fixed settings are never sent back to the save action', () => {
  const fields = [
    { key: 'store.name', kind: 'text' },
    { key: 'store.currency', kind: 'fixed' },
    { key: 'features.personalization', kind: 'bool' },
    { key: 'shipping.free_threshold', kind: 'money' },
  ];
  assert.deepEqual(toDraft(fields, values), {
    'store.name': 'The Unplugged Wear',
    'features.personalization': false,
    'shipping.free_threshold': '3000.00',
  });
  assert.equal(Object.hasOwn(toDraft(fields, values), 'store.currency'), false);
});

test('missing values become empty strings and booleans stay booleans', () => {
  const fields = [{ key: 'features.personalization', kind: 'bool' }, { key: 'brand.tagline', kind: 'text' }];
  assert.deepEqual(toDraft(fields, { 'features.personalization': true }), {
    'features.personalization': true,
    'brand.tagline': '',
  });
});
