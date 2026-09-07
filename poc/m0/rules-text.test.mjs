import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arbiterText } from './rules-text.mjs';

const model = {
  harm: [{ token: 'terminate' }, { token: 'dial' }],
  read: [{ token: 'retrieve' }],
};

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

test('GET never leaves r even when the description contains harm words', () => {
  const r = arbiterText(op({ method: 'GET', description: 'terminate the dial tone' }), model);
  assert.equal(r.class, 'r');
  assert.equal(r.rule_id, 'T0-safe-locked');
});

test('PUT with a harm word goes to x', () => {
  const r = arbiterText(op({ method: 'PUT', description: 'terminate the session' }), model);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'T1-consequence');
});

test('PUT with no hits stays w', () => {
  const r = arbiterText(op({ method: 'PUT', description: 'update the profile name' }), model);
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'T3-floor');
});

test('POST with a read hit and no harm goes to r', () => {
  const r = arbiterText(op({ method: 'POST', description: 'retrieve the current location' }), model);
  assert.equal(r.class, 'r');
  assert.equal(r.rule_id, 'T2-lookup');
});

test('POST with both a harm hit and a read hit goes to x (harm wins)', () => {
  const r = arbiterText(op({ method: 'POST', description: 'retrieve then dial the number' }), model);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'T1-consequence');
});

test('POST with hasCallbacks goes to x with no harm word present', () => {
  const r = arbiterText(op({ method: 'POST', description: 'a plain description', hasCallbacks: true }), model);
  assert.equal(r.class, 'x');
  assert.equal(r.rule_id, 'T1-consequence');
});

test('a DELETE never returns r', () => {
  const r1 = arbiterText(op({ method: 'DELETE', description: 'plain deletion' }), model);
  assert.notEqual(r1.class, 'r');
  const r2 = arbiterText(op({ method: 'DELETE', description: 'terminate the call' }), model);
  assert.notEqual(r2.class, 'r');
});
