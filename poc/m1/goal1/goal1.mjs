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
// Empty today — goal 1 is reopened but not yet attacked. Pass-through
// until it has a rule of its own.
export function applyGoal1(prev, _row, _ctx) {
  return prev;
}
