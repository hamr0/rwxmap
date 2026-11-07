// Step 3 — the w step (D87). A standalone classifier: it claims the rows
// it can call w and returns null for everything else, which passes down to
// step 2's floor untouched. It never assigns r or x, it does not call
// step 1 or step 2 (the ladder decides order), it reads no files and it
// prints nothing.
//
// Rebuilt under D87, not a patch of the pre-D87 file: the old step 3
// (RAISE_WORDS, an exact any-position noun match answering "whose is it")
// is gone — D87 drops "whose" as a class test entirely (see the PRD's
// "Why" paragraph, docs/product/prd.md "The shared definition (D87)").
// OTHER_PARTY, RAISE_WORDS and wordsForStep3/wordsForRow are deleted along
// with it. Shares the verb-reading helper (verbForRow) with step2.js via
// ./tokens.js.
import { matchingMembers, verbForRow, splitTokens, stemMatches } from './tokens.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').StepVerdict} StepVerdict */

const FLOOR_METHODS = new Set(['PUT', 'PATCH']);

// KEEP_W (14)
//
// DIRECTION: claims w. A POST otherwise floors at x (step 2's floor-post);
// a verb match here claims it w instead.
// WHICH ROWS: only POST rows (PUT/PATCH already floor at w by method,
// below).
// WHERE IT MATCHES: a single verb, stem-matched against the verb this row
// is judged on — verbForRow's lead verb, or the summary verb when the
// lead carries no verb (see tokens.js's verbForRow).
// WHAT IT IS NOT: not a "whose" test, and not the pre-D87 MODIFY_VERBS list
// it superficially resembles — the can't-undo members that used to sit in
// that list (cancel, delete, archive, rotate, merge, expire, void, ...)
// moved to step 2's CANT_UNDO under D87; KEEP_W keeps only the survivors
// that D87's brief calls "can be set back".
//
// PROVENANCE: written from the v3-relabelled pile (data/relabel-2026-09-22,
// BRIEF-v3's "What can be set back" list) the same way CANT_UNDO was.
// `deactivate`, `change`, `swap`, `archive` and `disable` were measured and
// REMOVED (D89, user ruling 2026-09-22): each pays more leaks than it fixes
// against this project's adoption bar of 10 fixed per leak — 29/5 (5.8),
// 4/2 (2.0), 1/1 (1.0), 3/5 (0.6), 1/2 (0.5) — so their POST rows floor at
// x, the tighter side, instead. `create` was also measured and NOT
// adopted: 503 fixed / 72 leaks = 6.99, short of the bar of 10 (poc/d87
// README / learnings, "M3 POC under D87").
export const KEEP_W = new Set([
  'update', 'remove', 'add', 'attach', 'assign', 'activate', 'unarchive',
  'move', 'restore', 'pause', 'unpause', 'enable', 'modify', 'suspend',
]);

// CONTENT_W (20) and CONTENT_VETO (2) — the content-noun rule (rule name
// 'content-noun').
//
// DIRECTION: claims w. A POST that nothing else claimed would floor at x
// (step 2's floor-post); a content noun here claims it w instead.
// WHICH ROWS: POST only, and only rows no earlier rule claimed (not step 1,
// not CANT_UNDO, not path-x-word, not KEEP_W).
// WHERE IT MATCHES: every CONTENT_W word except restart and lock matches a
// token of the LAST static path segment (the last segment that is not a
// {param}; split on '#', tokenized with splitTokens) by stemMatches, no
// substring; custom_field is the consecutive pair custom + field(s).
// restart and lock match only as the row's lead verb (verbForRow),
// stemMatches. VETO: if any CONTENT_VETO word matches ANY static path token
// (all non-{param} segments, split on '#', splitTokens) by stemMatches or
// substring, the rule does not fire and the row stays at the floor.
// WHAT IT IS NOT: not a "whose" test, and not a verb list: it reads the
// thing the call is about, so a creation of a tag or a file is w.
//
// PROVENANCE: measured in poc/mech-v4/step3-score.mjs --veto under
// leave-one-vendor-out with the D100 loosening bar (>10 right lowerings per
// new leak): 233 right, 15 new leaks, 15.5:1 (GO); without the veto 191 /
// 14. Failed words kept out: project, config, contact, image, environment,
// flow, segment, create. Veto words dropped because all their x rows came
// from one vendor: presigned, job, transaction, refund, reversal, capture.
// The lists are meant to grow as new evidence appears; rwxlite (mode a)
// corrects what the words miss.
export const CONTENT_W = new Set([
  'tag', 'label', 'domain', 'template', 'asset', 'comment', 'custom_field',
  'repo', 'card', 'item', 'alert', 'location', 'attachment', 'ticket', 'copy',
  'upload', 'file', 'note', 'restart', 'lock',
]);
export const CONTENT_VETO = new Set(['url', 'credit']);
const LEAD_VERB_ONLY = new Set(['restart', 'lock']);

/** @param {string} seg */
const isParam = (seg) => seg.startsWith('{') && seg.endsWith('}');

/**
 * The content-noun rule's match, or [] when it does not fire.
 * @param {Operation} row a POST row
 * @param {Set<string>} contentW
 * @param {Set<string>} veto
 * @returns {string[]} the CONTENT_W words that matched, sorted
 */
function contentMatch(row, contentW, veto) {
  const segs = String(row.path || '').split('/').filter((s) => s && !isParam(s));
  const allTokens = [];
  for (const seg of segs) for (const piece of seg.split('#')) allTokens.push(...splitTokens(piece));
  for (const v of veto) {
    if (allTokens.some((t) => stemMatches(t, v) || t.includes(v))) return [];
  }
  const pieces = segs.length ? segs[segs.length - 1].split('#').map(splitTokens).filter((t) => t.length) : [];
  const { verb } = verbForRow(row);
  const found = [];
  for (const word of contentW) {
    let hit = false;
    if (LEAD_VERB_ONLY.has(word)) {
      hit = stemMatches(verb, word);
    } else if (word === 'custom_field') {
      for (const toks of pieces) {
        for (let i = 0; i + 2 <= toks.length; i++) {
          if (toks[i] === 'custom' && stemMatches(toks[i + 1], 'field')) hit = true;
        }
      }
    } else {
      hit = pieces.some((toks) => toks.some((t) => stemMatches(t, word)));
    }
    if (hit) found.push(word);
  }
  return found.sort();
}

/**
 * Apply step 3 to one row.
 * @param {Operation} row
 * @param {{keepW?: Set<string>, contentW?: Set<string>, contentVeto?: Set<string>}} [words]
 *   Word lists to use in place of the module's own (LOVO passes rebuilt
 *   ones). Omitted fields fall back to KEEP_W / CONTENT_W / CONTENT_VETO.
 * @returns {StepVerdict|null} null when step 3 does not claim the row.
 */
export function step3(row, words = {}) {
  const keepW = words.keepW ?? KEEP_W;
  const contentW = words.contentW ?? CONTENT_W;
  const contentVeto = words.contentVeto ?? CONTENT_VETO;

  const method = (row.method || '').toUpperCase();
  if (FLOOR_METHODS.has(method)) {
    return { class: 'w', step: 3, rule: 'method-floor', source: 'floor', matched: [] };
  }
  if (method !== 'POST') return null;

  const { verb, fromSummary } = verbForRow(row);
  const matched = matchingMembers(verb, keepW);
  if (matched.length === 0) {
    const content = contentMatch(row, contentW, contentVeto);
    if (content.length === 0) return null;
    return { class: 'w', step: 3, rule: 'content-noun', source: 'list', matched: content };
  }

  return {
    class: 'w',
    step: 3,
    rule: fromSummary ? 'modify-verb-summary' : 'modify-verb',
    source: 'list',
    matched,
  };
}
