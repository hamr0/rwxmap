import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStep3, RAISE_WORDS, wordsForStep3, sourceForRule } from './step3.mjs';

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

test('applyStep3: a PUT whose path names a permission is raised to x', () => {
  assert.deepEqual(
    applyStep3({ method: 'PUT', operationId: 'updateUser', path: '/users/{id}/permission' }),
    { class: 'x', step: 3, rule: 'raise-word' },
  );
});

test('applyStep3: a raise word in the operationId also fires', () => {
  assert.deepEqual(
    applyStep3({ method: 'DELETE', operationId: 'deleteMembership', path: '/teams/{id}/members/{userId}' }),
    { class: 'x', step: 3, rule: 'raise-word' },
  );
});

test('applyStep3: a raise word in the summary also fires', () => {
  assert.deepEqual(
    applyStep3({ method: 'PATCH', operationId: 'updateThing', path: '/things/{id}', summary: 'Reset the password' }),
    { class: 'x', step: 3, rule: 'raise-word' },
  );
});

test('applyStep3: no raise word anywhere returns null', () => {
  assert.equal(
    applyStep3({ method: 'PUT', operationId: 'updateThing', path: '/things/{id}' }),
    null,
  );
});

test('applyStep3: match is exact, not a stem or substring (e.g. "passwords" alone should not match "password")', () => {
  // "passwords" is not in RAISE_WORDS; only "password" (singular) is.
  assert.equal(
    applyStep3({ method: 'PUT', operationId: 'rotatePasswords', path: '/accounts/{id}' }),
    null,
  );
});

test('applyStep3: matches at any token position, not just the lead', () => {
  assert.deepEqual(
    applyStep3({ method: 'DELETE', operationId: 'removeTeamWatcher', path: '/teams/{id}' }),
    { class: 'x', step: 3, rule: 'raise-word' },
  );
});

test('applyStep3: an injected word set is used instead of RAISE_WORDS (LOVO)', () => {
  const row = { method: 'PUT', operationId: 'updateSsoConfig', path: '/accounts/{id}' };
  assert.equal(applyStep3(row, new Set()), null);
  assert.deepEqual(applyStep3(row, new Set(['sso'])), { class: 'x', step: 3, rule: 'raise-word' });
});

test('wordsForStep3: includes a raise word buried mid-path, not just the lead token', () => {
  const words = wordsForStep3({ method: 'PUT', operationId: 'updateUser', path: '/users/{id}/permissions/{permId}' });
  assert.equal(words.includes('permissions'), true);
});

test('sourceForRule: floor rules', () => {
  assert.equal(sourceForRule('method'), 'floor');
  assert.equal(sourceForRule('method-floor'), 'floor');
  assert.equal(sourceForRule('floor-post'), 'floor');
});

test('sourceForRule: list rules', () => {
  assert.equal(sourceForRule('read-verb'), 'list');
  assert.equal(sourceForRule('read-verb-anywhere'), 'list');
  assert.equal(sourceForRule('modify-verb'), 'list');
  assert.equal(sourceForRule('modify-verb-summary'), 'list');
  assert.equal(sourceForRule('raise-word'), 'list');
});

test('sourceForRule: an unknown rule throws instead of defaulting', () => {
  assert.throws(() => sourceForRule('some-future-rule'));
});
