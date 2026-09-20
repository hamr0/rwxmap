// The ladder: step 1 (r), then step 2 (w), then step 3 (x). Each step is a
// standalone classifier that claims what it can and returns null otherwise;
// this file is the only place that decides the order they run in and who
// may override whom. It holds no word list and makes no r/w/x judgement of
// its own.
import { step1 } from './step1.js';
import { step2 } from './step2.js';
import { step3, floorPost } from './step3.js';

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
  if (two) {
    // PRECEDENCE RUNS ON EVIDENCE STRENGTH, NOT ON WHICH STEP RAN FIRST
    // (D78). A word beats no word. Step 2's word claims (modify-verb,
    // modify-verb-summary) read the row's verb and decided w on evidence,
    // so they are FINAL and step 3 never overrides them — not even when a
    // raise word is also present. Step 2's method-floor claim read no word
    // at all; it is a default, so step 3's noun scan is allowed to raise it
    // w -> x. Reading this as "step 2 ran first, so step 2 wins" gets the
    // ladder backwards and silently kills the raise-word rule.
    if (two.rule === 'method-floor') {
      const raised = step3(row);
      if (raised) return raised;
    }
    return two;
  }

  // No step claimed the row with anything: step 3's floor.
  return floorPost();
}
