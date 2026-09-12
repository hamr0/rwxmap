// Goal 2 (truth x, predicted w — the leak) as a single clean shape.
//
// Reproduces the reference in docs/product/goal2-solution.md exactly: no
// hand-written third-party noun list, no corpus lean layer — a method
// floor, two verb rules, and one widened-noun allowlist layer. See that
// doc for why this replaces five drifted copies of the same logic.
import { tokensForRow, leadVerbForRow } from '../arbiter/arbiter.mjs';
import {
  headNounForRow, operationIdHeadNoun, naiveSingular, matchesAnyStem,
  fallbackVerbFromSummary, summaryHasCallerPhrase,
} from '../arbiter/judge.mjs';
import { LIVE_VERBS, READ_VERBS } from '../arbiter/c11.mjs';

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// One table, one place. GET/HEAD/OPTIONS -> r, POST -> x, PUT/DELETE/PATCH -> w.
export function floorFor(method) {
  switch (method) {
    case 'GET': case 'HEAD': case 'OPTIONS': return 'r';
    case 'POST': return 'x';
    case 'PUT': case 'DELETE': case 'PATCH': return 'w';
    default: throw new Error(`unrecognised method: ${method}`);
  }
}

// Floor + verb rules only, no noun evidence. One direction of travel per
// method: POST only ever lowers off its x floor, PUT/DELETE/PATCH only
// ever raise off their w floor.
export function classifyByVerb(row) {
  const method = row.method;
  const floor = floorFor(method);

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { class: 'r', rule: 'floor', floor: true };
  }

  if (method === 'POST') {
    const verb = leadVerbForRow(row);
    if (matchesAnyStem(verb, READ_VERBS)) {
      return { class: 'r', rule: 'read-verb', floor: false };
    }
    return { class: floor, rule: 'floor', floor: true };
  }

  // PUT / DELETE / PATCH
  const { tokens } = tokensForRow(row);
  let hit = null;
  for (const t of tokens) {
    const w = t.toLowerCase();
    if (matchesAnyStem(w, LIVE_VERBS)) { hit = w; break; }
  }
  if (!hit) {
    const sv = fallbackVerbFromSummary(row.summary);
    if (matchesAnyStem(sv, LIVE_VERBS)) hit = sv;
  }
  if (hit && !summaryHasCallerPhrase(row.summary)) {
    return { class: 'x', rule: 'live-verb', floor: false };
  }
  return { class: floor, rule: 'floor', floor: true };
}

// The widened noun set: both head nouns plus every remaining operationId
// token (singularised), skipping junk and verb tokens — verbs aren't
// nouns, and a verb token slipping into the noun set would let it satisfy
// the allowlist test for the wrong reason.
export function nounsForRow(row, junkSet) {
  const out = new Set();
  for (const n of [headNounForRow(row), operationIdHeadNoun(row)]) {
    if (n && !junkSet.has(n)) out.add(n);
  }
  for (const t of tokensForRow(row).tokens) {
    const w = naiveSingular(t.toLowerCase());
    if (!w || junkSet.has(w)) continue;
    if (matchesAnyStem(w, LIVE_VERBS) || matchesAnyStem(w, READ_VERBS)) continue;
    out.add(w);
  }
  return out;
}

// Composes the two layers. The noun layer runs only on rows the verb layer
// left at the w floor on a raise-only method; everything else passes
// through classifyByVerb's result untouched.
export function classifyGoal2(row, junkSet, allowlist) {
  const b = classifyByVerb(row);
  if (!RAISE_METHODS.has(row.method)) return b;
  if (b.class !== 'w' || b.floor !== true) return b;

  const nouns = nounsForRow(row, junkSet);
  if (nouns.size > 0 && [...nouns].every((n) => allowlist.has(n))) return b;
  return { class: 'x', rule: 'no-own-noun', floor: false };
}
