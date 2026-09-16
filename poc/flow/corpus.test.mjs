import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRows } from './corpus.mjs';

test('loadRows: 5465 rows, 332 vendors', () => {
  const { rows, vendors } = loadRows();
  assert.equal(rows.length, 5465);
  assert.equal(vendors.length, 332);
});

test('loadRows: negative control — ClickToDial DELETE /calls/{callId} terminateCall', () => {
  const { rows } = loadRows();
  const hit = rows.find((r) =>
    r.method === 'DELETE' &&
    r.path === '/calls/{callId}' &&
    r.operationId === 'terminateCall');
  assert.ok(hit, 'expected to find the ClickToDial terminateCall row');
  assert.equal(hit.gt_class, 'x');
});

test('loadRows: negative control — WebRTC PUT /sessions/{mediaSessionId}/status updateSessionStatus', () => {
  const { rows } = loadRows();
  const hit = rows.find((r) =>
    r.method === 'PUT' &&
    r.path === '/sessions/{mediaSessionId}/status' &&
    r.operationId === 'updateSessionStatus');
  assert.ok(hit, 'expected to find the WebRTC updateSessionStatus row');
  assert.equal(hit.gt_class, 'x');
});

test('loadRows: rows carry exactly the expected field set', () => {
  const { rows } = loadRows();
  const expected = ['set', 'vendor', 'method', 'path', 'operationId', 'summary', 'description', 'gt_class', 'confidence'].sort();
  const actual = Object.keys(rows[0]).sort();
  assert.deepEqual(actual, expected);
});
