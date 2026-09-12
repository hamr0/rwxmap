// One copy of the corpus load + leave-one-vendor-out allowlist setup.
// Previously duplicated inline in goal2/measure.mjs and goal2/proof.mjs;
// this is the single place that duplication now lives.
import { loadCombinedCorpus, buildNounTable } from '../arbiter/c19.mjs';
import { cleanNounTable, nounStats, buildLovoAllowlists } from '../arbiter/c20.mjs';

// D48 constants — not swept. Named here instead of left as bare literals
// at the call site.
const MIN_N = 2;
const MIN_W_SHARE = 0.80;

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

// Loads the corpus, builds the per-vendor LOVO yours-noun allowlist, and
// returns everything a caller needs to classify every row. Throws (via
// escalate/exit) on the same shape mismatch measure.mjs and proof.mjs
// already checked for, so every caller gets that guard for free.
export function loadContext() {
  const { allRows } = loadCombinedCorpus();
  const vendors = [...new Set(allRows.map((r) => r.vendor))].sort();

  if (allRows.length !== 5465) escalate(`corpus rows ${allRows.length}, expected 5465`);
  if (vendors.length !== 332) escalate(`corpus vendors ${vendors.length}, expected 332`);

  const { junkSet, cleanTable } = cleanNounTable(buildNounTable(allRows));
  const stats = nounStats(cleanTable);
  const perVendorAllowlist = buildLovoAllowlists(stats, vendors, MIN_N, MIN_W_SHARE);

  function allowlistFor(vendor) {
    return perVendorAllowlist.get(vendor) || new Set();
  }

  return { rows: allRows, vendors, junkSet, allowlistFor };
}
