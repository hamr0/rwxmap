import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContext } from './context.mjs';
import { computeLedger } from './ledger.mjs';

const ctx = loadContext();
const ledger = computeLedger(ctx.rows, ctx);

// A pin changes only by an explicit user ruling recorded in the PRD
// (docs/product/prd.md).
test('step 3 ledger is 37', () => {
  assert.equal(ledger.step3.leaks, 37);
});

// 2026-09-13, step 2 rebuilt as its own classifier (the user's ruling):
// floor -> own live verbs -> own other-party noun list (LOVO, 2 vendors,
// 30% danger share), not a layer patching step 3's output.
test('step 2 false alarms is 803', () => {
  assert.equal(ledger.step2.falseAlarms, 803);
});

test('step 2 leaks is 211', () => {
  assert.equal(ledger.step2.leaks, 211);
});

test('step 1 ledger is 49', () => {
  assert.equal(ledger.step1.overTight, 49);
});

test('step 1 leak cost is 0', () => {
  assert.equal(ledger.step1.leakCost, 0);
});
