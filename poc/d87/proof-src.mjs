// poc/d87/proof-src.mjs — standalone equivalence proof, not a test: the
// graduated src/ ladder must behave byte-identically to poc/d87/flow.mjs's
// classifyRow on every row of the tuning corpus, and the graduated D88 Jev
// tier must reproduce the 804-row lowering measured in poc/jev-d87/score.mjs.
//
// Two checks:
//   1. For every row of data/combined-2026-09-21/rows.json.gz, assert
//      deepEqual(src classifyRow(row), poc/d87 classifyRow(row)). Prints
//      "rows compared N, differences D" where D is the TRUE total
//      differing-row count (never capped by the sample printed below),
//      plus up to 5 differing rows. Exits 1 if D > 0.
//   2. Over data/jev-2026-09-22/rows-floor.json.gz joined with
//      out-floor.jsonl.gz (gzipped JSONL; answers.isX.noul = p, model
//      field), apply src applyJev to src classifyRow and print how many
//      rows were lowered (expect 804) and the model versions seen. Exits 1
//      if the lowered count is not 804.
//
// Run: node poc/d87/proof-src.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { classifyRow as srcClassifyRow } from '../../src/flow.js';
import { applyJev } from '../../src/jev.js';
import { classifyRow as pocClassifyRow } from './flow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

function readGzJson(p) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(p)));
}

function deepEqual(a, b) {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

let exitCode = 0;

// --- check 1: src vs poc/d87, every row of the tuning corpus -------------

function checkSrcVsPoc() {
  const rowsPath = path.join(ROOT, 'data', 'combined-2026-09-21', 'rows.json.gz');
  const rows = readGzJson(rowsPath);

  let differences = 0;
  const samples = [];

  for (const row of rows) {
    const srcVerdict = srcClassifyRow(row);
    const pocVerdict = pocClassifyRow(row);
    if (!deepEqual(srcVerdict, pocVerdict)) {
      differences += 1;
      if (samples.length < 5) {
        samples.push({ row_id: row.row_id, provider: row.provider, srcVerdict, pocVerdict });
      }
    }
  }

  console.log(`rows compared ${rows.length}, differences ${differences}`);
  if (differences > 0) {
    console.log('sample of differing rows (up to 5):');
    for (const s of samples) {
      console.log(`  ${s.row_id} (${s.provider})`);
      console.log(`    src: ${JSON.stringify(s.srcVerdict)}`);
      console.log(`    poc: ${JSON.stringify(s.pocVerdict)}`);
    }
    exitCode = 1;
  }
}

// --- check 2: src applyJev reproduces the 804-row lowering ---------------

function readOutJsonl(p) {
  const map = new Map();
  const text = zlib.gunzipSync(fs.readFileSync(p)).toString('utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const o = JSON.parse(line);
    map.set(o.row_id, o);
  }
  return map;
}

function checkJevLowering() {
  const floorRowsPath = path.join(ROOT, 'data', 'jev-2026-09-22', 'rows-floor.json.gz');
  const outPath = path.join(ROOT, 'data', 'jev-2026-09-22', 'out-floor.jsonl.gz');

  const floorRows = readGzJson(floorRowsPath);
  const outById = readOutJsonl(outPath);

  let lowered = 0;
  const models = new Set();

  for (const row of floorRows) {
    const out = outById.get(row.row_id);
    const p = out && !out.error && out.answers && out.answers.isX && typeof out.answers.isX.noul === 'number'
      ? out.answers.isX.noul
      : null;
    if (p === null) continue;

    const verdict = srcClassifyRow(row);
    const lower = applyJev(verdict, { p, model: out.model });
    if (lower.rule === 'jev-lower') {
      lowered += 1;
      models.add(lower.jev.model);
    }
  }

  console.log(`jev: ${floorRows.length} floor-post rows, lowered ${lowered}`);
  console.log(`jev: model versions seen: ${[...models].sort().join(', ')}`);
  if (lowered !== 804) {
    console.log(`jev: expected 804 lowered, got ${lowered}`);
    exitCode = 1;
  }
}

checkSrcVsPoc();
checkJevLowering();
process.exit(exitCode);
