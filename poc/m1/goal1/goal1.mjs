// Goal 1: its own standalone classifier, start to finish — not a layer
// that patches goal 2's output (the user's ruling, 2026-09-13). Goal 1
// and goal 2 are two separate lenses over the same rows; bringing them
// together is a later step, not this one.
//
// classifyGoal1(row, ctx) for PUT/DELETE/PATCH:
//   1. floor w (core's classifyFloor).
//   2. goal 1's OWN live-verb list (lists.mjs's LIVE_VERBS, a literal
//      copy of goal 2's 26 words) raises to x, rule 'live-verb'.
//   3. if still floor w, goal 1's OWN other-party noun list
//      (ctx.otherNounsFor, built by lists.mjs's buildGoal1OtherNouns)
//      raises to x, rule 'other-noun', when ANY noun on the row is
//      someone else's.
// Any other method returns classifyFloor(row) untouched.
import { classifyFloor, withSplitOperationId } from '../core/core.mjs';
import { tokensForRow } from '../arbiter/arbiter.mjs';
import { fallbackVerbFromSummary, summaryHasCallerPhrase, matchesAnyStem } from '../arbiter/judge.mjs';
import { nounsForRow } from '../goal2/allowlist.mjs';
import { LIVE_VERBS } from './lists.mjs';

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// Same live-verb logic as goal2.mjs's applyLiveVerb, reimplemented here
// with goal 1's own LIVE_VERBS copy (D57: never import goal 2's list).
function applyGoal1LiveVerb(prev, row) {
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

// ctx.otherNounsFor(vendor) -> Set<noun>, from goal1/lists.mjs's
// buildGoal1OtherNouns(), assembled in run/context.mjs. ctx.junkSet is
// goal 2's junk-noun set, reused only as a noun-reader input.
export function classifyGoal1(row, ctx) {
  if (!RAISE_METHODS.has(row.method)) return classifyFloor(row);

  const floor = classifyFloor(row);
  const afterLiveVerb = applyGoal1LiveVerb(floor, row);
  if (afterLiveVerb !== floor) return afterLiveVerb;

  const nouns = nounsForRow(row, ctx.junkSet);
  const otherNouns = ctx.otherNounsFor(row.vendor);
  if ([...nouns].some((n) => otherNouns.has(n))) {
    return { class: 'x', rule: 'other-noun', floor: false };
  }
  return floor;
}
