// Step 1 — the r step. It is a standalone classifier: it claims the rows it
// can call r and hands every other row down to step 2 untouched. It never
// assigns w or x, and it reads no corpus and prints nothing.
import { leadVerbAfterModifiers, tokensForRow, matchesAnyStem } from './words.mjs';

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

// SAFE_VERBS: read verbs that are never nouns in an API name, so they can be
// matched at ANY token position, not just the lead. The full READ_VERBS list
// cannot be read this way — `list`, `get`, `count` and `check` are object
// nouns as often as verbs, and matching the full list anywhere scores 31
// leaks instead of 0 (mailchimp postLists, postListsIdMembers, and 18 more).
export const SAFE_VERBS = new Set([
  'validate', 'evaluate', 'analyse', 'analyze', 'parse', 'calculate',
  'introspect', 'suggest', 'sanitise', 'sanitize',
]);

/**
 * Apply step 1 to one row.
 * @param {{method?:string, operationId?:string, path?:string}} row
 * @param {Set<string>|{readVerbs?:Set<string>, safeVerbs?:Set<string>}} [words]
 *   word lists to use (LOVO passes rebuilt ones). A bare Set is read as
 *   readVerbs, which is how the parameter worked before SAFE_VERBS existed.
 * @returns {{class:'r', step:1, rule:'method'|'read-verb'|'read-verb-anywhere'}|null}
 *   null when step 1 does not claim the row and it passes down to step 2.
 */
export function applyStep1(row, words = READ_VERBS) {
  const readVerbs = words instanceof Set ? words : (words.readVerbs ?? READ_VERBS);
  const safeVerbs = words instanceof Set ? SAFE_VERBS : (words.safeVerbs ?? SAFE_VERBS);

  const method = (row.method || '').toUpperCase();
  if (READ_METHODS.has(method)) return { class: 'r', step: 1, rule: 'method' };
  if (method !== 'POST') return null;
  if (matchesAnyStem(leadVerbAfterModifiers(row), readVerbs)) {
    return { class: 'r', step: 1, rule: 'read-verb' };
  }
  // Lower-priority POST rule: a SAFE_VERBS word at any token position. Price
  // the user accepted on 2026-09-16: it claims 5 rows, 4 right, 1 leak —
  // stripe PostPaymentMethodDomainsPaymentMethodDomainValidate (truth w,
  // confidence low; validating a payment method domain stores the result).
  // All 4 gains are digitalocean (apps_validate_appSpec, apps_validate_rollback,
  // registries_validate_name, registry_validate_name). Under leave-one-vendor-out
  // the rule is 83/82/1 against the previous 78/78/0 — the leak generalizes,
  // the gains do not. Adopted on the user's explicit decision.
  if (tokensForRow(row).tokens.some((t) => matchesAnyStem(t, safeVerbs))) {
    return { class: 'r', step: 1, rule: 'read-verb-anywhere' };
  }
  return null;
}
