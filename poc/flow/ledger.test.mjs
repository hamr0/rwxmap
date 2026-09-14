import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictFor, pinDiffs, PINS } from './ledger.mjs';

test('verdictFor: ok when class matches truth', () => {
  assert.equal(verdictFor({ class: 'w' }, 'w'), 'ok');
});

test('verdictFor: LEAK when class is looser than truth', () => {
  assert.equal(verdictFor({ class: 'r' }, 'w'), 'LEAK');
  assert.equal(verdictFor({ class: 'w' }, 'x'), 'LEAK');
  assert.equal(verdictFor({ class: 'r' }, 'x'), 'LEAK');
});

test('verdictFor: FALSE-ALARM when truth is w and class is x', () => {
  assert.equal(verdictFor({ class: 'x' }, 'w'), 'FALSE-ALARM');
});

test('verdictFor: OVER-TIGHT when truth is r and class is not r', () => {
  assert.equal(verdictFor({ class: 'w' }, 'r'), 'OVER-TIGHT');
  assert.equal(verdictFor({ class: 'x' }, 'r'), 'OVER-TIGHT');
});

test('pinDiffs: exact match to PINS yields no diffs', () => {
  const score = JSON.parse(JSON.stringify(PINS));
  delete score.rows;
  delete score.vendors;
  assert.deepEqual(pinDiffs(score, PINS.rows, PINS.vendors), []);
});

test('pinDiffs: one moved number yields exactly that one diff', () => {
  const score = JSON.parse(JSON.stringify(PINS));
  delete score.rows;
  delete score.vendors;
  score.step2.xPile.leaks = 193;
  const diffs = pinDiffs(score, PINS.rows, PINS.vendors);
  assert.deepEqual(diffs, [{ name: 'step2.xPile.leaks', pinned: 179, actual: 193 }]);
});
