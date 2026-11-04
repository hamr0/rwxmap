import test from 'node:test';
import assert from 'node:assert/strict';
import { score, rule1 } from './score.mjs';

test('score counts exact, too loose (looser than truth) and too tight', () => {
  const s = score([{ pred: 'r', truth: 'x' }, { pred: 'x', truth: 'r' }, { pred: 'w', truth: 'w' }]);
  assert.deepEqual(s, { n: 3, exact: 1, loose: 1, tight: 1 });
});

test('rule1 lowers an x with low isX, asks when p is under 0.97, raises w on isX>=0.15', () => {
  const st = { method: 'POST', path: '/a', operationId: 'a', summary: 'a' };
  const low = rule1({ jev_tier: 'jev-lower', isX: 0.01, changes: 0.02, state: st }, 'x');
  assert.equal(low.letter, 'r'); assert.equal(low.asked, false);
  const ask = rule1({ jev_tier: 'jev-lower', isX: 0.2, changes: 0.9, state: st }, 'x');
  assert.equal(ask.letter, 'w'); assert.equal(ask.asked, true);
  assert.equal(rule1({ jev_tier: 'jev-raise-wx', isX: 0.2, changes: 0.5, state: st }, 'w').letter, 'x');
});
