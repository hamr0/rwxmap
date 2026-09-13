// Goal 1 (truth w, predicted x — the false alarm): the lower-back layer.
//
// LOWER ONLY: this layer may only move a row x -> w, and only a row goal 2
// itself raised or a row that landed on x via its own evidence — it may
// not touch the floor table, or any list, verb or noun (those belong to
// goal 2 / goal 3 / core's floor). It can only add its own evidence, and
// every row it lowers must be marked floor:true (flagged, never
// confident) so a lowered row is still visibly unresolved rather than a
// silent, confident w.
//
// Piece 3 — lowering-verb rule (D57): a PUT/DELETE/PATCH row still at x
// whose summary's lead verb (fallbackVerbFromSummary, trailing 's'
// folded) is on goal 1's own leave-one-vendor-out list (lists.mjs,
// mined from goal 1's own pile — never goal 2's LIVE_VERBS) lowers to w.
import { foldedVerbForRow } from './lists.mjs';

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// ctx.lowerVerbsFor(vendor) -> Set<"METHOD verb">, from
// goal1/lists.mjs's buildGoal1LowerVerbs(), assembled in run/context.mjs.
export function applyGoal1(prev, row, ctx) {
  if (!RAISE_METHODS.has(row.method)) return prev;
  if (prev.class !== 'x') return prev;

  const verb = foldedVerbForRow(row);
  if (!verb) return prev;

  const key = `${row.method} ${verb}`;
  const lowerVerbs = ctx.lowerVerbsFor(row.vendor);
  if (lowerVerbs.has(key)) {
    return { class: 'w', rule: 'lower-verb', floor: true };
  }
  return prev;
}
