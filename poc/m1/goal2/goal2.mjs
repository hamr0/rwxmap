// Goal 2 (truth x, predicted w — the leak): the yours-noun layer only.
//
// Reproduces the step-2 half of docs/product/goal2-solution.md exactly: no
// hand-written third-party noun list, one widened-noun allowlist layer on
// top of core.mjs's floor + verb rules. RAISE ONLY — this layer may only
// move a row w -> x, and only on rows core.mjs's classifyByVerb left at
// the w floor on a raise-only method (PUT/DELETE/PATCH); every other row
// passes through untouched.
import { nounsForRow } from '../core/core.mjs';

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// prev = the result so far (from classifyByVerb, or from an earlier layer
// in the pipeline). ctx = { junkSet, allowlistFor } from core/corpus.mjs's
// loadContext(); allowlistFor(vendor) returns that vendor's LOVO yours-noun
// allowlist.
export function applyGoal2(prev, row, ctx) {
  if (!RAISE_METHODS.has(row.method)) return prev;
  if (prev.class !== 'w' || prev.floor !== true) return prev;

  const nouns = nounsForRow(row, ctx.junkSet);
  const allowlist = ctx.allowlistFor(row.vendor);
  if (nouns.size > 0 && [...nouns].every((n) => allowlist.has(n))) return prev;
  return { class: 'x', rule: 'no-own-noun', floor: false };
}
