import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step3, KEEP_W } from './step3.js';

test('method-floor rule: PUT floors to w with an empty matched list', () => {
  const v = step3({ method: 'PUT', operationId: 'updateWidget' });
  assert.deepEqual(v, { class: 'w', step: 3, rule: 'method-floor', source: 'floor', matched: [] });
});

test('method-floor rule: PATCH also floors to w; DELETE does not (step 3 has no reach into DELETE)', () => {
  const patch = step3({ method: 'PATCH', operationId: 'patchWidget' });
  assert.deepEqual(patch, { class: 'w', step: 3, rule: 'method-floor', source: 'floor', matched: [] });
  assert.equal(step3({ method: 'DELETE', operationId: 'deleteWidget' }), null);
});

test('modify-verb rule: POST with a KEEP_W lead verb', () => {
  const v = step3({ method: 'POST', operationId: 'updateWidget' });
  assert.deepEqual(v, { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['update'] });
});

test('modify-verb-summary rule: bare-method lead falls back to the summary verb', () => {
  const v = step3({
    method: 'POST',
    operationId: 'PostLists',
    summary: 'Update a list',
  });
  assert.deepEqual(v, { class: 'w', step: 3, rule: 'modify-verb-summary', source: 'list', matched: ['update'] });
});

test('modify-verb-summary fires only when the lead token is a bare method word', () => {
  const v = step3({
    method: 'POST',
    operationId: 'updateWidget',
    summary: 'Remove a widget',
  });
  assert.deepEqual(v, { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['update'] });
});

test('null for a GET row (step 3 never assigns r)', () => {
  assert.equal(step3({ method: 'GET', operationId: 'listWidgets' }), null);
});

test('null for a POST with no KEEP_W verb', () => {
  assert.equal(step3({ method: 'POST', operationId: 'createWidget' }), null);
});

test('deactivate/change/swap/archive/disable are gone from KEEP_W (D89, measured below the adoption bar)', () => {
  for (const removed of ['deactivate', 'change', 'swap', 'archive', 'disable']) {
    assert.equal(KEEP_W.has(removed), false, `${removed} should not be in KEEP_W`);
    assert.equal(step3({ method: 'POST', operationId: `${removed}Thing` }), null);
  }
});

test('create is not adopted into KEEP_W (measured 503 fixed / 72 leaks = 6.99, short of the bar of 10)', () => {
  assert.equal(KEEP_W.has('create'), false);
  assert.equal(step3({ method: 'POST', operationId: 'createThing' }), null);
});

test('words injection overrides KEEP_W', () => {
  const custom = { keepW: new Set(['banana']) };
  const v = step3({ method: 'POST', operationId: 'bananaWidget' }, custom);
  assert.deepEqual(v, { class: 'w', step: 3, rule: 'modify-verb', source: 'list', matched: ['banana'] });

  // With the defaults, the same operationId is not claimed.
  assert.equal(step3({ method: 'POST', operationId: 'bananaWidget' }), null);
});

test('KEEP_W has 14 members, verbatim', () => {
  assert.equal(KEEP_W.size, 14);
  for (const word of [
    'update', 'remove', 'add', 'attach', 'assign', 'activate', 'unarchive',
    'move', 'restore', 'pause', 'unpause', 'enable', 'modify', 'suspend',
  ]) {
    assert.equal(KEEP_W.has(word), true, `${word} should be in KEEP_W`);
  }
});
