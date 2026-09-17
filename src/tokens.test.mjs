import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  withSplitOperationId,
  splitTokens,
  tokensForRow,
  stemMatches,
  matchesAnyStem,
  leadVerbAfterModifiers,
} from './tokens.mjs';

// --- ported from poc/step1/words.test.mjs --------------------------------

test('withSplitOperationId: collapses / and whitespace to _', () => {
  assert.equal(withSplitOperationId({ operationId: 'gists/unstar' }).operationId, 'gists_unstar');
  assert.equal(withSplitOperationId({ operationId: 'delete team member' }).operationId, 'delete_team_member');
  assert.equal(withSplitOperationId({ operationId: '  ' }).operationId, '');
});

test('splitTokens: camelCase and separators', () => {
  assert.deepEqual(splitTokens('deleteDevice'), ['delete', 'device']);
  assert.deepEqual(splitTokens('delete_files_id'), ['delete', 'files', 'id']);
  assert.deepEqual(splitTokens(''), []);
});

test('tokensForRow: gists/unstar (path-shaped operationId, not method-stripped)', () => {
  const { tokens, stripped } = tokensForRow({ operationId: 'gists/unstar', method: 'POST' });
  assert.deepEqual(tokens, ['gists', 'unstar']);
  assert.equal(stripped, false);
});

test('tokensForRow: delete_files_id with method DELETE strips the redundant method prefix', () => {
  const { tokens, stripped } = tokensForRow({ operationId: 'delete_files_id', method: 'DELETE' });
  assert.deepEqual(tokens, ['files', 'id']);
  assert.equal(stripped, true);
});

test('tokensForRow: deleteDevice keeps the camelCase verb as lead (not stripped)', () => {
  const { tokens, stripped } = tokensForRow({ operationId: 'deleteDevice', method: 'DELETE' });
  assert.deepEqual(tokens, ['delete', 'device']);
  assert.equal(stripped, false);
});

test('stemMatches: cancel/cancelling (CVC doubling)', () => {
  assert.equal(stemMatches('cancelling', 'cancel'), true);
});

test('stemMatches: apply/applies (consonant+y -> ies)', () => {
  assert.equal(stemMatches('applies', 'apply'), true);
});

test('stemMatches: fix/fixing (literal suffix)', () => {
  assert.equal(stemMatches('fixing', 'fix'), true);
});

test('stemMatches: false on a different prefix', () => {
  assert.equal(stemMatches('revoke', 'invok'), false);
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

test('tokensForRow: camelCase-continuation carve-out, delete_files_id vs deleteDevice', () => {
  // delete_files_id: separator right after the method word -> stripped.
  const a = tokensForRow({ operationId: 'delete_files_id', method: 'DELETE' });
  assert.deepEqual(a.tokens, ['files', 'id']);
  assert.equal(a.stripped, true);
  // deleteDevice: uppercase letter right after the method word (camelCase
  // continuation) -> verb kept, not stripped.
  const b = tokensForRow({ operationId: 'deleteDevice', method: 'DELETE' });
  assert.deepEqual(b.tokens, ['delete', 'device']);
  assert.equal(b.stripped, false);
});

test('tokensForRow: a digit immediately after an explicit separator still strips (get_2fa)', () => {
  // METHOD_PREFIX_SEPARATOR accepts a bare digit as well as _/-/. . In
  // practice a digit can only ever appear as the first character of `rest`
  // when it follows an explicit separator (get_2fa -> rest = "_2fa"), since
  // splitTokens glues a digit to the preceding lowercase run with no
  // separator (get2fa stays one token, "get2fa", and tokens[0] then never
  // equals the bare method word). This still exercises the strip path.
  const { tokens, stripped } = tokensForRow({ operationId: 'get_2fa', method: 'GET' });
  assert.deepEqual(tokens, ['2fa']);
  assert.equal(stripped, true);
});

test('tokensForRow: a digit glued directly to the method word with no separator is not stripped', () => {
  // get2x tokenizes as a single token ("get2x"), since splitTokens only
  // inserts a boundary before an UPPERCASE letter, never before a bare
  // digit. tokens[0] ("get2x") then never equals the method word ("get"),
  // so the digit branch of METHOD_PREFIX_SEPARATOR is unreachable for
  // method-prefix stripping.
  const { tokens, stripped } = tokensForRow({ operationId: 'get2x', method: 'GET' });
  assert.deepEqual(tokens, ['get2x']);
  assert.equal(stripped, false);
});

test('tokensForRow: empty operationId falls back to the last non-{param} path segment', () => {
  const { tokens, stripped } = tokensForRow({ operationId: '', method: 'GET', path: '/users/{userId}/orders' });
  assert.deepEqual(tokens, ['orders']);
  assert.equal(stripped, false);
});

test('tokensForRow: whitespace-only operationId also falls back to the path', () => {
  const { tokens, stripped } = tokensForRow({ operationId: '   ', method: 'GET', path: '/accounts/{id}/balance' });
  assert.deepEqual(tokens, ['balance']);
  assert.equal(stripped, false);
});

test('withSplitOperationId: collapses runs of / and whitespace together', () => {
  assert.equal(withSplitOperationId({ operationId: '  gists // unstar  ' }).operationId, 'gists_unstar');
  assert.equal(withSplitOperationId({ operationId: 'a///b   c' }).operationId, 'a_b_c');
});

test('stemMatches: silent-e drop before -ing (create/creating)', () => {
  assert.equal(stemMatches('creating', 'create'), true);
});

test('stemMatches: consonant+y -> ied (apply/applied)', () => {
  assert.equal(stemMatches('applied', 'apply'), true);
});

test('stemMatches: CVC doubling on -ed (cancel/cancelled)', () => {
  assert.equal(stemMatches('cancelled', 'cancel'), true);
});

test('stemMatches: startsWith anchor rejects a different prefix even with a shared suffix', () => {
  assert.equal(stemMatches('terminating', 'create'), false);
  assert.equal(stemMatches('recreate', 'create'), false);
});
