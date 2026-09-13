import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFloor } from '../core/core.mjs';
import { LIVE_VERBS as C11_LIVE_VERBS, READ_VERBS as C11_READ_VERBS } from '../arbiter/c11.mjs';
import { LIVE_VERBS, NON_NOUN_READ_VERBS } from './lists.mjs';
import { nounsForRow } from './allowlist.mjs';
import { applyGoal2, applyLiveVerb } from './goal2.mjs';

function row(overrides) {
  return { method: 'GET', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'r', ...overrides };
}

function ctxWith(allowlist, junkSet = new Set()) {
  return { junkSet, allowlistFor: () => allowlist };
}

// D57: goal 2's own copies must stay equal to c11.mjs's (frozen history)
// resolved sets — checked here, not imported for real use elsewhere.
test('goal2 list copies match c11.mjs exactly', () => {
  assert.equal(LIVE_VERBS.size, 26);
  assert.deepEqual(LIVE_VERBS, C11_LIVE_VERBS);
  assert.equal(NON_NOUN_READ_VERBS.size, 14);
  assert.deepEqual(NON_NOUN_READ_VERBS, C11_READ_VERBS);
});

test('applyLiveVerb: PUT with a live verb raises to x', () => {
  const r = row({ method: 'PUT', operationId: 'terminateCall', summary: 'Terminate a call' });
  const res = applyLiveVerb(classifyFloor(r), r);
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'live-verb');
  assert.equal(res.floor, false);
});

test('applyLiveVerb: PUT with a live verb but a caller phrase in the summary is suppressed back to w', () => {
  const r = row({ method: 'PUT', operationId: 'terminateCall', summary: 'Terminate your call' });
  const res = applyLiveVerb(classifyFloor(r), r);
  assert.deepEqual(res, { class: 'w', rule: 'floor', floor: true });
});

test('applyLiveVerb: PUT with no live verb floors to w', () => {
  const r = row({ method: 'PUT', operationId: 'updateDeviceStatus', summary: 'Update device status' });
  const res = applyLiveVerb(classifyFloor(r), r);
  assert.deepEqual(res, { class: 'w', rule: 'floor', floor: true });
});

test('applyLiveVerb: a whitespace-only operationId still falls back to the path, like empty', () => {
  const withSpaces = row({ method: 'PUT', operationId: '   ', path: '/devices/{id}/terminate', summary: 'Do a thing' });
  const withEmpty = row({ method: 'PUT', operationId: '', path: '/devices/{id}/terminate', summary: 'Do a thing' });
  assert.deepEqual(applyLiveVerb(classifyFloor(withSpaces), withSpaces), applyLiveVerb(classifyFloor(withEmpty), withEmpty));
});

test('applyGoal2: floor-w row whose nouns are all on the allowlist stays w', () => {
  const r = row({ method: 'PUT', operationId: 'updateDeviceStatus', summary: 'Update device status' });
  const allowlist = nounsForRow(r, new Set()); // every noun this row has is "on" the allowlist
  const prev = classifyFloor(r);
  const res = applyGoal2(prev, r, ctxWith(allowlist));
  assert.equal(res.class, 'w');
});

test('applyGoal2: floor-w row with one noun off the allowlist becomes x/no-own-noun', () => {
  const r = row({ method: 'PUT', operationId: 'updateDeviceStatus', summary: 'Update device status' });
  const allowlist = nounsForRow(r, new Set());
  allowlist.delete('device'); // one noun now missing from the allowlist
  const prev = classifyFloor(r);
  const res = applyGoal2(prev, r, ctxWith(allowlist));
  assert.deepEqual(res, { class: 'x', rule: 'no-own-noun', floor: false });
});

test('applyGoal2: a row already raised to x by the live-verb check is returned untouched by the noun check', () => {
  const r = row({ method: 'PUT', operationId: 'terminateCall', summary: 'Terminate a call' });
  const prev = classifyFloor(r);
  const res = applyGoal2(prev, r, ctxWith(new Set()));
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'live-verb');
});

test('applyGoal2: a GET row is returned untouched', () => {
  const r = row({ method: 'GET', operationId: 'getDevice' });
  const prev = classifyFloor(r);
  const res = applyGoal2(prev, r, ctxWith(new Set()));
  assert.deepEqual(res, { class: 'r', rule: 'floor', floor: true });
});

// Regression pin (M1-C26 finding): a PUT named like a dotted path where the
// head noun IS on the allowlist but a buried token ('permission') is NOT.
// The old shape needed a hand-written third-party noun list to catch this;
// this shape must get it for free from the widened noun set.
test('applyGoal2: buried-token regression — walletobjects.permissions.update', () => {
  const r = row({
    method: 'PUT',
    operationId: 'walletobjects.permissions.update',
    summary: 'Update wallet object settings',
  });
  // head nouns here are 'setting' and 'update'; 'permission' only shows up
  // as a buried operationId token.
  const allowlist = new Set(['setting', 'update', 'walletobject']);
  const prev = classifyFloor(r);
  const res = applyGoal2(prev, r, ctxWith(allowlist));
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'no-own-noun');
});
