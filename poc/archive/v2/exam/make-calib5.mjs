// data/calibration-2026-09-14: draw the two calibration samples that check
// whether BRIEF.md (the calibrated brief) reproduces the corpus standard.
//
// Sample A: byte-for-byte copy of data/calibration-2026-09-12/calib-blind.csv
// (200 rows, seed 20260913, drawn 2026-09-12) so its score is directly
// comparable to that run's 89% agreement.
//
// Sample B: 150 of the 305 rows where exam 3's (lost-brief) truth and
// exam 4's (reconstructed-brief) truth disagree, joined on
// provider|method|path|operationId. Seeded mulberry32, seed 20260914.
//
// Sample C: 200 fresh exam-3 blind rows, excluding every row_id in sample A
// or sample B and every row whose exam-3 truth_class is '?'. Seeded
// mulberry32, seed 20260915 (a separate stream from sample B's, so sample B
// is unaffected).
//
// Determinism: same seed, same input files -> same output files, every run.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from '../flow/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const EXAM3_DIR = path.join(REPO_ROOT, 'data/exam3-2026-09-11');
const EXAM4_DIR = path.join(REPO_ROOT, 'data/exam4-2026-09-12');
const CALIB12_BLIND = path.join(REPO_ROOT, 'data/calibration-2026-09-12/calib-blind.csv');
const OUT_DIR = path.join(REPO_ROOT, 'data/calibration-2026-09-14');
const CALIBA_OUT = path.join(OUT_DIR, 'calibA-blind.csv');
const CALIBB_BLIND_OUT = path.join(OUT_DIR, 'calibB-blind.csv');
const CALIBB_KEY_OUT = path.join(OUT_DIR, 'calibB-key.csv');
const CALIBC_OUT = path.join(OUT_DIR, 'calibC-blind.csv');

const SEED = 20260914;
const SEED_C = 20260915;
const EXAM3_TRUTH_PARTS = 15;
const EXAM4_TRUTH_PARTS = 20;
const EXPECTED_MATCHES = 2109;
const EXPECTED_DRIFT = 305;
const EXPECTED_W_TO_X = 272;
const EXPECTED_X_TO_W = 33;
const SAMPLE_B_SIZE = 150;
const SAMPLE_C_SIZE = 200;

// --- mulberry32: tiny seeded PRNG, deterministic across runs -------------
// Copied verbatim from poc/archive/m1/arbiter/make-exam4.mjs.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- CSV writing -----------------------------------------------------------
function csvField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(header, rows) {
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map((h) => csvField(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

// --- load blind + truth for one exam dir ------------------------------------
function loadBlind(dir) {
  const text = readFileSync(path.join(dir, 'exam-blind.csv'), 'utf8');
  const rows = parseCsv(text);
  const byId = new Map();
  for (const row of rows) byId.set(row.row_id, row);
  return byId;
}

function loadTruth(dir, numParts) {
  const byId = new Map();
  for (let i = 1; i <= numParts; i++) {
    const text = readFileSync(path.join(dir, `exam-truth-part${i}.csv`), 'utf8');
    const rows = parseCsv(text);
    for (const row of rows) byId.set(row.row_id, row);
  }
  return byId;
}

// --- main --------------------------------------------------------------------
function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const exam3Blind = loadBlind(EXAM3_DIR);
  const exam3Truth = loadTruth(EXAM3_DIR, EXAM3_TRUTH_PARTS);
  const exam4Blind = loadBlind(EXAM4_DIR);
  const exam4Truth = loadTruth(EXAM4_DIR, EXAM4_TRUTH_PARTS);

  // Join key: provider|method|path|operationId.
  function key(row) {
    return [row.provider, row.method, row.path, row.operationId].join('|');
  }

  const exam3ByKey = new Map();
  for (const row of exam3Blind.values()) exam3ByKey.set(key(row), row);

  const matches = [];
  for (const row4 of exam4Blind.values()) {
    const row3 = exam3ByKey.get(key(row4));
    if (row3) matches.push({ row3, row4 });
  }

  if (matches.length !== EXPECTED_MATCHES) {
    throw new Error(
      `Expected exactly ${EXPECTED_MATCHES} exam3<->exam4 matches, got ${matches.length}`
    );
  }

  // Drift = matched rows where truth_class differs and both are in {r,w,x}.
  const drift = [];
  let wToX = 0;
  let xToW = 0;
  for (const { row3, row4 } of matches) {
    const t3 = exam3Truth.get(row3.row_id);
    const t4 = exam4Truth.get(row4.row_id);
    if (!t3 || !t4) continue;
    const c3 = t3.truth_class;
    const c4 = t4.truth_class;
    if (!['r', 'w', 'x'].includes(c3) || !['r', 'w', 'x'].includes(c4)) continue;
    if (c3 === c4) continue;
    drift.push({ row3, row4, t3, t4 });
    if (c3 === 'w' && c4 === 'x') wToX++;
    if (c3 === 'x' && c4 === 'w') xToW++;
  }

  if (drift.length !== EXPECTED_DRIFT) {
    throw new Error(`Expected exactly ${EXPECTED_DRIFT} drift rows, got ${drift.length}`);
  }
  if (wToX !== EXPECTED_W_TO_X || xToW !== EXPECTED_X_TO_W) {
    throw new Error(
      `Expected drift split w->x ${EXPECTED_W_TO_X} / x->w ${EXPECTED_X_TO_W}, got w->x ${wToX} / x->w ${xToW}`
    );
  }

  // Sample B: seeded draw of 150 of the 305 drift rows, sorted by numeric
  // exam-3 row_id after the draw.
  const rng = mulberry32(SEED);
  const shuffled = seededShuffle(drift, rng);
  const sampleB = shuffled.slice(0, SAMPLE_B_SIZE);
  sampleB.sort((a, b) => Number(a.row3.row_id) - Number(b.row3.row_id));

  let sampleWToX = 0;
  let sampleXToW = 0;
  for (const { t3, t4 } of sampleB) {
    if (t3.truth_class === 'w' && t4.truth_class === 'x') sampleWToX++;
    if (t3.truth_class === 'x' && t4.truth_class === 'w') sampleXToW++;
  }

  const blindHeader = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
  const calibBBlindRows = sampleB.map(({ row3 }) => ({
    row_id: row3.row_id,
    provider: row3.provider,
    method: row3.method,
    path: row3.path,
    operationId: row3.operationId,
    summary: row3.summary,
    description: row3.description,
  }));
  writeFileSync(CALIBB_BLIND_OUT, toCsv(blindHeader, calibBBlindRows));

  const keyHeader = ['row_id', 'exam3_class', 'exam3_confidence', 'exam4_class', 'exam4_confidence'];
  const calibBKeyRows = sampleB.map(({ row3, t3, t4 }) => ({
    row_id: row3.row_id,
    exam3_class: t3.truth_class,
    exam3_confidence: t3.confidence,
    exam4_class: t4.truth_class,
    exam4_confidence: t4.confidence,
  }));
  writeFileSync(CALIBB_KEY_OUT, toCsv(keyHeader, calibBKeyRows));

  // Sample A: byte-for-byte copy of the 2026-09-12 calibration blind file.
  copyFileSync(CALIB12_BLIND, CALIBA_OUT);

  // Sample C: 200 fresh exam-3 blind rows, excluding sample A's row_ids,
  // sample B's row_ids, and any row whose exam-3 truth_class is '?'.
  const sampleAText = readFileSync(CALIBA_OUT, 'utf8');
  const sampleARows = parseCsv(sampleAText);
  const excludedIds = new Set();
  for (const row of sampleARows) excludedIds.add(row.row_id);
  for (const { row3 } of sampleB) excludedIds.add(row3.row_id);

  const eligible = [];
  for (const row of exam3Blind.values()) {
    if (excludedIds.has(row.row_id)) continue;
    const t3 = exam3Truth.get(row.row_id);
    if (t3 && t3.truth_class === '?') continue;
    eligible.push(row);
  }

  const rngC = mulberry32(SEED_C);
  const shuffledC = seededShuffle(eligible, rngC);
  const sampleC = shuffledC.slice(0, SAMPLE_C_SIZE);
  sampleC.sort((a, b) => Number(a.row_id) - Number(b.row_id));

  const calibCRows = sampleC.map((row) => ({
    row_id: row.row_id,
    provider: row.provider,
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    summary: row.summary,
    description: row.description,
  }));
  writeFileSync(CALIBC_OUT, toCsv(blindHeader, calibCRows));

  console.log(
    `calibA 200 rows; calibB 150 of 305 drift rows (w->x ${sampleWToX}, x->w ${sampleXToW}); calibC 200 fresh rows (excluding A and B); seeds ${SEED} (B) ${SEED_C} (C)`
  );
}

main();
