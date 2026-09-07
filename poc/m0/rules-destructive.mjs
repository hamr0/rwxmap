// E24: the destructive flag, a second and independent axis from the r/w/x
// blast-radius class. destructiveFlag(op) never looks at the class — only
// at the method and the lead verb — so it can be used to measure how wrong
// the PRD §4.3 mapping (destructiveHint = class == x) is, rather than
// assuming it. Two rules, evaluated in order:
//   D1 - method DELETE is always destructive.
//   D2 - the lead verb (leadVerb, rules-vn.mjs — the same lead-text/
//        first-token logic rules-verb.mjs uses via the same import) is a
//        stem in the hand-written destructive set (destructive.json).
//   D3 - otherwise: not destructive.
// destructive.json's provenance note says this set was written before any
// scoring and is unmeasured; run-axes.mjs is what measures it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { leadVerb } from './rules-vn.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESTRUCTIVE_PATH = path.join(HERE, 'destructive.json');

/**
 * Load the hand-written destructive verb stem set.
 * @returns {Set<string>}
 */
export function loadDestructiveVerbs() {
  const raw = JSON.parse(readFileSync(DESTRUCTIVE_PATH, 'utf8'));
  return new Set(raw.verbs);
}

/**
 * D1-D3: is this operation destructive? Derived only from method and lead
 * verb — never from the r/w/x class.
 * @param {{method:string, path?:string, operationId?:string, summary?:string, description?:string}} op
 * @param {Set<string>} [destructiveVerbs] defaults to loadDestructiveVerbs()
 * @returns {{destructive: boolean, rule_id: string, evidence: string}}
 */
export function destructiveFlag(op, destructiveVerbs = loadDestructiveVerbs()) {
  const method = String(op.method ?? '').toUpperCase();

  if (method === 'DELETE') {
    return { destructive: true, rule_id: 'D1-method-delete', evidence: `method=${method}` };
  }

  const v = leadVerb(op);
  if (v && destructiveVerbs.has(v)) {
    return { destructive: true, rule_id: 'D2-verb-destructive', evidence: `verb=${v}` };
  }

  return { destructive: false, rule_id: 'D3-not-destructive', evidence: `method=${method} verb=${v ?? 'none'}` };
}
