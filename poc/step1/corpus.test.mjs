import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRows, EXPECTED_ROWS } from './corpus.mjs';

const rows = loadRows();

test('corpus: 4171 rows, 15 providers, every row has a truth class', () => {
  assert.equal(rows.length, EXPECTED_ROWS);
  assert.equal(rows.length, 4171);
  assert.equal(new Set(rows.map((r) => r.provider)).size, 15);
  assert.equal(rows.filter((r) => !['r', 'w', 'x'].includes(r.truth)).length, 0);
});

test('corpus: every row carries its text fields and a row id', () => {
  for (const r of rows) {
    assert.match(r.rowId, /^r\d{4}$/);
    assert.equal(typeof r.summary, 'string');
    assert.equal(typeof r.description, 'string');
    assert.notEqual(r.method, '');
    assert.notEqual(r.path, '');
  }
});

test('corpus: truth counts per method are the pinned numbers', () => {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.method)) by.set(r.method, { n: 0, r: 0, w: 0, x: 0 });
    const c = by.get(r.method);
    c.n += 1;
    c[r.truth] += 1;
  }
  assert.deepEqual(by.get('GET'), { n: 1960, r: 1958, w: 1, x: 1 });
  assert.deepEqual(by.get('POST'), { n: 1309, r: 124, w: 381, x: 804 });
  assert.deepEqual(by.get('PUT'), { n: 345, r: 0, w: 320, x: 25 });
  assert.deepEqual(by.get('DELETE'), { n: 473, r: 0, w: 434, x: 39 });
  assert.deepEqual(by.get('PATCH'), { n: 84, r: 0, w: 82, x: 2 });
  // No HEAD or OPTIONS operations exist in this corpus.
  assert.equal(by.has('HEAD'), false);
  assert.equal(by.has('OPTIONS'), false);
});
