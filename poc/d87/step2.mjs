// poc/d87/step2.mjs — D87's step 2, the x-by-evidence step. New under M3;
// not copied from src/step2.js (that file answers "whose", which D87 drops
// — see docs/product/prd.md "M3 spec (D87)"). The verb-reading helper
// (verbForRow) is shared with step3.mjs via ./tokens.mjs, per brief.
//
// Standalone classifier: claims what it can call x and returns null
// otherwise. Never assigns r or w, does not call step 1 or step 3, reads no
// files, prints nothing.
import { matchingMembers, verbForRow } from './tokens.mjs';

// CANT_UNDO (29), stem-matched at the row's verb (lead, or summary when the
// lead carries no verb). A match here is final: DELETE beats every word,
// but among words this is the only rule that claims x.
export const CANT_UNDO = new Set([
  'delete', 'purge', 'revoke', 'expire', 'void', 'send', 'publish',
  'trigger', 'run', 'execute', 'charge', 'pay', 'refund', 'cancel',
  'reject', 'redact', 'accept', 'approve', 'rotate', 'merge', 'capture',
  'request', 'dismiss', 'unsubscribe', 'simulate', 'complete', 'resend',
  'reset', 'start',
]);

// REMOVES (6) ⊂ CANT_UNDO: the subset that also sets `destructive: true`
// when it is the member that matched. Every CANT_UNDO member marks the row
// x; only these six mark it destructive too.
export const REMOVES = new Set(['delete', 'purge', 'revoke', 'expire', 'void', 'redact']);

/**
 * Apply step 2 to one row.
 * @param {object} row
 * @param {{cantUndo?: Set<string>, removes?: Set<string>}} [words]
 * @returns {object|null} null when step 2 does not claim the row.
 */
export function step2(row, words = {}) {
  const cantUndo = words.cantUndo ?? CANT_UNDO;
  const removes = words.removes ?? REMOVES;

  const method = (row.method || '').toUpperCase();
  if (method === 'DELETE') {
    return { class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true };
  }
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') return null;

  const { verb, fromSummary } = verbForRow(row);
  const matched = matchingMembers(verb, cantUndo);
  if (matched.length === 0) return null;

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
 * anywhere in the ladder. The floor belongs to step 2; flow.mjs calls it
 * last (brief: "The floor belongs to step 2; the flow calls it last").
 * @returns {object}
 */
export function floorPost() {
  return { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [] };
}
