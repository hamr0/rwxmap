import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floorFor, classifyByVerb, nounsForRow, classifyGoal2 } from './goal2.mjs';

function row(overrides) {
  return { method: 'GET', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'r', ...overrides };
}

test('floorFor: per-method floor', () => {
  assert.equal(floorFor('GET'), 'r');
  assert.equal(floorFor('HEAD'), 'r');
  assert.equal(floorFor('OPTIONS'), 'r');
  assert.equal(floorFor('POST'), 'x');
  assert.equal(floorFor('PUT'), 'w');
  assert.equal(floorFor('DELETE'), 'w');
  assert.equal(floorFor('PATCH'), 'w');
});

test('floorFor: throws on an unrecognised method', () => {
  assert.throws(() => floorFor('TRACE'));
  assert.throws(() => floorFor(''));
  assert.throws(() => floorFor(undefined));
});

test('classifyByVerb: GET floors to r', () => {
  const res = classifyByVerb(row({ method: 'GET', operationId: 'getDevice' }));
  assert.deepEqual(res, { class: 'r', rule: 'floor', floor: true });
});

test('classifyByVerb: POST with a read verb lowers to r', () => {
  const res = classifyByVerb(row({ method: 'POST', operationId: 'retrieveDeviceStatus' }));
  assert.equal(res.class, 'r');
  assert.equal(res.rule, 'read-verb');
  assert.equal(res.floor, false);
});

test('classifyByVerb: POST with no read verb floors to x', () => {
  const res = classifyByVerb(row({ method: 'POST', operationId: 'createSession' }));
  assert.deepEqual(res, { class: 'x', rule: 'floor', floor: true });
});

test('classifyByVerb: PUT with a live verb raises to x', () => {
  const res = classifyByVerb(row({ method: 'PUT', operationId: 'terminateCall', summary: 'Terminate a call' }));
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'live-verb');
  assert.equal(res.floor, false);
});

test('classifyByVerb: PUT with a live verb but a caller phrase in the summary is suppressed back to w', () => {
  const res = classifyByVerb(row({ method: 'PUT', operationId: 'terminateCall', summary: 'Terminate your call' }));
  assert.deepEqual(res, { class: 'w', rule: 'floor', floor: true });
});

test('classifyByVerb: PUT with no live verb floors to w', () => {
  const res = classifyByVerb(row({ method: 'PUT', operationId: 'updateDeviceStatus', summary: 'Update device status' }));
  assert.deepEqual(res, { class: 'w', rule: 'floor', floor: true });
});

test('nounsForRow: includes both head nouns and buried tokens', () => {
  const r = row({ method: 'PUT', operationId: 'updateAccountBillingAddress', summary: 'Update the billing address' });
  const nouns = nounsForRow(r, new Set());
  // buried token 'account' must survive alongside the head noun 'address'
  assert.ok(nouns.has('account'));
  assert.ok(nouns.has('address'));
});

test('nounsForRow: excludes junkSet members and does not mutate junkSet', () => {
  const r = row({ method: 'PUT', operationId: 'updateAccountBillingAddress', summary: 'Update the billing address' });
  const junk = new Set(['account']);
  const before = new Set(junk);
  const nouns = nounsForRow(r, junk);
  assert.ok(!nouns.has('account'));
  assert.deepEqual(junk, before);
});

test('nounsForRow: excludes verb tokens (LIVE_VERBS and READ_VERBS)', () => {
  const r = row({ method: 'PUT', operationId: 'cancelSubscription', summary: 'Cancel the subscription' });
  const nouns = nounsForRow(r, new Set());
  assert.ok(!nouns.has('cancel'));
  assert.ok(nouns.has('subscription'));
});

test('classifyGoal2: floor-w row whose nouns are all on the allowlist stays w', () => {
  const r = row({ method: 'PUT', operationId: 'updateDeviceStatus', summary: 'Update device status' });
  const allowlist = nounsForRow(r, new Set()); // every noun this row has is "on" the allowlist
  const res = classifyGoal2(r, new Set(), allowlist);
  assert.equal(res.class, 'w');
});

test('classifyGoal2: floor-w row with one noun off the allowlist becomes x/no-own-noun', () => {
  const r = row({ method: 'PUT', operationId: 'updateDeviceStatus', summary: 'Update device status' });
  const allowlist = nounsForRow(r, new Set());
  allowlist.delete('device'); // one noun now missing from the allowlist
  const res = classifyGoal2(r, new Set(), allowlist);
  assert.deepEqual(res, { class: 'x', rule: 'no-own-noun', floor: false });
});

test('classifyGoal2: a row already raised to x by the verb rule is returned untouched', () => {
  const r = row({ method: 'PUT', operationId: 'terminateCall', summary: 'Terminate a call' });
  const res = classifyGoal2(r, new Set(), new Set());
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'live-verb');
});

test('classifyGoal2: a GET row is returned untouched', () => {
  const r = row({ method: 'GET', operationId: 'getDevice' });
  const res = classifyGoal2(r, new Set(), new Set());
  assert.deepEqual(res, { class: 'r', rule: 'floor', floor: true });
});

// Regression pin (M1-C26 finding): a PUT named like a dotted path where the
// head noun IS on the allowlist but a buried token ('permission') is NOT.
// The old shape needed a hand-written third-party noun list to catch this;
// this shape must get it for free from the widened noun set.
test('classifyGoal2: buried-token regression — walletobjects.permissions.update', () => {
  const r = row({
    method: 'PUT',
    operationId: 'walletobjects.permissions.update',
    summary: 'Update wallet object settings',
  });
  // head nouns here are 'setting' and 'update'; 'permission' only shows up
  // as a buried operationId token.
  const allowlist = new Set(['setting', 'update', 'walletobject']);
  const res = classifyGoal2(r, new Set(), allowlist);
  assert.equal(res.class, 'x');
  assert.equal(res.rule, 'no-own-noun');
});
