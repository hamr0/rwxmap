import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContext } from './context.mjs';
import { computeLedger } from './ledger.mjs';

const ctx = loadContext();
const ledger = computeLedger(ctx.rows, ctx);

// A pin changes only by an explicit user ruling recorded in the PRD
// (docs/product/prd.md).
test('goal 2 ledger is 37', () => {
  assert.equal(ledger.goal2.leaks, 37);
});

// moved 2026-09-13, piece 4 restricted to answering only goal 2's own
// no-own-noun raise (61 freed, 2 leaks flagged on goal 1's own ledger,
// D49 accepts flagged leaks)
test('goal 1 ledger is 2531', () => {
  assert.equal(ledger.goal1.falseAlarms, 2531);
});

test('goal 1 leak cost is 2', () => {
  assert.equal(ledger.goal1.leakCost, 2);
});

test('goal 3 ledger is 49', () => {
  assert.equal(ledger.goal3.overTight, 49);
});

test('goal 3 leak cost is 0', () => {
  assert.equal(ledger.goal3.leakCost, 0);
});
