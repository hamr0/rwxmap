// Exam scorer for the M3 clean exam data/exam-2026-09-22. Test/dev tooling
// only — never part of the published library.
//
// This scores the clean exam ONCE (D24). Cloudflare, PagerDuty and Sentry —
// 4279 operations across three complete official APIs the rules never saw
// before labelling. Once scored, it is BURNED: a rule change from here
// needs a new exam, never a re-score of this one.
//
// Truth is data/exam-2026-09-22/labelled.csv (the ten blind labels-N.csv
// files joined to ops.csv, with the two D93 user rulings from
// data/exam-2026-09-22/label/rulings.csv applied on top — see
// tools/build-labelled.mjs-equivalent logic that produced that file).
//
// The classifier is called from src/ directly (classifyRow, src/flow.js);
// no rule logic is copied here and no expected score is hard-coded anywhere.
//
// MECHANICAL ONLY. This exam has no Jev answers of its own — the only Jev
// answers on disk (data/jev-2026-09-22/) are floor-post rows drawn from the
// COMBINED tuning set, not from this exam, and must not be used here. The
// with-Jev score for this exam is a separate pass pending answer collection
// over this exam's own floor rows. This script prints mechanical results
// only; applyJev() below is wired for that future pass and is never called.
//
// Ledger conventions follow tools/score-exam.js / tools/score-combined-2026-09-21.js:
// exact / leak / over-tight, counts AND percentages with the denominator
// named in the same line, never collapsed into one accuracy number, order
// r < w < x.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from './csv.js';
import { classifyRow } from '../src/flow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DIR = path.join(REPO_ROOT, 'data/exam-2026-09-22');
const LABELLED_CSV = path.join(DIR, 'labelled.csv');

const EXPECTED_ROWS = 4279;
const CLASSES = ['r', 'w', 'x'];
const ORDER = { r: 0, w: 1, x: 2 };
const METHOD_ORDER = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const PROVIDER_ORDER = ['cloudflare', 'pagerduty', 'sentry'];

// D89 gate item 1 (docs/product/prd.md): leaks on evidence: list rows at
// or under 2 per 100 list rows, every one listed.
const GATE1_MAX_PER_100 = 2;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------- loading

function loadRows() {
  const text = readFileSync(LABELLED_CSV, 'utf8');
  const csvRows = parseCsv(text);
  if (csvRows.length !== EXPECTED_ROWS) {
    fail(`labelled.csv has ${csvRows.length} rows, expected ${EXPECTED_ROWS}`);
  }

  const seen = new Set();
  const rows = [];
  for (const r of csvRows) {
    const id = (r.row_id || '').trim();
    if (!id) fail('labelled.csv has a row with no row_id');
    if (seen.has(id)) fail(`labelled.csv lists row ${id} twice`);
    seen.add(id);

    const truth = (r.truth_class || '').trim();
    if (!CLASSES.includes(truth)) {
      fail(`row ${id}: truth_class "${truth}" is not r/w/x — labelled.csv must carry no unresolved '?'`);
    }

    const op = {
      method: r.method || '',
      path: r.path || '',
      operationId: r.operationId || '',
      summary: r.summary || '',
      description: r.description || '',
    };
    const verdict = classifyRow(op);
    if (!CLASSES.includes(verdict.class)) {
      fail(`classifyRow gave row ${id} class ${JSON.stringify(verdict.class)}`);
    }

    rows.push({
      row_id: id,
      provider: r.provider || '',
      method: r.method || '',
      operationId: r.operationId || '',
      truth,
      predicted: verdict.class,
      step: verdict.step,
      rule: verdict.rule,
      source: verdict.source,
      matched: (verdict.matched || []).join('+'),
    });
  }
  if (seen.size !== EXPECTED_ROWS) fail(`labelled.csv covers ${seen.size} unique row_ids, expected ${EXPECTED_ROWS}`);
  return rows;
}

// --------------------------------------------------------------- counting

function verdict(pred, truth) {
  if (pred === truth) return 'exact';
  return ORDER[pred] < ORDER[truth] ? 'leak' : 'over-tight';
}

function pct(n, d) {
  if (d === 0) return `${n} / 0 (n/a)`;
  return `${n} / ${d} (${((n / d) * 100).toFixed(1)}%)`;
}

function tally(rows) {
  const t = { rows: rows.length, exact: 0, leak: 0, 'over-tight': 0 };
  for (const r of rows) t[verdict(r.predicted, r.truth)]++;
  return t;
}

function line(label, t, width = 22) {
  return `  ${label.padEnd(width)} rows ${String(t.rows).padStart(5)}   exact ${pct(t.exact, t.rows).padEnd(20)} leaks ${pct(t.leak, t.rows).padEnd(20)} over-tight ${pct(t['over-tight'], t.rows)}`;
}

function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

function bySort(order) {
  return (a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : a > b ? 1 : 0);
  };
}

// --------------------------------------------------------- future: Jev
//
// NOT CALLED TODAY. This exam has no Jev answers file (data/jev-2026-09-22/
// holds floor-post rows drawn from the COMBINED tuning set only, not from
// this exam). Once an answers file exists for this exam's own floor-post
// rows (mirroring data/jev-2026-09-20 / data/jev-2026-09-22's shape —
// row_id keyed, answers.isX.noul or similar), wire it in here. It must
// only ever LOWER a 'floor-post' x verdict to w (D88), never raise, never
// touch a row any other rule already decided.
function applyJev(_rows, _answersById) {
  throw new Error('applyJev is not wired to any answers file yet — this exam has no Jev pass. Do not call this.');
}

// ------------------------------------------------------------------- main

const rows = loadRows();

const providersSeen = [...new Set(rows.map((r) => r.provider))].sort(bySort(PROVIDER_ORDER));
const methodsSeen = [...new Set(rows.map((r) => r.method))].sort(bySort(METHOD_ORDER));

const out = [];
const say = (s = '') => out.push(s);

// --------------------------------------------------------------- 1. header
say('====================================================================');
say('M3 CLEAN EXAM — data/exam-2026-09-22 — SCORED ONCE, BURNED (D24)');
say('====================================================================');
say('3 complete official provider APIs never previously labelled: cloudflare,');
say('pagerduty, sentry — 4279 operations total. A rule change from here needs');
say('a NEW exam, never a re-score of this one.');
say();
say("Classes r < w < x. leak = predicted looser than truth (under-classification,");
say('the security-cost / go-no-go direction). over-tight = predicted tighter than');
say('truth (over-classification, a usability cost). The two are counted and');
say('reported separately, never collapsed into one accuracy number.');
say();
say('MECHANICAL ONLY (no Jev). This exam has no Jev answers of its own; the');
say('with-Jev score is a separate pass pending answer collection over this');
say("exam's own floor rows (see applyJev() in this file — not run here).");
say();

// --------------------------------------------------------- 2. whole flow
say('1. WHOLE-FLOW MECHANICAL LEDGER — all 4279 rows');
say(line('all rows', tally(rows)));
say();

// -------------------------------------------------------------- 3. vendor
say('2. PER VENDOR');
say('   cloudflare is 84% of the rows (3575 of 4279) — the pooled line above');
say('   must never be quoted alone; read each vendor line, cloudflare included.');
for (const p of providersSeen) {
  const sel = rows.filter((r) => r.provider === p);
  say(line(`${p} (n=${sel.length})`, tally(sel)));
}
say();

// -------------------------------------------------------------- 4. method
say('3. PER METHOD');
for (const m of methodsSeen) {
  const sel = rows.filter((r) => r.method === m);
  say(line(`${m} (n=${sel.length})`, tally(sel)));
}
say();

// ----------------------------------------------------------- 5. evidence
say('4. EVIDENCE vs FLOOR (source = list means a word list fired; floor means');
say('   the HTTP method alone decided with no word evidence — D77)');
const evidence = rows.filter((r) => r.source === 'list');
const floor = rows.filter((r) => r.source === 'floor');
const other = rows.filter((r) => r.source !== 'list' && r.source !== 'floor');
const tWhole = tally(rows);
say(line('evidence (source=list)', tally(evidence)));
say(line('floor (source=floor)', tally(floor)));
if (other.length) say(line('other sources', tally(other)));
say(`  leaks on evidence rows: ${pct(tally(evidence).leak, tWhole.leak)} of all leaks`);
say(`  leaks on floor rows:    ${pct(tally(floor).leak, tWhole.leak)} of all leaks`);
say();

// ----------------------------------------------------------- 6. leak list
const leaks = rows.filter((r) => verdict(r.predicted, r.truth) === 'leak');
say(`5. LEAK DETAIL — every one of ${leaks.length} leak rows, untruncated`);
if (leaks.length === 0) say('  (none)');
for (const r of leaks) {
  say(`  ${r.row_id}  ${r.provider}  ${r.method}  operationId ${r.operationId}`);
  say(`      predicted ${r.predicted}  truth ${r.truth}   step ${r.step}  rule ${r.rule}  source ${r.source}  matched "${r.matched}"`);
}
say();

// ------------------------------------------------------------ 7. gate
say('6. D89 GATE ITEM 1 — leaks on list rows at or under 2 per 100 list rows,');
say('   every one listed. (Items 2-4 are not printed here: the PRD states them');
say("   against a different pre-registered exam's rulings and this script does");
say('   not invent numbers for them against this exam.)');
const listLeaks = evidence.filter((r) => verdict(r.predicted, r.truth) === 'leak');
const listRate = evidence.length === 0 ? 0 : (listLeaks.length / evidence.length) * 100;
say(`   list rows: ${evidence.length}`);
say(`   leaks on list rows: ${listLeaks.length}`);
say(`   rate: ${listRate.toFixed(2)} per 100 list rows (bar: <= ${GATE1_MAX_PER_100} per 100)`);
say(`   gate item 1: ${listRate <= GATE1_MAX_PER_100 ? 'PASS' : 'FAIL'}`);
if (listLeaks.length > 0) {
  say('   list-row leaks, individually:');
  for (const r of listLeaks) {
    say(`     ${r.row_id}  ${r.provider}  ${r.method}  predicted ${r.predicted} truth ${r.truth}  rule ${r.rule}  matched "${r.matched}"`);
  }
} else {
  say('   (no list-row leaks)');
}
say();

console.log(out.join('\n'));
