#!/usr/bin/env node
// The one row-level proof for poc/flow: loads the corpus, classifies every
// row, scores it, then writes run-proof/flow.csv (one row per corpus row)
// and run-proof/flow.md (the ledger + narrative). Run with
// `node poc/flow/proof.mjs`.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadRows } from './corpus.mjs';
import { buildContext, classifyRow, scoreRows } from './flow.mjs';
import { toCsv } from './csv.mjs';
import { PINS, pinDiffs, verdictFor } from './ledger.mjs';
import { OTHER_MIN_VENDORS, OTHER_MIN_DANGER_SHARE, YOURS_MIN_N, YOURS_MIN_W_SHARE } from './step2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const CSV_PATH = path.join(REPO_ROOT, 'run-proof/flow.csv');
const MD_PATH = path.join(REPO_ROOT, 'run-proof/flow.md');

const CSV_HEADER = ['set', 'vendor', 'method', 'path', 'operationId', 'summary', 'truth', 'step', 'class', 'rule', 'flag', 'verdict', 'reason'];

// Strength order for picking the ONE reason a row sits in the x-pile, when
// more than one of its nouns is blocking: the noun closest to clearing the
// yours bar wins ('between bars' beats 'too few rows' beats 'vendor-only').
const REASON_STRENGTH = { 'between bars': 3, 'too few rows': 2, 'vendor-only': 1 };
const REASON_ORDER = ['between bars', 'too few rows', 'vendor-only', 'no noun'];

// xPileReason(row, ctx): why classifyStep2 left this row in the x-pile.
// 'no noun' when the row carries no noun at all; otherwise look at the
// nouns NOT already admitted as "yours" for this vendor (the ones that
// blocked the all-yours rule) and grade each by ctx.yoursStatFor:
// n===0 -> 'vendor-only' (no other vendor ever wrote it), n<YOURS_MIN_N ->
// 'too few rows' (only one other-vendor row), else 'between bars' (2+
// other-vendor rows but under the 80% w-share bar). The row's reason is the
// strongest reason among its blocking nouns.
function xPileReason(row, ctx) {
  const nouns = ctx.nounsOf(row);
  if (nouns.size === 0) return 'no noun';
  const yoursNouns = ctx.yoursFor(row.vendor);
  let best = null;
  for (const n of nouns) {
    if (yoursNouns.has(n)) continue;
    const s = ctx.yoursStatFor(row.vendor, n);
    let r;
    if (s.n === 0) r = 'vendor-only';
    else if (s.n < YOURS_MIN_N) r = 'too few rows';
    else r = 'between bars';
    if (!best || REASON_STRENGTH[r] > REASON_STRENGTH[best]) best = r;
  }
  return best;
}

function flattenSummary(s) {
  const flat = String(s || '').replace(/[\n\t\r]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return flat.length > 160 ? flat.slice(0, 160) : flat;
}

function pct(n, total) {
  return total === 0 ? '0.0%' : `${(100 * n / total).toFixed(1)}%`;
}

function main() {
  const { rows, vendors } = loadRows();
  const ctx = buildContext(rows, vendors);

  const csvRows = [];
  // Tallies for "Where the rows sit": key = step|class|flag -> { total, r, w, x }
  const whereRows = new Map();
  // Tally for "Why a row sits in the x-pile": reason -> { total, r, w, x }
  const xPileReasons = new Map();

  for (const row of rows) {
    const result = classifyRow(row, ctx);
    const truth = row.gt_class;
    const verdict = verdictFor(result, truth);
    const reason = result.flag === 'x-pile' ? xPileReason(row, ctx) : '';

    csvRows.push({
      set: row.set,
      vendor: row.vendor,
      method: row.method,
      path: row.path,
      operationId: row.operationId,
      summary: flattenSummary(row.summary),
      truth,
      step: result.step,
      class: result.class,
      rule: result.rule,
      flag: result.flag,
      verdict,
      reason,
    });

    const key = [result.step, result.class, result.flag].join('|');
    if (!whereRows.has(key)) whereRows.set(key, { total: 0, r: 0, w: 0, x: 0 });
    const w = whereRows.get(key);
    w.total += 1;
    w[truth] += 1;

    if (reason) {
      if (!xPileReasons.has(reason)) xPileReasons.set(reason, { total: 0, r: 0, w: 0, x: 0 });
      const rt = xPileReasons.get(reason);
      rt.total += 1;
      rt[truth] += 1;
    }
  }

  const score = scoreRows(rows, ctx);
  const diffs = pinDiffs(score, rows.length, vendors.length);

  writeFileSync(CSV_PATH, toCsv(csvRows, CSV_HEADER));

  const truthR = rows.filter((r) => r.gt_class === 'r').length;
  const truthW = rows.filter((r) => r.gt_class === 'w').length;
  const truthX = rows.filter((r) => r.gt_class === 'x').length;

  const runDate = new Date().toISOString().slice(0, 10);

  const ledgerRows = [
    ['step 1', 'over-tight', String(score.step1.overTight), String(PINS.step1.overTight)],
    ['step 1', 'leaks (read-verb rule)', String(score.step1.leaks), String(PINS.step1.leaks)],
    ['GET floor', 'leaks (parked D59, charged to the floor)', String(score.floorGet.leaks), String(PINS.floorGet.leaks)],
    ['step 2', 'false alarms', String(score.step2.falseAlarms), String(PINS.step2.falseAlarms)],
    ['step 2', 'leaks', String(score.step2.leaks), String(PINS.step2.leaks)],
    ['step 2', 'x-pile rows', String(score.step2.xPile.rows), String(PINS.step2.xPile.rows)],
    ['step 2', 'x-pile leaks', String(score.step2.xPile.leaks), String(PINS.step2.xPile.leaks)],
    ['whole flow', 'exact', `${score.exact} (${pct(score.exact, rows.length)})`, `${PINS.exact} (${pct(PINS.exact, PINS.rows)})`],
    ['whole flow', 'leaks', `${score.leaks} (${pct(score.leaks, rows.length)})`, `${PINS.leaks} (${pct(PINS.leaks, PINS.rows)})`],
    ['whole flow', 'over-tight', `${score.overTight} (${pct(score.overTight, rows.length)})`, `${PINS.overTight} (${pct(PINS.overTight, PINS.rows)})`],
  ];

  const methodOrder = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const methodRows = methodOrder.map((m) => {
    const b = score.byMethod[m] || { n: 0, leaks: 0, overTight: 0 };
    return [m, String(b.n), String(b.leaks), String(b.overTight)];
  });

  const whereRowsSorted = [...whereRows.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const xPileReasonRows = REASON_ORDER
    .filter((r) => xPileReasons.has(r))
    .map((r) => [r, xPileReasons.get(r)]);
  const xPileReasonTotal = xPileReasonRows.reduce((acc, [, v]) => {
    acc.total += v.total; acc.r += v.r; acc.w += v.w; acc.x += v.x;
    return acc;
  }, { total: 0, r: 0, w: 0, x: 0 });
  if (xPileReasonTotal.total !== score.step2.xPile.rows) {
    throw new Error(`x-pile reasons sum to ${xPileReasonTotal.total}, expected ${score.step2.xPile.rows} (x-pile pin ${PINS.step2.xPile.rows})`);
  }

  const pinsLine = diffs.length === 0
    ? 'All pins hold.'
    : diffs.map((d) => `- ${d.name}: pinned ${d.pinned}, actual ${d.actual}`).join('\n');

  const md = `# rwxmap row-level proof

This is the row-by-row proof of poc/flow's classifier: every one of the
5465 corpus rows, run through \`classifyRow\`, with its truth class, the
step/rule/flag that decided it, and its verdict against truth. Regenerate
with \`node poc/flow/proof.mjs\`.

## Corpus

${rows.length} rows, ${vendors.length} vendors. Truth split: r ${truthR} (${pct(truthR, rows.length)}), w ${truthW} (${pct(truthW, rows.length)}), x ${truthX} (${pct(truthX, rows.length)}). Leave-one-vendor-out. Mining bars: other-party nouns admitted at >= ${OTHER_MIN_VENDORS} vendors and x-share >= ${OTHER_MIN_DANGER_SHARE} over PUT/DELETE/PATCH; yours nouns admitted at n >= ${YOURS_MIN_N} and w-share >= ${YOURS_MIN_W_SHARE} over write rows (every method but GET/HEAD/OPTIONS). Run date: ${runDate}.

## How the flow runs

- Step 1, r: every GET/HEAD/OPTIONS row is r; a POST whose lead verb is a read verb is r.
- Step 2, w: PUT/DELETE/PATCH rows start at w — a live verb raises to x, an other-party noun raises to x, every noun on the row being a "yours" noun keeps it w flagged "evidence", otherwise it stays w flagged "x-pile".
- Step 3, x: whatever step 1 and step 2 leave behind (POST with no read verb) floors to x.

## Ledger

| step | error | count | pin |
| --- | --- | --- | ---: |
${ledgerRows.map(([step, error, count, pin]) => `| ${step} | ${error} | ${count} | ${pin} |`).join('\n')}

## Per method

| method | n | leaks | over-tight |
| --- | ---: | ---: | ---: |
${methodRows.map(([m, n, l, o]) => `| ${m} | ${n} | ${l} | ${o} |`).join('\n')}

## Where the rows sit

| step | class | flag | rows | truth r | truth w | truth x |
| --- | --- | --- | ---: | ---: | ---: | ---: |
${whereRowsSorted.map(([key, v]) => {
  const [step, cls, flag] = key.split('|');
  return `| ${step} | ${cls} | ${flag || '(none)'} | ${v.total} | ${v.r} | ${v.w} | ${v.x} |`;
}).join('\n')}

## Why a row sits in the x-pile

Every x-pile row gets ONE reason: 'no noun' when the row carries no noun at
all; otherwise, among the row's nouns not already admitted as "yours" for
its vendor, the strongest reason wins ('between bars' beats 'too few rows'
beats 'vendor-only') — 'vendor-only' means no other vendor ever wrote that
noun on a write row (n=0), 'too few rows' means fewer than ${YOURS_MIN_N} other-vendor
write rows carried it (n<${YOURS_MIN_N}), 'between bars' means it had enough other-vendor
rows but its w-share fell short of ${YOURS_MIN_W_SHARE}.

| reason | rows | truth r | truth w | truth x | share of pile |
| --- | ---: | ---: | ---: | ---: | ---: |
${xPileReasonRows.map(([r, v]) => `| ${r} | ${v.total} | ${v.r} | ${v.w} | ${v.x} | ${pct(v.total, xPileReasonTotal.total)} |`).join('\n')}
| **total** | **${xPileReasonTotal.total}** | ${xPileReasonTotal.r} | ${xPileReasonTotal.w} | ${xPileReasonTotal.x} | 100.0% |

## CSV columns (run-proof/flow.csv)

- \`set\`: which labelled set the row comes from (camara, holdout1..5, exam2, exam3).
- \`vendor\`: the vendor/repo the row belongs to.
- \`method\`: the HTTP method.
- \`path\`: the operation's path.
- \`operationId\`: the operation's id, as given.
- \`summary\`: the operation's summary, flattened to one line and truncated to 160 chars.
- \`truth\`: the labelled ground-truth class (r/w/x).
- \`step\`: which flow step decided the row (1, 2, or 3).
- \`class\`: the class the flow assigned (r/w/x).
- \`rule\`: the rule within that step that fired.
- \`flag\`: the flag the rule left (\`evidence\`, \`x-pile\`, or empty).
- \`verdict\`: \`ok\`, \`LEAK\`, \`FALSE-ALARM\`, or \`OVER-TIGHT\` against truth.
- \`reason\`: for x-pile rows, why the row sits there (\`no noun\`, \`vendor-only\`, \`too few rows\`, \`between bars\`); empty for every other row.

## Pins

${pinsLine}
`;

  writeFileSync(MD_PATH, md);

  console.log('--- ledger ---');
  for (const [step, error, count, pin] of ledgerRows) {
    console.log(`${step} ${error}: ${count} (pin ${pin})`);
  }
  console.log('--- why a row sits in the x-pile ---');
  for (const [r, v] of xPileReasonRows) {
    console.log(`${r}: ${v.total} (r ${v.r}, w ${v.w}, x ${v.x}, ${pct(v.total, xPileReasonTotal.total)})`);
  }
  console.log(`total: ${xPileReasonTotal.total} (r ${xPileReasonTotal.r}, w ${xPileReasonTotal.w}, x ${xPileReasonTotal.x})`);
  console.log('--- pins ---');
  console.log(pinsLine);

  if (diffs.length > 0) {
    process.exit(1);
  }
}

main();
