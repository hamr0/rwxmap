// Step 3 — the x step. A standalone classifier: it only ever emits x, it
// never loosens to r or w, it does not call step 1 or step 2 (the ladder
// decides order), it reads no files and it prints nothing.
//
// Two rules, and they sit on opposite sides of the floor/list split:
//
//   raise-word  the one rule here that reads evidence. A word from
//               RAISE_WORDS anywhere in the row's words claims the row x.
//               The ladder only offers it rows step 2 claimed with its
//               WORDLESS method floor, which is step 3's only reach into
//               PUT/DELETE/PATCH — but the rule itself does not inspect
//               the method, so it stays a plain word test.
//   floor-post  the leftover pile: no word fired anywhere in the ladder,
//               only the method is known. See floorPost() below.
import { splitTokens } from './tokens.js';
import { wordsForRow } from './step2.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

// RAISE_WORDS (17)
//
// DIRECTION: raises toward x, and only ever upward — step 3 is the top of
// the ladder and has nothing below x to lower to.
// WHICH ROWS: only the rows the ladder hands it, which are step 2's
// wordless method-floor rows (PUT/DELETE/PATCH with no verb evidence). A
// row step 2 claimed with a WORD is never offered: a word beats no word.
// WHERE IT MATCHES: an EXACT match at ANY token position of the row's words
// (see wordsForStep3) — no stemming, no lead-token restriction. These are
// role/access nouns, not verbs to be inflected, so there is no inflection
// to accept and a noun can sit anywhere in the name. `passwords` does not
// match `password`, by design: only the members listed here match.
// WHAT IT IS NOT: not verbs. The PRD's step 3 sketch calls the mechanism
// "live verbs" and nothing in this list is a verb — every member names a
// permission, a membership, a credential, or someone else's presence in
// the account.
//
// The two-word overlap with step 2's OTHER_PARTY — `permission` and
// `participants` — is DELIBERATE, measured, and not to be tidied away
// (D75). The lists sit on different steps, see different rows, and move in
// opposite directions: OTHER_PARTY blocks a lowering on step 2's POST
// rows; RAISE_WORDS forces a raise on step 3's PUT/DELETE/PATCH floor
// rows. D75 measured the WHOLE of OTHER_PARTY used as a raiser over these
// same floor rows and REJECTED it (0.31 leaks closed per false alarm
// against an adoption bar of 10); `permission` was the single exception —
// 6 flags, all 6 truth x, 0 false alarms — and was left for step 3, which
// adopted it.
//
// The via-negativa "yours" noun list from the PRD's step 3 plan is
// deliberately absent: mining an allowlist of "these nouns mean it is the
// caller's own thing" was measured at 9 rows of 380 recovered at 0 leaks,
// too weak to adopt (D78). It is missing because it was tried and
// rejected, not because it was forgotten.
//
// Copied verbatim from the frozen poc/step3/step3.mjs. Do not add or
// remove any member.
export const RAISE_WORDS = new Set([
  'permission', 'membership', 'memberships', 'panelist', 'panelists',
  'watcher', 'watchers', 'participants', 'actor', 'invites', 'invitation',
  'invitations', 'sso', 'password', 'grant', 'disassociate', 'reject',
]);

/**
 * Every word step 3 looks at: step 2's wordsForRow (the row's
 * operationId/path lead tokens plus every summary word) PLUS the row's own
 * path tokens — every '/'-separated path segment that is not a {param}
 * placeholder, run through splitTokens.
 *
 * The path tokens are the reason this exists rather than step 3 reusing
 * wordsForRow directly: wordsForRow's path contribution is only the LEAD
 * token, so a raise word further back in the path (/users/{id}/permission)
 * would otherwise never be seen.
 * @param {Operation} row
 * @returns {string[]}
 */
export function wordsForStep3(row) {
  const path = row.path || '';
  const segments = path.split('/').filter((s) => s && !(s.startsWith('{') && s.endsWith('}')));
  const pathTokens = segments.flatMap((s) => splitTokens(s));
  return [...wordsForRow(row), ...pathTokens];
}

/**
 * Apply step 3's raise-word rule to one row.
 *
 * Looking for sourceForRule / matchedWordsForRule? They are gone. The POC
 * re-derived a row's `source` and its matched word(s) AFTER the fact, from
 * the rule name, because the frozen steps handed back only class/step/rule.
 * Every rule now returns its own `source` and its own `matched` at the
 * moment it matches, so there is nothing left to re-derive and nothing that
 * can drift from what actually fired.
 * @param {Operation} row
 * @param {{raiseWords?: Set<string>}} [words]
 *   Word list to use in place of the module's own (LOVO passes a rebuilt
 *   one). An omitted field falls back to RAISE_WORDS.
 * @returns {Verdict|null} null when no raise word appears in the row.
 */
export function step3(row, words = {}) {
  const raiseWords = words.raiseWords ?? RAISE_WORDS;

  // EVERY member present, not the first one found: a row can genuinely
  // carry two members at once (asana's /memberships/{gid} updateMembership
  // holds both `membership` and `memberships`), and reporting only one
  // would silently drop a real match.
  const rowWords = new Set(wordsForStep3(row));
  const matched = [...raiseWords].filter((w) => rowWords.has(w)).sort();
  if (matched.length === 0) return null;

  return { class: 'x', step: 3, rule: 'raise-word', source: 'list', matched };
}

/**
 * Step 3's floor: the named leftover pile. A row no step claimed with any
 * word at all is x — no evidence was read, only the method is known (in
 * this corpus always POST, since steps 1 and 2 between them claim every
 * GET/HEAD/OPTIONS/PUT/DELETE/PATCH row).
 *
 * This is a function, not a literal the ladder builds for itself: step 3
 * owns every verdict that carries step: 3, so there is one writer for the
 * shape of a floor-post verdict and flow.js cannot drift from it.
 * @returns {Verdict}
 */
export function floorPost() {
  return { class: 'x', step: 3, rule: 'floor-post', source: 'floor', matched: [] };
}
