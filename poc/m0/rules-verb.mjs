// E18: the verb-led arbiter. The lead verb (leadVerb, rules-vn.mjs) sets a
// base class; the object of that verb may raise it; the method floor
// (assertFloor, rules-vn.mjs) always applies. See docs/learnings.md for
// what motivated this shape: E9's lexicon fired on any party word it found
// anywhere in the scanned text (scope='block'/'file'), including words that
// were nowhere near the verb's own object — this arbiter instead asks
// "what is the object of THIS verb" before treating a party word as
// evidence of consequence.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { methodDefault } from './rules.mjs';
import { leadVerb, assertFloor, singularise } from './rules-vn.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERBS_PATH = path.join(HERE, 'verbs.json');
const PARTIES_PATH = path.join(HERE, 'parties.json');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

// Determiners/quantifiers that precede a verb's object without naming it.
const STOP = new Set([
  'a', 'an', 'the', 'this', 'that', 'all', 'any', 'specific', 'given', 'existing',
  'new', 'active', 'ongoing', 'current', 'valid', 'complete', 'single', 'one',
  'their', 'its', 'your', 'my', 'selected', 'identified', 'specified',
]);

// Connective words: reaching one of these ends the walk through the
// object phrase (whatever follows belongs to a different phrase).
const PREP = new Set([
  'from', 'for', 'in', 'of', 'by', 'with', 'to', 'on', 'at', 'using', 'based',
  'when', 'if', 'and', 'or', 'that', 'which', 'associated', 'belonging',
  'where', 'as', 'via', 'after', 'before',
]);

/**
 * Load and compile the hand-written verb and party tables.
 * @returns {{read: Set<string>, write: Set<string>, consequential: Set<string>, parties: Set<string>, verbsRaw: object, partiesRaw: object}}
 */
export function loadTables() {
  const verbsRaw = JSON.parse(readFileSync(VERBS_PATH, 'utf8'));
  const partiesRaw = JSON.parse(readFileSync(PARTIES_PATH, 'utf8'));
  return {
    read: new Set(verbsRaw.read),
    write: new Set(verbsRaw.write),
    consequential: new Set(verbsRaw.consequential),
    parties: new Set(partiesRaw.parties),
    verbsRaw,
    partiesRaw,
  };
}

// The same text leadVerb() draws its token from: summary if it has any
// alphabetic content, else description, else ''. Kept as a single source
// (never summary+description concatenated) on purpose — see the module
// comment: scanning wider text is exactly what let E9 fire on unrelated
// party words.
function leadText(op) {
  if (typeof op.summary === 'string' && /[A-Za-z]/.test(op.summary)) return op.summary;
  if (typeof op.description === 'string' && /[A-Za-z]/.test(op.description)) return op.description;
  return '';
}

/**
 * The head noun of the lead verb's object: lowercase, alphabetic tokens,
 * drop the first token (the lead verb itself), then walk the rest
 * skipping STOP words and stopping at the first PREP word; the head is
 * the LAST token kept (English compounds are head-final), singularised.
 * @param {string} text
 * @returns {string|null}
 */
export function objectHead(text) {
  const tokens = String(text ?? '').toLowerCase().match(/[a-z]+/g) ?? [];
  if (tokens.length <= 1) return null;
  const kept = [];
  for (const t of tokens.slice(1)) {
    if (PREP.has(t)) break;
    if (STOP.has(t)) continue;
    kept.push(t);
  }
  if (kept.length === 0) return null;
  return singularise(kept[kept.length - 1]);
}

/**
 * Whether text contains a from/for/of/to phrase whose object is a party
 * word, e.g. "for a user", "from your account". Returns the matched party
 * word (truthy) or null (falsy) — a caller that only wants a boolean can
 * treat the return value as one.
 * @param {string} text
 * @param {Set<string>} parties
 * @returns {string|null}
 */
export function partyPhrase(text, parties) {
  if (!text) return null;
  const words = [...parties].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`\\b(?:from|for|of|to)\\s+(?:(?:a|an|the|this|that|another|all)\\s+)?(${words.join('|')})\\b`, 'i');
  const m = re.exec(text);
  return m ? m[1].toLowerCase() : null;
}

// opts.partySource === 'anywhere': any party word anywhere in the lead
// text, singular or plural, regardless of its grammatical role — the
// "old noisy behaviour" opts.partySource === 'object' (default) replaced.
function anyPartyWord(text, parties) {
  const tokens = String(text ?? '').toLowerCase().match(/[a-z]+/g) ?? [];
  for (const t of tokens) {
    if (parties.has(t) || parties.has(singularise(t))) return t;
  }
  return null;
}

/**
 * The E18 verb-led arbiter.
 * @param {{method:string, path:string, operationId:string, summary?:string, description?:string, hasCallbacks?:boolean, has409?:boolean, hasSink?:boolean}} op
 * @param {{read:Set<string>, write:Set<string>, consequential:Set<string>, parties:Set<string>}} tables from loadTables()
 * @param {{partySource?: 'object'|'anywhere'}} [opts]
 * @returns {{class:'r'|'w'|'x', confidence:string, rule_id:string, evidence:string}}
 */
export function arbiterVerb(op, tables, opts = {}) {
  const partySource = opts.partySource ?? 'object';
  const method = String(op.method ?? '').toUpperCase();
  const floor = methodDefault(method);

  const finish = (result) => assertFloor(result, method);

  // V0: safe methods are locked at r; no other signal is consulted.
  if (SAFE_METHODS.has(method)) {
    return { class: 'r', confidence: 'high', rule_id: 'V0-safe-locked', evidence: `method=${method}` };
  }

  // V1: structural markers (callbacks, a sink field) are direct evidence
  // of consequence.
  if (op.hasCallbacks || op.hasSink) {
    const markers = [];
    if (op.hasCallbacks) markers.push('callbacks');
    if (op.hasSink) markers.push('sink');
    return finish({ class: 'x', confidence: 'high', rule_id: 'V1-structural', evidence: `structural=${markers.join(',')}` });
  }

  const v = leadVerb(op);
  const text = leadText(op);

  // V2: a consequential lead verb is x on its own.
  if (v && tables.consequential.has(v)) {
    return finish({ class: 'x', confidence: 'high', rule_id: 'V2-verb-consequential', evidence: `verb=${v}` });
  }

  // V3: the verb's object names a party — someone/something the call acts
  // on or reports to — either as the object head itself or as the object
  // of a from/for/of/to phrase.
  const head = objectHead(text);
  let matchedParty = null;
  if (partySource === 'anywhere') {
    const scanText = [op.summary, op.description].filter(Boolean).join(' ');
    matchedParty = anyPartyWord(scanText, tables.parties);
  } else {
    if (head && tables.parties.has(head)) matchedParty = head;
    else matchedParty = partyPhrase(text, tables.parties);
  }
  if (matchedParty) {
    const known = Boolean(v) && (tables.read.has(v) || tables.write.has(v) || tables.consequential.has(v));
    return finish({
      class: 'x',
      confidence: known ? 'high' : 'low',
      rule_id: 'V3-party-object',
      evidence: `verb=${v ?? 'none'} head=${head ?? 'none'} party=${matchedParty}`,
    });
  }

  // V4: a read lead verb. POST/PATCH may loosen to r; DELETE/PUT keep the
  // method floor (w) — a read-named DELETE/PUT is still a mutation.
  if (v && tables.read.has(v)) {
    if (method === 'POST' || method === 'PATCH') {
      return finish({ class: 'r', confidence: 'high', rule_id: 'V4-verb-read', evidence: `verb=${v}` });
    }
    return finish({ class: floor, confidence: 'low', rule_id: 'V4-verb-read', evidence: `verb=${v}` });
  }

  // V5: a write lead verb stays at the method floor.
  if (v && tables.write.has(v)) {
    return finish({ class: floor, confidence: 'high', rule_id: 'V5-verb-write', evidence: `verb=${v}` });
  }

  // V6: no signal resolved anything; keep the method floor.
  return finish({ class: floor, confidence: 'method-only', rule_id: 'V6-floor', evidence: `verb=${v ?? 'none'} head=${head ?? 'none'}` });
}
