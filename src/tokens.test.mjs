import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitTokens,
  tokensForRow,
  stemMatches,
  matchesAnyStem,
  leadVerbAfterModifiers,
} from './tokens.mjs';

// --- ported from poc/step1/words.test.mjs --------------------------------

test('splitTokens: camelCase and separators', () => {
  assert.deepEqual(splitTokens('deleteDevice'), ['delete', 'device']);
  assert.deepEqual(splitTokens('delete_files_id'), ['delete', 'files', 'id']);
  assert.deepEqual(splitTokens(''), []);
});

test('tokensForRow: gists/unstar (path-shaped operationId, not method-stripped)', () => {
  const tokens = tokensForRow({ operationId: 'gists/unstar', method: 'POST' });
  assert.deepEqual(tokens, ['gists', 'unstar']);
});

test('tokensForRow: delete_files_id with method DELETE strips the redundant method prefix', () => {
  // Stripping is observable directly in the token array: "delete" is gone
  // from the front, leaving only the rest of the operationId.
  const tokens = tokensForRow({ operationId: 'delete_files_id', method: 'DELETE' });
  assert.deepEqual(tokens, ['files', 'id']);
});

test('tokensForRow: deleteDevice keeps the camelCase verb as lead (not stripped)', () => {
  // No strip: the lead verb "delete" stays as tokens[0].
  const tokens = tokensForRow({ operationId: 'deleteDevice', method: 'DELETE' });
  assert.deepEqual(tokens, ['delete', 'device']);
});

test('stemMatches: CVC doubling on both -ing and -ed (cancel/cancelling, cancel/cancelled)', () => {
  assert.equal(stemMatches('cancelling', 'cancel'), true);
  assert.equal(stemMatches('cancelled', 'cancel'), true);
});

test('stemMatches: consonant+y -> both -ies and -ied (apply/applies, apply/applied)', () => {
  assert.equal(stemMatches('applies', 'apply'), true);
  assert.equal(stemMatches('applied', 'apply'), true);
});

test('stemMatches: fix/fixing (literal suffix)', () => {
  assert.equal(stemMatches('fixing', 'fix'), true);
});

test('matchesAnyStem: matches against a set of stems', () => {
  assert.equal(matchesAnyStem('cancelled', new Set(['terminate', 'cancel'])), true);
  assert.equal(matchesAnyStem('reading', new Set(['terminate', 'cancel'])), false);
});

test('leadVerbAfterModifiers: no modifier -> the lead verb itself', () => {
  assert.equal(leadVerbAfterModifiers({ operationId: 'CreateThing', method: 'POST' }), 'create');
});

test('leadVerbAfterModifiers: one modifier is skipped', () => {
  assert.equal(leadVerbAfterModifiers({ operationId: 'BulkRetrieveCustomers', method: 'POST' }), 'retrieve');
});

test('leadVerbAfterModifiers: two modifiers in a row are skipped', () => {
  assert.equal(
    leadVerbAfterModifiers({ operationId: 'DeprecatedBatchRetrieveInventoryCounts', method: 'POST' }),
    'retrieve',
  );
});

test('leadVerbAfterModifiers: modifier followed by a separator is skipped', () => {
  assert.equal(leadVerbAfterModifiers({ operationId: 'beta_Getinputtokencounts', method: 'POST' }), 'getinputtokencounts');
});

test('leadVerbAfterModifiers: a row that is only modifiers -> empty string', () => {
  assert.equal(leadVerbAfterModifiers({ operationId: 'bulk_batch', method: 'POST' }), '');
});

// --- additional coverage --------------------------------------------------

test('tokensForRow: a digit immediately after an explicit separator still strips (get_2fa)', () => {
  // get_2fa: the separator "_" comes right after the method word, so rest
  // ("_2fa") matches METHOD_PREFIX_SEPARATOR on the "_" and the prefix is
  // stripped. The digit itself plays no role in the match here.
  const tokens = tokensForRow({ operationId: 'get_2fa', method: 'GET' });
  assert.deepEqual(tokens, ['2fa']);
});

test('tokensForRow: a digit glued directly to the method word with no separator is not stripped', () => {
  // get2x tokenizes as a single token ("get2x"), since splitTokens only
  // inserts a boundary before an UPPERCASE letter, never before a bare
  // digit. tokens[0] ("get2x") then never equals the method word ("get"),
  // so METHOD_PREFIX_SEPARATOR is never even reached for a glued digit.
  const tokens = tokensForRow({ operationId: 'get2x', method: 'GET' });
  assert.deepEqual(tokens, ['get2x']);
});

test('tokensForRow: empty operationId falls back to the last non-{param} path segment', () => {
  const tokens = tokensForRow({ operationId: '', method: 'GET', path: '/users/{userId}/orders' });
  assert.deepEqual(tokens, ['orders']);
});

test('tokensForRow: whitespace-only operationId also falls back to the path', () => {
  const tokens = tokensForRow({ operationId: '   ', method: 'GET', path: '/accounts/{id}/balance' });
  assert.deepEqual(tokens, ['balance']);
});

test('tokensForRow: collapses a run of whitespace between words in operationId (internal split, no separate export)', () => {
  // withSplitOperationId is module-private; its behaviour is only
  // observable through tokensForRow's output. "delete team member" has no
  // method-word separator character of its own, so this also pins that the
  // split happens before tokenizing, not after.
  const tokens = tokensForRow({ operationId: 'delete team member', method: 'POST' });
  assert.deepEqual(tokens, ['delete', 'team', 'member']);
});

test('tokensForRow: collapses runs of multiple / or whitespace characters together (internal split, no separate export)', () => {
  const a = tokensForRow({ operationId: '  gists // unstar  ', method: 'POST' });
  assert.deepEqual(a, ['gists', 'unstar']);
  const b = tokensForRow({ operationId: 'a///b   c', method: 'POST' });
  assert.deepEqual(b, ['a', 'b', 'c']);
});

test('stemMatches: silent-e drop before -ing (create/creating)', () => {
  assert.equal(stemMatches('creating', 'create'), true);
});

test('stemMatches: startsWith anchor rejects a different prefix even with a shared suffix', () => {
  assert.equal(stemMatches('terminating', 'create'), false);
  assert.equal(stemMatches('recreate', 'create'), false);
});

test('stemMatches: e suffix, currently unreached on the corpus but must keep working (invitee/invite)', () => {
  assert.equal(stemMatches('invitee', 'invite'), true);
});

test('stemMatches: es suffix, currently unreached on the corpus but must keep working (searches/search)', () => {
  assert.equal(stemMatches('searches', 'search'), true);
});
