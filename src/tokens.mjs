// Shared tokeniser for all three steps (r/w/x). Ported verbatim, logic
// unchanged, from the frozen poc/step1/words.mjs. This file holds no word
// list and makes no r/w/x decision — each step (poc/step1, poc/step2,
// poc/step3, and their src/ equivalents) owns its own classification lists.
// Imports nothing.

// withSplitOperationId(row) — the '/' + whitespace split. splitTokens only
// splits on '_ - .' and camelCase, so an operationId like 'gists/unstar' or
// 'delete team member' would otherwise stay one token. This is the one
// place that split lives: trim, then collapse every run of '/' or
// whitespace into '_' before anything reads operationId. A whitespace-only
// operationId trims to '' first, so it still falls back to the path
// exactly as before.
export function withSplitOperationId(row) {
  const trimmed = (row.operationId || '').trim();
  return { ...row, operationId: trimmed.replace(/[\/\s]+/g, '_') };
}

// --- lead-token tokenization -------------------------------------------

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
// Applies withSplitOperationId to the row itself first, so callers never
// have to.
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

// --- verb-correct stem matching -----------------------------------------
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

// --- lead verb after modifiers -------------------------------------------

// Modifier words that sit in front of the real verb (BulkRetrieveCustomers,
// DeprecatedBatchRetrieveInventoryCounts, beta_Getinputtokencounts).
export const LEAD_MODIFIERS = new Set(['bulk', 'batch', 'deprecated', 'beta', 'async']);

// Lead verb of a row, skipping any run of LEAD_MODIFIERS at the front.
// Returns '' when nothing is left.
export function leadVerbAfterModifiers(row) {
  const { tokens } = tokensForRow(row);
  let i = 0;
  while (i < tokens.length && LEAD_MODIFIERS.has(tokens[i])) i += 1;
  return i < tokens.length ? tokens[i] : '';
}
