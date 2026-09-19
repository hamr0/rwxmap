#!/usr/bin/env node
// Runner for the per-document vendor-profile steer POC. Loads the build
// set (data/buildset-2026-09-18/ops.csv.gz) joined to its 9 blind-labeller
// truth files, drops the 2 '?' rows, then prints six blocks: baselines,
// per-vendor profile scores, a fitted threshold sweep, leave-one-vendor-out,
// an evidence-flag measurement, and a blunt-raise comparison.
//
// Imports parseCsv from ../../tools/csv.js (the only outside import this
// POC allows). The pure modules (profile.mjs, score.mjs, signal.mjs)
// import nothing outside this directory.

import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { parseCsv } from '../../tools/csv.js';
import { SIGNAL_WORDS } from './signal.mjs';
import { profileScore, steeredFloor } from './profile.mjs';
import { tally } from './score.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'buildset-2026-09-18');
const OPS_GZ = path.join(DATA_DIR, 'ops.csv.gz');
const LABEL_DIR = path.join(DATA_DIR, 'label');
const NUM_LABELLERS = 9;

const WRITE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);
const THRESHOLDS = [];
for (let t = 0.10; t <= 0.9000001; t += 0.05) THRESHOLDS.push(Math.round(t * 100) / 100);

function pad4(n) {
  return String(n).padStart(4, '0');
}

function vendorLabel(provider) {
  return String(provider).split('.')[0];
}

function pct(n, d) {
  return d === 0 ? '0.0' : ((n / d) * 100).toFixed(1);
}

function fmtTally(t, label) {
  return (
    `${label}: exact ${t.exact}/${t.n} (${pct(t.exact, t.n)}%), ` +
    `leaks ${t.leaks}/${t.n} (${pct(t.leaks, t.n)}%), ` +
    `over-tight ${t.overTight}/${t.n} (${pct(t.overTight, t.n)}%)`
  );
}

function loadOps() {
  const gz = readFileSync(OPS_GZ);
  const text = gunzipSync(gz).toString('utf8');
  const rows = parseCsv(text);
  rows.forEach((row, i) => {
    row.row_id = 'b' + pad4(i + 1);
  });
  return rows;
}

function loadTruth() {
  const truth = new Map();
  for (let i = 1; i <= NUM_LABELLERS; i++) {
    const text = readFileSync(path.join(LABEL_DIR, `labels-${i}.csv`), 'utf8');
    const rows = parseCsv(text);
    for (const row of rows) {
      truth.set(row.row_id, row.truth_class);
    }
  }
  return truth;
}

// Whole-word, case-insensitive check across path+operationId+summary+description
// (the full row, not just the rowTokens fields) — used only for the
// evidence-flag measurement in block 5, not for classification.
function rowHasNoSignalWordAnywhere(row) {
  const text = `${row.path || ''} ${row.operationId || ''} ${row.summary || ''} ${row.description || ''}`.toLowerCase();
  return !SIGNAL_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(text));
}

function main() {
  const allOps = loadOps();
  const truth = loadTruth();

  allOps.forEach((row) => {
    row.truth_class = truth.get(row.row_id) || '';
  });

  const workingRows = allOps.filter((row) => row.truth_class !== '?' && row.truth_class !== '');
  console.log(`loaded ${allOps.length} ops rows, ${workingRows.length} scoreable after dropping '?' rows`);
  console.log('');

  // Per-vendor profile score, computed from ALL ops rows for that provider
  // (spec text only — never touches truth_class).
  const vendors = Array.from(new Set(allOps.map((r) => r.provider))).sort();
  const vendorRows = new Map();
  for (const v of vendors) vendorRows.set(v, allOps.filter((r) => r.provider === v));
  const vendorScore = new Map();
  for (const v of vendors) vendorScore.set(v, profileScore(vendorRows.get(v)));

  function floorPredict(row) {
    return steeredFloor(row.method, 0, 2); // threshold > 1 => original floor, unsteered
  }
  function steeredPredict(row, threshold) {
    return steeredFloor(row.method, vendorScore.get(row.provider), threshold);
  }
  function bluntPredict(row) {
    return steeredFloor(row.method, 0, 0); // threshold 0 => PUT/DELETE/PATCH always x
  }

  // ---- 1. BASELINES ----
  console.log('=== 1. BASELINES (all ' + workingRows.length + ' scoreable rows) ===');
  const floorTally = tally(workingRows.map(floorPredict), workingRows.map((r) => r.truth_class));
  console.log(fmtTally(floorTally, 'method floor only'));
  const allXTally = tally(workingRows.map(() => 'x'), workingRows.map((r) => r.truth_class));
  console.log(fmtTally(allXTally, 'all-x'));
  console.log('');

  // ---- 2. PROFILE SCORES ----
  console.log('=== 2. PROFILE SCORES (per vendor, sorted by profileScore desc) ===');
  console.log(
    'vendor'.padEnd(16),
    'ops seen'.padStart(9),
    'profileScore'.padStart(13),
    '  truth PUT/DELETE/PATCH x-share (not used by the profile)'
  );
  const vendorRowsWorking = new Map();
  for (const v of vendors) vendorRowsWorking.set(v, workingRows.filter((r) => r.provider === v));
  const vendorTruthXShare = new Map();
  for (const v of vendors) {
    const writeRows = vendorRowsWorking.get(v).filter((r) => WRITE_METHODS.has(r.method));
    const xCount = writeRows.filter((r) => r.truth_class === 'x').length;
    vendorTruthXShare.set(v, writeRows.length === 0 ? 0 : xCount / writeRows.length);
  }
  const sortedByScore = [...vendors].sort((a, b) => vendorScore.get(b) - vendorScore.get(a));
  for (const v of sortedByScore) {
    console.log(
      vendorLabel(v).padEnd(16),
      String(vendorRows.get(v).length).padStart(9),
      vendorScore.get(v).toFixed(3).padStart(13),
      '  ' + (vendorTruthXShare.get(v) * 100).toFixed(1) + '%'
    );
  }
  console.log('');

  // ---- 3. THRESHOLD SWEEP, FITTED ----
  console.log('=== 3. THRESHOLD SWEEP, FITTED (all ' + workingRows.length + ' rows, threshold applied globally) ===');
  console.log(
    'threshold'.padStart(9),
    'exact%'.padStart(8),
    'leaks (n/%)'.padStart(16),
    'over-tight (n/%)'.padStart(20),
    'vendors steered'.padStart(16)
  );
  for (const t of THRESHOLDS) {
    const preds = workingRows.map((r) => steeredPredict(r, t));
    const tl = tally(preds, workingRows.map((r) => r.truth_class));
    const steeredVendors = vendors.filter((v) => vendorScore.get(v) >= t).length;
    console.log(
      t.toFixed(2).padStart(9),
      pct(tl.exact, tl.n).padStart(8),
      `${tl.leaks}/${pct(tl.leaks, tl.n)}%`.padStart(16),
      `${tl.overTight}/${pct(tl.overTight, tl.n)}%`.padStart(20),
      String(steeredVendors).padStart(16)
    );
  }
  console.log('');

  // ---- 4. LEAVE-ONE-VENDOR-OUT ----
  console.log('=== 4. LEAVE-ONE-VENDOR-OUT ===');
  console.log(
    'vendor'.padEnd(16),
    'chosen thr'.padStart(10),
    'score'.padStart(7),
    'steered'.padStart(8),
    'before(leaks/overTight)'.padStart(24),
    'after(leaks/overTight)'.padStart(24)
  );
  let lovoTotal = { n: 0, exact: 0, leaks: 0, overTight: 0 };
  let lovoFloorTotal = { n: 0, exact: 0, leaks: 0, overTight: 0 };
  for (const heldOut of vendors) {
    const otherRows = workingRows.filter((r) => r.provider !== heldOut);
    let bestT = null;
    let bestExactPct = -1;
    for (const t of THRESHOLDS) {
      const preds = otherRows.map((r) => steeredPredict(r, t));
      const tl = tally(preds, otherRows.map((r) => r.truth_class));
      const exactPct = tl.n === 0 ? 0 : tl.exact / tl.n;
      // tie -> higher threshold (steers fewer vendors): >= keeps updating on ties
      if (exactPct >= bestExactPct) {
        bestExactPct = exactPct;
        bestT = t;
      }
    }
    const heldRows = workingRows.filter((r) => r.provider === heldOut);
    const before = tally(heldRows.map(floorPredict), heldRows.map((r) => r.truth_class));
    const after = tally(
      heldRows.map((r) => steeredPredict(r, bestT)),
      heldRows.map((r) => r.truth_class)
    );
    const steered = vendorScore.get(heldOut) >= bestT;
    console.log(
      vendorLabel(heldOut).padEnd(16),
      bestT.toFixed(2).padStart(10),
      vendorScore.get(heldOut).toFixed(3).padStart(7),
      String(steered).padStart(8),
      `${before.leaks}/${before.overTight}`.padStart(24),
      `${after.leaks}/${after.overTight}`.padStart(24)
    );
    lovoTotal.n += after.n;
    lovoTotal.exact += after.exact;
    lovoTotal.leaks += after.leaks;
    lovoTotal.overTight += after.overTight;
    lovoFloorTotal.n += before.n;
    lovoFloorTotal.exact += before.exact;
    lovoFloorTotal.leaks += before.leaks;
    lovoFloorTotal.overTight += before.overTight;
  }
  console.log('');
  console.log(fmtTally(lovoFloorTotal, 'LOVO TOTAL, method-floor baseline (same rows)'));
  console.log(fmtTally(lovoTotal, 'LOVO TOTAL, steered (own-vendor threshold, own-vendor profileScore)'));
  console.log('');

  // ---- 5. OPTION 2 — EVIDENCE FLAG ----
  console.log('=== 5. OPTION 2: EVIDENCE FLAG ===');
  const writeRows = workingRows.filter((r) => WRITE_METHODS.has(r.method));
  const wordlessWrite = writeRows.filter(rowHasNoSignalWordAnywhere);
  console.log(
    `PUT/DELETE/PATCH rows: ${writeRows.length}, wordless (no SIGNAL_WORD anywhere in the row): ` +
      `${wordlessWrite.length} (${pct(wordlessWrite.length, writeRows.length)}%)`
  );
  const floorLeakRows = workingRows.filter((r) => floorPredict(r) === 'w' && r.truth_class === 'x');
  const wordlessLeakRows = floorLeakRows.filter(rowHasNoSignalWordAnywhere);
  console.log(
    `method-floor leaks: ${floorLeakRows.length}, of which wordless: ${wordlessLeakRows.length} ` +
      `(${pct(wordlessLeakRows.length, floorLeakRows.length)}% of all leaks)`
  );
  console.log('This changes no class; it measures how much of the damage a "no evidence" flag would mark.');
  console.log('');

  // ---- 6. OPTION 3 — BLUNT RAISE ----
  console.log('=== 6. OPTION 3: BLUNT RAISE (PUT/DELETE/PATCH -> x for everyone, no profile) ===');
  const bluntTally = tally(workingRows.map(bluntPredict), workingRows.map((r) => r.truth_class));
  console.log(fmtTally(bluntTally, 'blunt raise'));
  console.log('(compare directly against blocks 3 and 4 above)');
}

main();
