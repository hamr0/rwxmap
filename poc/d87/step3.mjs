// poc/d87/step3.mjs — D87's step 3, the w step. New under M3; not copied
// from src/step3.js (that file's RAISE_WORDS answers "whose", which D87
// drops). Shares the verb-reading helper (verbForRow) with step2.mjs via
// ./tokens.mjs, per brief.
//
// Standalone classifier: claims what it can call w and returns null
// otherwise. Never assigns r or x, does not call step 1 or step 2, reads no
// files, prints nothing.
import { matchingMembers, verbForRow } from './tokens.mjs';

const FLOOR_METHODS = new Set(['PUT', 'PATCH']);

// KEEP_W (14): the MODIFY_VERBS survivors that stay w under D87 (the
// can't-undo members left for step 2's CANT_UNDO). Stem-matched at the
// row's verb (lead, or summary when the lead carries no verb).
export const KEEP_W = new Set([
  'update', 'remove', 'add', 'attach', 'assign', 'activate', 'unarchive',
  'move', 'restore', 'pause', 'unpause', 'enable', 'modify', 'suspend',
]);

/**
 * Apply step 3 to one row.
 * @param {object} row
 * @param {{keepW?: Set<string>}} [words]
 * @returns {object|null} null when step 3 does not claim the row.
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
