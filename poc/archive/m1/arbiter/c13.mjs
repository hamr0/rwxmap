// M1-C13 measurement pass — three candidate fixes for the 17 hold-out-5
// leaks (all Slack GETs), each behind its own opts flag. Imports c11.mjs,
// judge.mjs and arbiter.mjs and changes nothing in them. This is a
// measurement pass, not an adoption of A or B: run-c13.mjs scores eight
// opts.readGet/opts.textFallback configurations and reports numbers;
// neither is wired into c11.mjs or any default flow.
//
// M1-C13 fix C (verb-correct stem matching) was ADOPTED 2026-09-08 as the
// default behaviour of c11.mjs's classify() — see c11.mjs's step 2/4
// comments and judge.mjs's stemMatches/matchesAnyStem. Measured to change
// no row's class on any of the six sets versus the pre-adoption exact-match
// behaviour. opts.stem below is now a NO-OP-EQUIVALENT: this file's
// classify() always stem-matches LIVE_VERBS/READ_VERBS regardless of the
// flag's value, so opts={} here is no longer proven identical to a
// pre-adoption c11.classify — it is proven identical to the CURRENT (stem
// -adopted) c11.classify (see c13.test.mjs). The flag is kept, accepted,
// and ignored purely so existing call sites (run-c13.mjs) do not need
// changes to keep measuring A and B.
//
// Root causes (verified by hand on hold-out 5, 2026-09-08):
//   A. c11.mjs's locked floor (step 1) returns 'r' for GET/HEAD/OPTIONS
//      before any text is read — a live verb in the summary/operationId
//      never gets a chance to raise it.
//   B. c11.mjs's (and judge.mjs's) text rules read row.summary only. Slack
//      and Amazon are Swagger 2.0 and put prose in `description` instead —
//      290 of 323 hold-out-5 rows have an empty summary.
//   C. (ADOPTED) judge.mjs's naiveSingular blindly strips a trailing
//      "es"/"s" — a NOUN-pluralisation rule applied to third-person verbs.
//      It mangles the stem (creates -> creat, revokes -> revok, terminates
//      -> terminat, shares -> shar, approves -> approv), so a mangled verb
//      never matches its own base form in LIVE_VERBS/READ_VERBS. Fixed by
//      always matching LIVE_VERBS/READ_VERBS through judge.mjs's
//      stemMatches instead of naiveSingular+exact-match or a bare
//      exact-match.
//
// Fixes still behind flags, independently switchable:
//   opts.textFallback (fix B) — wherever the flow reads the summary for
//     verb/noun matching, read row.summary if non-empty else
//     row.description. Nothing else changes (the existing no-text floor,
//     step 5, already reads both fields itself and is untouched).
//   opts.readGet (fix A) — GET/HEAD/OPTIONS no longer return immediately.
//     The live-verb raise (step 2) runs first and can raise them to 'x';
//     if nothing fires, the row still locks to 'r' (raise-only doctrine:
//     a GET is never lowered, and "nothing fired" is not evidence).
//   opts.stem (fix C, ADOPTED, now a no-op — always on) — matches
//     LIVE_VERBS/READ_VERBS via stemMatches, a verb-correct suffix stripper
//     anchored at position 0 so a different prefix can never match
//     (revoke must never match invoke; address must never match add).
//     Noun sets (PARTY_NOUNS/SHARED_NOUNS) keep naiveSingular in this
//     pass — known limitation, not fixed here.
import {
  methodPrior,
  leadVerbForRow,
  tokensForRow,
} from './arbiter.mjs';
import {
  headNounForRow,
  operationIdHeadNoun,
  fallbackVerbFromSummary,
  summaryHasCallerPhrase,
  naiveSingular,
  stemMatches,
  matchesAnyStem,
} from './judge.mjs';
import { LIVE_VERBS, PARTY_NOUNS, SHARED_NOUNS, READ_VERBS } from './c11.mjs';

// Re-exported for c13.test.mjs (and any other existing caller) — the real
// implementation now lives in judge.mjs (see the file header above).
export { stemMatches };

function isInSet(word, set) {
  return word !== '' && set.has(word);
}

// --- fix B: text fallback ----------------------------------------------------

function resolvedSummary(row) {
  const s = (row.summary || '').trim();
  if (s !== '') return row.summary;
  return row.description || '';
}

// Shim row whose .summary is the text the flow should read when
// textFallback is on; every other field (including .description itself)
// is untouched. When textFallback is off, returns `row` unchanged so every
// downstream call is byte-identical to c11's.
function textRow(row, textFallback) {
  if (!textFallback) return row;
  return { ...row, summary: resolvedSummary(row) };
}

// --- live-verb raise (step 2), shared by the locked-method path (fix A)
// and the normal flow. Mirrors c11.mjs's two live-verb sources —
// operationIdAnyLiveToken (opid, any token) and summaryLeadVerb (summary,
// naive-singularised lead word) — but each source's matching rule is
// swapped for stemMatches when `stem` is on, and the summary source reads
// through textRow when `textFallback` is on.
function findLiveVerbHit(row, textFallback, stem) {
  const { tokens } = tokensForRow(row);
  for (const t of tokens) {
    const tok = t.toLowerCase();
    const hit = stem ? matchesAnyStem(tok, LIVE_VERBS) : LIVE_VERBS.has(tok);
    if (hit) return `opid:${tok}`;
  }
  const sRow = textRow(row, textFallback);
  const rawSummaryVerb = fallbackVerbFromSummary(sRow.summary);
  if (stem) {
    if (matchesAnyStem(rawSummaryVerb, LIVE_VERBS)) return `summary:${rawSummaryVerb}`;
  } else {
    const singular = naiveSingular(rawSummaryVerb);
    if (isInSet(singular, LIVE_VERBS)) return `summary:${singular}`;
  }
  return null;
}

export function classify(row, opts = {}) {
  const textFallback = opts.textFallback === true;
  const readGet = opts.readGet === true;
  // fix C adopted 2026-09-08: stemming is always on now. opts.stem is
  // accepted (so existing call sites need no change) but ignored.
  const stem = true;

  const method = row.method;
  const isLocked = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  // 1. locked floor: GET/HEAD/OPTIONS -> r, done — UNLESS readGet defers
  // this past step 2 so live-verb evidence gets a chance to raise it.
  if (isLocked && !readGet) {
    return { class: 'r', rule: 'locked', evidence: [], floor: true };
  }

  const prior = methodPrior(method);
  const extraEvidence = [];

  // 2. live-verb raise, any method (including locked methods, when
  // readGet deferred step 1).
  const liveHit = findLiveVerbHit(row, textFallback, stem);
  if (liveHit) {
    return { class: 'x', rule: 'live-verb', evidence: [liveHit], floor: false };
  }

  if (isLocked) {
    // readGet was on; nothing raised it. Raise-only: stays locked r.
    return { class: 'r', rule: 'locked', evidence: [], floor: true };
  }

  // 3. party-noun raise, PUT/DELETE/PATCH only.
  if (method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const sRow = textRow(row, textFallback);
    const summaryNoun = headNounForRow(sRow);
    const opidNoun = operationIdHeadNoun(row);
    let hit = null;
    if (isInSet(summaryNoun, PARTY_NOUNS) || isInSet(summaryNoun, SHARED_NOUNS)) {
      hit = { source: 'summary', word: summaryNoun };
    } else if (isInSet(opidNoun, PARTY_NOUNS) || isInSet(opidNoun, SHARED_NOUNS)) {
      hit = { source: 'opid', word: opidNoun };
    } else {
      const { tokens } = tokensForRow(row);
      for (const t of tokens) {
        // C13 note: nouns keep naiveSingular in this pass (not stem-fixed).
        const word = naiveSingular(t.toLowerCase());
        if (SHARED_NOUNS.has(word)) {
          hit = { source: 'opid-token', word };
          break;
        }
      }
    }

    if (hit) {
      if (summaryHasCallerPhrase(sRow.summary)) {
        extraEvidence.push('caller-phrase');
      } else {
        return { class: 'x', rule: 'party-noun', evidence: [`${hit.source}:${hit.word}`], floor: false };
      }
    }
  }

  // 4. read-verb lower, POST only.
  if (method === 'POST') {
    const verb = leadVerbForRow(row);
    const hitReadVerb = stem ? matchesAnyStem(verb, READ_VERBS) : isInSet(verb, READ_VERBS);
    if (hitReadVerb) {
      return { class: 'r', rule: 'read-verb', evidence: [`opid:${verb}`, ...extraEvidence], floor: false };
    }
  }

  // 5. no-text floor (Rule A, unrelated to this pass's fix A): PUT/DELETE/
  // PATCH with nothing to read. Untouched by textFallback — it already
  // reads both fields itself.
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
