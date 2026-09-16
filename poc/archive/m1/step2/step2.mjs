// Step 2, w (was goal 1 until 2026-09-13): its own standalone classifier,
// start to finish — not a layer that patches step 3's output (the user's
// ruling, 2026-09-13). Step 2 and step 3 are two separate lenses over
// the same rows; bringing them together is a later step, not this one.
//
// classifyStep2(row, ctx) for PUT/DELETE/PATCH:
//   1. floor w (core's classifyFloor).
//   2. step 2's OWN live-verb list (lists.mjs's LIVE_VERBS, a literal
//      copy of step 3's 26 words) raises to x, rule 'live-verb'.
//   3. if still floor w, step 2's OWN other-party noun list
//      (ctx.otherNounsFor, built by lists.mjs's buildStep2OtherNouns)
//      raises to x, rule 'other-noun', when ANY noun on the row is
//      someone else's.
// Any other method returns classifyFloor(row) untouched.
import { classifyFloor, withSplitOperationId } from '../core/core.mjs';
import { tokensForRow } from '../arbiter/arbiter.mjs';
import { fallbackVerbFromSummary, summaryHasCallerPhrase, matchesAnyStem } from '../arbiter/judge.mjs';
import { nounsForRow } from '../step3/allowlist.mjs';
import { LIVE_VERBS } from './lists.mjs';

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// Same live-verb logic as step3.mjs's applyLiveVerb, reimplemented here
// with step 2's own LIVE_VERBS copy (D57: never import step 3's list).
function applyStep2LiveVerb(prev, row) {
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

// ctx.otherNounsFor(vendor) -> Set<noun>, from step2/lists.mjs's
// buildStep2OtherNouns(), assembled in run/context.mjs. ctx.junkSet is
// step 3's junk-noun set, reused only as a noun-reader input.
export function classifyStep2(row, ctx) {
  if (!RAISE_METHODS.has(row.method)) return classifyFloor(row);

  const floor = classifyFloor(row);
  const afterLiveVerb = applyStep2LiveVerb(floor, row);
  if (afterLiveVerb !== floor) return afterLiveVerb;

  const nouns = nounsForRow(row, ctx.junkSet);
  const otherNouns = ctx.otherNounsFor(row.vendor);
  if ([...nouns].some((n) => otherNouns.has(n))) {
    return { class: 'x', rule: 'other-noun', floor: false };
  }
  return floor;
}
