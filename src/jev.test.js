import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyJev, needsJev, jevState, jevQuestions, JEV_THRESHOLD } from './jev.js';

/** @type {import('./types.js').Verdict} */
const FLOOR_VERDICT = { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [] };

test('JEV_THRESHOLD is 0.10 (D88 user ruling)', () => {
  assert.equal(JEV_THRESHOLD, 0.10);
});

/** @type {import('./types.js').Verdict} */
const METHOD_FLOOR_W = { class: 'w', step: 3, rule: 'method-floor', source: 'floor', matched: [] };
/** @type {import('./types.js').Verdict} */
const CANT_UNDO_X = { class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['delete'] };
/** @type {import('./types.js').Verdict} */
const METHOD_DELETE_X = { class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true };

test('needsJev: true only for a floor-post verdict', () => {
  assert.equal(needsJev(FLOOR_VERDICT), true);
  assert.equal(needsJev(METHOD_FLOOR_W), false);
  assert.equal(needsJev(CANT_UNDO_X), false);
  assert.equal(needsJev(METHOD_DELETE_X), false);
});

test('applyJev: at the threshold (p = 0.10) lowers to w', () => {
  const v = applyJev(FLOOR_VERDICT, { p: 0.10, model: 'jev-1.13.0' });
  assert.deepEqual(v, {
    class: 'w', step: 2, rule: 'jev-lower', source: 'jev', matched: [], jev: { p: 0.10, model: 'jev-1.13.0' },
  });
});

test('applyJev: just above the threshold (p = 0.11) does not lower', () => {
  const v = applyJev(FLOOR_VERDICT, { p: 0.11, model: 'jev-1.13.0' });
  assert.deepEqual(v, FLOOR_VERDICT);
});

test('applyJev: a non-floor-post verdict is returned unchanged even with a low p', () => {
  const v = applyJev(METHOD_FLOOR_W, { p: 0.0, model: 'jev-1.13.0' });
  assert.deepEqual(v, METHOD_FLOOR_W);
});

test('applyJev: missing answer fails closed (verdict unchanged)', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, undefined), FLOOR_VERDICT);
});

test('applyJev: an answer with no p, or a non-number p, fails closed', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, {}), FLOOR_VERDICT);
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: '0.05', model: 'jev-1.13.0' }), FLOOR_VERDICT);
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: null, model: 'jev-1.13.0' }), FLOOR_VERDICT);
});

test('applyJev: NaN does not lower (a bare "p > threshold" check lets NaN through, since NaN > anything is false)', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: NaN, model: 'jev-1.13.0' }), FLOOR_VERDICT);
});

test('applyJev: +Infinity and -Infinity do not lower', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: Infinity, model: 'jev-1.13.0' }), FLOOR_VERDICT);
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: -Infinity, model: 'jev-1.13.0' }), FLOOR_VERDICT);
});

test('applyJev: a negative p does not lower', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: -0.01, model: 'jev-1.13.0' }), FLOOR_VERDICT);
});

test('applyJev: p as a string does not lower, even a numerically-valid one', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: '0.05', model: 'jev-1.13.0' }), FLOOR_VERDICT);
});

test('applyJev: a missing model does not lower, even with a valid low p', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 0.05 }), FLOOR_VERDICT);
});

test('applyJev: an empty-string model does not lower, even with a valid low p', () => {
  assert.deepEqual(applyJev(FLOOR_VERDICT, { p: 0.05, model: '' }), FLOOR_VERDICT);
});

test('applyJev never mutates the verdict it was given', () => {
  const original = { ...FLOOR_VERDICT };
  applyJev(FLOOR_VERDICT, { p: 0.01, model: 'jev-1.13.0' });
  assert.deepEqual(FLOOR_VERDICT, original);
});

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

test('jevQuestions: shape is one Noul question, isX, with instructions and criteria.true/false', () => {
  /** @type {any} */
  const q = jevQuestions();
  assert.equal(Object.keys(q).length, 1);
  assert.ok(q.isX);
  assert.equal(q.isX.type, 'noul');
  assert.equal(typeof q.isX.instructions.question, 'string');
  assert.equal(typeof q.isX.instructions.definition, 'string');
  assert.ok(Array.isArray(q.isX.instructions.inspect));
  assert.ok(Array.isArray(q.isX.instructions.ignore));
  assert.ok(q.isX.criteria.true);
  assert.ok(q.isX.criteria.false);
});
