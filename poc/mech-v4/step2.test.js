import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step2, step2 as step2Full, floorPost, CANT_UNDO, REMOVES, CREDENTIAL_SET, CREDENTIAL_CHANGE_VERBS, PATH_X_WORDS } from './step2.js';
import { KEEP_W, CONTENT_W } from './step3.js';
import { stemMatches } from './tokens.js';

test('method-delete rule: DELETE always floors to x, destructive true, empty matched', () => {
  const v = step2({ method: 'DELETE', operationId: 'deleteWidget' });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true,
  });
});

test('method-delete rule: DELETE is x even with a KEEP_W verb in the operationId', () => {
  // DELETE beats every word (D87): it never even reaches a KEEP_W check.
  const v = step2({ method: 'DELETE', operationId: 'updateThing' });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true,
  });
});

test('cant-undo-verb rule: POST with a CANT_UNDO lead verb', () => {
  const v = step2({ method: 'POST', operationId: 'cancelSubscription' });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['cancel'],
  });
});

test('cant-undo-verb rule: PUT and PATCH are also eligible', () => {
  // Both "revoke" and "void" are REMOVES members, so both come back
  // destructive too.
  const put = step2({ method: 'PUT', operationId: 'revokeToken' });
  const patch = step2({ method: 'PATCH', operationId: 'voidInvoice' });
  assert.deepEqual(put, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['revoke'], destructive: true,
  });
  assert.deepEqual(patch, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['void'], destructive: true,
  });
});

test('cant-undo-verb rule: destructive true only when a REMOVES member matched', () => {
  const removeVerb = step2({ method: 'POST', operationId: 'purgeRecords' });
  const nonRemoveVerb = step2({ method: 'POST', operationId: 'cancelSubscription' });
  assert.ok(removeVerb);
  assert.ok(nonRemoveVerb);
  assert.equal(removeVerb.destructive, true);
  assert.equal(nonRemoveVerb.destructive, undefined);
});

test('cant-undo-verb-summary rule: bare-method lead falls back to the summary verb', () => {
  const v = step2({
    method: 'POST',
    operationId: 'PostTaxCalculations',
    summary: 'Cancel a tax calculation',
  });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'cant-undo-verb-summary', source: 'list', matched: ['cancel'],
  });
});

test('cant-undo-verb-summary fires only when the lead token is a bare method word', () => {
  const v = step2({
    method: 'POST',
    operationId: 'cancelWidget',
    summary: 'Delete a widget',
  });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['cancel'],
  });
});

test('D87 reader fix in action: POST deleteThing reads "delete" as its lead verb, x destructive', () => {
  const v = step2({ method: 'POST', operationId: 'deleteThing' });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['delete'], destructive: true,
  });
});

test('null for a GET row (step 2 never assigns r)', () => {
  assert.equal(step2({ method: 'GET', operationId: 'listWidgets' }), null);
});

test('null for a POST with no CANT_UNDO verb', () => {
  assert.equal(step2({ method: 'POST', operationId: 'createWidget' }), null);
});

test('no "whose" gate: a CANT_UNDO verb claims x regardless of who the row reaches (D87 drops OTHER_PARTY)', () => {
  const v = step2({ method: 'POST', operationId: 'removeUserFromTeam' });
  // "remove" is not a CANT_UNDO member (it moved to KEEP_W under D87), so
  // this specific row is unclaimed — but nothing about the OTHER_PARTY
  // gate blocks it; a CANT_UNDO verb below proves the point directly.
  assert.equal(v, null);
  const claimed = step2({ method: 'POST', operationId: 'cancelUserSubscription' });
  assert.deepEqual(claimed, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['cancel'],
  });
});

test('words injection overrides CANT_UNDO and REMOVES', () => {
  const custom = { cantUndo: new Set(['banana']), removes: new Set(['banana']) };
  const v = step2({ method: 'POST', operationId: 'bananaWidget' }, custom);
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['banana'], destructive: true,
  });

  // With the defaults, the same operationId is not claimed.
  assert.equal(step2({ method: 'POST', operationId: 'bananaWidget' }), null);
});

test('floorPost: the floor verdict always carries an empty matched list, class x, step 2', () => {
  assert.deepEqual(floorPost(), { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [] });
});

test('CANT_UNDO has 29 members, REMOVES has 6 and is a subset of CANT_UNDO', () => {
  assert.equal(CANT_UNDO.size, 29);
  assert.equal(REMOVES.size, 6);
  for (const m of REMOVES) assert.ok(CANT_UNDO.has(m));
});

test('CANT_UNDO and KEEP_W are disjoint under stem matching (no row can match both)', () => {
  for (const a of CANT_UNDO) {
    for (const b of KEEP_W) {
      assert.ok(!stemMatches(a, b) && !stemMatches(b, a), `${a} vs ${b} unexpectedly stem-match`);
    }
  }
});

// ---- credential-set (D131) ------------------------------------------------

test('credential-set endpoint form: PUT /users/{id}/password is x', () => {
  const v = step2({ method: 'PUT', path: '/users/{id}/password', operationId: 'updateUserPassword' });
  assert.deepEqual(v, { class: 'x', step: 2, rule: 'credential-set', source: 'list', matched: ['password'] });
});

test('credential-set change form: PATCH changePin, and a summary "Change PIN"', () => {
  assert.deepEqual(step2({ method: 'PATCH', path: '/cards/{id}', operationId: 'changePin' }), {
    class: 'x', step: 2, rule: 'credential-set', source: 'list', matched: ['pin'],
  });
  assert.deepEqual(step2({ method: 'PATCH', path: '/cards/{id}', operationId: 'changeCard', summary: 'Change PIN' }), {
    class: 'x', step: 2, rule: 'credential-set', source: 'list', matched: ['pin'],
  });
});

test('credential-set does not fire: plurals, trailing non-credential token, api keys, non-change lead', () => {
  // path-x-word is switched off here (empty list) so only credential-set is under test;
  // /api_keys/{id} would otherwise be claimed by path-x-word.
  const step2 = (row) => step2Full(row, { pathXWords: new Set() });
  assert.equal(step2({ method: 'PUT', path: '/users/{id}/passwords', operationId: 'putUserPasswords' }), null);
  assert.equal(step2({ method: 'PUT', path: '/boards/{id}/pins', operationId: 'putBoardPins' }), null);
  assert.equal(step2({ method: 'PUT', path: '/settings/password_rules', operationId: 'putPasswordRules' }), null);
  assert.equal(step2({ method: 'PUT', path: '/api_keys/{id}', operationId: 'putApiKey' }), null);
  assert.equal(step2({ method: 'PATCH', path: '/policies/{id}', operationId: 'updatePasswordPolicy', summary: 'Update the password policy' }), null);
});

test('credential-set does not fire on POST or GET (PUT/PATCH only)', () => {
  assert.equal(step2({ method: 'POST', path: '/users/{id}/password', operationId: 'createUserPassword' }), null);
  assert.equal(step2({ method: 'POST', path: '/cards/{id}', operationId: 'changePin' }), null);
  assert.equal(step2({ method: 'GET', path: '/users/{id}/password', operationId: 'putUserPassword' }), null);
});

test('credential-set: a CANT_UNDO lead verb keeps its own rule', () => {
  assert.deepEqual(step2({ method: 'PUT', path: '/users/{id}/password', operationId: 'resetPassword' }), {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['reset'],
  });
});

test('credential-set words injection overrides CREDENTIAL_SET and CREDENTIAL_CHANGE_VERBS', () => {
  // path-x-word is switched off (empty list) so only credential-set is under test.
  const off = { pathXWords: new Set() };
  const row = { method: 'PUT', path: '/users/{id}/secret', operationId: 'swapSecret' };
  assert.equal(step2(row, off), null);
  assert.deepEqual(step2(row, { ...off, credentialSet: new Set(['secret']) }), {
    class: 'x', step: 2, rule: 'credential-set', source: 'list', matched: ['secret'],
  });
  const change = { method: 'PATCH', path: '/cards/{id}', operationId: 'swapPin' };
  assert.equal(step2(change), null);
  assert.deepEqual(step2(change, { credentialChangeVerbs: new Set(['swap']) }), {
    class: 'x', step: 2, rule: 'credential-set', source: 'list', matched: ['pin'],
  });
  // An emptied set turns the rule off.
  assert.equal(step2({ method: 'PUT', path: '/users/{id}/password' }, { credentialSet: new Set() }), null);
});

test('CREDENTIAL_SET and CREDENTIAL_CHANGE_VERBS hold exactly the D131 members', () => {
  assert.deepEqual([...CREDENTIAL_SET].sort(), ['passcode', 'password', 'pin']);
  assert.deepEqual([...CREDENTIAL_CHANGE_VERBS].sort(), ['change', 'regen', 'regenerate']);
});

// ---- path-x-word rule (PUT/PATCH path words raise the method floor to x)

const pw = (method, path) => step2({ method, operationId: 'putThing', path });

test('path-x-word: fires on PUT/PATCH path words, class x, not destructive', () => {
  assert.deepEqual(pw('PUT', '/orgs/{org}/memberships/{u}'), {
    class: 'x', step: 2, rule: 'path-x-word', source: 'list', matched: ['member', 'membership'],
  });
  assert.deepEqual(pw('PATCH', '/webhooks/{id}'), {
    class: 'x', step: 2, rule: 'path-x-word', source: 'list', matched: ['hook', 'webhook'],
  });
});

test('path-x-word: glued match inside one token, and multi-word entries', () => {
  assert.deepEqual(pw('PUT', '/registrycredentials/{id}').matched, ['credential']);
  assert.ok(pw('PUT', '/files/{id}#add_shared_link').matched.includes('shared_link'));
  assert.ok(pw('PUT', '/a/{id}/apikeys').matched.includes('api_key'));
  assert.ok(pw('PUT', '/a/event-streams/{id}').matched.includes('event_stream'));
});

test('path-x-word: does not fire on other paths, a POST with no path word, or DELETE', () => {
  assert.equal(pw('PUT', '/boards/{id}/name'), null);
  assert.equal(pw('PUT', '/{role}/name'), null);
  assert.equal(pw('POST', '/boards'), null);
  const del = pw('DELETE', '/webhooks/{id}');
  assert.equal(del.rule, 'method-delete');
});

test('path-x-word: fires on POST too (after cant-undo; POST has no credential-set rule)', () => {
  assert.deepEqual(
    step2({ method: 'POST', operationId: 'assignRole', path: '/users/{id}/roles' }),
    { class: 'x', step: 2, rule: 'path-x-word', source: 'list', matched: ['role'] },
  );
  assert.equal(pw('POST', '/webhooks').rule, 'path-x-word');
  // cant-undo still runs first
  assert.equal(step2({ method: 'POST', operationId: 'revokeToken', path: '/tokens/{id}' }).rule, 'cant-undo-verb');
  // no credential-set on POST: a changePin POST with no path word is not claimed
  assert.equal(step2({ method: 'POST', operationId: 'changePin', path: '/cards/{id}/pin' }), null);
});

test('path-x-word: sso and policy are not in the list; 36 words', () => {
  assert.equal(PATH_X_WORDS.size, 36);
  assert.ok(!PATH_X_WORDS.has('sso'));
  assert.ok(!PATH_X_WORDS.has('policy'));
  assert.equal(pw('PUT', '/sso/{id}'), null);
  assert.equal(pw('PUT', '/policies/{id}/policy'), null);
});

test('path-x-word: an earlier step-2 rule keeps the row', () => {
  assert.equal(step2({ method: 'PUT', operationId: 'revokeToken', path: '/tokens/{id}' }).rule, 'cant-undo-verb');
});

test('CONTENT_W is disjoint from CANT_UNDO and KEEP_W under stem matching', () => {
  for (const c of CONTENT_W) {
    for (const other of [...CANT_UNDO, ...KEEP_W]) {
      assert.ok(!stemMatches(c, other) && !stemMatches(other, c), `${c} vs ${other} unexpectedly stem-match`);
    }
  }
});
