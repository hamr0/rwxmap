// poc/d87/flow.mjs — the D87 ladder: step 1 (r), step 2 (x by evidence),
// step 3 (w), step 2's floor. This file is the only place that decides run
// order; it holds no word list and makes no r/w/x judgement of its own.
import { step1 } from './step1.mjs';
import { step2, floorPost } from './step2.mjs';
import { step3 } from './step3.mjs';

/**
 * Classify one row through the whole D87 ladder.
 *
 * Precedence: method DELETE beats every word (step2's first check); a word
 * beats a floor (step2 and step3 each try their word rule before any floor
 * is reached); the order alone gives this because CANT_UNDO and KEEP_W are
 * disjoint (proven in step2.test.mjs / step3.test.mjs) — no row can match
 * both lists, so there is nothing to arbitrate between steps 2 and 3.
 * @param {object} row
 * @param {object} [words] passed through to every step, for LOVO.
 * @returns {object} always a verdict — this function never returns null.
 */
export function classifyRow(row, words = {}) {
  const one = step1(row, words);
  if (one) return one;

  const two = step2(row, words);
  if (two) return two;

  const three = step3(row, words);
  if (three) return three;

  return floorPost();
}
