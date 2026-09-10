// M1 exam4-2026-09-12: draw a fourth, virgin exam sample from
// data/corpus/apis-guru-ops.csv.gz. Exams 1, 2 and 3 are burned for
// scoring rule changes (C19 derived a word from exam3, C20's sweep and
// C22/C23 were scored on all three) — exam 4 exists so the C22
// allowlist-wins layer (goal 1, D51) and an upcoming PARTY_NOUNS cleanup
// pass can be scored on material nothing has touched.
//
// Provider exclusion is the critical correctness point: this excludes
// EVERY provider that appears anywhere in the 5465-row combined corpus
// (camara, holdout1, holdout2, holdout3, holdout4, holdout5, exam2, exam3
// — loaded via c19.mjs's loadCombinedCorpus(), the same loader C19/C22/C23
// use) PLUS every provider in exam-1's blind file (data/exam-2026-09-09/),
// which predates loadCombinedCorpus and is not part of it but is still
// burned. That is 332 + 105 = 437 raw provider tokens before dedup; the
// real exclusion set is computed from the data, not hardcoded.
//
// CRITICAL RAIL: this script never imports a classify function and never
// computes or records a predicted class. It DOES import loadCombinedCorpus
// from c19.mjs, per the task brief, purely to get the same set of labelled
// provider identities C19/C22/C23 use — c19.mjs's own classifier imports
// are transitively pulled in as unused code, never called here. This
// script never reads any *-truth-part*.csv content beyond what
// loadCombinedCorpus reads internally for its own row counts, and never
// reads exam-1's exam-truth.csv at all (only its exam-blind.csv, for row
// identities / provider tokens).
//
// Determinism: PRNG is a seeded mulberry32, seed = 20260912 (deliberately
// different from exam-1's 20260909, exam-2's 20260910, exam-3's 20260911).
// Same seed, same corpus file, same combined-corpus + exam-1 blind file ->
// same 4000 rows, every run.
//
// Cap search: starts at 12 rows/provider (per spec) and raises by 1 until
// TARGET_N is reachable, or reports the eligible pool size if even a high
// cap can't reach it (no other rule is relaxed to compensate).
//
// Vendor-exclusion matching (STEP 1, copied verbatim from make-exam3.mjs,
// itself copied from make-exam.mjs / make-exam2.mjs): registrable-domain,
// exact label match, case-insensitive, with a small hardcoded
// multi-label-suffix list and the amazonaws -> amazon alias. A prior pass
// found naive substring exclusion on short names like "box" and "x" strips
// ~50 innocent providers — this matching is deliberately not that.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { parseCsv, toCsv } from '../../m0/csv.mjs';
import { REPO_ROOT } from './load-sets.mjs';
import { loadCombinedCorpus } from './c19.mjs';

const SEED = 20260912;
const CORPUS_GZ = path.join(REPO_ROOT, 'data/corpus/apis-guru-ops.csv.gz');
const EXAM1_BLIND = path.join(REPO_ROOT, 'data/exam-2026-09-09/exam-blind.csv');
const OUT_DIR = path.join(REPO_ROOT, 'data/exam4-2026-09-12');
const TARGET_N = 4000;
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

// --- registrable-name extraction (STEP 1, verbatim from make-exam3.mjs) --
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

// --- STEP 1: collect vendor tokens from all 8 combined-corpus sets, plus --
// exam-1 ---------------------------------------------------------------
const combined = loadCombinedCorpus();
if (combined.allRows.length !== 5465) {
  throw new Error(`ESCALATE: expected 5465 combined-corpus rows, got ${combined.allRows.length}.`);
}

const combinedVendorTokens = new Set(combined.allRows.map((r) => r.vendor.toLowerCase()));
console.log(`Vendor tokens from the 8-set combined corpus (${combinedVendorTokens.size}): matches D46/D51's stated 332 providers -> ${combinedVendorTokens.size === 332 ? 'OK' : 'MISMATCH, ESCALATE'}`);
if (combinedVendorTokens.size !== 332) {
  throw new Error(`ESCALATE: expected 332 combined-corpus vendor tokens, got ${combinedVendorTokens.size}.`);
}

function existsOk(p) {
  try { readFileSync(p); return true; } catch { return false; }
}
if (!existsOk(EXAM1_BLIND)) throw new Error(`ESCALATE: exam-1 blind file missing: ${EXAM1_BLIND}`);
const exam1Rows = parseCsv(readFileSync(EXAM1_BLIND, 'utf8'));
const exam1VendorTokens = new Set(exam1Rows.map((r) => r.provider.toLowerCase()));
console.log(`Vendor tokens from exam-1's blind file (${exam1VendorTokens.size}): matches D46's stated 105 providers -> ${exam1VendorTokens.size === 105 ? 'OK' : 'MISMATCH, ESCALATE'}`);
if (exam1VendorTokens.size !== 105) {
  throw new Error(`ESCALATE: expected 105 exam-1 vendor tokens, got ${exam1VendorTokens.size}.`);
}

const vendorTokens = new Set([...combinedVendorTokens, ...exam1VendorTokens]);
console.log(`Union of burned vendor tokens (combined corpus + exam-1): ${vendorTokens.size} distinct (of ${combinedVendorTokens.size} + ${exam1VendorTokens.size} = ${combinedVendorTokens.size + exam1VendorTokens.size} raw, so ${combinedVendorTokens.size + exam1VendorTokens.size - vendorTokens.size} overlapped).`);

// Row identities already drawn into exam-1/2/3 (belt-and-braces on top of
// the provider-level exclusion above, which already removes every exam-1/
// 2/3 provider wholesale).
const priorExamKeys = new Set(
  exam1Rows.map((r) => [r.provider, r.method, r.path, r.operationId].join('|')),
);

// --- load the corpus (gunzip via shell; no new deps) ----------------------
if (!existsOk(CORPUS_GZ)) throw new Error(`ESCALATE: corpus file missing: ${CORPUS_GZ}`);

const corpusCsvText = execSync(`gzip -dc ${JSON.stringify(CORPUS_GZ)}`, { maxBuffer: 1024 * 1024 * 512 }).toString('utf8');
const corpusRows = parseCsv(corpusCsvText);
const poolSizeBefore = corpusRows.length;
const poolProvidersBefore = new Set(corpusRows.map((r) => r.provider)).size;
console.log(`Loaded ${poolSizeBefore} corpus operations from ${poolProvidersBefore} providers.`);

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

console.log(`\nExcluded ${excludedProviders.size} corpus providers (exact registrable-name match), removing ${excludedOpCount} operations.`);
console.log(`Pool size before exclusion: ${poolSizeBefore} rows / ${poolProvidersBefore} providers.`);
console.log(`Pool size after exclusion: ${poolSizeBefore - excludedOpCount} rows / ${poolProvidersBefore - excludedProviders.size} providers.`);

// belt-and-braces: confirm the "found nothing under raw substring" vendors
// still exclude nothing under the corrected matching (or report if they do)
for (const v of ['camara', 'pagerduty', 'discord', 'sentry', 'cloudflare']) {
  const hit = [...providerRegistrableName.entries()].filter(([, name]) => (VENDOR_NAME_ALIASES.get(name) || name) === v);
  if (hit.length > 0) {
    console.log(`  belt-and-braces: vendor "${v}" DID match under corrected rule: ${hit.map(([p]) => p).join(', ')}`);
  }
}

// --- STEP 2: sample from remaining providers, PUT/DELETE/PATCH only,     --
// also excluding rows already drawn into exam-1/2/3 (belt-and-braces)     --
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
console.log(`\nExcluded ${excludedAsPriorExam} additional rows already drawn into exam-1 (belt-and-braces; expected 0 since exam-1's providers are already wholly excluded above).`);
console.log(`Eligible pool (excluded providers removed, PUT/DELETE/PATCH only): ${eligible.length} rows from ${new Set(eligible.map((r) => r.provider)).size} providers.`);

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

const selectedKeySet = new Set(selected.map((r) => [r.provider, r.method, r.path, r.operationId].join('|')));
const rowsLeftUnused = eligible.length - selectedKeySet.size;

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
console.log(`Rows left unused in eligible pool after this draw: ${rowsLeftUnused}`);
console.log('Top 10 providers by count in sample:');
for (const [p, c] of topProviders) console.log(`  ${p}: ${c}`);

// --- correctness check: zero drawn providers intersect any burned set ----
const drawnProviderTokens = new Set(
  [...distinctProviders].map((p) => VENDOR_NAME_ALIASES.get(registrableName(p)) || registrableName(p)),
);
const intersection = [...drawnProviderTokens].filter((t) => vendorTokens.has(t));
console.log(`\nIntersection of drawn-provider registrable tokens with the burned vendor-token set: ${intersection.length} (must be 0).`);
if (intersection.length > 0) {
  throw new Error(`ESCALATE: ${intersection.length} drawn providers collide with a burned vendor token: ${intersection.join(', ')}`);
}

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

// exam-key.csv: same layout as exam3's actual exam-key.csv, which carries
// no class/confidence/reason columns at all (those live in the separate
// exam-truth-partN.csv files a later labelling pass creates) — see report.
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

// --- twenty slice files for parallel blind labellers ------------------------
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
