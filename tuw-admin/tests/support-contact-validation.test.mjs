import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateTicketInput } from '../../packages/heart/src/modules/support/validate.ts';

const valid = {
  name: 'Asha Rao', email: 'asha@example.com',
  subject: 'An order', message: 'Where is my order? I need help please.',
};

test('valid contact input passes', () => {
  assert.deepEqual(validateCreateTicketInput(valid), []);
});

test('missing and malformed fields are reported', () => {
  assert.deepEqual(validateCreateTicketInput({ name: '', email: 'bad', subject: '', message: 'short' }),
    ['name', 'email', 'subject', 'message']);
  assert.deepEqual(validateCreateTicketInput(null), ['name', 'email', 'subject', 'message']);
});

test('overlong fields are refused', () => {
  assert.deepEqual(validateCreateTicketInput({ ...valid, name: 'A'.repeat(151) }), ['name']);
  assert.deepEqual(validateCreateTicketInput({ ...valid, message: 'x'.repeat(5001) }), ['message']);
});
