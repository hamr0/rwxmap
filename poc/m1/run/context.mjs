// The one place that assembles a full run context: core's rows/vendors
// plus goal 2's LOVO allowlist, plus the frozen raw pair used only to
// replay the old c15 + C20 shape (history replay only — the pipeline
// itself never reads the frozen pair; only measure.mjs/proof.mjs's
// "previous"/GATE column does).
import { loadContext as loadCoreContext } from '../core/corpus.mjs';
import { buildNounTable } from '../arbiter/c19.mjs';
import { cleanNounTable, nounStats, buildLovoAllowlists } from '../arbiter/c20.mjs';
import { buildGoal2Context, MIN_N, MIN_W_SHARE } from '../goal2/allowlist.mjs';

export function loadContext() {
  const { rows: allRows, vendors } = loadCoreContext();

  const { junkSet, allowlistFor } = buildGoal2Context(allRows, vendors);

  // The frozen pair — built from RAW (unsplit) rows, since that shape was
  // frozen before the splitter existed.
  const { junkSet: frozenJunkSet, cleanTable: frozenCleanTable } = cleanNounTable(buildNounTable(allRows));
  const frozenStats = nounStats(frozenCleanTable);
  const frozenPerVendorAllowlist = buildLovoAllowlists(frozenStats, vendors, MIN_N, MIN_W_SHARE);

  function frozenAllowlistFor(vendor) {
    return frozenPerVendorAllowlist.get(vendor) || new Set();
  }

  return { rows: allRows, vendors, junkSet, allowlistFor, frozenJunkSet, frozenAllowlistFor };
}
