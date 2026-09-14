import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify as classifyC11 } from './c11.mjs';
import { classify as classifyC13, stemMatches } from './c13.mjs';
import {
  loadCensusRows,
  loadHoldout3,
  loadHoldout4,
  loadHoldout5,
} from './load-sets.mjs';

// --- opts={} equivalence: c13 must behave IDENTICALLY to c11 -------------

test('classify(row) with no opts matches c11.classify(row) on every row of all six sets', () => {
  const censusRows = loadCensusRows();
  const holdout3Rows = loadHoldout3() || [];
  const holdout4Rows = loadHoldout4() || [];
  const holdout5Rows = loadHoldout5() || [];
  const allRows = [...censusRows, ...holdout3Rows, ...holdout4Rows, ...holdout5Rows];

  assert.ok(allRows.length > 0, 'expected at least one row across the six sets');

  let mismatches = 0;
  const examples = [];
  for (const row of allRows) {
    const a = classifyC11(row);
    const b = classifyC13(row);
    const same = a.class === b.class && a.rule === b.rule && a.floor === b.floor
      && JSON.stringify(a.evidence) === JSON.stringify(b.evidence);
    if (!same) {
      mismatches += 1;
      if (examples.length < 5) examples.push({ row: `${row.set}|${row.repo}|${row.method}|${row.operationId}`, a, b });
    }
  }
  assert.equal(mismatches, 0, `c13 with opts={} diverged from c11 on ${mismatches} rows: ${JSON.stringify(examples)}`);
});

// --- stemMatches unit tests -------------------------------------------------

test('stemMatches: invoke inflections all match stem "invok"', () => {
  assert.equal(stemMatches('invoke', 'invok'), true);
  assert.equal(stemMatches('invokes', 'invok'), true);
  assert.equal(stemMatches('invoked', 'invok'), true);
  assert.equal(stemMatches('invoking', 'invok'), true);
  assert.equal(stemMatches('invok', 'invok'), true);
});

test('stemMatches: a different verb sharing a prefix must never match', () => {
  assert.equal(stemMatches('revoke', 'invok'), false);
  assert.equal(stemMatches('evoke', 'invok'), false);
});

test('stemMatches: address must never match stem "add"', () => {
  assert.equal(stemMatches('address', 'add'), false);
  assert.equal(stemMatches('addresses', 'add'), false);
});

test('stemMatches: spend must never match stem "send"', () => {
  assert.equal(stemMatches('spend', 'send'), false);
  assert.equal(stemMatches('spends', 'send'), false);
});

test('stemMatches: empty word or stem never matches', () => {
  assert.equal(stemMatches('', 'invok'), false);
  assert.equal(stemMatches('invoke', ''), false);
});
