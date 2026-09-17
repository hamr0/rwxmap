// Step 2 — the w step. It is a standalone classifier: it takes the rows step
// 1 left behind, claims the ones it can call w, and hands every other row
// down to step 3 untouched. It never assigns r or x, it reads no corpus and
// it prints nothing.
//
// Two rules, and what each cost when the orchestrator priced it on the
// 15-provider corpus BEFORE this file was written:
//
//   method-floor  PUT/DELETE/PATCH are w by the method itself.
//   modify-verb   a POST whose verb says the thing already exists is lowered
//                 x -> w. The verb alone claims 156 rows with 14 leaks
//                 (9.0%); adding the OTHER_PARTY gate takes that to 3 leaks;
//                 adding the summary fallback then doubles the reach.
//
// Three verbs were measured and REJECTED because they paid most of the
// leaks: `set` (3 leaks), `attach` (2), `finalize` (1). Dropping all three
// cost 13 right rows and saved 6 leaks. Five OTHER_PARTY words the
// orchestrator had written from imagination -- `guest`, `guests`,
// `invitee`, `teammate`, `attendee` -- appear nowhere in the corpus and were
// deleted before adoption.
import { leadVerbAfterModifiers, tokensForRow, matchesAnyStem } from '../step1/words.mjs';

// MODIFY_VERBS (24): verbs that act on a thing that already exists. On a
// POST they are evidence to lower x -> w. Hand-read from the corpus pile by
// the orchestrator and priced word by word before adoption.
export const MODIFY_VERBS = new Set([
  'cancel', 'delete', 'archive', 'unarchive', 'move', 'dismiss', 'restore',
  'pause', 'unpause', 'activate', 'deactivate', 'rotate', 'disable', 'enable',
  'swap', 'merge', 'update', 'modify', 'change', 'remove', 'suspend',
  'detach', 'expire', 'void',
]);

// OTHER_PARTY (21): role nouns naming someone who is not the caller. If any
// word of the row is one of these, the lowering is BLOCKED and the row stays
// for step 3. These are general English role words, not vendor vocabulary --
// user appears on 11 of the 15 providers, users on 9, members on 6, member
// and permissions on 5 each.
//
// Four words -- `customer`, `contact`, `agent`, `person` -- were REMOVED on
// 2026-09-17 after the orchestrator priced them in Bash: `customer` blocks 8
// POST rows (all 8 truth w), `contact` 5 (all w), `agent` 3 (all w),
// `person` 2 (all w) -- 18 rows vetoed between them for ZERO leaks caught.
// They were added because they name a human, which was the wrong test: the
// gate asks whose data it is, not whether a person is involved, and your own
// customer record, your own contact and your own agent are your data.
// Removing them took reach from 211 to 227 of the 380 truth-w POST rows with
// leaks unchanged at 5, and LOVO from 3.4% to 3.2%.
export const OTHER_PARTY = new Set([
  'user', 'users', 'member', 'members', 'follower', 'followers', 'role',
  'roles', 'permission', 'permissions', 'participant', 'participants',
  'collaborator', 'invite', 'people', 'admin', 'assignee', 'owner',
  'subscriber', 'recipient', 'audience',
]);

// Words skipped when reading a verb from the summary, before the verb is read.
const SUMMARY_SKIP = new Set(['test', 'mode', 'a', 'an', 'the', 'bulk', 'batch']);
const METHOD_WORDS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const FLOOR_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

/** Every word of the row's summary, lowercased. */
export function summaryWords(row) {
  return (row.summary || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/** The first summary word that is not a SUMMARY_SKIP filler, or ''. */
export function summaryVerb(row) {
  for (const w of summaryWords(row)) {
    if (!SUMMARY_SKIP.has(w)) return w;
  }
  return '';
}

/**
 * The verb this row is judged on. Normally the operationId lead verb. But
 * stripe and mailchimp name every operation `PostSomething`, so when the lead
 * verb is a bare HTTP method word the operationId carries no verb at all and
 * the summary is read instead.
 */
export function verbForRow(row) {
  const lead = leadVerbAfterModifiers(row);
  if (METHOD_WORDS.has(lead)) return summaryVerb(row);
  return lead;
}

/** Every word the OTHER_PARTY gate looks at: operationId/path tokens + summary. */
export function wordsForRow(row) {
  return [...tokensForRow(row).tokens, ...summaryWords(row)];
}

/**
 * Apply step 2 to one row.
 * @param {{method?:string, operationId?:string, path?:string, summary?:string}} row
 * @param {{modifyVerbs?:Set<string>, otherParty?:Set<string>}} [words]
 *   word lists to use (LOVO passes rebuilt ones).
 * @returns {{class:'w', step:2, rule:'method-floor'|'modify-verb'|'modify-verb-summary'}|null}
 *   null when step 2 does not claim the row and it passes down to step 3.
 */
export function applyStep2(row, words = {}) {
  const modifyVerbs = words.modifyVerbs ?? MODIFY_VERBS;
  const otherParty = words.otherParty ?? OTHER_PARTY;

  const method = (row.method || '').toUpperCase();
  if (FLOOR_METHODS.has(method)) return { class: 'w', step: 2, rule: 'method-floor' };
  if (method !== 'POST') return null;

  const lead = leadVerbAfterModifiers(row);
  const fromSummary = METHOD_WORDS.has(lead);
  const verb = fromSummary ? summaryVerb(row) : lead;
  if (!matchesAnyStem(verb, modifyVerbs)) return null;

  // The gate: a modify verb aimed at someone who is not the caller is not a
  // w. Blocked rows are not claimed r or x here — they go on to step 3.
  if (wordsForRow(row).some((w) => otherParty.has(w))) return null;

  return { class: 'w', step: 2, rule: fromSummary ? 'modify-verb-summary' : 'modify-verb' };
}
