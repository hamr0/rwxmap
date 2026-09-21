#!/usr/bin/env node
// Builds data/exam-2026-09-20/ — a clean exam for step 2, drawn from five
// locked exam vendors (auth0, hubspot, klaviyo, miro, zendesk) that no prior
// corpus, exam or holdout has ever seen.
//
// BURNED, NEVER RE-ADD: cloudflare, pagerduty and sentry were in the first
// draft of this script and have been removed. All three already appear in
// data/corpus/labelled.csv as the M0-era holdouts — cloudflare 71 rows
// (holdout4), pagerduty 93 rows (holdout2), sentry 76 rows (holdout3) — and
// holdout3 was tuned on. They are burned for exam use by vendor name, so
// putting any of them back would silently make this exam dirty.
//
// A fresh script, not an edit of tools/build-exam.js: that one takes three
// whole APIs entire, this one draws a capped, method-stratified sample from
// five much larger ones and has to unpack a tarball for hubspot. It mirrors
// that script's conventions exactly — same specs.lock.json shape, same
// ops.csv header and cell spellings, same resumable fetch, same
// sha256-of-uncompressed locking.
//
// WRITE METHODS ONLY: post, put, delete, patch. No GET/HEAD/OPTIONS/TRACE.
// That is deliberate. Step 1 (the r step) scored 583/583 on the
// 2026-09-17 exam, so read rows are not what this exam tests; every row
// here is a row step 2 has to rule on.
//
// NO TRUTH, NO LABELS: this directory carries no class column of any kind.
// Nothing here computes, imports or references any classifier output, and
// nothing here imports from src/.
//
// Fetch is resumable: a spec whose `.gz` already exists on disk is read
// from disk, never re-fetched, so a re-run makes no network calls and
// produces byte-identical output.
//
// specs.lock.json records each spec's url, the UNCOMPRESSED byte length
// and the sha256 of the UNCOMPRESSED original. For hubspot the locked
// "original" is the tarball itself, not the several hundred spec files
// inside it.
//
// The draw is deterministic: mulberry32 seeded 20260920, one fresh rng per
// vendor, so each vendor's sample is independent and reproducible.
//
// Usage: node tools/build-exam-2026-09-20.js

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { toCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'data/exam-2026-09-20');
const SPECS_DIR = path.join(DATA_DIR, 'specs');
const LOCK_PATH = path.join(DATA_DIR, 'specs.lock.json');
const CSV_PATH = path.join(DATA_DIR, 'ops.csv');
const GZ_PATH = path.join(DATA_DIR, 'ops.csv.gz');

const TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;

const SEED = 20260920;
const CAP = 250;

// Write methods only — see the header comment. Also the round-robin order
// the stratified draw takes one row at a time from.
const METHODS = ['post', 'put', 'delete', 'patch'];
const REPORT_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

const HEADER = [
  'provider', 'spec_file', 'path', 'method', 'operationId', 'summary',
  'description', 'has_summary', 'has_description', 'has_operationId', 'deprecated',
];

// `expected` is the count I measured by hand before writing this script:
// `available` is deduped write-method rows in the spec, `drawn` is what the
// draw keeps. A mismatch means the vendor changed its spec upstream, which
// must be loud rather than silently reshaping the exam.
const PROVIDERS = [
  {
    key: 'auth0',
    format: 'json',
    url: 'https://auth0.com/docs/oas/management/v2/management-api-oas.json',
    expected: { available: 276, drawn: 250 },
  },
  {
    key: 'hubspot',
    format: 'tarball',
    url: 'https://codeload.github.com/HubSpot/HubSpot-public-api-spec-collection/tar.gz/refs/heads/main',
    expected: { available: 852, drawn: 250 },
  },
  {
    // Klaviyo publishes no PUT operations at all, so its PUT cell in the
    // per-method table below is 0. That is the spec, not a bug.
    key: 'klaviyo',
    format: 'json',
    url: 'https://raw.githubusercontent.com/klaviyo/openapi/main/openapi/stable.json',
    expected: { available: 141, drawn: 141 },
  },
  {
    key: 'miro',
    format: 'json',
    url: 'https://raw.githubusercontent.com/miroapp/api-clients/main/packages/generator/spec.json',
    expected: { available: 112, drawn: 112 },
  },
  {
    key: 'zendesk',
    format: 'yaml',
    url: 'https://developer.zendesk.com/zendesk/oas.yaml',
    expected: { available: 311, drawn: 250 },
  },
];

const EXPECTED_TOTAL = 1003;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256Of = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const urlFileName = (url) => decodeURIComponent(new URL(url).pathname.split('/').pop());

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Returns the UNCOMPRESSED original bytes of one spec, downloading it to
// `<originalPath>.gz` first if that file is not already on disk. For the
// hubspot tarball "uncompressed original" means the .tar.gz bytes as the
// server sent them — that is the artefact being locked.
async function fetchOne(url, originalPath) {
  const gzPath = originalPath + '.gz';
  if (fs.existsSync(gzPath) && fs.statSync(gzPath).size > 0) {
    return { status: 'skipped-existing', buf: zlib.gunzipSync(fs.readFileSync(gzPath)) };
  }

  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1)); // 500ms, 1s, 2s backoff
    try {
      const res = await fetchWithTimeout(url);
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`http ${res.status}`);
        continue; // retryable
      }
      if (!res.ok) throw new Error(`http ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) {
        lastErr = new Error('empty body');
        continue; // retryable
      }
      fs.mkdirSync(path.dirname(gzPath), { recursive: true });
      fs.writeFileSync(gzPath, zlib.gzipSync(buf));
      return { status: 'downloaded', buf };
    } catch (err) {
      lastErr = err; // network error / timeout: retryable
    }
  }
  throw new Error(`${url}: failed after retries: ${lastErr}`);
}

const str = (v) => (v == null ? '' : String(v).trim());

// mulberry32: a 32-bit seeded PRNG, written inline so the draw needs no
// dependency and reproduces exactly on any machine.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates, in place, driven by the caller's rng.
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Pulls the write-method operations out of one inline-path-item document.
// These specs need no external $ref resolution; a $ref'd path item would
// silently drop operations, so it is a hard stop rather than a skip.
function extractInline(doc, provider, specFile, rows) {
  const paths = doc?.paths;
  if (!paths || typeof paths !== 'object') return;
  for (const [p, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    if (typeof pathItem.$ref === 'string') {
      throw new Error(`${provider} ${specFile}: path item ${p} is $ref'd ($ref: ${pathItem.$ref}); this script only reads inline path items — STOP and rethink extraction`);
    }
    for (const method of METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;
      const summary = str(op.summary);
      const description = str(op.description);
      const operationId = str(op.operationId);
      rows.push({
        provider,
        spec_file: specFile,
        path: p,
        method: method.toUpperCase(),
        operationId,
        summary,
        description,
        has_summary: String(summary !== ''),
        has_description: String(description !== ''),
        has_operationId: String(operationId !== ''),
        deprecated: String(op.deprecated === true),
      });
    }
  }
}

// Drops repeated endpoints, keeping the first occurrence in document order.
// Spec collections (hubspot especially) restate the same operation across
// files, and a duplicate would otherwise get two chances at the draw.
function dedupe(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = `${r.provider}\u0000${r.method}\u0000${r.path}\u0000${r.operationId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// Hubspot is not one document: it is a repo tarball of several hundred
// specs. Keep only `*.json` files under a `Rollouts` directory, group them
// by the directory prefix before `/Rollouts/`, and keep the
// lexicographically greatest full path per group — that selects the newest
// rollout date and version for each API.
function hubspotSpecFiles(dir) {
  const found = [];
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.json')) found.push(full);
    }
  };
  walk(dir);

  const newestPerGroup = new Map();
  for (const full of found) {
    const rel = path.relative(dir, full);
    const marker = rel.indexOf('/Rollouts/');
    if (marker === -1) continue;
    const group = rel.slice(0, marker);
    const prev = newestPerGroup.get(group);
    if (prev === undefined || rel > prev) newestPerGroup.set(group, rel);
  }
  return [...newestPerGroup.values()].sort();
}

// Unpacks the tarball bytes into a throwaway directory and returns the
// path to its `PublicApiSpecs` tree. The tarball stays the locked
// artefact; nothing extracted is written into the repo.
function unpackHubspot(buf) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-hubspot-'));
  const tarPath = path.join(tmp, 'hubspot.tar.gz');
  fs.writeFileSync(tarPath, buf);
  execFileSync('tar', ['-xzf', tarPath, '-C', tmp]);
  const roots = fs.readdirSync(tmp, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(tmp, e.name));
  if (roots.length !== 1) throw new Error(`hubspot tarball: expected one top-level directory, got ${roots.length}`);
  const specs = path.join(roots[0], 'PublicApiSpecs');
  if (!fs.existsSync(specs)) throw new Error(`hubspot tarball: no PublicApiSpecs directory under ${roots[0]}`);
  return { tmp, specs };
}

// Reads every kept hubspot spec and returns its rows plus the number of
// files that would not parse (reported, never silently swallowed).
function extractHubspot(buf, provider) {
  const { tmp, specs } = unpackHubspot(buf);
  try {
    const files = hubspotSpecFiles(specs);
    const rows = [];
    let skipped = 0;
    for (const rel of files) {
      let doc;
      try {
        doc = JSON.parse(fs.readFileSync(path.join(specs, rel), 'utf8'));
      } catch {
        skipped++;
        continue; // a spec that will not parse cannot contribute rows
      }
      // spec_file is the path inside PublicApiSpecs, since one file name
      // (`spec.json`) repeats across every API in the collection.
      extractInline(doc, provider, rel, rows);
    }
    return { rows, files: files.length, skipped };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// The draw. Vendors at or under the cap are taken entire. Above it, each
// method's rows are shuffled separately and then taken one at a time in
// POST/PUT/DELETE/PATCH order, so the sample is spread evenly across the
// four write methods instead of following the vendor's own method mix.
function drawRows(rows, rng) {
  if (rows.length <= CAP) return rows.slice();

  const byMethod = REPORT_METHODS.map((m) => shuffle(rows.filter((r) => r.method === m), rng));
  const picked = [];
  let anyLeft = true;
  while (picked.length < CAP && anyLeft) {
    anyLeft = false;
    for (const list of byMethod) {
      if (list.length === 0) continue;
      picked.push(list.pop());
      anyLeft = true;
      if (picked.length === CAP) break;
    }
  }
  return picked;
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

async function main() {
  fs.mkdirSync(SPECS_DIR, { recursive: true });

  const lock = [];
  const drawn = [];
  const perProvider = new Map();

  for (const p of PROVIDERS) {
    const fileName = urlFileName(p.url);
    const originalPath = path.join(SPECS_DIR, p.key, fileName);
    const { status, buf } = await fetchOne(p.url, originalPath);
    console.log(`${p.key}: ${status} ${fileName} (${buf.length} bytes uncompressed)`);

    lock.push({
      provider: p.key,
      path: path.relative(SPECS_DIR, originalPath + '.gz'),
      url: p.url,
      bytes: buf.length,
      sha256: sha256Of(buf),
    });

    const raw = [];
    if (p.format === 'tarball') {
      const { rows, files, skipped } = extractHubspot(buf, p.key);
      raw.push(...rows);
      console.log(`  tarball: ${files} newest-rollout specs kept, ${skipped} skipped (would not parse)`);
    } else {
      const text = buf.toString('utf8');
      const doc = p.format === 'yaml' ? parseYaml(text) : JSON.parse(text);
      const version = doc.openapi ? `OpenAPI ${doc.openapi}` : doc.swagger ? `Swagger ${doc.swagger}` : 'unknown';
      console.log(`  spec version: ${version}`);
      extractInline(doc, p.key, fileName, raw);
    }

    const available = dedupe(raw);
    // One fresh rng per vendor: each vendor's draw is independent of the
    // ones before it, so adding or dropping a vendor cannot reshuffle
    // anybody else's sample.
    const picked = drawRows(available, mulberry32(SEED));
    drawn.push(...picked);

    const methodCounts = {};
    for (const r of picked) methodCounts[r.method] = (methodCounts[r.method] || 0) + 1;
    perProvider.set(p.key, { available: available.length, drawn: picked.length, methodCounts });
    console.log(`  ${available.length} deduped write-method rows available, ${picked.length} drawn`);
  }

  // Stable final order, independent of the order the draw happened to pick.
  drawn.sort((a, b) => cmp(a.provider, b.provider) || cmp(a.method, b.method)
    || cmp(a.path, b.path) || cmp(a.operationId, b.operationId));

  lock.sort((a, b) => cmp(a.path, b.path));
  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');
  console.log(`Wrote ${LOCK_PATH} (${lock.length} entries)`);

  const csvText = toCsv(drawn, HEADER);
  fs.writeFileSync(CSV_PATH, csvText);
  fs.writeFileSync(GZ_PATH, zlib.gzipSync(Buffer.from(csvText, 'utf8')));
  console.log(`Wrote ${CSV_PATH} and ${GZ_PATH} (${drawn.length} rows)`);

  console.log('--- verification: actual/expected ---');
  const w = 14;
  console.log(['provider', 'available', 'drawn', ...REPORT_METHODS].map((c) => c.padEnd(w)).join(''));

  let anyMismatch = false;
  for (const p of PROVIDERS) {
    const actual = perProvider.get(p.key);
    const availOk = actual.available === p.expected.available;
    const drawnOk = actual.drawn === p.expected.drawn;
    if (!availOk || !drawnOk) anyMismatch = true;
    const cells = [
      `${p.key}${availOk && drawnOk ? '' : ' *'}`.padEnd(w),
      `${actual.available}/${p.expected.available}${availOk ? '' : '*'}`.padEnd(w),
      `${actual.drawn}/${p.expected.drawn}${drawnOk ? '' : '*'}`.padEnd(w),
    ];
    // The per-method split of the drawn rows has no pinned expectation —
    // it is reported so the stratification can be read, not asserted.
    for (const m of REPORT_METHODS) cells.push(String(actual.methodCounts[m] || 0).padEnd(w));
    console.log(cells.join(''));
  }

  const totalOk = drawn.length === EXPECTED_TOTAL;
  if (!totalOk) anyMismatch = true;
  console.log(`TOTAL drawn: ${drawn.length}/${EXPECTED_TOTAL}${totalOk ? '' : ' *'}`);

  const missing = (field) => drawn.filter((r) => r[field] === 'false').length;
  console.log(`missing summary: ${missing('has_summary')}  missing description: ${missing('has_description')}  missing operationId: ${missing('has_operationId')}`);

  if (anyMismatch) {
    console.log('MISMATCH: extracted/drawn counts do not match the scouted expectations exactly (see * above).');
    process.exit(1);
  }
  console.log(`All ${PROVIDERS.length} providers match expected counts exactly (${drawn.length} rows total).`);
}

main();
