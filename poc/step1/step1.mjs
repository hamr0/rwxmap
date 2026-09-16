// Step 1 — the r step. It is a standalone classifier: it claims the rows it
// can call r and hands every other row down to step 2 untouched. It never
// assigns w or x, and it reads no corpus and prints nothing.
import { leadVerbAfterModifiers, matchesAnyStem } from './words.mjs';

// Methods whose floor is r: they are the read verbs of HTTP itself.
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// READ_VERBS: a POST whose lead verb (after skipping LEAD_MODIFIERS) matches
// one of these is r.
//
// 'verify' is deliberately NOT in this list: it fired 4 times on POST rows in
// this corpus and was wrong 3 of those 4 times — meta-whatsapp
// verifyPhoneNumberCode, meta-whatsapp verifyPreVerifiedPhoneNumberCode and
// mailchimp verifyDomain are all truth w (a verify call that changes the
// record's verified state is a write, not a read).
export const READ_VERBS = new Set([
  // the 13 carried over from poc/flow's step 1 list, minus 'verify'
  'retrieve', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'count', 'lookup', 'assess', 'find', 'get',
  // compute/dry-run verbs, new here
  'validate', 'evaluate', 'analyse', 'analyze', 'parse', 'calculate',
  'introspect', 'suggest', 'sanitise', 'sanitize',
]);

/**
 * Apply step 1 to one row.
 * @param {{method?:string, operationId?:string, path?:string}} row
 * @param {Set<string>} [readVerbs] word list to use (LOVO passes a rebuilt one)
 * @returns {{class:'r', step:1, rule:'method'|'read-verb'}|null} null when
 *   step 1 does not claim the row and it passes down to step 2.
 */
export function applyStep1(row, readVerbs = READ_VERBS) {
  const method = (row.method || '').toUpperCase();
  if (READ_METHODS.has(method)) return { class: 'r', step: 1, rule: 'method' };
  if (method === 'POST' && matchesAnyStem(leadVerbAfterModifiers(row), readVerbs)) {
    return { class: 'r', step: 1, rule: 'read-verb' };
  }
  return null;
}
