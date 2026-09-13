import { test } from 'node:test';
import assert from 'node:assert/strict';
import { READ_VERBS as C11_READ_VERBS } from '../arbiter/c11.mjs';
import { classifyFloor } from '../core/core.mjs';
import { READ_VERBS } from './lists.mjs';
import { applyStep1 } from './step1.mjs';

function row(overrides) {
  return { method: 'GET', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'r', ...overrides };
}

const ctx = { junkSet: new Set(), allowlistFor: () => new Set() };

// D57: step 1's own copy must stay equal to c11.mjs's (frozen history)
// resolved READ_VERBS — checked here, not imported for real use elsewhere.
test('step1 list copy matches c11.mjs exactly', () => {
  assert.equal(READ_VERBS.size, 14);
  assert.deepEqual(READ_VERBS, C11_READ_VERBS);
});

test('applyStep1: pass-through on a w-floor row', () => {
  const prev = { class: 'w', rule: 'floor', floor: true };
  const r = row({ method: 'PUT', operationId: 'updateDeviceStatus' });
  assert.deepEqual(applyStep1(prev, r, ctx), prev);
});

test('applyStep1: pass-through on an x-from-step3 row', () => {
  const prev = { class: 'x', rule: 'no-own-noun', floor: false };
  const r = row({ method: 'PUT', operationId: 'updateAccountBillingAddress' });
  assert.deepEqual(applyStep1(prev, r, ctx), prev);
});

test('applyStep1: POST with a read verb lowers to r', () => {
  const r = row({ method: 'POST', operationId: 'retrieveDeviceStatus' });
  const res = applyStep1(classifyFloor(r), r, ctx);
  assert.equal(res.class, 'r');
  assert.equal(res.rule, 'read-verb');
  assert.equal(res.floor, false);
});

test('applyStep1: POST with no read verb passes through', () => {
  const r = row({ method: 'POST', operationId: 'createSession' });
  const prev = classifyFloor(r);
  assert.deepEqual(applyStep1(prev, r, ctx), prev);
});

test('applyStep1: pass-through on an x-floor row that is not POST', () => {
  const prev = { class: 'x', rule: 'floor', floor: true };
  const r = row({ method: 'PATCH', operationId: 'updateSession' });
  assert.deepEqual(applyStep1(prev, r, ctx), prev);
});
