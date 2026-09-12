// The one fixed pipeline order, and the direction guard that enforces it.
//
// classifyByVerb -> applyGoal2 -> applyGoal1 -> applyGoal3. This array is
// the only place that order is written; nothing else in the codebase may
// hardcode it. Each goal layer may only move a row the direction its
// folder owns (see docs/product/prd.md, "How the goals stay separate") —
// a layer that moves a row the wrong way throws instead of silently
// corrupting another goal's ledger.
import { CLASS_ORDER } from '../arbiter/arbiter.mjs';
import { classifyByVerb } from '../core/core.mjs';
import { applyGoal2 } from '../goal2/goal2.mjs';
import { applyGoal1 } from '../goal1/goal1.mjs';
import { applyGoal3 } from '../goal3/goal3.mjs';

function rowLabel(row) {
  return `${row.vendor} ${row.method} ${row.operationId}`;
}

// goal2: keep or raise only (w -> x). No lower allowed.
export function guardRaiseOnly(name, prev, next, row) {
  if (CLASS_ORDER[next.class] < CLASS_ORDER[prev.class]) {
    throw new Error(`${name} layer lowered ${rowLabel(row)} from ${prev.class} to ${next.class}, only raises allowed`);
  }
}

// goal1: keep, or exactly x -> w. No raise, no other lower.
export function guardGoal1(name, prev, next, row) {
  if (CLASS_ORDER[next.class] > CLASS_ORDER[prev.class]) {
    throw new Error(`${name} layer raised ${rowLabel(row)} from ${prev.class} to ${next.class}, only lowers allowed`);
  }
  if (next.class !== prev.class && !(prev.class === 'x' && next.class === 'w')) {
    throw new Error(`${name} layer moved ${rowLabel(row)} from ${prev.class} to ${next.class}, only x->w allowed`);
  }
}

// goal3: keep, or lower to r from anything. No raise, no lower to non-r.
export function guardGoal3(name, prev, next, row) {
  if (CLASS_ORDER[next.class] > CLASS_ORDER[prev.class]) {
    throw new Error(`${name} layer raised ${rowLabel(row)} from ${prev.class} to ${next.class}, only lowers allowed`);
  }
  if (next.class !== prev.class && next.class !== 'r') {
    throw new Error(`${name} layer moved ${rowLabel(row)} from ${prev.class} to ${next.class}, only lowering to r allowed`);
  }
}

// 'verbs' is the base call (no prev result yet), so it carries no guard —
// there is nothing to compare it against.
const LAYERS = [
  { name: 'verbs', apply: (_prev, row) => classifyByVerb(row), guard: null },
  { name: 'goal2', apply: applyGoal2, guard: guardRaiseOnly },
  { name: 'goal1', apply: applyGoal1, guard: guardGoal1 },
  { name: 'goal3', apply: applyGoal3, guard: guardGoal3 },
];

// opts.upTo stops after the named layer runs (default 'goal3', the full
// pipeline). opts.layers is a test-only override of the layer list, used
// by pipeline.test.mjs to inject a fake bad layer and prove the guard
// throws — never used outside tests.
export function classify(row, ctx, opts = {}) {
  const { upTo = 'goal3', layers = LAYERS } = opts;
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
