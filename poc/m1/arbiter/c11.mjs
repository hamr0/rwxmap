// M1-C11 (adopted): the "floor + raise-only" arbiter, frozen as V3a from the
// M1-C11v sweep (poc/m1/arbiter/run-c11v.mjs) — the shape that admitted with
// zero leaks on camara + holdout1 + holdout2 and both negative controls at x.
// Pure, no I/O: classify(row) -> { class, rule, evidence, floor }.
//
// The flow, in order:
//   1. Locked floor — GET/HEAD/OPTIONS are always 'r'. Nothing below ever
//      runs for these methods. rule: 'locked'.
//   2. Live-verb raise — any method. If any operationId token (after C5
//      stripping) or the summary's own lead word is in LIVE_VERBS, the row
//      is 'x'. rule: 'live-verb'.
//   3. Party-noun raise — PUT/DELETE/PATCH only (POST/PATCH's prior is
//      already x, so this only actually changes PUT/DELETE; it still runs
//      on PATCH for evidence-trail completeness). If the summary's head
//      noun, or else the operationId's head noun, is in PARTY_NOUNS, the
//      row is 'x' — unless the summary uses a caller phrase ("for the
//      authenticated user", "your account", ...), which suppresses the
//      raise and records 'caller-phrase' as evidence instead. rule:
//      'party-noun'.
//   4. Read-verb lower — POST only. If the operationId lead verb is in
//      READ_VERBS, the row is lowered from the x floor to 'r'. rule:
//      'read-verb'.
//   5. No-text floor (Rule A, user ruling 2026-09-08) — PUT/DELETE/PATCH
//      only. If both row.summary and row.description are empty (after
//      trim), the judge had nothing to read and there is no evidence to
//      raise or lower on; doctrine says no evidence takes the tighter
//      class. rule: 'no-text', floor: true — marked so a consumer can
//      tell "no text to judge" apart from a found x (rule: 'live-verb' /
//      'party-noun'). POST/PATCH's method prior is already x, so this
//      only actually changes PUT/DELETE outcomes; it still runs on PATCH
//      for evidence-trail completeness, same as step 3.
//   6. Floor — nothing above resolved the row. PUT/DELETE -> 'w',
//      POST/PATCH -> 'x' (arbiter.mjs's methodPrior). rule: 'floor'.
//
// Nothing here ever lowers a class except step 4 (POST read-verb), and
// nothing raises except steps 2-3 and 5. `floor` on the returned result is
// true exactly when rule is 'locked', 'no-text' or 'floor' — i.e. no
// verb/noun evidence fired, the class came from the method prior (or the
// no-text doctrine) alone.
import {
  methodPrior,
  leadVerbForRow,
} from './arbiter.mjs';
import {
  LIVE_VERBS as JUDGE_LIVE_VERBS,
  PARTY_NOUNS as JUDGE_PARTY_NOUNS,
  headNounForRow,
  operationIdHeadNoun,
  operationIdAnyLiveToken,
  summaryLeadVerb,
  summaryHasCallerPhrase,
} from './judge.mjs';

export const LIVE_VERBS = new Set(JUDGE_LIVE_VERBS);
export const PARTY_NOUNS = new Set([...JUDGE_PARTY_NOUNS, 'repository']);
export const READ_VERBS = new Set([
  'retrieve', 'verify', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'count', 'lookup', 'assess', 'find', 'get',
]);
// Copied verbatim from judge.mjs (not exported there); summaryHasCallerPhrase
// (imported below) already checks a row's summary against this exact list —
// exported here only so callers of c11.mjs can see/reference the phrases
// themselves without also importing judge.mjs.
export const CALLER_PHRASES = ['for the authenticated user', 'authenticated user', 'your account', 'your ', 'yourself'];

function isInSet(word, set) {
  return word !== '' && set.has(word);
}

export function classify(row) {
  const method = row.method;

  // 1. locked floor: GET/HEAD/OPTIONS -> r, done.
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { class: 'r', rule: 'locked', evidence: [], floor: true };
  }

  const prior = methodPrior(method);
  const extraEvidence = [];

  // 2. live-verb raise, any method.
  const opidLiveTok = operationIdAnyLiveToken(row);
  if (opidLiveTok) {
    return { class: 'x', rule: 'live-verb', evidence: [`opid:${opidLiveTok}`], floor: false };
  }
  const sLeadVerb = summaryLeadVerb(row);
  if (isInSet(sLeadVerb, LIVE_VERBS)) {
    return { class: 'x', rule: 'live-verb', evidence: [`summary:${sLeadVerb}`], floor: false };
  }

  // 3. party-noun raise, PUT/DELETE/PATCH only.
  if (method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const summaryNoun = headNounForRow(row);
    const opidNoun = operationIdHeadNoun(row);
    let hit = null;
    if (isInSet(summaryNoun, PARTY_NOUNS)) hit = { source: 'summary', word: summaryNoun };
    else if (isInSet(opidNoun, PARTY_NOUNS)) hit = { source: 'opid', word: opidNoun };

    if (hit) {
      if (summaryHasCallerPhrase(row.summary)) {
        extraEvidence.push('caller-phrase');
      } else {
        return { class: 'x', rule: 'party-noun', evidence: [`${hit.source}:${hit.word}`], floor: false };
      }
    }
  }

  // 4. read-verb lower, POST only.
  if (method === 'POST') {
    const verb = leadVerbForRow(row);
    if (isInSet(verb, READ_VERBS)) {
      return { class: 'r', rule: 'read-verb', evidence: [`opid:${verb}`, ...extraEvidence], floor: false };
    }
  }

  // 5. no-text floor (Rule A): PUT/DELETE/PATCH with nothing to read.
  if (method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const hasSummary = (row.summary || '').trim() !== '';
    const hasDescription = (row.description || '').trim() !== '';
    if (!hasSummary && !hasDescription) {
      return { class: 'x', rule: 'no-text', evidence: ['no-text'], floor: true };
    }
  }

  // 6. floor: nothing above resolved this row.
  return { class: prior, rule: 'floor', evidence: extraEvidence, floor: true };
}
