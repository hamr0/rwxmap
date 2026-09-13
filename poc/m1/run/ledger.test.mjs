import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContext } from '../core/corpus.mjs';
import { computeLedger } from './ledger.mjs';

const ctx = loadContext();
const ledger = computeLedger(ctx.rows, ctx);

// A pin changes only by an explicit user ruling recorded in the PRD
// (docs/product/prd.md).
test('goal 2 ledger is 37', () => {
  assert.equal(ledger.goal2.leaks, 37);
});

// moved 2026-09-13 by the user's ruling for the '/' + whitespace splitter fix
test('goal 1 ledger is 2703', () => {
  assert.equal(ledger.goal1.falseAlarms, 2703);
});

test('goal 1 leak cost is 0', () => {
  assert.equal(ledger.goal1.leakCost, 0);
});

test('goal 3 ledger is 49', () => {
  assert.equal(ledger.goal3.overTight, 49);
});

test('goal 3 leak cost is 0', () => {
  assert.equal(ledger.goal3.leakCost, 0);
});
