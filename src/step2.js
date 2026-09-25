// Step 2 — the x step (D87: the shared chmod reading, r/w/x — see
// docs/product/prd.md "The shared definition (D87)" / "M3 spec (D87)").
// A standalone classifier: it claims the rows it can call x and returns
// null for everything else, which passes down to step 3 untouched. It
// never assigns r or w, it does not call step 1 (the ladder decides
// order), it reads no files and it prints nothing.
//
// Rebuilt under D87, not a patch of the pre-D87 file: the old step 2
// answered "whose is it" (OTHER_PARTY/MODIFY_VERBS); D87 drops "whose" as
// a class test entirely (see the PRD's "Why" paragraph) and step 2 now
// asks only "can this be undone". The verb-reading helper (verbForRow) is
// shared with step3.js via ./tokens.js.
import { matchingMembers, verbForRow } from './tokens.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').StepVerdict} StepVerdict */

// CANT_UNDO (29)
//
// DIRECTION: claims x. This is the only word rule in the whole ladder that
// claims x — step 3 (below) only ever claims w.
// WHICH ROWS: POST, PUT or PATCH rows (DELETE is claimed by the
// method-delete floor above this rule; see step2() below).
// WHERE IT MATCHES: a single verb, stem-matched (via matchingMembers)
// against the verb this row is judged on — verbForRow's lead verb, or,
// when the lead token carries no verb at all (a bare HTTP method word,
// e.g. stripe's PostTaxCalculations, mailchimp's postLists), the summary's
// first non-filler word instead.
// WHAT IT IS NOT: not a "whose" test. D87 dropped OTHER_PARTY and its
// gate entirely — a can't-undo verb claims x regardless of who the row
// reaches.
//
// PROVENANCE: written from the v3-relabelled pile (data/relabel-2026-09-22,
// BRIEF-v3's "What cannot be undone" list), by reading which verbs the
// relabel actually marked x, plus the PRD's own spec candidates (delete,
// remove, purge, revoke, expire, void, send, publish, trigger, run,
// execute, charge, pay, refund …). Priced against the tuning set (D87 POC
// readout, poc/d87/README.md): 673 list rows, 22 lowering leaks (3.3 per
// 100), passing the D89-revised gate item 1 (<=2 per 100... marked
// "over the bar", see D89 — kept pending the fresh exam, not because the
// list itself is wrong, but per D89's plan of graduating first and
// re-measuring on the fresh exam next).
export const CANT_UNDO = new Set([
  'delete', 'purge', 'revoke', 'expire', 'void', 'send', 'publish',
  'trigger', 'run', 'execute', 'charge', 'pay', 'refund', 'cancel',
  'reject', 'redact', 'accept', 'approve', 'rotate', 'merge', 'capture',
  'request', 'dismiss', 'unsubscribe', 'simulate', 'complete', 'resend',
  'reset', 'start',
]);

// REMOVES (6) ⊂ CANT_UNDO
//
// The subset of CANT_UNDO that also sets `destructive: true` when it is
// the member that matched — a refinement flag inside x (D86's ruling on
// D28 stands: destructive is a flag on x, never a fourth class). Every
// CANT_UNDO member marks the row x; only these six mark it destructive
// too, because only these six remove something rather than merely doing
// something unrepeatable.
export const REMOVES = new Set(['delete', 'purge', 'revoke', 'expire', 'void', 'redact']);

/**
 * Apply step 2 to one row.
 * @param {Operation} row
 * @param {{cantUndo?: Set<string>, removes?: Set<string>}} [words]
 *   Word lists to use in place of the module's own (LOVO passes rebuilt
 *   ones). Omitted fields fall back to CANT_UNDO / REMOVES.
 * @returns {StepVerdict|null} null when step 2 does not claim the row.
 */
export function step2(row, words = {}) {
  const cantUndo = words.cantUndo ?? CANT_UNDO;
  const removes = words.removes ?? REMOVES;

  const method = (row.method || '').toUpperCase();
  // DELETE beats every word (D87): it is always x, always destructive,
  // with no word evidence needed or possible. This floor is decided by the
  // method alone, but unlike step 3's old method-floor default, DELETE's
  // verdict is never overridden by anything downstream — see flow.js.
  if (method === 'DELETE') {
    return { class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true };
  }
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') return null;

  const { verb, fromSummary } = verbForRow(row);
  const matched = matchingMembers(verb, cantUndo);
  if (matched.length === 0) return null;

  /** @type {StepVerdict} */
  const verdict = {
    class: 'x',
    step: 2,
    rule: fromSummary ? 'cant-undo-verb-summary' : 'cant-undo-verb',
    source: 'list',
    matched,
  };
  if (matched.some((m) => removes.has(m))) verdict.destructive = true;
  return verdict;
}

/**
 * Step 2's floor: the named leftover pile — a POST with no word evidence
 * anywhere in the ladder (step 1 did not claim it r, step 2's own
 * CANT_UNDO did not claim it x, step 3's KEEP_W did not claim it w). The
 * floor belongs to step 2 under D87 (x is the tighter class and the floor
 * always claims the tighter side of an unknown); flow.js calls it last.
 * @returns {StepVerdict}
 */
export function floorPost() {
  return { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [] };
}
