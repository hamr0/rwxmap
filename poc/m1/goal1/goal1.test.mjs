import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGoal1 } from './goal1.mjs';

function row(overrides) {
  return { method: 'PUT', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'w', ...overrides };
}

function ctxWith(lowerVerbs, yoursNouns) {
  return {
    lowerVerbsFor: () => lowerVerbs,
    junkSet: new Set(),
    yoursNounsFor: () => (yoursNouns || new Set()),
  };
}

test('applyGoal1: PUT at x with an admitted lowering verb lowers to w, flagged', () => {
  const r = row({ summary: 'Enable the widget' });
  const prev = { class: 'x', rule: 'floor', floor: true };
  const res = applyGoal1(prev, r, ctxWith(new Set(['PUT enable'])));
  assert.deepEqual(res, { class: 'w', rule: 'lower-verb', floor: true });
});

test('applyGoal1: verb fold — "Enables ..." folds to "enable" the same as "Enable ..."', () => {
  const r = row({ summary: 'Enables the widget' });
  const prev = { class: 'x', rule: 'floor', floor: true };
  const res = applyGoal1(prev, r, ctxWith(new Set(['PUT enable'])));
  assert.equal(res.class, 'w');
  assert.equal(res.rule, 'lower-verb');
});

test('applyGoal1: DELETE row at x passes through untouched when its verb is not on the list', () => {
  const r = row({ method: 'DELETE', summary: 'Terminate the call' });
  const prev = { class: 'x', rule: 'live-verb', floor: false };
  const res = applyGoal1(prev, r, ctxWith(new Set(['PUT enable'])));
  assert.deepEqual(res, prev);
});

test('applyGoal1: a row already at w passes through untouched', () => {
  const r = row({ summary: 'Enable the widget' });
  const prev = { class: 'w', rule: 'floor', floor: true };
  const res = applyGoal1(prev, r, ctxWith(new Set(['PUT enable'])));
  assert.deepEqual(res, prev);
});

test('applyGoal1: a GET row at x (should not happen, but not this layer\'s method) passes through', () => {
  const r = row({ method: 'GET', summary: 'Enable the widget' });
  const prev = { class: 'x', rule: 'floor', floor: true };
  const res = applyGoal1(prev, r, ctxWith(new Set(['GET enable'])));
  assert.deepEqual(res, prev);
});

// Piece 4 — own-noun rule, restricted (2026-09-13 ruling) to rows whose
// prev.rule is goal 2's own 'no-own-noun' raise — noun evidence undoing
// noun evidence only, never a live-verb raise.

test('applyGoal1: PUT at x (prev.rule no-own-noun) whose nouns are all on the yours-noun list lowers to w, flagged', () => {
  const r = row({ operationId: 'updateAccountSettings', summary: 'Change something', method: 'PUT' });
  const prev = { class: 'x', rule: 'no-own-noun', floor: false };
  // nounsForRow(r, {}) = {something, setting, update, account} — admit them all.
  const yoursNouns = new Set(['something', 'setting', 'update', 'account']);
  const res = applyGoal1(prev, r, ctxWith(new Set(), yoursNouns));
  assert.deepEqual(res, { class: 'w', rule: 'own-noun', floor: true });
});

test('applyGoal1: a row (prev.rule no-own-noun) with one noun not on the yours-noun list stays x', () => {
  const r = row({ operationId: 'updateAccountWidget', summary: 'Change something', method: 'PUT' });
  const prev = { class: 'x', rule: 'no-own-noun', floor: false };
  // nounsForRow(r, {}) = {something, widget, update, account} — 'widget' is not admitted.
  const yoursNouns = new Set(['something', 'update', 'account']);
  const res = applyGoal1(prev, r, ctxWith(new Set(), yoursNouns));
  assert.deepEqual(res, prev);
});

test('applyGoal1: a row at x with prev.rule "live-verb" is NOT lowered by own-noun, even when every noun is admitted', () => {
  const r = row({ operationId: 'updateAccountSettings', summary: 'Change something', method: 'PUT' });
  const prev = { class: 'x', rule: 'live-verb', floor: false };
  // Same nouns as the admitted case above — would lower under no-own-noun,
  // but a live-verb raise must stand.
  const yoursNouns = new Set(['something', 'setting', 'update', 'account']);
  const res = applyGoal1(prev, r, ctxWith(new Set(), yoursNouns));
  assert.deepEqual(res, prev);
});

test('applyGoal1: lower-verb still wins first over own-noun', () => {
  const r = row({ operationId: 'enableAccountWidget', summary: 'Enable the widget', method: 'PUT' });
  const prev = { class: 'x', rule: 'no-own-noun', floor: false };
  const lowerVerbs = new Set(['PUT enable']);
  const yoursNouns = new Set(); // would not admit via own-noun
  const res = applyGoal1(prev, r, ctxWith(lowerVerbs, yoursNouns));
  assert.deepEqual(res, { class: 'w', rule: 'lower-verb', floor: true });
});
