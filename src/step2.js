// Step 2 — the w step. A standalone classifier: it claims the rows it can
// call w and returns null for everything else, which passes down to step 3
// untouched. It never assigns r or x, it does not call step 1 (the ladder
// decides order), it reads no files and it prints nothing.
import { leadVerbAfterModifiers, tokensForRow, matchingMembers, METHOD_WORDS } from './tokens.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

// Methods whose floor is w by the method itself, no words involved. This
// floor is a DEFAULT — a later step is free to override it with evidence
// (step 3's raise-word rule does exactly that to a method-floor row). The
// two word rules below are the opposite: a word claim is FINAL and nothing
// downstream overrides it. Precedence runs on evidence strength, not on
// which step ran first (D78) — getting this backwards is the easiest way
// to break the ladder.
const FLOOR_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// MODIFY_VERBS (24)
//
// DIRECTION: lowers toward w. A POST otherwise floors at x (step 3's
// floor-post); a lead-verb (or, when the lead carries no verb, summary-verb)
// match here pulls it down to w instead.
// WHICH ROWS: only POST rows, and only when the gate below does not block.
// WHERE IT MATCHES: a single verb, stem-matched (via stemMatches) against
// the verb this row is judged on — the operationId's lead verb, or the
// summary's first non-filler word when the lead token is a bare HTTP method
// word (METHOD_WORDS), which is how stripe's `PostTaxCalculations` and
// mailchimp's `postLists` are reached, since their operationIds carry no
// verb at all — never any-position, since these are verbs naming an action
// already done to an existing thing, not nouns.
// WHAT IT IS NOT: not OTHER_PARTY (below), which does not itself lower
// anything — it only blocks this list's lowering.
//
// Three verbs were measured and REJECTED because they paid most of the
// leaks: `set` (3 leaks), `attach` (2), `finalize` (1) (D75).
export const MODIFY_VERBS = new Set([
  'cancel', 'delete', 'archive', 'unarchive', 'move', 'dismiss', 'restore',
  'pause', 'unpause', 'activate', 'deactivate', 'rotate', 'disable', 'enable',
  'swap', 'merge', 'update', 'modify', 'change', 'remove', 'suspend',
  'detach', 'expire', 'void',
]);

// OTHER_PARTY (21)
//
// DIRECTION: moves nothing itself — the one via-negativa list in this tool.
// It BLOCKS a MODIFY_VERBS lowering rather than causing one.
// WHICH ROWS: consulted only on a POST row whose verb already matched
// MODIFY_VERBS — the gate that decides whether that lowering may proceed.
// WHERE IT MATCHES: an EXACT match against ANY word of the row (operationId
// and path tokens plus every summary word — see wordsForRow), not a stem
// match at the lead — these are role nouns, not verbs to be inflected, and
// the noun can sit anywhere in the name.
// WHAT IT IS NOT: not RAISE_WORDS (step 3). The two overlap on exactly two
// words, `permission` and `participants` — deliberate, measured, and not to
// be "tidied" away. They sit on different steps, see different rows, and
// move in opposite directions: OTHER_PARTY blocks a lowering on step 2's
// POST rows; RAISE_WORDS forces a raise on step 3's PUT/DELETE/PATCH floor
// rows. D75 measured the WHOLE of OTHER_PARTY used as a raiser over those
// same floor rows and REJECTED it — 0.31 leaks closed per false alarm
// against this project's adoption bar of 10, because `user` flags 42 write
// rows of which only 13 are truth x. `permission` was the single exception
// (6 flags, all 6 truth x, 0 false alarms) and was left for step 3, which
// adopted it.
//
// Four words — `customer`, `contact`, `agent`, `person` — were REMOVED on
// 2026-09-17: they vetoed 18 rows between them, all truth w, and caught
// zero leaks. They named a human, which was the wrong test — the gate asks
// whose data it is, not whether a person is involved, and your own
// customer record is your data (D75).
export const OTHER_PARTY = new Set([
  'user', 'users', 'member', 'members', 'follower', 'followers', 'role',
  'roles', 'permission', 'permissions', 'participant', 'participants',
  'collaborator', 'invite', 'people', 'admin', 'assignee', 'owner',
  'subscriber', 'recipient', 'audience',
]);

// Words skipped when reading a verb off the summary, before the verb is
// read. Tokeniser-ish plumbing for the summary line, not a classification
// list — nothing here decides r/w/x.
const SUMMARY_SKIP = new Set(['test', 'mode', 'a', 'an', 'the', 'bulk', 'batch']);

/**
 * Every word of the row's summary, lowercased.
 * @param {Operation} row
 * @returns {string[]}
 */
function summaryWords(row) {
  return (row.summary || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/**
 * The first summary word that is not a SUMMARY_SKIP filler, or ''.
 * @param {Operation} row
 * @returns {string}
 */
function summaryVerb(row) {
  for (const w of summaryWords(row)) {
    if (!SUMMARY_SKIP.has(w)) return w;
  }
  return '';
}

/**
 * Every word the OTHER_PARTY gate looks at: the row's operationId/path lead
 * tokens plus every summary word.
 *
 * Public, unlike the other helpers in this file: step 3 builds its own,
 * wider word set on top of this one (this plus the row's non-param path
 * tokens), so this is the one export that is not the entry point (step2)
 * or a LOVO word list (MODIFY_VERBS/OTHER_PARTY) — it exists because a real
 * caller outside this module needs it.
 * @param {Operation} row
 * @returns {string[]}
 */
export function wordsForRow(row) {
  return [...tokensForRow(row), ...summaryWords(row)];
}

/**
 * Apply step 2 to one row.
 * @param {Operation} row
 * @param {{modifyVerbs?: Set<string>, otherParty?: Set<string>}} [words]
 *   Word lists to use in place of the module's own (LOVO passes rebuilt
 *   ones). Omitted fields fall back to MODIFY_VERBS / OTHER_PARTY.
 * @returns {Verdict|null} null when step 2 does not claim the row.
 */
export function step2(row, words = {}) {
  const modifyVerbs = words.modifyVerbs ?? MODIFY_VERBS;
  const otherParty = words.otherParty ?? OTHER_PARTY;

  const method = (row.method || '').toUpperCase();
  if (FLOOR_METHODS.has(method)) {
    return { class: 'w', step: 2, rule: 'method-floor', source: 'floor', matched: [] };
  }
  if (method !== 'POST') return null;

  const lead = leadVerbAfterModifiers(row);
  const fromSummary = METHOD_WORDS.has(lead);
  const verb = fromSummary ? summaryVerb(row) : lead;

  const matched = matchingMembers(verb, modifyVerbs);
  if (matched.length === 0) return null;

  // The gate: a modify verb aimed at someone who is not the caller is not a
  // w. A blocked row is not claimed here at all — it passes on to step 3.
  if (wordsForRow(row).some((w) => otherParty.has(w))) return null;

  return {
    class: 'w',
    step: 2,
    rule: fromSummary ? 'modify-verb-summary' : 'modify-verb',
    source: 'list',
    matched,
  };
}
