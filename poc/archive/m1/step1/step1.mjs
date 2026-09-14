// Step 1, r (was goal 3 until 2026-09-13): truth r, predicted w or x —
// over-tight; the read layer.
//
// LOWER TO r ONLY: same non-interference rule as step 2 — this layer may
// not touch the floor table, the verb lists that belong to step 3, or
// the allowlist bar; it can only add its own evidence. The one rule it
// owns today: a POST row whose lead verb is a read verb lowers off the x
// floor to r. read-verb is evidence (a rule fired, not silence), so
// floor:false, not true.
import { leadVerbForRow } from '../arbiter/arbiter.mjs';
import { matchesAnyStem } from '../arbiter/judge.mjs';
import { withSplitOperationId } from '../core/core.mjs';
import { READ_VERBS } from './lists.mjs';

export function applyStep1(prev, row, _ctx) {
  if (row.method !== 'POST') return prev;
  if (prev.class !== 'x' || prev.floor !== true) return prev;

  const verb = leadVerbForRow(withSplitOperationId(row));
  if (matchesAnyStem(verb, READ_VERBS)) {
    return { class: 'r', rule: 'read-verb', floor: false };
  }
  return prev;
}
