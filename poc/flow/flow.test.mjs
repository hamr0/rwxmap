import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRow, scoreRows } from './flow.mjs';
import { loadRows } from './corpus.mjs';

test('classifyRow: GET -> r via step 1', () => {
  const res = classifyRow({ method: 'GET', operationId: 'listThings', path: '/things' }, {});
  assert.deepEqual(res, { class: 'r', step: 1, rule: 'method', flag: '' });
});

test('classifyRow: PUT falls through step 1 to the floor, step 2', () => {
  const res = classifyRow({ method: 'PUT', operationId: 'updateThing', path: '/things/{id}' }, {});
  assert.deepEqual(res, { class: 'w', step: 2, rule: 'floor', flag: '' });
});

test('classifyRow: POST createThing falls through step 1 to the floor, step 3', () => {
  const res = classifyRow({ method: 'POST', operationId: 'createThing', path: '/things' }, {});
  assert.deepEqual(res, { class: 'x', step: 3, rule: 'floor', flag: '' });
});

test('classifyRow: DELETE falls through to the floor, step 2', () => {
  const res = classifyRow({ method: 'DELETE', operationId: 'deleteThing', path: '/things/{id}' }, {});
  assert.deepEqual(res, { class: 'w', step: 2, rule: 'floor', flag: '' });
});

test('classifyRow: PATCH falls through to the floor, step 2', () => {
  const res = classifyRow({ method: 'PATCH', operationId: 'patchThing', path: '/things/{id}' }, {});
  assert.deepEqual(res, { class: 'w', step: 2, rule: 'floor', flag: '' });
});

test('corpus integration: pins over all 5465 rows', () => {
  const { rows } = loadRows();
  const ledger = scoreRows(rows, {});
  assert.equal(ledger.step1.overTight, 49);
  assert.equal(ledger.step1.leaks, 0);
  assert.equal(ledger.floorGet.leaks, 17);
});

test('negative controls: not claimed by step 1', () => {
  const { rows } = loadRows();
  const clickToDial = rows.find((r) =>
    r.method === 'DELETE' && r.path === '/calls/{callId}' && r.operationId === 'terminateCall');
  const webrtc = rows.find((r) =>
    r.method === 'PUT' && r.path === '/sessions/{mediaSessionId}/status' && r.operationId === 'updateSessionStatus');
  assert.ok(clickToDial, 'expected to find the ClickToDial terminateCall row');
  assert.ok(webrtc, 'expected to find the WebRTC updateSessionStatus row');

  const clickToDialResult = classifyRow(clickToDial, {});
  const webrtcResult = classifyRow(webrtc, {});
  assert.notEqual(clickToDialResult.step, 1);
  assert.notEqual(webrtcResult.step, 1);
});
