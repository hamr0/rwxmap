#!/usr/bin/env node
// Prepares blind labelling files so 9 blind labellers can each label ~202
// rows of the write-heavy build set corpus
// (data/buildset-2026-09-18/ops.csv.gz, 1819 rows across 13 apis-guru
// vendors) under data/calibration-2026-09-14/BRIEF.md. This corpus has no
// truth labels; the labels produced here will BECOME its truth.
//
// Every row gets a stable row_id (b0001..b1819, assigned in the order rows
// appear in ops.csv), then all rows are shuffled with a seeded PRNG so no
// labeller receives one vendor's rows in a block, then cut into 9 parts
// (8 of 202 rows, 1 of 203 rows -> 8*202 + 203 = 1819).
//
// The `b` prefix is deliberate: a build-set row id can never be confused
// with a 15-provider-corpus `rNNNN` id or the exam's `eNNNN` id.
//
// This script does exactly the job tools/make-exam-blind.js did for the
// clean exam corpus, and mirrors it step for step.
//
// This is a build/tuning set for MINING word lists, and NEVER an exam.
// The classifier's predictions are never read or joined here. These files
// carry no r/w/x information of any kind.
//
// Determinism: same seed, same ops.csv.gz -> byte-identical output files,
// every run.
//
// Usage: node tools/make-buildset-blind.js

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const OPS_GZ_PATH = path.join(REPO_ROOT, 'data/buildset-2026-09-18/ops.csv.gz');
const LABEL_DIR = path.join(REPO_ROOT, 'data/buildset-2026-09-18/label');
const KEY_OUT = path.join(LABEL_DIR, 'key.csv');
const README_OUT = path.join(LABEL_DIR, 'README.md');

const BRIEF_PATH = 'data/calibration-2026-09-14/BRIEF.md';

const SEED = 20260918;
const EXPECTED_ROWS = 1819;
const NUM_PARTS = 9;
const PART_SIZE = 202;
const LAST_PART_SIZE = 203;

// The ten exam vendors are locked and must never appear here (see
// docs/logs/pre-registered-split-2026-09-18.md).
const EXAM_VENDORS = [
  'auth0',
  'cloudflare',
  'hubspot',
  'zendesk',
  'pagerduty',
  'dropbox',
  'shopify',
  'linear',
  'miro',
  'sentry',
];

// Hard expectations for this build set. Any drift is an escalation, not a
// number to quietly adopt.
const EXPECTED_PROVIDERS = {
  'github.com': 150,
  'microsoft.com': 150,
  'gitea.io': 150,
  'appcenter.ms': 150,
  'netbox.dev': 150,
  'atlassian.com': 150,
  'dracoon.team': 150,
  'trello.com': 150,
  'gitlab.com': 150,
  'keycloak.local': 147,
  'box.com': 144,
  'clearblade.com': 126,
  'launchdarkly.com': 52,
};

const BLIND_HEADER = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
const KEY_HEADER = ['row_id', 'part', 'provider', 'method', 'path', 'operationId'];

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

// --- mulberry32: tiny seeded PRNG, deterministic across runs -------------
// Copied verbatim from tools/make-exam-blind.js (itself copied from
// archived code). Copied deliberately, not imported: the shuffle must be
// matched exactly rather than reinvented.
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
  return `b${String(i).padStart(4, '0')}`;
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

  // Step 1: stable row_id, assigned in ops.csv appearance order, BEFORE
  // any shuffling.
  const rows = rawRows.map((r, idx) => ({ ...r, row_id: padId(idx + 1) }));

  // Step 2: check the split arithmetic before doing anything else.
  const splitTotal = (NUM_PARTS - 1) * PART_SIZE + LAST_PART_SIZE;
  if (splitTotal !== EXPECTED_ROWS) {
    escalate(`split arithmetic wrong: ${NUM_PARTS - 1}*${PART_SIZE}+${LAST_PART_SIZE} = ${splitTotal}, expected ${EXPECTED_ROWS}.`);
  }
  if (8 * 202 + 203 !== 1819) {
    escalate('sanity check 8*202+203 === 1819 failed.');
  }

  // Step 3: per-provider counts must be exactly what this build set is
  // known to hold, and no unexpected provider may appear.
  const providerCounts = new Map();
  for (const r of rows) {
    providerCounts.set(r.provider, (providerCounts.get(r.provider) || 0) + 1);
  }
  for (const name of providerCounts.keys()) {
    if (!Object.hasOwn(EXPECTED_PROVIDERS, name)) {
      escalate(`unexpected provider "${name}" in ops.csv.`);
    }
  }
  for (const [name, expected] of Object.entries(EXPECTED_PROVIDERS)) {
    const got = providerCounts.get(name) || 0;
    if (got !== expected) {
      escalate(`provider ${name} has ${got} rows, expected ${expected}.`);
    }
  }

  // Step 3b: no drawn vendor may match any of the ten locked exam vendors.
  for (const name of providerCounts.keys()) {
    if (EXAM_VENDORS.includes(name)) {
      escalate(`provider "${name}" is a locked exam vendor and must not appear in the build set.`);
    }
  }

  // Step 4: seeded shuffle of the full row set.
  const rng = mulberry32(SEED);
  const shuffled = seededShuffle(rows, rng);

  // Step 5: cut into 9 parts.
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

  // Step 6: per-part size check.
  const partSizeReport = [];
  parts.forEach((part, i) => {
    const p = i + 1;
    const expected = p < NUM_PARTS ? PART_SIZE : LAST_PART_SIZE;
    if (part.length !== expected) {
      escalate(`part ${p} has ${part.length} rows, expected ${expected}.`);
    }
    partSizeReport.push({ part: p, n: part.length });
  });

  // Step 7: row_id uniqueness + union-of-parts-is-exactly-the-1819-rows check.
  const allIds = parts.flat().map((r) => r.row_id);
  if (allIds.length !== EXPECTED_ROWS) {
    escalate(`union of parts has ${allIds.length} rows, expected ${EXPECTED_ROWS}.`);
  }
  const idSet = new Set(allIds);
  if (idSet.size !== allIds.length) {
    escalate('a row_id repeats across parts.');
  }
  const sourceIds = new Set(rows.map((r) => r.row_id));
  if (sourceIds.size !== EXPECTED_ROWS) {
    escalate(`source row_ids are not unique: ${sourceIds.size} distinct for ${EXPECTED_ROWS} rows.`);
  }
  for (const id of sourceIds) {
    if (!idSet.has(id)) escalate(`row_id ${id} is missing from the union of parts.`);
  }
  if (idSet.size !== sourceIds.size) {
    escalate('union of parts is not exactly the source row set.');
  }

  // Step 8: write blind-1.csv .. blind-9.csv (single digit — there are only
  // nine parts, and the naming is single-digit everywhere, README included).
  parts.forEach((part, i) => {
    const p = i + 1;
    const outPath = path.join(LABEL_DIR, `blind-${p}.csv`);
    writeFileSync(outPath, toCsv(part.map(blindRow), BLIND_HEADER));
  });

  // Step 9: write key.csv (row_id, part, provider, method, path, operationId
  // — no class column, this corpus is unlabelled), sorted by row_id.
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

  // Step 10: round-trip assertion — re-read every blind file with the same
  // parser and check row count + row_id/operationId/summary match the source.
  const byRowId = new Map(rows.map((r) => [r.row_id, r]));
  let roundTripRows = 0;
  let roundTripOk = true;
  for (let p = 1; p <= NUM_PARTS; p++) {
    const outPath = path.join(LABEL_DIR, `blind-${p}.csv`);
    const reread = parseCsv(readFileSync(outPath, 'utf8'));
    const expected = p < NUM_PARTS ? PART_SIZE : LAST_PART_SIZE;
    if (reread.length !== expected) {
      roundTripOk = false;
      console.error(`ESCALATE: round-trip: blind-${p}.csv has ${reread.length} rows after re-read, expected ${expected}.`);
      continue;
    }
    for (const rr of reread) {
      const src = byRowId.get(rr.row_id);
      if (!src) {
        roundTripOk = false;
        console.error(`ESCALATE: round-trip: row_id ${rr.row_id} in blind-${p}.csv not found in source rows.`);
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

  // Step 11: per-part vendor-spread report.
  const providerSpreadReport = parts.map((part, i) => ({
    part: i + 1,
    n: part.length,
    distinctProviders: new Set(part.map((r) => r.provider)).size,
  }));

  // Step 12: per-part empty-text report.
  const emptyTextReport = parts.map((part, i) => ({
    part: i + 1,
    n: part.length,
    emptyDescription: part.filter((r) => !(r.description || '').trim()).length,
    emptySummary: part.filter((r) => !(r.summary || '').trim()).length,
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
  console.log('=== per-part size ===');
  for (const r of partSizeReport) console.log(`part ${r.part}: ${r.n} rows`);

  console.log('\n=== per-provider (total rows, parts spanned) ===');
  for (const p of providers) {
    const info = byProvider.get(p);
    console.log(`${p}: ${info.total} rows, ${info.parts.size} of ${NUM_PARTS} parts`);
  }

  console.log('\n=== round-trip assertion ===');
  console.log(`OK: ${roundTripRows} rows re-read across ${NUM_PARTS} files, all row_id/operationId/summary matched source.`);

  console.log('\n=== provider spread per part ===');
  for (const r of providerSpreadReport) {
    console.log(`part ${r.part}: ${r.n} rows, ${r.distinctProviders}/${providers.length} distinct providers`);
  }

  console.log('\n=== empty text per part (blind-text load) ===');
  for (const r of emptyTextReport) {
    console.log(`part ${r.part}: ${r.emptyDescription}/${r.n} rows with no description, ${r.emptySummary}/${r.n} rows with no summary`);
  }

  console.log(`\nWrote ${NUM_PARTS} blind files to ${LABEL_DIR}`);
  console.log(`Wrote ${KEY_OUT}`);

  writeReadme(providers.length);
  console.log(`Wrote ${README_OUT}`);
}

function writeReadme(numProviders) {
  const readme = `# data/buildset-2026-09-18/label — blind labelling files

## What these are

Blind labelling files for the write-heavy BUILD SET corpus
(\`data/buildset-2026-09-18/ops.csv.gz\`, ${EXPECTED_ROWS} rows across ${numProviders}
apis-guru vendors). This corpus has **no truth labels** — the labels 9
blind labellers produce here will BECOME its truth.

**This is a build/tuning set for MINING word lists. It is NEVER an exam.**
The ten locked exam vendors — auth0, cloudflare, hubspot, zendesk,
pagerduty, dropbox, shopify, linear, miro, sentry — are named in
\`docs/logs/pre-registered-split-2026-09-18.md\` and none of them appears
here. Nobody opens, reads, or mines the exam vendors until a fresh exam is
drawn from official complete specs.

These files carry no r/w/x information of any kind. The frozen
classifier's predictions for these rows exist elsewhere in the repo and
are never read, joined or hinted at here: a labeller must not be able to
see what the tool guessed.

## Brief

Label every row under \`${BRIEF_PATH}\`. That is the exact brief path; no
other version of the brief may be used.

## Split

- Seed: ${SEED} (mulberry32, one shuffle over all ${EXPECTED_ROWS} rows).
- ${EXPECTED_ROWS} rows split into ${NUM_PARTS} parts: parts 1-${NUM_PARTS - 1} have ${PART_SIZE} rows each,
  part ${NUM_PARTS} has ${LAST_PART_SIZE} rows (${NUM_PARTS - 1}*${PART_SIZE} + ${LAST_PART_SIZE} = ${EXPECTED_ROWS}).
- Rows are shuffled across all ${numProviders} vendors before splitting, so no
  labeller receives one vendor's rows in a block.
- \`blind-1.csv\` … \`blind-${NUM_PARTS}.csv\`: one file per labeller, single-digit
  naming. Columns: \`row_id,provider,method,path,operationId,summary,description\`.
  No truth, class, confidence, part number, or classifier output.
- \`key.csv\`: \`row_id,part,provider,method,path,operationId\` — no class
  column, since there is no truth yet.
- Row ids run \`b0001\`..\`b${EXPECTED_ROWS}\`, assigned in \`ops.csv\` order before the
  shuffle. The \`b\` prefix is deliberate, so a build-set row id can never be
  confused with a 15-provider-corpus \`rNNNN\` id or the exam's \`eNNNN\` id.

## Rules for labellers

- Open only your own \`blind-N.csv\` file.
- Write only your own output file, named \`labels-N.csv\` (same N as your
  blind file), and use your own uniquely-named scratch files — never a name
  another labeller might also use.
- Output columns are exactly \`row_id,truth_class,confidence,reason\`, as the
  brief specifies: \`truth_class\` is r, w, x or ?; \`confidence\` is EXACTLY
  \`high\` or \`low\` (there is no medium, and any other value means the file
  is rejected); \`reason\` is a short phrase under 15 words with no commas
  (or the whole reason double-quoted) naming the rule or road applied. One
  line per input row, same order, no rows skipped, no extras.
- Do not look at any other labeller's blind or output file.

## Reproduce

\`\`\`
node tools/make-buildset-blind.js
\`\`\`

Deterministic: same seed (${SEED}), same \`ops.csv.gz\` -> byte-identical
output files, every run.
`;
  writeFileSync(README_OUT, readme);
}

main();
