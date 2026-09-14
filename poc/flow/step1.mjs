// Step 1, r: every GET/HEAD/OPTIONS row is r; a POST whose lead verb is a
// read verb is r. Literal copy of poc/archive/m1/step1/lists.mjs's READ_VERBS
// (step1.test.mjs asserts this copy stays equal). Imports nothing from
// poc/m1 or poc/m0.
import { leadVerbForRow, matchesAnyStem } from './words.mjs';

// READ_VERBS (14): a POST row whose operationId lead verb matches one of
// these is r.
export const READ_VERBS = new Set([
  'retrieve', 'verify', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'count', 'lookup', 'assess', 'find', 'get',
]);

// Returns null when step 1 does not claim the row, else
// { class: 'r', step: 1, rule: 'method' | 'read-verb' }.
export function applyStep1(row) {
  if (row.method === 'GET' || row.method === 'HEAD' || row.method === 'OPTIONS') {
    return { class: 'r', step: 1, rule: 'method' };
  }
  if (row.method === 'POST') {
    const verb = leadVerbForRow(row);
    if (matchesAnyStem(verb, READ_VERBS)) {
      return { class: 'r', step: 1, rule: 'read-verb' };
    }
  }
  return null;
}
