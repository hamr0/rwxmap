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
//      M1-C13 fix C, adopted 2026-09-08: matching against LIVE_VERBS (and,
//      in step 4, READ_VERBS) goes through judge.mjs's stemMatches, not an
//      exact Set.has — one list entry now covers a verb's inflections
//      (invoke/invokes/invoked/invoking) so nobody hand-adds forms. This
//      replaces both the opid path's previous zero normalization
//      (operationIdAnyLiveToken did an exact match on the raw token) and the
//      summary path's previous naiveSingular normalization
//      (summaryLeadVerb), which mangled verbs (creates -> creat) and
//      disagreed with the opid path's total lack of normalization. Both
//      paths now go through the same matcher (stemMatches), so they agree
//      on what a word is. Measured on all six sets (M1-C13): stemming alone
//      changes no row's class versus the pre-stem behaviour — the word
//      lists already only ever appeared in their bare/exact forms in the
//      test beds, so this is headroom for future lists, not a fix landing
//      today. Noun sets (PARTY_NOUNS/SHARED_NOUNS, step 3) are unaffected —
//      naiveSingular stays there, unchanged.
//   3. Party-noun raise — PUT/DELETE/PATCH only (POST/PATCH's prior is
//      already x, so this only actually changes PUT/DELETE; it still runs
//      on PATCH for evidence-trail completeness). If the summary's head
//      noun, or else the operationId's head noun, is in PARTY_NOUNS OR
//      SHARED_NOUNS (user ruling 2026-09-08: shared objects other members
//      feel), the row is 'x'. Failing both of those, any operationId token
//      (after C5 stripping, naive-singularised) that is in SHARED_NOUNS
//      also counts as a hit, evidence 'opid-token:<word>'. Any of these
//      hits is suppressed the same way — unless the summary uses a caller
//      phrase ("for the authenticated user", "your account", ...), which
//      suppresses the raise and records 'caller-phrase' as evidence
//      instead. rule: 'party-noun'.
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
  tokensForRow,
} from './arbiter.mjs';
import {
  LIVE_VERBS as JUDGE_LIVE_VERBS,
  PARTY_NOUNS as JUDGE_PARTY_NOUNS,
  headNounForRow,
  operationIdHeadNoun,
  fallbackVerbFromSummary,
  summaryHasCallerPhrase,
  naiveSingular,
  matchesAnyStem,
} from './judge.mjs';

export const LIVE_VERBS = new Set(JUDGE_LIVE_VERBS);
export const PARTY_NOUNS = new Set([...JUDGE_PARTY_NOUNS, 'repository']);
// user ruling 2026-09-08: shared objects other members feel; measured zero
// new leaks on five sets.
export const SHARED_NOUNS = new Set([
  'message', 'channel', 'emoji', 'sticker', 'pin', 'guild', 'permission',
  'overwrite', 'ban', 'webhook', 'reaction',
]);
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

// M1-C13 fix C, adopted: any operationId token (after C5 stripping) whose
// stem matches a LIVE_VERBS entry. Returns the matching (lowercased) raw
// token for the evidence trail, or null.
function operationIdAnyLiveStemToken(row) {
  const { tokens } = tokensForRow(row);
  for (const t of tokens) {
    const tok = t.toLowerCase();
    if (matchesAnyStem(tok, LIVE_VERBS)) return tok;
  }
  return null;
}

export function classify(row) {
  const method = row.method;

  // 1. locked floor: GET/HEAD/OPTIONS -> r, done.
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { class: 'r', rule: 'locked', evidence: [], floor: true };
  }

  const prior = methodPrior(method);
  const extraEvidence = [];

  // 2. live-verb raise, any method. Both sources (opid, summary) go
  // through stemMatches so they agree on what a word is (see the file
  // header note on fix C).
  const opidLiveTok = operationIdAnyLiveStemToken(row);
  if (opidLiveTok) {
    return { class: 'x', rule: 'live-verb', evidence: [`opid:${opidLiveTok}`], floor: false };
  }
  const sLeadVerb = fallbackVerbFromSummary(row.summary);
  if (matchesAnyStem(sLeadVerb, LIVE_VERBS)) {
    return { class: 'x', rule: 'live-verb', evidence: [`summary:${sLeadVerb}`], floor: false };
  }

  // 3. party-noun raise, PUT/DELETE/PATCH only.
  if (method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const summaryNoun = headNounForRow(row);
    const opidNoun = operationIdHeadNoun(row);
    let hit = null;
    if (isInSet(summaryNoun, PARTY_NOUNS) || isInSet(summaryNoun, SHARED_NOUNS)) {
      hit = { source: 'summary', word: summaryNoun };
    } else if (isInSet(opidNoun, PARTY_NOUNS) || isInSet(opidNoun, SHARED_NOUNS)) {
      hit = { source: 'opid', word: opidNoun };
    } else {
      const { tokens } = tokensForRow(row);
      for (const t of tokens) {
        const word = naiveSingular(t.toLowerCase());
        if (SHARED_NOUNS.has(word)) {
          hit = { source: 'opid-token', word };
          break;
        }
      }
    }

    if (hit) {
      if (summaryHasCallerPhrase(row.summary)) {
        extraEvidence.push('caller-phrase');
      } else {
        return { class: 'x', rule: 'party-noun', evidence: [`${hit.source}:${hit.word}`], floor: false };
      }
    }
  }

  // 4. read-verb lower, POST only. Stem-matched (fix C, adopted) — was a
  // bare exact match on leadVerbForRow's raw, unnormalized token.
  if (method === 'POST') {
    const verb = leadVerbForRow(row);
    if (matchesAnyStem(verb, READ_VERBS)) {
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
