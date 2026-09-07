import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTables, objectHead, arbiterVerb } from './rules-verb.mjs';

const tables = loadTables();

function op(overrides) {
  return {
    method: 'GET',
    path: '/x',
    operationId: 'x',
    summary: '',
    description: '',
    hasCallbacks: false,
    has409: false,
    hasSink: false,
    ...overrides,
  };
}

// --- objectHead ---

test('objectHead: "Delete a specific Trust Domain" -> domain', () => {
  assert.equal(objectHead('Delete a specific Trust Domain'), 'domain');
});

test('objectHead: "Delete a Call record from your account" -> record', () => {
  assert.equal(objectHead('Delete a Call record from your account'), 'record');
});

test('objectHead: "Terminate an active call" -> call', () => {
  assert.equal(objectHead('Terminate an active call'), 'call');
});

// --- arbiterVerb ---

test('GET stays r even with a consequential verb in the text (V0)', () => {
  const o = op({ method: 'GET', summary: 'Terminate an active call' });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'r');
  assert.equal(r.rule_id, 'V0-safe-locked');
});

test('DELETE "Delete a Call record from your account" -> w via V5', () => {
  const o = op({ method: 'DELETE', summary: 'Delete a Call record from your account' });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'V5-verb-write');
});

test('DELETE "Kick a participant from a given conference" -> x via V2', () => {
  const o = op({ method: 'DELETE', summary: 'Kick a participant from a given conference' });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'V2-verb-consequential');
});

test('DELETE "Remove team membership for a user" -> x via V3, low confidence (verb unknown)', () => {
  const o = op({ method: 'DELETE', summary: 'Remove team membership for a user' });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'V3-party-object');
  assert.equal(r.confidence, 'low');
});

test('regression: DELETE "Delete a specific Trust Domain" with unrelated party words in description stays w via V5', () => {
  const o = op({
    method: 'DELETE',
    summary: 'Delete a specific Trust Domain',
    description: 'Deletes the given trust domain. Removing it may affect network access devices that rely on it.',
  });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'V5-verb-write');
});

test('POST "Retrieve the validity status" -> r via V4', () => {
  const o = op({ method: 'POST', summary: 'Retrieve the validity status' });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'r');
  assert.equal(r.rule_id, 'V4-verb-read');
});

test('POST "Create a new outgoing call" -> x via V2', () => {
  const o = op({ method: 'POST', summary: 'Create a new outgoing call' });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'V2-verb-consequential');
});

test('PUT "Set GitHub Actions permissions for an organization" -> x via V3, high confidence (verb known)', () => {
  const o = op({ method: 'PUT', summary: 'Set GitHub Actions permissions for an organization' });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'V3-party-object');
  assert.equal(r.confidence, 'high');
});

test('DELETE with a read verb keeps the method floor (V4, not loosened below w)', () => {
  const o = op({ method: 'DELETE', summary: 'Check the widget status' });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'V4-verb-read');
});

test('hasSink structural marker forces x (V1) ahead of a read verb', () => {
  const o = op({ method: 'POST', summary: 'Get the callback status', hasSink: true });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'V1-structural');
});

test('unknown verb, no party object, no structural marker keeps the method floor (V6)', () => {
  const o = op({ method: 'PUT', summary: 'Adjust the widget offset' });
  const r = arbiterVerb(o, tables);
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'V6-floor');
});

test('partySource=anywhere fires on a party word anywhere in the text, unlike the default object mode', () => {
  const o = op({
    method: 'DELETE',
    summary: 'Delete a specific Trust Domain',
    description: 'Deletes the given trust domain. Removing it may affect network access devices that rely on it.',
  });
  const objectMode = arbiterVerb(o, tables);
  const anywhereMode = arbiterVerb(o, tables, { partySource: 'anywhere' });
  assert.equal(objectMode.class, 'w');
  assert.equal(anywhereMode.class, 'x');
  assert.equal(anywhereMode.rule_id, 'V3-party-object');
});
