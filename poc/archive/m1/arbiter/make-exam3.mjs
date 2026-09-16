// M1 exam3-2026-09-11: draw a third, larger, never-seen exam sample from
// data/corpus/apis-guru-ops.csv.gz, using only providers that appear in
// NONE of our six labelled sets (camara, holdout1, holdout2 — all three
// loaded via loadCensusRows() — plus holdout3, holdout4, holdout5), AND
// excluding every row already drawn into exam-1
// (data/exam-2026-09-09/exam-blind.csv) or exam-2
// (data/exam2-2026-09-10/exam-blind.csv). Vendor-exclusion logic (STEP 1)
// is reused verbatim from make-exam.mjs / make-exam2.mjs, not rewritten.
//
// CRITICAL RAIL: this script never imports c15.mjs/c16.mjs/c17.mjs/c18.mjs
// or any classifier, and never computes or records a predicted class. It
// also never reads data/exam-2026-09-09/exam-truth.csv or any
// data/exam2-2026-09-10/exam-truth-part*.csv (answer keys for exams 1 and
// 2) — only the two exam-blind.csv files, to get row identities to
// exclude.
//
// Determinism: PRNG is a seeded mulberry32, seed = 20260911 (deliberately
// different from exam-1's 20260909 and exam-2's 20260910). Same seed, same
// corpus file, same exam-1/exam-2 blind files -> same 3000 rows, every run.
//
// Cap search: starts at 12 rows/provider (per spec) and raises by 1 until
// TARGET_N is reachable, or reports the eligible pool size if even a high
// cap can't reach it (no other rule is relaxed to compensate).
//
// Vendor-exclusion matching (STEP 1, copied from make-exam.mjs): see that
// file's header comment for the full rationale — registrable-domain, exact
// label match, case-insensitive, with a small hardcoded multi-label-suffix
// list and the amazonaws -> amazon alias.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { parseCsv, toCsv } from '../../m0/csv.mjs';
import { loadCensusRows, loadHoldout3, loadHoldout4, loadHoldout5, REPO_ROOT } from './load-sets.mjs';

const SEED = 20260911;
const CORPUS_GZ = path.join(REPO_ROOT, 'data/corpus/apis-guru-ops.csv.gz');
const EXAM1_BLIND = path.join(REPO_ROOT, 'data/exam-2026-09-09/exam-blind.csv');
const EXAM2_BLIND = path.join(REPO_ROOT, 'data/exam2-2026-09-10/exam-blind.csv');
const OUT_DIR = path.join(REPO_ROOT, 'data/exam3-2026-09-11');
const TARGET_N = 3000;
const START_CAP = 12;
const TARGET_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// --- mulberry32: tiny seeded PRNG, deterministic across runs -------------
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

// --- registrable-name extraction (STEP 1, verbatim from make-exam.mjs) ---
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

// --- STEP 1: collect vendor tokens from the six labelled sets -------------
function vendorTokensFromCensus(rows) {
  const tokens = new Set();
  for (const row of rows) {
    if (row.set === 'camara') tokens.add('camara');
    else if (row.repo) tokens.add(row.repo.toLowerCase());
  }
  return tokens;
}

function vendorTokensFromHoldoutRows(rows) {
  const tokens = new Set();
  if (!rows) return tokens;
  for (const row of rows) {
    if (row.repo) tokens.add(row.repo.toLowerCase());
  }
  return tokens;
}

const censusRows = loadCensusRows();
const holdout3Rows = loadHoldout3();
const holdout4Rows = loadHoldout4();
const holdout5Rows = loadHoldout5();

const vendorTokens = new Set([
  ...vendorTokensFromCensus(censusRows),
  ...vendorTokensFromHoldoutRows(holdout3Rows),
  ...vendorTokensFromHoldoutRows(holdout4Rows),
  ...vendorTokensFromHoldoutRows(holdout5Rows),
]);

console.log(`Vendor tokens from six labelled sets (${vendorTokens.size}): ${[...vendorTokens].sort().join(', ')}`);

// --- load the exam-1 and exam-2 BLIND files only, to get row identities  --
// to exclude. Deliberately never reads either exam's truth/answer-key      --
// files.
function existsOk(p) {
  try { readFileSync(p); return true; } catch { return false; }
}
if (!existsOk(EXAM1_BLIND)) throw new Error(`ESCALATE: exam-1 blind file missing: ${EXAM1_BLIND}`);
if (!existsOk(EXAM2_BLIND)) throw new Error(`ESCALATE: exam-2 blind file missing: ${EXAM2_BLIND}`);

const exam1Rows = parseCsv(readFileSync(EXAM1_BLIND, 'utf8'));
const exam2Rows = parseCsv(readFileSync(EXAM2_BLIND, 'utf8'));
const priorExamKeys = new Set([
  ...exam1Rows.map((r) => [r.provider, r.method, r.path, r.operationId].join('|')),
  ...exam2Rows.map((r) => [r.provider, r.method, r.path, r.operationId].join('|')),
]);
console.log(`Loaded ${exam1Rows.length} row identities from exam-1 blind file and ${exam2Rows.length} from exam-2 blind file (${priorExamKeys.size} distinct) to exclude.`);

// --- load the corpus (gunzip via shell; no new deps) ----------------------
if (!existsOk(CORPUS_GZ)) throw new Error(`ESCALATE: corpus file missing: ${CORPUS_GZ}`);

const corpusCsvText = execSync(`gzip -dc ${JSON.stringify(CORPUS_GZ)}`, { maxBuffer: 1024 * 1024 * 512 }).toString('utf8');
const corpusRows = parseCsv(corpusCsvText);
console.log(`Loaded ${corpusRows.length} corpus operations from ${new Set(corpusRows.map((r) => r.provider)).size} providers.`);

// --- exclude providers whose registrable name matches a vendor token -----
const providerRegistrableName = new Map(); // provider -> registrable name
for (const row of corpusRows) {
  if (!providerRegistrableName.has(row.provider)) {
    providerRegistrableName.set(row.provider, registrableName(row.provider));
  }
}

const excludedProviders = new Set();
for (const [provider, name] of providerRegistrableName) {
  const canonicalName = VENDOR_NAME_ALIASES.get(name) || name;
  if (vendorTokens.has(canonicalName)) excludedProviders.add(provider);
}

let excludedOpCount = 0;
const opsRemovedByProvider = new Map();
for (const row of corpusRows) {
  if (excludedProviders.has(row.provider)) {
    excludedOpCount += 1;
    opsRemovedByProvider.set(row.provider, (opsRemovedByProvider.get(row.provider) || 0) + 1);
  }
}

console.log(`\nExcluded ${excludedProviders.size} corpus providers (exact registrable-name match), removing ${excludedOpCount} operations:`);
for (const [provider, count] of [...opsRemovedByProvider.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${provider}: ${count} ops`);
}

// belt-and-braces: confirm the "found nothing under raw substring" vendors
// still exclude nothing under the corrected matching (or report if they do)
for (const v of ['camara', 'pagerduty', 'discord', 'sentry', 'cloudflare']) {
  const hit = [...providerRegistrableName.entries()].filter(([, name]) => (VENDOR_NAME_ALIASES.get(name) || name) === v);
  if (hit.length > 0) {
    console.log(`  belt-and-braces: vendor "${v}" DID match under corrected rule: ${hit.map(([p]) => p).join(', ')}`);
  }
}

// --- STEP 2: sample from remaining providers, PUT/DELETE/PATCH only,     --
// also excluding rows already drawn into exam-1 or exam-2                --
let excludedAsPriorExam = 0;
const eligible = corpusRows.filter((row) => {
  if (excludedProviders.has(row.provider)) return false;
  if (!TARGET_METHODS.has((row.method || '').toUpperCase())) return false;
  const key = [row.provider, row.method, row.path, row.operationId].join('|');
  if (priorExamKeys.has(key)) {
    excludedAsPriorExam += 1;
    return false;
  }
  return true;
});
console.log(`\nExcluded ${excludedAsPriorExam} rows already drawn into exam-1 or exam-2.`);
console.log(`Eligible pool (excluded providers + exam-1/exam-2 rows removed, PUT/DELETE/PATCH only): ${eligible.length} rows from ${new Set(eligible.map((r) => r.provider)).size} providers.`);

if (eligible.length < TARGET_N) {
  throw new Error(`ESCALATE: only ${eligible.length} eligible rows survive exclusion — fewer than the ${TARGET_N} target. Stopping rather than working around it.`);
}

const rng = mulberry32(SEED);
const shuffled = seededShuffle(eligible, rng);

let cap = START_CAP;
let selected = null;
while (selected === null) {
  const perProviderCount = new Map();
  const picked = [];
  for (const row of shuffled) {
    const n = perProviderCount.get(row.provider) || 0;
    if (n >= cap) continue;
    picked.push(row);
    perProviderCount.set(row.provider, n + 1);
    if (picked.length === TARGET_N) break;
  }
  if (picked.length >= TARGET_N) {
    selected = picked.slice(0, TARGET_N);
  } else {
    cap += 1;
    if (cap > 1000) throw new Error('ESCALATE: cap search runaway — something is wrong with the eligible pool.');
  }
}

console.log(`\nCap ended at: ${cap} rows per provider max.`);

// stable, readable file order
selected.sort((a, b) => {
  if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
  if (a.method !== b.method) return a.method.localeCompare(b.method);
  return a.path.localeCompare(b.path);
});

const withRowId = selected.map((row, i) => ({ row_id: i + 1, ...row }));

// --- STEP 4 report numbers -------------------------------------------------
const distinctProviders = new Set(withRowId.map((r) => r.provider));
const methodCounts = { PUT: 0, DELETE: 0, PATCH: 0 };
for (const r of withRowId) methodCounts[r.method.toUpperCase()] += 1;

const providerCounts = new Map();
for (const r of withRowId) providerCounts.set(r.provider, (providerCounts.get(r.provider) || 0) + 1);
const topProviders = [...providerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

console.log(`Distinct providers in sample: ${distinctProviders.size}`);
console.log(`Method split: PUT=${methodCounts.PUT}, DELETE=${methodCounts.DELETE}, PATCH=${methodCounts.PATCH}`);
console.log('Top 10 providers by count in sample:');
for (const [p, c] of topProviders) console.log(`  ${p}: ${c}`);

// --- STEP 3: write output files ---------------------------------------------
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

// --- fifteen slice files for parallel blind labellers ------------------------
const PART_SIZE = 200;
const NUM_PARTS = 15;
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
