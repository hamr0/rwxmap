import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, guardRaiseOnly, guardStep2, guardStep1 } from './pipeline.mjs';

function fakeRow() {
  return { vendor: 'acme', method: 'PUT', operationId: 'fakeOp', summary: '', description: '', path: '', gt_class: 'w' };
}

const ctx = { junkSet: new Set(), allowlistFor: () => new Set() };

test('classify: step3 slot illegally lowering throws, names the layer', () => {
  const badLayers = [
    { name: 'floor', apply: () => ({ class: 'w', rule: 'floor', floor: true }), guard: null },
    { name: 'step3', apply: (prev) => ({ ...prev, class: 'r' }), guard: guardRaiseOnly },
  ];
  assert.throws(
    () => classify(fakeRow(), ctx, { layers: badLayers }),
    /step3 layer lowered .* from w to r, only raises allowed/,
  );
});

test('classify: step2 slot illegally raising throws, names the layer', () => {
  const badLayers = [
    { name: 'floor', apply: () => ({ class: 'w', rule: 'floor', floor: true }), guard: null },
    { name: 'step2', apply: (prev) => ({ ...prev, class: 'x' }), guard: guardStep2 },
  ];
  assert.throws(
    () => classify(fakeRow(), ctx, { layers: badLayers }),
    /step2 layer raised .* from w to x, only lowers allowed/,
  );
});

test('classify: step2 slot lowering to something other than w throws (only x->w allowed)', () => {
  const badLayers = [
    { name: 'floor', apply: () => ({ class: 'x', rule: 'floor', floor: true }), guard: null },
    { name: 'step2', apply: (prev) => ({ ...prev, class: 'r' }), guard: guardStep2 },
  ];
  assert.throws(
    () => classify(fakeRow(), ctx, { layers: badLayers }),
    /step2 layer moved .* from x to r, only x->w allowed/,
  );
});

test('classify: step1 slot lowering to something other than r throws', () => {
  const badLayers = [
    { name: 'floor', apply: () => ({ class: 'x', rule: 'floor', floor: true }), guard: null },
    { name: 'step1', apply: (prev) => ({ ...prev, class: 'w' }), guard: guardStep1 },
  ];
  assert.throws(
    () => classify(fakeRow(), ctx, { layers: badLayers }),
    /step1 layer moved .* from x to w, only lowering to r allowed/,
  );
});

test('classify: opts.upTo stops after the named layer', () => {
  const layers = [
    { name: 'floor', apply: () => ({ class: 'w', rule: 'floor', floor: true }), guard: null },
    { name: 'step3', apply: (prev) => ({ class: 'x', rule: 'no-own-noun', floor: false }), guard: guardRaiseOnly },
    { name: 'step2', apply: () => { throw new Error('should not run'); }, guard: guardStep2 },
  ];
  const res = classify(fakeRow(), ctx, { upTo: 'step3', layers });
  assert.equal(res.class, 'x');
});
