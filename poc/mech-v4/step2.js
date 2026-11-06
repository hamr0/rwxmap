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
import {
  matchingMembers, verbForRow, splitTokens, tokensForRow, leadVerbAfterModifiers, stemMatches,
} from './tokens.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').StepVerdict} StepVerdict */

// CANT_UNDO (29)
//
// DIRECTION: claims x. Step 2 owns every word rule that claims x (this one
// and credential-set, below) — step 3 only ever claims w.
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

// CREDENTIAL_SET (3) and CREDENTIAL_CHANGE_VERBS (3) — the credential-set
// rule (D131; D130 rules that changing or setting a password is x).
//
// DIRECTION: claims x. Its own rule, separate from cant-undo-verb.
// WHICH ROWS: PUT and PATCH only (POST, DELETE and GET never reach it).
// It runs only when the CANT_UNDO lead-verb check above did not fire, so a
// CANT_UNDO row (resetPassword) keeps its own rule.
// WHERE IT MATCHES: either
//   (a) endpoint form: the last path segment is literal (not a {param})
//       and its last token is a CREDENTIAL_SET word (PUT /users/{id}/password);
//   (b) change form: the lead verb is a CREDENTIAL_CHANGE_VERBS member and
//       a CREDENTIAL_SET word is a token of the operationId, of a literal
//       path segment, or of the summary (PATCH changePin).
// WHAT IT IS NOT: not a credential-noun rule. A noun alone (password_rules,
// api_keys, updatePasswordPolicy) is mostly a metadata edit that is w.
//
// SINGULAR ONLY: the tuning POC (poc/f2-credential, V4) also took plurals.
// The plurals were dropped by reasoning, before any fresh data was read:
// "pins" names pinned items in some APIs (PUT /boards/{id}/pins), and
// "passwords" names a collection rather than the one secret being set.
//
// PROVENANCE: poc/f2-credential/score.mjs V4 — 2 right / 0 wrong on the
// combined tuning set, 3 right / 1 wrong on the buildset, fitted.
// Pre-registered as D131; pending its one gate-3 score.
export const CREDENTIAL_SET = new Set(['password', 'passcode', 'pin']);
export const CREDENTIAL_CHANGE_VERBS = new Set(['change', 'regenerate', 'regen']);

// PATH_X_WORDS (36) — the path-word rule (rule name 'path-x-word').
//
// DIRECTION: claims x. Step 2 owns it (it only ever raises).
// WHICH ROWS: PUT and PATCH only, and only rows no earlier step-2 rule
// claimed (not CANT_UNDO, not credential-set), so a row that would
// otherwise fall to step 3's PUT/PATCH method floor is raised to x when any
// word matches. POST, DELETE and GET never reach it.
// WHERE IT MATCHES: the path only. Split on '/', drop {param} segments,
// split each remaining segment on '#', tokenize each piece with
// splitTokens. A single word matches a token when stemMatches(token, word)
// or the token contains the word (so registrycredentials matches
// credential). A multi-word entry (shared_link, api_key, event_stream,
// log_stream, log_drain) matches as a consecutive token pair, the last word
// via stemMatches, or as the glued string inside one token. The matching
// helper (pathWordMatch) lives here, not in tokens.js: only this rule uses it.
// WHAT IT IS NOT: not the operationId or summary; not a credential-set
// rule; 'sso' and 'policy' are deliberately absent (they failed the bar).
//
// PROVENANCE: measured in poc/mech-v4/step2-score.mjs (mode C, site any).
// Under leave-one-vendor-out 360 of 682 PUT/PATCH floor leaks closed,
// 120 new too tight. The 36 words are those that passed the bar; the F4
// family (stop, cancel, ... complete) is excluded entirely.
export const PATH_X_WORDS = new Set([
  'role', 'member', 'access', 'permission', 'share', 'membership', 'oauth',
  'authorization', 'scope', 'scim', 'shared_link', 'acl', 'invite',
  'invitation', 'allowlist', 'trusted', 'grant', 'collaborator', 'sharing',
  'mfa', 'key', 'secret', 'token', 'credential', 'api_key', 'signing',
  'hook', 'webhook', 'integration', 'destination', 'logpush', 'event_stream',
  'log_stream', 'logsink', 'log_drain', 'forwarding',
]);

/**
 * The path-x-word rule's match, or [] when it does not fire.
 * @param {Operation} row a PUT or PATCH row
 * @param {Set<string>} pathXWords
 * @returns {string[]} the PATH_X_WORDS entries that matched, sorted
 */
function pathWordMatch(row, pathXWords) {
  const pieces = [];
  for (const seg of String(row.path || '').split('/')) {
    if (seg === '' || (seg.startsWith('{') && seg.endsWith('}'))) continue;
    for (const piece of seg.split('#')) {
      const toks = splitTokens(piece);
      if (toks.length) pieces.push(toks);
    }
  }
  const found = [];
  for (const word of pathXWords) {
    const parts = word.split('_');
    const n = parts.length;
    let hit = false;
    for (const toks of pieces) {
      if (n === 1) {
        hit = toks.some((t) => stemMatches(t, word) || t.includes(word));
      } else {
        for (let i = 0; i + n <= toks.length && !hit; i++) {
          let ok = true;
          for (let k = 0; k < n - 1 && ok; k++) ok = toks[i + k] === parts[k];
          if (ok && (toks[i + n - 1] === parts[n - 1] || stemMatches(toks[i + n - 1], parts[n - 1]))) hit = true;
        }
        if (!hit) hit = toks.some((t) => t.includes(parts.join('')));
      }
      if (hit) break;
    }
    if (hit) found.push(word);
  }
  return found.sort();
}

/**
 * The credential-set rule's match, or [] when it does not fire.
 * @param {Operation} row a PUT or PATCH row
 * @param {Set<string>} credentialSet
 * @param {Set<string>} changeVerbs
 * @returns {string[]} the CREDENTIAL_SET words that fired, sorted
 */
function credentialSetMatch(row, credentialSet, changeVerbs) {
  const isParam = (/** @type {string} */ seg) => seg.startsWith('{') && seg.endsWith('}');
  const segments = String(row.path || '').split('/').filter(Boolean);
  const found = new Set();

  // (a) endpoint form.
  const last = segments[segments.length - 1] || '';
  if (last && !isParam(last)) {
    const lastTokens = splitTokens(last);
    const end = lastTokens[lastTokens.length - 1];
    if (end && credentialSet.has(end)) found.add(end);
  }

  // (b) change form.
  if (matchingMembers(leadVerbAfterModifiers(row), changeVerbs).length > 0) {
    const tokens = [...tokensForRow(row)];
    for (const seg of segments) if (!isParam(seg)) tokens.push(...splitTokens(seg));
    tokens.push(...(row.summary || '').toLowerCase().split(/[^a-z]+/).filter(Boolean));
    for (const t of tokens) if (credentialSet.has(t)) found.add(t);
  }

  return [...found].sort();
}

/**
 * Apply step 2 to one row.
 * @param {Operation} row
 * @param {{cantUndo?: Set<string>, removes?: Set<string>, credentialSet?: Set<string>, credentialChangeVerbs?: Set<string>, pathXWords?: Set<string>}} [words]
 *   Word lists to use in place of the module's own (LOVO passes rebuilt
 *   ones). Omitted fields fall back to CANT_UNDO / REMOVES /
 *   CREDENTIAL_SET / CREDENTIAL_CHANGE_VERBS / PATH_X_WORDS.
 * @returns {StepVerdict|null} null when step 2 does not claim the row.
 */
export function step2(row, words = {}) {
  const cantUndo = words.cantUndo ?? CANT_UNDO;
  const removes = words.removes ?? REMOVES;
  const credentialSet = words.credentialSet ?? CREDENTIAL_SET;
  const changeVerbs = words.credentialChangeVerbs ?? CREDENTIAL_CHANGE_VERBS;
  const pathXWords = words.pathXWords ?? PATH_X_WORDS;

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
  if (matched.length === 0) {
    if (method === 'POST') return null;
    const credential = credentialSetMatch(row, credentialSet, changeVerbs);
    if (credential.length > 0) {
      return { class: 'x', step: 2, rule: 'credential-set', source: 'list', matched: credential };
    }
    const pathWords = pathWordMatch(row, pathXWords);
    if (pathWords.length === 0) return null;
    return { class: 'x', step: 2, rule: 'path-x-word', source: 'list', matched: pathWords };
  }

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
