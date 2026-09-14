import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRow, scoreRows, buildContext } from './flow.mjs';
import { loadRows } from './corpus.mjs';

test('classifyRow: GET -> r via step 1', () => {
  const res = classifyRow({ method: 'GET', operationId: 'listThings', path: '/things' }, {});
  assert.deepEqual(res, { class: 'r', step: 1, rule: 'method', flag: '' });
});

test('classifyRow: PUT falls through step 1 into step 2 (no evidence -> x-pile)', () => {
  const ctx = { nounsOf: () => new Set(), otherNounsFor: () => new Set(), yoursFor: () => new Set() };
  const res = classifyRow({ method: 'PUT', operationId: 'updateThing', path: '/things/{id}' }, ctx);
  assert.deepEqual(res, { class: 'w', step: 2, rule: 'floor', flag: 'x-pile' });
});

test('classifyRow: POST createThing falls through step 1 and step 2 to the step 3 floor', () => {
  const res = classifyRow({ method: 'POST', operationId: 'createThing', path: '/things' }, {});
  assert.deepEqual(res, { class: 'x', step: 3, rule: 'floor', flag: '' });
});

test('classifyRow: DELETE falls through step 1 into step 2 (no evidence -> x-pile)', () => {
  const ctx = { nounsOf: () => new Set(), otherNounsFor: () => new Set(), yoursFor: () => new Set() };
  const res = classifyRow({ method: 'DELETE', operationId: 'deleteThing', path: '/things/{id}' }, ctx);
  assert.deepEqual(res, { class: 'w', step: 2, rule: 'floor', flag: 'x-pile' });
});

test('classifyRow: PATCH falls through step 1 into step 2 (no evidence -> x-pile)', () => {
  const ctx = { nounsOf: () => new Set(), otherNounsFor: () => new Set(), yoursFor: () => new Set() };
  const res = classifyRow({ method: 'PATCH', operationId: 'patchThing', path: '/things/{id}' }, ctx);
  assert.deepEqual(res, { class: 'w', step: 2, rule: 'floor', flag: 'x-pile' });
});

test('corpus integration: pins over all 5465 rows', () => {
  const { rows, vendors } = loadRows();
  const ctx = buildContext(rows, vendors);
  const ledger = scoreRows(rows, ctx);

  assert.equal(ledger.step1.overTight, 49);
  assert.equal(ledger.step1.leaks, 0);
  assert.equal(ledger.floorGet.leaks, 17);

  assert.equal(ledger.step2.falseAlarms, 803);
  assert.equal(ledger.step2.leaks, 211);
  assert.equal(ledger.step2.xPile.rows, 2441);
  assert.equal(ledger.step2.xPile.leaks, 192);

  assert.equal(ledger.exact, 4282);
  assert.equal(ledger.leaks, 228);
  assert.equal(ledger.overTight, 955);

  assert.equal(ledger.byMethod.GET.leaks, 17);
  assert.equal(ledger.byMethod.GET.overTight, 0);
  assert.equal(ledger.byMethod.POST.leaks, 0);
  assert.equal(ledger.byMethod.POST.overTight, 127);
  assert.equal(ledger.byMethod.PUT.leaks, 93);
  assert.equal(ledger.byMethod.PUT.overTight, 305);
  assert.equal(ledger.byMethod.DELETE.leaks, 76);
  assert.equal(ledger.byMethod.DELETE.overTight, 424);
  assert.equal(ledger.byMethod.PATCH.leaks, 42);
  assert.equal(ledger.byMethod.PATCH.overTight, 99);
});

test('negative controls: both come out x', () => {
  const { rows, vendors } = loadRows();
  const ctx = buildContext(rows, vendors);
  const clickToDial = rows.find((r) =>
    r.method === 'DELETE' && r.path === '/calls/{callId}' && r.operationId === 'terminateCall');
  const webrtc = rows.find((r) =>
    r.method === 'PUT' && r.path === '/sessions/{mediaSessionId}/status' && r.operationId === 'updateSessionStatus');
  assert.ok(clickToDial, 'expected to find the ClickToDial terminateCall row');
  assert.ok(webrtc, 'expected to find the WebRTC updateSessionStatus row');

  assert.equal(classifyRow(clickToDial, ctx).class, 'x');
  assert.equal(classifyRow(webrtc, ctx).class, 'x');
});
