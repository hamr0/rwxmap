#!/usr/bin/env node
// Proof runner for poc/buildset. Dry-run — writes nothing. Loads the real
// corpus and prints numbered proofs, each stating a CLAIM, the measured
// EVIDENCE, and a PASS/FAIL. Exits 1 if any proof fails.

import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { parseCsv } from '../../tools/csv.js';
import { BUILD_CAPS, EXAM_VENDORS, SEEN_VENDORS, WRITE_METHODS } from './split.mjs';
import { drawBuildSet, dedupeRows, registrableName } from './draw.mjs';
import { runGates } from './gates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_GZ = path.join(__dirname, '..', '..', 'data', 'corpus', 'apis-guru-ops.csv.gz');
const SEED = 20260918;
const GIANT_SHARE_BAR = 0.4;

const WRITE_METHOD_SET = new Set(WRITE_METHODS.map((m) => m.toUpperCase()));

function labelMatch(name, vendor) {
  const n = String(name).toLowerCase();
  const labels = String(vendor).toLowerCase().split('.');
  return labels.includes(n);
}

function vendorMatchesLabel(provider, name) {
  const pReg = registrableName(provider);
  const nReg = registrableName(name);
  return (
    provider.toLowerCase() === name.toLowerCase() ||
    pReg === nReg ||
    labelMatch(name, provider) ||
    labelMatch(provider, name)
  );
}

function loadRows() {
  const gz = readFileSync(CORPUS_GZ);
  const csvText = gunzipSync(gz).toString('utf8');
  return parseCsv(csvText);
}

function dedupeKey(row) {
  return `${row.provider}|${String(row.method || '').toUpperCase()}|${row.path}|${row.operationId}`;
}

let anyFail = false;

function report(n, title, claim, evidenceLines, pass) {
  if (!pass) anyFail = true;
  console.log(`\nPROOF ${n} — ${title}`);
  console.log(`  CLAIM: ${claim}`);
  console.log('  EVIDENCE:');
  for (const line of evidenceLines) console.log(`    ${line}`);
  console.log(`  [${pass ? 'PASS' : 'FAIL'}]`);
}

function main() {
  const rows = loadRows();

  const smallVendors = Object.keys(BUILD_CAPS).filter(
    (v) => v !== 'github.com' && v !== 'microsoft.com'
  );

  // ---- PROOF 1: duplicates are real and concentrated ----
  const eligible = rows.filter((r) => {
    const method = String(r.method || '').toUpperCase();
    return WRITE_METHOD_SET.has(method) && Object.prototype.hasOwnProperty.call(BUILD_CAPS, r.provider);
  });
  const deduped = dedupeRows(eligible);
  const droppedTotal = eligible.length - deduped.length;

  const droppedByVendor = {};
  for (const vendor of Object.keys(BUILD_CAPS)) {
    const vRows = eligible.filter((r) => r.provider === vendor);
    const vDeduped = dedupeRows(vRows);
    droppedByVendor[vendor] = vRows.length - vDeduped.length;
  }

  // Find three actual duplicate groups (key -> members) from the eligible
  // pool, preferring groups with more than one member.
  const groups = new Map();
  for (const r of eligible) {
    const key = dedupeKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1).slice(0, 3);

  const p1Evidence = [
    `eligible pool pre-dedupe: ${eligible.length} rows`,
    `eligible pool post-dedupe: ${deduped.length} rows`,
    `rows dropped: ${droppedTotal}`,
    `per-vendor dropped: ${Object.entries(droppedByVendor)
      .map(([v, d]) => `${v}=${d}`)
      .join(', ')}`,
    '',
    'sample duplicate groups:',
  ];
  for (const [i, g] of dupGroups.entries()) {
    p1Evidence.push(`  group ${i + 1}: provider=${g[0].provider} method=${g[0].method} path=${g[0].path} operationId=${g[0].operationId} (${g.length} members)`);
    for (const m of g) {
      p1Evidence.push(`    api_key=${m.api_key}`);
    }
  }
  const p1Pass = smallVendors.every((v) => droppedByVendor[v] === 0);
  report(
    1,
    'duplicates are real and concentrated',
    "the eligible pool's duplicate rows come almost entirely from github.com and microsoft.com spec variants",
    p1Evidence,
    p1Pass
  );

  // ---- PROOF 2: github collapses ----
  const ghRaw = eligible.filter((r) => r.provider === 'github.com').length;
  const ghUniq = dedupeRows(eligible.filter((r) => r.provider === 'github.com')).length;
  const p2Pass = ghRaw === 7136 && ghUniq === 544;
  report(
    2,
    'github collapses',
    'github.com has 7136 raw write rows but 544 unique',
    [`raw = ${ghRaw}`, `unique = ${ghUniq}`],
    p2Pass
  );

  // ---- PROOF 3: the draw is deterministic ----
  const drawA1 = drawBuildSet(rows, { caps: BUILD_CAPS, methods: WRITE_METHODS, seed: SEED });
  const drawA2 = drawBuildSet(rows, { caps: BUILD_CAPS, methods: WRITE_METHODS, seed: SEED });
  const drawB = drawBuildSet(rows, { caps: BUILD_CAPS, methods: WRITE_METHODS, seed: SEED + 1 });
  const jsonA1 = JSON.stringify(drawA1.rows);
  const jsonA2 = JSON.stringify(drawA2.rows);
  const jsonB = JSON.stringify(drawB.rows);
  const sameSeedIdentical = jsonA1 === jsonA2;
  const diffSeedDifferent = jsonA1 !== jsonB;
  const p3Pass = sameSeedIdentical && diffSeedDifferent;
  report(
    3,
    'the draw is deterministic',
    'same seed gives byte-identical drawn rows; a different seed gives a different order',
    [
      `same-seed (${SEED}) runs identical: ${sameSeedIdentical}`,
      `different seed (${SEED + 1}) differs from seed ${SEED}: ${diffSeedDifferent}`,
      `drawn row count: ${drawA1.rows.length}`,
    ],
    p3Pass
  );

  // ---- PROOF 4: the uniform cap balances vendors ----
  const { rows: drawn, perVendor, dropped } = drawA1;
  const total = drawn.length;
  const header = `${'vendor'.padEnd(20)}${'availRaw'.padStart(10)}${'avail'.padStart(8)}${'drawn'.padStart(8)}  POST/PUT/DELETE/PATCH`;
  const p4Lines = [header];
  let maxShare = 0;
  for (const v of perVendor) {
    const breakdown = `${v.byMethod.POST}/${v.byMethod.PUT}/${v.byMethod.DELETE}/${v.byMethod.PATCH}`;
    p4Lines.push(
      `${v.vendor.padEnd(20)}${String(v.availableRaw).padStart(10)}${String(v.available).padStart(8)}${String(v.drawn).padStart(8)}  ${breakdown}`
    );
    const share = total === 0 ? 0 : v.drawn / total;
    if (share > maxShare) maxShare = share;
  }
  p4Lines.push('');
  p4Lines.push(`total drawn: ${total} (deduped, ${dropped} duplicate rows dropped before capping)`);
  p4Lines.push(`largest single-vendor share: ${(maxShare * 100).toFixed(1)}%`);
  const p4Pass = maxShare <= 0.12;
  report(
    4,
    'the uniform cap balances vendors',
    'no single vendor exceeds 12% of the drawn total',
    p4Lines,
    p4Pass
  );

  // ---- PROOF 5: the gates hold on the real draw ----
  const gateResults = runGates(drawn, {
    caps: BUILD_CAPS,
    examVendors: EXAM_VENDORS,
    seenVendors: SEEN_VENDORS,
    methods: WRITE_METHODS,
    giantShareBar: GIANT_SHARE_BAR,
  });
  const p5Lines = gateResults.map((g) => `[${g.pass ? 'PASS' : 'FAIL'}] ${g.name} - ${g.detail}`);
  const p5Pass = gateResults.every((g) => g.pass);
  report(5, 'the gates hold on the real draw', 'runGates on the real drawn build set: all gates pass', p5Lines, p5Pass);

  // ---- PROOF 6: the locked exam vendors are absent ----
  const p6Lines = [];
  let p6Pass = true;
  for (const ev of EXAM_VENDORS) {
    const count = rows.filter((r) => vendorMatchesLabel(r.provider, ev)).length;
    if (count !== 0) p6Pass = false;
    p6Lines.push(`${ev}: ${count}`);
  }
  report(
    6,
    'the locked exam vendors are absent',
    'none of the ten exam vendors appears anywhere in the corpus at all',
    p6Lines,
    p6Pass
  );

  console.log('');
  console.log(anyFail ? 'RESULT: FAIL — one or more proofs failed' : 'RESULT: PASS — all proofs passed');
  process.exit(anyFail ? 1 : 0);
}

main();
