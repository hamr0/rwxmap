import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyJev,
  jevUndecided,
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
  JEV_LOWER_R_THRESHOLD,
  JEV_LOWER_R_KEY,
} from './jev.js';
import { classifyRow } from './flow.js';
// The frozen poc references are loaded by a computed specifier so tsc (rootDir src) does not follow them.
const ref = (f) => import(new URL(f, import.meta.url).href);

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
    // D129: may end at r instead, through a second (changes) question.
    second: { question: 'changes', ask: 'jev-raise-get', then: 'r', threshold: 0.50, thresholdKey: 'jev-lower-r' },
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
    class: 'w', step: 2, rule: 'jev-lower', source: 'jev', matched: [], review: 'loose', jev: { p: 0.10, model: MODEL },
  });
});

test('jev-lower: just above the threshold (p = 0.11) does not lower', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 0.11, model: MODEL }), FLOOR_VERDICT);
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 1, model: MODEL }), FLOOR_VERDICT);
});

test('jev-raise-wx: at the threshold (p = 0.80) raises w -> x', () => {
  assert.deepEqual(applyJev(METHOD_FLOOR_W, { p: 0.80, model: MODEL }), {
    class: 'x', step: 3, rule: 'jev-raise-wx', source: 'jev', matched: [], review: 'tight', jev: { p: 0.80, model: MODEL },
  });
});

test('jev-raise-wx: just below the threshold (p = 0.79) does not raise', () => {
  assert.deepEqual(applyJev(METHOD_FLOOR_W, { p: 0.79, model: MODEL }), METHOD_FLOOR_W);
  assert.deepEqual(applyJev(METHOD_FLOOR_W, { p: 0, model: MODEL }), METHOD_FLOOR_W);
});

test('jev-raise-get: at the threshold (p = 0.50) raises r -> w', () => {
  assert.deepEqual(applyJev(METHOD_R, { p: 0.50, model: MODEL }), {
    class: 'w', step: 1, rule: 'jev-raise-get', source: 'jev', matched: [], review: 'loose', jev: { p: 0.50, model: MODEL },
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

test('jevQuestions: jev-lower carries the method table; jev-raise-wx asks isX without it or the tripwires', () => {
  /** @type {any} */
  const lower = jevQuestions('jev-lower');
  assert.deepEqual(Object.keys(lower), ['isX']);
  assert.ok(lower.isX.criteria.true.methods, 'jev-lower: this pile holds GET/POST/PUT/PATCH rows');
  assert.ok(lower.isX.criteria.false.can_be_set_back);
  /** @type {any} */
  const wx = jevQuestions('jev-raise-wx');
  assert.deepEqual(Object.keys(wx), ['isX']);
  assert.equal(wx.isX.criteria.true.methods, undefined, 'the method table pre-answers PUT/PATCH as w');
  assert.equal(wx.isX.instructions.ignore, undefined);
  assert.equal(wx.isX.criteria.false.can_be_set_back, undefined);
  assert.ok(wx.isX.criteria.true.cannot_be_undone);
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

test('a jev lowering (x -> w on a floor-post POST row) moves the hint from tight to loose', () => {
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
  // The hint is RECOMPUTED, not carried (D133): a lowering is 'loose'.
  assert.equal(moved.review, 'loose');
  assert.deepEqual(moved, {
    class: 'w', step: 2, rule: 'jev-lower', source: 'jev', matched: [], review: 'loose',
    jev: { p: 0.01, model: MODEL },
  });
  // Same answer whether or not the caller passes the method: the second-pass
  // argument decides it.
  assert.equal(applyJev(mech, { p: 0.01, model: MODEL }).review, 'loose');
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

test('each tier sends exactly its frozen poc question (D127)', async () => {
  const lower = await ref('../poc/jev-tiers/criteria-x.mjs');
  const raiseWx = await ref('../poc/jev-tiers/criteria-x-raise.mjs');
  const raiseGet = await ref('../poc/jev-tiers/criteria-changes.mjs');
  assert.equal(JSON.stringify(jevQuestions('jev-lower')), JSON.stringify(lower.questions()));
  assert.equal(JSON.stringify(jevQuestions('jev-raise-wx')), JSON.stringify(raiseWx.questions()));
  assert.equal(JSON.stringify(jevQuestions('jev-raise-get')), JSON.stringify(raiseGet.questions()));
  assert.equal(JSON.stringify(jevQuestions()), JSON.stringify(lower.questions()));
});

// ---- D129 (F1): jev-lower may go on to r through a second question -----

/** The plain jev-lower move to w at isX p = 0.05, as it was before D129. */
const LOWER_TO_W = {
  class: 'w', step: 2, rule: 'jev-lower', source: 'jev', matched: [], review: 'loose', jev: { p: 0.05, model: MODEL },
};

test('D129: JEV_LOWER_R_THRESHOLD is 0.50 and is what jevTier reports as the second threshold', () => {
  assert.equal(JEV_LOWER_R_THRESHOLD, 0.50);
  assert.equal(JEV_LOWER_R_KEY, 'jev-lower-r');
  assert.equal(jevTier('jev-lower')?.second?.threshold, JEV_LOWER_R_THRESHOLD);
  assert.equal(jevTier('jev-lower')?.second?.then, 'r');
  assert.equal(jevTier('jev-raise-wx')?.second, undefined);
  assert.equal(jevTier('jev-raise-get')?.second, undefined);
});

test('D129: jevTier hands out a copy of the second question, not the table itself', () => {
  const a = /** @type {any} */ (jevTier('jev-lower'));
  a.second.threshold = 1;
  assert.equal(jevTier('jev-lower')?.second?.threshold, 0.50);
});

test('D129: the second question jev-lower asks is byte-equal to the changes question (criteria-changes.mjs)', async () => {
  const raiseGet = await ref('../poc/jev-tiers/criteria-changes.mjs');
  const ask = /** @type {string} */ (jevTier('jev-lower')?.second?.ask);
  assert.equal(JSON.stringify(jevQuestions(ask)), JSON.stringify(jevQuestions('jev-raise-get')));
  assert.equal(JSON.stringify(jevQuestions(ask)), JSON.stringify(raiseGet.questions()));
});

test('D129: isX fires and changes <= 0.50 -> r, recording both answers', () => {
  for (const pc of [0, 0.2, 0.50]) {
    assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 0.05, model: MODEL, changes: { p: pc, model: MODEL } }, { method: 'POST' }), {
      class: 'r', step: 2, rule: 'jev-lower', source: 'jev', matched: [], review: 'loose',
      jev: { p: 0.05, model: MODEL, pChanges: pc },
    }, `pChanges=${pc}`);
  }
});

test('D129: isX fires and changes 0.51 -> w, exactly the pre-D129 move', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 0.05, model: MODEL, changes: { p: 0.51, model: MODEL } }), LOWER_TO_W);
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 0.05, model: MODEL, changes: { p: 1, model: MODEL } }), LOWER_TO_W);
});

test('D129: isX does not fire -> x unchanged, whatever the changes answer says', () => {
  for (const p of [0.11, 0.5, 1]) {
    assert.deepEqual(applyJev(FLOOR_VERDICT, { p, model: MODEL, changes: { p: 0, model: MODEL } }), FLOOR_VERDICT, `p=${p}`);
  }
  // a changes answer with an unusable isX answer moves nothing either
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: NaN, model: MODEL, changes: { p: 0, model: MODEL } }), FLOOR_VERDICT);
  assert.deepEqual(applyJev(FLOOR_VERDICT, { model: MODEL, changes: { p: 0, model: MODEL } }), FLOOR_VERDICT);
});

test('D129: a missing, malformed or other-model changes answer leaves the row at w', () => {
  /** @type {[string, any][]} */
  const bad = [
    ['missing', undefined],
    ['null', null],
    ['empty', {}],
    ['not an object', 0.1],
    ['no p', { model: MODEL }],
    ['p string', { p: '0.1', model: MODEL }],
    ['p NaN', { p: NaN, model: MODEL }],
    ['p Infinity', { p: Infinity, model: MODEL }],
    ['p -Infinity', { p: -Infinity, model: MODEL }],
    ['p negative', { p: -0.01, model: MODEL }],
    ['p above 1', { p: 1.5, model: MODEL }],
    ['no model', { p: 0.1 }],
    ['empty model', { p: 0.1, model: '' }],
    ['non-string model', { p: 0.1, model: 1 }],
    ['different model', { p: 0.1, model: 'jev-1.14.0' }],
  ];
  for (const [name, changes] of bad) {
    assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 0.05, model: MODEL, changes }), LOWER_TO_W, name);
  }
});

test('D129: a changes answer never moves a row on a tier without a second question', () => {
  const changes = { p: 0, model: MODEL };
  assert.equal(applyJev(METHOD_FLOOR_W, { p: 0.9, model: MODEL, changes }).class, 'x');
  assert.equal(applyJev(METHOD_FLOOR_W, { p: 0.1, model: MODEL, changes }).class, 'w');
  assert.equal(applyJev(METHOD_R, { p: 0.9, model: MODEL, changes }).class, 'w');
  assert.equal(applyJev(METHOD_R, { p: 0.1, model: MODEL, changes }).class, 'r');
  assert.deepEqual(applyJev(CANT_UNDO_X, { p: 0, model: MODEL, changes }), CANT_UNDO_X);
});

test('D129: the r threshold is overridden under its own key, never under the isX key', () => {
  const opts = { thresholds: { [JEV_LOWER_R_KEY]: 0.30 } };
  const at = (pc, o) => applyJev(FLOOR_VERDICT, { p: 0.05, model: MODEL, changes: { p: pc, model: MODEL } }, o).class;
  assert.equal(at(0.30, opts), 'r');
  assert.equal(at(0.31, opts), 'w');
  // the isX threshold keeps its own default under the r override
  assert.equal(applyJev(FLOOR_VERDICT, { p: 0.11, model: MODEL, changes: { p: 0, model: MODEL } }, opts).class, 'x');
  // and a 'jev-lower' override moves the isX gate only, not the r gate
  const lowerOnly = { thresholds: { 'jev-lower': 0.20 } };
  assert.equal(applyJev(FLOOR_VERDICT, { p: 0.20, model: MODEL, changes: { p: 0.50, model: MODEL } }, lowerOnly).class, 'r');
  assert.equal(applyJev(FLOOR_VERDICT, { p: 0.20, model: MODEL, changes: { p: 0.51, model: MODEL } }, lowerOnly).class, 'w');
});

test('D129: an unreadable r threshold override is ignored and 0.50 stands', () => {
  for (const bad of [NaN, Infinity, -0.1, 1.5, '0.9', null, undefined, {}]) {
    const opts = { thresholds: { [JEV_LOWER_R_KEY]: bad } };
    const at = (pc) => applyJev(FLOOR_VERDICT, { p: 0.05, model: MODEL, changes: { p: pc, model: MODEL } }, opts).class;
    assert.equal(at(0.50), 'r', String(bad));
    assert.equal(at(0.51), 'w', String(bad));
  }
});

test('D129: jev-lower only ever lowers, to w or r, across the whole p grid', () => {
  const grid = [0, 0.01, 0.1, 0.11, 0.5, 0.51, 0.9, 1];
  for (const p of grid) {
    for (const pc of grid) {
      const got = applyJev(FLOOR_VERDICT, { p, model: MODEL, changes: { p: pc, model: MODEL } });
      assert.ok(['x', 'w', 'r'].includes(got.class), `p=${p} pc=${pc}`);
      if (p > 0.10) assert.equal(got.class, 'x', `p=${p} pc=${pc}`);
      if (got.class === 'r') assert.ok(p <= 0.10 && pc <= 0.50, `p=${p} pc=${pc}`);
    }
  }
});

test('D129: assertJevMove lets jev-lower move x -> r and still rejects every other move', () => {
  assert.equal(assertJevMove('jev-lower', 'x', 'r'), true);
  assert.throws(() => assertJevMove('jev-lower', 'w', 'r'), /moves from x/);
  assert.throws(() => assertJevMove('jev-raise-get', 'r', 'r'), /may only move to w/);
});

// ---- D133: letters on successful answers are the measured rule's, unchanged ----

test('D133: successful answers give the same letters as before, for every tier and cut-off', () => {
  const m = { model: MODEL };
  /** [verdict, answer, expected letter] */
  /** @type {Array<[import('./types.js').Verdict, any, string]>} */
  const cases = [
    [FLOOR_VERDICT, { p: 0.10, ...m }, 'w'],
    [FLOOR_VERDICT, { p: 0.11, ...m }, 'x'],
    [FLOOR_VERDICT, { p: 0.05, ...m, changes: { p: 0.50, model: MODEL } }, 'r'],
    [FLOOR_VERDICT, { p: 0.05, ...m, changes: { p: 0.51, model: MODEL } }, 'w'],
    [FLOOR_VERDICT, { p: 0.05, ...m, changes: { p: 0.10, model: 'other' } }, 'w'],
    [FLOOR_VERDICT, { p: 0.50, ...m, changes: { p: 0.01, model: MODEL } }, 'x'],
    [METHOD_FLOOR_W, { p: 0.80, ...m }, 'x'],
    [METHOD_FLOOR_W, { p: 0.79, ...m }, 'w'],
    [METHOD_R, { p: 0.50, ...m }, 'w'],
    [METHOD_R, { p: 0.49, ...m }, 'r'],
  ];
  for (const [v, a, want] of cases) {
    assert.equal(applyJev(v, a).class, want, JSON.stringify([v.rule, a]));
  }
});

test('D133: jevUndecided is x with review tight, on every tier; no tier means no change', () => {
  assert.deepEqual(jevUndecided(FLOOR_VERDICT), { ...FLOOR_VERDICT, review: 'tight' });
  assert.deepEqual(jevUndecided(METHOD_FLOOR_W), { class: 'x', step: 3, rule: 'jev-raise-wx', source: 'jev', matched: [], review: 'tight' });
  assert.deepEqual(jevUndecided(METHOD_R), { class: 'x', step: 1, rule: 'jev-raise-get', source: 'jev', matched: [], review: 'tight' });
  assert.equal(jevUndecided(CANT_UNDO_X), CANT_UNDO_X);
  assert.equal(jevUndecided(METHOD_DELETE_X), METHOD_DELETE_X);
});
