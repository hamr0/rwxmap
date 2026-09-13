// The one place that assembles a full run context: core's rows/vendors
// plus goal 2's LOVO allowlist, plus goal 1's own other-party noun list
// (goal 1 is a standalone classifier, not a pipeline layer — the user's
// ruling 2026-09-13), plus the frozen raw pair used only to replay the
// old c15 + C20 shape (history replay only — the pipeline itself never
// reads the frozen pair; only measure.mjs/proof.mjs's "previous"/GATE
// column does).
import { loadContext as loadCoreContext } from '../core/corpus.mjs';
import { buildNounTable } from '../arbiter/c19.mjs';
import { cleanNounTable, nounStats, buildLovoAllowlists } from '../arbiter/c20.mjs';
import { buildGoal2Context, MIN_N, MIN_W_SHARE } from '../goal2/allowlist.mjs';
import { buildGoal1OtherNouns } from '../goal1/lists.mjs';

export function loadContext() {
  const { rows: allRows, vendors } = loadCoreContext();

  const { junkSet, allowlistFor } = buildGoal2Context(allRows, vendors);

  // Goal 1's own other-party noun list: mined over ALL PUT/DELETE/PATCH
  // rows, using goal 2's junkSet only as a noun-reader input — goal 1's
  // list itself never depends on goal 2's allowlist or its evidence.
  const { otherNounsFor } = buildGoal1OtherNouns(allRows, vendors, junkSet);

  // The frozen pair — built from RAW (unsplit) rows, since that shape was
  // frozen before the splitter existed.
  const { junkSet: frozenJunkSet, cleanTable: frozenCleanTable } = cleanNounTable(buildNounTable(allRows));
  const frozenStats = nounStats(frozenCleanTable);
  const frozenPerVendorAllowlist = buildLovoAllowlists(frozenStats, vendors, MIN_N, MIN_W_SHARE);

  function frozenAllowlistFor(vendor) {
    return frozenPerVendorAllowlist.get(vendor) || new Set();
  }

  return { rows: allRows, vendors, junkSet, allowlistFor, otherNounsFor, frozenJunkSet, frozenAllowlistFor };
}
