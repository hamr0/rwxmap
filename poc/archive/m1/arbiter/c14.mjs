// M1-C14: c11's cascade with three independent, strictly-boolean switches,
// each addressing one of the three known defects in C13's writeup (see
// c13.mjs's header) that C13 measured but never adopted. With NO opts (or
// every switch off), classify(row) is proven identical to c11.classify(row)
// on every row of all six sets (c14.test.mjs) — this file changes nothing
// about c11's default behaviour, it only adds opt-in headroom.
//
// The flow, in order (identical structure to c11.mjs's six steps; only the
// switch behaviour described below differs from c11):
//   1. Locked floor — GET/HEAD/OPTIONS. With opts.readGet off (default),
//      this returns 'r' immediately, exactly like c11 step 1. With
//      opts.readGet on, the floor value ('r') is remembered but the row
//      falls through to steps 2-3 (raise-only) instead of returning; if
//      nothing raises it, it returns the SAME locked-r result at the end.
//      Step 4 (read-verb lower) stays POST-only, untouched by this switch —
//      this pass is tightening-only, never a new loosening path.
//   2. Live-verb raise — any method (including GET/HEAD/OPTIONS when
//      opts.readGet is on). Same two sources as c11 (any opid token,
//      stem-matched; the summary/description lead word, stem-matched).
//   3. Party-noun raise — PUT/DELETE/PATCH only, PLUS GET/HEAD/OPTIONS when
//      opts.readGet is on (raise-only: a raise here can only ever move a
//      locked GET up to x, never down). Same head-noun/opid-head-noun/
//      opid-token sources as c11, but with two more switches available:
//        opts.textFallback — wherever a step reads prose (step 2's summary
//          lead word, step 3's summary head noun, step 3's caller-phrase
//          check), it reads row.summary when non-empty after trim, else
//          row.description. One writer: textForRow(row, opts) below.
//        opts.nounStem — noun-set membership (PARTY_NOUNS/SHARED_NOUNS)
//          matches the RAW (un-singularised) candidate via matchesAnyStem
//          instead of exact Set.has(naiveSingular(word)) — using
//          headNounFromText/operationIdHeadNounRaw as the raw candidate
//          sources (naiveSingular is a noun-pluralisation rule, not a stem
//          matcher; running both would double-normalise and miss). The
//          opid-token fallback loop is switched the same way.
//   4. Read-verb lower — POST only, untouched by any switch here.
//   5. No-text floor — PUT/DELETE/PATCH only, untouched by any switch here
//      (it already reads both summary and description itself).
//   6. Floor — nothing above resolved the row. Untouched.
//
// Evidence-string shapes are kept identical to c11's (opid:<word>,
// summary:<word>, <source>:<word>, opid-token:<word>, caller-phrase,
// no-text) so run-c14.mjs's sweep output is directly comparable across
// configurations and against c11/c13's own output.
import {
  methodPrior,
  leadVerbForRow,
  tokensForRow,
} from './arbiter.mjs';
import {
  headNounFromText,
  operationIdHeadNounRaw,
  fallbackVerbFromSummary,
  callerPhraseInText,
  naiveSingular,
  matchesAnyStem,
} from './judge.mjs';
import { LIVE_VERBS, PARTY_NOUNS, SHARED_NOUNS, READ_VERBS } from './c11.mjs';

function isInSet(word, set) {
  return word !== '' && set.has(word);
}

// opts.textFallback: the text a prose-reading step should use for this row —
// row.summary when non-empty after trim, else row.description. One writer,
// used by every prose-reading step in this file (live-verb summary source,
// party-noun head-noun source, caller-phrase check). When the switch is
// off, this is exactly row.summary — byte-identical to c11's behaviour.
function textForRow(row, opts) {
  if (opts.textFallback !== true) return row.summary || '';
  const s = (row.summary || '').trim();
  if (s !== '') return row.summary;
  return row.description || '';
}

// Any operationId token (after C5 stripping) whose stem matches a
// LIVE_VERBS entry. Returns the matching (lowercased) raw token, or null.
// Unaffected by any switch — the opid path never reads prose.
function operationIdAnyLiveStemToken(row) {
  const { tokens } = tokensForRow(row);
  for (const t of tokens) {
    const tok = t.toLowerCase();
    if (matchesAnyStem(tok, LIVE_VERBS)) return tok;
  }
  return null;
}

// step 2: live-verb raise. Returns { class, rule, evidence, floor } or null.
function liveVerbRaise(row, opts) {
  const opidLiveTok = operationIdAnyLiveStemToken(row);
  if (opidLiveTok) {
    return { class: 'x', rule: 'live-verb', evidence: [`opid:${opidLiveTok}`], floor: false };
  }
  const text = textForRow(row, opts);
  const sLeadVerb = fallbackVerbFromSummary(text);
  if (matchesAnyStem(sLeadVerb, LIVE_VERBS)) {
    return { class: 'x', rule: 'live-verb', evidence: [`summary:${sLeadVerb}`], floor: false };
  }
  return null;
}

// step 3: party-noun raise. Returns { class, rule, evidence, floor } or
// null; extraEvidence (e.g. caller-phrase) is pushed into the passed array
// even when no raise fires, matching c11's evidence-trail-completeness
// behaviour.
function partyNounRaise(row, opts, extraEvidence) {
  const nounStem = opts.nounStem === true;
  const text = textForRow(row, opts);

  const summaryNounRaw = headNounFromText(text);
  const opidNounRaw = operationIdHeadNounRaw(row);
  const summaryNoun = nounStem ? summaryNounRaw : naiveSingular(summaryNounRaw);
  const opidNoun = nounStem ? opidNounRaw : naiveSingular(opidNounRaw);

  const inPartyOrShared = (word) => {
    if (nounStem) return matchesAnyStem(word, PARTY_NOUNS) || matchesAnyStem(word, SHARED_NOUNS);
    return isInSet(word, PARTY_NOUNS) || isInSet(word, SHARED_NOUNS);
  };

  let hit = null;
  if (inPartyOrShared(summaryNoun)) {
    hit = { source: 'summary', word: summaryNoun };
  } else if (inPartyOrShared(opidNoun)) {
    hit = { source: 'opid', word: opidNoun };
  } else {
    const { tokens } = tokensForRow(row);
    for (const t of tokens) {
      const raw = t.toLowerCase();
      const hitTok = nounStem ? matchesAnyStem(raw, SHARED_NOUNS) : SHARED_NOUNS.has(naiveSingular(raw));
      if (hitTok) {
        hit = { source: 'opid-token', word: nounStem ? raw : naiveSingular(raw) };
        break;
      }
    }
  }

  if (!hit) return null;
  if (callerPhraseInText(text)) {
    extraEvidence.push('caller-phrase');
    return null;
  }
  return { class: 'x', rule: 'party-noun', evidence: [`${hit.source}:${hit.word}`], floor: false };
}

export function classify(row, opts = {}) {
  const readGet = opts.readGet === true;
  const method = row.method;
  const isLocked = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const lockedResult = { class: 'r', rule: 'locked', evidence: [], floor: true };

  // 1. locked floor: GET/HEAD/OPTIONS -> r, done — UNLESS readGet defers
  // this past steps 2-3 so raise evidence gets a chance to tighten it.
  if (isLocked && !readGet) {
    return lockedResult;
  }

  const prior = methodPrior(method);
  const extraEvidence = [];

  // 2. live-verb raise, any method (including locked methods when readGet
  // is on).
  const liveHit = liveVerbRaise(row, opts);
  if (liveHit) return liveHit;

  // 3. party-noun raise, PUT/DELETE/PATCH always, plus locked methods when
  // readGet is on (raise-only: never loosens a locked row, only tightens).
  if (method === 'PUT' || method === 'DELETE' || method === 'PATCH' || (isLocked && readGet)) {
    const partyHit = partyNounRaise(row, opts, extraEvidence);
    if (partyHit) return partyHit;
  }

  if (isLocked) {
    // readGet was on; nothing raised it. Raise-only: stays locked r.
    return lockedResult;
  }

  // 4. read-verb lower, POST only. Untouched by any switch.
  if (method === 'POST') {
    const verb = leadVerbForRow(row);
    if (matchesAnyStem(verb, READ_VERBS)) {
      return { class: 'r', rule: 'read-verb', evidence: [`opid:${verb}`, ...extraEvidence], floor: false };
    }
  }

  // 5. no-text floor (Rule A): PUT/DELETE/PATCH only. Untouched by any
  // switch — already reads both summary and description itself.
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
