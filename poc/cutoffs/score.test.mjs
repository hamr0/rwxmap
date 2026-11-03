import test from 'node:test';
import assert from 'node:assert/strict';
import { outcome, compare, barFor, ratio, letterAt, pickCut, TODAY, GRID } from './score.mjs';
import { classifyRow } from '../../src/index.js';
import { needsJev } from '../../src/jev.js';

const row = { row_id: 't', provider: 'a', method: 'POST', path: '/zzz', operationId: 'zzzQq', summary: '', description: '' };
const verdict = classifyRow(row);
const mk = (p, pc, truth, provider = 'a', model = 'm') => ({ row: { ...row, provider }, truth, verdict, mech: verdict.class, tier: needsJev(verdict), ans: { p, model, changes: pc === null ? undefined : { p: pc, model } } });

test('fixture is a floor-post x row', () => {
  assert.equal(verdict.rule, 'floor-post');
  assert.equal(verdict.class, 'x');
});
test('lower cut: p=0.15 stays x at 0.10, lowers at 0.20; changes<=lower-r goes to r', () => {
  const it = mk(0.15, 0.3, 'w');
  assert.equal(letterAt(it, TODAY), 'x');
  assert.equal(letterAt(it, { ...TODAY, 'jev-lower': 0.2 }), 'r');
  assert.equal(letterAt(mk(0.15, 0.9, 'w'), { ...TODAY, 'jev-lower': 0.2 }), 'w');
});
test('compare: right and wrong are directional', () => {
  const items = [mk(0.15, 0.9, 'w'), mk(0.15, 0.9, 'x')];
  const b = items.map((i) => letterAt(i, TODAY));
  const a = items.map((i) => letterAt(i, { ...TODAY, 'jev-lower': 0.2 }));
  const c = compare(items, b, a);
  assert.deepEqual([c.moved, c.right, c.wrong, c.looser], [2, 1, 1, 2]);
  assert.equal(c.leakA - c.leakB, 1);
  assert.equal(barFor(c).dir, 'loosen');
  assert.equal(barFor(c).pass, false);
});
test('ratio and bar', () => {
  assert.equal(ratio(3, 0), Infinity);
  assert.equal(ratio(0, 0), 0);
  assert.equal(barFor({ moved: 11, looser: 11, right: 10, wrong: 1, leakA: 0, leakB: 0 }).pass, true);
  assert.equal(barFor({ moved: 3, looser: 0, right: 2, wrong: 1, leakA: 1, leakB: 1 }).pass, true);
  assert.equal(barFor({ moved: 3, looser: 0, right: 2, wrong: 1, leakA: 2, leakB: 1 }).pass, false);
});
test('unusable answer never moves; pickCut stays at today when nothing passes', () => {
  const it = mk(0.15, 0.9, 'w');
  it.ans = null;
  assert.equal(letterAt(it, { ...TODAY, 'jev-lower': 0.4 }), 'x');
  assert.equal(pickCut([mk(0.15, 0.9, 'x')], 'jev-lower'), TODAY['jev-lower']);
  assert.ok(GRID['jev-lower'].includes(0.4));
});
