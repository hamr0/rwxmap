// M1-C15: per-method floor + one-direction-of-travel arbiter.
//
// User ruling behind this shape: c11.mjs runs one blanket set of word rules
// across all HTTP methods, but the same word does opposite jobs on
// different methods (the noun "access" correctly raises a DELETE but
// wrongly raised listAccesses on GET; a read verb correctly lowers a POST
// but is meaningless on DELETE, where zero of 250 rows are truth r). c15's
// fix: put each method's floor at its own truth lean (measured over all
// 1478 labelled rows), and give each method exactly ONE direction of
// travel off that floor.
//
// The floor (starting value, never an early return):
//   GET/HEAD/OPTIONS -> r   (truth: 97% r)
//   POST              -> x  (truth: 62% x, 20% w, 17% r)
//   PUT               -> w  (truth: 83% w)
//   DELETE            -> w  (truth: 81% w)
//   PATCH             -> w  (truth: 69% w)   <- c11 floors PATCH at x; this
//                                                is the one change from c11's
//                                                method prior.
//
// One direction per method:
//   GET/HEAD/OPTIONS — no word rules run at all. Always the floor 'r'.
//   POST — LOWER only, via the read-verb rule. No raise rules run on POST:
//     its floor is already the top class, so a raise would be a no-op, and
//     dropping the blanket live-verb scan c11 ran here measurably helps
//     because that scan was pre-empting the read-verb lower on the same
//     row.
//   PUT/DELETE/PATCH — RAISE only: live-verb, then party/shared-noun, in
//     that order, first hit wins; otherwise the w floor.
//
// Vocabulary (LIVE_VERBS, PARTY_NOUNS, SHARED_NOUNS, READ_VERBS) is
// imported from c11.mjs, not redefined here — one home for the word lists,
// per the brief. Changing the vocabulary itself is out of scope for this
// file.
//
// opts.noTextRaise (default OFF, strict === true): on PUT/DELETE/PATCH, if
// no raise rule fired AND both row.summary and row.description are empty
// after trim, return x/no-text instead of the w floor. c11 carried this
// rule unconditionally; here it is a real doctrine question (the floor is
// now w, so no-text->x would be a raise on zero evidence) left for
// measurement, not decided by this file.
//
// floor: true exactly when rule is 'floor' or 'no-text'; false when a word
// rule fired (live-verb, party-noun, read-verb).
import { leadVerbForRow, tokensForRow } from './arbiter.mjs';
import {
  headNounForRow,
  operationIdHeadNoun,
  fallbackVerbFromSummary,
  summaryHasCallerPhrase,
  naiveSingular,
  matchesAnyStem,
} from './judge.mjs';
import { LIVE_VERBS, PARTY_NOUNS, SHARED_NOUNS, READ_VERBS } from './c11.mjs';

function isInSet(word, set) {
  return word !== '' && set.has(word);
}

const METHOD_FLOOR = {
  GET: 'r',
  HEAD: 'r',
  OPTIONS: 'r',
  POST: 'x',
  PUT: 'w',
  DELETE: 'w',
  PATCH: 'w',
};

function isLockedMethod(method) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function isRaiseMethod(method) {
  return method === 'PUT' || method === 'DELETE' || method === 'PATCH';
}

// Step 1 (raise order): any operationId token stem-matching LIVE_VERBS,
// then the summary's lead word stem-matching LIVE_VERBS.
function liveVerbHit(row) {
  const { tokens } = tokensForRow(row);
  for (const t of tokens) {
    const tok = t.toLowerCase();
    if (matchesAnyStem(tok, LIVE_VERBS)) return { source: 'opid', word: tok };
  }
  const sLeadVerb = fallbackVerbFromSummary(row.summary);
  if (matchesAnyStem(sLeadVerb, LIVE_VERBS)) return { source: 'summary', word: sLeadVerb };
  return null;
}

// Step 2 (raise order): summary head noun, then operationId head noun, then
// any operationId token (naiveSingular'd) in SHARED_NOUNS.
function partyNounHit(row) {
  const summaryNoun = headNounForRow(row);
  if (isInSet(summaryNoun, PARTY_NOUNS) || isInSet(summaryNoun, SHARED_NOUNS)) {
    return { source: 'summary', word: summaryNoun };
  }
  const opidNoun = operationIdHeadNoun(row);
  if (isInSet(opidNoun, PARTY_NOUNS) || isInSet(opidNoun, SHARED_NOUNS)) {
    return { source: 'opid', word: opidNoun };
  }
  const { tokens } = tokensForRow(row);
  for (const t of tokens) {
    const word = naiveSingular(t.toLowerCase());
    if (SHARED_NOUNS.has(word)) {
      return { source: 'opid-token', word };
    }
  }
  return null;
}

export function classify(row, opts = {}) {
  const noTextRaise = opts.noTextRaise === true;
  const method = row.method;
  const floor = METHOD_FLOOR[method];

  // GET/HEAD/OPTIONS: no word rules run at all.
  if (isLockedMethod(method)) {
    return { class: 'r', rule: 'floor', evidence: [], floor: true };
  }

  // POST: lower only, via the read-verb rule.
  if (method === 'POST') {
    const verb = leadVerbForRow(row);
    if (matchesAnyStem(verb, READ_VERBS)) {
      return { class: 'r', rule: 'read-verb', evidence: [`opid:${verb}`], floor: false };
    }
    return { class: floor, rule: 'floor', evidence: [], floor: true };
  }

  // PUT/DELETE/PATCH: raise only, first hit wins.
  if (isRaiseMethod(method)) {
    const extraEvidence = [];

    const liveHit = liveVerbHit(row);
    if (liveHit) {
      if (summaryHasCallerPhrase(row.summary)) {
        extraEvidence.push('caller-phrase');
      } else {
        return { class: 'x', rule: 'live-verb', evidence: [`${liveHit.source}:${liveHit.word}`], floor: false };
      }
    }

    const nounHit = partyNounHit(row);
    if (nounHit) {
      if (summaryHasCallerPhrase(row.summary)) {
        if (!extraEvidence.includes('caller-phrase')) extraEvidence.push('caller-phrase');
      } else {
        return { class: 'x', rule: 'party-noun', evidence: [`${nounHit.source}:${nounHit.word}`, ...extraEvidence], floor: false };
      }
    }

    // No raise rule fired (or every hit was caller-phrase-suppressed).
    if (noTextRaise) {
      const hasSummary = (row.summary || '').trim() !== '';
      const hasDescription = (row.description || '').trim() !== '';
      if (!hasSummary && !hasDescription) {
        return { class: 'x', rule: 'no-text', evidence: ['no-text'], floor: true };
      }
    }

    return { class: floor, rule: 'floor', evidence: extraEvidence, floor: true };
  }

  throw new Error(`c15.classify: unrecognized method "${method}"`);
}
