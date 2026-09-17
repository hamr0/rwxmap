#!/usr/bin/env node
// Prepares blind labelling files so 21 blind labellers can each label
// ~199 rows of the new 15-provider corpus (data/provider-corpus-2026-09-16/
// ops.csv.gz, 4171 rows) under data/calibration-2026-09-14/BRIEF.md. This
// corpus has no truth labels yet; these labels will BECOME the truth.
//
// Every row gets a stable row_id (r0001..r4171, assigned in the order rows
// appear in ops.csv), then all rows are shuffled with a seeded PRNG so no
// labeller receives one provider's rows in a block, then cut into 21 parts
// (20 of 199 rows, 1 of 191 rows -> 20*199+191 = 4171).
//
// Determinism: same seed, same ops.csv.gz -> byte-identical output files,
// every run.
//
// Uses poc/m0/csv.mjs (not poc/flow/csv.mjs, which lives inside the frozen
// poc/flow/ directory) and models its seeded shuffle on
// poc/exam/make-postcal.mjs (mulberry32 + Fisher-Yates), matched exactly
// rather than reinvented.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../m0/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const OPS_GZ_PATH = path.join(REPO_ROOT, 'data/provider-corpus-2026-09-16/ops.csv.gz');
const LABEL_DIR = path.join(REPO_ROOT, 'data/provider-corpus-2026-09-16/label');
const KEY_OUT = path.join(LABEL_DIR, 'key.csv');
const README_OUT = path.join(LABEL_DIR, 'README.md');

const SEED = 20260916;
const EXPECTED_ROWS = 4171;
const NUM_PARTS = 21;
const PART_SIZE = 199;
const LAST_PART_SIZE = 191;

const BLIND_HEADER = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
const KEY_HEADER = ['row_id', 'part', 'provider', 'method', 'path', 'operationId'];

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

// --- mulberry32: tiny seeded PRNG, deterministic across runs -------------
// Copied verbatim from poc/exam/make-postcal.mjs (itself copied from
// poc/archive/m1/arbiter/make-exam4.mjs).
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

// --- load ------------------------------------------------------------------

function loadRows() {
  const gz = readFileSync(OPS_GZ_PATH);
  const text = gunzipSync(gz).toString('utf8');
  const rows = parseCsv(text);
  const requiredCols = ['provider', 'method', 'path', 'operationId', 'summary', 'description'];
  const header = rows.length ? Object.keys(rows[0]) : [];
  for (const col of requiredCols) {
    if (!header.includes(col)) escalate(`ops.csv is missing required column "${col}"`);
  }
  return rows;
}

function padId(i) {
  return `r${String(i).padStart(4, '0')}`;
}

function padPart(i) {
  return String(i).padStart(2, '0');
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

// --- main --------------------------------------------------------------------

function main() {
  mkdirSync(LABEL_DIR, { recursive: true });

  const rawRows = loadRows();
  if (rawRows.length !== EXPECTED_ROWS) {
    escalate(`expected exactly ${EXPECTED_ROWS} ops.csv rows, got ${rawRows.length}.`);
  }

  // Step 1: stable row_id, assigned in ops.csv appearance order.
  const rows = rawRows.map((r, idx) => ({ ...r, row_id: padId(idx + 1) }));

  // Step 2: check the split arithmetic before doing anything else.
  const splitTotal = (NUM_PARTS - 1) * PART_SIZE + LAST_PART_SIZE;
  if (splitTotal !== EXPECTED_ROWS) {
    escalate(`split arithmetic wrong: ${NUM_PARTS - 1}*${PART_SIZE}+${LAST_PART_SIZE} = ${splitTotal}, expected ${EXPECTED_ROWS}.`);
  }
  if (20 * 199 + 191 !== 4171) {
    escalate('sanity check 20*199+191 === 4171 failed.');
  }

  // Step 3: seeded shuffle of the full row set.
  const rng = mulberry32(SEED);
  const shuffled = seededShuffle(rows, rng);

  // Step 4: cut into 21 parts.
  const parts = [];
  let offset = 0;
  for (let p = 1; p <= NUM_PARTS; p++) {
    const size = p < NUM_PARTS ? PART_SIZE : LAST_PART_SIZE;
    parts.push(shuffled.slice(offset, offset + size));
    offset += size;
  }
  if (offset !== EXPECTED_ROWS) {
    escalate(`parts consumed ${offset} rows, expected ${EXPECTED_ROWS}.`);
  }

  // Step 5: per-part size check.
  const partSizeReport = [];
  parts.forEach((part, i) => {
    const p = i + 1;
    const expected = p < NUM_PARTS ? PART_SIZE : LAST_PART_SIZE;
    if (part.length !== expected) {
      escalate(`part ${p} has ${part.length} rows, expected ${expected}.`);
    }
    partSizeReport.push({ part: p, n: part.length });
  });

  // Step 6: row_id uniqueness + union-of-parts-is-exactly-the-4171-rows check.
  const allIds = parts.flat().map((r) => r.row_id);
  if (allIds.length !== EXPECTED_ROWS) {
    escalate(`union of parts has ${allIds.length} rows, expected ${EXPECTED_ROWS}.`);
  }
  const idSet = new Set(allIds);
  if (idSet.size !== allIds.length) {
    escalate('a row_id repeats across parts.');
  }
  const sourceIds = new Set(rows.map((r) => r.row_id));
  for (const id of sourceIds) {
    if (!idSet.has(id)) escalate(`row_id ${id} is missing from the union of parts.`);
  }
  if (idSet.size !== sourceIds.size) {
    escalate('union of parts is not exactly the source row set.');
  }

  // Step 7: write blind-01..21.csv.
  parts.forEach((part, i) => {
    const p = i + 1;
    const outPath = path.join(LABEL_DIR, `blind-${padPart(p)}.csv`);
    writeFileSync(outPath, toCsv(part.map(blindRow), BLIND_HEADER));
  });

  // Step 8: write key.csv (row_id, part, provider, method, path, operationId
  // — no class column, this corpus is unlabelled).
  const partOf = new Map();
  parts.forEach((part, i) => {
    const p = i + 1;
    for (const r of part) partOf.set(r.row_id, p);
  });
  const keyRows = rows
    .slice()
    .sort((a, b) => (a.row_id < b.row_id ? -1 : a.row_id > b.row_id ? 1 : 0))
    .map((r) => ({
      row_id: r.row_id,
      part: partOf.get(r.row_id),
      provider: r.provider,
      method: r.method,
      path: r.path,
      operationId: r.operationId,
    }));
  writeFileSync(KEY_OUT, toCsv(keyRows, KEY_HEADER));

  // Step 9: round-trip assertion — re-read every blind file with the same
  // parser and check row count + operationId/summary match the source row.
  const byRowId = new Map(rows.map((r) => [r.row_id, r]));
  let roundTripRows = 0;
  let roundTripOk = true;
  for (let p = 1; p <= NUM_PARTS; p++) {
    const outPath = path.join(LABEL_DIR, `blind-${padPart(p)}.csv`);
    const reread = parseCsv(readFileSync(outPath, 'utf8'));
    const expected = p < NUM_PARTS ? PART_SIZE : LAST_PART_SIZE;
    if (reread.length !== expected) {
      roundTripOk = false;
      console.error(`ESCALATE: round-trip: blind-${padPart(p)}.csv has ${reread.length} rows after re-read, expected ${expected}.`);
      continue;
    }
    for (const rr of reread) {
      const src = byRowId.get(rr.row_id);
      if (!src) {
        roundTripOk = false;
        console.error(`ESCALATE: round-trip: row_id ${rr.row_id} in blind-${padPart(p)}.csv not found in source rows.`);
        continue;
      }
      if (rr.operationId !== src.operationId || rr.summary !== (src.summary || '')) {
        roundTripOk = false;
        console.error(`ESCALATE: round-trip mismatch on ${rr.row_id}: operationId/summary do not match source.`);
        continue;
      }
      roundTripRows += 1;
    }
  }
  if (!roundTripOk) {
    escalate('round-trip assertion failed (see rows above).');
  }

  // Step 10: per-part provider-spread report.
  const providerSpreadReport = parts.map((part, i) => {
    const p = i + 1;
    const providers = new Set(part.map((r) => r.provider));
    return { part: p, n: part.length, distinctProviders: providers.size };
  });

  // Step 11: per-provider report (total rows, how many parts it spans).
  const byProvider = new Map();
  for (const r of rows) {
    if (!byProvider.has(r.provider)) byProvider.set(r.provider, { total: 0, parts: new Set() });
    byProvider.get(r.provider).total += 1;
  }
  for (const [p, part] of parts.entries()) {
    for (const r of part) {
      byProvider.get(r.provider).parts.add(p + 1);
    }
  }
  const providers = [...byProvider.keys()].sort();

  // --- report ---
  console.log('=== per-part size ===');
  for (const r of partSizeReport) console.log(`part ${padPart(r.part)}: ${r.n} rows`);

  console.log('\n=== per-provider (total rows, parts spanned) ===');
  for (const p of providers) {
    const info = byProvider.get(p);
    console.log(`${p}: ${info.total} rows, ${info.parts.size} parts`);
  }

  console.log('\n=== round-trip assertion ===');
  console.log(`OK: ${roundTripRows} rows re-read across ${NUM_PARTS} files, all row_id/operationId/summary matched source.`);

  console.log('\n=== provider spread per part ===');
  for (const r of providerSpreadReport) {
    console.log(`part ${padPart(r.part)}: ${r.n} rows, ${r.distinctProviders}/${providers.length} distinct providers`);
  }

  console.log(`\nWrote ${NUM_PARTS} blind files to ${LABEL_DIR}`);
  console.log(`Wrote ${KEY_OUT}`);

  writeReadme(providers.length);
  console.log(`Wrote ${README_OUT}`);
}

function writeReadme(numProviders) {
  const readme = `# data/provider-corpus-2026-09-16/label — blind labelling files

## What these are

Blind labelling files for the new 15-provider corpus
(\`data/provider-corpus-2026-09-16/ops.csv.gz\`, 4171 rows). This corpus
has **no truth labels yet** — the labels 21 blind labellers produce here
will BECOME the corpus's truth.

## Brief

Label every row under \`data/calibration-2026-09-14/BRIEF.md\`. That is the
exact brief path; do not use any other version.

## Split

- Seed: ${SEED} (mulberry32, one shuffle over all 4171 rows).
- 4171 rows split into 21 parts: parts 1-20 have 199 rows each, part 21 has
  191 rows (20*199 + 191 = 4171).
- Rows are shuffled across all ${numProviders} providers before splitting, so
  no labeller receives one provider's rows in a block.
- \`blind-01.csv\` … \`blind-21.csv\`: one file per labeller. Columns:
  \`row_id,provider,method,path,operationId,summary,description\`. No truth,
  class, confidence, part number, or classifier output.
- \`key.csv\`: \`row_id,part,provider,method,path,operationId\` — no class
  column, since there is no truth yet.

## Rules for labellers

- Open only your own \`blind-NN.csv\` file.
- Write only your own output file, named \`labels-NN.csv\` (same NN as your
  blind file), with columns \`row_id,class,confidence\`.
- Do not look at any other labeller's blind or output file.

## Reproduce

\`\`\`
node poc/provider-corpus/make-blind.mjs
\`\`\`

Deterministic: same seed (${SEED}), same \`ops.csv.gz\` -> byte-identical
output files, every run.
`;
  writeFileSync(README_OUT, readme);
}

main();
