// E8: the verb+noun arbiter. leadVerb(op) and objectNouns(op) are the two
// signals; both are learned from BUILD-half ground truth by learn-vn.mjs.
// This does not reuse rules.mjs's SEED/SEED_V2 tables or rules-text.mjs's
// harm/read token lists — arbiterVN(op, model) is self-contained given a
// model produced by learn-vn.mjs.

import { methodDefault, extractVerbs, RANK } from './rules.mjs';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

// Singularise a lowercase word by the shared rule: "ies" -> "y"; else
// strip one trailing "s" when the word is longer than 4 characters and
// does not end in "ss" or "us" (the "us" exception keeps "status" as
// "status" rather than mangling it to "statu" — see the E8 report for
// why this exception is read into the spec's stated example).
export function singularise(word) {
  if (!word) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) {
    return word.slice(0, -1);
  }
  return word;
}

// First run of alphabetic characters in text, after stripping any leading
// non-letter characters (markdown markers, whitespace, punctuation).
function firstAlphaToken(text) {
  if (!text) return null;
  const stripped = String(text).replace(/^[^A-Za-z]+/, '');
  const m = stripped.match(/^[A-Za-z]+/);
  return m ? m[0].toLowerCase() : null;
}

/**
 * Signal V: the lead verb. First alphabetic token of op.summary, else of
 * op.description, singularised. Falls back to the operationId's first
 * camelCase token (via extractVerbs) when there is no summary/description
 * text to draw from.
 * @param {{summary?: string, description?: string, path?: string, operationId?: string}} op
 * @returns {string|null}
 */
export function leadVerb(op) {
  const fromText = firstAlphaToken(op.summary) ?? firstAlphaToken(op.description);
  if (fromText) return singularise(fromText);
  const { opVerb } = extractVerbs(op.path, op.operationId);
  return opVerb;
}

/**
 * Signal N: the object nouns. Path tokens (via extractVerbs), each
 * singularised, deduplicated, order preserved.
 * @param {{path?: string, operationId?: string}} op
 * @returns {string[]}
 */
export function objectNouns(op) {
  const { pathTokens } = extractVerbs(op.path, op.operationId);
  const seen = new Set();
  const out = [];
  for (const t of pathTokens) {
    const n = singularise(t);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export function assertFloor(result, method) {
  if (RANK[result.class] < RANK.r) {
    throw new Error(`arbiterVN produced a class below r: ${result.class}`);
  }
  if ((method === 'PUT' || method === 'DELETE') && RANK[result.class] < RANK.w) {
    throw new Error(`arbiterVN lowered ${method} below w: ${result.class}`);
  }
  return result;
}

/**
 * The E8 verb+noun arbiter.
 * @param {{method:string, path:string, operationId:string, summary?:string, description?:string, hasCallbacks?:boolean, has409?:boolean, hasSink?:boolean}} op
 * @param {{verbMap: Record<string,{class:'r'|'w'|'x'}>, liveNouns: Array<{noun:string}>}} model
 * @returns {{class:'r'|'w'|'x', confidence:string, rule_id:string, evidence:string}}
 */
export function arbiterVN(op, model) {
  const method = String(op.method ?? '').toUpperCase();
  const floor = methodDefault(method);

  // 1. Safe methods are locked at r; the text/verb/noun signals are never
  // consulted.
  if (SAFE_METHODS.has(method)) {
    return { class: 'r', confidence: 'high', rule_id: 'V0-safe-locked', evidence: `method=${method}` };
  }

  const v = leadVerb(op);
  const vc = model.verbMap[v]?.class ?? null;
  const nouns = objectNouns(op);
  const liveNounSet = new Set((model.liveNouns ?? []).map((e) => e.noun));
  const live = nouns.filter((n) => liveNounSet.has(n));

  // 3. Structural markers (callbacks, a sink field) are direct evidence of
  // consequence.
  if (op.hasCallbacks || op.hasSink) {
    const markers = [];
    if (op.hasCallbacks) markers.push('callbacks');
    if (op.hasSink) markers.push('sink');
    return assertFloor(
      { class: 'x', confidence: 'high', rule_id: 'V1-structural', evidence: `structural=${markers.join(',')}` },
      method
    );
  }

  // 4. Verb signal says x.
  if (vc === 'x') {
    return assertFloor(
      { class: 'x', confidence: 'high', rule_id: 'V2-verb-x', evidence: `verb=${v}` },
      method
    );
  }

  // 5. A live-object noun raises to x unless the verb signal says r.
  if (live.length > 0 && vc !== 'r') {
    return assertFloor(
      {
        class: 'x',
        confidence: vc === 'w' ? 'high' : 'low',
        rule_id: 'V3-live-object',
        evidence: `verb=${v ?? 'none'} nouns=${live.join(',')}`,
      },
      method
    );
  }

  // 6. POST/PATCH with a read verb and no 409 (repeat is equivalent) can
  // lower to r.
  if ((method === 'POST' || method === 'PATCH') && vc === 'r' && !op.has409) {
    return assertFloor(
      { class: 'r', confidence: 'low', rule_id: 'V4-lookup', evidence: `verb=${v}` },
      method
    );
  }

  // 7. Anything unresolved keeps the floor.
  return assertFloor(
    { class: floor, confidence: 'method-only', rule_id: 'V5-floor', evidence: `verb=${v ?? 'none'}` },
    method
  );
}
