// data/exam5-2026-09-14: draw exam 5 — 2000 rows from
// data/corpus/apis-guru-ops.csv.gz (123339 rows / 673 providers).
//
// Why this script exists (rewritten 2026-09-14, see docs/logs/learnings.md
// "Exam 5 draw: the APIs.guru pool has no unseen write vendors"): the
// original design wanted a fully vendor-disjoint exam, but the APIs.guru
// pool has only 327 providers with any PUT/DELETE/PATCH row at all, and
// of those, 325 already map onto one of the 332 labelled-corpus write
// vendors (316 by exact provider string, 9 by registrable name), leaving
// only 2 truly unseen write providers — nowhere near the 1500-row write
// stratum this exam needs. The new design accepts that and makes the
// write stratum (W) ROW-disjoint instead of vendor-disjoint: every drawn
// W row's provider maps onto a labelled-corpus write vendor
// (corpus_vendor), but the exact row (by method+path or method+operationId)
// is excluded if the corpus, exam 1, or exam 4 already has it. The two
// other strata (POST, GET) stay fully vendor-disjoint, as before.
//
// CRITICAL RAIL: this script never imports a classify function and never
// computes or records a predicted class. It imports loadRows() from
// poc/flow/corpus.mjs purely for the labelled corpus's provider and row
// identities (5465 rows, 332 vendors) — no truth file is read beyond what
// loadRows() reads internally, and no truth file for exam 1 or exam 4 is
// read at all (only their exam-blind.csv files, for row identities).
//
// Determinism: seed = 20260914 (distinct from exam 1's 20260909, exam 2's
// 20260910, exam 3's 20260911, exam 4's 20260912). Strata are drawn in
// order W, POST, GET (stratum index 0, 1, 2). Within a stratum's cap
// search, every cap attempt reshuffles the same eligible list from a
// fresh mulberry32(SEED + stratumIndex) — so the shuffle order is fixed
// per stratum and only the cap changes, making the whole draw
// deterministic and reproducible from this file + the input files alone.
//
// Cap search: each stratum starts its own cap at 12 rows/provider and
// raises it by 1 until that stratum's target is reachable; the final cap
// per stratum is reported.

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

// Expected mapping counts among pool providers with a PUT/DELETE/PATCH
// row, measured in the main session before this script was written. If a
// run of this script disagrees, that's evidence something changed
// upstream (corpus, alias table, or pool file) — escalate rather than
// silently accept a different number.
const EXPECTED_WRITE_PROVIDERS = 327;
const EXPECTED_EXACT = 316;
const EXPECTED_REGISTRABLE = 9;
const EXPECTED_AMBIGUOUS = 0;
const EXPECTED_UNMATCHED = 2;

// Strata, in draw order. index is used as the mulberry32 seed offset.
const STRATA = [
  { name: 'W', methods: new Set(['PUT', 'DELETE', 'PATCH']), target: 1500, index: 0 },
  { name: 'POST', methods: new Set(['POST']), target: 300, index: 1 },
  { name: 'GET', methods: new Set(['GET']), target: 200, index: 2 },
];
const TARGET_N = STRATA.reduce((s, st) => s + st.target, 0);

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

function pathKey(method, opPath) {
  return `${method.toUpperCase()}|${opPath}`;
}
function opKey(method, operationId) {
  return `${method.toUpperCase()}|${operationId}`;
}

// --- STEP 1: load the burned identity sources ------------------------------
const { rows: corpusRows, vendors: corpusVendors } = loadRows();
if (corpusRows.length !== 5465) {
  throw new Error(`ESCALATE: expected 5465 combined-corpus rows from loadRows(), got ${corpusRows.length}.`);
}
if (corpusVendors.length !== 332) {
  throw new Error(`ESCALATE: expected 332 combined-corpus vendors from loadRows(), got ${corpusVendors.length}.`);
}
console.log(`Loaded labelled corpus: ${corpusRows.length} rows, ${corpusVendors.length} vendors (via poc/flow/corpus.mjs loadRows()).`);

if (!existsOk(EXAM1_BLIND)) throw new Error(`ESCALATE: exam-1 blind file missing: ${EXAM1_BLIND}`);
const exam1Rows = parseCsv(readFileSync(EXAM1_BLIND, 'utf8'));
if (exam1Rows.length !== 200) {
  throw new Error(`ESCALATE: expected 200 exam-1 blind rows, got ${exam1Rows.length}.`);
}
console.log(`Loaded exam 1 blind file: ${exam1Rows.length} rows, ${new Set(exam1Rows.map((r) => r.provider)).size} providers.`);

if (!existsOk(EXAM4_BLIND)) throw new Error(`ESCALATE: exam-4 blind file missing: ${EXAM4_BLIND}`);
const exam4Rows = parseCsv(readFileSync(EXAM4_BLIND, 'utf8'));
if (exam4Rows.length !== 4000) {
  throw new Error(`ESCALATE: expected 4000 exam-4 blind rows, got ${exam4Rows.length}.`);
}
console.log(`Loaded exam 4 blind file: ${exam4Rows.length} rows, ${new Set(exam4Rows.map((r) => r.provider)).size} providers.`);

// --- STEP 2: mapVendor(p) ---------------------------------------------------
const corpusVendorSet = new Set(corpusVendors);
const registrableToVendors = new Map(); // canonicalRegistrableName -> [corpus vendor strings]
for (const v of corpusVendors) {
  const reg = canonicalRegistrableName(v);
  if (!registrableToVendors.has(reg)) registrableToVendors.set(reg, []);
  registrableToVendors.get(reg).push(v);
}

// Returns { vendor, matchType } where matchType is 'exact' | 'registrable' | 'none'.
// Throws ESCALATE if more than one corpus vendor shares p's registrable name.
function mapVendorDetailed(p) {
  if (corpusVendorSet.has(p)) return { vendor: p, matchType: 'exact' };
  const reg = canonicalRegistrableName(p);
  const matches = registrableToVendors.get(reg) || [];
  if (matches.length === 1) return { vendor: matches[0], matchType: 'registrable' };
  if (matches.length > 1) {
    throw new Error(`ESCALATE: provider "${p}" (registrable "${reg}") matches ${matches.length} corpus vendors: ${matches.join(', ')}.`);
  }
  return { vendor: '', matchType: 'none' };
}
function mapVendor(p) {
  return mapVendorDetailed(p).vendor;
}

// --- STEP 3: load + dedupe the pool -----------------------------------------
if (!existsOk(CORPUS_GZ)) throw new Error(`ESCALATE: corpus pool file missing: ${CORPUS_GZ}`);
const poolCsvText = execSync(`gzip -dc ${JSON.stringify(CORPUS_GZ)}`, { maxBuffer: 1024 * 1024 * 512 }).toString('utf8');
const poolRowsRaw = parseCsv(poolCsvText);
const poolProvidersRaw = new Set(poolRowsRaw.map((r) => r.provider));
console.log(`\nLoaded pool: ${poolRowsRaw.length} rows from ${poolProvidersRaw.size} providers (${CORPUS_GZ}).`);
if (poolRowsRaw.length !== 123339 || poolProvidersRaw.size !== 673) {
  throw new Error(`ESCALATE: expected 123339 pool rows / 673 providers, got ${poolRowsRaw.length} / ${poolProvidersRaw.size}.`);
}

const seenPoolKeys = new Set();
const poolRows = [];
let poolDedupeDrops = 0;
for (const r of poolRowsRaw) {
  const key = `${r.provider}|${r.method}|${r.path}`;
  if (seenPoolKeys.has(key)) { poolDedupeDrops += 1; continue; }
  seenPoolKeys.add(key);
  poolRows.push(r);
}
console.log(`Deduped pool on provider|method|path (keeping first in file order): dropped ${poolDedupeDrops} rows, ${poolRows.length} remain.`);

// --- STEP 4: measure vendor-mapping counts among write providers -----------
const writeProviders = new Set(
  poolRows.filter((r) => STRATA[0].methods.has((r.method || '').toUpperCase())).map((r) => r.provider),
);
let mapExact = 0, mapRegistrable = 0, mapUnmatched = 0;
for (const p of writeProviders) {
  const { matchType } = mapVendorDetailed(p);
  if (matchType === 'exact') mapExact += 1;
  else if (matchType === 'registrable') mapRegistrable += 1;
  else mapUnmatched += 1;
}
console.log(`\nWrite-provider mapping: ${writeProviders.size} pool providers with a PUT/DELETE/PATCH row -> ${mapExact} exact, ${mapRegistrable} by registrable name, 0 ambiguous (ambiguous throws), ${mapUnmatched} unmatched.`);
if (
  writeProviders.size !== EXPECTED_WRITE_PROVIDERS ||
  mapExact !== EXPECTED_EXACT ||
  mapRegistrable !== EXPECTED_REGISTRABLE ||
  mapUnmatched !== EXPECTED_UNMATCHED
) {
  throw new Error(`ESCALATE: write-provider mapping counts changed since the main session's measurement. Expected ${EXPECTED_WRITE_PROVIDERS} providers (${EXPECTED_EXACT} exact / ${EXPECTED_REGISTRABLE} registrable / ${EXPECTED_AMBIGUOUS} ambiguous / ${EXPECTED_UNMATCHED} unmatched), got ${writeProviders.size} (${mapExact} / ${mapRegistrable} / 0 / ${mapUnmatched}).`);
}
console.log(`Mapping counts match the main session's measurement. PASS`);

// --- STEP 5: burned-by-vendor sets for stratum W's already-seen check ------
// vendor key: for corpus rows, row.vendor as-is; for exam1/exam4 rows, the
// row's provider mapped through mapVendor(), falling back to the raw
// provider when mapVendor() returns ''.
const burnedByVendor = new Map(); // vendor -> { pathKeys: Set, opKeys: Set }
function burnedBucket(vendor) {
  if (!burnedByVendor.has(vendor)) burnedByVendor.set(vendor, { pathKeys: new Set(), opKeys: new Set() });
  return burnedByVendor.get(vendor);
}
function addBurnedRow(vendor, method, opPath, operationId) {
  const b = burnedBucket(vendor);
  b.pathKeys.add(pathKey(method, opPath));
  if (operationId) b.opKeys.add(opKey(method, operationId));
}
for (const r of corpusRows) addBurnedRow(r.vendor, r.method, r.path, r.operationId);
for (const r of exam1Rows) addBurnedRow(mapVendor(r.provider) || r.provider, r.method, r.path, r.operationId);
for (const r of exam4Rows) addBurnedRow(mapVendor(r.provider) || r.provider, r.method, r.path, r.operationId);
console.log(`\nburnedByVendor built: ${burnedByVendor.size} distinct vendor keys from corpus (${corpusRows.length}) + exam1 (${exam1Rows.length}) + exam4 (${exam4Rows.length}) rows.`);

// --- STEP 6: unseen-provider token set for strata POST/GET -----------------
// Both name forms (raw lowercased, registrable+alias) of exam1/exam4
// providers only (mapVendor(p) === '' already rules out any match, exact
// or registrable, against a corpus vendor).
const examProviderTokens = new Set();
const examProviderStringsRaw = new Set();
for (const r of exam1Rows) examProviderStringsRaw.add(r.provider);
for (const r of exam4Rows) examProviderStringsRaw.add(r.provider);
for (const p of examProviderStringsRaw) {
  examProviderTokens.add(p.toLowerCase());
  examProviderTokens.add(canonicalRegistrableName(p));
}
// Non-throwing check for POST/GET eligibility. A provider is UNSEEN only
// if: (1) its raw lowercased form is not a corpus vendor (lowercased), (2)
// its registrable name (with alias) matches ZERO corpus vendors — one
// match or several both mean "seen", no ESCALATE — and (3) it is not an
// exam 1 / exam 4 provider under either name form. Returns
// { unseen, ambiguous } so callers can separately count/list providers
// excluded specifically because they matched more than one corpus vendor.
const corpusVendorSetLower = new Set(corpusVendors.map((v) => v.toLowerCase()));
function unseenProviderCheck(p) {
  if (corpusVendorSetLower.has(p.toLowerCase())) return { unseen: false, ambiguous: false };
  const reg = canonicalRegistrableName(p);
  const matches = registrableToVendors.get(reg) || [];
  if (matches.length >= 1) return { unseen: false, ambiguous: matches.length > 1 };
  if (examProviderTokens.has(p.toLowerCase())) return { unseen: false, ambiguous: false };
  if (examProviderTokens.has(reg)) return { unseen: false, ambiguous: false };
  return { unseen: true, ambiguous: false };
}

// --- STEP 7: build eligible rows per stratum --------------------------------
let excludedByA = 0; // same method+path already burned
let excludedByB = 0; // same method+non-empty-operationId already burned

const eligibleW = [];
for (const r of poolRows) {
  const method = (r.method || '').toUpperCase();
  if (!STRATA[0].methods.has(method)) continue;
  if (!r.path) continue;
  const vendor = mapVendor(r.provider);
  if (vendor === '') continue; // not a write provider that maps onto the labelled corpus
  const bucket = burnedByVendor.get(vendor);
  let matchA = false, matchB = false;
  if (bucket) {
    matchA = bucket.pathKeys.has(pathKey(method, r.path));
    matchB = !!r.operationId && bucket.opKeys.has(opKey(method, r.operationId));
  }
  if (matchA) excludedByA += 1;
  if (matchB) excludedByB += 1;
  if (matchA || matchB) continue;
  eligibleW.push({ ...r, method, corpus_vendor: vendor });
}
console.log(`\nStratum W eligible: ${eligibleW.length} rows (excluded-as-already-seen: ${excludedByA} by (a) same method+path, ${excludedByB} by (b) same method+operationId; a row can match both).`);

const eligiblePost = [];
const eligibleGet = [];
const ambiguousPostGetProviders = new Set();
for (const r of poolRows) {
  const method = (r.method || '').toUpperCase();
  if (method !== 'POST' && method !== 'GET') continue;
  if (!r.path) continue;
  const check = unseenProviderCheck(r.provider);
  if (check.ambiguous) ambiguousPostGetProviders.add(r.provider);
  if (!check.unseen) continue;
  const row = { ...r, method, corpus_vendor: '' };
  if (method === 'POST') eligiblePost.push(row);
  else eligibleGet.push(row);
}
console.log(`Stratum POST eligible: ${eligiblePost.length} rows from ${new Set(eligiblePost.map((r) => r.provider)).size} unseen providers.`);
console.log(`Stratum GET eligible: ${eligibleGet.length} rows from ${new Set(eligibleGet.map((r) => r.provider)).size} unseen providers.`);
console.log(`POST/GET candidate providers excluded for matching MORE THAN ONE corpus vendor (ambiguous registrable name): ${ambiguousPostGetProviders.size} -> ${[...ambiguousPostGetProviders].sort().join(', ') || '(none)'}`);

const eligibleByStratum = { W: eligibleW, POST: eligiblePost, GET: eligibleGet };

// --- STEP 8: cap-search draw per stratum ------------------------------------
const selectedAll = [];
const strataReport = [];

for (const stratum of STRATA) {
  const eligible = eligibleByStratum[stratum.name];
  if (eligible.length < stratum.target) {
    throw new Error(`ESCALATE: stratum ${stratum.name} has only ${eligible.length} eligible rows, fewer than its ${stratum.target} target.`);
  }

  let cap = START_CAP;
  let picked = null;
  let shuffled = null;
  while (picked === null) {
    const rng = mulberry32(SEED + stratum.index);
    shuffled = seededShuffle(eligible, rng);
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
    eligibleSize: eligible.length,
    eligibleProviders: new Set(eligible.map((r) => r.provider)).size,
    finalCap: cap,
    distinctProviders: new Set(picked.map((r) => r.provider)).size,
  });
  console.log(`\nStratum ${stratum.name}: target ${stratum.target}, eligible ${eligible.length} rows / ${new Set(eligible.map((r) => r.provider)).size} providers, final cap ${cap}, drawn from ${new Set(picked.map((r) => r.provider)).size} distinct providers.`);
}

if (selectedAll.length !== TARGET_N) {
  throw new Error(`ESCALATE: expected ${TARGET_N} total drawn rows, got ${selectedAll.length}.`);
}

// --- STEP 9: combine, sort, assign row_id -----------------------------------
selectedAll.sort((a, b) => {
  if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
  if (a.method !== b.method) return a.method.localeCompare(b.method);
  if (a.path !== b.path) return a.path.localeCompare(b.path);
  return a.operationId.localeCompare(b.operationId);
});
const withRowId = selectedAll.map((row, i) => ({ row_id: i + 1, ...row }));

// --- STEP 10: assertions -----------------------------------------------------

// 1. Counts.
const strataCounts = { W: 0, POST: 0, GET: 0 };
for (const r of withRowId) {
  const m = r.method.toUpperCase();
  if (m === 'PUT' || m === 'DELETE' || m === 'PATCH') strataCounts.W += 1;
  else if (m === 'POST') strataCounts.POST += 1;
  else if (m === 'GET') strataCounts.GET += 1;
  else throw new Error(`ESCALATE: unexpected method "${m}" in drawn rows.`);
}
if (withRowId.length !== 2000 || strataCounts.W !== 1500 || strataCounts.POST !== 300 || strataCounts.GET !== 200) {
  throw new Error(`ESCALATE: count mismatch — total ${withRowId.length} (want 2000), W ${strataCounts.W} (want 1500), POST ${strataCounts.POST} (want 300), GET ${strataCounts.GET} (want 200).`);
}
console.log(`\nAssertion 1 (counts): 2000 total, W=${strataCounts.W}, POST=${strataCounts.POST}, GET=${strataCounts.GET}. PASS`);

// 2. Every W row has corpus_vendor in the 332 vendors, and is not
// already-seen by (a) or (b).
const wRows = withRowId.filter((r) => r.corpus_vendor);
let wViolations = 0;
for (const r of wRows) {
  if (!corpusVendorSet.has(r.corpus_vendor)) { wViolations += 1; continue; }
  const bucket = burnedByVendor.get(r.corpus_vendor);
  if (bucket) {
    const a = bucket.pathKeys.has(pathKey(r.method, r.path));
    const b = !!r.operationId && bucket.opKeys.has(opKey(r.method, r.operationId));
    if (a || b) wViolations += 1;
  }
}
if (wRows.length !== 1500 || wViolations > 0) {
  throw new Error(`ESCALATE: assertion 2 failed — ${wRows.length} W rows have a corpus_vendor (want 1500), ${wViolations} violate the already-seen exclusion.`);
}
console.log(`Assertion 2 (W vendor + already-seen): 1500 W rows all carry a valid corpus_vendor, 0 already-seen violations. PASS`);

// 3. Every POST/GET row's provider fails mapVendor and is not an exam1/exam4
// provider in either name form, both directions.
const postGetRows = withRowId.filter((r) => r.method === 'POST' || r.method === 'GET');
let postGetViolations = 0;
const distinctPostGetProviders = new Set(postGetRows.map((r) => r.provider));
for (const p of distinctPostGetProviders) {
  if (mapVendor(p) !== '') { postGetViolations += 1; continue; }
  const pLower = p.toLowerCase();
  const pReg = canonicalRegistrableName(p);
  for (const b of examProviderStringsRaw) {
    const bLower = b.toLowerCase();
    const bReg = canonicalRegistrableName(b);
    if (pLower === bLower || pReg === bReg) { postGetViolations += 1; break; }
  }
}
if (postGetViolations > 0) {
  throw new Error(`ESCALATE: ${postGetViolations} POST/GET drawn providers collide with a corpus vendor or exam1/exam4 provider.`);
}
console.log(`Assertion 3 (POST/GET vendor-disjointness, both directions): 0 violations across ${distinctPostGetProviders.size} distinct providers. PASS`);

// 4. No duplicate provider|method|path within the exam.
const finalKeys = new Set();
let dupCount = 0;
for (const r of withRowId) {
  const key = `${r.provider}|${r.method}|${r.path}`;
  if (finalKeys.has(key)) dupCount += 1;
  finalKeys.add(key);
}
if (dupCount > 0) {
  throw new Error(`ESCALATE: ${dupCount} duplicate provider|method|path rows within the drawn exam.`);
}
console.log(`Assertion 4 (no duplicate provider|method|path): 0 duplicates across ${withRowId.length} rows. PASS`);

const methodCounts = { PUT: 0, DELETE: 0, PATCH: 0, POST: 0, GET: 0 };
for (const r of withRowId) methodCounts[r.method] += 1;
console.log(`\nMethod breakdown: PUT=${methodCounts.PUT}, DELETE=${methodCounts.DELETE}, PATCH=${methodCounts.PATCH}, POST=${methodCounts.POST}, GET=${methodCounts.GET}`);
console.log(`Distinct providers in final sample: ${new Set(withRowId.map((r) => r.provider)).size}`);

// --- STEP 11: write outputs ---------------------------------------------------
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

const keyHeader = ['row_id', 'provider', 'corpus_vendor', 'api_key', 'method', 'path', 'operationId', 'stratum'];
const keyRows = withRowId.map((r) => ({
  row_id: r.row_id,
  provider: r.provider,
  corpus_vendor: r.corpus_vendor,
  api_key: r.api_key,
  method: r.method,
  path: r.path,
  operationId: r.operationId,
  stratum: r.corpus_vendor ? 'W' : (r.method === 'POST' ? 'POST' : 'GET'),
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

// --- STEP 12: README.md --------------------------------------------------------
const distinctW = new Set(wRows.map((r) => r.provider)).size;
const distinctPost = new Set(strataReport.find((s) => s.name === 'POST') ? withRowId.filter((r) => r.method === 'POST').map((r) => r.provider) : []).size;
const distinctGet = new Set(withRowId.filter((r) => r.method === 'GET').map((r) => r.provider)).size;

const readmeLines = [
  '# data/exam5-2026-09-14 — exam 5',
  '',
  'Drawn 2026-09-14, seed 20260914, by `poc/exam/make-exam5.mjs`, from',
  `\`data/corpus/apis-guru-ops.csv.gz\` (${poolRowsRaw.length} pool rows / ${poolProvidersRaw.size} providers, deduped on`,
  `provider|method|path to ${poolRows.length} rows, dropping ${poolDedupeDrops}).`,
  '',
  '## What exam 5 is',
  '',
  'Exam 5 has three strata: W (writes: PUT/DELETE/PATCH, 1500 rows), POST',
  '(300 rows), and GET (200 rows).',
  '',
  'Stratum W is ROW-disjoint, not vendor-disjoint, because the APIs.guru',
  `pool has no unseen write vendors: only ${writeProviders.size} pool providers have any`,
  `write row at all, and ${mapExact + mapRegistrable} of those (${mapExact} by exact provider string, ${mapRegistrable} by`,
  `registrable name) already map onto one of the 332 labelled-corpus write`,
  `vendors, leaving only ${mapUnmatched} truly unseen write providers — far short of`,
  '1500 rows. See `docs/logs/learnings.md`, "Exam 5 draw: the APIs.guru',
  'pool has no unseen write vendors", for the full measurement. Every',
  'drawn W row\'s provider maps onto a labelled-corpus write vendor',
  '(recorded as `corpus_vendor`), but the exact row (matched by method+path',
  'or method+operationId) is excluded if the corpus, exam 1, or exam 4',
  'already has it. It is scored with the flow\'s leave-one-vendor-out lists',
  'keyed on `corpus_vendor`, so a row\'s own vendor never feeds the mined',
  'lists — but the hand lists were shaped on that vendor\'s OTHER rows,',
  'which is the stated weakness of this stratum.',
  '',
  'Strata POST and GET are vendor-disjoint: every drawn row\'s provider',
  'fails `mapVendor` (does not match any of the 332 labelled-corpus',
  'vendors, exact or by registrable name) and is not an exam 1 or exam 4',
  'provider under either name form, checked in both directions.',
  '',
  '## Run numbers (from the actual run that produced this directory)',
  '',
  `- Pool: ${poolRowsRaw.length} rows / ${poolProvidersRaw.size} providers; deduped on provider|method|path`,
  `  -> ${poolDedupeDrops} dropped, ${poolRows.length} remain.`,
  `- Write-provider mapping (providers with any PUT/DELETE/PATCH row):`,
  `  ${writeProviders.size} total -> ${mapExact} exact, ${mapRegistrable} by registrable name, 0 ambiguous,`,
  `  ${mapUnmatched} unmatched.`,
  `- Stratum W eligible rows: ${eligibleW.length} (excluded as already-seen: ${excludedByA} by`,
  `  (a) same method+path, ${excludedByB} by (b) same method+operationId; a row`,
  '  can match both, so these are not additive).',
  `- Stratum POST eligible rows: ${eligiblePost.length} from ${new Set(eligiblePost.map((r) => r.provider)).size} unseen providers.`,
  `- Stratum GET eligible rows: ${eligibleGet.length} from ${new Set(eligibleGet.map((r) => r.provider)).size} unseen providers.`,
  `- POST/GET candidate providers excluded for matching MORE THAN ONE corpus`,
  `  vendor by registrable name (ambiguous; not thrown, just excluded from`,
  `  the unseen pool per the user's ruling 2026-09-14): ${ambiguousPostGetProviders.size}`,
  `  (${[...ambiguousPostGetProviders].sort().join(', ') || 'none'}).`,
  '',
  '| Stratum | Target | Eligible rows / providers | Final per-provider cap | Distinct providers drawn |',
  '|---|---|---|---|---|',
  ...strataReport.map((s) => `| ${s.name} | ${s.target} | ${s.eligibleSize} / ${s.eligibleProviders} | ${s.finalCap} | ${s.distinctProviders} |`),
  '',
  `- Method split within W: PUT=${methodCounts.PUT}, DELETE=${methodCounts.DELETE}, PATCH=${methodCounts.PATCH}.`,
  `- Distinct providers in the final 2000-row sample: ${new Set(withRowId.map((r) => r.provider)).size} (W ${distinctW}, POST ${distinctPost}, GET ${distinctGet}).`,
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
  'Use the calibrated, adopted brief at',
  '`data/calibration-2026-09-14/BRIEF.md` (adopted 2026-09-14).',
  '',
  '## Files',
  '',
  '- `exam-blind.csv` — all 2000 rows (row_id, provider, method, path,',
  '  operationId, summary, description). No stratum, no corpus_vendor, no',
  '  class column.',
  '- `exam-key.csv` — row_id, provider, corpus_vendor, api_key, method,',
  '  path, operationId, stratum (for joining back to the pool and for',
  '  LOVO scoring after labelling; no class column). `corpus_vendor` and',
  '  `stratum` are empty/`POST`/`GET` for the POST and GET strata.',
  '- `exam-blind-part1.csv` .. `exam-blind-part10.csv` — 200 rows each, in',
  '  row_id order, same header as `exam-blind.csv`, for parallel blind',
  '  labellers.',
  '- `exam-truth-part1.csv` .. `exam-truth-part10.csv` — NOT produced by',
  '  this script; written later by blind labellers, one per part.',
  '',
];
writeFileSync(path.join(OUT_DIR, 'README.md'), readmeLines.join('\n'), 'utf8');
console.log(`\nWrote README.md to ${path.join(OUT_DIR, 'README.md')}`);
