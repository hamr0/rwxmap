// M1-C9 pass 2 — the judge. Pure scoring logic, no I/O.
//
// Runs only on rows pass 1 (the unmodified C7 arbiter) left at status
// 'review'. Signals, none of them machine fields — all read off the
// operationId, path and summary text:
//
//   (a) lead verb — leadVerbForJudge below: arbiter.mjs's own
//       leadVerbForRow (C5's method-word-stripped lead token) when
//       operationId is non-empty; for the handful of rows whose
//       operationId is empty, a NEW fallback (fallbackVerbFromSummary) —
//       the first word of the summary, lowercased, letters-only. This is
//       deliberately not arbiter.mjs's own empty-operationId fallback
//       (rawLeadStringForRow's last path segment), per the brief. This
//       source alone governs R2/R3/R4's OWN_VERBS check.
//   (b) head noun of the summary's object phrase — headNounForRow below.
//   (c) path party id — pathPartyIdForRow below: a {param} segment in the
//       path named in PARTY_PATH_PARAMS, unless the path is caller-shaped
//       (GitHub's /user/... or /users/me/... convention) or the summary
//       says "for the authenticated user" (either forces "no party id").
//       Gated by the pathPartyOn switch (round 3, default OFF — Stripe's
//       {customer} marks the merchant's own record of a customer, and the
//       head noun already separates "delete a customer" from "delete a
//       customer source").
//
// M1-C9 round 2 (coordinator corrections, 2026-09-07): R1 alone checks an
// OR of TWO verb sources — (a) above, AND (b) the summary's own first word,
// singularised — since a truth-x operation's operationId lead verb and its
// prose lead verb sometimes disagree (see summaryLeadVerb below).
//
// M1-C9 round 3 (coordinator corrections, 2026-09-08):
//   - R2's operationId party-hit source is now the operationId HEAD NOUN
//     (operationIdHeadNoun below), not "any token in PARTY_NOUNS" — tokens
//     after C5 stripping, drop the lead verb, take the last token, step
//     back over GENERIC_TAILS and also over "by"/"id" (e.g.
//     updateSessionStatus -> session; DeleteSipAuthCallsCredentialListMapping
//     -> mapping).
//   - path party id gated by pathPartyOn (default OFF, see above).
//   - R1 gets a third verb source, liveTokenOn (default OFF): ANY
//     operationId token (after C5 stripping, lead included) in LIVE_VERBS,
//     not just the lead — operationIdAnyLiveToken below.
//
// judgeRow applies R1-R5 in strict order (see the doc comment above it),
// then an optional floor. Every rule/source is its own boolean switch so a
// rule that leaks on CAMARA/hold-out-1 can be disabled without touching the
// others — run-c9.mjs owns rule admission (measured, not assumed).
//
// AccountSid is Twilio's own-account id, present on nearly every Twilio
// path whether the operation is on someone else's resource or not (see
// M1-C6, layer 6: party_id_param sits at share 0.161 for exactly this
// reason). It is deliberately never in PARTY_PATH_PARAMS and must never be
// added there by name.
import { leadVerbForRow, pathParamKeysForRow, methodPrior, tokensForRow } from './arbiter.mjs';

// --- given lists (verbatim from the M1-C9 brief; do not add or remove a
// word without taking it back to the user first) ---------------------------

export const LIVE_VERBS = new Set([
  'terminate', 'kick', 'cancel', 'revoke', 'convert', 'merge', 'start', 'dial',
  'hangup', 'end', 'reject', 'accept', 'approve', 'invite', 'transfer', 'pay',
  'refund', 'send', 'notify', 'publish', 'submit', 'trigger', 'execute', 'run',
  'launch', 'reboot', // 'reboot' added M1-C9 round 2, coordinator correction 4
]);

export const OWN_VERBS = new Set([
  'delete', 'remove', 'update', 'set', 'add', 'enable', 'disable', 'unstar',
  'star', 'unblock', 'block', 'unlock', 'lock', 'pin', 'unpin', 'dismiss',
  'mark', 'restore', 'apply', 'deregister', 'unassign', 'assign', 'create',
  'put', 'patch', 'edit', 'modify', 'replace', 'rename', 'reset', 'clear',
  'archive', 'unarchive', 'upload', 'attach', 'detach',
]);

export const PARTY_NOUNS = new Set([
  'member', 'membership', 'collaborator', 'collaboration', 'customer',
  'account', 'user', 'role', 'team', 'group', 'installation', 'token',
  'access', 'restriction', 'sponsorship', 'participant', 'call', 'seat',
  'organization', 'invitation', 'assignment', 'person', 'people', 'contact',
  'recipient', 'subscriber', 'tenant', 'partner',
  'device', 'session', 'network', // added M1-C9 round 2, coordinator correction 4
]);

// M1-C9 round 2, coordinator correction 3: a naive head-noun span sometimes
// lands on a generic tail word (Update device INFORMATION, Delete device
// RECORD) instead of the real object one word earlier. Checked on the raw
// (pre-singularisation) lowercased word.
const GENERIC_TAILS = new Set([
  'information', 'info', 'record', 'details', 'detail', 'data', 'status',
  'resource', 'entry', 'item', 'object', 'id', 'identifier', 'value', 'values',
]);

// M1-C9 round 3: the operationId head noun also steps back over "by" (on
// top of everything in GENERIC_TAILS, which already carries "id") —
// ...ById-shaped tails.
const OPID_TAIL_STEPBACK = new Set([...GENERIC_TAILS, 'by']);

// Path-param names that carry a party id — exact match, case-sensitive as
// the name appears in the path. "AccountSid" is intentionally absent (see
// the file header comment).
const PARTY_PATH_PARAMS = new Set([
  'username', 'user_id', 'userId', 'customer', 'person', 'member',
  'actor_identifier', 'participant', 'CallSid',
]);

const STOP_TOKENS = new Set(['from', 'for', 'to', 'in', 'on', 'of', 'by', 'with', 'at', 'into']);
const CALLER_PHRASE_RE = /for the authenticated user/i;

// --- (a) lead verb -----------------------------------------------------

// First word of `summary`, lowercased, letters-only, trailing punctuation
// stripped (the match anchors at the start and simply stops at the first
// non-letter, so anything after — punctuation, a following word glued by a
// dash, etc. — is dropped). '' when summary is empty/missing.
export function fallbackVerbFromSummary(summary) {
  const s = (summary || '').trim();
  if (!s) return '';
  const firstChunk = s.split(/\s+/)[0];
  const m = firstChunk.match(/^[A-Za-z]+/);
  return m ? m[0].toLowerCase() : '';
}

// Lead verb for the judge: reuses arbiter.mjs's leadVerbForRow (C5's
// method-word stripping) whenever operationId is non-empty; falls back to
// fallbackVerbFromSummary only when operationId is empty. This is a
// different fallback path than arbiter.mjs's own (which falls back to the
// last non-{param} path segment) — deliberately, per the brief. This is the
// SOLE verb source for R2/R3/R4's OWN_VERBS check; R1 additionally checks
// summaryLeadVerb and (when liveTokenOn) operationIdAnyLiveToken below.
export function leadVerbForJudge(row) {
  const opId = (row.operationId || '').trim();
  if (opId !== '') return leadVerbForRow(row);
  return fallbackVerbFromSummary(row.summary);
}

// M1-C9 round 2, coordinator correction 2: R1's second verb source — the
// summary's own first word, singularised. Unconditional on operationId
// being empty or not (unlike leadVerbForJudge above) — an operation can
// have a perfectly good operationId-derived verb that just isn't a live
// verb, while its prose leads with one (or vice versa).
export function summaryLeadVerb(row) {
  return naiveSingular(fallbackVerbFromSummary(row.summary));
}

// M1-C9 round 3: R1's third verb source (liveTokenOn switch) — ANY
// operationId token after C5 stripping (lead included) that is in
// LIVE_VERBS, not just the lead. E.g. updateRebootRequest -> tokens
// [update, reboot, request] -> "reboot" hits. Returns the matching
// (lowercased) token, or null.
export function operationIdAnyLiveToken(row) {
  const { tokens } = tokensForRow(row);
  for (const t of tokens) {
    const tok = t.toLowerCase();
    if (LIVE_VERBS.has(tok)) return tok;
  }
  return null;
}

// --- (b) head noun of the summary's object phrase -----------------------

// Naive singularization: strip a trailing "es" or "s", except when the
// word already ends in a doubled "ss" (e.g. "access", "class") — stripping
// one "s" there would leave a mangled "acces"/"clas", not a real singular.
export function naiveSingular(word) {
  if (word.endsWith('ss')) return word;
  if (word.endsWith('es')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

// The summary's first word is assumed to be the verb; the head noun is the
// last word of the span running from the second word up to (but not
// including) the first stop-token in STOP_TOKENS or a literal "(" / ",",
// or to the end of the summary if none appears. '' when the summary is
// empty/missing, or when there is nothing after the verb.
//
// M1-C9 round 2, coordinator correction 3: if that last word (checked raw,
// lowercased, BEFORE singularisation) is a generic tail (GENERIC_TAILS —
// "Update device information", "Delete device record"), step back one word
// in the span and use that instead; if the span has only one word, keep
// the generic word (this is a fallback, not a crash). Naive singularisation
// is applied once, to whichever word is finally returned.
export function headNounForRow(row) {
  const summary = (row.summary || '').trim();
  if (!summary) return '';
  const tokens = summary.match(/[A-Za-z']+|\(|,/g) || [];
  const rest = tokens.slice(1); // drop the assumed verb
  const span = [];
  for (const t of rest) {
    if (t === '(' || t === ',') break;
    if (STOP_TOKENS.has(t.toLowerCase())) break;
    span.push(t);
  }
  if (!span.length) return '';
  const lastRaw = span[span.length - 1].toLowerCase();
  if (GENERIC_TAILS.has(lastRaw) && span.length >= 2) {
    return naiveSingular(span[span.length - 2].toLowerCase());
  }
  return naiveSingular(lastRaw);
}

// --- (c) path party id ---------------------------------------------------

// GitHub's convention: /user/... and /users/me/... mean the authenticated
// caller, never a named other user, even if a listed param name also
// appears elsewhere in the path.
export function isCallerShapedPath(path) {
  const p = path || '';
  if (p.startsWith('/user/')) return true;
  const segments = p.split('/').filter((s) => s !== '');
  return segments.length >= 2 && segments[0] === 'users' && segments[1] === 'me';
}

// {present, param}: present is true only when a listed party-id param
// appears in the path AND the path is not caller-shaped AND the summary
// does not say "for the authenticated user" (that phrase forces caller
// regardless of what the path itself contains).
export function pathPartyIdForRow(row) {
  if (CALLER_PHRASE_RE.test(row.summary || '')) return { present: false, param: null };
  if (isCallerShapedPath(row.path || '')) return { present: false, param: null };
  const params = pathParamKeysForRow(row);
  const hit = params.find((p) => PARTY_PATH_PARAMS.has(p));
  return { present: !!hit, param: hit || null };
}

// M1-C9 round 3, coordinator correction 1: R2's operationId party-hit
// source, replacing round 2's "any token in PARTY_NOUNS" — the operationId
// HEAD NOUN. Tokens after C5 stripping (arbiter.mjs's tokensForRow), drop
// the lead verb, take the last remaining token, then step back one token at
// a time while the current last token is in OPID_TAIL_STEPBACK (GENERIC_TAILS
// plus "by" — "id" is already in GENERIC_TAILS) and more than one token is
// left. Naive singularisation is applied once, to whichever token is
// finally returned. '' when there is nothing after the lead verb.
//
//   updateSessionStatus -> [session, status] -> "status" is a generic tail,
//     step back -> "session".
//   deleteDeviceRoamingStatusSubscription -> [device, roaming, status,
//     subscription] -> "subscription" (not generic, no step back).
//   DeleteSipAuthCallsCredentialListMapping -> [sip, auth, calls,
//     credential, list, mapping] -> "mapping".
//   UpdateAccount -> [account] -> "account".
export function operationIdHeadNoun(row) {
  const { tokens } = tokensForRow(row);
  const rest = tokens.slice(1);
  if (!rest.length) return '';
  let i = rest.length - 1;
  while (i > 0 && OPID_TAIL_STEPBACK.has(rest[i].toLowerCase())) i -= 1;
  return naiveSingular(rest[i].toLowerCase());
}

// --- the R1-R5 cascade + floor --------------------------------------------
//
// switches: { r1On, r2On, r3On (each default true), judgePostOwn (R4,
// default false), pathPartyOn (round 3, default false), liveTokenOn (round
// 3, default false), floorOn (default true) } — each rule/source is
// independently toggleable; disabling one only removes that source's own
// resolution, it never changes another rule's condition or reach.

export function judgeRow(row, switches = {}) {
  const r1On = switches.r1On !== false;
  const r2On = switches.r2On !== false;
  const r3On = switches.r3On !== false;
  const judgePostOwn = switches.judgePostOwn === true;
  const pathPartyOn = switches.pathPartyOn === true;
  const liveTokenOn = switches.liveTokenOn === true;
  const floorOn = switches.floorOn !== false;

  const verb = leadVerbForJudge(row);
  const headNoun = headNounForRow(row);
  const partyId = pathPartyOn ? pathPartyIdForRow(row) : { present: false, param: null };
  const method = row.method;

  // R1 fires on any of THREE verb sources — the operationId-derived lead
  // verb, the summary's own first word (singularised), or (liveTokenOn) any
  // operationId token — checked in that order.
  if (r1On) {
    if (LIVE_VERBS.has(verb)) {
      return { class: 'x', confidence: 1, status: 'assigned', evidence: [`judge:live-verb:opid:${verb}`], rule: 'R1' };
    }
    const summaryVerb = summaryLeadVerb(row);
    if (LIVE_VERBS.has(summaryVerb)) {
      return { class: 'x', confidence: 1, status: 'assigned', evidence: [`judge:live-verb:summary:${summaryVerb}`], rule: 'R1' };
    }
    if (liveTokenOn) {
      const anyTok = operationIdAnyLiveToken(row);
      if (anyTok) {
        return { class: 'x', confidence: 1, status: 'assigned', evidence: [`judge:live-verb:opidtoken:${anyTok}`], rule: 'R1' };
      }
    }
  }

  if (OWN_VERBS.has(verb)) {
    const nounIsParty = PARTY_NOUNS.has(headNoun);
    const opidHeadNoun = operationIdHeadNoun(row); // M1-C9 round 3, correction 1
    const opidHeadIsParty = opidHeadNoun !== '' && PARTY_NOUNS.has(opidHeadNoun);
    if (r2On && (nounIsParty || partyId.present || opidHeadIsParty)) {
      let evidence;
      if (nounIsParty) evidence = `judge:party:${headNoun}`;
      else if (partyId.present) evidence = `judge:party:${partyId.param}`;
      else evidence = `judge:party:opidhead:${opidHeadNoun}`;
      return { class: 'x', confidence: 1, status: 'assigned', evidence: [evidence], rule: 'R2' };
    }
    if (!nounIsParty && !partyId.present && !opidHeadIsParty) {
      if (r3On && (method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
        return { class: 'w', confidence: 1, status: 'assigned', evidence: [`judge:own:${headNoun}`], rule: 'R3' };
      }
      if (judgePostOwn && method === 'POST') {
        return { class: 'w', confidence: 1, status: 'assigned', evidence: [`judge:own:${headNoun}`], rule: 'R4' };
      }
    }
  }

  // R5: nothing above resolved this row. The floor (applied after the full
  // cascade) only ever tightens a POST/PATCH R5 row to x; PUT/DELETE never
  // reach the floor and stay in review at the prior class.
  if (floorOn && (method === 'POST' || method === 'PATCH')) {
    return { class: 'x', confidence: 0, status: 'assigned', evidence: ['floor'], rule: 'floor' };
  }
  return { class: methodPrior(method), confidence: 0, status: 'review', evidence: [], rule: 'R5' };
}
