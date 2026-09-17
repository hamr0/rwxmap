// Step 3 — the x step. It is a standalone classifier: it only ever emits x,
// it never loosens to r or w, and it reads no corpus and prints nothing.
//
// Two rules:
//
//   raise-word  a row step 2 claimed with its WORDLESS method floor
//               (PUT/DELETE/PATCH, hit.rule === 'method-floor') is raised
//               w -> x when one of RAISE_WORDS appears among the row's
//               words. This is step 3's only reach into PUT/DELETE/PATCH.
//   floor-post  a row neither step 1 nor step 2 claimed at all becomes x.
//               This is step 3's floor and it is also the named leftover
//               pile: no word fired, only the method (always POST here) is
//               known.
//
// raise-word is built in flow.mjs, not here, because it needs to see step
// 2's claim (and specifically which rule fired) before it can act. This
// file only holds the word list and the match itself.
import { splitTokens } from '../step1/words.mjs';
import { wordsForRow } from '../step2/step2.mjs';

// RAISE_WORDS (17): role/access nouns, not verbs. The PRD calls the
// mechanism "live verbs" but nothing here is a verb -- these are the nouns
// that name a permission, a membership, a credential or someone else's
// presence in the account. Hand-read from the corpus's PUT/DELETE/PATCH
// method-floor pile and priced word by word before adoption. Copy verbatim,
// do not add or remove any.
export const RAISE_WORDS = new Set([
  'permission', 'membership', 'memberships', 'panelist', 'panelists',
  'watcher', 'watchers', 'participants', 'actor', 'invites', 'invitation',
  'invitations', 'sso', 'password', 'grant', 'disassociate', 'reject',
]);

/**
 * Every word step 3 looks at: step 2's wordsForRow (operationId/path lead
 * tokens plus summary words) PLUS the row's own path tokens -- the
 * '/'-separated path segments that are not {param} placeholders, each run
 * through step 1's splitTokens. Path tokens are added here because
 * wordsForRow's path contribution is only the LEAD token; a raise word
 * further back in the path (e.g. /users/{id}/permissions) would otherwise
 * never be seen.
 */
export function wordsForStep3(row) {
  const path = row.path || '';
  const segments = path.split('/').filter((s) => s && !(s.startsWith('{') && s.endsWith('}')));
  const pathTokens = segments.flatMap((s) => splitTokens(s));
  return [...wordsForRow(row), ...pathTokens];
}

/**
 * Apply step 3's raise-word rule to one row. Exact match against the word
 * set at ANY token position -- no stemming, no lead-token restriction,
 * because these are nouns, not verbs to be inflected.
 * @param {{method?:string, operationId?:string, path?:string, summary?:string}} row
 * @param {Set<string>} [words] word list to use (LOVO passes a rebuilt one).
 * @returns {{class:'x', step:3, rule:'raise-word'}|null}
 */
export function applyStep3(row, words = RAISE_WORDS) {
  const hit = wordsForStep3(row).some((w) => words.has(w));
  return hit ? { class: 'x', step: 3, rule: 'raise-word' } : null;
}
