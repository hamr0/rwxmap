import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rowTokens, profileScore, steeredFloor } from './profile.mjs';
import { tally } from './score.mjs';

// --- rowTokens ---

test('rowTokens splits camelCase boundaries', () => {
  const toks = rowTokens({ path: '', operationId: 'updateUserPassword', summary: '' });
  assert.ok(toks.includes('update'));
  assert.ok(toks.includes('user'));
  assert.ok(toks.includes('password'));
});

test('rowTokens splits punctuation and path segments', () => {
  const toks = rowTokens({ path: '/orgs/{org}/members', operationId: '', summary: '' });
  assert.ok(toks.includes('orgs'));
  assert.ok(toks.includes('org'));
  assert.ok(toks.includes('members'));
  assert.ok(!toks.includes('{org}'));
});

test('rowTokens drops short and pure-numeric tokens', () => {
  const toks = rowTokens({ path: '/v2/ab/123', operationId: 'ok', summary: 'go to it' });
  assert.ok(!toks.includes('v2'));
  assert.ok(!toks.includes('ab'));
  assert.ok(!toks.includes('123'));
  assert.ok(!toks.includes('ok'));
  assert.ok(!toks.includes('go'));
});

test('rowTokens dedupes', () => {
  const toks = rowTokens({ path: '/user/user', operationId: 'getUser', summary: 'user' });
  const count = toks.filter((t) => t === 'user').length;
  assert.equal(count, 1);
});

// --- profileScore ---

test('profileScore is 0 for a document with no signal words', () => {
  const rows = [
    { path: '/widgets', operationId: 'listWidgets', summary: 'List widgets' },
    { path: '/widgets/{id}', operationId: 'getWidget', summary: 'Get a widget' },
  ];
  assert.equal(profileScore(rows), 0);
});

test('profileScore is 1.0 when every row has a signal word', () => {
  const rows = [
    { path: '/users', operationId: 'listUsers', summary: 'List users' },
    { path: '/users/{id}/roles', operationId: 'getUserRoles', summary: 'Get roles' },
  ];
  assert.equal(profileScore(rows), 1);
});

test('profileScore returns a known fraction in between', () => {
  const rows = [
    { path: '/users', operationId: 'listUsers', summary: 'List users' }, // hit
    { path: '/widgets', operationId: 'listWidgets', summary: 'List widgets' }, // miss
    { path: '/widgets/{id}', operationId: 'getWidget', summary: 'Get a widget' }, // miss
    { path: '/tokens', operationId: 'listTokens', summary: 'List tokens' }, // hit
  ];
  assert.equal(profileScore(rows), 0.5);
});

// --- steeredFloor ---

test('steeredFloor leaves POST at x and GET at r regardless of score/threshold', () => {
  assert.equal(steeredFloor('POST', 0, 0), 'x');
  assert.equal(steeredFloor('POST', 1, 2), 'x');
  assert.equal(steeredFloor('GET', 0, 0), 'r');
  assert.equal(steeredFloor('GET', 1, 2), 'r');
});

test('steeredFloor flips PUT/DELETE/PATCH at or above the threshold', () => {
  assert.equal(steeredFloor('PUT', 0.5, 0.5), 'x');
  assert.equal(steeredFloor('DELETE', 0.6, 0.5), 'x');
  assert.equal(steeredFloor('PATCH', 1.0, 0.5), 'x');
});

test('steeredFloor leaves PUT/DELETE/PATCH at w below the threshold', () => {
  assert.equal(steeredFloor('PUT', 0.49, 0.5), 'w');
  assert.equal(steeredFloor('DELETE', 0, 0.5), 'w');
  assert.equal(steeredFloor('PATCH', 0.1, 0.5), 'w');
});

test('steeredFloor reproduces the original floor exactly for a threshold above 1', () => {
  assert.equal(steeredFloor('PUT', 1, 1.5), 'w');
  assert.equal(steeredFloor('DELETE', 1, 1.5), 'w');
  assert.equal(steeredFloor('PATCH', 1, 1.5), 'w');
  assert.equal(steeredFloor('POST', 1, 1.5), 'x');
  assert.equal(steeredFloor('GET', 1, 1.5), 'r');
});

// --- tally ---

test('tally counts a leak (predicted looser than truth)', () => {
  const t = tally(['w'], ['x']);
  assert.equal(t.leaks, 1);
  assert.equal(t.overTight, 0);
  assert.equal(t.exact, 0);
});

test('tally counts an over-tight (predicted tighter than truth)', () => {
  const t = tally(['x'], ['w']);
  assert.equal(t.overTight, 1);
  assert.equal(t.leaks, 0);
  assert.equal(t.exact, 0);
});

test('tally counts exact matches and mixes correctly', () => {
  const t = tally(['r', 'w', 'x', 'w'], ['r', 'x', 'x', 'r']);
  assert.equal(t.n, 4);
  assert.equal(t.exact, 2); // r/r, x/x
  assert.equal(t.leaks, 1); // w predicted, x truth
  assert.equal(t.overTight, 1); // w predicted, r truth
});
