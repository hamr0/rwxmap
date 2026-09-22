// poc/d87/tokens.mjs — copied from src/tokens.js (2026-09-22), plus the D87
// reader fix and a shared verb-reading helper for steps 2 and 3.
//
// Imports nothing from src/ or any other poc/ dir.
//
// THE READER FIX (D87): `delete` is removed from METHOD_WORDS. Every other
// method word is still stripped from lead position when followed by an
// explicit separator (post_ai_ask, delete_files_id keeps its old shape for
// every word but delete). With `delete` gone, `deleteThing` and
// `delete_files_id` both keep `delete` as their lead token on ANY method —
// step 2 can then read a `delete` lead as a can't-undo verb even on a POST,
// which src/tokens.js's METHOD_WORDS would have silently stripped.
function withSplitOperationId(row) {
  const trimmed = (row.operationId || '').trim();
  return { ...row, operationId: trimmed.replace(/[\/\s]+/g, '_') };
}

// --- lead-token tokenization -------------------------------------------

// D87 reader fix: 'delete' removed (see file header).
export const METHOD_WORDS = new Set(['get', 'post', 'put', 'patch', 'head', 'options']);

const METHOD_PREFIX_SEPARATOR = /^[_\-.]/;

export function splitTokens(str) {
  if (!str) return [];
  const withBoundaries = String(str).replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  return withBoundaries
    .split(/[_\-.]+/)
    .filter((p) => p.length > 0)
    .map((p) => p.toLowerCase());
}

function rawLeadStringForRow(row) {
  const opId = (row.operationId || '').trim();
  if (opId !== '') return opId;
  const path = row.path || '';
  const segments = path.split('/').filter((s) => s && !(s.startsWith('{') && s.endsWith('}')));
  return segments.length ? segments[segments.length - 1] : '';
}

export function tokensForRow(row) {
  const splitRow = withSplitOperationId(row);
  const raw = rawLeadStringForRow(splitRow);
  const tokens = splitTokens(raw);
  if (!tokens.length) return tokens;
  const method = (splitRow.method || '').toLowerCase();
  if (!METHOD_WORDS.has(method) || tokens[0] !== method) return tokens;
  const rest = String(raw).slice(method.length);
  if (!METHOD_PREFIX_SEPARATOR.test(rest)) return tokens; // camelCase continuation
  if (tokens.length < 2) return tokens; // nothing to skip to
  return tokens.slice(1);
}

// --- verb-correct stem matching -----------------------------------------

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

  if (last === 'e') {
    const base = stem.slice(0, -1);
    if (word.startsWith(base) && word.slice(base.length) === 'ing') return true;
  }

  if (last === 'y' && isConsonant(secondLast)) {
    const base = stem.slice(0, -1);
    if (word.startsWith(base)) {
      const rest = word.slice(base.length);
      if (rest === 'ies' || rest === 'ied') return true;
    }
  }

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

export function matchingMembers(word, stems) {
  const hits = [];
  for (const stem of stems) {
    if (stemMatches(word, stem)) hits.push(stem);
  }
  return hits.sort();
}

// --- lead verb after modifiers -------------------------------------------

export const LEAD_MODIFIERS = new Set(['bulk', 'batch', 'deprecated', 'beta', 'async']);

export function leadVerbAfterModifiers(row) {
  const tokens = tokensForRow(row);
  let i = 0;
  while (i < tokens.length && LEAD_MODIFIERS.has(tokens[i])) i += 1;
  return i < tokens.length ? tokens[i] : '';
}

// --- shared verb reading for steps 2 and 3 --------------------------------
//
// One copy, used by both step2.mjs and step3.mjs (brief: "Put ONE copy of
// it in tokens.mjs ... rather than duplicating"). Ported from src/step2.js's
// summaryWords/summaryVerb.

// Words skipped when reading a verb off the summary line. Plumbing, not a
// classification list.
export const SUMMARY_SKIP = new Set(['test', 'mode', 'a', 'an', 'the', 'bulk', 'batch']);

function summaryWords(row) {
  return (row.summary || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

function summaryVerbForRow(row) {
  for (const w of summaryWords(row)) {
    if (!SUMMARY_SKIP.has(w)) return w;
  }
  return '';
}

/**
 * The verb a row is judged on: the operationId/path lead verb, or, when
 * that lead token is a bare HTTP method word (METHOD_WORDS — no verb at
 * all, e.g. stripe's PostTaxCalculations, mailchimp's postLists), the
 * summary's first non-filler word instead.
 * @param {object} row
 * @returns {{verb: string, fromSummary: boolean}}
 */
export function verbForRow(row) {
  const lead = leadVerbAfterModifiers(row);
  const fromSummary = METHOD_WORDS.has(lead);
  return { verb: fromSummary ? summaryVerbForRow(row) : lead, fromSummary };
}
