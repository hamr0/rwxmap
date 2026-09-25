// poc/d87/d87.test.mjs — tests for the D87 ladder. Only the step1 proof
// (below) imports from src/; every other test exercises poc/d87 files only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { tokensForRow, stemMatches } from './tokens.mjs';
import { step1 } from './step1.mjs';
import { step2, CANT_UNDO, REMOVES } from './step2.mjs';
import { KEEP_W } from './step3.mjs';
import { classifyRow } from './flow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('CANT_UNDO and KEEP_W are disjoint after stem matching', () => {
  for (const a of CANT_UNDO) {
    for (const b of KEEP_W) {
      assert.ok(!stemMatches(a, b) && !stemMatches(b, a), `${a} vs ${b} stem-match`);
    }
  }
});

test('REMOVES is a subset of CANT_UNDO', () => {
  for (const m of REMOVES) assert.ok(CANT_UNDO.has(m), `${m} not in CANT_UNDO`);
});

test('reader fix: DELETE method keeps delete as the lead token', () => {
  const tokens = tokensForRow({ method: 'DELETE', operationId: 'delete_files_id' });
  assert.deepEqual(tokens, ['delete', 'files', 'id']);
});

test('reader fix: POST deleteThing reads as a can-t-undo verb, x destructive', () => {
  const v = step2({ method: 'POST', operationId: 'deleteThing', summary: '' });
  assert.equal(v.class, 'x');
  assert.equal(v.destructive, true);
  assert.deepEqual(v.matched, ['delete']);
});

test('DELETE is always x with destructive true, even with a KEEP_W verb', () => {
  const v = classifyRow({ method: 'DELETE', operationId: 'updateThing', summary: '' });
  assert.equal(v.class, 'x');
  assert.equal(v.rule, 'method-delete');
  assert.equal(v.destructive, true);
});

test('PUT with a CANT_UNDO lead verb goes x by list', () => {
  const v = classifyRow({ method: 'PUT', operationId: 'RedactCommentAttachment', summary: '' });
  assert.equal(v.class, 'x');
  assert.equal(v.step, 2);
  assert.equal(v.source, 'list');
});

test('PUT with no CANT_UNDO lead verb floors at w', () => {
  const v = classifyRow({ method: 'PUT', operationId: 'UpdateWidget', summary: '' });
  assert.equal(v.class, 'w');
  assert.equal(v.rule, 'method-floor');
});

test('POST create floors at x (create is not in KEEP_W)', () => {
  const v = classifyRow({ method: 'POST', operationId: 'CreateWidget', summary: 'Create a widget' });
  assert.equal(v.class, 'x');
  assert.equal(v.rule, 'floor-post');
});

test('POST updateThing goes w by list', () => {
  const v = classifyRow({ method: 'POST', operationId: 'updateThing', summary: '' });
  assert.equal(v.class, 'w');
  assert.equal(v.step, 3);
  assert.equal(v.source, 'list');
  assert.deepEqual(v.matched, ['update']);
});

test('POST PostCharges, summary Create a charge, floors at x', () => {
  const v = classifyRow({ method: 'POST', operationId: 'PostCharges', summary: 'Create a charge' });
  assert.equal(v.class, 'x');
  assert.equal(v.rule, 'floor-post');
});

test('POST PostCustomers, summary Update a customer, goes w via modify-verb-summary', () => {
  const v = classifyRow({ method: 'POST', operationId: 'PostCustomers', summary: 'Update a customer' });
  assert.equal(v.class, 'w');
  assert.equal(v.rule, 'modify-verb-summary');
  assert.deepEqual(v.matched, ['update']);
});

test('GET is r', () => {
  const v = classifyRow({ method: 'GET', operationId: 'GetWidget', summary: '' });
  assert.equal(v.class, 'r');
  assert.equal(v.step, 1);
});

test('words injection: empty keepW drops POST updateThing to floor-post', () => {
  const v = classifyRow(
    { method: 'POST', operationId: 'updateThing', summary: '' },
    { keepW: new Set() },
  );
  assert.equal(v.class, 'x');
  assert.equal(v.rule, 'floor-post');
});

test('step1 matches src/step1.js on every row of the combined corpus', async () => {
  const { step1: srcStep1 } = await import('../../src/step1.js');
  const gzPath = path.join(__dirname, '..', '..', 'data', 'combined-2026-09-21', 'rows.json.gz');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(gzPath)));
  assert.equal(rows.length, 6557);
  let compared = 0;
  for (const row of rows) {
    const a = step1(row);
    const b = srcStep1(row);
    assert.deepEqual(a, b, `row ${row.row_id} diverged: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
    compared += 1;
  }
  assert.equal(compared, 6557);
});
