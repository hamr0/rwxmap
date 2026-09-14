// data/exam5-2026-09-14: draw the first genuinely clean exam — 2000 rows
// from providers absent from the labelled corpus (5465 rows / 332
// vendors), exam 1 (200 rows / its own providers) and exam 4 (4000 rows /
// its own providers), checked under both name forms (raw and registrable)
// and both directions (drawn-vs-burned and burned-vs-drawn).
//
// Why this script exists: make-exam4.mjs's provider exclusion compared
// registrable names ("ably") against raw vendor tokens ("ably.net") and so
// excluded almost nothing — a bug discovered 2026-09-14 (see learnings).
// Exam 5's exclusion logic is written fresh below to close that gap; the
// registrableName()/VENDOR_NAME_ALIASES/cap-search/row_id/part-file/CSV
// pieces are otherwise reused verbatim from make-exam4.mjs.
//
// CRITICAL RAIL: this script never imports a classify function and never
// computes or records a predicted class. It imports loadRows() from
// poc/flow/corpus.mjs purely for the labelled corpus's provider and row
// identities (5465 rows, 332 vendors) — no truth file is read beyond what
// loadRows() reads internally, and no truth file for exam 1 or exam 4 is
// read at all (only their exam-blind.csv files, for row identities).
//
// Determinism: PRNG is a seeded mulberry32, seed = 20260914 (distinct from
// exam 1's 20260909, exam 2's 20260910, exam 3's 20260911, exam 4's
// 20260912). One PRNG stream is shared across the three stratified draws,
// in order PUT/DELETE/PATCH, then POST, then GET, so the same corpus file
// + seed always produces the same 2000 rows.
//
// Cap search: each stratum starts its own cap at 12 rows/provider (per
// spec) and raises it by 1 until that stratum's target is reachable; the
// final cap per stratum is reported.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from '../flow/csv.mjs';
import { loadRows } from '../flow/corpus.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const SEED = 20260914;
const CORPUS_GZ = path.join(REPO_ROOT, 'data/corpus/apis-guru-ops.csv.gz');
const EXAM1_BLIND = path.join(REPO_ROOT, 'data/exam-2026-09-09/exam-blind.csv');
const EXAM4_BLIND = path.join(REPO_ROOT, 'data/exam4-2026-09-12/exam-blind.csv');
const OUT_DIR = path.join(REPO_ROOT, 'data/exam5-2026-09-14');
const START_CAP = 12;

const STRATA = [
  { name: 'PUT/DELETE/PATCH', methods: new Set(['PUT', 'DELETE', 'PATCH']), target: 1500 },
  { name: 'POST', methods: new Set(['POST']), target: 300 },
  { name: 'GET', methods: new Set(['GET']), target: 200 },
];
const TARGET_N = STRATA.reduce((s, st) => s + st.target, 0);

// --- mulberry32: tiny seeded PRNG, deterministic across runs -------------
// Copied verbatim from make-exam4.mjs.
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

// --- registrable-name extraction, copied verbatim from make-exam4.mjs ----
const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk', 'gov.uk', 'ac.uk', 'org.uk',
  'com.au', 'gov.au',
  'co.za',
  'gov.in',
  'appspot.com', 'herokuapp.com', 'azurewebsites.net',
]);

const VENDOR_NAME_ALIASES = new Map([['amazonaws', 'amazon']]);

function registrableName(provider) {
  const labels = provider.toLowerCase().split('.');
  if (labels.length === 1) return labels[0];
  const lastTwo = labels.slice(-2).join('.');
  if (labels.length >= 3 && MULTI_LABEL_SUFFIXES.has(lastTwo)) {
    return labels[labels.length - 3];
  }
  return labels[labels.length - 2];
}

function canonicalRegistrableName(provider) {
  const name = registrableName(provider);
  return VENDOR_NAME_ALIASES.get(name) || name;
}

// --- CSV writing (no toCsv export in flow/csv.mjs; small helper, same
// quoting rule as make-calib5.mjs's) ---------------------------------------
function csvField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(rows, header) {
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map((h) => csvField(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

function existsOk(p) {
  try { readFileSync(p); return true; } catch { return false; }
}

function rowKey(provider, method, opPath, operationId) {
  return [provider, method, opPath, operationId].join('|');
}

// --- STEP 1: load the three burned identity sources -----------------------
// 1a. the labelled corpus (5465 rows / 332 vendors) via flow's loadRows().
const { rows: corpusRows, vendors: corpusVendors } = loadRows();
if (corpusRows.length !== 5465) {
  throw new Error(`ESCALATE: expected 5465 combined-corpus rows from loadRows(), got ${corpusRows.length}.`);
}
if (corpusVendors.length !== 332) {
  throw new Error(`ESCALATE: expected 332 combined-corpus vendors from loadRows(), got ${corpusVendors.length}.`);
}
console.log(`Loaded labelled corpus: ${corpusRows.length} rows, ${corpusVendors.length} vendors (via poc/flow/corpus.mjs loadRows()).`);

// 1b. exam 1's blind file (200 rows; providers not part of loadRows()'s set).
if (!existsOk(EXAM1_BLIND)) throw new Error(`ESCALATE: exam-1 blind file missing: ${EXAM1_BLIND}`);
const exam1Rows = parseCsv(readFileSync(EXAM1_BLIND, 'utf8'));
if (exam1Rows.length !== 200) {
  throw new Error(`ESCALATE: expected 200 exam-1 blind rows, got ${exam1Rows.length}.`);
}
console.log(`Loaded exam 1 blind file: ${exam1Rows.length} rows, ${new Set(exam1Rows.map((r) => r.provider)).size} providers.`);

// 1c. exam 4's blind file (4000 rows; providers were supposed to be, but
// were not correctly, excluded from the corpus and exam 1 already).
if (!existsOk(EXAM4_BLIND)) throw new Error(`ESCALATE: exam-4 blind file missing: ${EXAM4_BLIND}`);
const exam4Rows = parseCsv(readFileSync(EXAM4_BLIND, 'utf8'));
if (exam4Rows.length !== 4000) {
  throw new Error(`ESCALATE: expected 4000 exam-4 blind rows, got ${exam4Rows.length}.`);
}
console.log(`Loaded exam 4 blind file: ${exam4Rows.length} rows, ${new Set(exam4Rows.map((r) => r.provider)).size} providers.`);

// --- STEP 2: build BURNED_TOKENS (provider identities, both name forms) --
// and BURNED_ROW_KEYS (exact operation identities) from all three sources.
const burnedProviderStringsRaw = new Set(); // raw provider strings, original case
for (const v of corpusVendors) burnedProviderStringsRaw.add(v);
for (const r of exam1Rows) burnedProviderStringsRaw.add(r.provider);
for (const r of exam4Rows) burnedProviderStringsRaw.add(r.provider);

const BURNED_TOKENS = new Set(); // lowercase: raw + registrable(+alias) forms
for (const p of burnedProviderStringsRaw) {
  BURNED_TOKENS.add(p.toLowerCase());
  BURNED_TOKENS.add(canonicalRegistrableName(p));
}
console.log(`\nBURNED_TOKENS: ${burnedProviderStringsRaw.size} raw provider strings (corpus ${corpusVendors.length} + exam1 ${new Set(exam1Rows.map((r) => r.provider)).size} + exam4 ${new Set(exam4Rows.map((r) => r.provider)).size}, deduped) -> ${BURNED_TOKENS.size} distinct raw+registrable lowercase tokens.`);

const BURNED_ROW_KEYS = new Set();
for (const r of corpusRows) BURNED_ROW_KEYS.add(rowKey(r.vendor, r.method, r.path, r.operationId));
for (const r of exam1Rows) BURNED_ROW_KEYS.add(rowKey(r.provider, r.method, r.path, r.operationId));
for (const r of exam4Rows) BURNED_ROW_KEYS.add(rowKey(r.provider, r.method, r.path, r.operationId));
console.log(`BURNED_ROW_KEYS: ${BURNED_ROW_KEYS.size} distinct provider|method|path|operationId keys (of ${corpusRows.length + exam1Rows.length + exam4Rows.length} raw, so ${corpusRows.length + exam1Rows.length + exam4Rows.length - BURNED_ROW_KEYS.size} overlapped).`);

function isBurnedProvider(p) {
  return BURNED_TOKENS.has(p.toLowerCase()) || BURNED_TOKENS.has(canonicalRegistrableName(p));
}

// --- STEP 3: load the pool (gunzip via shell; no new deps) -----------------
if (!existsOk(CORPUS_GZ)) throw new Error(`ESCALATE: corpus pool file missing: ${CORPUS_GZ}`);
const poolCsvText = execSync(`gzip -dc ${JSON.stringify(CORPUS_GZ)}`, { maxBuffer: 1024 * 1024 * 512 }).toString('utf8');
const poolRows = parseCsv(poolCsvText);
const poolSizeBefore = poolRows.length;
const poolProviders = new Set(poolRows.map((r) => r.provider));
console.log(`\nLoaded ${poolSizeBefore} pool operations from ${poolProviders.size} providers (${CORPUS_GZ}).`);

// --- STEP 4: exclude burned providers (both name forms) --------------------
const excludedProviders = new Set();
for (const p of poolProviders) {
  if (isBurnedProvider(p)) excludedProviders.add(p);
}
let excludedOpCount = 0;
for (const r of poolRows) {
  if (excludedProviders.has(r.provider)) excludedOpCount += 1;
}
console.log(`\nExcluded ${excludedProviders.size} pool providers (raw or registrable-name match against BURNED_TOKENS), removing ${excludedOpCount} operations.`);
console.log(`Pool after exclusion: ${poolSizeBefore - excludedOpCount} rows / ${poolProviders.size - excludedProviders.size} providers.`);

// belt-and-braces row-level exclusion: any surviving-provider row whose
// exact key is still burned (should be 0 given provider exclusion above).
let excludedAsBurnedRow = 0;
const eligibleAll = poolRows.filter((r) => {
  if (excludedProviders.has(r.provider)) return false;
  if (!r.path || !r.method) return false;
  const key = rowKey(r.provider, r.method, r.path, r.operationId);
  if (BURNED_ROW_KEYS.has(key)) { excludedAsBurnedRow += 1; return false; }
  return true;
});
console.log(`Excluded ${excludedAsBurnedRow} additional rows by exact burned-row-key match (belt-and-braces; expected 0 since burned providers are already wholly excluded above).`);
console.log(`Eligible pool (all methods, non-empty path/method): ${eligibleAll.length} rows from ${new Set(eligibleAll.map((r) => r.provider)).size} providers.`);

// --- STEP 5: three stratified draws, one shared PRNG stream ---------------
const rng = mulberry32(SEED);
const selectedAll = [];
const strataReport = [];

for (const stratum of STRATA) {
  const eligible = eligibleAll.filter((r) => stratum.methods.has((r.method || '').toUpperCase()));
  if (eligible.length < stratum.target) {
    throw new Error(`ESCALATE: stratum ${stratum.name} has only ${eligible.length} eligible rows, fewer than its ${stratum.target} target.`);
  }
  const shuffled = seededShuffle(eligible, rng);

  let cap = START_CAP;
  let picked = null;
  while (picked === null) {
    const perProviderCount = new Map();
    const attempt = [];
    for (const row of shuffled) {
      const n = perProviderCount.get(row.provider) || 0;
      if (n >= cap) continue;
      attempt.push(row);
      perProviderCount.set(row.provider, n + 1);
      if (attempt.length === stratum.target) break;
    }
    if (attempt.length >= stratum.target) {
      picked = attempt.slice(0, stratum.target);
    } else {
      cap += 1;
      if (cap > 1000) throw new Error(`ESCALATE: cap search runaway for stratum ${stratum.name}.`);
    }
  }

  selectedAll.push(...picked);
  strataReport.push({
    name: stratum.name,
    target: stratum.target,
    eligiblePoolSize: eligible.length,
    eligibleProviders: new Set(eligible.map((r) => r.provider)).size,
    finalCap: cap,
    distinctProviders: new Set(picked.map((r) => r.provider)).size,
  });
  console.log(`\nStratum ${stratum.name}: target ${stratum.target}, eligible pool ${eligible.length} rows / ${new Set(eligible.map((r) => r.provider)).size} providers, final cap ${cap}, drawn from ${new Set(picked.map((r) => r.provider)).size} distinct providers.`);
}

if (selectedAll.length !== TARGET_N) {
  throw new Error(`ESCALATE: expected ${TARGET_N} total drawn rows, got ${selectedAll.length}.`);
}

// --- STEP 6: combine, sort, assign row_id -----------------------------------
selectedAll.sort((a, b) => {
  if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
  if (a.method !== b.method) return a.method.localeCompare(b.method);
  if (a.path !== b.path) return a.path.localeCompare(b.path);
  return a.operationId.localeCompare(b.operationId);
});
const withRowId = selectedAll.map((row, i) => ({ row_id: i + 1, ...row }));

// --- STEP 7: assertions ------------------------------------------------------
// 1. Provider-level, both directions.
const distinctDrawnProviders = new Set(withRowId.map((r) => r.provider));
const providerViolations = [];
for (const p of distinctDrawnProviders) {
  if (isBurnedProvider(p)) providerViolations.push(`drawn provider "${p}" is burned`);
}
for (const b of burnedProviderStringsRaw) {
  const bLower = b.toLowerCase();
  const bReg = canonicalRegistrableName(b);
  for (const p of distinctDrawnProviders) {
    if (p.toLowerCase() === bLower || canonicalRegistrableName(p) === bReg) {
      providerViolations.push(`burned provider "${b}" collides with drawn provider "${p}"`);
    }
  }
}
if (providerViolations.length > 0) {
  throw new Error(`ESCALATE: ${providerViolations.length} provider-level burn violations, e.g.: ${providerViolations.slice(0, 5).join('; ')}`);
}
console.log(`\nAssertion 1 (provider-level, both directions): 0 violations across ${distinctDrawnProviders.size} drawn providers vs ${burnedProviderStringsRaw.size} burned providers. PASS`);

// 2. Row-level.
const rowViolations = withRowId.filter((r) => BURNED_ROW_KEYS.has(rowKey(r.provider, r.method, r.path, r.operationId)));
if (rowViolations.length > 0) {
  throw new Error(`ESCALATE: ${rowViolations.length} drawn rows collide with a burned row key.`);
}
console.log(`Assertion 2 (row-level): 0 of ${withRowId.length} drawn rows collide with a burned corpus/exam1/exam4 row key. PASS`);

// 3. Counts.
const methodCounts = { PUT: 0, DELETE: 0, PATCH: 0, POST: 0, GET: 0 };
for (const r of withRowId) {
  const m = r.method.toUpperCase();
  if (methodCounts[m] === undefined) throw new Error(`ESCALATE: unexpected method "${m}" in drawn rows.`);
  methodCounts[m] += 1;
}
const putDelPatch = methodCounts.PUT + methodCounts.DELETE + methodCounts.PATCH;
if (withRowId.length !== 2000 || putDelPatch !== 1500 || methodCounts.POST !== 300 || methodCounts.GET !== 200) {
  throw new Error(`ESCALATE: count mismatch — total ${withRowId.length} (want 2000), PUT+DELETE+PATCH ${putDelPatch} (want 1500), POST ${methodCounts.POST} (want 300), GET ${methodCounts.GET} (want 200).`);
}
console.log(`Assertion 3 (counts): 2000 total, PUT+DELETE+PATCH=${putDelPatch}, POST=${methodCounts.POST}, GET=${methodCounts.GET}. PASS`);
console.log(`Method breakdown: PUT=${methodCounts.PUT}, DELETE=${methodCounts.DELETE}, PATCH=${methodCounts.PATCH}, POST=${methodCounts.POST}, GET=${methodCounts.GET}`);
console.log(`Distinct providers in final sample: ${distinctDrawnProviders.size}`);

// --- STEP 8: write outputs ---------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });

const blindHeader = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
const blindRows = withRowId.map((r) => ({
  row_id: r.row_id,
  provider: r.provider,
  method: r.method,
  path: r.path,
  operationId: r.operationId,
  summary: r.summary,
  description: r.description,
}));
writeFileSync(path.join(OUT_DIR, 'exam-blind.csv'), toCsv(blindRows, blindHeader), 'utf8');

const keyHeader = ['row_id', 'provider', 'api_key', 'method', 'path', 'operationId'];
const keyRows = withRowId.map((r) => ({
  row_id: r.row_id,
  provider: r.provider,
  api_key: r.api_key,
  method: r.method,
  path: r.path,
  operationId: r.operationId,
}));
writeFileSync(path.join(OUT_DIR, 'exam-key.csv'), toCsv(keyRows, keyHeader), 'utf8');

console.log(`\nWrote ${blindRows.length} rows to ${path.join(OUT_DIR, 'exam-blind.csv')}`);
console.log(`Wrote ${keyRows.length} rows to ${path.join(OUT_DIR, 'exam-key.csv')}`);

const PART_SIZE = 200;
const NUM_PARTS = TARGET_N / PART_SIZE;
for (let part = 1; part <= NUM_PARTS; part++) {
  const start = (part - 1) * PART_SIZE;
  const end = start + PART_SIZE;
  const slice = blindRows.slice(start, end);
  writeFileSync(
    path.join(OUT_DIR, `exam-blind-part${part}.csv`),
    toCsv(slice, blindHeader),
    'utf8',
  );
  console.log(`Wrote ${slice.length} rows to exam-blind-part${part}.csv (row_id ${slice[0]?.row_id}-${slice[slice.length - 1]?.row_id})`);
}

const blindCols = Object.keys(blindRows[0]);
const keyCols = Object.keys(keyRows[0]);
const hasClassCol = (cols) => cols.some((c) => /class/i.test(c));
console.log(`\nexam-blind.csv columns: ${blindCols.join(',')} — class column present: ${hasClassCol(blindCols)}`);
console.log(`exam-key.csv columns: ${keyCols.join(',')} — class column present: ${hasClassCol(keyCols)}`);

// --- STEP 9: README.md --------------------------------------------------------
const readmeLines = [
  '# data/exam5-2026-09-14 — exam 5 (first clean exam)',
  '',
  'Drawn 2026-09-14, seed 20260914, by `poc/exam/make-exam5.mjs`, from',
  '`data/corpus/apis-guru-ops.csv.gz` (123339 pool operations).',
  '',
  'This is the first exam drawn with a corrected provider-exclusion rule.',
  'Exam 4 (`data/exam4-2026-09-12/`) was meant to exclude every already-',
  'labelled provider but compared registrable names ("ably") against raw',
  'vendor tokens ("ably.net") and so excluded almost nothing — discovered',
  '2026-09-14 (see `docs/logs/learnings.md`). Exam 5 excludes any pool',
  'provider whose raw string, raw string lowercased, registrable name, or',
  'aliased registrable name matches a burned token, and checks the',
  'reverse direction too (every burned provider against every drawn',
  'provider, both name forms). Burned providers are the union of:',
  `  - the labelled corpus: ${corpusVendors.length} vendors from poc/flow/corpus.mjs loadRows() (${corpusRows.length} rows)`,
  `  - exam 1: ${new Set(exam1Rows.map((r) => r.provider)).size} providers from data/exam-2026-09-09/exam-blind.csv (${exam1Rows.length} rows)`,
  `  - exam 4: ${new Set(exam4Rows.map((r) => r.provider)).size} providers from data/exam4-2026-09-12/exam-blind.csv (${exam4Rows.length} rows)`,
  '',
  'Row-level and provider-level zero-intersection are asserted in the',
  'script itself (it throws an ESCALATE error and produces no output if',
  'either check fails) — see the run numbers below.',
  '',
  '## Run numbers (from the actual run that produced this directory)',
  '',
  `- Pool size: ${poolSizeBefore} operations from ${poolProviders.size} providers.`,
  `- BURNED_TOKENS: ${burnedProviderStringsRaw.size} raw provider strings -> ${BURNED_TOKENS.size} distinct raw+registrable lowercase tokens.`,
  `- Excluded pool providers: ${excludedProviders.size} (removing ${excludedOpCount} operations).`,
  `- Pool after provider exclusion: ${poolSizeBefore - excludedOpCount} rows / ${poolProviders.size - excludedProviders.size} providers.`,
  `- Belt-and-braces row-key exclusions on top of that: ${excludedAsBurnedRow} (expected 0).`,
  `- Eligible pool (all methods): ${eligibleAll.length} rows from ${new Set(eligibleAll.map((r) => r.provider)).size} providers.`,
  '',
  '| Stratum | Target | Eligible pool (rows/providers) | Final per-provider cap |',
  '|---|---|---|---|',
  ...strataReport.map((s) => `| ${s.name} | ${s.target} | ${s.eligiblePoolSize} / ${s.eligibleProviders} | ${s.finalCap} |`),
  '',
  `- Distinct providers drawn into the final 2000-row sample: ${distinctDrawnProviders.size}.`,
  `- Method split: PUT=${methodCounts.PUT}, DELETE=${methodCounts.DELETE}, PATCH=${methodCounts.PATCH}, POST=${methodCounts.POST}, GET=${methodCounts.GET}.`,
  '',
  '## Reproduce',
  '',
  '```',
  'node poc/exam/make-exam5.mjs',
  '```',
  '',
  'Same seed (20260914), same input files -> byte-identical output files',
  'every run.',
  '',
  '## Labelling',
  '',
  'Use the calibrated brief at `data/calibration-2026-09-14/BRIEF.md`.',
  '',
  '## Files',
  '',
  '- `exam-blind.csv` — all 2000 rows (row_id, provider, method, path,',
  '  operationId, summary, description). No class column.',
  '- `exam-key.csv` — row_id, provider, api_key, method, path, operationId',
  '  (for joining back to the pool after labelling; no class column).',
  '- `exam-blind-part1.csv` .. `exam-blind-part10.csv` — 200 rows each, in',
  '  row_id order, same header as `exam-blind.csv`, for parallel blind',
  '  labellers.',
  '- `exam-truth-part1.csv` .. `exam-truth-part10.csv` — NOT produced by',
  '  this script; written later by blind labellers, one per part.',
  '',
];
writeFileSync(path.join(OUT_DIR, 'README.md'), readmeLines.join('\n'), 'utf8');
console.log(`\nWrote README.md to ${path.join(OUT_DIR, 'README.md')}`);
