// Goal 3 (truth r, predicted w or x — over-tight): the read layer.
//
// LOWER TO r ONLY: same non-interference rule as goal1 — this layer may
// not touch the floor table, the verb lists, or the allowlist bar, and
// every row it lowers must be marked floor:true.
//
// Empty today — goal 3 waits behind goal 1. Pass-through until it has a
// rule of its own.
export function applyGoal3(prev, _row, _ctx) {
  return prev;
}
