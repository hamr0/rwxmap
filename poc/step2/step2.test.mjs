import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStep2, MODIFY_VERBS, OTHER_PARTY } from './step2.mjs';

test('applyStep2: PUT, DELETE and PATCH are claimed w by the method floor', () => {
  for (const method of ['PUT', 'DELETE', 'PATCH']) {
    assert.deepEqual(
      applyStep2({ method, operationId: 'doWhatever', path: '/things' }),
      { class: 'w', step: 2, rule: 'method-floor' },
    );
  }
});

test('applyStep2: a GET is never claimed by step 2 (step 1 owns the read methods)', () => {
  assert.equal(applyStep2({ method: 'GET', operationId: 'cancelThing', path: '/things' }), null);
});

test('applyStep2: POST cancelSubscription is claimed by the modify-verb rule', () => {
  assert.deepEqual(
    applyStep2({ method: 'POST', operationId: 'cancelSubscription', path: '/subscriptions/{id}/cancel' }),
    { class: 'w', step: 2, rule: 'modify-verb' },
  );
});

// Stripe names every operation PostSomething, so the operationId carries no
// verb and the summary is read instead. This is a real corpus row.
test('applyStep2: a bare method-word lead falls back to the summary verb', () => {
  assert.deepEqual(
    applyStep2({
      method: 'POST',
      operationId: 'PostAccountsAccount',
      path: '/v1/accounts/{account}',
      summary: 'Update an account',
    }),
    { class: 'w', step: 2, rule: 'modify-verb-summary' },
  );
});

// The same shape but about a member: the summary fallback finds 'update',
// then the gate blocks the row on 'member'. The gate runs after the verb, so
// it overrules the summary fallback as well as the operationId one.
test('applyStep2: the gate overrules the summary fallback too', () => {
  assert.equal(
    applyStep2({
      method: 'POST',
      operationId: 'PostMembersMemberUpdate',
      path: '/v1/members/{member}',
      summary: 'Update a member',
    }),
    null,
  );
});

// `customer`, `contact`, `agent` and `person` were removed from the gate on
// 2026-09-17: between them they vetoed 18 POST rows that were all truth w and
// caught zero leaks. Naming a human was the wrong test — the gate asks whose
// data it is, and your own customer is your data.
test('OTHER_PARTY: the four human-noun words are gone, and the list is 21 long', () => {
  for (const word of ['customer', 'contact', 'agent', 'person']) {
    assert.equal(OTHER_PARTY.has(word), false, `${word} should not be in OTHER_PARTY`);
  }
  assert.equal(OTHER_PARTY.size, 21);
});

// This exact row was the brief's blocked example before the removal. It now
// flips to claimed, and that flip is the point of the change.
test('applyStep2: a POST about your own customer is now claimed w', () => {
  assert.deepEqual(
    applyStep2({
      method: 'POST',
      operationId: 'PostCustomersCustomerUpdate',
      path: '/v1/customers/{customer}',
      summary: 'Update a customer',
    }),
    { class: 'w', step: 2, rule: 'modify-verb-summary' },
  );
});

test('applyStep2: POST removeUserForTeam is blocked by the OTHER_PARTY gate', () => {
  assert.equal(MODIFY_VERBS.has('remove'), true);
  assert.equal(OTHER_PARTY.has('user'), true);
  assert.equal(
    applyStep2({ method: 'POST', operationId: 'removeUserForTeam', path: '/teams/{team}/users/{user}' }),
    null,
  );
});

test('applyStep2: POST createThing is not claimed (create is not a modify verb)', () => {
  assert.equal(applyStep2({ method: 'POST', operationId: 'createThing', path: '/things' }), null);
});

test('applyStep2: the OTHER_PARTY gate reads the summary words too', () => {
  assert.equal(
    applyStep2({
      method: 'POST',
      operationId: 'cancelSubscription',
      path: '/subscriptions/{id}/cancel',
      summary: 'Cancel a member subscription',
    }),
    null,
  );
});

test('applyStep2: rebuilt word lists can be passed in (LOVO)', () => {
  const row = { method: 'POST', operationId: 'cancelSubscription', path: '/subscriptions/{id}/cancel' };
  assert.equal(applyStep2(row, { modifyVerbs: new Set(), otherParty: OTHER_PARTY }), null);
  assert.deepEqual(
    applyStep2(row, { modifyVerbs: new Set(['cancel']), otherParty: new Set() }),
    { class: 'w', step: 2, rule: 'modify-verb' },
  );
});

test('applyStep2: verb inflections match (cancelled, cancels)', () => {
  assert.deepEqual(
    applyStep2({ method: 'POST', operationId: 'archivesProject', path: '/projects/{id}/archive' }),
    { class: 'w', step: 2, rule: 'modify-verb' },
  );
});
