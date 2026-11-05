import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, score } from './score.mjs';

test('largest share wins', () => {
  assert.equal(decide({ isX: 0.05, changes: 0.1 }, 0).letter, 'r');
  assert.equal(decide({ isX: 0.05, changes: 0.9 }, 0).letter, 'w');
  assert.equal(decide({ isX: 0.8, changes: 0.9 }, 0).letter, 'x');
});
test('tie goes to the tighter letter', () => {
  assert.equal(decide({ isX: 0.25, changes: 0.5 }, 0).letter, 'r'); // r .5 w .25 x .25
  assert.equal(decide({ isX: 0.5, changes: 1 }, 0).letter, 'x'); // w .5 x .5 -> x
  assert.equal(decide({ isX: 0, changes: 0.5 }, 0).letter, 'w'); // r .5 w .5 -> w
});
test('below confidence is x and asked', () => {
  const d = decide({ isX: 0.01, changes: 0.04 }, 95);
  assert.equal(d.letter, 'r'); assert.equal(d.asked, false);
  const e = decide({ isX: 0.05, changes: 0.2 }, 90);
  assert.equal(e.letter, 'x'); assert.equal(e.asked, true);
});
test('score counts direction', () => {
  const s = score([{ pred: 'r', truth: 'x' }, { pred: 'x', truth: 'r' }, { pred: 'w', truth: 'w' }]);
  assert.deepEqual(s, { n: 3, exact: 1, loose: 1, tight: 1 });
});
