import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRow } from './flow.mjs';

test('classifyRow: a GET still comes back from step 1 as r/method', () => {
  assert.deepEqual(
    classifyRow({ method: 'GET', operationId: 'listThings', path: '/things' }),
    { class: 'r', step: 1, rule: 'method' },
  );
});

test('classifyRow: a POST read verb still comes back from step 1 unchanged', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'SearchThings', path: '/things/search' }),
    { class: 'r', step: 1, rule: 'read-verb' },
  );
});

test('classifyRow: a DELETE is claimed w by step 2', () => {
  assert.deepEqual(
    classifyRow({ method: 'DELETE', operationId: 'deleteThing', path: '/things/{id}' }),
    { class: 'w', step: 2, rule: 'method-floor' },
  );
});

test('classifyRow: an unclaimed POST falls to the step 3 placeholder floor', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'createThing', path: '/things' }),
    { class: 'x', step: 3, rule: 'unclaimed' },
  );
});

test('classifyRow: an OTHER_PARTY-blocked POST also falls to the placeholder floor', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'removeUserForTeam', path: '/teams/{t}/users/{u}' }),
    { class: 'x', step: 3, rule: 'unclaimed' },
  );
});
