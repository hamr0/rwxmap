// E9: the hand-written-lexicon arbiter. Where E8 (rules-vn.mjs) learned
// its danger vocabulary from the BUILD half and it did not transfer to
// TEST, E9 replaces the learned danger-verb/live-noun signal with a
// hand-written lexicon (lexicon.json) that only ever tightens, and scans
// more of the spec than just the op's own summary/description (see
// `scope`). The lead-verb signal (leadVerb) and the E8 learned verbMap
// (for the read-verb lowering, L4) are reused from rules-vn.mjs — only
// the danger vocabulary is hand-written here.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { methodDefault, RANK } from './rules.mjs';
import { leadVerb, assertFloor } from './rules-vn.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEXICON_PATH = path.join(HERE, 'lexicon.json');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

// The E9 hand-written read-verb set (opts.readVerbs === 'hand'): a fixed
// list instead of the E8 learned verbMap. verify/validate/match are
// deliberately NOT in it — they read like reads but CAMARA uses them for
// consequential POSTs (see E12's readout).
export const HAND_READ_VERBS = new Set([
  'get', 'gets', 'retrieve', 'retrieves', 'return', 'returns', 'list', 'lists',
  'check', 'checks', 'query', 'queries', 'fetch', 'fetches', 'read', 'reads',
  'lookup', 'search', 'searches', 'count', 'counts', 'describe', 'describes',
]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A stem matches at a word boundary at the START of a word: \b<stem> on
// lowercased text, so "access" matches "accesses" and "terminat" matches
// "terminates", but \baccess does not match inside "success" (no boundary
// immediately before the "a"). A lexicon entry may instead be an object
// {stem, re} carrying its own whole-word regex (source string, no flags —
// compiled here with the 'i' flag like every other stem).
function compileStems(stems) {
  return stems.map((entry) => {
    if (typeof entry === 'object' && entry !== null) {
      return { stem: entry.stem, re: new RegExp(entry.re, 'i') };
    }
    return { stem: entry, re: new RegExp(`\\b${escapeRegex(entry)}`, 'i') };
  });
}

/**
 * Load and compile the hand-written danger lexicon.
 * @param {string} [lexiconPath] absolute path to a lexicon JSON file; defaults to lexicon.json
 * @returns {{dangerVerbs: Array<string|object>, liveNouns: Array<string|object>, verbRe: Array<{stem:string,re:RegExp}>, nounRe: Array<{stem:string,re:RegExp}>}}
 */
export function loadLexicon(lexiconPath = LEXICON_PATH) {
  const raw = JSON.parse(readFileSync(lexiconPath, 'utf8'));
  return {
    dangerVerbs: raw.dangerVerbs,
    liveNouns: raw.liveNouns,
    verbRe: compileStems(raw.dangerVerbs),
    nounRe: compileStems(raw.liveNouns),
  };
}

// Every compiled stem whose regex matches text, deduplicated and sorted.
function matchStems(text, compiled) {
  const hits = new Set();
  for (const { stem, re } of compiled) {
    if (re.test(text)) hits.add(stem);
  }
  return [...hits].sort();
}

/**
 * The text scanned per scope:
 * 'op'    - summary + description + operationId + path (the op's own text).
 * 'block' - 'op' text plus opBlockText (the operation's full raw YAML
 *           block) plus infoDescription (the spec's top-level info
 *           description).
 * 'file'  - the entire raw spec file text.
 * @param {object} op a loadOps() row
 * @param {'op'|'block'|'file'} scope
 * @returns {string}
 */
function scopedText(op, scope) {
  const opText = [op.summary, op.description, op.operationId, op.path].filter(Boolean).join(' ');
  if (scope === 'op') return opText;
  if (scope === 'block') {
    return [opText, op.opBlockText, op.infoDescription].filter(Boolean).join(' ');
  }
  if (scope === 'file') return op.fileText ?? '';
  throw new Error(`unknown scope: ${scope}`);
}

// The op's own path + operationId only (opts.nounSource === 'path'): no
// summary/description/block/file prose, so a noun that only shows up in
// surrounding narration doesn't fire L3.
function pathText(op) {
  return [op.operationId, op.path].filter(Boolean).join(' ');
}

// The read-verb class for L3/L4: either the E8 learned model (verbMap) or
// the hand-written HAND_READ_VERBS set (opts.readVerbs === 'hand', which
// only ever yields 'r' or null — it carries no w/x classification).
function readVerbClass(v, model, readVerbs) {
  if (readVerbs === 'hand') return HAND_READ_VERBS.has(v) ? 'r' : null;
  return model.verbMap[v]?.class ?? null;
}

/**
 * The E9 hand-written-lexicon arbiter.
 * @param {object} op a loadOps() row
 * @param {{verbMap: Record<string,{class:'r'|'w'|'x'}>}} model the E8 learned model (only verbMap is used)
 * @param {{verbRe: Array<{stem:string,re:RegExp}>, nounRe: Array<{stem:string,re:RegExp}>}} lexicon from loadLexicon()
 * @param {'op'|'block'|'file'} scope how much of the spec to scan
 * @param {{nounSource?:'all'|'path', readVerbs?:'learned'|'hand', nonSafeFloor?:'method'|'x'}} [opts]
 * @returns {{class:'r'|'w'|'x', confidence:string, rule_id:string, evidence:string}}
 */
export function arbiterLex(op, model, lexicon, scope, opts = {}) {
  const { nounSource = 'all', readVerbs = 'learned', nonSafeFloor = 'method' } = opts;
  const method = String(op.method ?? '').toUpperCase();
  const floor = methodDefault(method);
  // opts.nonSafeFloor === 'x': DELETE/PUT/PATCH can never come out below x
  // (POST is already x by methodDefault). Lexicon rules still run first so
  // their evidence is recorded in a result that gets overridden here.
  const hardFloorX = nonSafeFloor === 'x' && (method === 'DELETE' || method === 'PUT' || method === 'PATCH');

  function finish(result) {
    const asserted = assertFloor(result, method);
    if (hardFloorX && RANK[asserted.class] < RANK.x) {
      return { class: 'x', confidence: 'policy', rule_id: 'L5-floor-x', evidence: asserted.evidence };
    }
    return asserted;
  }

  // L0: safe methods are locked at r; no other signal is consulted.
  if (SAFE_METHODS.has(method)) {
    return { class: 'r', confidence: 'high', rule_id: 'L0-safe-locked', evidence: `method=${method}` };
  }

  // L1: structural markers (callbacks, a sink field) are direct evidence
  // of consequence.
  if (op.hasCallbacks || op.hasSink) {
    const markers = [];
    if (op.hasCallbacks) markers.push('callbacks');
    if (op.hasSink) markers.push('sink');
    return finish(
      { class: 'x', confidence: 'high', rule_id: 'L1-structural', evidence: `structural=${markers.join(',')}` }
    );
  }

  const text = scopedText(op, scope);
  const v = leadVerb(op);
  const vc = readVerbClass(v, model, readVerbs);

  // L2: a hand-written danger verb in the scoped text tightens to x,
  // regardless of what the lead verb says. This fires before L4 on
  // purpose: a read-verb POST whose text also says "send" stays x.
  const verbHits = matchStems(text, lexicon.verbRe);
  if (verbHits.length > 0) {
    return finish(
      { class: 'x', confidence: 'high', rule_id: 'L2-danger-verb', evidence: `verbs=${verbHits.join(',')}` }
    );
  }

  // L3: a live-object noun raises to x unless the lead verb reads as r.
  // opts.nounSource === 'path' narrows the scan to the op's own path +
  // operationId; L2's danger-verb scan above is unaffected by nounSource.
  const nounScanText = nounSource === 'path' ? pathText(op) : text;
  const nounHits = matchStems(nounScanText, lexicon.nounRe);
  if (nounHits.length > 0 && vc !== 'r') {
    return finish(
      {
        class: 'x',
        confidence: vc === 'w' ? 'high' : 'low',
        rule_id: 'L3-live-noun',
        evidence: `nouns=${nounHits.join(',')} verb=${v ?? 'none'}`,
      }
    );
  }

  // L4: POST/PATCH with a read verb and no 409 (repeat is equivalent) can
  // lower to r.
  if ((method === 'POST' || method === 'PATCH') && vc === 'r' && !op.has409) {
    return finish(
      { class: 'r', confidence: 'low', rule_id: 'L4-lookup', evidence: `verb=${v}` }
    );
  }

  // L5: anything unresolved keeps the method-default floor (or the
  // opts.nonSafeFloor === 'x' hard floor, applied in finish()).
  return finish(
    { class: floor, confidence: 'method-only', rule_id: 'L5-floor', evidence: `verb=${v ?? 'none'}` }
  );
}
