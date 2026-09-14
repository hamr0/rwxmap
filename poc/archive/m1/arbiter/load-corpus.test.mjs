// Proves data/corpus/labelled.csv (read via loadLabelledCorpus()) is a
// faithful, lossless copy of what the four existing loaders in
// load-sets.mjs produce today — same row count, and for every
// (set, repo, path, method, operationId) key the same gt_class, summary,
// description and method. Zero mismatches expected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLabelledCorpus } from './load-corpus.mjs';
import {
  loadCensusRows,
  loadHoldout3,
  loadHoldout4,
  loadHoldout5,
} from './load-sets.mjs';

function key(row) {
  return [row.set, row.repo, row.path, row.method, row.operationId].join('|');
}

function loadExpectedRows() {
  const rows = [];
  rows.push(...loadCensusRows());
  for (const loader of [loadHoldout3, loadHoldout4, loadHoldout5]) {
    const loaded = loader();
    if (loaded === null) continue;
    rows.push(...loaded);
  }
  return rows;
}

test('loadLabelledCorpus row count matches the four existing loaders combined', () => {
  const expected = loadExpectedRows();
  const actual = loadLabelledCorpus();
  assert.equal(actual.length, expected.length);
});

test('loadLabelledCorpus has no duplicate keys', () => {
  const actual = loadLabelledCorpus();
  const seen = new Set();
  const dupes = [];
  for (const row of actual) {
    const k = key(row);
    if (seen.has(k)) dupes.push(k);
    seen.add(k);
  }
  assert.equal(dupes.length, 0, `duplicate keys: ${dupes.slice(0, 5).join(', ')}`);
});

test('loadLabelledCorpus matches gt_class, summary, description, method for every key', () => {
  const expected = loadExpectedRows();
  const actual = loadLabelledCorpus();

  const expectedIndex = new Map();
  for (const row of expected) expectedIndex.set(key(row), row);

  const actualIndex = new Map();
  for (const row of actual) actualIndex.set(key(row), row);

  const mismatches = [];
  const missingInActual = [];
  const extraInActual = [];

  for (const [k, exp] of expectedIndex) {
    const act = actualIndex.get(k);
    if (!act) { missingInActual.push(k); continue; }
    const fields = ['gt_class', 'summary', 'description', 'method'];
    for (const f of fields) {
      const expVal = exp[f] || '';
      const actVal = act[f] || '';
      if (expVal !== actVal) {
        mismatches.push(`${k} field=${f} expected=${JSON.stringify(expVal)} actual=${JSON.stringify(actVal)}`);
      }
    }
  }

  for (const k of actualIndex.keys()) {
    if (!expectedIndex.has(k)) extraInActual.push(k);
  }

  const report = [
    ...missingInActual.slice(0, 5).map((k) => `missing: ${k}`),
    ...extraInActual.slice(0, 5).map((k) => `extra: ${k}`),
    ...mismatches.slice(0, 5),
  ].join('\n');

  assert.equal(missingInActual.length, 0, `rows missing from corpus:\n${report}`);
  assert.equal(extraInActual.length, 0, `rows extra in corpus:\n${report}`);
  assert.equal(mismatches.length, 0, `field mismatches:\n${report}`);
});
