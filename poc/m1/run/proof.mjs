// Row-level proof of every goal's current number, one CSV per goal plus a
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
// A note on goal 2's verdict column vs its ledger number: the brief asks
// the CSV to also label a truth-x row predicted r as LEAK ("a truth-x row
// predicted r would be a leak too"), since r is an even further loosening
// than w. But the frozen goal-2 ledger figure (89 -> 37, matching
// measure.mjs's own GATE/NEW assertions) has only ever counted the
// predicted-w case — that is what "goal 2 leak = gt_class 'x', predicted
// 'w'" (this brief's own fixed definition) means, and it's what reproduces
// the numbers already committed to the repo. Measuring here: 13 truth-x
// rows are predicted r under BOTH the frozen baseline and the new shape —
// all 13 are GET rows sitting at the GET floor (rule 'floor', floor true;
// GET runs no word rules at all), untouched by either goal2.mjs or
// c20.mjs's noun layer — so this 13-row group is not a regression of this
// pass, it's a pre-existing, unchanged category. Those
// 13 rows ARE marked LEAK in goal2.csv (per the brief), but the "error
// count" printed in the ledger and in the per-goal breakdown stays the
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
import { toCsv, parseCsv } from '../../m0/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(REPO_ROOT, 'run-proof');

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

// --- load + classify, via core/corpus.mjs and run/pipeline.mjs ---------

const { rows: allRows, vendors, junkSet, allowlistFor, lowerVerbsFor, yoursNounsFor, frozenJunkSet, frozenAllowlistFor } = loadContext();
const ctx = { junkSet, allowlistFor, lowerVerbsFor, yoursNounsFor };

// --- classify every row, both shapes ------------------------------------
//
// Each goal's CSV is classified at that goal's OWN pipeline stage —
// goal2.csv at upTo 'goal2', goal1.csv at 'goal1', goal3.csv at 'goal3' —
// the same rule run/ledger.mjs's computeLedger already follows. A row is
// never classified further downstream than the goal whose CSV it is
// going into, so a later goal's layer (e.g. goal 1 starting to lower
// rows) can never leak into an earlier goal's ledger or CSV. "previous"
// replays the frozen c15 + C20 shape exactly as frozen (it has no
// per-goal stages), so it uses the frozen (raw, unsplit) junkSet/allowlist
// pair and is computed once, the same for every goal.
function withPrev(row) {
  const prev = classifyC20(row, frozenJunkSet, frozenAllowlistFor(row.vendor));
  return { row, prev };
}

const atGoal2 = allRows.map((row) => ({ ...withPrev(row), pred: classify(row, ctx, { upTo: 'goal2' }) }));
const atGoal1 = allRows.map((row) => ({ ...withPrev(row), pred: classify(row, ctx, { upTo: 'goal1' }) }));
const atGoal3 = allRows.map((row) => ({ ...withPrev(row), pred: classify(row, ctx, { upTo: 'goal3' }) }));

// --- per-goal CSV row shaping -------------------------------------------

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
function buildGoalCsv(records, verdictFn, errorFn) {
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

// goal 2: truth x, classified at upTo 'goal2'. verdict widens to LEAK for
// both predicted w and predicted r (see file header); the ledger/error-count
// stays the strict predicted-w-only definition (errorFn).
const goal2Records = atGoal2.filter((r) => r.row.gt_class === 'x');
const goal2 = buildGoalCsv(
  goal2Records,
  (cls) => (cls === 'w' || cls === 'r') ? 'LEAK' : 'ok',
  (cls) => cls === 'w',
);

// goal 1: truth w, classified at upTo 'goal1'. error = predicted x.
const goal1Records = atGoal1.filter((r) => r.row.gt_class === 'w');
const goal1 = buildGoalCsv(
  goal1Records,
  (cls) => (cls === 'x') ? 'FALSE-ALARM' : 'ok',
  (cls) => cls === 'x',
);

// goal 3: truth r, classified at upTo 'goal3'. error = predicted not r.
const goal3Records = atGoal3.filter((r) => r.row.gt_class === 'r');
const goal3 = buildGoalCsv(
  goal3Records,
  (cls) => (cls !== 'r') ? 'OVER-TIGHT' : 'ok',
  (cls) => cls !== 'r',
);

// --- ledger: computed, never typed ---------------------------------------

const ledger = [
  { goal: 'goal 2 (leak)', previous: goal2.prevErrorCount, current: goal2.errorCount },
  { goal: 'goal 1 (false alarm)', previous: goal1.prevErrorCount, current: goal1.errorCount },
  { goal: 'goal 3 (over-tight)', previous: goal3.prevErrorCount, current: goal3.errorCount },
];

const EXPECTED = [
  { previous: 89, current: 37 },
  { previous: 1936, current: 2531 },
  { previous: 49, current: 49 },
];

let ledgerMismatch = false;
ledger.forEach((row, i) => {
  const exp = EXPECTED[i];
  if (row.previous !== exp.previous || row.current !== exp.current) {
    console.error(`LEDGER MISMATCH: ${row.goal} computed previous=${row.previous} current=${row.current}, expected previous=${exp.previous} current=${exp.current}`);
    ledgerMismatch = true;
  }
});
if (ledgerMismatch) {
  escalate('computed ledger differs from the expected 89/37, 1936/2592, 49/49 — reporting the discrepancy, not correcting it.');
}

// --- write the three CSVs -------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });

const csvOut = {
  'goal2.csv': goal2,
  'goal1.csv': goal1,
  'goal3.csv': goal3,
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

const truthSplit = { r: goal3Records.length, w: goal1Records.length, x: goal2Records.length };
const runDate = new Date().toISOString().slice(0, 10);

const goal2ErrCls = (cls) => cls === 'w';
const goal1ErrCls = (cls) => cls === 'x';
const goal3ErrCls = (cls) => cls !== 'r';
const goal2LeakRExtra = goal2.rows.filter((r) => r.verdict === 'LEAK' && r.predicted === 'r').length;

const md = `# rwxmap row-level proof

## What this is

Row-level proof of every goal's current number: every truth-x, truth-w and
truth-r row, with its predicted class and verdict, next to what the
previously frozen shape would have predicted for the same row. Regenerate
with \`node poc/m1/run/proof.mjs\`.

## Corpus

${allRows.length} rows, ${vendors.length} vendors. Truth split: r=${truthSplit.r}, w=${truthSplit.w}, x=${truthSplit.x}.
Scored leave-one-vendor-out (each row scored against an allowlist built
from every OTHER vendor's rows). Allowlist bar: n>=2, w-share>=0.80.
Run date: ${runDate}.

## Ledger

| goal | error | previous frozen | current | delta |
|---|---|---|---|---|
| goal 2 | leak (truth x, predicted w) | ${ledger[0].previous} | ${ledger[0].current} | ${ledger[0].current - ledger[0].previous} |
| goal 1 | false alarm (truth w, predicted x) | ${ledger[1].previous} | ${ledger[1].current} | ${ledger[1].current - ledger[1].previous} |
| goal 3 | over-tight (truth r, predicted not r) | ${ledger[2].previous} | ${ledger[2].current} | ${ledger[2].current - ledger[2].previous} |

## How to read a CSV

- \`set\` — which labelled set the row came from.
- \`vendor\` — the API provider, leave-one-vendor-out unit.
- \`method\` — the HTTP method of the operation.
- \`operationId\` — the operation's id, as named in its spec.
- \`path\` — the operation's URL path template.
- \`summary\` — the operation's summary text, newlines flattened to spaces, truncated to 160 characters.
- \`truth\` — the ground-truth class (r/w/x) for this row.
- \`predicted\` — the class the current shape (classifyGoal2) assigns.
- \`rule\` — which rule inside the current shape fired.
- \`floor\` — true when no evidence fired and the row sits at its method's default class; the tool would flag a floor row for review.
- \`verdict\` — this goal's error label if this row is wrong, else \`ok\`. A \`LEAK\` is a safety cost (a wrong loosening). A \`FALSE-ALARM\` or \`OVER-TIGHT\` is a usability cost (a wrong tightening).
- \`previous_predicted\` / \`previous_verdict\` — the same two columns, but from the previously frozen shape (classifyC20 + c15), for comparison.

Note on goal2.csv specifically: a truth-x row predicted \`r\` is an even
further loosening than predicted \`w\`, so it is also marked \`LEAK\` in the
\`verdict\` column (${goal2LeakRExtra} such rows here, present under both the
current and the previous shape — all GET rows sitting at the GET floor,
unchanged by this pass, not a regression). The ledger's goal-2 number above stays the
frozen strict definition (predicted \`w\` only), matching the number already
committed to the repo.

## Per-goal breakdown

### goal2.csv — truth x (${goal2Records.length} rows)

- error count (predicted w, ledger definition): ${goal2.errorCount} (${pct(goal2.errorCount, goal2Records.length)})
- also marked LEAK in the table (predicted r, not in the ledger count): ${goal2LeakRExtra}
- errors by method: ${methodBreakdown(goal2.rows, goal2ErrCls)}
- errors that are floor rows: ${floorErrorCount(goal2.rows, goal2ErrCls)}
- distinct vendors among the errors: ${vendorErrorCount(goal2.rows, goal2ErrCls)}

### goal1.csv — truth w (${goal1Records.length} rows)

- error count (false alarms): ${goal1.errorCount} (${pct(goal1.errorCount, goal1Records.length)})
- errors by method: ${methodBreakdown(goal1.rows, goal1ErrCls)}
- errors that are floor rows: ${floorErrorCount(goal1.rows, goal1ErrCls)}
- distinct vendors among the errors: ${vendorErrorCount(goal1.rows, goal1ErrCls)}

### goal3.csv — truth r (${goal3Records.length} rows)

- error count (over-tight): ${goal3.errorCount} (${pct(goal3.errorCount, goal3Records.length)})
- errors by method: ${methodBreakdown(goal3.rows, goal3ErrCls)}
- errors that are floor rows: ${floorErrorCount(goal3.rows, goal3ErrCls)}
- distinct vendors among the errors: ${vendorErrorCount(goal3.rows, goal3ErrCls)}

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

const goal2Rows = checkCsvCount('goal2.csv', 936);
const goal1Rows = checkCsvCount('goal1.csv', 3883);
const goal3Rows = checkCsvCount('goal3.csv', 646);

function checkErrorCount(name, rows, errorFn, expected) {
  const actual = rows.filter((r) => errorFn(r)).length;
  const ok = actual === expected;
  selfCheckResults.push({ name, check: 'error count matches ledger', expected, actual, ok });
}

checkErrorCount('goal2.csv', goal2Rows, (r) => r.predicted === 'w' && r.truth === 'x', goal2.errorCount);
checkErrorCount('goal1.csv', goal1Rows, (r) => r.predicted === 'x' && r.truth === 'w', goal1.errorCount);
checkErrorCount('goal3.csv', goal3Rows, (r) => r.predicted !== 'r' && r.truth === 'r', goal3.errorCount);

const allSelfChecksPass = selfCheckResults.every((r) => r.ok);

// --- console report --------------------------------------------------------

console.log('rows', allRows.length, 'vendors', vendors.length);
console.log('');
console.log('LEDGER');
for (const row of ledger) console.log(`  ${row.goal}: previous=${row.previous} current=${row.current} delta=${row.current - row.previous}`);
console.log('');
console.log('goal2.csv rows', goal2.rows.length, 'error count', goal2.errorCount, '(plus', goal2LeakRExtra, 'predicted-r rows also marked LEAK, not in ledger count)');
console.log('goal1.csv rows', goal1.rows.length, 'error count', goal1.errorCount);
console.log('goal3.csv rows', goal3.rows.length, 'error count', goal3.errorCount);
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
