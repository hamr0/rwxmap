#!/usr/bin/env node
// POC — measures the input layer (poc/input/load.mjs) against the four
// locked spec sets, per docs/product/prd.md "What is next — NOT BUILT",
// item a. For each spec in each set's specs.lock.json:
//   1. loads it with loadSpec and checks the read bytes against the lock;
//   2. runs the FROZEN operationsFrom (src/exporter.js, via src/index.js —
//      poc/ code never imports src/ any other way) over the parsed doc;
//   3. compares that operation list, as a multiset of
//      (METHOD, path, operationId-or-empty), against the rows recorded in
//      the set's own ops.csv for that provider + spec_file.
//
// This file does not fix operationsFrom and does not change what is
// compared to make the comparison pass — mismatches are reported with
// cause and evidence, per the brief.
//
// Usage: node poc/input/measure.mjs [--url]
//   --url loads every spec from its locked URL instead of the file on
//   disk, informational only (vendors drift; never affects the exit code).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { loadSpec } from './load.mjs';
import { operationsFrom } from '../../src/index.js';
import { parseCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SETS = [
  'data/provider-corpus-2026-09-16',
  'data/exam-2026-09-17',
  'data/exam-2026-09-20',
  'data/exam-2026-09-22',
];

const USE_URL = process.argv.includes('--url');
const EXAMPLE_LIMIT = 5;

function sha256Of(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function isGzip(buf) {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

// FINDING (measured, not guessed — see the report): every lock in this
// repo records the byte count and sha256 of the UNCOMPRESSED original, not
// the .gz file stored on disk. Confirmed against
// data/provider-corpus-2026-09-16/specs/asana/asana_oas.yaml.gz, whose
// lock entry (bytes: 3154981) matches the gunzipped size, not the 218516
// on-disk .gz size.
function uncompressedBytesAndSha(filePath) {
  const raw = fs.readFileSync(filePath);
  const uncompressed = isGzip(raw) ? zlib.gunzipSync(raw) : raw;
  return { bytes: uncompressed.length, sha256: sha256Of(uncompressed) };
}

// FINDING: spec_file in ops.csv is NOT always the lock path's basename.
// For a nested lock path (data/provider-corpus-2026-09-16's digitalocean,
// whose 685 lock entries are one top-level aggregator plus 684
// single-operation fragment files under resources/), spec_file is the
// lock path made RELATIVE TO THE PROVIDER'S OWN DIRECTORY, `.gz` stripped
// — e.g. lock path "digitalocean/resources/account/account_get.yml.gz"
// -> spec_file "resources/account/account_get.yml". Where the lock path
// has no such nesting (every other provider here, and every exam set),
// this is the same thing as the basename, so one formula covers both.
function specFileFor(entry) {
  let p = entry.path;
  const prefix = `${entry.provider}/`;
  if (p.startsWith(prefix)) p = p.slice(prefix.length);
  return p.replace(/\.gz$/, '');
}

function readOpsCsv(setDir) {
  const csvPath = path.join(REPO_ROOT, setDir, 'ops.csv');
  const gzPath = path.join(REPO_ROOT, setDir, 'ops.csv.gz');
  const text = fs.existsSync(csvPath)
    ? fs.readFileSync(csvPath, 'utf8')
    : zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf8');
  return parseCsv(text);
}

function opKey(row) {
  return `${row.method}\u0000${row.path}\u0000${row.operationId || ''}`;
}

// Multiset difference: what's in `a` more times than in `b`, as an array
// of {key, count} sorted by count descending, and the total count of the
// difference (for the summary line).
function multisetExtra(a, b) {
  const countsA = new Map();
  for (const k of a) countsA.set(k, (countsA.get(k) || 0) + 1);
  const countsB = new Map();
  for (const k of b) countsB.set(k, (countsB.get(k) || 0) + 1);
  const out = [];
  let total = 0;
  for (const [k, ca] of countsA) {
    const cb = countsB.get(k) || 0;
    if (ca > cb) {
      out.push({ key: k, count: ca - cb });
      total += ca - cb;
    }
  }
  out.sort((x, y) => y.count - x.count);
  return { examples: out.slice(0, EXAMPLE_LIMIT), total };
}

function mib(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

async function measureOneSpec(setDir, entry, expectedByKey) {
  const specFile = specFileFor(entry);
  const key = `${entry.provider}|${specFile}`;
  const expectedRows = expectedByKey.get(key) || [];

  const result = {
    provider: entry.provider,
    lockPath: entry.path,
    specFile,
    expectedCount: expectedRows.length,
    gotCount: 0,
    missing: { examples: [], total: 0 },
    extra: { examples: [], total: 0 },
    summaryMismatches: 0,
    descriptionMismatches: 0,
    loadError: null,
    lockCheck: null,
    loadMs: 0,
    walkMs: 0,
    rssAfterLoadMB: 0,
    rssAfterWalkMB: 0,
  };

  const filePath = path.join(REPO_ROOT, setDir, 'specs', entry.path);

  if (!USE_URL) {
    try {
      const { bytes, sha256 } = uncompressedBytesAndSha(filePath);
      result.lockCheck = {
        bytesOk: bytes === entry.bytes,
        shaOk: sha256 === entry.sha256,
        gotBytes: bytes,
        gotSha256: sha256,
      };
    } catch (err) {
      result.lockCheck = { error: err.message };
    }
  }

  const loadTarget = USE_URL ? entry.url : filePath;
  let doc;
  try {
    const t0 = performance.now();
    const loaded = await loadSpec(loadTarget);
    result.loadMs = performance.now() - t0;
    result.rssAfterLoadMB = process.memoryUsage().rss / (1024 * 1024);
    doc = loaded.doc;

    if (USE_URL) {
      // Informational only: the lock's bytes/sha256 describe the
      // uncompressed original, and loadSpec's are of the bytes as read
      // (before gunzip) — for an http(s) fetch of one of these vendors'
      // raw text/JSON URLs that IS the uncompressed original, so a direct
      // comparison is valid here (unlike a same comparison against the
      // on-disk .gz file, which would need the un-gzip step above).
      result.lockCheck = {
        bytesOk: loaded.bytes === entry.bytes,
        shaOk: loaded.sha256 === entry.sha256,
        gotBytes: loaded.bytes,
        gotSha256: loaded.sha256,
        live: true,
      };
    }
  } catch (err) {
    result.loadError = err.message;
    return result;
  }

  const t1 = performance.now();
  const operations = operationsFrom(doc);
  result.walkMs = performance.now() - t1;
  result.rssAfterWalkMB = process.memoryUsage().rss / (1024 * 1024);

  result.gotCount = operations.length;

  const expectedKeys = expectedRows.map(opKey);
  const gotKeys = operations.map(opKey);
  result.missing = multisetExtra(expectedKeys, gotKeys);
  result.extra = multisetExtra(gotKeys, expectedKeys);

  // Summary/description mismatch counts on MATCHED keys only. Rows can
  // share a key (duplicate operationId, or none, on two different rows);
  // matched occurrences are paired in encounter order per key, which is a
  // best-effort pairing, not an exact one, and is reported as such.
  const gotByKey = new Map();
  for (const op of operations) {
    const k = opKey(op);
    if (!gotByKey.has(k)) gotByKey.set(k, []);
    gotByKey.get(k).push(op);
  }
  for (const exp of expectedRows) {
    const k = opKey(exp);
    const bucket = gotByKey.get(k);
    if (!bucket || bucket.length === 0) continue;
    const got = bucket.shift();
    if ((exp.summary || '') !== (got.summary || '')) result.summaryMismatches++;
    if ((exp.description || '') !== (got.description || '')) result.descriptionMismatches++;
  }

  return result;
}

async function measureSet(setDir) {
  const lockPath = path.join(REPO_ROOT, setDir, 'specs.lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const opsRows = readOpsCsv(setDir);

  const expectedByKey = new Map();
  for (const row of opsRows) {
    const key = `${row.provider}|${row.spec_file}`;
    if (!expectedByKey.has(key)) expectedByKey.set(key, []);
    expectedByKey.get(key).push(row);
  }

  const results = [];
  for (const entry of lock) {
    results.push(await measureOneSpec(setDir, entry, expectedByKey));
  }
  return { setDir, results, opsRowCount: opsRows.length };
}

function printSetTable({ setDir, results, opsRowCount }) {
  console.log(`\n=== ${setDir} (${results.length} lock entries, ${opsRowCount} ops.csv rows) ===`);
  const w = { provider: 14, spec: 46, exp: 8, got: 8, miss: 8, extra: 8, sum: 6, desc: 6, load: 9, walk: 9, rss: 9 };
  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    pad('provider', w.provider) + pad('spec_file', w.spec) + pad('expected', w.exp) + pad('got', w.got)
    + pad('missing', w.miss) + pad('extra', w.extra) + pad('sumDiff', w.sum) + pad('descDiff', w.desc)
    + pad('loadMs', w.load) + pad('walkMs', w.walk) + pad('rssMB', w.rss),
  );

  let anyMismatch = false;
  let totalExpected = 0, totalGot = 0, totalMissing = 0, totalExtra = 0;
  let maxLoadMs = 0, maxWalkMs = 0, maxRssMB = 0, maxLoadSpec = '', maxRssSpec = '';

  for (const r of results) {
    totalExpected += r.expectedCount;
    totalGot += r.gotCount;
    totalMissing += r.missing.total;
    totalExtra += r.extra.total;
    if (r.missing.total > 0 || r.extra.total > 0) anyMismatch = true;

    const line = pad(r.provider, w.provider)
      + pad(r.specFile.length > w.spec - 2 ? '…' + r.specFile.slice(-(w.spec - 3)) : r.specFile, w.spec)
      + pad(r.expectedCount, w.exp) + pad(r.loadError ? 'ERR' : r.gotCount, w.got)
      + pad(r.missing.total, w.miss) + pad(r.extra.total, w.extra)
      + pad(r.summaryMismatches, w.sum) + pad(r.descriptionMismatches, w.desc)
      + pad(r.loadMs.toFixed(1), w.load) + pad(r.walkMs.toFixed(1), w.walk)
      + pad(r.rssAfterWalkMB.toFixed(1), w.rss);
    console.log(line);

    if (r.loadError) {
      console.log(`    LOAD ERROR: ${r.loadError}`);
    }
    if (r.lockCheck && r.lockCheck.error) {
      console.log(`    LOCK CHECK ERROR: ${r.lockCheck.error}`);
    } else if (r.lockCheck && (!r.lockCheck.bytesOk || !r.lockCheck.shaOk)) {
      console.log(`    LOCK MISMATCH${r.lockCheck.live ? ' (live)' : ''}: bytes lock=${r.lockCheck.bytesOk === false ? 'MISMATCH' : 'ok'} sha256 lock=${r.lockCheck.shaOk === false ? 'MISMATCH' : 'ok'}`);
    }
    if (r.missing.examples.length > 0) {
      console.log(`    missing examples: ${r.missing.examples.map((e) => e.key.replaceAll('\u0000', ' | ')).join('  ;;  ')}`);
    }
    if (r.extra.examples.length > 0) {
      console.log(`    extra examples:   ${r.extra.examples.map((e) => e.key.replaceAll('\u0000', ' | ')).join('  ;;  ')}`);
    }

    if (r.loadMs > maxLoadMs) { maxLoadMs = r.loadMs; maxLoadSpec = `${r.provider}/${r.specFile}`; }
    if (r.rssAfterWalkMB > maxRssMB) { maxRssMB = r.rssAfterWalkMB; maxRssSpec = `${r.provider}/${r.specFile}`; }
    if (r.walkMs > maxWalkMs) maxWalkMs = r.walkMs;
  }

  console.log(`--- ${setDir} totals: expected ${totalExpected}, got ${totalGot}, missing ${totalMissing}, extra ${totalExtra} ---`);
  console.log(`--- ${setDir} slowest load: ${maxLoadMs.toFixed(1)}ms (${maxLoadSpec}); slowest walk: ${maxWalkMs.toFixed(1)}ms; highest RSS: ${maxRssMB.toFixed(1)}MB (${maxRssSpec}) ---`);

  return { anyMismatch, totalExpected, totalGot, totalMissing, totalExtra, maxLoadMs, maxRssMB, maxRssSpec };
}

async function main() {
  console.log(USE_URL
    ? 'Running with --url: loading every spec from its locked URL (informational; live vendor drift expected, never affects exit code).'
    : 'Running against on-disk specs.');

  let anyMismatchOverall = false;
  let grandExpected = 0, grandGot = 0, grandMissing = 0, grandExtra = 0;
  let grandMaxRssMB = 0, grandMaxRssSpec = '';

  for (const setDir of SETS) {
    const setResult = await measureSet(setDir);
    const summary = printSetTable(setResult);
    if (!USE_URL && summary.anyMismatch) anyMismatchOverall = true;
    grandExpected += summary.totalExpected;
    grandGot += summary.totalGot;
    grandMissing += summary.totalMissing;
    grandExtra += summary.totalExtra;
    if (summary.maxRssMB > grandMaxRssMB) { grandMaxRssMB = summary.maxRssMB; grandMaxRssSpec = summary.maxRssSpec; }
  }

  console.log(`\n=== grand totals across all four sets: expected ${grandExpected}, got ${grandGot}, missing ${grandMissing}, extra ${grandExtra} ===`);
  console.log(`=== highest RSS after a walk: ${grandMaxRssMB.toFixed(1)}MB (${grandMaxRssSpec}) ===`);

  if (USE_URL) {
    console.log('\n--url run is informational only and does not affect the exit code.');
    process.exit(0);
  }

  process.exit(anyMismatchOverall ? 1 : 0);
}

main();
