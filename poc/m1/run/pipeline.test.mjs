import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, guardRaiseOnly, guardGoal1, guardGoal3 } from './pipeline.mjs';

function fakeRow() {
  return { vendor: 'acme', method: 'PUT', operationId: 'fakeOp', summary: '', description: '', path: '', gt_class: 'w' };
}

const ctx = { junkSet: new Set(), allowlistFor: () => new Set() };

test('classify: goal2 slot illegally lowering throws, names the layer', () => {
  const badLayers = [
    { name: 'verbs', apply: () => ({ class: 'w', rule: 'floor', floor: true }), guard: null },
    { name: 'goal2', apply: (prev) => ({ ...prev, class: 'r' }), guard: guardRaiseOnly },
  ];
  assert.throws(
    () => classify(fakeRow(), ctx, { layers: badLayers }),
    /goal2 layer lowered .* from w to r, only raises allowed/,
  );
});

test('classify: goal1 slot illegally raising throws, names the layer', () => {
  const badLayers = [
    { name: 'verbs', apply: () => ({ class: 'w', rule: 'floor', floor: true }), guard: null },
    { name: 'goal1', apply: (prev) => ({ ...prev, class: 'x' }), guard: guardGoal1 },
  ];
  assert.throws(
    () => classify(fakeRow(), ctx, { layers: badLayers }),
    /goal1 layer raised .* from w to x, only lowers allowed/,
  );
});

test('classify: goal1 slot lowering to something other than w throws (only x->w allowed)', () => {
  const badLayers = [
    { name: 'verbs', apply: () => ({ class: 'x', rule: 'floor', floor: true }), guard: null },
    { name: 'goal1', apply: (prev) => ({ ...prev, class: 'r' }), guard: guardGoal1 },
  ];
  assert.throws(
    () => classify(fakeRow(), ctx, { layers: badLayers }),
    /goal1 layer moved .* from x to r, only x->w allowed/,
  );
});

test('classify: goal3 slot lowering to something other than r throws', () => {
  const badLayers = [
    { name: 'verbs', apply: () => ({ class: 'x', rule: 'floor', floor: true }), guard: null },
    { name: 'goal3', apply: (prev) => ({ ...prev, class: 'w' }), guard: guardGoal3 },
  ];
  assert.throws(
    () => classify(fakeRow(), ctx, { layers: badLayers }),
    /goal3 layer moved .* from x to w, only lowering to r allowed/,
  );
});

test('classify: opts.upTo stops after the named layer', () => {
  const layers = [
    { name: 'verbs', apply: () => ({ class: 'w', rule: 'floor', floor: true }), guard: null },
    { name: 'goal2', apply: (prev) => ({ class: 'x', rule: 'no-own-noun', floor: false }), guard: guardRaiseOnly },
    { name: 'goal1', apply: () => { throw new Error('should not run'); }, guard: guardGoal1 },
  ];
  const res = classify(fakeRow(), ctx, { upTo: 'goal2', layers });
  assert.equal(res.class, 'x');
});
