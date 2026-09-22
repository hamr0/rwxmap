// Built under D86; D87 (2026-09-22) supersedes the definition — to be rebuilt in the next pass.
// poc/step2v2 — step 2 rebuilt under D86 (M3). POC, not shipped.
//
// D86 folds "cannot be undone" into class x. Until the rows are relabelled
// that clause is read through a PROXY: the DELETE method, or a lead verb in
// the 23-word destructive list. So step 2 now:
//   - floors DELETE at x (the method is evidence for "can't be undone"),
//   - raises PUT/PATCH/POST to x on a destructive lead verb (not gated),
//   - floors PUT/PATCH at w otherwise (unchanged),
//   - lowers POST to w on the frozen modify-verb rule, gated by OTHER_PARTY
//     (unchanged, except the list lost its destructive members).
// It never assigns r. Every verdict carries `destructive` (D86: a flag
// inside x, never an axis of its own).
//
// This file imports NOTHING from src/ or poc/. Every helper below is copied
// verbatim from the frozen code it names, so a change there cannot silently
// move this POC.

// ---------------------------------------------------------------------------
// Copied verbatim from src/tokens.js
// ---------------------------------------------------------------------------

// withSplitOperationId(row) — src/tokens.js
function withSplitOperationId(row) {
  const trimmed = (row.operationId || '').trim();
  return { ...row, operationId: trimmed.replace(/[\/\s]+/g, '_') };
}

// METHOD_WORDS — src/tokens.js
export const METHOD_WORDS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
// METHOD_PREFIX_SEPARATOR — src/tokens.js
const METHOD_PREFIX_SEPARATOR = /^[_\-.]/;

// splitTokens — src/tokens.js
export function splitTokens(str) {
  if (!str) return [];
  const withBoundaries = String(str).replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  return withBoundaries
    .split(/[_\-.]+/)
    .filter((p) => p.length > 0)
    .map((p) => p.toLowerCase());
}

// rawLeadStringForRow — src/tokens.js
function rawLeadStringForRow(row) {
  const opId = (row.operationId || '').trim();
  if (opId !== '') return opId;
  const path = row.path || '';
  const segments = path.split('/').filter((s) => s && !(s.startsWith('{') && s.endsWith('}')));
  return segments.length ? segments[segments.length - 1] : '';
}

// tokensForRow — src/tokens.js
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

// VERB_SUFFIXES, VOWELS, isConsonant, stemMatches — src/tokens.js
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

// matchingMembers — src/tokens.js
export function matchingMembers(word, stems) {
  const hits = [];
  for (const stem of stems) {
    if (stemMatches(word, stem)) hits.push(stem);
  }
  return hits.sort();
}

// LEAD_MODIFIERS, leadVerbAfterModifiers — src/tokens.js
export const LEAD_MODIFIERS = new Set(['bulk', 'batch', 'deprecated', 'beta', 'async']);

export function leadVerbAfterModifiers(row) {
  const tokens = tokensForRow(row);
  let i = 0;
  while (i < tokens.length && LEAD_MODIFIERS.has(tokens[i])) i += 1;
  return i < tokens.length ? tokens[i] : '';
}

// ---------------------------------------------------------------------------
// Copied verbatim from src/step2.js
// ---------------------------------------------------------------------------

// SUMMARY_SKIP — src/step2.js
const SUMMARY_SKIP = new Set(['test', 'mode', 'a', 'an', 'the', 'bulk', 'batch']);

// summaryWords — src/step2.js
function summaryWords(row) {
  return (row.summary || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

// summaryVerb — src/step2.js
function summaryVerb(row) {
  for (const w of summaryWords(row)) {
    if (!SUMMARY_SKIP.has(w)) return w;
  }
  return '';
}

// wordsForRow — src/step2.js
export function wordsForRow(row) {
  return [...tokensForRow(row), ...summaryWords(row)];
}

// OTHER_PARTY (21) — src/step2.js, copied unchanged.
export const OTHER_PARTY = new Set([
  'user', 'users', 'member', 'members', 'follower', 'followers', 'role',
  'roles', 'permission', 'permissions', 'participant', 'participants',
  'collaborator', 'invite', 'people', 'admin', 'assignee', 'owner',
  'subscriber', 'recipient', 'audience',
]);

// ---------------------------------------------------------------------------
// This step's own lists
// ---------------------------------------------------------------------------

// DESTRUCTIVE_VERBS (23) — the 23 verbs of poc/archive/v2/m0/destructive.json,
// copied exactly. Its provenance note, verbatim: "Written 2026-09-07 before
// any scoring. Derived from MCP's own definition of the destructiveHint
// annotation: 'may perform destructive updates' (delete-or-break),
// contrasted with additive/idempotent behaviour — not derived from, or fit
// to, any ground-truth set. Unmeasured as of writing."
//
// DIRECTION: raises toward x, and sets destructive:true.
// WHICH ROWS: PUT, PATCH and POST rows. DELETE never gets here (the method
// already decided). NOT gated by OTHER_PARTY — under D86 "can't be undone"
// is x on its own, whoever the thing belongs to.
// WHERE IT MATCHES: stem-matched against the row's verb, read exactly as the
// frozen step 2 reads it (lead verb after modifiers; the summary's first
// non-filler word when the lead is a bare HTTP method word).
export const DESTRUCTIVE_VERBS = new Set([
  'delete', 'remove', 'purge', 'wipe', 'destroy', 'erase', 'clear', 'drop',
  'revoke', 'unassign', 'uninstall', 'detach', 'terminate', 'cancel', 'kill',
  'reset', 'truncate', 'expire', 'disable', 'deactivate', 'suspend', 'ban', 'block',
]);

// MODIFY_VERBS (16) — the frozen src/step2.js list (24) minus every member
// that is also in DESTRUCTIVE_VERBS. Removed (8): cancel, delete, remove,
// detach, expire, disable, deactivate, suspend. Under D86 those verbs are
// road 3 (can't be undone → x), not w, so they can no longer lower a POST.
// The DESTRUCTIVE_VERBS check runs first anyway; the removal makes the two
// lists disjoint so no row can be claimed by both (the test asserts it).
//
// DIRECTION: lowers a POST toward w. WHICH ROWS: POST only, gated by
// OTHER_PARTY. WHERE IT MATCHES: the same verb read as above.
export const MODIFY_VERBS = new Set([
  'archive', 'unarchive', 'move', 'dismiss', 'restore',
  'pause', 'unpause', 'activate', 'rotate', 'enable',
  'swap', 'merge', 'update', 'modify', 'change', 'void',
]);

/**
 * The verb a row is judged on, read exactly as the frozen step 2 reads it.
 * Exported so the readout harness reads the verb the SAME way (one writer)
 * for its proxy truth and its fire table.
 * @returns {{verb: string, fromSummary: boolean}}
 */
export function verbForRow(row) {
  const lead = leadVerbAfterModifiers(row);
  const fromSummary = METHOD_WORDS.has(lead);
  return { verb: fromSummary ? summaryVerb(row) : lead, fromSummary };
}

/**
 * Apply step 2 (v2, D86) to one row.
 * @param {object} row
 * @param {{destructiveVerbs?: Set<string>, modifyVerbs?: Set<string>, otherParty?: Set<string>}} [words]
 *   Word lists to use in place of the module's own (LOVO / per-verb pricing).
 * @returns {object|null} a Verdict {class, step, rule, source, matched, destructive}, or null.
 */
export function step2v2(row, words = {}) {
  const destructiveVerbs = words.destructiveVerbs ?? DESTRUCTIVE_VERBS;
  const modifyVerbs = words.modifyVerbs ?? MODIFY_VERBS;
  const otherParty = words.otherParty ?? OTHER_PARTY;

  const method = (row.method || '').toUpperCase();

  // 1. DELETE: the method itself is the "can't be undone" evidence.
  if (method === 'DELETE') {
    return { class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true };
  }
  if (method !== 'PUT' && method !== 'PATCH' && method !== 'POST') return null;

  const { verb, fromSummary } = verbForRow(row);

  // 2. Destructive lead verb on PUT/PATCH/POST: x, not gated.
  const destructive = matchingMembers(verb, destructiveVerbs);
  if (destructive.length > 0) {
    return {
      class: 'x',
      step: 2,
      rule: fromSummary ? 'destructive-verb-summary' : 'destructive-verb',
      source: 'list',
      matched: destructive,
      destructive: true,
    };
  }

  // 3. PUT/PATCH otherwise: the wordless w floor, a default step 3 may raise.
  if (method !== 'POST') {
    return { class: 'w', step: 2, rule: 'method-floor', source: 'floor', matched: [], destructive: false };
  }

  // 4. POST: the frozen modify-verb rule, gated by OTHER_PARTY.
  const matched = matchingMembers(verb, modifyVerbs);
  if (matched.length === 0) return null;
  if (wordsForRow(row).some((w) => otherParty.has(w))) return null;

  return {
    class: 'w',
    step: 2,
    rule: fromSummary ? 'modify-verb-summary' : 'modify-verb',
    source: 'list',
    matched,
    destructive: false,
  };
}
