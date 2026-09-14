// M1 benchmark: the single re-runnable command that scores the adopted
// c11.mjs classifier AND three dumb baselines (baselines.mjs) against all
// five sets (camara, holdout1, holdout2, holdout3, holdout4), so the
// numbers in docs/logs/m1/c11-final.md mean something relative to a floor.
//
// How to re-run: node poc/m1/arbiter/run-benchmark.mjs
//
// Writes docs/logs/m1/benchmark.md and prints the same tables to stdout:
//   (a) a per-set table for c11 and for each baseline
//   (b) a tuned / reference / clean-exam split (SET_BUCKETS below), plus an
//       all-sets total row, per arbiter/baseline
//   (c) the two negative controls, what c11 and each baseline gives them
//   (d) a c11-only "evidence vs floor" three-bucket split, per set plus an
//       all-sets total and the same tuned/reference/clean-exam split:
//       locked (auto-r, GET/HEAD/OPTIONS, never a human's problem),
//       evidence (a verb/noun rule fired), floor (no evidence — the method
//       prior or no-text doctrine alone — the human review pile), as
//       counts and % of the set
//
// Asserts both negative controls come out 'x' under c11 — exits 1 otherwise,
// same as run-c11-final.mjs.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { CLASS_ORDER } from './arbiter.mjs';
import { classify as classifyC11 } from './c11.mjs';
import { BASELINES } from './baselines.mjs';
import { REPO_ROOT, loadCensusRows, loadHoldout3, loadHoldout4 } from './load-sets.mjs';

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/benchmark.md');

// Which bucket each set belongs to, per the PRD's own recorded decisions:
//   tuned      — camara, holdout1, holdout3: word lists were fitted on
//                these (D35 explicitly demotes hold-out 3 to a tuning set).
//   reference  — holdout2: never used to choose a shape (D24), but scored
//                repeatedly and carries a recorded taint (D27, a post-exam
//                list edit) — not a blind exam any more, but not fitted on.
//   clean-exam — holdout4: the only set scored once and never fitted on
//                (D35) — the sole honest transfer number.
// One home for this mapping — everything else derives from it.
export const SET_BUCKETS = {
  camara: 'tuned',
  holdout1: 'tuned',
  holdout3: 'tuned',
  holdout2: 'reference',
  holdout4: 'clean-exam',
};
const BUCKET_ORDER = ['tuned', 'reference', 'clean-exam'];

// Three-bucket split of c11's `rule` field for the (d) review-load table:
//   locked   — auto-r (GET/HEAD/OPTIONS); never a human's problem.
//   evidence — a verb/noun rule fired.
//   floor    — no evidence at all; class came from the method prior or the
//              no-text doctrine alone. This is the human-review pile.
const LOCKED_RULES = new Set(['locked']);
const EVIDENCE_RULES = new Set(['live-verb', 'party-noun', 'read-verb']);
const FLOOR_RULES = new Set(['floor', 'no-text']);

// --- helpers (mirrors run-c11-final.mjs's private helpers) -----------------

function mdTable(rows, header) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.map((c) => String(c)).join(' | ')} |`);
  return lines.join('\n');
}

function kindOf(predClass, gtClass) {
  const predIdx = CLASS_ORDER[predClass];
  const truthIdx = CLASS_ORDER[gtClass];
  if (predIdx < truthIdx) return 'leak';
  if (predIdx > truthIdx) return 'overTight';
  return 'exact';
}

// --- scoring -----------------------------------------------------------------

// classifiers: [{ name, classify }], name 'c11' first.
function buildClassifiers() {
  return [{ name: 'c11', classify: classifyC11 }, ...BASELINES];
}

function scoreAll(rows, classify) {
  const map = new Map();
  for (const row of rows) map.set(row, classify(row));
  return map;
}

function summaryRow(setRows, scored) {
  const n = setRows.length;
  let exact = 0, leaks = 0, overTight = 0;
  for (const row of setRows) {
    const result = scored.get(row);
    const kind = kindOf(result.class, row.gt_class);
    if (kind === 'leak') leaks += 1;
    else if (kind === 'overTight') overTight += 1;
    else exact += 1;
  }
  const exactPct = n ? ((exact / n) * 100).toFixed(1) : '0.0';
  const leakPct = n ? ((leaks / n) * 100).toFixed(1) : '0.0';
  const overTightPct = n ? ((overTight / n) * 100).toFixed(1) : '0.0';
  return { n, exact, leaks, overTight, exactPct, leakPct, overTightPct };
}

function perSetTable(rows, sets, scored) {
  const table = [];
  for (const setName of sets) {
    const setRows = rows.filter((r) => r.set === setName);
    const s = summaryRow(setRows, scored);
    table.push([setName, s.n, s.exact, s.leaks, s.overTight, s.exactPct, s.leakPct, s.overTightPct]);
  }
  return table;
}

// Assert every row's set maps to exactly one known bucket, and that the
// buckets partition all 1155 rows. Called once per run from main().
function assertBucketsPartition(rows) {
  for (const row of rows) {
    if (!(row.set in SET_BUCKETS)) {
      throw new Error(`ESCALATE: set "${row.set}" has no entry in SET_BUCKETS — cannot assign it to tuned/reference/clean-exam.`);
    }
  }
  const counts = { tuned: 0, reference: 0, 'clean-exam': 0 };
  for (const row of rows) counts[SET_BUCKETS[row.set]] += 1;
  const total = counts.tuned + counts.reference + counts['clean-exam'];
  if (total !== rows.length) {
    throw new Error(`ESCALATE: tuned+reference+clean-exam (${total}) does not sum to all rows (${rows.length}).`);
  }
  if (rows.length !== 1155) {
    throw new Error(`ESCALATE: expected 1155 total rows across all sets, got ${rows.length}.`);
  }
}

function bucketRows(rows, bucketName) {
  return rows.filter((r) => SET_BUCKETS[r.set] === bucketName);
}

function bucketTable(rows, scored) {
  const table = [];
  for (const bucketName of BUCKET_ORDER) {
    const s = summaryRow(bucketRows(rows, bucketName), scored);
    table.push([bucketName, s.n, s.exact, s.leaks, s.overTight, s.exactPct, s.leakPct, s.overTightPct]);
  }
  const all = summaryRow(rows, scored);
  table.push(['all', all.n, all.exact, all.leaks, all.overTight, all.exactPct, all.leakPct, all.overTightPct]);
  return table;
}

function findControlRow(rows, opId) {
  return rows.find((r) => r.operationId === opId);
}

function reviewLoadRow(setRows, scoredC11) {
  const n = setRows.length;
  let lockedCount = 0, evidenceCount = 0, floorCount = 0;
  for (const row of setRows) {
    const result = scoredC11.get(row);
    if (LOCKED_RULES.has(result.rule)) lockedCount += 1;
    else if (EVIDENCE_RULES.has(result.rule)) evidenceCount += 1;
    else if (FLOOR_RULES.has(result.rule)) floorCount += 1;
    else throw new Error(`ESCALATE: c11 rule "${result.rule}" is not in any of locked/evidence/floor — the three-bucket split does not cover it.`);
  }
  if (lockedCount + evidenceCount + floorCount !== n) {
    throw new Error(`ESCALATE: locked+evidence+floor (${lockedCount}+${evidenceCount}+${floorCount}) does not sum to n (${n}).`);
  }
  const pct = (count) => (n ? ((count / n) * 100).toFixed(1) : '0.0');
  return [lockedCount, pct(lockedCount), evidenceCount, pct(evidenceCount), floorCount, pct(floorCount)];
}

function main() {
  const censusRows = loadCensusRows();
  const holdout3Rows = loadHoldout3();
  const holdout4Rows = loadHoldout4();

  const allRows = [
    ...censusRows,
    ...(holdout3Rows || []),
    ...(holdout4Rows || []),
  ];
  const sets = ['camara', 'holdout1', 'holdout2'];
  if (holdout3Rows) sets.push('holdout3');
  if (holdout4Rows) sets.push('holdout4');

  assertBucketsPartition(allRows);

  const classifiers = buildClassifiers();
  const summaryHeader = ['set', 'n', 'exact', 'leaks', 'over_tight', 'exact_pct', 'leak_pct', 'over_tight_pct'];
  const bucketHeader = ['bucket', 'n', 'exact', 'leaks', 'over_tight', 'exact_pct', 'leak_pct', 'over_tight_pct'];

  // scored[classifierName] = Map<row, result>
  const scoredByClassifier = new Map();
  for (const { name, classify } of classifiers) {
    scoredByClassifier.set(name, scoreAll(allRows, classify));
  }

  const scoredC11 = scoredByClassifier.get('c11');

  // --- (a) per-set tables ---
  const perSetByClassifier = new Map();
  for (const { name } of classifiers) {
    perSetByClassifier.set(name, perSetTable(allRows, sets, scoredByClassifier.get(name)));
  }

  // --- (b) tuned / reference / clean-exam ---
  const bucketByClassifier = new Map();
  for (const { name } of classifiers) {
    bucketByClassifier.set(name, bucketTable(allRows, scoredByClassifier.get(name)));
  }
  const cleanExamRowByClassifier = new Map();
  for (const { name } of classifiers) {
    const row = bucketByClassifier.get(name).find((r) => r[0] === 'clean-exam');
    cleanExamRowByClassifier.set(name, row);
  }

  // --- (c) negative controls ---
  const control1 = findControlRow(censusRows, 'terminateCall');
  const control2 = findControlRow(censusRows, 'updateSessionStatus');
  if (!control1 || !control2) {
    console.error('ESCALATE: could not find one or both negative-control rows in census-ops.csv (terminateCall, updateSessionStatus).');
    process.exit(1);
  }
  const controlsTable = [];
  for (const { name } of classifiers) {
    const scored = scoredByClassifier.get(name);
    controlsTable.push([name, 'terminateCall (ClickToDial DELETE /calls/{callId})', scored.get(control1).class]);
    controlsTable.push([name, 'updateSessionStatus (WebRTC PUT /sessions/{mediaSessionId}/status)', scored.get(control2).class]);
  }
  const controlsOk = scoredC11.get(control1).class === 'x' && scoredC11.get(control2).class === 'x';

  // --- (d) c11-only evidence-vs-floor three-bucket split, per set + total ---
  const reviewLoadHeader = ['set', 'locked_count', 'locked_pct', 'evidence_count', 'evidence_pct', 'floor_count', 'floor_pct'];
  const reviewLoadTable = [];
  for (const setName of sets) {
    const setRows = allRows.filter((r) => r.set === setName);
    reviewLoadTable.push([setName, ...reviewLoadRow(setRows, scoredC11)]);
  }
  reviewLoadTable.push(['all', ...reviewLoadRow(allRows, scoredC11)]);

  const reviewLoadBucketHeader = ['bucket', 'locked_count', 'locked_pct', 'evidence_count', 'evidence_pct', 'floor_count', 'floor_pct'];
  const reviewLoadBucketTable = [
    ...BUCKET_ORDER.map((bucketName) => [bucketName, ...reviewLoadRow(bucketRows(allRows, bucketName), scoredC11)]),
    ['all', ...reviewLoadRow(allRows, scoredC11)],
  ];

  // --- assemble output ---
  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  push('# M1 benchmark: c11 vs dumb baselines');
  push('');
  push('c11.mjs\'s classify(row) — the adopted C11 floor + raise-only shape —');
  push('scored alongside three dumb baselines (baselines.mjs: all-x, get-else-x,');
  push('method-prior) against all five sets, so the c11 numbers in');
  push('docs/logs/m1/c11-final.md mean something relative to a floor.');
  push('');
  push(holdout3Rows === null ? 'holdout3: not present.' : `holdout3: present, ${holdout3Rows.length} rows.`);
  push(holdout4Rows === null ? 'holdout4: not present.' : `holdout4: present, ${holdout4Rows.length} rows.`);
  push('');

  push('## (a) Per-set summary');
  push('');
  for (const { name } of classifiers) {
    push(`### ${name}`);
    push('');
    push(mdTable(perSetByClassifier.get(name), summaryHeader));
    push('');
  }

  push('## (b) Tuned / reference / clean-exam');
  push('');
  push('tuned = camara + holdout1 + holdout3 (word lists were fitted on these;');
  push('D35 explicitly demotes hold-out 3 to a tuning set). reference = holdout2');
  push('(never used to choose a shape, D24, but scored repeatedly and carries a');
  push('recorded taint, D27 — not blind, not fitted on). clean-exam = holdout4');
  push('(Linode, Cloudflare, X; 210 rows; the only set scored once and never');
  push('fitted on, D35).');
  push('');
  push('clean-exam is the only honest transfer number — the headline should be');
  push('quoted from that row, not from tuned or reference.');
  push('tuned numbers are upper bounds, not evidence of transfer.');
  push('');
  {
    const [, n, exact, leaks, overTight, exactPct, leakPct, overTightPct] = cleanExamRowByClassifier.get('c11');
    push(`Headline (c11, clean-exam, n=${n}): ${exact} exact (${exactPct}%), ${leaks} leaks (${leakPct}%), ${overTight} over-tight (${overTightPct}%).`);
  }
  push('');
  for (const { name } of classifiers) {
    push(`### ${name}`);
    push('');
    push(mdTable(bucketByClassifier.get(name), bucketHeader));
    push('');
  }

  push('## (c) Negative controls');
  push('');
  push('Both must be x under c11.');
  push('');
  push(mdTable(controlsTable, ['classifier', 'control', 'class']));
  push('');
  push(controlsOk ? 'PASS — both controls x under c11.' : 'FAIL — at least one control did not come out x under c11.');
  push('');

  push('## (d) Evidence vs floor (c11)');
  push('');
  push('The floor bucket is the human review pile; locked rows (GET/HEAD/OPTIONS,');
  push('auto-r) never need review.');
  push('');
  push('### per set');
  push('');
  push(mdTable(reviewLoadTable, reviewLoadHeader));
  push('');
  push('### tuned / reference / clean-exam');
  push('');
  push(mdTable(reviewLoadBucketTable, reviewLoadBucketHeader));
  push('');

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD}`);

  if (!controlsOk) {
    console.error('ESCALATE: negative-control assertion failed under c11.');
    process.exit(1);
  }
}

main();
