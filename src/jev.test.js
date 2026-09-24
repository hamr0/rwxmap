import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyJev,
  needsJev,
  assertJevMove,
  jevState,
  jevQuestions,
  jevTier,
  JEV_TIERS,
  JEV_THRESHOLD,
  JEV_LOWER_THRESHOLD,
  JEV_RAISE_WX_THRESHOLD,
  JEV_RAISE_GET_THRESHOLD,
} from './jev.js';
import { classifyRow } from './flow.js';

// ---- one verdict per pile, exactly as the mechanical steps emit them ----

/** step2.js's floorPost — jev-lower's pile. @type {import('./types.js').Verdict} */
const FLOOR_VERDICT = { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [], review: 'tight' };
/** step3.js's PUT/PATCH floor — jev-raise-wx's pile. @type {import('./types.js').Verdict} */
const METHOD_FLOOR_W = { class: 'w', step: 3, rule: 'method-floor', source: 'floor', matched: [], review: 'loose' };
/** step1.js's GET/HEAD/OPTIONS floor — jev-raise-get's pile. @type {import('./types.js').Verdict} */
const METHOD_R = { class: 'r', step: 1, rule: 'method', source: 'floor', matched: [], review: 'settled' };
/** Claimed by a word list — no tier may ever touch it. @type {import('./types.js').Verdict} */
const CANT_UNDO_X = { class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['delete'], review: 'settled' };
/** Claimed by the DELETE method rule — no tier may ever touch it. @type {import('./types.js').Verdict} */
const METHOD_DELETE_X = { class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true, review: 'settled' };

const MODEL = 'jev-1.13.0';

/** Every pile verdict, paired with the tier that owns it (null = none).
 * @type {{verdict: import('./types.js').Verdict, tier: string|null}[]} */
const PILES = [
  { verdict: FLOOR_VERDICT, tier: 'jev-lower' },
  { verdict: METHOD_FLOOR_W, tier: 'jev-raise-wx' },
  { verdict: METHOD_R, tier: 'jev-raise-get' },
  { verdict: CANT_UNDO_X, tier: null },
  { verdict: METHOD_DELETE_X, tier: null },
];

// ---- thresholds ---------------------------------------------------------

test('JEV_THRESHOLD is 0.10 (D88 user ruling) and is jev-lower\'s threshold', () => {
  assert.equal(JEV_THRESHOLD, 0.10);
  assert.equal(JEV_LOWER_THRESHOLD, JEV_THRESHOLD);
  assert.equal(jevTier('jev-lower')?.threshold, 0.10);
});

test('the raising tiers carry their own thresholds (D95)', () => {
  assert.equal(JEV_RAISE_WX_THRESHOLD, 0.80);
  assert.equal(JEV_RAISE_GET_THRESHOLD, 0.50);
  assert.equal(jevTier('jev-raise-wx')?.threshold, 0.80);
  assert.equal(jevTier('jev-raise-get')?.threshold, 0.50);
});

test('there are exactly three tiers, each with one pile and one allowed move', () => {
  assert.deepEqual(JEV_TIERS, ['jev-lower', 'jev-raise-wx', 'jev-raise-get']);
  assert.deepEqual(jevTier('jev-lower'), {
    tier: 'jev-lower', question: 'isX', pile: 'floor-post', from: 'x', to: 'w', direction: 'lower', threshold: 0.10,
  });
  assert.deepEqual(jevTier('jev-raise-wx'), {
    tier: 'jev-raise-wx', question: 'isX', pile: 'method-floor', from: 'w', to: 'x', direction: 'raise', threshold: 0.80,
  });
  assert.deepEqual(jevTier('jev-raise-get'), {
    tier: 'jev-raise-get', question: 'changes', pile: 'method', from: 'r', to: 'w', direction: 'raise', threshold: 0.50,
  });
  assert.equal(jevTier('sideways'), null);
});

// ---- needsJev: one tier per pile, and the piles are disjoint ------------

test('needsJev names the owning tier, or null when no tier owns the verdict', () => {
  assert.equal(needsJev(FLOOR_VERDICT), 'jev-lower');
  assert.equal(needsJev(METHOD_FLOOR_W), 'jev-raise-wx');
  assert.equal(needsJev(METHOD_R), 'jev-raise-get');
  assert.equal(needsJev(CANT_UNDO_X), null);
  assert.equal(needsJev(METHOD_DELETE_X), null);
  assert.equal(needsJev(undefined), null);
});

test("needsJev stays truthy/falsy the way every pre-D95 caller used it", () => {
  // Existing callers write `if (needsJev(v))`. A tier name is truthy and
  // null is falsy, so that condition still reads the same for floor-post.
  assert.ok(needsJev(FLOOR_VERDICT));
  assert.ok(!needsJev(CANT_UNDO_X));
});

test('a rule name alone does not pick a tier: the class must match the pile too', () => {
  // step1's 'method' rule is r; a hypothetical 'method' verdict at another
  // class belongs to no tier at all rather than falling into jev-raise-get.
  assert.equal(needsJev({ ...METHOD_R, class: /** @type {const} */ ('w') }), null);
  assert.equal(needsJev({ ...FLOOR_VERDICT, class: /** @type {const} */ ('w') }), null);
  assert.equal(needsJev({ ...METHOD_FLOOR_W, class: /** @type {const} */ ('x') }), null);
});

// ---- each tier's allowed move fires at and above/below its threshold ----

test('jev-lower: at the threshold (p = 0.10) lowers x -> w', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 0.10, model: MODEL }), {
    class: 'w', step: 2, rule: 'jev-lower', source: 'jev', matched: [], review: 'settled', jev: { p: 0.10, model: MODEL },
  });
});

test('jev-lower: just above the threshold (p = 0.11) does not lower', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 0.11, model: MODEL }), FLOOR_VERDICT);
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 1, model: MODEL }), FLOOR_VERDICT);
});

test('jev-raise-wx: at the threshold (p = 0.80) raises w -> x', () => {
  assert.deepEqual(applyJev(METHOD_FLOOR_W, { p: 0.80, model: MODEL }), {
    class: 'x', step: 3, rule: 'jev-raise-wx', source: 'jev', matched: [], review: 'settled', jev: { p: 0.80, model: MODEL },
  });
});

test('jev-raise-wx: just below the threshold (p = 0.79) does not raise', () => {
  assert.deepEqual(applyJev(METHOD_FLOOR_W, { p: 0.79, model: MODEL }), METHOD_FLOOR_W);
  assert.deepEqual(applyJev(METHOD_FLOOR_W, { p: 0, model: MODEL }), METHOD_FLOOR_W);
});

test('jev-raise-get: at the threshold (p = 0.50) raises r -> w', () => {
  assert.deepEqual(applyJev(METHOD_R, { p: 0.50, model: MODEL }), {
    class: 'w', step: 1, rule: 'jev-raise-get', source: 'jev', matched: [], review: 'settled', jev: { p: 0.50, model: MODEL },
  });
});

test('jev-raise-get: just below the threshold (p = 0.49) does not raise', () => {
  assert.deepEqual(applyJev(METHOD_R, { p: 0.49, model: MODEL }), METHOD_R);
  assert.deepEqual(applyJev(METHOD_R, { p: 0, model: MODEL }), METHOD_R);
});

test('jev-raise-get raises only to w, never straight to x, at any p', () => {
  for (const p of [0.5, 0.75, 0.9, 0.99, 1]) {
    assert.equal(applyJev(METHOD_R, { p, model: MODEL }).class, 'w', `p=${p}`);
  }
});

// ---- no tier ever touches a pile it does not own ------------------------

test('no tier moves a row on a pile it does not own, at any p', () => {
  for (const p of [0, 0.01, 0.1, 0.2, 0.5, 0.79, 0.8, 0.95, 1]) {
    assert.deepEqual(applyJev(CANT_UNDO_X, { p, model: MODEL }), CANT_UNDO_X, `cant-undo p=${p}`);
    assert.deepEqual(applyJev(METHOD_DELETE_X, { p, model: MODEL }), METHOD_DELETE_X, `method-delete p=${p}`);
  }
});

test('a jev-raise-get answer cannot lower, and a jev-lower answer cannot raise', () => {
  // The answers are the same {p, model} shape, so the only thing stopping a
  // raise-tier answer from lowering (or the reverse) is which pile the
  // verdict sits on. Sweep the whole p range on each pile and assert the
  // class only ever moves in that pile's own direction.
  const RANK = { r: 0, w: 1, x: 2 };
  for (const p of [0, 0.01, 0.1, 0.2, 0.5, 0.79, 0.8, 0.95, 1]) {
    // jev-raise-get's pile: an r row can only stay r or become w. Even a
    // p of 0 — "certainly no change" — must not push it below r.
    const got = applyJev(METHOD_R, { p, model: MODEL });
    assert.ok(RANK[got.class] >= RANK.r, `raise-get p=${p} moved below r`);
    assert.ok(['r', 'w'].includes(got.class), `raise-get p=${p} gave ${got.class}`);

    // jev-lower's pile: an x row can only stay x or become w. Even a p of
    // 1 — "certainly x" — must not push it above x or move it at all.
    const low = applyJev(FLOOR_VERDICT, { p, model: MODEL });
    assert.ok(RANK[low.class] <= RANK.x, `lower p=${p} moved above x`);
    assert.ok(['x', 'w'].includes(low.class), `lower p=${p} gave ${low.class}`);

    // jev-raise-wx's pile: a w row can only stay w or become x.
    const up = applyJev(METHOD_FLOOR_W, { p, model: MODEL });
    assert.ok(['w', 'x'].includes(up.class), `raise-wx p=${p} gave ${up.class}`);
  }
});

test('assertJevMove rejects every move a tier does not own', () => {
  assert.throws(() => assertJevMove('jev-lower', 'x', 'x'), /may only move to w/);
  assert.throws(() => assertJevMove('jev-lower', 'w', 'x'), /moves from x/);
  assert.throws(() => assertJevMove('jev-raise-wx', 'w', 'r'), /may only move to x/);
  assert.throws(() => assertJevMove('jev-raise-get', 'r', 'r'), /may only move to w/);
  assert.throws(() => assertJevMove('jev-raise-get', 'r', 'x'), /may only move to w/);
  assert.throws(() => assertJevMove('sideways', 'r', 'w'), /unknown jev tier/);
  assert.throws(() => assertJevMove('jev-lower', 'x', 'q'), /bad class/);
});

test('assertJevMove passes exactly the one move each tier owns', () => {
  assert.equal(assertJevMove('jev-lower', 'x', 'w'), true);
  assert.equal(assertJevMove('jev-raise-wx', 'w', 'x'), true);
  assert.equal(assertJevMove('jev-raise-get', 'r', 'w'), true);
});

// ---- fail closed, per tier ---------------------------------------------

/** Every malformed answer shape. None of these may move a row anywhere.
 * @type {[string, {p?: unknown, model?: unknown}|null|undefined][]} */
const MALFORMED = [
  ['missing answer', undefined],
  ['null answer', null],
  ['empty answer', {}],
  ['no p', { model: MODEL }],
  ['p as a numerically-valid string', { p: '0.05', model: MODEL }],
  ['p null', { p: null, model: MODEL }],
  ['p NaN', { p: NaN, model: MODEL }],
  ['p +Infinity', { p: Infinity, model: MODEL }],
  ['p -Infinity', { p: -Infinity, model: MODEL }],
  ['p negative', { p: -0.01, model: MODEL }],
  ['p above 1', { p: 1.5, model: MODEL }],
  ['p true', { p: true, model: MODEL }],
  ['missing model', { p: 0.05 }],
  ['empty-string model', { p: 0.05, model: '' }],
  ['non-string model', { p: 0.05, model: 1 }],
  ['null model', { p: 0.05, model: null }],
];

for (const { verdict, tier } of PILES) {
  const label = tier ?? `no tier (${verdict.rule})`;
  test(`fail closed on ${label}: every malformed answer leaves the verdict unchanged`, () => {
    for (const [name, answer] of MALFORMED) {
      assert.deepEqual(applyJev(verdict, answer), verdict, `${label} / ${name}`);
    }
  });
}

test('NaN does not move a row on any pile (a bare "p > t" check lets NaN through, since every comparison against NaN is false)', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: NaN, model: MODEL }), FLOOR_VERDICT);
  assert.deepEqual(applyJev(METHOD_FLOOR_W, { p: NaN, model: MODEL }), METHOD_FLOOR_W);
  assert.deepEqual(applyJev(METHOD_R, { p: NaN, model: MODEL }), METHOD_R);
});

test('applyJev never mutates the verdict it was given', () => {
  for (const { verdict } of PILES) {
    const original = { ...verdict };
    applyJev(verdict, { p: 0.01, model: MODEL });
    applyJev(verdict, { p: 0.99, model: MODEL });
    assert.deepEqual(verdict, original);
  }
});

// ---- threshold overrides ------------------------------------------------

test('a caller can override one tier\'s threshold without touching the others', () => {
  const opts = { thresholds: { 'jev-raise-wx': 0.60 } };
  assert.equal(applyJev(METHOD_FLOOR_W, { p: 0.60, model: MODEL }, opts).class, 'x');
  assert.equal(applyJev(METHOD_FLOOR_W, { p: 0.59, model: MODEL }, opts).class, 'w');
  // the other tiers keep their own defaults
  assert.equal(applyJev(FLOOR_VERDICT, { p: 0.11, model: MODEL }, opts).class, 'x');
  assert.equal(applyJev(METHOD_R, { p: 0.49, model: MODEL }, opts).class, 'r');
});

test('an unreadable threshold override is ignored and the default stands', () => {
  for (const bad of [NaN, Infinity, -0.1, 1.5, '0.9', null, undefined, {}]) {
    const opts = { thresholds: { 'jev-lower': bad } };
    assert.equal(applyJev(FLOOR_VERDICT, { p: 0.10, model: MODEL }, opts).class, 'w', String(bad));
    assert.equal(applyJev(FLOOR_VERDICT, { p: 0.11, model: MODEL }, opts).class, 'x', String(bad));
  }
});

// ---- state --------------------------------------------------------------

test('jevState: picks exactly method/path/operationId/summary/description, summary/description default to null', () => {
  const state = jevState({ method: 'POST', path: '/things', operationId: 'createThing' });
  assert.deepEqual(state, {
    method: 'POST', path: '/things', operationId: 'createThing', summary: null, description: null,
  });
});

test('jevState: carries summary and description through when present', () => {
  const state = jevState({
    method: 'POST', path: '/things', operationId: 'createThing',
    summary: 'Create a thing', description: 'Creates a new thing in your account.',
  });
  assert.equal(state.summary, 'Create a thing');
  assert.equal(state.description, 'Creates a new thing in your account.');
});

test('jevState cannot carry truth to the model', () => {
  // A labelled corpus row carries truth beside the five spec fields; the
  // cast is how a caller would hand one over, and the point of the test is
  // that jevState names its fields rather than copying the row.
  const row = /** @type {import('./types.js').Operation} */ (/** @type {unknown} */ ({
    method: 'POST', path: '/things', operationId: 'createThing', truth: 'x', truth_class: 'x', provider: 'acme',
  }));
  const state = jevState(row);
  assert.deepEqual(Object.keys(state).sort(), ['description', 'method', 'operationId', 'path', 'summary']);
  assert.equal(JSON.stringify(state).includes('truth'), false);
});

// ---- the questions ------------------------------------------------------

test('jevQuestions: no argument gives the isX Noul, as every pre-D95 caller expected', () => {
  /** @type {any} */
  const q = jevQuestions();
  assert.deepEqual(Object.keys(q), ['isX']);
  assert.equal(q.isX.type, 'noul');
  assert.equal(typeof q.isX.instructions.question, 'string');
  assert.equal(typeof q.isX.instructions.definition, 'string');
  assert.ok(Array.isArray(q.isX.instructions.inspect));
  assert.ok(Array.isArray(q.isX.instructions.ignore));
  assert.ok(q.isX.criteria.true);
  assert.ok(q.isX.criteria.false);
});

test('jevQuestions: the two x-boundary tiers share the isX Noul, and it carries the method table', () => {
  for (const tier of ['jev-lower', 'jev-raise-wx']) {
    /** @type {any} */
    const q = jevQuestions(tier);
    assert.deepEqual(Object.keys(q), ['isX']);
    assert.ok(q.isX.criteria.true.methods, `${tier}: these piles hold GET/POST/PUT/PATCH rows`);
    assert.ok(q.isX.criteria.false.can_be_set_back);
  }
});

test('jevQuestions: jev-raise-get asks a different question — does it change anything', () => {
  /** @type {any} */
  const q = jevQuestions('jev-raise-get');
  assert.deepEqual(Object.keys(q), ['changes']);
  assert.equal(q.changes.type, 'noul');
  assert.equal(q.changes.instructions.question, 'Does this operation change anything?');
  assert.ok(q.changes.criteria.false.nothing_changes);
});

test('jevQuestions rejects an unknown tier rather than guessing a question', () => {
  assert.throws(() => jevQuestions('sideways'), /unknown jev tier/);
});

// ---- the brief is transcribed as it stands, not as it once stood --------

test('clause (c) carries the D98 amendment (posting a comment or a reaction is w)', () => {
  const amended =
    'This clause covers what leaves the system and cannot be recalled — an email, an SMS, a notification, an invite, a public listing. It does NOT cover posting a comment or a reaction into a thread that this same API can delete: those are w.';
  /** @type {any} */
  const isX = jevQuestions('jev-lower');
  /** @type {any} */
  const changes = jevQuestions('jev-raise-get');
  assert.ok(isX.isX.criteria.true.cannot_be_undone.c.endsWith(amended));
  assert.ok(changes.changes.criteria.true.changes_and_cannot_be_undone.c.endsWith(amended));
});

test('the tripwires carry the D98 comment/reaction rule', () => {
  /** @type {any} */
  const q = jevQuestions('jev-lower');
  const hit = q.isX.instructions.ignore.filter((t) => t.startsWith('Posting a COMMENT or a REACTION is w, not x.'));
  assert.equal(hit.length, 1);
  assert.ok(hit[0].includes('It does not change DELETE: deleting a comment is still x unless a trash or restore is named.'));
});

test('the membership bullet covers POST, PUT and PATCH, not POST alone', () => {
  /** @type {any} */
  const q = jevQuestions('jev-lower');
  const bullet = q.isX.criteria.false.can_be_set_back.list.find((b) => b.startsWith('removing one item from a list'));
  assert.ok(bullet.includes('on POST, PUT or PATCH only'));
  assert.ok(bullet.includes('On DELETE the method wins'));
});

// ---- the review hint moves with the class (one writer: flow.js) --------

test('a jev lowering (x -> w on a floor-post POST row) flips the hint from tight to settled', () => {
  // The row as the mechanical ladder really emits it: an unclaimed POST
  // floors at x, which is the one 'tight' cell of the hint rule.
  const row = { method: 'POST', operationId: 'createThing', path: '/things' };
  const mech = classifyRow(row);
  assert.deepEqual(
    mech,
    { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [], review: 'tight' },
  );
  assert.equal(needsJev(mech), 'jev-lower');

  const moved = applyJev(mech, { p: 0.01, model: MODEL }, { method: row.method });
  assert.equal(moved.class, 'w');
  // The hint is RECOMPUTED, not carried: a w row is never 'tight', and a
  // jev-sourced row is never 'loose'.
  assert.equal(moved.review, 'settled');
  assert.deepEqual(moved, {
    class: 'w', step: 2, rule: 'jev-lower', source: 'jev', matched: [], review: 'settled',
    jev: { p: 0.01, model: MODEL },
  });
  // Same answer whether or not the caller passes the method: a jev verdict
  // can reach neither non-settled cell.
  assert.equal(applyJev(mech, { p: 0.01, model: MODEL }).review, 'settled');
});

test('a fail-closed applyJev call leaves BOTH the class and the hint untouched', () => {
  const row = { method: 'POST', operationId: 'createThing', path: '/things' };
  const mech = classifyRow(row);
  assert.equal(mech.class, 'x');
  assert.equal(mech.review, 'tight');

  for (const [name, answer] of MALFORMED) {
    const got = applyJev(mech, answer, { method: row.method });
    assert.equal(got.class, 'x', `${name}: class moved`);
    assert.equal(got.review, 'tight', `${name}: hint moved`);
    assert.deepEqual(got, mech, `${name}: verdict changed`);
  }

  // Also fail-closed on the wrong side of the threshold, and on a pile no
  // tier owns: same two fields, unchanged.
  const wrongSide = applyJev(mech, { p: 0.11, model: MODEL }, { method: row.method });
  assert.equal(wrongSide.class, 'x');
  assert.equal(wrongSide.review, 'tight');

  const listRow = classifyRow({ method: 'POST', operationId: 'cancelSubscription', path: '/s/{id}/cancel' });
  assert.equal(listRow.review, 'tight');
  assert.equal(needsJev(listRow), null);
  assert.deepEqual(applyJev(listRow, { p: 0, model: MODEL }, { method: 'POST' }), listRow);
});
