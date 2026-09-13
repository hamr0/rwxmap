// The one place that assembles a full run context: core's rows/vendors
// plus goal 2's LOVO allowlist, plus the frozen raw pair used only to
// replay the old c15 + C20 shape (history replay only — the pipeline
// itself never reads the frozen pair; only measure.mjs/proof.mjs's
// "previous"/GATE column does).
import { loadContext as loadCoreContext } from '../core/corpus.mjs';
import { buildNounTable } from '../arbiter/c19.mjs';
import { cleanNounTable, nounStats, buildLovoAllowlists } from '../arbiter/c20.mjs';
import { buildGoal2Context, MIN_N, MIN_W_SHARE } from '../goal2/allowlist.mjs';
import { buildGoal1LowerVerbs } from '../goal1/lists.mjs';
// Importing pipeline.mjs here (context -> pipeline) is fine; the cycle to
// avoid is the other direction (goal1.mjs must never import context.mjs).
import { classify } from './pipeline.mjs';

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

export function loadContext() {
  const { rows: allRows, vendors } = loadCoreContext();

  const { junkSet, allowlistFor } = buildGoal2Context(allRows, vendors);

  // Goal 1's pile: every row still at class x after goal 2 runs (any
  // rule), restricted to the raise-only methods — this is the population
  // goal 1's own lowering-verb list is mined from (D57: never goal 2's).
  const goal2Ctx = { junkSet, allowlistFor };
  const goal1Pile = [];
  for (const row of allRows) {
    if (!RAISE_METHODS.has(row.method)) continue;
    const res = classify(row, goal2Ctx, { upTo: 'goal2' });
    if (res.class === 'x') goal1Pile.push({ row });
  }
  const { lowerVerbsFor } = buildGoal1LowerVerbs(goal1Pile, vendors);

  // The frozen pair — built from RAW (unsplit) rows, since that shape was
  // frozen before the splitter existed.
  const { junkSet: frozenJunkSet, cleanTable: frozenCleanTable } = cleanNounTable(buildNounTable(allRows));
  const frozenStats = nounStats(frozenCleanTable);
  const frozenPerVendorAllowlist = buildLovoAllowlists(frozenStats, vendors, MIN_N, MIN_W_SHARE);

  function frozenAllowlistFor(vendor) {
    return frozenPerVendorAllowlist.get(vendor) || new Set();
  }

  return { rows: allRows, vendors, junkSet, allowlistFor, lowerVerbsFor, frozenJunkSet, frozenAllowlistFor };
}
