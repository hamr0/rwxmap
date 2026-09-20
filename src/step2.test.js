import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step2, MODIFY_VERBS, OTHER_PARTY } from './step2.js';

test('method-floor rule: PUT floors to w with an empty matched list', () => {
  const v = step2({ method: 'PUT', operationId: 'updateWidget' });
  assert.deepEqual(v, { class: 'w', step: 2, rule: 'method-floor', source: 'floor', matched: [] });
});

test('method-floor rule: DELETE and PATCH also floor to w', () => {
  const del = step2({ method: 'DELETE', operationId: 'deleteWidget' });
  const patch = step2({ method: 'PATCH', operationId: 'patchWidget' });
  assert.deepEqual(del, { class: 'w', step: 2, rule: 'method-floor', source: 'floor', matched: [] });
  assert.deepEqual(patch, { class: 'w', step: 2, rule: 'method-floor', source: 'floor', matched: [] });
});

test('modify-verb rule: POST with a MODIFY_VERBS lead verb', () => {
  const v = step2({ method: 'POST', operationId: 'cancelSubscription' });
  assert.deepEqual(v, {
    class: 'w', step: 2, rule: 'modify-verb', source: 'list', matched: ['cancel'],
  });
});

test('modify-verb-summary rule: bare-method lead falls back to the summary verb', () => {
  const v = step2({
    method: 'POST',
    operationId: 'PostTaxCalculations',
    summary: 'Cancel a tax calculation',
  });
  assert.deepEqual(v, {
    class: 'w', step: 2, rule: 'modify-verb-summary', source: 'list', matched: ['cancel'],
  });
});

test('modify-verb-summary fires only when the lead token is a bare method word', () => {
  // Lead verb "cancel" is real, not a bare method word — the summary must
  // NOT be consulted even though it also names a modify verb.
  const v = step2({
    method: 'POST',
    operationId: 'cancelWidget',
    summary: 'Delete a widget',
  });
  assert.deepEqual(v, {
    class: 'w', step: 2, rule: 'modify-verb', source: 'list', matched: ['cancel'],
  });
});

test('gate blocks modify-verb when an OTHER_PARTY word appears in the operationId', () => {
  const v = step2({ method: 'POST', operationId: 'removeUserFromTeam' });
  assert.equal(v, null);
});

test('gate blocks modify-verb-summary the same way', () => {
  const v = step2({
    method: 'POST',
    operationId: 'PostTeamMembers',
    summary: 'Remove a user from the team',
  });
  assert.equal(v, null);
});

test('gate blocks even when the OTHER_PARTY word appears only in the summary, not the operationId', () => {
  const v = step2({
    method: 'POST',
    operationId: 'cancelSubscription',
    summary: 'Cancel a subscription for this user',
  });
  assert.equal(v, null);
});

test('null for a GET row (step 2 never assigns r)', () => {
  assert.equal(step2({ method: 'GET', operationId: 'listWidgets' }), null);
});

test('null for a POST with no modify verb', () => {
  assert.equal(step2({ method: 'POST', operationId: 'createWidget' }), null);
});

test('words injection overrides MODIFY_VERBS', () => {
  const custom = { modifyVerbs: new Set(['banana']), otherParty: new Set() };
  const v = step2({ method: 'POST', operationId: 'bananaWidget' }, custom);
  assert.deepEqual(v, { class: 'w', step: 2, rule: 'modify-verb', source: 'list', matched: ['banana'] });

  // With the defaults, the same operationId is not claimed (no matching verb).
  assert.equal(step2({ method: 'POST', operationId: 'bananaWidget' }), null);
});

test('words injection overrides OTHER_PARTY', () => {
  // Default OTHER_PARTY blocks "user"; an emptied custom set does not.
  const blocked = step2({ method: 'POST', operationId: 'removeUserFromTeam' });
  assert.equal(blocked, null);

  const v = step2(
    { method: 'POST', operationId: 'removeUserFromTeam' },
    { modifyVerbs: MODIFY_VERBS, otherParty: new Set() },
  );
  assert.deepEqual(v, { class: 'w', step: 2, rule: 'modify-verb', source: 'list', matched: ['remove'] });
});

test('MODIFY_VERBS has 24 members and OTHER_PARTY has 21', () => {
  assert.equal(MODIFY_VERBS.size, 24);
  assert.equal(OTHER_PARTY.size, 21);
});
