import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRow } from './flow.js';

test('classifyRow: a GET comes back from step 1 as r/method, on the floor', () => {
  assert.deepEqual(
    classifyRow({ method: 'GET', operationId: 'listThings', path: '/things' }),
    { class: 'r', step: 1, rule: 'method', source: 'floor', matched: [] },
  );
});

test('classifyRow: a POST read verb comes back from step 1, reporting the word it read', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'SearchThings', path: '/things/search' }),
    { class: 'r', step: 1, rule: 'read-verb', source: 'list', matched: ['search'] },
  );
});

test('classifyRow: DELETE beats every word — always x, destructive, even with a KEEP_W verb in the name', () => {
  assert.deepEqual(
    classifyRow({ method: 'DELETE', operationId: 'updateThing', path: '/things/{id}' }),
    { class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true },
  );
});

test('classifyRow: an ordinary PUT with no word evidence is claimed w by step 3\'s method floor', () => {
  assert.deepEqual(
    classifyRow({ method: 'PUT', operationId: 'updateThing', path: '/things/{id}' }),
    { class: 'w', step: 3, rule: 'method-floor', source: 'floor', matched: [] },
  );
});

test('classifyRow: a PUT with a CANT_UNDO verb is claimed x by step 2 before step 3 ever runs', () => {
  // "revoke" is also a REMOVES member, so this comes back destructive too.
  assert.deepEqual(
    classifyRow({ method: 'PUT', operationId: 'revokeCertificate', path: '/certs/{id}' }),
    { class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['revoke'], destructive: true },
  );
});

test('classifyRow: a POST with a KEEP_W verb is claimed w by step 3 (step 2 has nothing to say)', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'restoreThing', path: '/things/{id}/restore' }),
    { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['restore'] },
  );
});

test('classifyRow: a POST with a CANT_UNDO verb is claimed x by step 2, not offered to step 3', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'cancelSubscription', path: '/subscriptions/{id}/cancel' }),
    { class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['cancel'] },
  );
});

test('classifyRow: summary fallback works through the whole ladder for both step 2 and step 3', () => {
  const twoFallback = classifyRow({
    method: 'POST', operationId: 'PostTaxCalculations', path: '/tax/calculations', summary: 'Void a tax calculation',
  });
  assert.deepEqual(twoFallback, {
    class: 'x', step: 2, rule: 'cant-undo-verb-summary', source: 'list', matched: ['void'], destructive: true,
  });

  const threeFallback = classifyRow({
    method: 'POST', operationId: 'PostLists', path: '/lists', summary: 'Update a list',
  });
  assert.deepEqual(threeFallback, {
    class: 'w', step: 3, rule: 'modify-verb-summary', source: 'list', matched: ['update'],
  });
});

test('classifyRow: an unclaimed POST falls to step 2\'s floor-post pile', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'createThing', path: '/things' }),
    { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [] },
  );
});

test('classifyRow: no "whose" gate anywhere — a POST reaching another party with no evidence still just floors', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'removeUserForTeam', path: '/teams/{t}/users/{u}' }),
    { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['remove'] },
  );
});

test('classifyRow: a rebuilt words override reaches every step — an emptied keepW makes a POST fall through to floor-post x', () => {
  const row = { method: 'POST', operationId: 'updateThing', path: '/things/{id}' };
  assert.deepEqual(
    classifyRow(row, { keepW: new Set() }),
    { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [] },
  );
});

test('classifyRow: passing nothing is unchanged — the same POST still claims w via KEEP_W', () => {
  assert.deepEqual(
    classifyRow({ method: 'POST', operationId: 'updateThing', path: '/things/{id}' }),
    { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['update'] },
  );
});
