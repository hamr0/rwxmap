#!/usr/bin/env node
// Prepares blind RELABEL files so every non-r row of the combined set
// (data/combined-2026-09-21/rows.json.gz, 6557 rows across 23 providers)
// can be relabelled under data/relabel-2026-09-22/BRIEF-v3.md, the D87
// definition (the chmod reading: w = can be set back by a later call,
// x = cannot; "whose thing it is" leaves the class).
//
// v3 is NOT one-directional against v1: a v1 x can become a v3 w and a
// v1 w can become a v3 x. So every v1 truth-w AND truth-x row is
// relabelled; only v1 truth-r labels stand.
//
// Two draws come out of ONE seeded shuffle of the 3852 non-r rows:
//   - calibration: shuffled rows 1-100 -> calib/practice-blind.csv,
//     rows 101-200 -> calib/holdback-blind.csv (disjoint by construction,
//     asserted anyway). Practice is labelled by two labellers and read row
//     by row; holdback is measured once, then burned.
//   - relabel: ALL 3852 shuffled rows (calibration rows included) cut into
//     9 parts (9 of 428 -> 8*428 + 428 = 3852) as label/blind-1.csv ..
//     blind-9.csv.
//
// row_ids are kept exactly as the combined set has them (pc-r0001,
// x17-e0001, x20-e0001); nothing is renumbered.
//
// This is TUNING DATA. Every source in the combined set is either the
// tuning corpus or a burned exam (D24); relabelling burned exam rows does
// not unburn them. The classifier's predictions are never read or joined
// here. The written files carry no r/w/x information of any kind; the
// per-part v1-truth balance is printed to stdout ONLY, never written.
//
// Determinism: same seed, same rows.json.gz -> byte-identical output
// files, every run.
//
// Usage: node tools/make-relabel-2026-09-22.js

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseCsv, toCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const ROWS_PATH = path.join(REPO_ROOT, 'data/combined-2026-09-21/rows.json.gz');
const OUT_DIR = path.join(REPO_ROOT, 'data/relabel-2026-09-22');
const CALIB_DIR = path.join(OUT_DIR, 'calib');
const LABEL_DIR = path.join(OUT_DIR, 'label');
const KEY_OUT = path.join(LABEL_DIR, 'key.csv');
const README_OUT = path.join(OUT_DIR, 'README.md');

const BRIEF_PATH = 'data/relabel-2026-09-22/BRIEF-v3.md';

const SEED = 20260922;
const EXPECTED_COMBINED_ROWS = 6557;
const EXPECTED_NON_R_ROWS = 3852;
const EXPECTED_V1_W_ROWS = 2266;
const EXPECTED_V1_X_ROWS = 1586;
const EXPECTED_ROWS_SHA256 = '3d07a5a410c91d2ef10494d8d91bcb01290acb1e67f7a89d85866781d1d38c5f';
const NUM_PARTS = 9;
const CALIB_SIZE = 100;

// Methods and sources are reported, not asserted: the row-count and
// class-count assertions above pin the set; these are printed so the
// orchestrator can verify them by eye.
const METHOD_NAMES = ['POST', 'PUT', 'DELETE', 'PATCH', 'GET'];
const SOURCE_NAMES = ['pc', 'x17', 'x20'];

const BLIND_HEADER = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
const CALIB_KEY_HEADER = ['row_id', 'provider', 'method', 'path', 'operationId'];
const KEY_HEADER = ['row_id', 'part', 'provider', 'method', 'path', 'operationId'];

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

// --- mulberry32: tiny seeded PRNG, deterministic across runs -------------
// Copied verbatim from tools/make-exam-blind-2026-09-20.js. Copied
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

// --- load ------------------------------------------------------------------

function loadRows() {
  const buf = gunzipSync(readFileSync(ROWS_PATH));
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== EXPECTED_ROWS_SHA256) {
    escalate(`rows.json sha256 is ${sha}, expected ${EXPECTED_ROWS_SHA256}.`);
  }
  const rows = JSON.parse(buf.toString('utf8'));
  if (!Array.isArray(rows)) escalate('rows.json is not a JSON array.');
  const requiredCols = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description', 'truth'];
  for (const col of requiredCols) {
    if (rows.length && !Object.hasOwn(rows[0], col)) escalate(`rows.json is missing required field "${col}"`);
  }
  return { rows, sha };
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

function byRowIdAsc(a, b) {
  return a.row_id < b.row_id ? -1 : a.row_id > b.row_id ? 1 : 0;
}

function sourceOf(r) {
  return r.row_id.split('-')[0];
}

function countBy(rows, keyFn) {
  const counts = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

// --- main --------------------------------------------------------------------

function main() {
  mkdirSync(CALIB_DIR, { recursive: true });
  mkdirSync(LABEL_DIR, { recursive: true });

  const { rows: combined, sha } = loadRows();
  if (combined.length !== EXPECTED_COMBINED_ROWS) {
    escalate(`expected exactly ${EXPECTED_COMBINED_ROWS} combined rows, got ${combined.length}.`);
  }

  // Step 1: keep every non-r row (v1 truth-w and truth-x). row_ids stay
  // as they are.
  const rows = combined.filter((r) => r.truth !== 'r');
  if (rows.length !== EXPECTED_NON_R_ROWS) {
    escalate(`expected exactly ${EXPECTED_NON_R_ROWS} non-r rows, got ${rows.length}.`);
  }
  const truthCounts = countBy(rows, (r) => r.truth);
  for (const t of truthCounts.keys()) {
    if (t !== 'w' && t !== 'x') escalate(`unexpected truth "${t}" among non-r rows.`);
  }
  if ((truthCounts.get('w') || 0) !== EXPECTED_V1_W_ROWS) {
    escalate(`expected ${EXPECTED_V1_W_ROWS} v1 truth-w rows, got ${truthCounts.get('w') || 0}.`);
  }
  if ((truthCounts.get('x') || 0) !== EXPECTED_V1_X_ROWS) {
    escalate(`expected ${EXPECTED_V1_X_ROWS} v1 truth-x rows, got ${truthCounts.get('x') || 0}.`);
  }
  const sourceIds = new Set(rows.map((r) => r.row_id));
  if (sourceIds.size !== rows.length) {
    escalate(`source row_ids are not unique: ${sourceIds.size} distinct for ${rows.length} rows.`);
  }

  // Step 2: method and source counts are reported, not asserted. An
  // unknown method or source prefix is still an escalation.
  const methodCounts = countBy(rows, (r) => r.method);
  for (const name of methodCounts.keys()) {
    if (!METHOD_NAMES.includes(name)) escalate(`unexpected method "${name}" among non-r rows.`);
  }
  const sourceCounts = countBy(rows, sourceOf);
  for (const name of sourceCounts.keys()) {
    if (!SOURCE_NAMES.includes(name)) escalate(`unexpected row_id source prefix "${name}" among non-r rows.`);
  }

  // Step 3: derive the split from the real row count, then check the
  // arithmetic before doing anything else.
  const partSize = Math.floor(rows.length / NUM_PARTS);
  const lastPartSize = rows.length - (NUM_PARTS - 1) * partSize;
  if (partSize < 1) escalate(`too few rows (${rows.length}) to cut into ${NUM_PARTS} parts.`);
  const splitTotal = (NUM_PARTS - 1) * partSize + lastPartSize;
  if (splitTotal !== rows.length) {
    escalate(`split arithmetic wrong: ${NUM_PARTS - 1}*${partSize}+${lastPartSize} = ${splitTotal}, expected ${rows.length}.`);
  }
  if (rows.length < 2 * CALIB_SIZE) {
    escalate(`too few rows (${rows.length}) for two calibration draws of ${CALIB_SIZE}.`);
  }

  // Step 4: ONE seeded shuffle of the full non-r row set.
  const rng = mulberry32(SEED);
  const shuffled = seededShuffle(rows, rng);

  // Step 5: calibration draws off the front of the shuffle.
  const practice = shuffled.slice(0, CALIB_SIZE);
  const holdback = shuffled.slice(CALIB_SIZE, 2 * CALIB_SIZE);
  if (practice.length !== CALIB_SIZE || holdback.length !== CALIB_SIZE) {
    escalate(`calibration draws are ${practice.length}/${holdback.length} rows, expected ${CALIB_SIZE} each.`);
  }
  const practiceIds = new Set(practice.map((r) => r.row_id));
  for (const r of holdback) {
    if (practiceIds.has(r.row_id)) escalate(`row_id ${r.row_id} is in both practice and holdback draws.`);
  }

  writeFileSync(path.join(CALIB_DIR, 'practice-blind.csv'), toCsv(practice.map(blindRow), BLIND_HEADER));
  writeFileSync(path.join(CALIB_DIR, 'holdback-blind.csv'), toCsv(holdback.map(blindRow), BLIND_HEADER));
  writeFileSync(path.join(CALIB_DIR, 'practice-key.csv'), toCsv(practice.map(calibKeyRow), CALIB_KEY_HEADER));
  writeFileSync(path.join(CALIB_DIR, 'holdback-key.csv'), toCsv(holdback.map(calibKeyRow), CALIB_KEY_HEADER));

  // Step 6: cut ALL shuffled rows (calibration rows included) into 9 parts.
  const parts = [];
  let offset = 0;
  for (let p = 1; p <= NUM_PARTS; p++) {
    const size = p < NUM_PARTS ? partSize : lastPartSize;
    parts.push(shuffled.slice(offset, offset + size));
    offset += size;
  }
  if (offset !== rows.length) escalate(`parts consumed ${offset} rows, expected ${rows.length}.`);

  // Step 7: per-part size check.
  const partSizeReport = [];
  parts.forEach((part, i) => {
    const p = i + 1;
    const expected = p < NUM_PARTS ? partSize : lastPartSize;
    if (part.length !== expected) escalate(`part ${p} has ${part.length} rows, expected ${expected}.`);
    partSizeReport.push({ part: p, n: part.length });
  });

  // Step 8: row_id uniqueness + union-of-parts-is-exactly-the-source-rows check.
  const allIds = parts.flat().map((r) => r.row_id);
  if (allIds.length !== rows.length) escalate(`union of parts has ${allIds.length} rows, expected ${rows.length}.`);
  const idSet = new Set(allIds);
  if (idSet.size !== allIds.length) escalate('a row_id repeats across parts.');
  for (const id of sourceIds) {
    if (!idSet.has(id)) escalate(`row_id ${id} is missing from the union of parts.`);
  }
  if (idSet.size !== sourceIds.size) escalate('union of parts is not exactly the source row set.');

  // Step 9: write blind-1.csv .. blind-9.csv (single digit — there are only
  // nine parts, and the naming is single-digit everywhere, README included).
  parts.forEach((part, i) => {
    const p = i + 1;
    writeFileSync(path.join(LABEL_DIR, `blind-${p}.csv`), toCsv(part.map(blindRow), BLIND_HEADER));
  });

  // Step 10: write key.csv (row_id, part, provider, method, path,
  // operationId — no class column), sorted by row_id.
  const partOf = new Map();
  parts.forEach((part, i) => {
    for (const r of part) partOf.set(r.row_id, i + 1);
  });
  const keyRows = rows
    .slice()
    .sort(byRowIdAsc)
    .map((r) => ({ ...calibKeyRow(r), part: partOf.get(r.row_id) }));
  writeFileSync(KEY_OUT, toCsv(keyRows, KEY_HEADER));

  // Step 11: round-trip assertion — re-read every blind file (parts and
  // calibration) with the same parser and check row count +
  // row_id/operationId/summary match the source.
  const byRowId = new Map(rows.map((r) => [r.row_id, r]));
  let roundTripRows = 0;
  let roundTripOk = true;
  const toReread = [
    ...parts.map((part, i) => ({ name: `label/blind-${i + 1}.csv`, file: path.join(LABEL_DIR, `blind-${i + 1}.csv`), expected: part.length })),
    { name: 'calib/practice-blind.csv', file: path.join(CALIB_DIR, 'practice-blind.csv'), expected: CALIB_SIZE },
    { name: 'calib/holdback-blind.csv', file: path.join(CALIB_DIR, 'holdback-blind.csv'), expected: CALIB_SIZE },
  ];
  for (const { name, file, expected } of toReread) {
    const reread = parseCsv(readFileSync(file, 'utf8'));
    if (reread.length !== expected) {
      roundTripOk = false;
      console.error(`ESCALATE: round-trip: ${name} has ${reread.length} rows after re-read, expected ${expected}.`);
      continue;
    }
    for (const rr of reread) {
      const src = byRowId.get(rr.row_id);
      if (!src) {
        roundTripOk = false;
        console.error(`ESCALATE: round-trip: row_id ${rr.row_id} in ${name} not found in source rows.`);
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
  if (!roundTripOk) escalate('round-trip assertion failed (see rows above).');

  // Step 12: per-part reports (vendor spread, empty text, method counts,
  // v1-truth balance). The v1-truth balance goes to stdout ONLY.
  const providerSpreadReport = parts.map((part, i) => ({
    part: i + 1,
    n: part.length,
    distinctProviders: new Set(part.map((r) => r.provider)).size,
  }));
  const emptyTextReport = parts.map((part, i) => ({
    part: i + 1,
    n: part.length,
    emptyDescription: part.filter((r) => !(r.description || '').trim()).length,
    emptySummary: part.filter((r) => !(r.summary || '').trim()).length,
  }));
  const methodReport = parts.map((part, i) => {
    const counts = {};
    for (const m of METHOD_NAMES) counts[m] = part.filter((r) => r.method === m).length;
    return { part: i + 1, n: part.length, counts };
  });
  const truthBalanceReport = parts.map((part, i) => ({
    part: i + 1,
    n: part.length,
    w: part.filter((r) => r.truth === 'w').length,
    x: part.filter((r) => r.truth === 'x').length,
  }));

  // Step 13: per-provider report (total rows, how many parts it spans).
  const byProvider = new Map();
  for (const r of rows) {
    if (!byProvider.has(r.provider)) byProvider.set(r.provider, { total: 0, parts: new Set() });
    byProvider.get(r.provider).total += 1;
  }
  for (const [p, part] of parts.entries()) {
    for (const r of part) byProvider.get(r.provider).parts.add(p + 1);
  }
  const providers = [...byProvider.keys()].sort();

  // --- report ---
  console.log(`=== source ===`);
  console.log(`rows.json sha256 ${sha}`);
  console.log(`${combined.length} combined rows, ${rows.length} non-r rows kept (v1 truth-w ${truthCounts.get('w')}, v1 truth-x ${truthCounts.get('x')})`);
  console.log(`non-r by method: ${METHOD_NAMES.map((m) => `${m} ${methodCounts.get(m) || 0}`).join(', ')}`);
  console.log(`non-r by source: ${SOURCE_NAMES.map((s) => `${s} ${sourceCounts.get(s) || 0}`).join(', ')}`);

  console.log('\n=== calibration draws ===');
  console.log(`practice: ${practice.length} rows (shuffled 1-${CALIB_SIZE}), holdback: ${holdback.length} rows (shuffled ${CALIB_SIZE + 1}-${2 * CALIB_SIZE}), disjoint OK`);

  console.log('\n=== per-part size ===');
  for (const r of partSizeReport) console.log(`part ${r.part}: ${r.n} rows`);

  console.log('\n=== per-provider (total rows, parts spanned) ===');
  for (const p of providers) {
    const info = byProvider.get(p);
    console.log(`${p}: ${info.total} rows, ${info.parts.size} of ${NUM_PARTS} parts`);
  }

  console.log('\n=== round-trip assertion ===');
  console.log(`OK: ${roundTripRows} rows re-read across ${toReread.length} files (${NUM_PARTS} parts + 2 calibration), all row_id/operationId/summary matched source.`);

  console.log('\n=== provider spread per part ===');
  for (const r of providerSpreadReport) {
    console.log(`part ${r.part}: ${r.n} rows, ${r.distinctProviders}/${providers.length} distinct providers`);
  }

  console.log('\n=== empty text per part (blind-text load) ===');
  for (const r of emptyTextReport) {
    console.log(`part ${r.part}: ${r.emptyDescription}/${r.n} rows with no description, ${r.emptySummary}/${r.n} rows with no summary`);
  }

  console.log('\n=== method per part ===');
  for (const r of methodReport) {
    console.log(`part ${r.part}: ${METHOD_NAMES.map((m) => `${m} ${r.counts[m]}`).join(', ')}`);
  }

  console.log('\n=== v1-truth balance per part (stdout only, never written) ===');
  for (const r of truthBalanceReport) {
    console.log(`part ${r.part}: w ${r.w}, x ${r.x} (of ${r.n})`);
  }

  console.log(`\nWrote 4 calibration files to ${CALIB_DIR}`);
  console.log(`Wrote ${NUM_PARTS} blind files to ${LABEL_DIR}`);
  console.log(`Wrote ${KEY_OUT}`);

  writeReadme(providers.length, combined.length, rows.length, partSize, lastPartSize, sha);
  console.log(`Wrote ${README_OUT}`);
}

function writeReadme(numProviders, numCombined, numRows, partSize, lastPartSize, sha) {
  const readme = `# data/relabel-2026-09-22 — relabel of every non-r row under BRIEF-v3 (D87)

## What this is

Blind relabelling files for the ${numRows} rows of the combined set
(\`data/combined-2026-09-21/rows.json.gz\`, ${numCombined} rows across
${numProviders} providers) whose v1 truth is \`w\` or \`x\`, to be relabelled
under \`${BRIEF_PATH}\` — the D87 definition (the chmod
reading: w if a later call of the same API can set it back, x if it
cannot; "whose thing it is" leaves the class).

v3 is bidirectional against v1: a v1 x can become a v3 w and a v1 w
can become a v3 x. So both v1 truth-w and v1 truth-x rows are in here.
v1 truth-r labels stand as they are and are not relabelled.

**This stays TUNING DATA.** Every source in the combined set is either
the tuning corpus (\`pc-\`) or a burned exam (\`x17-\`, \`x20-\`; D24).
Relabelling burned exam rows does not unburn them: no number computed
over these rows is a generalization claim.

These files carry no r/w/x information of any kind. The classifier's
predictions for these rows are never read, joined or hinted at here: a
labeller must not be able to see what the tool guessed, nor the v1 label.

## Brief

Label every row under \`${BRIEF_PATH}\`. That is the exact brief
path; no other version of the brief may be used.

## Calibration (\`calib/\`)

BRIEF-v3 is a DRAFT until it is calibrated. Two draws off the front of
the one seeded shuffle:

- \`practice-blind.csv\` (${CALIB_SIZE} rows, shuffled positions 1-${CALIB_SIZE}): two
  labellers label it blind under BRIEF-v3; their disagreements are read
  row by row and ruled by the user; the brief is revised if a ruling
  shows a gap.
- \`holdback-blind.csv\` (${CALIB_SIZE} rows, shuffled positions ${CALIB_SIZE + 1}-${2 * CALIB_SIZE}): measured
  ONCE against the calibrated brief, then burned as a calibration set.
- \`practice-key.csv\`, \`holdback-key.csv\`: \`row_id,provider,method,path,operationId\`
  — no class column.

The two draws are disjoint (asserted). Both are also part of the main
relabel below: the calibration rows get relabelled in the main run too.

## Split (\`label/\`)

- Seed: ${SEED} (mulberry32, one shuffle over all ${numRows} rows; the
  calibration draws are the first ${2 * CALIB_SIZE} rows of that same shuffle).
- ${numRows} rows split into ${NUM_PARTS} parts: parts 1-${NUM_PARTS - 1} have ${partSize} rows each,
  part ${NUM_PARTS} has ${lastPartSize} rows (${NUM_PARTS - 1}*${partSize} + ${lastPartSize} = ${numRows}).
- Rows are shuffled across all ${numProviders} providers before splitting, so no
  labeller receives one provider's rows in a block.
- \`blind-1.csv\` … \`blind-${NUM_PARTS}.csv\`: one file per labeller, single-digit
  naming. Columns: \`row_id,provider,method,path,operationId,summary,description\`.
  No truth, class, confidence, part number, or classifier output.
- \`key.csv\`: \`row_id,part,provider,method,path,operationId\`, sorted by
  row_id — no class column.
- Row ids are kept exactly as the combined set has them (\`pc-r0001\`,
  \`x17-e0001\`, \`x20-e0001\`); nothing is renumbered, so a relabel joins
  back to \`rows.json.gz\` on \`row_id\` alone.

## Rules for labellers

- Open only your own \`blind-N.csv\` file.
- Write only your own output file, named \`labels-N.csv\` (same N as your
  blind file), and use your own uniquely-named scratch files — never a name
  another labeller might also use.
- Output columns are exactly \`row_id,truth_class,confidence,reason\`, as the
  brief specifies: \`truth_class\` is r, w, x or ?; \`confidence\` is EXACTLY
  \`high\` or \`low\` (there is no medium, and any other value means the file
  is rejected); \`reason\` is a short phrase under 15 words with no commas
  (or the whole reason double-quoted) naming the clause applied. One
  line per input row, same order, no rows skipped, no extras.
- Do not look at any other labeller's blind or output file.

## Reproduce

\`\`\`
node tools/make-relabel-2026-09-22.js
\`\`\`

Deterministic: same seed (${SEED}), same \`rows.json.gz\` -> byte-identical
output files, every run. The uncompressed \`rows.json\` has sha256
\`${sha}\`; the tool escalates on any other value.
`;
  writeFileSync(README_OUT, readme);
}

main();
