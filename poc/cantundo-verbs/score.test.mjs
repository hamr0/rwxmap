import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRow } from '../../src/index.js';
import { CANT_UNDO } from '../../src/step2.js';
import { tallyMoves, lovoVerb, viewState, ledger, finalClass, CANDIDATES } from './score.mjs';

const ext = (v) => ({ cantUndo: new Set([...CANT_UNDO, v]) });

test('no candidate is already in CANT_UNDO', () => {
  for (const c of CANDIDATES) assert.equal(CANT_UNDO.has(c), false, c);
});

test('step 2 override: a PUT lead verb moves w -> x; a POST floor row stays x but changes rule', () => {
  const put = { method: 'PUT', path: '/repos/{id}/transfer', operationId: 'transferRepo', summary: 'Transfer a repo' };
  assert.equal(classifyRow(put).class, 'w');
  const a = classifyRow(put, ext('transfer'));
  assert.equal(a.class, 'x'); assert.equal(a.rule, 'cant-undo-verb'); assert.deepEqual(a.matched, ['transfer']);
  const post = { method: 'POST', path: '/x', operationId: 'transferFunds', summary: 'Transfer funds' };
  assert.equal(classifyRow(post).rule, 'floor-post');
  assert.equal(classifyRow(post, ext('transfer')).rule, 'cant-undo-verb');
});

test('lead position only, plural nouns match as step 2 matches them', () => {
  const row = { method: 'PUT', path: '/a', operationId: 'updateInvite', summary: 'Update' };
  assert.equal(classifyRow(row, ext('invite')).class, 'w');
  const issues = { method: 'PUT', path: '/a', operationId: 'issues/update', summary: 'Update' };
  assert.equal(classifyRow(issues, ext('issue')).class, 'x');
});

test('tallyMoves counts right, wrong w, wrong r, and refuses a lowering', () => {
  const t = tallyMoves([
    { truth: 'x', before: 'w', after: 'x' }, { truth: 'w', before: 'w', after: 'x' },
    { truth: 'r', before: 'w', after: 'x' }, { truth: 'x', before: 'x', after: 'x' },
  ]);
  assert.deepEqual([t.moved, t.right, t.wrongW, t.wrongR, t.wrong], [3, 1, 1, 1, 2]);
  assert.throws(() => tallyMoves([{ truth: 'x', before: 'x', after: 'w' }]));
});

test('lovoVerb drops the verb on a fold whose other vendors do not support it', () => {
  const m = (provider, truth) => ({ provider, truth, before: 'w', after: 'x' });
  const items = [m('a', 'x'), m('a', 'x'), m('b', 'w'), m('c', 'w')];
  const p = lovoVerb(items);
  // hold out a: others 0 right 2 wrong -> dropped; hold out b: others 2 right 1 wrong -> kept (b wrong 1); c same
  assert.equal(p.dropped, 1);
  assert.deepEqual([p.moved, p.right, p.wrong], [2, 0, 2]);
});

test('viewState: n/a without moves, FAIL on a tie', () => {
  assert.equal(viewState({ moved: 0, right: 0, wrong: 0 }), 'n/a');
  assert.equal(viewState({ moved: 2, right: 1, wrong: 1 }), 'FAIL');
  assert.equal(viewState({ moved: 3, right: 2, wrong: 1 }), 'ok');
});

test('ledger splits too loose from too tight', () => {
  const l = ledger([['r', 'x'], ['x', 'r'], ['w', 'w']]);
  assert.deepEqual([l.exact, l.leak, l.over], [1, 1, 1]);
});

test('finalClass: a claimed POST leaves jev-lower, an unclaimed one is lowered by a low isX', () => {
  const row = { row_id: 'z1', method: 'POST', path: '/x', operationId: 'transferFunds', summary: 'Transfer funds' };
  const mk = (o) => ({ map: new Map([['z1', o]]), bad: 0 });
  const jev = {
    lower: mk({ row_id: 'z1', model: 'm', answers: { isX: { noul: 0.01 } } }),
    changes: mk({ row_id: 'z1', model: 'm', answers: { changes: { noul: 0.99 } } }),
    wx: mk({}),
  };
  assert.equal(finalClass(row, classifyRow(row), jev), 'w');
  assert.equal(finalClass(row, classifyRow(row, ext('transfer')), jev), 'x');
  assert.equal(finalClass(row, classifyRow(row), null), 'x');
});
