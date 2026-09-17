import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destructiveFlag, loadDestructiveVerbs } from './rules-destructive.mjs';

const verbs = loadDestructiveVerbs();

function op(overrides) {
  return {
    method: 'GET',
    path: '/x',
    operationId: 'x',
    summary: '',
    description: '',
    ...overrides,
  };
}

test('DELETE anything -> true (D1, even with an unrelated summary)', () => {
  const r = destructiveFlag(op({ method: 'DELETE', summary: 'Get user' }), verbs);
  assert.equal(r.destructive, true);
  assert.equal(r.rule_id, 'D1-method-delete');
});

test('"Delete file" POST -> true (D2, lead verb)', () => {
  const r = destructiveFlag(op({ method: 'POST', summary: 'Delete file' }), verbs);
  assert.equal(r.destructive, true);
  assert.equal(r.rule_id, 'D2-verb-destructive');
});

test('"Get user" -> false', () => {
  const r = destructiveFlag(op({ method: 'GET', summary: 'Get user' }), verbs);
  assert.equal(r.destructive, false);
  assert.equal(r.rule_id, 'D3-not-destructive');
});

test('"Reply to email" -> false', () => {
  const r = destructiveFlag(op({ method: 'POST', summary: 'Reply to email' }), verbs);
  assert.equal(r.destructive, false);
});

test('"Pay invoice" -> false', () => {
  const r = destructiveFlag(op({ method: 'POST', summary: 'Pay invoice' }), verbs);
  assert.equal(r.destructive, false);
});

test('"Terminate an active call" -> true (D2, lead verb)', () => {
  const r = destructiveFlag(op({ method: 'POST', summary: 'Terminate an active call' }), verbs);
  assert.equal(r.destructive, true);
  assert.equal(r.rule_id, 'D2-verb-destructive');
});

test('"Add member to team" -> false', () => {
  const r = destructiveFlag(op({ method: 'POST', summary: 'Add member to team' }), verbs);
  assert.equal(r.destructive, false);
});
