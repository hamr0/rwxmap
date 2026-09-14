// M1 set-loading helpers, extracted verbatim from run-c11-final.mjs so
// run-benchmark.mjs (and any other consumer) can load the same five sets
// without duplicating the loading logic.
//
// Exports: loadCensusRows, loadHoldoutDir, loadHoldout3, loadHoldout4, plus
// the path constants they need.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from '../../m0/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
export const TEXT_PATH = path.join(REPO_ROOT, 'docs/logs/m1/ops-text.csv');
export const HOLDOUT3_DIR = path.join(REPO_ROOT, 'data/holdout3-2026-09-08');
export const HOLDOUT3_GT = path.join(HOLDOUT3_DIR, 'ground-truth.csv');
export const HOLDOUT3_OPS = path.join(HOLDOUT3_DIR, 'operations.csv');
export const HOLDOUT5_DIR = path.join(REPO_ROOT, 'data/holdout5-2026-09-08');
export const HOLDOUT5_GT = path.join(HOLDOUT5_DIR, 'ground-truth.csv');
export const HOLDOUT5_OPS = path.join(HOLDOUT5_DIR, 'operations.csv');
export const DATA_DIR = path.join(REPO_ROOT, 'data');

// --- load census-ops.csv + ops-text.csv, exactly as run-c11.mjs does -------

export function loadCensusRows() {
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

// --- load a holdout dir: join ground-truth.csv (gt_class) onto
// operations.csv (summary, description), key repo|path|method|operationId --

export function loadHoldoutDir(dir, gtPath, opsPath, setName) {
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

export function loadHoldout3() {
  return loadHoldoutDir(HOLDOUT3_DIR, HOLDOUT3_GT, HOLDOUT3_OPS, 'holdout3');
}

// M1-C13: hold-out 5 (Slack, Amazon; 323 rows; scored once, 2026-09-08 —
// c11 FAILED the zero-leak gate on it, 17 leaks, every one a Slack GET).
// Same join shape as loadHoldout3.
export function loadHoldout5() {
  return loadHoldoutDir(HOLDOUT5_DIR, HOLDOUT5_GT, HOLDOUT5_OPS, 'holdout5');
}

// --- load holdout4: every data/holdout4-*/ directory carrying both
// ground-truth.csv and operations.csv, all joined into set 'holdout4' -----

export function loadHoldout4() {
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
