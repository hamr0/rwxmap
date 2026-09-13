import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGoal1 } from './goal1.mjs';

function row(overrides) {
  return { method: 'PUT', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'w', ...overrides };
}

function ctxWith(lowerVerbs) {
  return { lowerVerbsFor: () => lowerVerbs };
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
