import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step3, floorPost, wordsForStep3, RAISE_WORDS } from './step3.js';

test('RAISE_WORDS is the 17-word list, verbatim', () => {
  assert.equal(RAISE_WORDS.size, 17);
  for (const word of [
    'permission', 'membership', 'memberships', 'panelist', 'panelists',
    'watcher', 'watchers', 'participants', 'actor', 'invites', 'invitation',
    'invitations', 'sso', 'password', 'grant', 'disassociate', 'reject',
  ]) {
    assert.equal(RAISE_WORDS.has(word), true, `${word} should be in RAISE_WORDS`);
  }
});

test('raise-word rule: a PUT whose path names a permission is claimed x, reporting the word', () => {
  const v = step3({ method: 'PUT', operationId: 'updateUser', path: '/users/{id}/permission' });
  assert.deepEqual(v, {
    class: 'x', step: 3, rule: 'raise-word', source: 'list', matched: ['permission'],
  });
});

test('raise-word rule: a raise word in the operationId also fires', () => {
  const v = step3({ method: 'DELETE', operationId: 'deleteMembership', path: '/teams/{id}/members/{userId}' });
  assert.deepEqual(v, {
    class: 'x', step: 3, rule: 'raise-word', source: 'list', matched: ['membership'],
  });
});

test('raise-word rule: a raise word in the summary also fires', () => {
  const v = step3({ method: 'PATCH', operationId: 'updateThing', path: '/things/{id}', summary: 'Reset the password' });
  assert.deepEqual(v, {
    class: 'x', step: 3, rule: 'raise-word', source: 'list', matched: ['password'],
  });
});

test('raise-word rule: matches at any token position, not just the lead', () => {
  const v = step3({ method: 'DELETE', operationId: 'removeTeamWatcher', path: '/teams/{id}' });
  assert.deepEqual(v, {
    class: 'x', step: 3, rule: 'raise-word', source: 'list', matched: ['watcher'],
  });
});

test('raise-word rule: the match is exact, not a stem or a substring', () => {
  // "passwords" is not a RAISE_WORDS member; only "password" is, and these
  // are nouns, so no inflection is accepted.
  assert.equal(step3({ method: 'PUT', operationId: 'rotatePasswords', path: '/accounts/{id}' }), null);
});

test('no raise word anywhere returns null', () => {
  assert.equal(step3({ method: 'PUT', operationId: 'updateThing', path: '/things/{id}' }), null);
});

test('matched reports EVERY member present, sorted ascending — not the first one found', () => {
  // CONSTRUCTED deliberately, because the corpus's coverage of this is
  // thin: 17 of its 4171 rows fire more than one RAISE_WORDS member, but 14
  // of those are singular/plural pairs (membership+memberships and friends)
  // that sit adjacent and already in order in RAISE_WORDS's declaration, so
  // they cannot tell a sorted result from an insertion-ordered one. Only
  // grant+permission (3 rows) can.
  //
  // This row can too, on purpose: RAISE_WORDS is declared with "watcher"
  // (6th) before "actor" (9th), so insertion order would give
  // ['watcher', 'actor'] and only a sort gives ['actor', 'watcher'].
  const v = step3({ method: 'DELETE', operationId: 'removeActor', path: '/things/{id}/watcher' });
  assert.deepEqual(v, {
    class: 'x', step: 3, rule: 'raise-word', source: 'list', matched: ['actor', 'watcher'],
  });
});

test('matched reports both members of a singular/plural pair when both are present', () => {
  // The shape asana's /memberships/{membership_gid} updateMembership takes:
  // the operationId carries "membership" and the path segment carries
  // "memberships", and both are separate RAISE_WORDS members.
  const v = step3({ method: 'PUT', operationId: 'updateMembership', path: '/memberships/{membership_gid}' });
  assert.ok(v);
  assert.deepEqual(v.matched, ['membership', 'memberships']);
});

test('floorPost: the floor verdict always carries an empty matched list', () => {
  assert.deepEqual(floorPost(), {
    class: 'x', step: 3, rule: 'floor-post', source: 'floor', matched: [],
  });
});

test('words injection overrides RAISE_WORDS (the LOVO path)', () => {
  const row = { method: 'PUT', operationId: 'updateSsoConfig', path: '/accounts/{id}' };

  // An emptied list claims nothing, even though "sso" is a default member.
  assert.equal(step3(row, { raiseWords: new Set() }), null);

  // A rebuilt list claims the row and reports its own member.
  assert.deepEqual(step3(row, { raiseWords: new Set(['sso']) }), {
    class: 'x', step: 3, rule: 'raise-word', source: 'list', matched: ['sso'],
  });

  // A word that is not a default member fires when injected, and does not
  // fire on the defaults.
  const banana = { method: 'DELETE', operationId: 'deleteBanana', path: '/bananas/{id}' };
  assert.deepEqual(step3(banana, { raiseWords: new Set(['banana']) }), {
    class: 'x', step: 3, rule: 'raise-word', source: 'list', matched: ['banana'],
  });
  assert.equal(step3(banana), null);
});

test('words injection sorts the injected list too, not just the default one', () => {
  const v = step3(
    { method: 'DELETE', operationId: 'removeZebra', path: '/apple/{id}' },
    { raiseWords: new Set(['zebra', 'apple']) },
  );
  assert.ok(v);
  assert.deepEqual(v.matched, ['apple', 'zebra']);
});

test('wordsForStep3: includes a raise word buried mid-path, not just the lead token', () => {
  const words = wordsForStep3({ method: 'PUT', operationId: 'updateUser', path: '/users/{id}/permissions/{permId}' });
  assert.equal(words.includes('permissions'), true);
});

test('wordsForStep3: skips {param} path segments', () => {
  const words = wordsForStep3({ method: 'PUT', operationId: 'updateThing', path: '/things/{password}' });
  assert.equal(words.includes('password'), false);
});
