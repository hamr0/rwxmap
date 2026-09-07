// E7: the text arbiter of PRD §4.5 — floor from the method, ceiling (or,
// for POST/PATCH only, a lowering) from the text signal learned by
// learn.mjs. This implements §4.5's ordered procedure exactly; it does not
// reintroduce the verb-table arbiters of rules.mjs.

import { methodDefault, RANK } from './rules.mjs';
import { tokenize } from './learn.mjs';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

function intersect(tokens, list) {
  const set = new Set(list);
  const hits = [];
  for (const t of tokens) if (set.has(t)) hits.push(t);
  return hits;
}

/**
 * The E7 text arbiter, §4.5's ordered procedure.
 * @param {{method: string, path: string, operationId: string, summary: string, description: string, hasCallbacks: boolean, has409: boolean, hasSink: boolean}} op
 * @param {{harm: Array<{token:string}>, read: Array<{token:string}>}} model
 * @returns {{class: 'r'|'w'|'x', confidence: string, rule_id: string, evidence: string}}
 */
export function arbiterText(op, model) {
  const method = String(op.method ?? '').toUpperCase();
  const floor = methodDefault(method);

  // Step 2: GET/HEAD/OPTIONS/TRACE is locked at r; text is never consulted.
  if (SAFE_METHODS.has(method)) {
    return { class: 'r', confidence: 'high', rule_id: 'T0-safe-locked', evidence: `method=${method}` };
  }

  const tokens = tokenize(op.summary, op.description);
  const harmTokens = model.harm.map((e) => e.token);
  const readTokens = model.read.map((e) => e.token);
  const harmHits = intersect(tokens, harmTokens);
  const readHits = intersect(tokens, readTokens);

  // Step 3/4: consequence evidence raises to x.
  if (harmHits.length > 0 || op.hasCallbacks || op.hasSink) {
    const markers = [];
    if (op.hasCallbacks) markers.push('callbacks');
    if (op.hasSink) markers.push('sink');
    const evidenceParts = [];
    if (harmHits.length > 0) evidenceParts.push(`harm=${harmHits.slice(0, 3).join(',')}`);
    if (markers.length > 0) evidenceParts.push(`structural=${markers.join(',')}`);
    const result = {
      class: 'x',
      confidence: harmHits.length >= 2 ? 'high' : 'low',
      rule_id: 'T1-consequence',
      evidence: evidenceParts.join(' '),
    };
    return assertFloor(result, method, floor);
  }

  // Step 4: for POST/PATCH only, a clear read signal with no consequence
  // evidence and no 409 (a 409 signals a repeat is not equivalent) lowers
  // to r.
  if ((method === 'POST' || method === 'PATCH') && readHits.length > 0 && !op.has409) {
    const result = {
      class: 'r',
      confidence: 'low',
      rule_id: 'T2-lookup',
      evidence: `read=${readHits.slice(0, 3).join(',')}`,
    };
    return assertFloor(result, method, floor);
  }

  // Step 5: anything unresolved keeps the floor.
  const result = { class: floor, confidence: 'method-only', rule_id: 'T3-floor', evidence: `method=${method}` };
  return assertFloor(result, method, floor);
}

function assertFloor(result, method, floor) {
  if (RANK[result.class] < RANK['r']) {
    throw new Error(`arbiterText produced a class below r: ${result.class}`);
  }
  if ((method === 'PUT' || method === 'DELETE') && RANK[result.class] < RANK['w']) {
    throw new Error(`arbiterText lowered ${method} below w: ${result.class}`);
  }
  return result;
}
