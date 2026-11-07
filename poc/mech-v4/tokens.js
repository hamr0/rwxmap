// Shared tokeniser for all three steps (r/w/x), plus the one verb-reading
// helper steps 2 and 3 both call. Originally ported verbatim from the
// frozen poc/step1/words.mjs; graduated from poc/d87/tokens.mjs under D87
// (the reader fix below). This file holds no classification word list and
// makes no r/w/x decision — each step owns its own lists. Imports nothing.
//
// D87 READER FIX: `delete` is removed from METHOD_WORDS (see the constant
// below). Every other method word is still stripped from lead position
// when followed by an explicit separator (post_ai_ask, delete_files_id
// keeps its old shape for every word but delete). With `delete` gone,
// `deleteThing` and `delete_files_id` both keep `delete` as their lead
// token on ANY method — step 2 can then read a `delete` lead as a
// can't-undo verb even on a POST, which the old METHOD_WORDS (which
// included `delete`) would have silently stripped.

// withSplitOperationId(row) — the '/' + whitespace split. splitTokens only
// splits on '_ - .' and camelCase, so an operationId like 'gists/unstar' or
// 'delete team member' would otherwise stay one token. This is the one
// place that split lives: trim, then collapse every run of '/' or
// whitespace into '_' before anything reads operationId. A whitespace-only
// operationId trims to '' first, so it still falls back to the path
// exactly as before.
function withSplitOperationId(row) {
  const trimmed = (row.operationId || '').trim();
  return { ...row, operationId: trimmed.replace(/[\/\s]+/g, '_') };
}

// --- lead-token tokenization -------------------------------------------

// HTTP-method words that get stripped from lead position when the
// operationId starts with the word followed by a separator.
// Exported because verbForRow (below) also needs this exact vocabulary, to
// detect a bare-method lead token that carries no verb — this is HTTP
// method vocabulary shared by the tokeniser and the verb reader, not a
// classification list.
// D87 reader fix: 'delete' removed (see file header) so a `delete` lead
// verb is never stripped on any method.
export const METHOD_WORDS = new Set(['get', 'post', 'put', 'patch', 'head', 'options']);
// An explicit separator right after the method word means it is a
// redundant method-name prefix (post_ai_ask, post-cardDetails,
// delete_files_id); an uppercase letter there means ordinary camelCase
// (deleteDevice, getSession, updateDevice) and the word is a real verb.
// A digit is never the first character of `rest` on its own: splitTokens
// (below) only inserts a boundary before an uppercase letter, never before
// a digit, so a digit glued straight to the method word stays fused into
// tokens[0] (get2x), which fails the tokens[0] === method check above
// before this regex ever runs. A digit can still follow the method word,
// but only after one of these separators (get_2fa), which is already
// covered.
const METHOD_PREFIX_SEPARATOR = /^[_\-.]/;

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

// Tokens for a row's lead string (operationId, or the last non-{param}
// path segment when operationId is empty), with a leading method-word
// prefix stripped ONLY when it is followed by an explicit separator in the
// raw string (post_ai_ask, post-cardDetails, delete_files_id) — never on a
// camelCase continuation (deleteDevice, getSession, updateDevice keep
// their verb as the lead, since nothing separates it from the rest of the
// word). The result is never empty unless the raw string tokenizes to
// nothing at all. Whether the prefix was actually stripped is observable
// in the returned array itself (['files','id'] vs ['delete','files','id']
// for delete_files_id/deleteDevice-shaped input), so no separate flag is
// returned.
//
// Applies withSplitOperationId to the row itself first, so callers never
// have to.
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

/**
 * Match `word` against every member of `stems`, returning the members that
 * actually matched, sorted ascending. Returns the members themselves, not a
 * boolean, precisely so a rule can report WHICH word fired without anything
 * re-deriving it later. There is no re-derivation elsewhere: whoever calls
 * this collects the match at the moment it happens.
 * @param {string} word
 * @param {Set<string>} stems
 * @returns {string[]}
 */
export function matchingMembers(word, stems) {
  const hits = [];
  for (const stem of stems) {
    if (stemMatches(word, stem)) hits.push(stem);
  }
  return hits.sort();
}

// --- lead verb after modifiers -------------------------------------------

// Modifier words that sit in front of the real verb (BulkRetrieveCustomers,
// DeprecatedBatchRetrieveInventoryCounts, beta_Getinputtokencounts).
export const LEAD_MODIFIERS = new Set(['bulk', 'batch', 'deprecated', 'beta', 'async']);

// Lead verb of a row, skipping any run of LEAD_MODIFIERS at the front.
// Returns '' when nothing is left.
export function leadVerbAfterModifiers(row) {
  const tokens = tokensForRow(row);
  let i = 0;
  while (i < tokens.length && LEAD_MODIFIERS.has(tokens[i])) i += 1;
  return i < tokens.length ? tokens[i] : '';
}

// --- shared verb reading for steps 2 and 3 --------------------------------
//
// One copy, used by both step2.js and step3.js. Ported from poc/d87's
// tokens.mjs (itself ported from the pre-D87 src/step2.js's
// summaryWords/summaryVerb).

// Words skipped when reading a verb off the summary line. Plumbing, not a
// classification list.
const SUMMARY_SKIP = new Set(['test', 'mode', 'a', 'an', 'the', 'bulk', 'batch']);

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
 * @param {import('./types.js').Operation} row
 * @returns {{verb: string, fromSummary: boolean}}
 */
export function verbForRow(row) {
  const lead = leadVerbAfterModifiers(row);
  const fromSummary = METHOD_WORDS.has(lead);
  return { verb: fromSummary ? summaryVerbForRow(row) : lead, fromSummary };
}
