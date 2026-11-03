import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wordsInTokens, pathTokens, credWords, fireWords, raise, outcome, endpointWords, CANDIDATES, tally, lovo,
} from './score.mjs';

test('nouns: bare, plural, api/app key bigrams', () => {
  assert.deepEqual([...wordsInTokens(['update', 'api', 'keys'])], ['apikey']);
  assert.deepEqual([...wordsInTokens(['app', 'key'])], ['appkey']);
  assert.deepEqual([...wordsInTokens(['passwords', 'tokens'])].sort(), ['password', 'token']);
  assert.deepEqual([...wordsInTokens(['key', 'pinned', 'tokenize'])], []);
});

test('path tokens skip {param} segments', () => {
  assert.deepEqual(pathTokens('/v1/{tokenId}/api_keys'), ['v1', 'api', 'keys']);
});

test('C1 reads operationId + path only; C2 adds summary', () => {
  const row = { method: 'PUT', path: '/users/{id}', operationId: 'updateUser', summary: 'Change password' };
  assert.equal(credWords(row, false).size, 0);
  assert.deepEqual([...credWords(row, true)], ['password']);
});

test('method scope and read-lead exclusion', () => {
  const put = { method: 'PUT', path: '/x/password', operationId: 'setPassword' };
  assert.deepEqual(fireWords(put, CANDIDATES.C1).words, ['password']);
  assert.deepEqual(fireWords({ ...put, method: 'POST' }, CANDIDATES.C1).words, []);
  assert.deepEqual(fireWords({ ...put, method: 'POST' }, CANDIDATES.C3).words, ['password']);
  const read = { method: 'POST', path: '/t', operationId: 'introspectToken' };
  assert.deepEqual(fireWords(read, CANDIDATES.C3), { words: [], excluded: true });
});

test('V2 endpoint: last literal segment must end in the noun', () => {
  assert.deepEqual([...endpointWords({ path: '/users/{id}/password' })], ['password']);
  assert.equal(endpointWords({ path: '/settings/password_rules' }).size, 0);
  assert.equal(endpointWords({ path: '/api_keys/{id}' }).size, 0);
  assert.deepEqual([...endpointWords({ path: '/agents/api_keys' })], ['apikey']);
});

test('raise never lowers', () => {
  assert.equal(raise('x', false), 'x');
  assert.equal(raise('w', true), 'x');
  assert.equal(raise('r', false), 'r');
  assert.equal(outcome('w', 'x'), 'leak');
  assert.equal(outcome('x', 'w'), 'over');
});

test('tally splits already-x, right, wrong w/r', () => {
  const t = tally([
    { mech: 'x', truth: 'w' }, { mech: 'w', truth: 'x' }, { mech: 'w', truth: 'w' }, { mech: 'r', truth: 'r' },
  ], 'mech');
  assert.deepEqual([t.fires, t.alreadyX, t.right, t.wrongW, t.wrongR, t.fromR], [4, 1, 1, 1, 1, 1]);
});

test('lovo drops a word that is wrong on the other vendors', () => {
  const rows = [
    { provider: 'a', mech: 'w', truth: 'w', words: ['token'] },
    { provider: 'b', mech: 'w', truth: 'w', words: ['token'] },
    { provider: 'c', mech: 'w', truth: 'x', words: ['token'] },
  ];
  // held-out c: train token 0 right / 2 wrong -> dropped; a and b: 1/1 -> kept.
  const { pooled } = lovo(rows, false);
  assert.deepEqual([pooled.moved, pooled.right, pooled.wrong], [2, 0, 2]);
});
