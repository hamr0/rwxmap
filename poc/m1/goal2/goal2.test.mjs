import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyByVerb, nounsForRow } from '../core/core.mjs';
import { applyGoal2 } from './goal2.mjs';

function row(overrides) {
  return { method: 'GET', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'r', ...overrides };
}

function ctxWith(allowlist, junkSet = new Set()) {
  return { junkSet, allowlistFor: () => allowlist };
}

test('applyGoal2: floor-w row whose nouns are all on the allowlist stays w', () => {
  const r = row({ method: 'PUT', operationId: 'updateDeviceStatus', summary: 'Update device status' });
  const allowlist = nounsForRow(r, new Set()); // every noun this row has is "on" the allowlist
  const prev = classifyByVerb(r);
  const res = applyGoal2(prev, r, ctxWith(allowlist));
  assert.equal(res.class, 'w');
});

test('applyGoal2: floor-w row with one noun off the allowlist becomes x/no-own-noun', () => {
  const r = row({ method: 'PUT', operationId: 'updateDeviceStatus', summary: 'Update device status' });
  const allowlist = nounsForRow(r, new Set());
  allowlist.delete('device'); // one noun now missing from the allowlist
  const prev = classifyByVerb(r);
  const res = applyGoal2(prev, r, ctxWith(allowlist));
  assert.deepEqual(res, { class: 'x', rule: 'no-own-noun', floor: false });
});

test('applyGoal2: a row already raised to x by the verb rule is returned untouched', () => {
  const r = row({ method: 'PUT', operationId: 'terminateCall', summary: 'Terminate a call' });
  const prev = classifyByVerb(r);
  const res = applyGoal2(prev, r, ctxWith(new Set()));
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'live-verb');
});

test('applyGoal2: a GET row is returned untouched', () => {
  const r = row({ method: 'GET', operationId: 'getDevice' });
  const prev = classifyByVerb(r);
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
  const prev = classifyByVerb(r);
  const res = applyGoal2(prev, r, ctxWith(allowlist));
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'no-own-noun');
});
