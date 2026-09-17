// The combined corpus loader for poc/flow — reproduces, row-for-row and
// field-for-field, poc/archive/m1/core/corpus.mjs's loadContext() (which calls
// loadCombinedCorpus() in poc/archive/m1/arbiter/c19.mjs lines 40-162, which in
// turn uses poc/archive/m1/arbiter/load-sets.mjs). Imports nothing from poc/m1 or
// poc/m0 — this file is the fresh bottom layer for poc/flow.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from './csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
const TEXT_PATH = path.join(REPO_ROOT, 'docs/logs/m1/ops-text.csv');
const HOLDOUT3_DIR = path.join(REPO_ROOT, 'data/holdout3-2026-09-08');
const HOLDOUT3_GT = path.join(HOLDOUT3_DIR, 'ground-truth.csv');
const HOLDOUT3_OPS = path.join(HOLDOUT3_DIR, 'operations.csv');
const HOLDOUT5_DIR = path.join(REPO_ROOT, 'data/holdout5-2026-09-08');
const HOLDOUT5_GT = path.join(HOLDOUT5_DIR, 'ground-truth.csv');
const HOLDOUT5_OPS = path.join(HOLDOUT5_DIR, 'operations.csv');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const EXAM2_DIR = path.join(REPO_ROOT, 'data/exam2-2026-09-10');
const EXAM2_BLIND = path.join(EXAM2_DIR, 'exam-blind.csv');
const EXAM2_TRUTH_PARTS = [1, 2, 3, 4, 5].map((n) => path.join(EXAM2_DIR, `exam-truth-part${n}.csv`));
const EXAM3_DIR = path.join(REPO_ROOT, 'data/exam3-2026-09-11');
const EXAM3_BLIND = path.join(EXAM3_DIR, 'exam-blind.csv');
const EXAM3_TRUTH_PARTS = Array.from({ length: 15 }, (_, i) => i + 1)
  .map((n) => path.join(EXAM3_DIR, `exam-truth-part${n}.csv`));

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

// --- census-ops.csv + ops-text.csv, same join as load-sets.mjs's
// loadCensusRows -----------------------------------------------------------

function loadCensusRows() {
  const censusRows = parseCsv(readFileSync(CENSUS_PATH, 'utf8'));
  const textRows = parseCsv(readFileSync(TEXT_PATH, 'utf8'));

  const requiredCensusCols = ['set', 'repo', 'path', 'method', 'operationId', 'gt_class'];
  const censusHeader = censusRows.length ? Object.keys(censusRows[0]) : [];
  for (const col of requiredCensusCols) {
    if (!censusHeader.includes(col)) throw new Error(`ESCALATE: census-ops.csv is missing required column "${col}"`);
  }

  const textIndex = new Map();
  for (const t of textRows) {
    textIndex.set([t.set, t.repo, t.path, t.method, t.operationId].join('|'), t);
  }
  let textJoinMisses = 0;
  for (const row of censusRows) {
    const key = [row.set, row.repo, row.path, row.method, row.operationId].join('|');
    const t = textIndex.get(key);
    if (!t) { textJoinMisses += 1; row.summary = ''; row.description = ''; continue; }
    row.summary = t.summary || '';
    row.description = t.description || '';
  }
  if (textJoinMisses > 0) {
    throw new Error(`ESCALATE: ${textJoinMisses} census-ops.csv rows had no matching row in ops-text.csv — the two files are out of sync.`);
  }
  return censusRows;
}

// --- a holdout dir: join ground-truth.csv (gt_class) onto operations.csv
// (summary, description), key repo|path|method|operationId ----------------

function loadHoldoutDir(dir, gtPath, opsPath, setName) {
  if (!existsSync(gtPath) || !existsSync(opsPath)) return null;

  const gtRows = parseCsv(readFileSync(gtPath, 'utf8'));
  const opsRows = parseCsv(readFileSync(opsPath, 'utf8'));

  const opsIndex = new Map();
  for (const o of opsRows) {
    opsIndex.set([o.repo, o.path, o.method, o.operationId].join('|'), o);
  }

  const rows = [];
  let joinMisses = 0;
  for (const gt of gtRows) {
    const key = [gt.repo, gt.path, gt.method, gt.operationId].join('|');
    const o = opsIndex.get(key);
    if (!o) { joinMisses += 1; continue; }
    rows.push({
      set: setName,
      repo: gt.repo,
      path: gt.path,
      method: gt.method,
      operationId: gt.operationId,
      gt_class: gt.gt_class,
      summary: o.summary || '',
      description: o.description || '',
    });
  }
  if (joinMisses > 0) {
    throw new Error(`ESCALATE: ${joinMisses} ${setName} ground-truth.csv rows had no matching row in operations.csv.`);
  }
  return rows;
}

function loadHoldout3() {
  return loadHoldoutDir(HOLDOUT3_DIR, HOLDOUT3_GT, HOLDOUT3_OPS, 'holdout3');
}

function loadHoldout5() {
  return loadHoldoutDir(HOLDOUT5_DIR, HOLDOUT5_GT, HOLDOUT5_OPS, 'holdout5');
}

// Every data/holdout4-*/ directory carrying both ground-truth.csv and
// operations.csv, all joined into set 'holdout4'.
function loadHoldout4() {
  if (!existsSync(DATA_DIR)) return null;
  const dirNames = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('holdout4-'))
    .map((d) => d.name)
    .sort();
  if (dirNames.length === 0) return null;

  const rows = [];
  for (const name of dirNames) {
    const dir = path.join(DATA_DIR, name);
    const gtPath = path.join(dir, 'ground-truth.csv');
    const opsPath = path.join(dir, 'operations.csv');
    const dirRows = loadHoldoutDir(dir, gtPath, opsPath, 'holdout4');
    if (dirRows === null) continue;
    rows.push(...dirRows);
  }
  return rows.length ? rows : null;
}

// camara's own `repo` column is a sub-API name, not a vendor — every camara
// row belongs to one vendor, CAMARA itself. Every other original-set row's
// `repo` column already is a vendor name.
function vendorForOriginalRow(row) {
  return row.set === 'camara' ? 'camara' : row.repo;
}

function loadOriginalRows() {
  const censusRows = loadCensusRows(); // set: camara, holdout1, holdout2
  const holdout3Rows = loadHoldout3() || [];
  const holdout4Rows = loadHoldout4() || [];
  const holdout5Rows = loadHoldout5() || [];
  if (holdout5Rows.length === 0) {
    throw new Error('ESCALATE: holdout5 loaded 0 rows.');
  }
  const raw = [...censusRows, ...holdout3Rows, ...holdout4Rows, ...holdout5Rows];
  if (raw.length !== 1478) {
    throw new Error(`ESCALATE: expected 1478 original labelled rows, got ${raw.length}.`);
  }
  return raw.map((row) => ({
    set: row.set,
    vendor: vendorForOriginalRow(row),
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    summary: row.summary || '',
    description: row.description || '',
    gt_class: row.gt_class,
    confidence: 'high',
  }));
}

// Generic exam-set loader: blindPath (single combined blind CSV) joined by
// row_id to truthParts (a list of truth-part CSV paths), both under
// blindDir. setName tags every row's `set` field. expectedBlind /
// expectedTruth assert the exact row counts.
function loadExamRows(setName, blindPath, truthParts, expectedBlind, expectedTruth) {
  const blindRows = parseCsv(readFileSync(blindPath, 'utf8'));
  const truthRows = [];
  for (const p of truthParts) {
    truthRows.push(...parseCsv(readFileSync(p, 'utf8')));
  }
  if (blindRows.length !== expectedBlind) {
    throw new Error(`ESCALATE: expected ${expectedBlind} ${setName}-blind rows, got ${blindRows.length}.`);
  }
  if (truthRows.length !== expectedTruth) {
    throw new Error(`ESCALATE: expected ${expectedTruth} ${setName}-truth rows across its parts, got ${truthRows.length}.`);
  }

  const truthByRowId = new Map();
  for (const t of truthRows) {
    if (truthByRowId.has(t.row_id)) {
      throw new Error(`ESCALATE: duplicate ${setName} truth row_id ${t.row_id}.`);
    }
    truthByRowId.set(t.row_id, t);
  }

  const out = [];
  let joinMisses = 0;
  for (const b of blindRows) {
    const t = truthByRowId.get(b.row_id);
    if (!t) { joinMisses += 1; continue; }
    if (t.truth_class === '?') continue;
    out.push({
      set: setName,
      vendor: b.provider,
      method: b.method,
      path: b.path,
      operationId: b.operationId,
      summary: b.summary || '',
      description: b.description || '',
      gt_class: t.truth_class,
      confidence: t.confidence,
    });
  }
  if (joinMisses > 0) {
    throw new Error(`ESCALATE: ${joinMisses} ${setName}-blind rows had no matching truth row by row_id.`);
  }
  return out;
}

function loadExam2Rows() {
  return loadExamRows('exam2', EXAM2_BLIND, EXAM2_TRUTH_PARTS, 1000, 1000);
}

function loadExam3Rows() {
  return loadExamRows('exam3', EXAM3_BLIND, EXAM3_TRUTH_PARTS, 3000, 3000);
}

// Loads the combined corpus and returns { rows, vendors }, asserting the
// corpus shape every caller already checked for.
export function loadRows() {
  const originalRows = loadOriginalRows();
  const exam2Rows = loadExam2Rows();
  const exam3Rows = loadExam3Rows();
  const rows = [...originalRows, ...exam2Rows, ...exam3Rows];
  const vendors = [...new Set(rows.map((r) => r.vendor))].sort();

  if (rows.length !== 5465) escalate(`corpus rows ${rows.length}, expected 5465`);
  if (vendors.length !== 332) escalate(`corpus vendors ${vendors.length}, expected 332`);

  return { rows, vendors };
}
