import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, assertMove, applyTier, answerP, outcome, ledger } from './score.mjs';
import { splitPiles, PILES } from './make-rows.mjs';
import * as criteriaX from './criteria-x.mjs';
import * as criteriaChanges from './criteria-changes.mjs';

// ---- each tier's allowed move ------------------------------------------

test('lower moves x -> w only, when p <= t', () => {
  assert.equal(applyTier('lower', 0.05, 0.1), 'w');
  assert.equal(applyTier('lower', 0.1, 0.1), 'w', 'the threshold itself fires');
  assert.equal(applyTier('lower', 0.11, 0.1), 'x', 'above the threshold, unchanged');
  assert.deepEqual(TIERS.lower.to, ['w']);
});

test('raise-wx moves w -> x only, when p >= t', () => {
  assert.equal(applyTier('raise-wx', 0.95, 0.9), 'x');
  assert.equal(applyTier('raise-wx', 0.9, 0.9), 'x', 'the threshold itself fires');
  assert.equal(applyTier('raise-wx', 0.89, 0.9), 'w', 'below the threshold, unchanged');
  assert.deepEqual(TIERS['raise-wx'].to, ['x']);
});

test('raise-get moves r -> w or r -> x only, when p >= t', () => {
  assert.equal(applyTier('raise-get', 0.95, 0.9, 'w'), 'w');
  assert.equal(applyTier('raise-get', 0.95, 0.9, 'x'), 'x');
  assert.equal(applyTier('raise-get', 0.4, 0.9, 'w'), 'r', 'below the threshold, unchanged');
  assert.deepEqual(TIERS['raise-get'].to, ['w', 'x']);
});

// ---- a disallowed move is rejected --------------------------------------

test('assertMove rejects a lowering tier that would raise or stand still', () => {
  assert.throws(() => assertMove('lower', 'x', 'x'), /may only move to w/);
  assert.throws(() => assertMove('lower', 'w', 'x'), /moves from x/);
});

test('assertMove rejects a raising tier that would lower', () => {
  assert.throws(() => assertMove('raise-wx', 'w', 'r'), /may only move to x/);
  assert.throws(() => assertMove('raise-get', 'r', 'r'), /may only move to w\/x/);
});

test('the direction backstop fires even when a tier spec is self-contradictory', () => {
  // The real specs can never contradict themselves, so the direction check is
  // a backstop. Prove it fires: a tier that claims to lower but names a
  // raising target must be rejected, not scored.
  TIERS.__bogus = { question: 'isX', from: 'w', to: ['x'], direction: 'lower', thresholds: [0.5] };
  try {
    assert.throws(() => assertMove('__bogus', 'w', 'x'), /may only lower/);
  } finally {
    delete TIERS.__bogus;
  }
});

test('assertMove rejects an unknown tier and a bad class', () => {
  assert.throws(() => assertMove('sideways', 'r', 'w'), /unknown tier/);
  assert.throws(() => assertMove('lower', 'x', 'q'), /bad class/);
});

test('raise-get refuses to move without a target class', () => {
  assert.throws(() => applyTier('raise-get', 0.99, 0.9), /needs a raiseTo/);
});

test('every tier only ever moves in its own direction across the whole sweep', () => {
  const RANK = { r: 0, w: 1, x: 2 };
  for (const [tier, spec] of Object.entries(TIERS)) {
    for (const to of spec.to) {
      for (const t of spec.thresholds) {
        for (const p of [0, 0.01, 0.2, 0.5, 0.8, 0.99, 1]) {
          const got = applyTier(tier, p, t, to);
          if (got === spec.from) continue;
          const dir = RANK[got] > RANK[spec.from] ? 'raise' : 'lower';
          assert.equal(dir, spec.direction, `${tier} p=${p} t=${t} moved ${spec.from}->${got}`);
        }
      }
    }
  }
});

// ---- fail closed ---------------------------------------------------------

test('a missing answer leaves the verdict unchanged, for every tier', () => {
  assert.equal(answerP(undefined, 'isX'), null);
  assert.equal(applyTier('lower', answerP(undefined, 'isX'), 0.5), 'x');
  assert.equal(applyTier('raise-wx', answerP(undefined, 'isX'), 0.5), 'w');
  assert.equal(applyTier('raise-get', answerP(undefined, 'changes'), 0.5, 'x'), 'r');
});

test('an errored answer leaves the verdict unchanged', () => {
  const p = answerP({ row_id: 'a', error: 'HTTP 500' }, 'isX');
  assert.equal(p, null);
  assert.equal(applyTier('lower', p, 0.5), 'x');
});

test('a malformed answer fails closed: NaN, Infinity, string, out of range, wrong key', () => {
  const bad = [
    { answers: { isX: { noul: Number.NaN } } },
    { answers: { isX: { noul: Number.POSITIVE_INFINITY } } },
    { answers: { isX: { noul: '0.05' } } },
    { answers: { isX: { noul: -0.1 } } },
    { answers: { isX: { noul: 1.5 } } },
    { answers: { isX: {} } },
    { answers: { isX: null } },
    { answers: {} },
    { answers: { changes: { noul: 0.01 } } }, // right shape, wrong question
    {},
    null,
    'not an object',
  ];
  for (const out of bad) {
    assert.equal(answerP(out, 'isX'), null, JSON.stringify(out));
    assert.equal(applyTier('lower', answerP(out, 'isX'), 0.5), 'x', JSON.stringify(out));
    assert.equal(applyTier('raise-wx', answerP(out, 'isX'), 0.5), 'w', JSON.stringify(out));
  }
});

test('a well-formed answer at the edges is usable', () => {
  assert.equal(answerP({ answers: { isX: { noul: 0 } } }, 'isX'), 0);
  assert.equal(answerP({ answers: { isX: { noul: 1 } } }, 'isX'), 1);
  assert.equal(answerP({ answers: { changes: { noul: 0.42 } } }, 'changes'), 0.42);
});

// ---- ledger -------------------------------------------------------------

test('outcome orders r < w < x', () => {
  assert.equal(outcome('r', 'r'), 'exact');
  assert.equal(outcome('r', 'w'), 'leak');
  assert.equal(outcome('w', 'x'), 'leak');
  assert.equal(outcome('x', 'w'), 'over-tight');
  assert.equal(outcome('w', 'r'), 'over-tight');
});

test('ledger counts exact, leak and over-tight separately', () => {
  const l = ledger(['x', 'x', 'w'], ['x', 'w', 'x']);
  assert.deepEqual(l, { n: 3, exact: 1, leak: 1, overTight: 1 });
});

// ---- the piles ----------------------------------------------------------

test('splitPiles sends each row to exactly one tier pile', () => {
  const rows = [
    { row_id: 'g1', provider: 'acme', method: 'GET', path: '/things', operationId: 'listThings', summary: 'List things', truth_class: 'r' },
    { row_id: 'p1', provider: 'acme', method: 'PUT', path: '/things/{id}', operationId: 'putThing', summary: 'Replace a thing', truth_class: 'w' },
    { row_id: 'f1', provider: 'acme', method: 'POST', path: '/things/frobnicate', operationId: 'frobnicateThing', summary: 'Frobnicate a thing', truth_class: 'x' },
    { row_id: 'd1', provider: 'acme', method: 'DELETE', path: '/things/{id}', operationId: 'deleteThing', summary: 'Delete a thing', truth_class: 'x' },
  ];
  const piles = splitPiles(rows);
  assert.deepEqual(piles.get('raise-get').map((r) => r.row_id), ['g1']);
  assert.deepEqual(piles.get('raise-wx').map((r) => r.row_id), ['p1']);
  assert.deepEqual(piles.get('lower').map((r) => r.row_id), ['f1']);
  // d1 is claimed by step 2's method-delete rule: no tier touches it.
  const all = PILES.flatMap((p) => piles.get(p.tier).map((r) => r.row_id));
  assert.equal(all.includes('d1'), false);
  assert.equal(new Set(all).size, all.length, 'no row lands in two piles');
});

// ---- criteria ------------------------------------------------------------

test('criteria-x asks exactly one noul, isX', () => {
  const q = criteriaX.questions();
  assert.deepEqual(Object.keys(q), ['isX']);
  assert.equal(q.isX.type, 'noul');
  assert.ok(q.isX.criteria.true.methods, 'the method table is kept for these non-POST-only piles');
  assert.ok(q.isX.criteria.false.can_be_set_back);
});

test('criteria-changes asks exactly one noul, changes', () => {
  const q = criteriaChanges.questions();
  assert.deepEqual(Object.keys(q), ['changes']);
  assert.equal(q.changes.type, 'noul');
  assert.ok(q.changes.criteria.false.nothing_changes);
});

test('both criteria carry the D98-amended clause (c)', () => {
  const amended = 'It does NOT cover posting a comment or a reaction into a thread that this same API can delete: those are w.';
  assert.ok(criteriaX.questions().isX.criteria.true.cannot_be_undone.c.endsWith(amended));
  assert.ok(criteriaChanges.questions().changes.criteria.true.changes_and_cannot_be_undone.c.endsWith(amended));
});

test('stateFor carries exactly the five fields and cannot reach truth', () => {
  const row = {
    row_id: 'x1',
    provider: 'acme',
    method: 'POST',
    path: '/things',
    operationId: 'postThing',
    summary: 'Do a thing',
    description: 'Does a thing.',
    truth: 'x',
    truth_class: 'x',
    confidence: 'high',
  };
  for (const mod of [criteriaX, criteriaChanges]) {
    const state = mod.stateFor(row);
    assert.deepEqual(Object.keys(state).sort(), ['description', 'method', 'operationId', 'path', 'summary']);
    assert.equal(JSON.stringify(state).includes('truth'), false);
    assert.equal(state.truth, undefined);
    assert.equal(state.truth_class, undefined);
    assert.equal(state.provider, undefined);
    assert.equal(state.row_id, undefined);
  }
});

test('stateFor falls back to null for a missing summary/description', () => {
  for (const mod of [criteriaX, criteriaChanges]) {
    const state = mod.stateFor({ method: 'GET', path: '/x', operationId: 'getX' });
    assert.equal(state.summary, null);
    assert.equal(state.description, null);
  }
});
