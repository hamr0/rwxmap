// Step 1 — the r step. A standalone classifier: it claims the rows it can
// call r and returns null for everything else, which passes down to step 2
// untouched. It never assigns w or x, reads no files, and prints nothing.
import { leadVerbAfterModifiers, tokensForRow, matchingMembers } from './tokens.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

// Methods whose floor is r: they are the read verbs of HTTP itself.
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// READ_VERBS
//
// DIRECTION: lowers toward r. A POST otherwise floors at its later step's
// default (w or x); a lead-verb match here pulls it down to r instead.
// WHICH ROWS: only POST rows step 1 has not already claimed by method.
// WHERE IT MATCHES: the LEAD token only (after skipping LEAD_MODIFIERS such
// as "bulk"/"batch"/"deprecated"/"beta"/"async") — never any position. A
// POST's lead verb is the operationId's or the trailing path segment's
// first real word, and that is the one place a verb reliably names the
// action; matching elsewhere would catch nouns that merely resemble verbs
// deeper in the name.
// WHAT IT IS NOT: not SAFE_VERBS (below). READ_VERBS answers "does this verb
// mean read?" and is matched at the lead only; SAFE_VERBS answers "is this
// word ever a noun?" and is matched anywhere. The two lists were measured
// and kept separate on the user's explicit ruling — merging them, or
// deriving one from the other, was rejected.
//
// 'verify' is deliberately NOT in this list: it fired 4 times on POST rows
// in this corpus and was wrong 3 of those 4 times (meta-whatsapp
// verifyPhoneNumberCode, verifyPreVerifiedPhoneNumberCode, mailchimp
// verifyDomain — all truth w; a verify call that changes the record's
// verified state is a write, not a read). D74.
export const READ_VERBS = new Set([
  'retrieve', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'count', 'lookup', 'assess', 'find', 'get',
  'validate', 'evaluate', 'analyse', 'analyze', 'parse', 'calculate',
  'introspect', 'suggest', 'sanitise', 'sanitize',
]);

// PLURAL-NOUN GUARD (D99, adopted 2026-09-23)
//
// DIRECTION: tightens. It never claims a row; it only withholds
// read-verb's claim, leaving the row to fall through the rest of the
// ladder untouched.
// WHICH ROWS: only the POST rows read-verb was about to claim — that is,
// only after matchingMembers(leadVerb, READ_VERBS) has already returned a
// non-empty list.
// WHERE IT MATCHES: the LEAD token only, against the members read-verb
// itself matched. An operationId names its action in the IMPERATIVE
// (createList, listAccounts), never the third person, so a lead token that
// reaches a read verb ONLY through a plural / third-person-singular
// inflection (-s, -es, consonant+y -> -ies) is a resource NOUN, not a
// verb: github's checks/rerequest-suite leads with `checks`, which
// stemMatches accepts as `check`, and its real action is `rerequest`. A
// lead token that equals a member outright, or reaches it through any
// other inflection (-e, -d, -ed, -ing, doubled-consonant, -ied), is a real
// verb and still claims.
// WHAT IT IS NOT: not a word list, and not a rule of its own — it emits no
// verdict and appears in no ledger. It does NOT touch read-verb-anywhere
// (SAFE_VERBS, any position), the GET/HEAD/OPTIONS method floor, or step 2
// or step 3.
//
// Numbers: on the 8376-row tuning pool it closed 1 leak at 0 cost
// (list/read-verb/r goes n=109/1 leak to n=108/0 leaks; pool exact
// 6727 -> 6728, leaks 83 -> 82, over-tight 1566 unchanged) and 0 of 35
// leave-one-fold-out folds were made worse.
const PLURAL_SUFFIXES = ['s', 'es'];

/**
 * True when `lead` reaches `stem` ONLY as a plural / third-person-singular
 * form of it — never true when the two are the same word.
 * @param {string} lead
 * @param {string} stem
 * @returns {boolean}
 */
function isPluralOf(lead, stem) {
  if (lead === stem) return false;
  for (const suffix of PLURAL_SUFFIXES) {
    if (lead === stem + suffix) return true;
  }
  if (stem.endsWith('y') && lead === stem.slice(0, -1) + 'ies') return true;
  return false;
}

// SAFE_VERBS
//
// DIRECTION: also lowers toward r, at lower priority than READ_VERBS (it is
// only consulted after read-verb has already failed to claim the row).
// WHICH ROWS: only POST rows neither the method floor nor read-verb has
// claimed.
// WHERE IT MATCHES: ANY token position, not just the lead — and this is
// deliberately narrower than READ_VERBS to make that safe. Matching the
// full 23-word READ_VERBS set at any position scores 31 leaks instead of 0
// (D74), because `list`, `get`, `count` and `check` are object nouns as
// often as verbs in an API name (mailchimp postLists, postListsIdMembers,
// and 18 more). SAFE_VERBS holds only the 10 members that are never nouns
// in this corpus, so matching them anywhere in the name is safe.
// WHAT IT IS NOT: not READ_VERBS. Do not confuse "is this word ever a
// noun?" (SAFE_VERBS, any position) with "does this verb mean read?"
// (READ_VERBS, lead only) — merging them into one list-plus-position-flag
// was considered and rejected; they answer different questions and are
// measured against different corpora costs.
export const SAFE_VERBS = new Set([
  'validate', 'evaluate', 'analyse', 'analyze', 'parse', 'calculate',
  'introspect', 'suggest', 'sanitise', 'sanitize',
]);

/**
 * Apply step 1 to one row.
 * @param {Operation} row
 * @param {{readVerbs?: Set<string>, safeVerbs?: Set<string>}} [words]
 *   Word lists to use in place of the module's own (LOVO passes rebuilt
 *   ones). Omitted fields fall back to READ_VERBS / SAFE_VERBS.
 * @returns {Verdict|null} null when step 1 does not claim the row.
 */
export function step1(row, words = {}) {
  const readVerbs = words.readVerbs ?? READ_VERBS;
  const safeVerbs = words.safeVerbs ?? SAFE_VERBS;

  const method = (row.method || '').toUpperCase();
  if (READ_METHODS.has(method)) {
    return { class: 'r', step: 1, rule: 'method', source: 'floor', matched: [] };
  }
  if (method !== 'POST') return null;

  const leadVerb = leadVerbAfterModifiers(row);
  const leadMatches = matchingMembers(leadVerb, readVerbs);
  // The guard (D99, above): withhold the claim only when EVERY member
  // read-verb matched was reached through a plural/3sg inflection, which
  // makes the lead token a resource noun rather than a verb.
  if (leadMatches.length > 0 && !leadMatches.every((m) => isPluralOf(leadVerb, m))) {
    return { class: 'r', step: 1, rule: 'read-verb', source: 'list', matched: leadMatches };
  }

  // Lower-priority POST rule: a SAFE_VERBS word at any token position. A
  // deliberate loosening the user bought at a measured price — the leak is
  // stripe's; under leave-one-vendor-out the leak generalizes while the
  // gains do not. Adopted on the user's explicit decision. Numbers: D74.
  const tokens = tokensForRow(row);
  const anyMatches = new Set();
  for (const t of tokens) {
    for (const m of matchingMembers(t, safeVerbs)) anyMatches.add(m);
  }
  if (anyMatches.size > 0) {
    return {
      class: 'r',
      step: 1,
      rule: 'read-verb-anywhere',
      source: 'list',
      matched: [...anyMatches].sort(),
    };
  }

  return null;
}
