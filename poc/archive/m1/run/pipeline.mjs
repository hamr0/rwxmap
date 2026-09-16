// The one fixed pipeline order, and the direction guard that enforces it.
//
// classifyFloor -> applyStep1 -> applyStep3. This array is the only place
// that order is written; nothing else in the codebase may hardcode it.
// Each step layer may only move a row the direction its folder owns (see
// docs/product/prd.md, "How the goals stay separate") — a layer that
// moves a row the wrong way throws instead of silently corrupting
// another step's ledger.
//
// Step 2 is NOT a layer here (the user's ruling, 2026-09-13): it is its
// own standalone classifier (step2/step2.mjs's classifyStep2), run
// separately over the same rows, never chained onto this pipeline.
// guardStep2 stays exported below only because pipeline.test.mjs uses it
// directly to test the guard mechanism itself.
import { CLASS_ORDER } from '../arbiter/arbiter.mjs';
import { classifyFloor } from '../core/core.mjs';
import { applyStep3 } from '../step3/step3.mjs';
import { applyStep1 } from '../step1/step1.mjs';

function rowLabel(row) {
  return `${row.vendor} ${row.method} ${row.operationId}`;
}

// step3: keep or raise only (w -> x). No lower allowed.
export function guardRaiseOnly(name, prev, next, row) {
  if (CLASS_ORDER[next.class] < CLASS_ORDER[prev.class]) {
    throw new Error(`${name} layer lowered ${rowLabel(row)} from ${prev.class} to ${next.class}, only raises allowed`);
  }
}

// step2: keep, or exactly x -> w. No raise, no other lower.
export function guardStep2(name, prev, next, row) {
  if (CLASS_ORDER[next.class] > CLASS_ORDER[prev.class]) {
    throw new Error(`${name} layer raised ${rowLabel(row)} from ${prev.class} to ${next.class}, only lowers allowed`);
  }
  if (next.class !== prev.class && !(prev.class === 'x' && next.class === 'w')) {
    throw new Error(`${name} layer moved ${rowLabel(row)} from ${prev.class} to ${next.class}, only x->w allowed`);
  }
}

// step1: keep, or lower to r from anything. No raise, no lower to non-r.
export function guardStep1(name, prev, next, row) {
  if (CLASS_ORDER[next.class] > CLASS_ORDER[prev.class]) {
    throw new Error(`${name} layer raised ${rowLabel(row)} from ${prev.class} to ${next.class}, only lowers allowed`);
  }
  if (next.class !== prev.class && next.class !== 'r') {
    throw new Error(`${name} layer moved ${rowLabel(row)} from ${prev.class} to ${next.class}, only lowering to r allowed`);
  }
}

// 'floor' is the base call (no prev result yet), so it carries no guard —
// there is nothing to compare it against.
const LAYERS = [
  { name: 'floor', apply: (_prev, row) => classifyFloor(row), guard: null },
  { name: 'step1', apply: applyStep1, guard: guardStep1 },
  { name: 'step3', apply: applyStep3, guard: guardRaiseOnly },
];

// opts.upTo stops after the named layer runs (default 'step3', the full
// pipeline). opts.layers is a test-only override of the layer list, used
// by pipeline.test.mjs to inject a fake bad layer and prove the guard
// throws — never used outside tests.
export function classify(row, ctx, opts = {}) {
  const { upTo = 'step3', layers = LAYERS } = opts;
  let result = null;
  for (const layer of layers) {
    const prev = result;
    const next = layer.apply(prev, row, ctx);
    if (layer.guard && prev) layer.guard(layer.name, prev, next, row);
    result = next;
    if (layer.name === upTo) break;
  }
  return result;
}
