// lean_letter / lean_rule for operations, from rwxmap's shipped src/ (same code path as rwxlite r15/label_mech.mjs:
// classifyOperations on {method (upper), path, and operationId/summary/description only when non-empty}).
// lean_rule is the rule as it appears in the text prefix, i.e. after rwxlite's text.js alias credential-set -> cant-undo-verb.
import { classifyOperations } from '../../src/exporter.js';

const ALIAS = { 'credential-set': 'cant-undo-verb' };

export function buildOp(o) {
  const r = { method: String(o.method).toUpperCase(), path: o.path };
  for (const k of ['operationId', 'summary', 'description']) if (o[k] !== '' && o[k] != null) r[k] = o[k];
  return r;
}

// ops: array of {method,path,operationId,summary,description} -> array of {lean_letter, lean_rule}
export function leanAll(ops) {
  return classifyOperations(ops.map(buildOp)).map((v) => ({ lean_letter: v.class, lean_rule: Object.hasOwn(ALIAS, v.rule) ? ALIAS[v.rule] : v.rule }));
}
export const leanOf = (o) => leanAll([o])[0];

// stored text prefix 'lean: <letter> <rule> | ...'
export function parsePrefix(text) {
  const m = /^lean: (\S+) (\S+) \|/.exec(text || '');
  return m ? { letter: m[1], rule: m[2] } : null;
}
