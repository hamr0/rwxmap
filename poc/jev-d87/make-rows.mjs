// poc/jev-d87/make-rows.mjs — builds data/jev-2026-09-22/rows-floor.json(.gz):
// every row of data/combined-2026-09-21/rows.json.gz that the D87 flow
// (poc/d87/flow.mjs) sends to its POST floor (rule 'floor-post').
//
// No truth, no confidence, no tool class is written to the rows file — Jev
// must not see the answer, and this POC must not fit to it either.
//
// Imports nothing from src/. Importing poc/d87/flow.mjs is required (that
// is the ladder whose floor this measures).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { classifyRow } from '../d87/flow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

/**
 * The rows this measurement runs on: every row the D87 flow floors at
 * step 2's named leftover pile. Exported so the test can check the filter
 * logic on synthetic rows without touching the real corpus.
 * @param {object[]} rows
 * @returns {object[]}
 */
export function floorPostRows(rows) {
  return rows.filter((row) => classifyRow(row).rule === 'floor-post');
}

function fields(row) {
  return {
    row_id: row.row_id,
    provider: row.provider,
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    summary: row.summary,
    description: row.description,
  };
}

function main() {
  const gzPath = path.join(ROOT, 'data', 'combined-2026-09-21', 'rows.json.gz');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(gzPath)));

  const floorRows = floorPostRows(rows).map(fields);

  const outDir = path.join(ROOT, 'data', 'jev-2026-09-22');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'rows-floor.json');
  const gzOutPath = `${jsonPath}.gz`;

  const json = JSON.stringify(floorRows, null, 1);
  fs.writeFileSync(jsonPath, json);
  fs.writeFileSync(gzOutPath, zlib.gzipSync(Buffer.from(json)));
  fs.unlinkSync(jsonPath); // keep only .gz in the repo

  console.log(`floor-post rows: ${floorRows.length}`);
  console.log(`wrote ${gzOutPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
