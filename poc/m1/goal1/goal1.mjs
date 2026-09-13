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
//
// Piece 4 — own-noun rule (D57, restricted by the user's ruling
// 2026-09-13): if the lower-verb rule did not fire and the row is still
// at x, this rule only answers goal 2's own no-own-noun raise — noun
// evidence undoing noun evidence, never a live-verb raise. Measured: 5 of
// the first 7 leaks this rule produced unrestricted were rows goal 2
// raised on a live verb (cancelShipment, cancelDeployment,
// cancelRegistration, patchEvent "Publish...", "Auto Check-In") — a noun
// list must not override verb evidence, so a row whose prev.rule is
// 'live-verb' (or anything other than 'no-own-noun') is left alone. Read
// its noun set with goal 2's nounsForRow (the noun reader, not a list —
// reused by import) and lower to w, flagged, when every noun is on goal
// 1's own leave-one-vendor-out yours-noun list (lists.mjs's
// buildGoal1YoursNouns() — goal 1's own bar, D48/D57, never goal 2's
// allowlist).
import { foldedVerbForRow } from './lists.mjs';
import { nounsForRow } from '../goal2/allowlist.mjs';

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// ctx.lowerVerbsFor(vendor) -> Set<"METHOD verb">, from
// goal1/lists.mjs's buildGoal1LowerVerbs(), assembled in run/context.mjs.
// ctx.yoursNounsFor(vendor) -> Set<noun>, from
// goal1/lists.mjs's buildGoal1YoursNouns(), assembled in run/context.mjs.
export function applyGoal1(prev, row, ctx) {
  if (!RAISE_METHODS.has(row.method)) return prev;
  if (prev.class !== 'x') return prev;

  const verb = foldedVerbForRow(row);
  if (verb) {
    const key = `${row.method} ${verb}`;
    const lowerVerbs = ctx.lowerVerbsFor(row.vendor);
    if (lowerVerbs.has(key)) {
      return { class: 'w', rule: 'lower-verb', floor: true };
    }
  }

  if (prev.rule !== 'no-own-noun') return prev;

  const nouns = nounsForRow(row, ctx.junkSet);
  if (nouns.size > 0) {
    const yoursNouns = ctx.yoursNounsFor(row.vendor);
    if ([...nouns].every((n) => yoursNouns.has(n))) {
      return { class: 'w', rule: 'own-noun', floor: true };
    }
  }
  return prev;
}
