// poc/d87/step1.mjs — copied verbatim from src/step1.js (2026-09-22), only
// the import path changed (./tokens.mjs instead of ./tokens.js). D87 does
// not touch step 1: "Unchanged from src/step1.js (D74)". Imports nothing
// from src/ or any other poc/ dir.
import { leadVerbAfterModifiers, tokensForRow, matchingMembers } from './tokens.mjs';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const READ_VERBS = new Set([
  'retrieve', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'count', 'lookup', 'assess', 'find', 'get',
  'validate', 'evaluate', 'analyse', 'analyze', 'parse', 'calculate',
  'introspect', 'suggest', 'sanitise', 'sanitize',
]);

export const SAFE_VERBS = new Set([
  'validate', 'evaluate', 'analyse', 'analyze', 'parse', 'calculate',
  'introspect', 'suggest', 'sanitise', 'sanitize',
]);

/**
 * Apply step 1 to one row.
 * @param {object} row
 * @param {{readVerbs?: Set<string>, safeVerbs?: Set<string>}} [words]
 * @returns {object|null} null when step 1 does not claim the row.
 */
export function step1(row, words = {}) {
  const readVerbs = words.readVerbs ?? READ_VERBS;
  const safeVerbs = words.safeVerbs ?? SAFE_VERBS;

  const method = (row.method || '').toUpperCase();
  if (READ_METHODS.has(method)) {
    return { class: 'r', step: 1, rule: 'method', source: 'floor', matched: [] };
  }
  if (method !== 'POST') return null;

  const leadVerb = leadVerbAfterModifiers(row);
  const leadMatches = matchingMembers(leadVerb, readVerbs);
  if (leadMatches.length > 0) {
    return { class: 'r', step: 1, rule: 'read-verb', source: 'list', matched: leadMatches };
  }

  const tokens = tokensForRow(row);
  const anyMatches = new Set();
  for (const t of tokens) {
    for (const m of matchingMembers(t, safeVerbs)) anyMatches.add(m);
  }
  if (anyMatches.size > 0) {
    return {
      class: 'r',
      step: 1,
      rule: 'read-verb-anywhere',
      source: 'list',
      matched: [...anyMatches].sort(),
    };
  }

  return null;
}
