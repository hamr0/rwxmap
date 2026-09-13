// Goal 2's own noun extraction, junk-noun cleaning, and leave-one-vendor-out
// yours-noun allowlist build. Moved out of core/corpus.mjs (D57: goal 2 owns
// its own lists and their build, core owns only the floor + splitter).
import { headNounForRow, operationIdHeadNoun, naiveSingular, matchesAnyStem } from '../arbiter/judge.mjs';
import { tokensForRow } from '../arbiter/arbiter.mjs';
import { buildNounTable } from '../arbiter/c19.mjs';
import { cleanNounTable, nounStats, buildLovoAllowlists } from '../arbiter/c20.mjs';
import { withSplitOperationId } from '../core/core.mjs';
import { LIVE_VERBS, NON_NOUN_READ_VERBS } from './lists.mjs';

// D48 constants — not swept. Named here instead of left as bare literals
// at the call site.
export const MIN_N = 2;
export const MIN_W_SHARE = 0.80;

// The widened noun set: both head nouns plus every remaining operationId
// token (singularised), skipping junk and verb tokens — verbs aren't
// nouns, and a verb token slipping into the noun set would let it satisfy
// the allowlist test for the wrong reason.
export function nounsForRow(row, junkSet) {
  row = withSplitOperationId(row);
  const out = new Set();
  for (const n of [headNounForRow(row), operationIdHeadNoun(row)]) {
    if (n && !junkSet.has(n)) out.add(n);
  }
  for (const t of tokensForRow(row).tokens) {
    const w = naiveSingular(t.toLowerCase());
    if (!w || junkSet.has(w)) continue;
    if (matchesAnyStem(w, LIVE_VERBS) || matchesAnyStem(w, NON_NOUN_READ_VERBS)) continue;
    out.add(w);
  }
  return out;
}

// Builds the per-vendor LOVO yours-noun allowlist from rows + vendors.
// Returns { junkSet, allowlistFor }. rows must already be split-aware
// (withSplitOperationId applied) — the noun table must see the '/' +
// whitespace split too, or the LOVO allowlist is built from different
// tokens than the pipeline reads (measured: allowlist-only omission moved
// goal 1's count to 2713, not 2703).
export function buildGoal2Context(rows, vendors) {
  const { junkSet, cleanTable } = cleanNounTable(buildNounTable(rows.map(withSplitOperationId)));
  const stats = nounStats(cleanTable);
  const perVendorAllowlist = buildLovoAllowlists(stats, vendors, MIN_N, MIN_W_SHARE);

  function allowlistFor(vendor) {
    return perVendorAllowlist.get(vendor) || new Set();
  }

  return { junkSet, allowlistFor };
}
