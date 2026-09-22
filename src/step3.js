// Step 3 — the w step (D87). A standalone classifier: it claims the rows
// it can call w and returns null for everything else, which passes down to
// step 2's floor untouched. It never assigns r or x, it does not call
// step 1 or step 2 (the ladder decides order), it reads no files and it
// prints nothing.
//
// Rebuilt under D87, not a patch of the pre-D87 file: the old step 3
// (RAISE_WORDS, an exact any-position noun match answering "whose is it")
// is gone — D87 drops "whose" as a class test entirely (see the PRD's
// "Why" paragraph, docs/product/prd.md "The shared definition (D87)").
// OTHER_PARTY, RAISE_WORDS and wordsForStep3/wordsForRow are deleted along
// with it. Shares the verb-reading helper (verbForRow) with step2.js via
// ./tokens.js.
import { matchingMembers, verbForRow } from './tokens.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

const FLOOR_METHODS = new Set(['PUT', 'PATCH']);

// KEEP_W (14)
//
// DIRECTION: claims w. A POST otherwise floors at x (step 2's floor-post);
// a verb match here claims it w instead.
// WHICH ROWS: only POST rows (PUT/PATCH already floor at w by method,
// below).
// WHERE IT MATCHES: a single verb, stem-matched against the verb this row
// is judged on — verbForRow's lead verb, or the summary verb when the
// lead carries no verb (see tokens.js's verbForRow).
// WHAT IT IS NOT: not a "whose" test, and not the pre-D87 MODIFY_VERBS list
// it superficially resembles — the can't-undo members that used to sit in
// that list (cancel, delete, archive, rotate, merge, expire, void, ...)
// moved to step 2's CANT_UNDO under D87; KEEP_W keeps only the survivors
// that D87's brief calls "can be set back".
//
// PROVENANCE: written from the v3-relabelled pile (data/relabel-2026-09-22,
// BRIEF-v3's "What can be set back" list) the same way CANT_UNDO was.
// `deactivate`, `change`, `swap`, `archive` and `disable` were measured and
// REMOVED (D89, user ruling 2026-09-22): each pays more leaks than it fixes
// against this project's adoption bar of 10 fixed per leak — 29/5 (5.8),
// 4/2 (2.0), 1/1 (1.0), 3/5 (0.6), 1/2 (0.5) — so their POST rows floor at
// x, the tighter side, instead. `create` was also measured and NOT
// adopted: 503 fixed / 72 leaks = 6.99, short of the bar of 10 (poc/d87
// README / learnings, "M3 POC under D87").
export const KEEP_W = new Set([
  'update', 'remove', 'add', 'attach', 'assign', 'activate', 'unarchive',
  'move', 'restore', 'pause', 'unpause', 'enable', 'modify', 'suspend',
]);

/**
 * Apply step 3 to one row.
 * @param {Operation} row
 * @param {{keepW?: Set<string>}} [words]
 *   Word list to use in place of the module's own (LOVO passes a rebuilt
 *   one). An omitted field falls back to KEEP_W.
 * @returns {Verdict|null} null when step 3 does not claim the row.
 */
export function step3(row, words = {}) {
  const keepW = words.keepW ?? KEEP_W;

  const method = (row.method || '').toUpperCase();
  if (FLOOR_METHODS.has(method)) {
    return { class: 'w', step: 3, rule: 'method-floor', source: 'floor', matched: [] };
  }
  if (method !== 'POST') return null;

  const { verb, fromSummary } = verbForRow(row);
  const matched = matchingMembers(verb, keepW);
  if (matched.length === 0) return null;

  return {
    class: 'w',
    step: 3,
    rule: fromSummary ? 'modify-verb-summary' : 'modify-verb',
    source: 'list',
    matched,
  };
}
