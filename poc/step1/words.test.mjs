import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  withSplitOperationId,
  splitTokens,
  tokensForRow,
  stemMatches,
  matchesAnyStem,
  leadVerbAfterModifiers,
} from './words.mjs';

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
