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

test('classifyRow: an ordinary DELETE with no raise word is claimed w by step 2\'s method floor', () => {
  assert.deepEqual(
    classifyRow({ method: 'DELETE', operationId: 'deleteThing', path: '/things/{id}' }),
    { class: 'w', step: 2, rule: 'method-floor' },
  );
});

test('classifyRow: a DELETE whose path names a raise word is raised w -> x by step 3', () => {
  assert.deepEqual(
    classifyRow({ method: 'DELETE', operationId: 'deleteMembership', path: '/teams/{id}/membership' }),
    { class: 'x', step: 3, rule: 'raise-word' },
  );
});

test('classifyRow: step 2\'s modify-verb word claim is FINAL and step 3 never overrides it, even with a raise word present', () => {
  assert.deepEqual(
    classifyRow({
      method: 'POST',
      operationId: 'rotatePassword',
      path: '/accounts/{id}/password/rotate',
    }),
    { class: 'w', step: 2, rule: 'modify-verb' },
  );
});

test('classifyRow: an unclaimed POST falls to step 3\'s floor-post pile', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'createThing', path: '/things' }),
    { class: 'x', step: 3, rule: 'floor-post' },
  );
});

test('classifyRow: an OTHER_PARTY-blocked POST also falls to floor-post', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'removeUserForTeam', path: '/teams/{t}/users/{u}' }),
    { class: 'x', step: 3, rule: 'floor-post' },
  );
});
