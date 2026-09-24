// tools/make-jev-exam-rows-2026-09-22.mjs — builds the three D95 row piles,
// one per independent tier, from the M3 CLEAN EXAM.
//
// *** THIS READS THE BURNED M3 EXAM (data/exam-2026-09-22, 4279 rows across
// *** cloudflare, pagerduty and sentry, scored once mechanically per D24).
// *** It must NEVER be used for a tuning measurement, a threshold sweep or
// *** any pick between configs. Its only purpose is the single frozen-
// *** threshold Jev pass over this exam. The tuning-pool equivalent is
// *** poc/jev-tiers/make-rows.mjs; use that one for tuning work.
//
// Each row is classified through src/flow.js's classifyRow, and split by the
// rule that claimed it — the SAME selectors as the tuning builder:
//   rows-lower.json.gz     rule 'floor-post'  (class x)  -> jev-lower may lower x -> w
//   rows-raise-wx.json.gz  rule 'method-floor' (class w) -> jev-raise-wx may raise w -> x
//   rows-raise-get.json.gz rule 'method', class r        -> jev-raise-get may raise r -> w
//
// Each row file carries row_id, provider, method, path, operationId, summary,
// description AND truth. Truth is there for the SCORER only: the runner sends
// criteria-*.mjs's stateFor(row), which names its five fields explicitly and
// copies nothing else, so truth cannot reach the model.
//
// ROW IDS: data/exam-2026-09-22/labelled.csv already carries a unique,
// stable row_id column (x22-NNNN). It is used verbatim — nothing is derived
// — and uniqueness is asserted below, exactly as tools/score-exam-2026-09-22.js
// asserts it.
//
// TRUTH COLUMN: `truth_class`, trimmed and required to be one of r/w/x —
// the same column and the same handling as tools/score-exam-2026-09-22.js's
// loadRows(). labelled.csv must carry no unresolved '?'.
//
// There is no expected pile size to assert (nobody has counted these), so
// each pile's size and truth split is printed to stderr instead. The pool
// size IS asserted: 4279, fail loudly on anything else.
//
// Usage: node tools/make-jev-exam-rows-2026-09-22.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.js';
import { classifyRow } from '../src/flow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'jev-exam-2026-09-22');

const SOURCE = path.join(ROOT, 'data', 'exam-2026-09-22', 'labelled.csv');
const EXPECTED_POOL = 4279;
const CLASSES = ['r', 'w', 'x'];

/** The three piles: name, and the verdict test that selects it. */
export const PILES = [
  {
    tier: 'lower',
    file: 'rows-lower.json.gz',
    from: 'x',
    select: (v) => v.rule === 'floor-post',
  },
  {
    tier: 'raise-wx',
    file: 'rows-raise-wx.json.gz',
    from: 'w',
    select: (v) => v.rule === 'method-floor',
  },
  {
    tier: 'raise-get',
    file: 'rows-raise-get.json.gz',
    from: 'r',
    select: (v) => v.rule === 'method' && v.class === 'r',
  },
];

/**
 * Split rows into the three piles.
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
  const rows = parseCsv(fs.readFileSync(SOURCE, 'utf8'));
  const ids = new Set();
  for (const row of rows) {
    const id = (row.row_id || '').trim();
    if (!id) throw new Error('labelled.csv has a row with no row_id');
    if (ids.has(id)) throw new Error(`labelled.csv lists row ${id} twice`);
    ids.add(id);
    row.row_id = id;
    row.truth_class = (row.truth_class || '').trim();
    if (!CLASSES.includes(row.truth_class)) {
      throw new Error(`row ${id}: truth_class ${JSON.stringify(row.truth_class)} is not r/w/x`);
    }
  }
  return rows;
}

function main() {
  const rows = loadPool();
  if (rows.length !== EXPECTED_POOL) {
    console.error(`FAIL: exam pool is ${rows.length} rows, expected ${EXPECTED_POOL}`);
    process.exit(1);
  }

  const piles = splitPiles(rows);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let total = 0;
  for (const pile of PILES) {
    const got = piles.get(pile.tier);
    total += got.length;
    const t = { r: 0, w: 0, x: 0 };
    for (const row of got) t[row.truth_class] += 1;
    console.error(
      `${pile.file.padEnd(22)} ${pile.tier.padEnd(9)} n=${String(got.length).padStart(5)}  truth r=${t.r} w=${t.w} x=${t.x} of ${got.length}`,
    );
    const json = JSON.stringify(got.map(fields), null, 1);
    fs.writeFileSync(path.join(OUT_DIR, pile.file), zlib.gzipSync(Buffer.from(json)));
  }
  console.error(`total in piles: ${total} of ${rows.length} exam rows`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
