// poc/jev-tiers/make-rows.mjs — builds the three D95 row piles, one per
// independent tier, from the TUNING POOL only.
//
// Tuning pool (8376 rows, never an exam):
//   data/combined-2026-09-21/labelled.csv        6557 rows, 23 providers
//   data/relabel-buildset-2026-09-23/labelled.csv 1819 rows, 13 providers
// This file reads NOTHING under data/exam-2026-09-22/ — the burned M3 exam
// must never reach a tuning measurement.
//
// Each row is classified through src/flow.js's classifyRow, and split by the
// rule that claimed it:
//   rows-lower.json.gz     rule 'floor-post'  (class x)  -> jev-lower may lower x -> w
//   rows-raise-wx.json.gz  rule 'method-floor' (class w) -> jev-raise may raise w -> x
//   rows-raise-get.json.gz rule 'method', class r        -> jev-raise may raise r -> w or r -> x
//
// Each row file carries row_id, provider, method, path, operationId, summary,
// description AND truth. Truth is there for the SCORER only: the runner sends
// criteria-*.mjs's stateFor(row), which names its five fields explicitly and
// copies nothing else, so truth cannot reach the model.
//
// Fails loudly (non-zero exit) if any pile's size differs from the recorded
// expectation — a silent change in the ladder must not silently change what
// gets measured.
//
// Usage: node poc/jev-tiers/make-rows.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../tools/csv.js';
import { classifyRow } from '../../src/flow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'data', 'jev-tiers-2026-09-23');

const SOURCES = [
  path.join(ROOT, 'data', 'combined-2026-09-21', 'labelled.csv'),
  path.join(ROOT, 'data', 'relabel-buildset-2026-09-23', 'labelled.csv'),
];
const EXPECTED_POOL = 8376;

/** The three piles: name, expected size, and the verdict test that selects it. */
export const PILES = [
  {
    tier: 'lower',
    file: 'rows-lower.json.gz',
    expected: 1906,
    from: 'x',
    select: (v) => v.rule === 'floor-post',
  },
  {
    tier: 'raise-wx',
    file: 'rows-raise-wx.json.gz',
    expected: 1657,
    from: 'w',
    select: (v) => v.rule === 'method-floor',
  },
  {
    tier: 'raise-get',
    file: 'rows-raise-get.json.gz',
    expected: 2543,
    from: 'r',
    select: (v) => v.rule === 'method' && v.class === 'r',
  },
];

/**
 * Split rows into the three piles. Exported so the test can check the split
 * on synthetic rows without touching the real corpus.
 * @param {object[]} rows
 * @returns {Map<string, object[]>} tier -> rows
 */
export function splitPiles(rows) {
  const out = new Map(PILES.map((p) => [p.tier, []]));
  for (const row of rows) {
    const verdict = classifyRow(row);
    for (const pile of PILES) {
      if (pile.select(verdict)) {
        if (verdict.class !== pile.from) {
          throw new Error(`pile ${pile.tier} expects class ${pile.from}, row ${row.row_id} is ${verdict.class}`);
        }
        out.get(pile.tier).push(row);
        break;
      }
    }
  }
  return out;
}

/** The fields written to a row file: the five sent to the model, plus id, provider and truth. */
function fields(row) {
  return {
    row_id: row.row_id,
    provider: row.provider,
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    summary: row.summary,
    description: row.description,
    truth: row.truth_class,
  };
}

function loadPool() {
  const rows = [];
  for (const src of SOURCES) {
    const parsed = parseCsv(fs.readFileSync(src, 'utf8'));
    console.log(`  ${path.relative(ROOT, src)}: ${parsed.length} rows`);
    rows.push(...parsed);
  }
  const ids = new Set(rows.map((r) => r.row_id));
  if (ids.size !== rows.length) throw new Error(`duplicate row_id: ${rows.length} rows, ${ids.size} ids`);
  for (const row of rows) {
    if (!['r', 'w', 'x'].includes(row.truth_class)) {
      throw new Error(`row ${row.row_id} has invalid truth_class ${JSON.stringify(row.truth_class)}`);
    }
  }
  return rows;
}

function main() {
  console.log('tuning pool:');
  const rows = loadPool();
  console.log(`  total: ${rows.length} rows`);
  if (rows.length !== EXPECTED_POOL) {
    console.error(`FAIL: tuning pool is ${rows.length} rows, expected ${EXPECTED_POOL}`);
    process.exit(1);
  }
  console.log('');

  const piles = splitPiles(rows);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let bad = 0;
  for (const pile of PILES) {
    const got = piles.get(pile.tier);
    const ok = got.length === pile.expected;
    if (!ok) bad += 1;
    console.log(
      `${pile.file.padEnd(22)} ${pile.tier.padEnd(9)} n=${String(got.length).padStart(5)}  expected=${pile.expected}  ${ok ? 'ok' : 'MISMATCH'}`,
    );
    const json = JSON.stringify(got.map(fields), null, 1);
    const outPath = path.join(OUT_DIR, pile.file);
    fs.writeFileSync(outPath, zlib.gzipSync(Buffer.from(json)));
  }
  console.log('');
  console.log(`wrote ${PILES.length} files to ${path.relative(ROOT, OUT_DIR)}/`);

  if (bad > 0) {
    console.error(`FAIL: ${bad} pile(s) differ from the expected count`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
