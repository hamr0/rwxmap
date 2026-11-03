// node --test poc/f1-post-r/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyF1, baseline, answerP, moves, ratio, pickT, lovo, outcome } from './score.mjs';

test('baseline is jev-lower at 0.10, fail closed', () => {
  assert.equal(baseline(0.1), 'w');
  assert.equal(baseline(0.11), 'x');
  assert.equal(baseline(null), 'x');
});

test('variant A reaches r only after the isX lower', () => {
  assert.equal(applyF1('A', 0.05, 0.05, 0.1), 'r');
  assert.equal(applyF1('A', 0.5, 0.01, 0.1), 'x'); // isX not lowered -> no r
  assert.equal(applyF1('A', 0.05, 0.2, 0.1), 'w');
  assert.equal(applyF1('A', null, 0.01, 0.5), 'x');
  assert.equal(applyF1('A', 0.05, null, 0.5), 'w');
});

test('variant B reaches r on changes alone', () => {
  assert.equal(applyF1('B', 0.9, 0.05, 0.1), 'r');
  assert.equal(applyF1('B', 0.9, 0.2, 0.1), 'x');
  assert.equal(applyF1('B', 0.05, 0.2, 0.1), 'w');
  assert.equal(applyF1('B', null, null, 0.5), 'x');
});

test('F1 never returns a class tighter than x or an unknown class', () => {
  for (const v of ['A', 'B'])
    for (const px of [null, 0, 0.1, 0.5, 1])
      for (const pc of [null, 0, 0.1, 0.5, 1]) assert.ok(['r', 'w', 'x'].includes(applyF1(v, px, pc, 0.3)));
});

test('answerP fails closed on errors and bad values', () => {
  assert.equal(answerP({ answers: { changes: { noul: 0.2 } } }, 'changes'), 0.2);
  assert.equal(answerP({ error: 'x' }, 'changes'), null);
  assert.equal(answerP({ answers: { changes: { noul: 1.5 } } }, 'changes'), null);
  assert.equal(answerP({ answers: {} }, 'changes'), null);
  assert.equal(answerP(undefined, 'changes'), null);
});

test('moves splits wrong truth-x into fresh and already-leaking', () => {
  const rows = [
    { truth: 'r', pX: 0.9, pC: 0.01, provider: 'a' },
    { truth: 'w', pX: 0.9, pC: 0.01, provider: 'a' },
    { truth: 'x', pX: 0.9, pC: 0.01, provider: 'b' }, // fresh: baseline x
    { truth: 'x', pX: 0.05, pC: 0.01, provider: 'b' }, // deepened: baseline w
  ];
  const m = moves(rows, 'B', 0.1);
  assert.deepEqual([m.moved, m.right, m.wrongW, m.wrongX, m.wrongXfresh, m.wrongXdeepened, m.wrong], [4, 1, 1, 2, 1, 1, 3]);
  assert.equal(outcome('r', 'x'), 'leak');
});

test('ratio, pickT and lovo', () => {
  assert.equal(ratio(3, 0), Infinity);
  assert.equal(ratio(0, 0), 0);
  const rows = [];
  for (let i = 0; i < 20; i += 1) rows.push({ truth: 'r', pX: 0.9, pC: 0.04, provider: i % 2 ? 'a' : 'b' });
  rows.push({ truth: 'w', pX: 0.9, pC: 0.25, provider: 'a' });
  assert.equal(pickT(rows, 'B'), 0.5); // 0.3 moves the w row too: 20/1 still >= 10
  rows.push({ truth: 'w', pX: 0.9, pC: 0.25, provider: 'b' }, { truth: 'x', pX: 0.9, pC: 0.25, provider: 'b' });
  assert.equal(pickT(rows, 'B'), 0.2);
  const { pooled, folds } = lovo(rows, 'B');
  assert.equal(folds.length, 2);
  assert.equal(pooled.right + pooled.wrong, pooled.moved);
});
