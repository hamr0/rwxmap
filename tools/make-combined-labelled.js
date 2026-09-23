// Builds data/combined-2026-09-21/labelled.csv — the single labelled CSV for
// the D87 tuning set. Test/dev tooling only — never part of the published
// library.
//
// D87 truth currently lives scattered: rows.json.gz carries v1 truth (every
// row, source of truth for r rows since they were never relabelled) plus the
// nine relabel-2026-09-22/label/labels-*.csv files carry the v3 relabel of
// the 3852 non-r rows, with rulings.csv overriding the truth_class of a
// handful of disputed rows. This script reproduces the exact join semantics
// of poc/d87/readout.mjs's loadRows/loadV3Truth/attachTruth and writes ONE
// row per corpus row to a single CSV.
//
// TUNING DATA (D24) — never an exam, never a generalization claim. The
// burned M3 exam lives separately in data/exam-2026-09-22/labelled.csv and
// must never be concatenated with this file.
//
// Usage: node tools/make-combined-labelled.js [outPath]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { toCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data', 'combined-2026-09-21');
const DEFAULT_OUT = path.join(DIR, 'labelled.csv');

const PREFIX_TO_SOURCE_SET = {
  pc: 'provider-corpus-2026-09-16',
  x17: 'exam-2026-09-17',
  x20: 'exam-2026-09-20',
};

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

// --- load rows (v1 truth) ------------------------------------------------

function loadRows() {
  const gzPath = path.join(DIR, 'rows.json.gz');
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(gzPath)));
}

// --- load v3 relabel: class, confidence, reason ---------------------------
//
// Mirrors poc/d87/readout.mjs's loadV3Truth exactly for the truth_class
// join (labels-1..9.csv first, then rulings.csv overwrites truth_class for
// disputed rows). confidence/reason are NOT touched by rulings.csv — that
// file carries no confidence column, and its reason documents the dispute
// ruling rather than the original read; confidence/reason for every row
// come from the labels-*.csv entry, which exists for every rulings.csv row
// (verified below).

function loadV3Label() {
  const dir = path.join(ROOT, 'data', 'relabel-2026-09-22', 'label');
  const label = new Map(); // row_id -> { cls, confidence, reason }
  for (let i = 1; i <= 9; i += 1) {
    const p = path.join(dir, `labels-${i}.csv`);
    const lines = fs.readFileSync(p, 'utf8').trim().split('\n').slice(1);
    for (const l of lines) {
      const parts = l.split(',');
      const rowId = parts[0];
      const cls = parts[1];
      const confidence = parts[2];
      const reason = parts.slice(3).join(',');
      label.set(rowId, { cls, confidence, reason });
    }
  }

  const truth = new Map(); // row_id -> truth_class (post-ruling)
  for (const [rowId, v] of label) truth.set(rowId, v.cls);

  const rulingsPath = path.join(dir, 'rulings.csv');
  const rulingLines = fs.readFileSync(rulingsPath, 'utf8').trim().split('\n').slice(1);
  for (const l of rulingLines) {
    const parts = l.split(',');
    const rowId = parts[0];
    const ruling = parts[2];
    if (!label.has(rowId)) fail(`rulings.csv row ${rowId} has no labels-*.csv entry to source confidence/reason from`);
    truth.set(rowId, ruling);
  }

  return { label, truth };
}

function attachTruth(rows, v3) {
  for (const row of rows) {
    if (row.truth === 'r') {
      row.truthClass = 'r';
      row.confidence = '';
      row.reason = '';
      continue;
    }
    const cls = v3.truth.get(row.row_id);
    if (cls === undefined) fail(`no v3 label for non-r row ${row.row_id}`);
    if (!['r', 'w', 'x'].includes(cls)) fail(`row ${row.row_id} has invalid v3 label ${cls}`);
    row.truthClass = cls;
    const lbl = v3.label.get(row.row_id);
    row.confidence = lbl.confidence;
    row.reason = lbl.reason;
  }
}

// --- main ------------------------------------------------------------------

function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;

  const rows = loadRows();
  const v3 = loadV3Label();
  attachTruth(rows, v3);

  const seen = new Set();
  const prefixCounts = {};
  const csvRows = [];
  for (const row of rows) {
    if (seen.has(row.row_id)) fail(`duplicate row_id ${row.row_id}`);
    seen.add(row.row_id);

    if (row.truthClass.includes('?')) fail(`row ${row.row_id} truth_class contains "?": ${row.truthClass}`);
    if (!['r', 'w', 'x'].includes(row.truthClass)) fail(`row ${row.row_id} truth_class is not r/w/x: ${row.truthClass}`);

    const m = row.row_id.match(/^([a-z0-9]+)-/);
    const prefix = m ? m[1] : row.row_id;
    const sourceSet = PREFIX_TO_SOURCE_SET[prefix];
    if (sourceSet === undefined) fail(`row ${row.row_id} has unrecognized prefix "${prefix}"`);
    prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;

    csvRows.push({
      row_id: row.row_id,
      provider: row.provider,
      method: row.method,
      path: row.path,
      operationId: row.operationId,
      summary: row.summary,
      description: row.description,
      truth_class: row.truthClass,
      confidence: row.confidence,
      reason: row.reason,
      source_set: sourceSet,
    });
  }

  const header = [
    'row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description',
    'truth_class', 'confidence', 'reason', 'source_set',
  ];
  const csvText = toCsv(csvRows, header);
  fs.writeFileSync(outPath, csvText);

  // ---- assertions + report ----
  console.log(`wrote ${outPath}`);
  console.log(`rows: ${csvRows.length}`);
  if (csvRows.length !== 6557) fail(`expected 6557 rows, got ${csvRows.length}`);
  if (seen.size !== rows.length) fail('row_id uniqueness check failed');

  console.log('per-prefix counts:');
  for (const [prefix, count] of Object.entries(prefixCounts).sort()) {
    console.log(`  ${prefix} (${PREFIX_TO_SOURCE_SET[prefix]}): ${count}`);
  }

  const dist = { r: 0, w: 0, x: 0 };
  for (const r of csvRows) dist[r.truth_class] += 1;
  console.log(`class distribution: r=${dist.r} w=${dist.w} x=${dist.x}`);

  console.log('OK');
}

main();
