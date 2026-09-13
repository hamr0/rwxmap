// One copy of the corpus load + leave-one-vendor-out allowlist setup.
// Previously duplicated inline in goal2/measure.mjs and goal2/proof.mjs;
// this is the single place that duplication now lives.
import { loadCombinedCorpus, buildNounTable } from '../arbiter/c19.mjs';
import { cleanNounTable, nounStats, buildLovoAllowlists } from '../arbiter/c20.mjs';
import { withSplitOperationId } from './core.mjs';

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

  // The noun table must see the '/' + whitespace split too, or the LOVO
  // allowlist is built from different tokens than the pipeline reads
  // (measured: allowlist-only omission moved goal 1's count to 2713, not
  // 2703). `rows` below stays the raw, unsplit allRows so CSVs/reports keep
  // showing the original operationId.
  const { junkSet, cleanTable } = cleanNounTable(buildNounTable(allRows.map(withSplitOperationId)));
  const stats = nounStats(cleanTable);
  const perVendorAllowlist = buildLovoAllowlists(stats, vendors, MIN_N, MIN_W_SHARE);

  function allowlistFor(vendor) {
    return perVendorAllowlist.get(vendor) || new Set();
  }

  // The frozen pair exists only so the old c15 + C20 shape replays exactly
  // as frozen (89 / 1936) — built from RAW (unsplit) rows, since that shape
  // was frozen before the splitter existed. The pipeline never reads this
  // pair; only measure.mjs/proof.mjs's "previous"/GATE column does.
  const { junkSet: frozenJunkSet, cleanTable: frozenCleanTable } = cleanNounTable(buildNounTable(allRows));
  const frozenStats = nounStats(frozenCleanTable);
  const frozenPerVendorAllowlist = buildLovoAllowlists(frozenStats, vendors, MIN_N, MIN_W_SHARE);

  function frozenAllowlistFor(vendor) {
    return frozenPerVendorAllowlist.get(vendor) || new Set();
  }

  return { rows: allRows, vendors, junkSet, allowlistFor, frozenJunkSet, frozenAllowlistFor };
}
