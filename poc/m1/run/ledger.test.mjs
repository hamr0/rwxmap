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

// 2026-09-13, goal 1 rebuilt as its own classifier (the user's ruling):
// floor -> own live verbs -> own other-party noun list (LOVO, 2 vendors,
// 30% danger share), not a layer patching goal 2's output.
test('goal 1 false alarms is 803', () => {
  assert.equal(ledger.goal1.falseAlarms, 803);
});

test('goal 1 leaks is 211', () => {
  assert.equal(ledger.goal1.leaks, 211);
});

test('goal 3 ledger is 49', () => {
  assert.equal(ledger.goal3.overTight, 49);
});

test('goal 3 leak cost is 0', () => {
  assert.equal(ledger.goal3.leakCost, 0);
});
