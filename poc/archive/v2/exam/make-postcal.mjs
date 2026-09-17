// data/calibration-2026-09-15: check the labelling brief's POST guidance
// (data/calibration-2026-09-14/BRIEF.md, "Methods" paragraph) against the
// corpus's own POST truth. Exam 5's POST rows scored badly, but the brief's
// POST guidance was never itself checked against corpus truth. This script
// prepares blind files so labellers can label the corpus's POST rows under
// the brief, to be compared with corpus truth later.
//
// 509 corpus POST rows are split, per-vendor, into a "measure" set (about
// 2/3) and a "holdback" set (about 1/3, kept unlabelled until a revised
// brief needs one check). The measure set is then mixed across vendors and
// cut into two labelling parts.
//
// Determinism: same seed, same corpus -> same output files, every run.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { toCsv } from '../flow/csv.mjs';
import { loadRows } from '../flow/corpus.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const OUT_DIR = path.join(REPO_ROOT, 'data/calibration-2026-09-15');
const BLIND_PART1_OUT = path.join(OUT_DIR, 'postcal-blind-part1.csv');
const BLIND_PART2_OUT = path.join(OUT_DIR, 'postcal-blind-part2.csv');
const HOLDBACK_BLIND_OUT = path.join(OUT_DIR, 'postcal-holdback-blind.csv');
const KEY_OUT = path.join(OUT_DIR, 'postcal-key.csv');
const README_OUT = path.join(OUT_DIR, 'README.md');

const SEED = 20260916;
const EXPECTED_POST = 509;

// --- mulberry32: tiny seeded PRNG, deterministic across runs -------------
// Copied verbatim from poc/exam/make-calib5.mjs (itself copied from
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

const BLIND_HEADER = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
const KEY_HEADER = ['row_id', 'corpus_index', 'set', 'vendor', 'method', 'path', 'operationId', 'split'];

function blindRow(r) {
  return {
    row_id: r.postcal_id,
    provider: r.vendor,
    method: r.method,
    path: r.path,
    operationId: r.operationId,
    summary: r.summary,
    description: r.description,
  };
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const { rows } = loadRows();

  // Step 1: POST rows with corpus_index recorded.
  const post = [];
  rows.forEach((row, idx) => {
    if (row.method === 'POST') post.push({ ...row, corpus_index: idx });
  });
  if (post.length !== EXPECTED_POST) {
    throw new Error(`ESCALATE: expected exactly ${EXPECTED_POST} POST rows, got ${post.length}.`);
  }

  // Step 2: stable order, assign postcal_id 1..509.
  post.sort((a, b) => {
    if (a.set !== b.set) return a.set < b.set ? -1 : 1;
    if (a.vendor !== b.vendor) return a.vendor < b.vendor ? -1 : 1;
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    if (a.operationId !== b.operationId) return a.operationId < b.operationId ? -1 : 1;
    return a.corpus_index - b.corpus_index;
  });
  post.forEach((row, i) => {
    row.postcal_id = i + 1;
  });

  // Step 3: one shared mulberry32 stream for the whole split.
  const rng = mulberry32(SEED);

  const vendors = [...new Set(post.map((r) => r.vendor))].sort();
  const byVendor = new Map();
  for (const v of vendors) byVendor.set(v, []);
  for (const r of post) byVendor.get(r.vendor).push(r);

  const measure = [];
  const holdback = [];
  const vendorCounts = [];
  for (const v of vendors) {
    const vRows = byVendor.get(v);
    const n = vRows.length;
    const shuffled = seededShuffle(vRows, rng);
    const measureCount = Math.round((n * 2) / 3);
    const vMeasure = shuffled.slice(0, measureCount);
    const vHoldback = shuffled.slice(measureCount);
    if (n >= 2 && (vMeasure.length === 0 || vHoldback.length === 0)) {
      throw new Error(
        `ESCALATE: vendor "${v}" has n=${n} but split gave measure=${vMeasure.length}, holdback=${vHoldback.length} (need >=1 each).`
      );
    }
    measure.push(...vMeasure);
    holdback.push(...vHoldback);
    vendorCounts.push({ vendor: v, n, measure: vMeasure.length, holdback: vHoldback.length });
  }

  // Step 4: mix measure rows across vendors, then split into two parts.
  const measureShuffled = seededShuffle(measure, rng);
  const part1Size = Math.ceil(measureShuffled.length / 2);
  const part1 = measureShuffled.slice(0, part1Size);
  const part2 = measureShuffled.slice(part1Size);

  const holdbackSorted = holdback.slice().sort((a, b) => a.postcal_id - b.postcal_id);

  // Step 5: write blind files (no truth/set/confidence columns).
  writeFileSync(BLIND_PART1_OUT, toCsv(part1.map(blindRow), BLIND_HEADER));
  writeFileSync(BLIND_PART2_OUT, toCsv(part2.map(blindRow), BLIND_HEADER));
  writeFileSync(HOLDBACK_BLIND_OUT, toCsv(holdbackSorted.map(blindRow), BLIND_HEADER));

  const splitOf = new Map();
  for (const r of part1) splitOf.set(r.postcal_id, 'measure-part1');
  for (const r of part2) splitOf.set(r.postcal_id, 'measure-part2');
  for (const r of holdbackSorted) splitOf.set(r.postcal_id, 'holdback');

  const keyRows = post
    .slice()
    .sort((a, b) => a.postcal_id - b.postcal_id)
    .map((r) => ({
      row_id: r.postcal_id,
      corpus_index: r.corpus_index,
      set: r.set,
      vendor: r.vendor,
      method: r.method,
      path: r.path,
      operationId: r.operationId,
      split: splitOf.get(r.postcal_id),
    }));
  writeFileSync(KEY_OUT, toCsv(keyRows, KEY_HEADER));

  // Step 7: asserts.
  const allIds = [...part1, ...part2, ...holdbackSorted].map((r) => r.postcal_id);
  if (allIds.length !== EXPECTED_POST) {
    throw new Error(`ESCALATE: part1+part2+holdback = ${allIds.length}, expected ${EXPECTED_POST}.`);
  }
  if (new Set(allIds).size !== allIds.length) {
    throw new Error('ESCALATE: a row_id repeats across part1/part2/holdback.');
  }
  for (const r of post) {
    const corpusRow = rows[r.corpus_index];
    if (
      corpusRow.vendor !== r.vendor ||
      corpusRow.method !== r.method ||
      corpusRow.path !== r.path ||
      corpusRow.operationId !== r.operationId ||
      (corpusRow.summary || '') !== r.summary ||
      (corpusRow.description || '') !== r.description
    ) {
      throw new Error(`ESCALATE: postcal_id ${r.postcal_id} fields do not match corpus row at index ${r.corpus_index}.`);
    }
  }

  // Step 6: report.
  console.log(`total ${post.length}, measure ${measure.length}, holdback ${holdbackSorted.length}`);
  console.log(`part1 ${part1.length}, part2 ${part2.length}`);
  console.log('vendor, n, measure, holdback');
  for (const vc of vendorCounts) {
    console.log(`${vc.vendor}, ${vc.n}, ${vc.measure}, ${vc.holdback}`);
  }
  console.log(`seed ${SEED}`);

  writeReadme(vendorCounts, post.length, measure.length, holdbackSorted.length, part1.length, part2.length);
}

function writeReadme(vendorCounts, total, measureCount, holdbackCount, part1Count, part2Count) {
  const table = vendorCounts
    .map((vc) => `| ${vc.vendor} | ${vc.n} | ${vc.measure} | ${vc.holdback} |`)
    .join('\n');

  const readme = `# data/calibration-2026-09-15 — POST calibration

## Purpose

Exam 5's POST rows scored badly, but the labelling brief's POST guidance
(\`data/calibration-2026-09-14/BRIEF.md\`, "Methods" paragraph) was never
checked against the corpus's own POST truth. This prepares blind files so
labellers can label the corpus's POST rows under the brief, to be compared
with corpus truth. A third is held back unlabelled, so a fixed brief can
later be checked once on rows it has not seen.

## Counts (this run)

- Total corpus POST rows: ${total}
- Measure (about 2/3, split across two labelling parts): ${measureCount}
  - Part 1: ${part1Count}
  - Part 2: ${part2Count}
- Holdback (about 1/3, unlabelled for now): ${holdbackCount}
- Seed: ${SEED}

## Per-vendor split

| vendor | n | measure | holdback |
|---|---|---|---|
${table}

## Files

- \`postcal-blind-part1.csv\`, \`postcal-blind-part2.csv\`: blind rows to label
  under \`data/calibration-2026-09-14/BRIEF.md\`. Columns: row_id, provider,
  method, path, operationId, summary, description. No truth, set, or
  confidence columns.
- \`postcal-holdback-blind.csv\`: same columns, holdback rows. Not to be
  labelled now — held back for a single later check of a revised brief.
- \`postcal-key.csv\`: row_id, corpus_index, set, vendor, method, path,
  operationId, split. No gt_class — truth is read from the corpus at score
  time via corpus_index.
- Labellers will produce \`postcal-labels-part1.csv\` and
  \`postcal-labels-part2.csv\` under this same directory.

## Reproduce

\`\`\`
node poc/exam/make-postcal.mjs
\`\`\`

Deterministic: same seed (${SEED}), same corpus -> same output files, every
run (byte-identical).

## Pre-registered reading (fixed before labelling)

Reading, fixed before labelling: if the brief agrees with corpus truth on
the measure rows at about the write-row rate (185 of 200, 92.5%) and calls
a similar share of rows x, the POST drop on exam 5 belongs to the tool. If
the brief calls clearly fewer rows x than corpus truth, the brief is loose
on POST and exam 5's POST score is not trustworthy until the brief is
fixed and checked once on the holdback.
`;
  writeFileSync(README_OUT, readme);
}

main();
