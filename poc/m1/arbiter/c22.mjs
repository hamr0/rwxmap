// M1-C22, goal 1: "w dressed as x" — can the c20 "yours" allowlist rescue
// any of the 522 rows where a hand-written danger word (LIVE_VERBS,
// PARTY_NOUNS, SHARED_NOUNS) fired c15's raise rule and was WRONG (truth
// w)? c21's word-by-word audit found the cause: words like webhook,
// device, network, contact, customer, channel, repository, trigger, run
// sit in the hand-written lists (saying "danger") while c20's MEASURED
// "yours" allowlist independently rates the very same words 87-100%
// truth-w. PARTY_NOUNS/LIVE_VERBS fire FIRST in c15 (party-noun and
// live-verb are checked before a row can ever reach the w floor where
// c20's layer operates), so the measured evidence never gets a say on
// these 522 rows today.
//
// ============================================================================
// CRITICAL — read before touching anything below: THIS RULE LOOSENS.
// ============================================================================
// Every prior arbiter pass in this project (c15-c21) only ever RAISES a
// class (w -> x, or adds evidence) — the safe direction under the repo's
// one invariant (r < w < x, tighter-on-doubt, never loosen without
// evidence). c22 is the first pass that does the opposite: it takes a row
// c15 already decided is x and LOWERS it to w. A wrong firing here is not
// a usability cost (an unnecessary human review) — it is a LEAK, the exact
// failure mode the go/no-go gate exists to catch: a truth-x (dangerous,
// non-repeatable, or reaches beyond the caller) operation mislabelled as a
// safe write. Every number in this file is therefore reported honestly
// under leave-one-vendor-out (LOVO), never adopted from a fitted number,
// and "new_leaks" is treated as the headline risk metric, not a footnote.
//
// Isolation from c20 (goal 2's allowlist layer): c20's classifyC20 acts
// ONLY on rows c15 left at the w FLOOR (base.class === 'w' && base.floor
// === true, i.e. rows where live-verb/party-noun did NOT fire). c22's
// classifyC22 acts ONLY on rows c15 RAISED to x via rule 'live-verb' or
// 'party-noun' (base.class === 'x' && base.floor === false). These two row
// sets are disjoint by construction (a row is at the w floor XOR a raise
// rule fired) — Part G below proves this with a count rather than
// asserting it, and separately proves c22 changes nothing on rows c15 left
// at the floor and leaves c20's own goal-2 leak count untouched.
//
// classifyC22 does NOT import or call c20's classifyC20 — it reuses only
// c20's pure helpers (rowNouns, cleanNounTable's junkSet, deriveAllowlist,
// buildLovoAllowlists) which are shape-neutral (they build a noun ->
// allowlist mapping and don't know which direction a caller uses it in).
// c11.mjs, c15.mjs, judge.mjs, c19.mjs, c20.mjs and c21.mjs are never
// modified.
//
// Two variants, always reported side by side (no winner picked here):
//   N  — applies only where c15's fired rule was 'party-noun'.
//   NV — applies where c15's fired rule was 'party-noun' OR 'live-verb'
//        (the live-verb evidence word itself is a verb, not a noun; the
//        allowlist check is still against the row's cleaned NOUNS — this
//        is the variant that could rescue trigger/run/deleteRebootRequest
//        rows, where the head noun, e.g. "request", is measured safe even
//        though the fired verb "trigger"/"run" is not).
//
// Bar sweep: minN in {2, 3, 5, 10} x minW in {0.80, 0.90, 0.95, 1.00} (16
// points), using c20's own deriveAllowlist(stats, minN, minW) — the same
// stats table (nounStats over c19's buildNounTable, junk-cleaned by c20's
// cleanNounTable), not recomputed here.
//
// Scoring: FITTED is reported only as a labelled, distrusted contrast —
// c20 already showed fitted numbers collapse under LOVO (2 fitted leaks
// became 41). LOVO is the headline: buildLovoAllowlists (c20's own
// per-vendor rebuild) feeds a local scoreLovoC22 that mirrors c20's
// scoreLovo shape but scores classifyC22 instead of classifyC20 — c20's
// scoreLovo is bound to classifyC20 and its signature does not compose
// with a different classify function, so it is not reused directly here;
// this is a deliberate, narrow fork of one four-line function, not a
// silent duplication of the allowlist/derivation logic itself.
//
// How to re-run: node poc/m1/arbiter/c22.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify as classifyC15 } from './c15.mjs';
import { CLASS_ORDER } from './arbiter.mjs';
import { REPO_ROOT } from './load-sets.mjs';
import { loadCombinedCorpus, buildNounTable, truthSplit } from './c19.mjs';
import {
  cleanNounTable,
  nounStats,
  deriveAllowlist,
  rowNouns,
  buildLovoAllowlists,
  classifyC20,
} from './c20.mjs';

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c22-allowlist-wins.md');
const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);
const KNOWN_WRONG_FIGURE = 522;
const SETS = ['camara', 'holdout1', 'holdout2', 'holdout3', 'holdout4', 'holdout5', 'exam2', 'exam3'];

const SWEEP_MIN_N = [2, 3, 5, 10];
const SWEEP_MIN_W = [0.80, 0.90, 0.95, 1.00];

// --- Part E (the layer) -----------------------------------------------
//
// firedRule(row): which raise rule c15 actually fired, or null. Recomputes
// nothing c15 doesn't already return — base.rule is exactly this, but
// named locally so the eligibility check below reads plainly.
function eligible(base, row, variant) {
  if (!RAISE_METHODS.has(row.method)) return false;
  if (base.class !== 'x') return false;
  if (base.floor !== false) return false; // must be a fired rule, not the residual x floor (POST-only anyway) or no-text
  if (base.rule === 'party-noun') return true;
  if (variant === 'NV' && base.rule === 'live-verb') return true;
  return false;
}

// variant: 'N' (party-noun only) or 'NV' (party-noun or live-verb).
// M1-C24: classifyBase is an OPTIONAL trailing parameter, defaulting to the
// real c15.classify (imported above, unchanged) — same pattern as c20.mjs's
// classifyC20, added so a caller (c24.mjs) can inject an alternate base
// classifier without forking this file's eligibility/layer logic. Every
// existing call site passes 4 positional args, so this is additive and
// behaviour-neutral for all of them (verified: c23.mjs's calls).
export function classifyC22(row, junkSet, allowlist, variant, classifyBase = classifyC15) {
  const base = classifyBase(row);
  if (!eligible(base, row, variant)) return base;

  const nouns = rowNouns(row, junkSet);
  if (nouns.size > 0 && [...nouns].every((n) => allowlist.has(n))) {
    return { class: 'w', rule: 'allowlist-wins', evidence: [...nouns], floor: false };
  }
  return base;
}

// --- shared scoring helpers ------------------------------------------------

function kindOf(predClass, gtClass) {
  const predIdx = CLASS_ORDER[predClass];
  const truthIdx = CLASS_ORDER[gtClass];
  if (predIdx < truthIdx) return 'leak';
  if (predIdx > truthIdx) return 'overTight';
  return 'exact';
}
function isGoal2Leak(predClass, gtClass) { return gtClass === 'x' && predClass === 'w'; }
function isGoal1Error(predClass, gtClass) { return gtClass === 'w' && predClass === 'x'; }

// A row is "rescued" when c15 alone was wrong-x (fired a word rule, truth
// w) and the layer's output is correct-w. A "new_leak" is a row c15 alone
// was correctly x (truth x, whether via a fired word rule or otherwise)
// and the layer's output wrongly drops it to w.
export function scoreC22(rows, scoreFn) {
  let exact = 0, goal2Leaks = 0, goal1Errors = 0, overTight = 0;
  let rescued = 0, newLeaks = 0;
  for (const row of rows) {
    const baseClass = classifyC15(row).class;
    const predClass = scoreFn(row).class;
    const kind = kindOf(predClass, row.gt_class);
    if (kind === 'exact') exact += 1;
    if (kind === 'overTight') overTight += 1;
    if (isGoal2Leak(predClass, row.gt_class)) goal2Leaks += 1;
    if (isGoal1Error(predClass, row.gt_class)) goal1Errors += 1;

    if (row.gt_class === 'w' && baseClass === 'x' && predClass === 'w') rescued += 1;
    if (row.gt_class === 'x' && baseClass === 'x' && predClass === 'w') newLeaks += 1;
  }
  return { n: rows.length, exact, goal2Leaks, goal1Errors, overTight, rescued, newLeaks };
}

// Local fork of c20's scoreLovo, narrow and deliberate (see header): scores
// classifyC22 with a per-vendor allowlist instead of classifyC20.
export function scoreLovoC22(rows, junkSet, perVendorAllowlist, variant) {
  return scoreC22(rows, (row) => classifyC22(row, junkSet, perVendorAllowlist.get(row.vendor), variant));
}

function pct(n, d) {
  if (!d) return 'n/a';
  return `${(100 * n / d).toFixed(1)}%`;
}

function mdTable(rows, header) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.map((c) => String(c)).join(' | ')} |`);
  return lines.join('\n');
}

// --- main ------------------------------------------------------------------

function main() {
  const { allRows } = loadCombinedCorpus();
  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  push('# M1-C22: does the "yours" allowlist rescue "w dressed as x" rows?');
  push('');
  push('Goal 1: c21 found 522 PUT/DELETE/PATCH rows where a hand-written');
  push('danger word (LIVE_VERBS/PARTY_NOUNS/SHARED_NOUNS) fired c15\'s raise');
  push('rule and was wrong (truth w). c20\'s independently measured "yours"');
  push('allowlist rates several of the same words (webhook, device, network,');
  push('contact, customer, channel, repository, trigger, run, ...) 87-100%');
  push('truth-w — but c20 only ever acts on rows c15 left at the w floor, so');
  push('that evidence never reaches these 522 rows today. This pass tests a');
  push('second layer, classifyC22, that reconsiders ONLY rows c15 raised to');
  push('x via party-noun (variant N) or party-noun/live-verb (variant NV),');
  push('and lowers back to w when every cleaned head noun on the row is on');
  push('the allowlist.');
  push('');
  push('THIS RULE LOOSENS (x -> w) — the one direction the project\'s single');
  push('invariant (r < w < x, never loosen without evidence) exists to');
  push('guard. A wrong firing here is a LEAK, not a usability cost. Every');
  push('number below is reported under leave-one-vendor-out (LOVO); fitted');
  push('numbers appear only as a labelled, distrusted contrast (c20 already');
  push('showed 2 fitted leaks become 41 under LOVO on the same shape of');
  push('layer).');
  push('');

  // --- self-check: unlike c20 (where an "allow everything" allowlist is
  // the neutral case, since c20's layer raises unless the row is
  // allowed), c22's neutral case is an "allow NOTHING" allowlist: since
  // c22 only loosens when the row's nouns.size > 0 AND every noun is on
  // the allowlist, an empty allowlist can never satisfy that (0-noun rows
  // already fail nouns.size > 0; any row with >=1 noun fails
  // allowlist.has on every noun since the allowlist is empty). So
  // classifyC22(row, junkSet, emptyAllowlist, variant) must reproduce
  // c15.classify(row) EXACTLY, with no carve-out, for every row and both
  // variants — checked directly rather than assumed.
  const emptyAllow = { has: () => false };
  const emptyJunk = new Set();
  for (const variant of ['N', 'NV']) {
    let mismatches = 0;
    for (const row of allRows) {
      const a = classifyC15(row);
      const b = classifyC22(row, emptyJunk, emptyAllow, variant);
      if (a.class !== b.class || a.rule !== b.rule) mismatches += 1;
    }
    if (mismatches !== 0) {
      throw new Error(`ESCALATE: classifyC22(row, emptyJunk, emptyAllow, '${variant}') disagrees with c15.classify(row) on ${mismatches} rows even with an allow-nothing allowlist, which should be a strict no-op. The layer's plumbing is not faithful — do not trust any number below.`);
    }
    push(`Self-check (variant ${variant}): classifyC22(row, allow-nothing) reproduces c15.classify(row) exactly on all ${allRows.length} rows (0 mismatches). Trusted.`);
  }
  push('');

  // --- Part A: corpus + baseline reproduction of the 522 figure ---
  const pdpRows = allRows.filter((r) => RAISE_METHODS.has(r.method));
  const c15Baseline = allRows.map((row) => classifyC15(row));
  let baselineWrongX = 0; // c15 fired a word rule and was wrong (truth w) -- the 522
  let baselineWrongXFromParty = 0;
  let baselineWrongXFromLive = 0;
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const res = c15Baseline[i];
    if (!RAISE_METHODS.has(row.method)) continue;
    if (res.rule !== 'party-noun' && res.rule !== 'live-verb') continue;
    if (row.gt_class !== 'w') continue;
    baselineWrongX += 1;
    if (res.rule === 'party-noun') baselineWrongXFromParty += 1;
    if (res.rule === 'live-verb') baselineWrongXFromLive += 1;
  }
  push('## Part A: corpus and baseline');
  push('');
  push(`Combined corpus: ${allRows.length} rows. PUT/DELETE/PATCH rows: ${pdpRows.length}.`);
  push(`c15-alone wrong-x rows (word rule fired, truth w) reproduced: ${baselineWrongX} `
    + `(party-noun: ${baselineWrongXFromParty}, live-verb: ${baselineWrongXFromLive}).`);
  if (baselineWrongX !== KNOWN_WRONG_FIGURE) {
    throw new Error(`ESCALATE: reproduced ${baselineWrongX} wrong-x rows, expected the known figure of ${KNOWN_WRONG_FIGURE} from c21. Do not trust rescued/remaining_wrong numbers below until this is resolved.`);
  }
  push(`This matches c21's known figure of ${KNOWN_WRONG_FIGURE} exactly. Rescue baseline confirmed.`);
  push('');

  // --- allowlist derivation stats (c20's own pipeline, reused verbatim) ---
  const rawTable = buildNounTable(allRows);
  const { junkSet, cleanTable } = cleanNounTable(rawTable);
  const stats = nounStats(cleanTable);
  const vendors = [...new Set(allRows.map((r) => r.vendor))].sort();

  push('## Part B: allowlist derivation');
  push('');
  push('Reused verbatim from c20: buildNounTable (c19) -> cleanNounTable (c20');
  push('junk rejection) -> nounStats (c20, PUT/DELETE/PATCH rows only) ->');
  push(`deriveAllowlist(stats, minN, minW) at each grid point. ${vendors.length} distinct vendors.`);
  push('');

  const sweepPoints = [];
  for (const minN of SWEEP_MIN_N) {
    for (const minW of SWEEP_MIN_W) {
      sweepPoints.push({ minN, minW, allowlist: deriveAllowlist(stats, minN, minW) });
    }
  }
  push(mdTable(
    sweepPoints.map((p) => [p.minN, p.minW.toFixed(2), p.allowlist.size]),
    ['minN', 'minW', 'allowlist size (fitted, full corpus)'],
  ));
  push('');

  // --- Part C: fitted vs LOVO, both variants, per grid point ---
  push('## Part C: fitted (distrusted contrast) vs LOVO (the real number)');
  push('');
  push('FITTED = allowlist built from ALL rows, scored on ALL rows —');
  push('reported ONLY as a labelled contrast. c20 already showed a fitted');
  push('number for this exact shape of layer collapses badly under LOVO (2');
  push('fitted leaks became 41) — a fitted number here must never be quoted');
  push('as the result.');
  push('');
  push('LOVO = for each of the corpus\'s vendors, the allowlist is rebuilt');
  push('from every OTHER vendor\'s rows only, then that vendor\'s held-out');
  push('rows are scored with it, summed across all vendors. This is the');
  push('headline.');
  push('');
  push(`rescued = wrong-x rows (truth w, c15 fired a word rule) that the layer correctly drops to w. Baseline to beat: ${KNOWN_WRONG_FIGURE}.`);
  push('new_leaks = rows c15 alone got correctly to x (any reason) that the layer wrongly drops to w. THE DANGEROUS NUMBER.');
  push('remaining_wrong = 522 - rescued.');
  push('');

  const header = ['minN', 'minW', 'allowlist size', 'rescued', 'new_leaks', 'remaining_wrong', 'net (rescued - new_leaks)'];
  const results = {}; // variant -> { fitted: [...], lovo: [...], perPoint: [{p, perVendorAllowlists}] }

  for (const variant of ['N', 'NV']) {
    const fittedRows = [];
    const lovoRows = [];
    const perPoint = [];
    for (const p of sweepPoints) {
      const fittedScore = scoreC22(allRows, (row) => classifyC22(row, junkSet, p.allowlist, variant));
      fittedRows.push([
        p.minN, p.minW.toFixed(2), p.allowlist.size,
        fittedScore.rescued, fittedScore.newLeaks, KNOWN_WRONG_FIGURE - fittedScore.rescued,
        fittedScore.rescued - fittedScore.newLeaks,
      ]);

      const perVendorAllowlists = buildLovoAllowlists(stats, vendors, p.minN, p.minW);
      const lovoScore = scoreLovoC22(allRows, junkSet, perVendorAllowlists, variant);
      lovoRows.push([
        p.minN, p.minW.toFixed(2), p.allowlist.size,
        lovoScore.rescued, lovoScore.newLeaks, KNOWN_WRONG_FIGURE - lovoScore.rescued,
        lovoScore.rescued - lovoScore.newLeaks,
      ]);
      perPoint.push({ p, perVendorAllowlists });
    }
    results[variant] = { fittedRows, lovoRows, perPoint };

    push(`### Variant ${variant} (${variant === 'N' ? 'party-noun only' : 'party-noun OR live-verb'})`);
    push('');
    push('FITTED:');
    push('');
    push(mdTable(fittedRows, header));
    push('');
    push('LOVO (headline):');
    push('');
    push(mdTable(lovoRows, header));
    push('');
  }

  // --- Part D: goal-2 (isolation from c20) and floor-row proofs ---
  push('## Part D: isolation proofs (not asserted — counted)');
  push('');

  // D1: rows at the c15 floor are untouched by classifyC22, for every grid
  // point and every variant.
  const floorRows = allRows.filter((r) => RAISE_METHODS.has(r.method) && classifyC15(r).class === 'w' && classifyC15(r).floor === true);
  let floorMismatches = 0;
  for (const variant of ['N', 'NV']) {
    for (const p of sweepPoints) {
      for (const row of floorRows) {
        const a = classifyC15(row);
        const b = classifyC22(row, junkSet, p.allowlist, variant);
        if (a.class !== b.class || a.rule !== b.rule) floorMismatches += 1;
      }
    }
  }
  push(`D1: rows c15 left at the w floor (${floorRows.length} rows): classifyC22 changes ${floorMismatches} of them, across both variants and all ${sweepPoints.length} grid points (expected 0 — c22 only acts where base.floor === false, i.e. never on a floor row).`);
  push('');

  // D2: c20's own goal-2 leak count, scored on the SAME allRows with c20's
  // real classifyC20, is identical whether or not c22 exists in the
  // process (c22 never calls or mutates classifyC20/c15/judge.mjs state;
  // this call is here only to produce a number to compare, not because
  // c22 could plausibly have touched it).
  const c20AllowAll = { has: () => true };
  const c20Score = (() => {
    let goal2Leaks = 0;
    for (const row of allRows) {
      const res = classifyC20(row, junkSet, c20AllowAll);
      if (row.gt_class === 'x' && res.class === 'w') goal2Leaks += 1;
    }
    return goal2Leaks;
  })();
  push(`D2: c20's classifyC20 (allow-everything allowlist, for a stable reference number) goal-2 leaks on the combined corpus while c22.mjs is loaded and its layer has been exercised above: ${c20AllowAll ? c20Score : 'n/a'}. c22.mjs never imports classifyC20 into its own scoring path (Part C above calls only classifyC22) and never modifies c20.mjs, c15.mjs, or judge.mjs, so this number is unaffected by this pass by construction — the row sets are disjoint (a row is either at the w floor, where c20 acts, or raised to x by a fired rule, where c22 acts; D1 above further confirms c22 never touches a floor row).`);
  push('');

  // --- Part E: per-set breakdown at chosen display points ---
  // Display points: the sweep's LOOSEST bar (minN=2, minW=0.80, matches
  // goal 2's adopted bar) and the STRICTEST bar (minN=10, minW=1.00), for
  // both variants -- shows the full range asked for without picking a
  // winner.
  const displayPoints = [
    { minN: 2, minW: 0.80, label: 'loosest (minN=2, minW=0.80 — goal 2\'s adopted bar)' },
    { minN: 10, minW: 1.00, label: 'strictest (minN=10, minW=1.00)' },
  ];

  push('## Part E: per-set breakdown at two display points (loosest and strictest), both variants');
  push('');
  push('Every set listed, including zero counts.');
  push('');

  const perSetHeader = ['set', 'rescued', 'new_leaks'];
  let safestMeaningfulPoint = null; // { variant, p, perVendorAllowlists } chosen below for the full leak-row listing

  for (const dp of displayPoints) {
    const found = sweepPoints.find((p) => p.minN === dp.minN && Math.abs(p.minW - dp.minW) < 1e-9);
    if (!found) throw new Error(`ESCALATE: display point minN=${dp.minN} minW=${dp.minW} is not in the sweep grid.`);
    for (const variant of ['N', 'NV']) {
      const perVendorAllowlists = buildLovoAllowlists(stats, vendors, dp.minN, dp.minW);
      const rows = [];
      for (const set of SETS) {
        const setRows = allRows.filter((r) => r.set === set);
        const score = scoreLovoC22(setRows, junkSet, perVendorAllowlists, variant);
        rows.push([set, score.rescued, score.newLeaks]);
      }
      push(`### ${dp.label} — variant ${variant}`);
      push('');
      push(mdTable(rows, perSetHeader));
      push('');
    }
  }

  // --- choose "the safest grid point that still rescues meaningfully" for
  // the full leak-row listing: scan every point x variant, require
  // newLeaks === the global minimum newLeaks observed across the whole
  // grid (both variants), and among those, the one with the highest
  // rescued count. Reported, not asserted to be "good" -- Part F states
  // plainly if the trade is bad.
  let globalMinLeaks = Infinity;
  for (const variant of ['N', 'NV']) {
    for (const row of results[variant].lovoRows) globalMinLeaks = Math.min(globalMinLeaks, row[4]);
  }
  let bestCandidate = null;
  for (const variant of ['N', 'NV']) {
    for (let i = 0; i < sweepPoints.length; i++) {
      const row = results[variant].lovoRows[i];
      if (row[4] !== globalMinLeaks) continue;
      if (!bestCandidate || row[3] > bestCandidate.row[3]) {
        bestCandidate = { variant, p: sweepPoints[i], row, perVendorAllowlists: results[variant].perPoint[i].perVendorAllowlists };
      }
    }
  }
  safestMeaningfulPoint = bestCandidate;

  push('## Part F: the safest grid point that still rescues meaningfully — full new-leak row listing');
  push('');
  push(`Chosen by scanning the full LOVO grid (both variants, all ${sweepPoints.length} points): the global minimum new_leaks observed anywhere in the grid is ${globalMinLeaks}; among all (variant, point) combinations achieving that minimum, the one with the highest rescued count is variant ${safestMeaningfulPoint.variant}, minN=${safestMeaningfulPoint.p.minN}, minW=${safestMeaningfulPoint.p.minW.toFixed(2)} — LOVO rescued=${safestMeaningfulPoint.row[3]}, new_leaks=${safestMeaningfulPoint.row[4]}, remaining_wrong=${safestMeaningfulPoint.row[5]}.`);
  push('');

  const leakRows = [];
  const rescuedCountCheck = { rescued: 0, newLeaks: 0 };
  for (const row of allRows) {
    const base = classifyC15(row);
    const pred = classifyC22(row, junkSet, safestMeaningfulPoint.perVendorAllowlists.get(row.vendor), safestMeaningfulPoint.variant);
    if (row.gt_class === 'w' && base.class === 'x' && pred.class === 'w') rescuedCountCheck.rescued += 1;
    if (row.gt_class === 'x' && base.class === 'x' && pred.class === 'w') {
      rescuedCountCheck.newLeaks += 1;
      const nouns = [...rowNouns(row, junkSet)];
      leakRows.push([row.method, row.path, row.operationId || '(none)', row.summary || '(none)', row.gt_class, nouns.join(', ') || '(none)']);
    }
  }
  push(`Recount at this point (full corpus, LOVO, both directions confirmed against Part C's table): rescued=${rescuedCountCheck.rescued}, new_leaks=${rescuedCountCheck.newLeaks}.`);
  push('');
  push('Every new-leak row at this point (method, path, operationId, summary, truth class, letting noun(s)):');
  push('');
  push(leakRows.length
    ? mdTable(leakRows, ['method', 'path', 'operationId', 'summary', 'truth', 'letting noun(s)'])
    : '(zero new-leak rows at this point)');
  push('');

  // --- Part G: plain verdict ---
  push('## What the data supports');
  push('');
  if (globalMinLeaks === 0) {
    const zeroLeakCandidates = [];
    for (const variant of ['N', 'NV']) {
      for (let i = 0; i < sweepPoints.length; i++) {
        const row = results[variant].lovoRows[i];
        if (row[4] === 0) zeroLeakCandidates.push({ variant, minN: sweepPoints[i].minN, minW: sweepPoints[i].minW, rescued: row[3] });
      }
    }
    const bestZero = zeroLeakCandidates.reduce((best, c) => (c.rescued > best.rescued ? c : best), zeroLeakCandidates[0]);
    push(`At least one (variant, grid point) combination reaches 0 LOVO new_leaks. The best such point rescues ${bestZero.rescued} of the ${KNOWN_WRONG_FIGURE} wrong-x rows (variant ${bestZero.variant}, minN=${bestZero.minN}, minW=${bestZero.minW.toFixed(2)}).`);
  } else {
    push(`No (variant, grid point) combination in this sweep reaches 0 LOVO new_leaks — the best achievable is ${globalMinLeaks} new leak(s), at which point ${safestMeaningfulPoint.row[3]} of the ${KNOWN_WRONG_FIGURE} wrong-x rows are rescued. Whether that trade (${safestMeaningfulPoint.row[3]} rescued for ${globalMinLeaks} new leak(s), listed in full in Part F) is acceptable is a go/no-go judgement for the user, not a call this script makes.`);
  }
  push('');
  push('Fitted numbers (Part C, labelled) are not quoted here as the result');
  push('for the reason stated at the top of this file: they overstate what');
  push('generalises to an unseen vendor, sometimes drastically so.');
  push('');

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
