import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStep1, READ_VERBS } from './step1.mjs';

test('applyStep1: GET -> r/method', () => {
  const res = applyStep1({ method: 'GET', operationId: 'listThings', path: '/things' });
  assert.deepEqual(res, { class: 'r', step: 1, rule: 'method' });
});

test('applyStep1: HEAD and OPTIONS -> r/method', () => {
  assert.deepEqual(applyStep1({ method: 'HEAD', operationId: '', path: '/things' }), { class: 'r', step: 1, rule: 'method' });
  assert.deepEqual(applyStep1({ method: 'OPTIONS', operationId: '', path: '/things' }), { class: 'r', step: 1, rule: 'method' });
});

test('applyStep1: POST getThing -> r/read-verb', () => {
  const res = applyStep1({ method: 'POST', operationId: 'getThing', path: '/things' });
  assert.deepEqual(res, { class: 'r', step: 1, rule: 'read-verb' });
});

test('applyStep1: POST createThing -> null', () => {
  const res = applyStep1({ method: 'POST', operationId: 'createThing', path: '/things' });
  assert.equal(res, null);
});

test('applyStep1: POST post_list_x strips method prefix -> read-verb list', () => {
  const res = applyStep1({ method: 'POST', operationId: 'post_list_x', path: '/x' });
  assert.deepEqual(res, { class: 'r', step: 1, rule: 'read-verb' });
});

test('applyStep1: PUT -> null', () => {
  const res = applyStep1({ method: 'PUT', operationId: 'updateThing', path: '/things/{id}' });
  assert.equal(res, null);
});

test('READ_VERBS: literal copy of poc/archive/m1/step1/lists.mjs (14 words)', () => {
  const expected = new Set([
    'retrieve', 'verify', 'check', 'query', 'read', 'fetch', 'list', 'search',
    'match', 'count', 'lookup', 'assess', 'find', 'get',
  ]);
  assert.equal(READ_VERBS.size, expected.size);
  for (const w of expected) assert.ok(READ_VERBS.has(w), `expected READ_VERBS to have "${w}"`);
});
