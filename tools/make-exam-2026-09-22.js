#!/usr/bin/env node
// Prepares the blind M3 clean exam split (data/exam-2026-09-22/ops.csv,
// 4279 rows across cloudflare/pagerduty/sentry) for labelling under
// data/relabel-2026-09-22/BRIEF-v3.md, plus an r-class calibration draw.
//
// Why the calibration draw exists: BRIEF-v3 was calibrated only on the
// 3852 non-r rows of the 2026-09-22 relabel (data/relabel-2026-09-22/).
// This exam is 1758/4279 GET rows (41%), so the brief has never been
// calibrated on the r class it is about to be judged on. The standing
// project rule is that a brief is calibrated per method it covers before
// an exam relies on it. The calibration draw must NOT come from the exam
// itself -- that would burn exam rows before they are ever labelled. It
// is drawn instead from the TUNING corpus (data/combined-2026-09-21/
// rows.json.gz), restricted to rows whose v1 truth is r, where v1 truth
// already stands as truth for the r class (see poc/d87/readout.mjs:
// attachTruth -- row.truth === 'r' rows keep their v1 label directly;
// only non-r rows get relabelled under v3).
//
// Two independent seeded draws, same seed, different pools:
//   - the exam split: one shuffle over all 4279 exam rows -> label/
//   - the r-calibration: one shuffle over the 2705 v1-truth-r combined
//     rows -> calib/r-practice-*.csv (100 rows)
//
// Neither draw carries any class/truth/confidence column in any file a
// labeller can open. Truth is used ONLY inside this script's own
// assertion/report path (r-calibration disjointness, row counts) and is
// never written to calib/ or label/.
//
// row_ids are kept exactly as their source file has them (x22-0001 ...
// for the exam, pc-r#### for the combined pool); nothing is renumbered.
//
// Determinism: same seed, same source files -> byte-identical output
// files, every run.
//
// Usage: node tools/make-exam-2026-09-22.js

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseCsv, toCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const OPS_PATH = path.join(REPO_ROOT, 'data/exam-2026-09-22/ops.csv');
const COMBINED_PATH = path.join(REPO_ROOT, 'data/combined-2026-09-21/rows.json.gz');
const OUT_DIR = path.join(REPO_ROOT, 'data/exam-2026-09-22');
const LABEL_DIR = path.join(OUT_DIR, 'label');
const CALIB_DIR = path.join(OUT_DIR, 'calib');
const KEY_OUT = path.join(LABEL_DIR, 'key.csv');
const README_OUT = path.join(OUT_DIR, 'README.md');

const BRIEF_PATH = 'data/relabel-2026-09-22/BRIEF-v3.md';

const SEED = 20260923;
const EXPECTED_OPS_ROWS = 4279;
const EXPECTED_COMBINED_ROWS = 6557;
const EXPECTED_COMBINED_SHA256 = '3d07a5a410c91d2ef10494d8d91bcb01290acb1e67f7a89d85866781d1d38c5f';
const EXPECTED_V1_R_ROWS = 2705;
const NUM_PARTS = 10;
const CALIB_SIZE = 100;
const EXAM_PROVIDERS = ['cloudflare', 'pagerduty', 'sentry'];

const BLIND_HEADER = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
const KEY_HEADER = ['row_id', 'part', 'provider', 'method', 'path', 'operationId'];
const CALIB_KEY_HEADER = ['row_id', 'provider', 'method', 'path', 'operationId'];

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

// --- mulberry32: tiny seeded PRNG, deterministic across runs -------------
// Copied verbatim from tools/make-relabel-2026-09-22.js, which itself
// copied it verbatim from tools/make-exam-blind-2026-09-20.js. Copied
// deliberately, not imported: the shuffle must be matched exactly rather
// than reinvented.
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

// Fisher-Yates, also copied verbatim from the same source.
function seededShuffle(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function byRowIdAsc(a, b) {
  return a.row_id < b.row_id ? -1 : a.row_id > b.row_id ? 1 : 0;
}

function countBy(rows, keyFn) {
  const counts = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

function blindRow(r) {
  return {
    row_id: r.row_id,
    provider: r.provider,
    method: r.method,
    path: r.path,
    operationId: r.operationId,
    summary: r.summary || '',
    description: r.description || '',
  };
}

function calibKeyRow(r) {
  return {
    row_id: r.row_id,
    provider: r.provider,
    method: r.method,
    path: r.path,
    operationId: r.operationId,
  };
}

// --- load ------------------------------------------------------------------

function loadOps() {
  const text = readFileSync(OPS_PATH, 'utf8');
  const rows = parseCsv(text);
  if (rows.length !== EXPECTED_OPS_ROWS) {
    escalate(`expected exactly ${EXPECTED_OPS_ROWS} exam ops rows, got ${rows.length}.`);
  }
  const providers = new Set(rows.map((r) => r.provider));
  for (const p of providers) {
    if (!EXAM_PROVIDERS.includes(p)) escalate(`unexpected provider "${p}" in exam ops.csv.`);
  }
  const ids = new Set(rows.map((r) => r.row_id));
  if (ids.size !== rows.length) escalate(`exam ops.csv row_ids are not unique: ${ids.size} distinct for ${rows.length} rows.`);
  return rows;
}

// Loads the tuning-corpus combined set (truth carried on the JSON rows
// themselves as row.truth: 'r' | 'w' | 'x'). Per poc/d87/readout.mjs
// (loadRows / attachTruth), row.truth === 'r' stands directly as truth
// for the r class -- only non-r rows get relabelled under v3. We only
// need the r-truth subset here, and we keep the truth value out of every
// written file; it is used only for the pool filter and the disjointness
// report below.
function loadCombinedRTruthPool() {
  const buf = gunzipSync(readFileSync(COMBINED_PATH));
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== EXPECTED_COMBINED_SHA256) {
    escalate(`combined rows.json sha256 is ${sha}, expected ${EXPECTED_COMBINED_SHA256}.`);
  }
  const rows = JSON.parse(buf.toString('utf8'));
  if (!Array.isArray(rows)) escalate('combined rows.json is not a JSON array.');
  if (rows.length !== EXPECTED_COMBINED_ROWS) {
    escalate(`expected exactly ${EXPECTED_COMBINED_ROWS} combined rows, got ${rows.length}.`);
  }
  const requiredCols = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description', 'truth'];
  for (const col of requiredCols) {
    if (rows.length && !Object.hasOwn(rows[0], col)) escalate(`combined rows.json is missing required field "${col}"`);
  }
  const rRows = rows.filter((r) => r.truth === 'r');
  if (rRows.length !== EXPECTED_V1_R_ROWS) {
    escalate(`expected ${EXPECTED_V1_R_ROWS} v1 truth-r rows in combined set, got ${rRows.length}.`);
  }
  return { rRows, sha };
}

// --- main --------------------------------------------------------------------

function main() {
  mkdirSync(LABEL_DIR, { recursive: true });
  mkdirSync(CALIB_DIR, { recursive: true });

  const ops = loadOps();
  const { rRows: rPool, sha: combinedSha } = loadCombinedRTruthPool();

  // --- TASK 2: main exam split -------------------------------------------

  // Parts 1-9 get 428 rows each, part 10 gets the remainder (9*428 + 427
  // = 4279) -- ceil-sized front parts, per the task spec, not
  // floor-sized ones (floor(4279/10) = 427, which would make part 10
  // the largest instead of the smallest).
  const partSize = Math.ceil(ops.length / NUM_PARTS);
  const lastPartSize = ops.length - (NUM_PARTS - 1) * partSize;
  const splitTotal = (NUM_PARTS - 1) * partSize + lastPartSize;
  if (splitTotal !== ops.length) {
    escalate(`split arithmetic wrong: ${NUM_PARTS - 1}*${partSize}+${lastPartSize} = ${splitTotal}, expected ${ops.length}.`);
  }
  if (partSize !== 428 || lastPartSize !== 427) {
    escalate(`unexpected part sizes: ${partSize}/${lastPartSize}, expected 428/427.`);
  }

  const examRng = mulberry32(SEED);
  const shuffledOps = seededShuffle(ops, examRng);

  const parts = [];
  let offset = 0;
  for (let p = 1; p <= NUM_PARTS; p++) {
    const size = p < NUM_PARTS ? partSize : lastPartSize;
    parts.push(shuffledOps.slice(offset, offset + size));
    offset += size;
  }
  if (offset !== ops.length) escalate(`parts consumed ${offset} rows, expected ${ops.length}.`);

  parts.forEach((part, i) => {
    const p = i + 1;
    const expected = p < NUM_PARTS ? partSize : lastPartSize;
    if (part.length !== expected) escalate(`part ${p} has ${part.length} rows, expected ${expected}.`);
  });

  const allIds = parts.flat().map((r) => r.row_id);
  if (allIds.length !== ops.length) escalate(`union of parts has ${allIds.length} rows, expected ${ops.length}.`);
  const idSet = new Set(allIds);
  if (idSet.size !== allIds.length) escalate('a row_id repeats across parts.');
  const opsIds = new Set(ops.map((r) => r.row_id));
  for (const id of opsIds) {
    if (!idSet.has(id)) escalate(`row_id ${id} is missing from the union of parts.`);
  }
  if (idSet.size !== opsIds.size) escalate('union of parts is not exactly the source ops row set.');

  parts.forEach((part, i) => {
    const p = i + 1;
    writeFileSync(path.join(LABEL_DIR, `blind-${p}.csv`), toCsv(part.map(blindRow), BLIND_HEADER));
  });

  const partOf = new Map();
  parts.forEach((part, i) => {
    for (const r of part) partOf.set(r.row_id, i + 1);
  });
  const keyRows = ops
    .slice()
    .sort(byRowIdAsc)
    .map((r) => ({ ...calibKeyRow(r), part: partOf.get(r.row_id) }));
  writeFileSync(KEY_OUT, toCsv(keyRows, KEY_HEADER));

  // --- TASK 3: r-class calibration, independent shuffle over the r-truth
  // tuning-corpus pool. Same seed, its own draw (a second, independent
  // mulberry32 instance seeded the same way -- distinct from examRng,
  // which already consumed draws for the exam shuffle above).
  const calibRng = mulberry32(SEED);
  const shuffledRPool = seededShuffle(rPool, calibRng);
  const rCalib = shuffledRPool.slice(0, CALIB_SIZE);
  if (rCalib.length !== CALIB_SIZE) escalate(`r-calibration draw is ${rCalib.length} rows, expected ${CALIB_SIZE}.`);

  // Assert disjoint from the exam: different corpus entirely, but assert
  // on row_id and provider anyway, as instructed.
  const rCalibIds = new Set(rCalib.map((r) => r.row_id));
  for (const id of rCalibIds) {
    if (opsIds.has(id)) escalate(`r-calibration row_id ${id} collides with an exam row_id.`);
  }
  const rCalibProviders = new Set(rCalib.map((r) => r.provider));
  for (const p of rCalibProviders) {
    if (EXAM_PROVIDERS.includes(p)) escalate(`r-calibration provider "${p}" collides with an exam provider.`);
  }

  writeFileSync(path.join(CALIB_DIR, 'r-practice-blind.csv'), toCsv(rCalib.map(blindRow), BLIND_HEADER));
  writeFileSync(path.join(CALIB_DIR, 'r-practice-key.csv'), toCsv(rCalib.map(calibKeyRow), CALIB_KEY_HEADER));

  // --- round-trip assertion: re-read every written file, check counts +
  // row_id/operationId/summary match source, and check NO class/truth
  // column leaked into any of them.
  const opsByRowId = new Map(ops.map((r) => [r.row_id, r]));
  const rPoolByRowId = new Map(rPool.map((r) => [r.row_id, r]));
  let roundTripRows = 0;
  let roundTripOk = true;
  const toReread = [
    ...parts.map((part, i) => ({
      name: `label/blind-${i + 1}.csv`,
      file: path.join(LABEL_DIR, `blind-${i + 1}.csv`),
      expected: part.length,
      src: opsByRowId,
    })),
    {
      name: 'calib/r-practice-blind.csv',
      file: path.join(CALIB_DIR, 'r-practice-blind.csv'),
      expected: CALIB_SIZE,
      src: rPoolByRowId,
    },
  ];
  for (const { name, file, expected, src } of toReread) {
    const text = readFileSync(file, 'utf8');
    const headerLine = text.split('\n', 1)[0];
    for (const forbidden of ['truth', 'class', 'confidence', 'part']) {
      if (headerLine.split(',').includes(forbidden)) {
        roundTripOk = false;
        console.error(`ESCALATE: ${name} header contains forbidden column "${forbidden}".`);
      }
    }
    const reread = parseCsv(text);
    if (reread.length !== expected) {
      roundTripOk = false;
      console.error(`ESCALATE: round-trip: ${name} has ${reread.length} rows after re-read, expected ${expected}.`);
      continue;
    }
    for (const rr of reread) {
      const srcRow = src.get(rr.row_id);
      if (!srcRow) {
        roundTripOk = false;
        console.error(`ESCALATE: round-trip: row_id ${rr.row_id} in ${name} not found in source rows.`);
        continue;
      }
      if (rr.operationId !== srcRow.operationId || rr.summary !== (srcRow.summary || '')) {
        roundTripOk = false;
        console.error(`ESCALATE: round-trip mismatch on ${rr.row_id}: operationId/summary do not match source.`);
        continue;
      }
      roundTripRows += 1;
    }
  }
  if (!roundTripOk) escalate('round-trip assertion failed (see rows above).');

  // --- reports -------------------------------------------------------------

  const providerCounts = countBy(ops, (r) => r.provider);
  const methodNames = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  const perPartReport = parts.map((part, i) => {
    const provCounts = {};
    for (const p of EXAM_PROVIDERS) provCounts[p] = part.filter((r) => r.provider === p).length;
    const methodCounts = {};
    for (const m of methodNames) methodCounts[m] = part.filter((r) => r.method === m).length;
    return { part: i + 1, n: part.length, provCounts, methodCounts };
  });

  console.log('=== source ===');
  console.log(`exam ops.csv: ${ops.length} rows, providers: ${EXAM_PROVIDERS.map((p) => `${p} ${providerCounts.get(p) || 0}`).join(', ')}`);
  console.log(`combined rows.json sha256 ${combinedSha}`);
  console.log(`combined pool: ${EXPECTED_COMBINED_ROWS} rows total, ${rPool.length} v1 truth-r rows kept for calibration`);

  console.log('\n=== per-part size (label/) ===');
  for (const r of perPartReport) console.log(`part ${r.part}: ${r.n} rows`);

  console.log('\n=== per-part provider mix ===');
  for (const r of perPartReport) {
    console.log(`part ${r.part}: ${EXAM_PROVIDERS.map((p) => `${p} ${r.provCounts[p]}`).join(', ')}`);
  }

  console.log('\n=== per-part method mix ===');
  for (const r of perPartReport) {
    console.log(`part ${r.part}: ${methodNames.map((m) => `${m} ${r.methodCounts[m]}`).join(', ')}`);
  }

  console.log('\n=== round-trip assertion ===');
  console.log(`OK: ${roundTripRows} rows re-read across ${toReread.length} files (${NUM_PARTS} label parts + 1 calibration), all row_id/operationId/summary matched source, no forbidden columns found.`);

  console.log('\n=== r-calibration draw ===');
  console.log(`${rCalib.length} rows drawn from the ${rPool.length}-row v1-truth-r tuning pool, providers: ${[...rCalibProviders].sort().join(', ')}`);
  console.log('disjoint from exam on row_id and provider: OK (asserted above)');

  console.log(`\nWrote ${NUM_PARTS} blind files + key.csv to ${LABEL_DIR}`);
  console.log(`Wrote 2 calibration files to ${CALIB_DIR}`);

  appendReadme(perPartReport, rCalib.length, rPool.length);
  console.log(`Appended calibration/split/rules sections to ${README_OUT}`);
}

function appendReadme(perPartReport, calibN, rPoolN) {
  const existing = readFileSync(README_OUT, 'utf8');
  const marker = '\n## Calibration (calib/)\n';
  if (existing.includes(marker)) {
    escalate('README already has a "## Calibration (calib/)" section; refusing to duplicate on append. Remove it by hand if a real rebuild is wanted, or make this script idempotent-on-content before rerunning.');
  }

  const providerMixLines = perPartReport
    .map((r) => `  - part ${r.part}: ${EXAM_PROVIDERS.map((p) => `${p} ${r.provCounts[p]}`).join(', ')} (${r.n} rows)`)
    .join('\n');

  const addition = `
## Calibration (calib/)

BRIEF-v3 (\`${BRIEF_PATH}\`) was calibrated only on the 3852 non-r rows of
the 2026-09-22 relabel (\`data/relabel-2026-09-22/\`). This exam is 1758 of
its 4279 rows GET (41%), so the brief has never been calibrated on the r
class it is about to be judged on here. The standing project rule is that
a brief is calibrated per method it covers before an exam relies on it.

This calibration draw does **not** come from the exam -- scoring it would
burn exam rows before they are ever labelled. It is drawn instead from
the TUNING corpus (\`data/combined-2026-09-21/rows.json.gz\`, ${rPoolN} rows
whose v1 truth is \`r\`), where v1 truth already stands as truth for r rows
(see \`poc/d87/readout.mjs\`'s \`attachTruth\`: a \`row.truth === 'r'\` row
keeps its v1 label directly, only non-r rows are relabelled under v3).

- \`r-practice-blind.csv\` (${calibN} rows, seeded shuffle over the ${rPoolN}-row
  v1-truth-r pool, independent of the exam's own shuffle): labelled blind
  under BRIEF-v3 to check the brief holds on the r class before the exam
  is scored.
- \`r-practice-key.csv\`: \`row_id,provider,method,path,operationId\` -- no
  class column.
- The existing v1 truth for these rows is used only inside
  \`tools/make-exam-2026-09-22.js\`'s own assertion/report path (to draw
  the r-truth pool and to print the disjointness check); it is never
  written to \`r-practice-blind.csv\` or \`r-practice-key.csv\`, and the
  script asserts neither file's header contains a truth/class/confidence
  column before it will report success.
- Disjoint from the exam by construction (different corpus entirely) and
  asserted anyway, on row_id and on provider.

## Split (label/)

- Seed: ${SEED} (mulberry32, one shuffle over all 4279 exam rows).
- 4279 rows split into 10 parts: parts 1-9 have 428 rows each, part 10
  has 427 rows (9*428 + 427 = 4279).
- Rows are shuffled across all three providers before splitting, so no
  labeller receives one provider's rows in a block. Per-part provider mix:
${providerMixLines}
- \`blind-1.csv\` … \`blind-10.csv\`: one file per labeller. Columns:
  \`row_id,provider,method,path,operationId,summary,description\`. No
  truth, class, confidence, part number, or classifier output.
- \`key.csv\`: \`row_id,part,provider,method,path,operationId\`, sorted by
  row_id -- no class column.
- Row ids are kept exactly as \`ops.csv\` has them (\`x22-0001\` …); nothing
  is renumbered.

## Rules for labellers

- Open only your own \`blind-N.csv\` file.
- Write only your own output file, named \`labels-N.csv\` (same N as your
  blind file), and use your own uniquely-named scratch files -- never a
  name another labeller might also use.
- Output columns are exactly \`row_id,truth_class,confidence,reason\`, as
  the brief specifies: \`truth_class\` is r, w, x or ?; \`confidence\` is
  EXACTLY \`high\` or \`low\` (there is no medium, and any other value means
  the file is rejected); \`reason\` is a short phrase under 15 words with
  no commas (or the whole reason double-quoted) naming the clause
  applied. One line per input row, same order, no rows skipped, no
  extras.
- Append output in batches of about 50 rows rather than holding all rows
  in memory, so a kill mid-run loses only the unflushed batch.
- Do not look at any other labeller's blind or output file.

## Reproduce (split + calibration)

\`\`\`
node tools/make-exam-2026-09-22.js
\`\`\`

Deterministic: same seed (${SEED}), same \`ops.csv\` and same
\`data/combined-2026-09-21/rows.json.gz\` -> byte-identical output files,
every run.
`;

  writeFileSync(README_OUT, existing + addition);
}

main();
