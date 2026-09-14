// Row-level proof of every step's current number, one CSV per step plus a
// short markdown summary, written to run-proof/ at the repo root.
//
// Run: node poc/m1/run/proof.mjs
//
// Loads and classifies via core/corpus.mjs (loadContext) and
// run/pipeline.mjs (classify), the same leave-one-vendor-out setup
// measure.mjs uses — the corpus load itself lives only in corpus.mjs.
// Everything classification-side (the noun-table build/clean, the LOVO
// allowlist build, classifyC20, the pipeline layers) is imported, not
// reimplemented.
//
// A note on step 3's verdict column vs its ledger number: the brief asks
// the CSV to also label a truth-x row predicted r as LEAK ("a truth-x row
// predicted r would be a leak too"), since r is an even further loosening
// than w. But the frozen step-3 ledger figure (89 -> 37, matching
// measure.mjs's own GATE/NEW assertions) has only ever counted the
// predicted-w case — that is what "step 3 leak = gt_class 'x', predicted
// 'w'" (this brief's own fixed definition) means, and it's what reproduces
// the numbers already committed to the repo. Measuring here: 13 truth-x
// rows are predicted r under BOTH the frozen baseline and the new shape —
// all 13 are GET rows sitting at the GET floor (rule 'floor', floor true;
// GET runs no word rules at all), untouched by either step3.mjs or
// c20.mjs's noun layer — so this 13-row group is not a regression of this
// pass, it's a pre-existing, unchanged category. Those
// 13 rows ARE marked LEAK in step3.csv (per the brief), but the "error
// count" printed in the ledger and in the per-step breakdown stays the
// frozen strict definition (predicted w only), so it reproduces 37/89
// exactly and the self-check's CSV-count-equals-ledger-number assertion
// holds. The 13 extra rows are called out explicitly in the breakdown text
// below so nobody mistakes the CSV's visible LEAK count for the ledger
// number.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyC20 } from '../arbiter/c20.mjs';
import { loadContext } from './context.mjs';
import { classify } from './pipeline.mjs';
import { classifyStep2 } from '../step2/step2.mjs';
import { toCsv, parseCsv } from '../../m0/csv.mjs';

const STEP2_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(REPO_ROOT, 'run-proof');

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

// --- load + classify, via core/corpus.mjs and run/pipeline.mjs ---------

const { rows: allRows, vendors, junkSet, allowlistFor, otherNounsFor, frozenJunkSet, frozenAllowlistFor } = loadContext();
const ctx = { junkSet, allowlistFor };
const step2Ctx = { junkSet, otherNounsFor };

// --- classify every row, both shapes ------------------------------------
//
// step3.csv and step1.csv are classified at that step's OWN pipeline
// stage (upTo 'step3' / 'step3') — the same rule run/ledger.mjs's
// computeLedger already follows. step2.csv is NOT a pipeline stage: step
// 2 is its own standalone classifier (the user's ruling, 2026-09-13), so
// its rows are classified directly with classifyStep2, never chained
// through step 3's output. "previous" replays the frozen c15 + C20 shape
// exactly as frozen (it has no per-step stages), so it uses the frozen
// (raw, unsplit) junkSet/allowlist pair and is computed once, the same
// for every step.
function withPrev(row) {
  const prev = classifyC20(row, frozenJunkSet, frozenAllowlistFor(row.vendor));
  return { row, prev };
}

const atStep3 = allRows.map((row) => ({ ...withPrev(row), pred: classify(row, ctx, { upTo: 'step3' }) }));
const atStep2 = allRows.map((row) => ({ ...withPrev(row), pred: classifyStep2(row, step2Ctx) }));
const atStep1 = allRows.map((row) => ({ ...withPrev(row), pred: classify(row, ctx, { upTo: 'step3' }) }));

// --- per-step CSV row shaping -------------------------------------------

const CSV_HEADER = [
  'set', 'vendor', 'method', 'operationId', 'path', 'summary',
  'truth', 'predicted', 'rule', 'floor', 'verdict',
  'previous_predicted', 'previous_verdict',
];

function cleanSummary(s) {
  return (s || '').replace(/\r?\n/g, ' ').slice(0, 160);
}

// verdictFn(class) -> 'ok' | error-label, applied identically to the
// current and the previous-shape prediction so the two columns are
// directly comparable row by row.
function buildStepCsv(records, verdictFn, errorFn) {
  let errorCount = 0;
  let prevErrorCount = 0;
  const rows = records.map(({ row, pred, prev }) => {
    const verdict = verdictFn(pred.class);
    const previous_verdict = verdictFn(prev.class);
    if (errorFn(pred.class)) errorCount += 1;
    if (errorFn(prev.class)) prevErrorCount += 1;
    return {
      set: row.set,
      vendor: row.vendor,
      method: row.method,
      operationId: row.operationId || '',
      path: row.path || '',
      summary: cleanSummary(row.summary),
      truth: row.gt_class,
      predicted: pred.class,
      rule: pred.rule,
      floor: pred.floor === true ? 'true' : 'false',
      verdict,
      previous_predicted: prev.class,
      previous_verdict,
      _isError: verdict !== 'ok',
    };
  });
  rows.sort((a, b) => {
    const ae = a._isError ? 0 : 1;
    const be = b._isError ? 0 : 1;
    if (ae !== be) return ae - be;
    if (a.vendor !== b.vendor) return a.vendor < b.vendor ? -1 : 1;
    if (a.method !== b.method) return a.method < b.method ? -1 : 1;
    if (a.operationId !== b.operationId) return a.operationId < b.operationId ? -1 : 1;
    return 0;
  });
  return { rows, errorCount, prevErrorCount };
}

// step 3: truth x, classified at upTo 'step3'. verdict widens to LEAK for
// both predicted w and predicted r (see file header); the ledger/error-count
// stays the strict predicted-w-only definition (errorFn).
const step3Records = atStep3.filter((r) => r.row.gt_class === 'x');
const step3 = buildStepCsv(
  step3Records,
  (cls) => (cls === 'w' || cls === 'r') ? 'LEAK' : 'ok',
  (cls) => cls === 'w',
);

// step 2: truth w, classified by classifyStep2 directly (not a pipeline
// stage). Scoped to step 2's own raise-eligible methods (PUT/DELETE/
// PATCH) — classifyStep2 returns every other method's untouched floor,
// and a truth-w POST row sitting at the POST floor's default 'x' is a
// floor-level mismatch step 2 never produced or could fix, not its
// error to carry (matches the reference measurement, g1block.mjs, and
// run/ledger.mjs's own scoping). error = predicted x.
const step2Records = atStep2.filter((r) => r.row.gt_class === 'w' && STEP2_METHODS.has(r.row.method));
const step2 = buildStepCsv(
  step2Records,
  (cls) => (cls === 'x') ? 'FALSE-ALARM' : 'ok',
  (cls) => cls === 'x',
);
// The ledger's "previous" column for step 2 stays the historical,
// unscoped number (1936, matching the number already committed to the
// repo) — computed over every truth-w row under the frozen shape, not
// step 2's own PUT/DELETE/PATCH scoping (that scoping is specific to
// step 2's own classifier, not the frozen c15+C20 shape it is compared
// against).
const step2PrevUnscoped = atStep2
  .filter((r) => r.row.gt_class === 'w')
  .filter((r) => r.prev.class === 'x').length;

// step 2's own leaks (its ledger's other number): truth x rows, scoped
// the same way, predicted w by classifyStep2.
const step2LeakRecords = atStep2.filter((r) => r.row.gt_class === 'x' && STEP2_METHODS.has(r.row.method));
const step2Leaks = buildStepCsv(
  step2LeakRecords,
  (cls) => (cls === 'w') ? 'LEAK' : 'ok',
  (cls) => cls === 'w',
);

// step 1: truth r, classified at upTo 'step3'. error = predicted not r.
const step1Records = atStep1.filter((r) => r.row.gt_class === 'r');
const step1 = buildStepCsv(
  step1Records,
  (cls) => (cls !== 'r') ? 'OVER-TIGHT' : 'ok',
  (cls) => cls !== 'r',
);

// --- ledger: computed, never typed ---------------------------------------

const ledger = [
  { step: 'step 1 (r: over-tight)', previous: step1.prevErrorCount, current: step1.errorCount },
  { step: 'step 2 (w: false alarm)', previous: step2PrevUnscoped, current: step2.errorCount },
  { step: 'step 3 (x: leak)', previous: step3.prevErrorCount, current: step3.errorCount },
];

const EXPECTED = [
  { previous: 49, current: 49 },
  { previous: 1936, current: 803 },
  { previous: 89, current: 37 },
];

let ledgerMismatch = false;
ledger.forEach((row, i) => {
  const exp = EXPECTED[i];
  if (row.previous !== exp.previous || row.current !== exp.current) {
    console.error(`LEDGER MISMATCH: ${row.step} computed previous=${row.previous} current=${row.current}, expected previous=${exp.previous} current=${exp.current}`);
    ledgerMismatch = true;
  }
});
if (ledgerMismatch) {
  escalate('computed ledger differs from the expected 49/49, 1936/803, 89/37 — reporting the discrepancy, not correcting it.');
}

if (step2Leaks.errorCount !== 211) {
  escalate(`step 2 leaks computed ${step2Leaks.errorCount}, expected exactly 211 — old numbers do not reproduce`);
}

// --- write the three CSVs -------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });

const csvOut = {
  'step3.csv': step3,
  'step2.csv': step2,
  'step2-leaks.csv': step2Leaks,
  'step1.csv': step1,
};

for (const [name, data] of Object.entries(csvOut)) {
  const text = toCsv(data.rows, CSV_HEADER);
  writeFileSync(path.join(OUT_DIR, name), text);
}

// --- markdown summary -------------------------------------------------

function pct(n, d) {
  if (!d) return 'n/a';
  return `${(100 * n / d).toFixed(1)}%`;
}

function methodBreakdown(rows, errorPredCls) {
  const byMethod = {};
  for (const r of rows) {
    if (!errorPredCls(r.predicted)) continue;
    byMethod[r.method] = (byMethod[r.method] || 0) + 1;
  }
  return Object.entries(byMethod).sort((a, b) => b[1] - a[1])
    .map(([m, n]) => `${m}=${n}`).join(', ') || '(none)';
}

function floorErrorCount(rows, errorPredCls) {
  return rows.filter((r) => errorPredCls(r.predicted) && r.floor === 'true').length;
}

function vendorErrorCount(rows, errorPredCls) {
  return new Set(rows.filter((r) => errorPredCls(r.predicted)).map((r) => r.vendor)).size;
}

// Corpus-wide truth split, unscoped (step2Records/step2LeakRecords are
// scoped to step 2's own PUT/DELETE/PATCH population — see below).
const allTruthW = atStep2.filter((r) => r.row.gt_class === 'w').length;
const truthSplit = { r: step1Records.length, w: allTruthW, x: step3Records.length };
const runDate = new Date().toISOString().slice(0, 10);

const step3ErrCls = (cls) => cls === 'w';
const step2ErrCls = (cls) => cls === 'x';
const step2LeakErrCls = (cls) => cls === 'w';
const step1ErrCls = (cls) => cls !== 'r';
const step3LeakRExtra = step3.rows.filter((r) => r.verdict === 'LEAK' && r.predicted === 'r').length;

const md = `# rwxmap row-level proof

## What this is

Row-level proof of every step's current number: every truth-x, truth-w and
truth-r row, with its predicted class and verdict, next to what the
previously frozen shape would have predicted for the same row. Regenerate
with \`node poc/m1/run/proof.mjs\`.

## Corpus

${allRows.length} rows, ${vendors.length} vendors. Truth split: r=${truthSplit.r}, w=${truthSplit.w}, x=${truthSplit.x}.
Scored leave-one-vendor-out (each row scored against an allowlist built
from every OTHER vendor's rows). Allowlist bar: n>=2, w-share>=0.80.
Run date: ${runDate}.

## Ledger

| step | error | previous frozen | current | delta |
|---|---|---|---|---|
| step 1 | over-tight (truth r, predicted not r) | ${ledger[0].previous} | ${ledger[0].current} | ${ledger[0].current - ledger[0].previous} |
| step 2 | false alarm (truth w, predicted x) | ${ledger[1].previous} | ${ledger[1].current} | ${ledger[1].current - ledger[1].previous} |
| step 3 | leak (truth x, predicted w) | ${ledger[2].previous} | ${ledger[2].current} | ${ledger[2].current - ledger[2].previous} |
| step 2 (info) | leak (truth x, predicted w, step 2's own classifier) | ${step2Leaks.prevErrorCount} | ${step2Leaks.errorCount} | ${step2Leaks.errorCount - step2Leaks.prevErrorCount} |

## How to read a CSV

- \`set\` — which labelled set the row came from.
- \`vendor\` — the API provider, leave-one-vendor-out unit.
- \`method\` — the HTTP method of the operation.
- \`operationId\` — the operation's id, as named in its spec.
- \`path\` — the operation's URL path template.
- \`summary\` — the operation's summary text, newlines flattened to spaces, truncated to 160 characters.
- \`truth\` — the ground-truth class (r/w/x) for this row.
- \`predicted\` — the class the current shape (classifyStep3) assigns.
- \`rule\` — which rule inside the current shape fired.
- \`floor\` — true when no evidence fired and the row sits at its method's default class; the tool would flag a floor row for review.
- \`verdict\` — this step's error label if this row is wrong, else \`ok\`. A \`LEAK\` is a safety cost (a wrong loosening). A \`FALSE-ALARM\` or \`OVER-TIGHT\` is a usability cost (a wrong tightening).
- \`previous_predicted\` / \`previous_verdict\` — the same two columns, but from the previously frozen shape (classifyC20 + c15), for comparison.

Note on step3.csv specifically: a truth-x row predicted \`r\` is an even
further loosening than predicted \`w\`, so it is also marked \`LEAK\` in the
\`verdict\` column (${step3LeakRExtra} such rows here, present under both the
current and the previous shape — all GET rows sitting at the GET floor,
unchanged by this pass, not a regression). The ledger's step-3 number above stays the
frozen strict definition (predicted \`w\` only), matching the number already
committed to the repo.

## Per-step breakdown

### step3.csv — truth x (${step3Records.length} rows)

- error count (predicted w, ledger definition): ${step3.errorCount} (${pct(step3.errorCount, step3Records.length)})
- also marked LEAK in the table (predicted r, not in the ledger count): ${step3LeakRExtra}
- errors by method: ${methodBreakdown(step3.rows, step3ErrCls)}
- errors that are floor rows: ${floorErrorCount(step3.rows, step3ErrCls)}
- distinct vendors among the errors: ${vendorErrorCount(step3.rows, step3ErrCls)}

### step2.csv — truth w, PUT/DELETE/PATCH only (${step2Records.length} of ${allTruthW} truth-w rows)

Step 2 is a standalone classifier (its own live-verb list, then its own
other-party noun list), scored only on the methods it classifies — a
truth-w POST/GET/HEAD/OPTIONS row is excluded here, since step 2 never
touches it (classifyStep2 returns that row's untouched method floor).

- error count (false alarms): ${step2.errorCount} (${pct(step2.errorCount, step2Records.length)})
- errors by method: ${methodBreakdown(step2.rows, step2ErrCls)}
- errors that are floor rows: ${floorErrorCount(step2.rows, step2ErrCls)}
- distinct vendors among the errors: ${vendorErrorCount(step2.rows, step2ErrCls)}

### step2-leaks.csv — truth x, PUT/DELETE/PATCH only (${step2LeakRecords.length} rows)

Step 2's other ledger number: truth-x rows its own classifier predicts w.

- error count (leaks): ${step2Leaks.errorCount} (${pct(step2Leaks.errorCount, step2LeakRecords.length)})
- errors by method: ${methodBreakdown(step2Leaks.rows, step2LeakErrCls)}
- errors that are floor rows: ${floorErrorCount(step2Leaks.rows, step2LeakErrCls)}
- distinct vendors among the errors: ${vendorErrorCount(step2Leaks.rows, step2LeakErrCls)}

### step1.csv — truth r (${step1Records.length} rows)

- error count (over-tight): ${step1.errorCount} (${pct(step1.errorCount, step1Records.length)})
- errors by method: ${methodBreakdown(step1.rows, step1ErrCls)}
- errors that are floor rows: ${floorErrorCount(step1.rows, step1ErrCls)}
- distinct vendors among the errors: ${vendorErrorCount(step1.rows, step1ErrCls)}

## Shape

- floor by method: GET/HEAD/OPTIONS -> r, POST -> x, PUT/DELETE/PATCH -> w.
- verbs: a POST read-verb lowers to r; a PUT/DELETE/PATCH live-verb raises to x.
- yours-nouns: on a raise-only method left at the w floor, every extracted noun on the vendor's leave-one-vendor-out allowlist keeps it at w, otherwise it raises to x ("no-own-noun").

Full spec: \`docs/product/goal2-solution.md\`.
`;

writeFileSync(path.join(OUT_DIR, 'rwxmap-runs.md'), md);

// --- self-check: re-read every CSV, verify counts ------------------------

const selfCheckResults = [];

function checkCsvCount(name, expectedTotal) {
  const text = readFileSync(path.join(OUT_DIR, name), 'utf8');
  const rows = parseCsv(text);
  const ok = rows.length === expectedTotal;
  selfCheckResults.push({ name, check: 'row count', expected: expectedTotal, actual: rows.length, ok });
  return rows;
}

const step3Rows = checkCsvCount('step3.csv', 936);
const step2Rows = checkCsvCount('step2.csv', 3776);
const step2LeaksRows = checkCsvCount('step2-leaks.csv', 605);
const step1Rows = checkCsvCount('step1.csv', 646);

function checkErrorCount(name, rows, errorFn, expected) {
  const actual = rows.filter((r) => errorFn(r)).length;
  const ok = actual === expected;
  selfCheckResults.push({ name, check: 'error count matches ledger', expected, actual, ok });
}

checkErrorCount('step3.csv', step3Rows, (r) => r.predicted === 'w' && r.truth === 'x', step3.errorCount);
checkErrorCount('step2.csv', step2Rows, (r) => r.predicted === 'x' && r.truth === 'w', step2.errorCount);
checkErrorCount('step2-leaks.csv', step2LeaksRows, (r) => r.predicted === 'w' && r.truth === 'x', step2Leaks.errorCount);
checkErrorCount('step1.csv', step1Rows, (r) => r.predicted !== 'r' && r.truth === 'r', step1.errorCount);

const allSelfChecksPass = selfCheckResults.every((r) => r.ok);

// --- console report --------------------------------------------------------

console.log('rows', allRows.length, 'vendors', vendors.length);
console.log('');
console.log('LEDGER');
for (const row of ledger) console.log(`  ${row.step}: previous=${row.previous} current=${row.current} delta=${row.current - row.previous}`);
console.log('');
console.log('step3.csv rows', step3.rows.length, 'error count', step3.errorCount, '(plus', step3LeakRExtra, 'predicted-r rows also marked LEAK, not in ledger count)');
console.log('step2.csv rows', step2.rows.length, 'error count', step2.errorCount);
console.log('step1.csv rows', step1.rows.length, 'error count', step1.errorCount);
console.log('');
console.log('SELF-CHECK');
for (const r of selfCheckResults) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.name} ${r.check}: expected ${r.expected}, actual ${r.actual}`);
}
if (!allSelfChecksPass) {
  escalate('self-check failed — see FAIL lines above.');
}
console.log('');
console.log('wrote', OUT_DIR);
