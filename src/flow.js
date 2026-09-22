// The D87 ladder: step 1 (r), then step 2 (x by evidence), then step 3
// (w), then step 2's floor. Each step is a standalone classifier that
// claims what it can and returns null otherwise; this file is the only
// place that decides the order they run in. It holds no word list and
// makes no r/w/x judgement of its own.
//
// Precedence (D87): method DELETE beats every word — step 2 claims it
// first, unconditionally, and nothing downstream ever runs for a DELETE
// row. Below that, a word beats a floor: step 2 tries its CANT_UNDO word
// rule, then step 3 tries its KEEP_W word rule, before either floor is
// reached. CANT_UNDO and KEEP_W are disjoint by construction (asserted in
// step2.test.js / step3.test.js — every member of one fails
// stemMatches against every member of the other), so no row can ever match
// both lists and there is nothing left to arbitrate between steps 2 and
// 3 — the run order alone decides which word rule gets first look, and
// because they never both fire, that order never actually matters to the
// outcome. Unclaimed rows fall to step 2's floor (floorPost), the tighter
// class for an unknown.
import { step1 } from './step1.js';
import { step2, floorPost } from './step2.js';
import { step3 } from './step3.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

/**
 * Classify one row through the whole ladder.
 * @param {Operation} row
 * @returns {Verdict} always a verdict — this function never returns null.
 */
export function classifyRow(row) {
  const one = step1(row);
  if (one) return one;

  const two = step2(row);
  if (two) return two;

  const three = step3(row);
  if (three) return three;

  return floorPost();
}
