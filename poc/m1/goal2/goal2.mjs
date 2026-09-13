// Goal 2 (truth x, predicted w — the leak): live-verb then yours-noun.
//
// RAISE ONLY — this layer may only move a row w -> x, and only on rows
// left at the w floor by the layer before it (the floor, for a
// PUT/DELETE/PATCH row); every other row passes through untouched.
//
// Two checks, in order, reproducing docs/product/goal2-solution.md
// exactly: live-verb raise first (operationId token, else the summary's
// own lead verb, suppressed by a caller phrase), then, only if that
// found nothing, the widened yours-noun allowlist check. D57: both
// checks and their word lists belong to goal 2 (see lists.mjs,
// allowlist.mjs) — core holds only the floor and the splitter.
import { tokensForRow } from '../arbiter/arbiter.mjs';
import { fallbackVerbFromSummary, summaryHasCallerPhrase, matchesAnyStem } from '../arbiter/judge.mjs';
import { withSplitOperationId } from '../core/core.mjs';
import { LIVE_VERBS } from './lists.mjs';
import { nounsForRow } from './allowlist.mjs';

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// The live-verb half, exported separately so run/measure.mjs's "verbs
// only" comparison can compose floor -> this step -> goal 3's read-verb
// step without the noun layer.
export function applyLiveVerb(prev, row) {
  if (!RAISE_METHODS.has(row.method)) return prev;
  if (prev.class !== 'w' || prev.floor !== true) return prev;

  const split = withSplitOperationId(row);
  const { tokens } = tokensForRow(split);
  let hit = null;
  for (const t of tokens) {
    const w = t.toLowerCase();
    if (matchesAnyStem(w, LIVE_VERBS)) { hit = w; break; }
  }
  if (!hit) {
    const sv = fallbackVerbFromSummary(row.summary);
    if (matchesAnyStem(sv, LIVE_VERBS)) hit = sv;
  }
  if (hit && !summaryHasCallerPhrase(row.summary)) {
    return { class: 'x', rule: 'live-verb', floor: false };
  }
  return prev;
}

// prev = the result so far (from the floor layer, or an earlier layer in
// the pipeline). ctx = { junkSet, allowlistFor } from goal2/allowlist.mjs's
// buildGoal2Context(); allowlistFor(vendor) returns that vendor's LOVO
// yours-noun allowlist.
export function applyGoal2(prev, row, ctx) {
  const afterLiveVerb = applyLiveVerb(prev, row);
  if (afterLiveVerb !== prev) return afterLiveVerb;

  if (!RAISE_METHODS.has(row.method)) return prev;
  if (prev.class !== 'w' || prev.floor !== true) return prev;

  const nouns = nounsForRow(row, ctx.junkSet);
  const allowlist = ctx.allowlistFor(row.vendor);
  if (nouns.size > 0 && [...nouns].every((n) => allowlist.has(n))) return prev;
  return { class: 'x', rule: 'no-own-noun', floor: false };
}
