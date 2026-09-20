import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  withSplitOperationId,
  splitTokens,
  tokensForRow,
  leadVerbForRow,
  stemMatches,
  matchesAnyStem,
  naiveSingular,
  summaryVerb,
  callerPhraseInText,
  headNounFromText,
  headNounForRow,
  operationIdHeadNoun,
  isJunkToken,
  buildJunkSet,
  nounsForRow,
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

test('leadVerbForRow: first token', () => {
  assert.equal(leadVerbForRow({ operationId: 'deleteDevice', method: 'DELETE' }), 'delete');
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

test('naiveSingular: access/classes/devices', () => {
  assert.equal(naiveSingular('access'), 'access'); // ends 'ss' -> unchanged
  assert.equal(naiveSingular('classes'), 'class'); // ends 'es' -> strip 2
  // naive: strips the last 2 chars for any 'es' ending, even when that
  // isn't a real -es plural (device -> devices -> 'devic', not 'device') —
  // this is the function's real, verbatim behaviour, not a test bug.
  assert.equal(naiveSingular('devices'), 'devic');
});

test('summaryVerb: first word, lowercased', () => {
  assert.equal(summaryVerb('Delete a widget.'), 'delete');
  assert.equal(summaryVerb(''), '');
});

test('callerPhraseInText: matches the verbatim phrase list', () => {
  assert.equal(callerPhraseInText('Retrieve data for the authenticated user'), true);
  assert.equal(callerPhraseInText('Delete a customer record'), false);
});

test('headNounFromText: Update device information -> device (steps back over generic tail)', () => {
  assert.equal(headNounFromText('Update device information'), 'device');
});

test('headNounForRow: applies naiveSingular on top of headNounFromText', () => {
  assert.equal(headNounForRow({ summary: 'Delete a customer' }), 'customer');
});

test('operationIdHeadNoun: updateSessionStatus -> session (steps back over generic tail)', () => {
  assert.equal(operationIdHeadNoun({ operationId: 'updateSessionStatus', method: 'PUT' }), 'session');
});

test('isJunkToken: placeholders, version tags, filler words', () => {
  assert.equal(isJunkToken('{id}'), true);
  assert.equal(isJunkToken('v1'), true);
  assert.equal(isJunkToken('10'), true);
  assert.equal(isJunkToken('for'), true);
  assert.equal(isJunkToken('device'), false);
});

test('buildJunkSet: flags a stem-artifact noun but not the longer real noun', () => {
  const rows = [
    { operationId: 'deleteDevice', method: 'DELETE', summary: 'Delete a device' },
    { operationId: 'deleteDevice', method: 'DELETE', summary: 'Delete a device' },
    { operationId: 'deleteDevics', method: 'DELETE', summary: 'Delete a devic' },
  ];
  const junkSet = buildJunkSet(rows);
  assert.equal(junkSet.has('devic'), true); // 'devic'+'e' = 'device' has a strictly higher count
  assert.equal(junkSet.has('device'), false);
});

test('buildJunkSet: too-short and stopword nouns are junk', () => {
  const rows = [
    { operationId: 'deleteId', method: 'DELETE', summary: 'Delete the id' },
  ];
  const junkSet = buildJunkSet(rows);
  assert.equal(junkSet.has('id'), true); // length < 3
  assert.equal(junkSet.has('the'), true); // stopword
});

test('nounsForRow: excludes junk tokens and given verb stems', () => {
  const junkSet = new Set();
  const verbStems = new Set(['delete']);
  const row = { operationId: 'deleteCustomerAccount', method: 'DELETE', summary: 'Delete a customer account' };
  const nouns = nounsForRow(row, junkSet, verbStems);
  assert.equal(nouns.has('delete'), false);
  assert.equal(nouns.has('customer'), true);
  assert.equal(nouns.has('account'), true);
});
