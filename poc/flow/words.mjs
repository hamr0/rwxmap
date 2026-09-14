// Word/token helpers for poc/flow — copied from poc/archive/m1/arbiter/arbiter.mjs,
// poc/archive/m1/arbiter/judge.mjs, poc/archive/m1/step3/allowlist.mjs and
// poc/archive/m1/core/core.mjs (withSplitOperationId), reproducing the same
// behaviour except where marked (*) as a deliberate change. Imports nothing
// from poc/m1 or poc/m0.

// withSplitOperationId(row) — from poc/archive/m1/core/core.mjs. arbiter.mjs's own
// splitTokens only splits on '_ - .' and camelCase, so an operationId like
// 'gists/unstar' or 'delete team member' stays one token. This is the one
// place the '/' + whitespace split lives: trim, then collapse every run of
// '/' or whitespace into '_' before anything reads operationId. A
// whitespace-only operationId trims to '' first, so it still falls back to
// the path exactly as before.
export function withSplitOperationId(row) {
  const trimmed = (row.operationId || '').trim();
  return { ...row, operationId: trimmed.replace(/[\/\s]+/g, '_') };
}

// --- lead-token tokenization (arbiter.mjs 113-166) -------------------------

// HTTP-method words that get stripped from lead position when the
// operationId starts with the word followed by a separator.
const METHOD_WORDS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
// A separator or a digit right after the method word means it is a
// redundant method-name prefix (post_ai_ask, post-cardDetails,
// delete_files_id); an uppercase letter there means ordinary camelCase
// (deleteDevice, getSession, updateDevice) and the word is a real verb.
const METHOD_PREFIX_SEPARATOR = /^[_\-.0-9]/;

// Lowercase all tokens of a string, split on camelCase boundaries and on
// '_', '-', '.'.
export function splitTokens(str) {
  if (!str) return [];
  const withBoundaries = String(str).replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  return withBoundaries
    .split(/[_\-.]+/)
    .filter((p) => p.length > 0)
    .map((p) => p.toLowerCase());
}

// Raw string a row's lead verb is derived from: the operationId, or the
// last non-{param} path segment when operationId is empty.
function rawLeadStringForRow(row) {
  const opId = (row.operationId || '').trim();
  if (opId !== '') return opId;
  const path = row.path || '';
  const segments = path.split('/').filter((s) => s && !(s.startsWith('{') && s.endsWith('}')));
  return segments.length ? segments[segments.length - 1] : '';
}

// Strip a leading method-word prefix ONLY when it is followed by a
// separator or a digit in the raw string (post_ai_ask, post-cardDetails,
// delete_files_id) — never on a camelCase continuation (deleteDevice,
// getSession, updateDevice keep their verb as the lead). Returns
// { tokens, stripped }; tokens is never empty unless the raw string
// tokenizes to nothing at all.
//
// (*) New here vs. the old arbiter.mjs tokensForRow: applies
// withSplitOperationId to the row itself first, so callers never have to.
// Equivalence: new tokensForRow(row) deep-equals old
// tokensForRow(withSplitOperationId(row)).
export function tokensForRow(row) {
  const splitRow = withSplitOperationId(row);
  const raw = rawLeadStringForRow(splitRow);
  const tokens = splitTokens(raw);
  if (!tokens.length) return { tokens, stripped: false };
  const method = (splitRow.method || '').toLowerCase();
  if (!METHOD_WORDS.has(method) || tokens[0] !== method) return { tokens, stripped: false };
  const rest = String(raw).slice(method.length);
  if (!METHOD_PREFIX_SEPARATOR.test(rest)) return { tokens, stripped: false }; // camelCase continuation
  if (tokens.length < 2) return { tokens, stripped: false }; // nothing to skip to
  return { tokens: tokens.slice(1), stripped: true };
}

export function leadVerbForRow(row) {
  const { tokens } = tokensForRow(row);
  return tokens.length ? tokens[0] : '';
}

// --- verb-correct stem matching (judge.mjs ~140-230) ------------------------
//
// naiveSingular is a NOUN-pluralisation rule; applied to third-person verbs
// it mangles the stem (creates -> creat, revokes -> revok, terminates ->
// terminat), so a mangled verb never matches its own base form in a verb
// set. stemMatches accepts a verb's inflections — bare, silent-e,
// present-3sg, present-3sg after sibilant, past/participle after silent-e
// drop, past/participle, gerund — as "the same verb" as `stem`, anchored at
// position 0 via the startsWith check so a different prefix can never
// match.
const VERB_SUFFIXES = ['', 'e', 's', 'es', 'd', 'ed', 'ing'];

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
function isConsonant(ch) {
  return typeof ch === 'string' && /^[a-z]$/.test(ch) && !VOWELS.has(ch);
}

export function stemMatches(word, stem) {
  if (!word || !stem) return false;
  if (word.startsWith(stem) && VERB_SUFFIXES.includes(word.slice(stem.length))) return true;

  const last = stem[stem.length - 1];
  const secondLast = stem[stem.length - 2];
  const thirdLast = stem[stem.length - 3];

  // silent-e drop before -ing.
  if (last === 'e') {
    const base = stem.slice(0, -1);
    if (word.startsWith(base) && word.slice(base.length) === 'ing') return true;
  }

  // consonant + y -> ies / ied.
  if (last === 'y' && isConsonant(secondLast)) {
    const base = stem.slice(0, -1);
    if (word.startsWith(base)) {
      const rest = word.slice(base.length);
      if (rest === 'ies' || rest === 'ied') return true;
    }
  }

  // CVC doubled-consonant -ing/-ed.
  if (
    isConsonant(last) && !['w', 'x', 'y'].includes(last) &&
    VOWELS.has(secondLast) &&
    (stem.length === 2 || isConsonant(thirdLast))
  ) {
    const doubled = stem + last;
    if (word.startsWith(doubled)) {
      const rest = word.slice(doubled.length);
      if (rest === 'ing' || rest === 'ed') return true;
    }
  }

  return false;
}

export function matchesAnyStem(word, stemSet) {
  if (!word) return false;
  for (const s of stemSet) {
    if (stemMatches(word, s)) return true;
  }
  return false;
}

// --- naiveSingular (judge.mjs 301) ------------------------------------------

// Strip a trailing "es" or "s", except when the word already ends in a
// doubled "ss" (e.g. "access", "class") — stripping one "s" there would
// leave a mangled "acces"/"clas", not a real singular.
export function naiveSingular(word) {
  if (word.endsWith('ss')) return word;
  if (word.endsWith('es')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

// --- summaryVerb = judge.mjs's fallbackVerbFromSummary (234) ---------------

// First word of `summary`, lowercased, letters-only, trailing punctuation
// stripped. '' when summary is empty/missing.
export function summaryVerb(summary) {
  const s = (summary || '').trim();
  if (!s) return '';
  const firstChunk = s.split(/\s+/)[0];
  const m = firstChunk.match(/^[A-Za-z]+/);
  return m ? m[0].toLowerCase() : '';
}

// --- callerPhraseInText (judge.mjs ~120-133) --------------------------------

// Verbatim phrase list — do not add or remove one without taking it back to
// the user first.
const CALLER_PHRASES = ['for the authenticated user', 'authenticated user', 'your account', 'your ', 'yourself'];

export function callerPhraseInText(text) {
  const s = (text || '').toLowerCase();
  return CALLER_PHRASES.some((p) => s.includes(p));
}

// --- headNounFromText / headNounForRow (judge.mjs 96-100, 116, 327-350) ----

const STOP_TOKENS = new Set(['from', 'for', 'to', 'in', 'on', 'of', 'by', 'with', 'at', 'into']);

// A naive head-noun span sometimes lands on a generic tail word (Update
// device INFORMATION, Delete device RECORD) instead of the real object one
// word earlier. Checked on the raw (pre-singularisation) lowercased word.
const GENERIC_TAILS = new Set([
  'information', 'info', 'record', 'details', 'detail', 'data', 'status',
  'resource', 'entry', 'item', 'object', 'id', 'identifier', 'value', 'values',
]);

// The summary's first word is assumed to be the verb; the head noun is the
// last word of the span running from the second word up to (but not
// including) the first stop-token in STOP_TOKENS or a literal "(" / ",", or
// to the end of the summary if none appears. '' when the summary is
// empty/missing, or when there is nothing after the verb.
export function headNounFromText(text) {
  const summary = (text || '').trim();
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
    return span[span.length - 2].toLowerCase();
  }
  return lastRaw;
}

export function headNounForRow(row) {
  return naiveSingular(headNounFromText(row.summary));
}

// --- operationIdHeadNoun (judge.mjs 395-409) --------------------------------
//
// (*) Uses the new tokensForRow above (split applied inside). Equivalence:
// new operationIdHeadNoun(row) === old operationIdHeadNoun(withSplitOperationId(row)).

// Also steps back over "by" (on top of everything in GENERIC_TAILS, which
// already carries "id") — ...ById-shaped tails.
const OPID_TAIL_STEPBACK = new Set([...GENERIC_TAILS, 'by']);

function operationIdHeadNounRaw(row) {
  const { tokens } = tokensForRow(row);
  const rest = tokens.slice(1);
  if (!rest.length) return '';
  let i = rest.length - 1;
  while (i > 0 && OPID_TAIL_STEPBACK.has(rest[i].toLowerCase())) i -= 1;
  return rest[i].toLowerCase();
}

export function operationIdHeadNoun(row) {
  return naiveSingular(operationIdHeadNounRaw(row));
}

// --- isJunkToken (poc/archive/m1/step3/allowlist.mjs 20-24) -------------------------

// Tokens that are never nouns: path placeholders ({id}, {app), version tags
// (v1, 10) and filler words.
const FILLER = new Set(['from', 'using', 'or', 'and', 'by', 'for', 'to', 'of', 'the', 'a', 'an', 'with', 'in', 'on', 'at', 'into', 'via', 'all']);

export function isJunkToken(w) {
  return /[{}]/.test(w) || /^v?\d+$/.test(w) || FILLER.has(w);
}

// --- buildJunkSet — replaces c19's buildNounTable + c20's cleanNounTable
// (poc/archive/m1/arbiter/c19.mjs 191-208, c20.mjs 55-120) ---------------------------
//
// c20's own stopword list (STOPWORDS in c20.mjs), copied verbatim — a
// stem-artifact check needs the SAME allCount table c20 built from
// buildNounTable, but here it is derived directly from rows rather than via
// c19's separate PDP-only buildNounTable/cleanNounTable pair.
const STEM_STOPWORDS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'all', 'any', 'some',
  'each', 'specified', 'given', 'new', 'old', 'single', 'multiple',
  'existing', 'current', 'main', 'base', 'other', 'same', 'and', 'for',
  'with', 'from',
]);

const ALPHA_RE = /^[a-z]+$/;

function isStemArtifact(word, allCountByNoun) {
  const ownCount = allCountByNoun.get(word) || 0;
  for (const suffix of ['e', 'es', 'y']) {
    const longer = word + suffix;
    const longerCount = allCountByNoun.get(longer);
    if (longerCount !== undefined && longerCount > ownCount) return true;
  }
  return false;
}

// For each row, take the set {headNounForRow, operationIdHeadNoun} minus
// '', count how many rows each noun appears in (allCount). A noun is junk
// when: not /^[a-z]+$/, or length < 3, or in c20's STOPWORDS, or a stem
// artifact (some noun+'e'|'es'|'y' has a strictly higher allCount). Returns
// the Set of junk nouns.
export function buildJunkSet(rows) {
  const allCountByNoun = new Map();
  for (const row of rows) {
    const nouns = new Set();
    const sNoun = headNounForRow(row);
    if (sNoun) nouns.add(sNoun);
    const oNoun = operationIdHeadNoun(row);
    if (oNoun) nouns.add(oNoun);
    for (const noun of nouns) {
      allCountByNoun.set(noun, (allCountByNoun.get(noun) || 0) + 1);
    }
  }
  const junkSet = new Set();
  for (const noun of allCountByNoun.keys()) {
    if (
      !ALPHA_RE.test(noun) ||
      noun.length < 3 ||
      STEM_STOPWORDS.has(noun) ||
      isStemArtifact(noun, allCountByNoun)
    ) {
      junkSet.add(noun);
    }
  }
  return junkSet;
}

// --- nounsForRow (poc/archive/m1/step3/allowlist.mjs 30-43) -------------------------
//
// Same as the original, but the verb stems to skip are passed in as one Set
// (today it checks LIVE_VERBS and NON_NOUN_READ_VERBS from
// poc/archive/m1/step3/lists.mjs separately; the caller here passes their union).
export function nounsForRow(row, junkSet, verbStems) {
  const splitRow = withSplitOperationId(row);
  const out = new Set();
  for (const n of [headNounForRow(splitRow), operationIdHeadNoun(splitRow)]) {
    if (n && !junkSet.has(n) && !isJunkToken(n)) out.add(n);
  }
  for (const t of tokensForRow(splitRow).tokens) {
    const w = naiveSingular(t.toLowerCase());
    if (!w || junkSet.has(w) || isJunkToken(w)) continue;
    if (matchesAnyStem(w, verbStems)) continue;
    out.add(w);
  }
  return out;
}
