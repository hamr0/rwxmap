// The D87 ladder: step 1 (r), then step 2 (x by evidence), then step 3
// (w), then step 2's floor. Each step is a standalone classifier that
// claims what it can and returns null otherwise; this file is the only
// place that decides the order they run in. It holds no word list and
// makes no r/w/x judgement of its own.
//
// Precedence (D87): method DELETE beats every word — step 2 claims it
// first, unconditionally, and nothing downstream ever runs for a DELETE
// row. Below that, a word beats a floor, on read methods too: a word on a
// GET/HEAD/OPTIONS/QUERY row (step 2's get-action) can raise it before the
// read floor (floorRead, step 1's) is reached. For the other rows: step 2 tries its CANT_UNDO word
// rule, then step 3 tries its KEEP_W word rule, before either floor is
// reached. CANT_UNDO and KEEP_W are disjoint by construction (asserted in
// step2.test.js / step3.test.js — every member of one fails
// stemMatches against every member of the other), so no row can ever match
// both lists and there is nothing left to arbitrate between steps 2 and
// 3 — the run order alone decides which word rule gets first look, and
// because they never both fire, that order never actually matters to the
// outcome. Unclaimed rows fall to step 2's floor (floorPost), the tighter
// class for an unknown; read-method rows that no word claims fall to the
// read floor (r).
import { step1, floorRead, READ_METHODS } from './step1.js';
import { step2, floorPost } from './step2.js';
import { step3 } from './step3.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

/**
 * The REVIEW HINT for one decided row: which rows a provider should look at
 * before publishing the map. It is derived, not measured — method + class +
 * source (+ what the second pass did, if it ran) and nothing else — and it
 * asserts nothing the tool does not already publish.
 *
 * THE ONE WRITER of the `review` field. classifyRow below sets it, and
 * jev.js's applyJev and secondpass.js recompute it through THIS function
 * whenever they move a verdict. Nothing else may decide a hint.
 *
 * Which way a row could be wrong. 'settled' means the class equals the
 * method's default. After the three secondPass branches below, which win:
 *   PUT, PATCH, POST: class x -> 'tight' (may be tighter than needed, review
 *     to loosen); class w or r -> 'loose' (may be looser than needed).
 *   GET, HEAD, OPTIONS, QUERY: class r -> 'settled'; x -> 'tight'; w -> 'loose'.
 *   DELETE: class x -> 'settled'; w or r -> 'loose'.
 *   Any other method: 'settled'.
 * The second pass overrides: undecided ->
 * tight; raised -> tight if the final class is x, else loose; lowered ->
 * loose.
 *
 * @param {string|undefined} method the row's HTTP method, read
 *   case-insensitively like every other method check in this library.
 * @param {'r'|'w'|'x'} cls the verdict's class.
 * @param {'floor'|'list'|'jev'|'rwxlite'} source the verdict's source.
 * @param {'raised'|'lowered'|'undecided'} [secondPass] what the second pass
 *   did to this row, absent when it did not touch it (or did not run).
 *   undecided -> tight; raised -> tight if the final class is x, else loose;
 *   lowered -> loose.
 * @returns {'tight'|'loose'|'settled'}
 */
export function reviewHint(method, cls, source, secondPass) {
  if (secondPass === 'undecided') return 'tight';
  if (secondPass === 'raised') return cls === 'x' ? 'tight' : 'loose';
  if (secondPass === 'lowered') return 'loose';
  const m = (method || '').toUpperCase();
  if (m === 'PUT' || m === 'PATCH' || m === 'POST') return cls === 'x' ? 'tight' : 'loose';
  if (READ_METHODS.has(m)) return cls === 'r' ? 'settled' : cls === 'x' ? 'tight' : 'loose';
  if (m === 'DELETE') return cls === 'x' ? 'settled' : 'loose';
  return 'settled';
}

/**
 * Classify one row through the whole ladder.
 * @param {Operation} row
 * @param {{readVerbs?: Set<string>, safeVerbs?: Set<string>, cantUndo?: Set<string>, removes?: Set<string>, credentialSet?: Set<string>, credentialChangeVerbs?: Set<string>, keepW?: Set<string>}} [words]
 *   Word lists to use in place of each step's own — the lists are the
 *   module's own unless a caller passes rebuilt ones (leave-N-vendor-out
 *   measurement); an adopter never passes it.
 * @returns {Verdict} always a verdict — this function never returns null.
 */
export function classifyRow(row, words = {}) {
  const verdict = step1(row, words)
    || step2(row, words)
    || step3(row, words)
    || (READ_METHODS.has((row.method || '').toUpperCase()) ? floorRead() : floorPost());

  return { ...verdict, review: reviewHint(row.method, verdict.class, verdict.source) };
}
