import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floorFor, classifyFloor, withSplitOperationId } from './core.mjs';

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

test('classifyFloor: GET floors to r', () => {
  const res = classifyFloor(row({ method: 'GET', operationId: 'getDevice' }));
  assert.deepEqual(res, { class: 'r', rule: 'floor', floor: true });
});

test('classifyFloor: POST floors to x', () => {
  const res = classifyFloor(row({ method: 'POST', operationId: 'createSession' }));
  assert.deepEqual(res, { class: 'x', rule: 'floor', floor: true });
});

test('classifyFloor: PUT/DELETE/PATCH floor to w', () => {
  assert.deepEqual(classifyFloor(row({ method: 'PUT' })), { class: 'w', rule: 'floor', floor: true });
  assert.deepEqual(classifyFloor(row({ method: 'DELETE' })), { class: 'w', rule: 'floor', floor: true });
  assert.deepEqual(classifyFloor(row({ method: 'PATCH' })), { class: 'w', rule: 'floor', floor: true });
});

test('withSplitOperationId: does not mutate its input row', () => {
  const r = row({ method: 'PUT', operationId: 'gists/unstar' });
  const before = { ...r };
  const out = withSplitOperationId(r);
  assert.deepEqual(r, before);
  assert.equal(out.operationId, 'gists_unstar');
  assert.notEqual(out, r);
});

test('withSplitOperationId: splits on "/" and whitespace', () => {
  assert.equal(withSplitOperationId(row({ operationId: 'gists/unstar' })).operationId, 'gists_unstar');
  assert.equal(withSplitOperationId(row({ operationId: 'delete team member' })).operationId, 'delete_team_member');
});

test('withSplitOperationId: a whitespace-only operationId normalises the same as empty', () => {
  const withSpaces = withSplitOperationId(row({ operationId: '   ', path: '/devices/{id}/terminate' }));
  const withEmpty = withSplitOperationId(row({ operationId: '', path: '/devices/{id}/terminate' }));
  assert.deepEqual(withSpaces, withEmpty);
});
