#!/usr/bin/env node
// Downloads every provider's spec listed in providers.json into
// data/provider-corpus-2026-09-16/specs/<key>/, preserving a sane filename
// (or, for DigitalOcean's externalRefs provider, the $ref'd file's relative
// path under the main spec's directory). Each spec is stored gzipped in
// place as `<original-name>.gz` (node zlib, no shelling out to gzip) —
// `gunzip -c` returns the original bytes exactly. Resumable: a file that
// already has a non-zero `.gz` on disk is skipped without a re-fetch.
// Modelled on poc/archive/m1/corpus/fetch-corpus.mjs (worker-pool,
// timeout+retry+backoff), generalized to raw bytes since these specs are
// a mix of JSON and YAML.
//
// Writes data/provider-corpus-2026-09-16/specs.lock.json (TRACKED): for
// every fetched file, its source url, the UNCOMPRESSED byte length and the
// sha256 of the UNCOMPRESSED original — this is what makes the tracked
// snapshot checkable, independent of gzip's own encoding choices.
//
// Usage:
//   node fetch.mjs             # fetch (resumable)
//   node fetch.mjs --verify    # re-read every stored .gz, compare sha256
//                               # against specs.lock.json, no network calls

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const PROVIDERS_PATH = path.join(import.meta.dirname, 'providers.json');
const DATA_DIR = path.join(REPO_ROOT, 'data/provider-corpus-2026-09-16');
const SPECS_DIR = path.join(DATA_DIR, 'specs');
const LOCK_PATH = path.join(DATA_DIR, 'specs.lock.json');

const CONCURRENCY = 20;
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gzPathFor(originalPath) {
  return originalPath + '.gz';
}

function isFetched(originalPath) {
  const gzPath = gzPathFor(originalPath);
  if (!fs.existsSync(gzPath)) return false;
  try {
    return fs.statSync(gzPath).size > 0;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sha256Of(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Fetches one url, storing the gzip of the original bytes at
// `<originalPath>.gz`. Returns { status, bytes, sha256, error } where
// `bytes`/`sha256` describe the UNCOMPRESSED original.
async function fetchOne(url, originalPath) {
  const gzPath = gzPathFor(originalPath);
  if (isFetched(originalPath)) {
    const buf = zlib.gunzipSync(fs.readFileSync(gzPath));
    return { status: 'skipped-existing', bytes: buf.length, sha256: sha256Of(buf) };
  }

  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(500 * 2 ** (attempt - 1)); // 500ms, 1s, 2s backoff
    }
    try {
      const res = await fetchWithTimeout(url);
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`http ${res.status}`);
        continue; // retryable
      }
      if (!res.ok) {
        return { status: 'failed', bytes: 0, error: `http ${res.status}` };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) {
        lastErr = new Error('empty body');
        continue; // retryable
      }
      fs.mkdirSync(path.dirname(gzPath), { recursive: true });
      fs.writeFileSync(gzPath, zlib.gzipSync(buf));
      return { status: 'downloaded', bytes: buf.length, sha256: sha256Of(buf) };
    } catch (err) {
      lastErr = err; // network error / timeout: retryable
    }
  }
  return { status: 'failed', bytes: 0, error: String(lastErr) };
}

async function runPool(items, worker, concurrency) {
  let next = 0;
  const results = new Array(items.length);
  async function work() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, work));
  return results;
}

function urlFileName(url) {
  return decodeURIComponent(new URL(url).pathname.split('/').pop());
}

// Walks a parsed OpenAPI/Swagger doc's `paths` object and collects every
// $ref found directly on a method (get/put/post/...), which is how
// DigitalOcean's spec splits each operation into its own file. Only this
// one level is needed: the referenced files carry operationId/summary/
// description directly (verified against a live sample), not further
// external refs to other operation files.
function collectPathRefs(doc) {
  const refs = new Set();
  const paths = doc?.paths;
  if (!paths || typeof paths !== 'object') return refs;
  for (const pathItem of Object.values(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of METHODS) {
      const op = pathItem[method];
      if (op && typeof op === 'object' && typeof op.$ref === 'string') {
        refs.add(op.$ref);
      }
    }
  }
  return refs;
}

function parseDoc(format, text) {
  return format === 'yaml' ? parseYaml(text) : JSON.parse(text);
}

// Reads and gunzips the original file stored at `<originalPath>.gz`.
function readOriginal(originalPath) {
  return zlib.gunzipSync(fs.readFileSync(gzPathFor(originalPath))).toString('utf8');
}

async function verify() {
  if (!fs.existsSync(LOCK_PATH)) {
    console.error(`${LOCK_PATH} does not exist — run a fetch first`);
    process.exit(1);
  }
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  console.log(`Verifying ${lock.length} entries from ${LOCK_PATH} against stored .gz files`);

  const byProvider = new Map();
  const mismatches = [];

  for (const entry of lock) {
    const gzPath = path.join(SPECS_DIR, entry.path);
    if (!byProvider.has(entry.provider)) byProvider.set(entry.provider, { pass: 0, fail: 0 });
    const c = byProvider.get(entry.provider);

    let ok = true;
    let actualSha = null;
    let actualBytes = null;
    try {
      const buf = zlib.gunzipSync(fs.readFileSync(gzPath));
      actualBytes = buf.length;
      actualSha = sha256Of(buf);
      ok = actualSha === entry.sha256 && actualBytes === entry.bytes;
    } catch (err) {
      ok = false;
      mismatches.push({ path: entry.path, error: String(err) });
    }

    if (ok) {
      c.pass++;
    } else {
      c.fail++;
      if (actualSha != null) {
        mismatches.push({
          path: entry.path,
          expectedSha256: entry.sha256,
          actualSha256: actualSha,
          expectedBytes: entry.bytes,
          actualBytes,
        });
      }
    }
  }

  console.log('--- per-provider verify ---');
  let anyFail = false;
  for (const [provider, c] of [...byProvider.entries()].sort()) {
    const status = c.fail === 0 ? 'PASS' : 'FAIL';
    if (c.fail > 0) anyFail = true;
    console.log(`${provider}: ${status} (pass=${c.pass} fail=${c.fail})`);
  }

  if (mismatches.length > 0) {
    console.log('--- mismatches ---');
    for (const m of mismatches) console.log(`  ${JSON.stringify(m)}`);
  }

  if (anyFail) {
    console.error(`verify FAILED: ${mismatches.length} mismatch(es)`);
    process.exit(1);
  }
  console.log('verify OK: all entries match specs.lock.json');
  process.exit(0);
}

async function main() {
  if (process.argv.includes('--verify')) {
    await verify();
    return;
  }

  const providers = JSON.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'));
  fs.mkdirSync(SPECS_DIR, { recursive: true });

  // Phase 1: fetch every main spec file listed in providers.json.
  const tasks = [];
  for (const p of providers) {
    for (const url of p.urls) {
      const outPath = path.join(SPECS_DIR, p.key, urlFileName(url));
      tasks.push({ providerKey: p.key, url, outPath, relPath: path.relative(path.join(SPECS_DIR, p.key), outPath) });
    }
  }

  console.log(`Phase 1: fetching ${tasks.length} main spec file(s) across ${providers.length} providers`);
  const results = await runPool(tasks, async (t) => ({ ...t, ...(await fetchOne(t.url, t.outPath)) }), CONCURRENCY);

  // Phase 2: for externalRefs providers, parse the fetched main file(s) and
  // fetch every $ref'd operation file too, preserving relative paths.
  const extraResults = [];
  for (const p of providers.filter((p) => p.externalRefs)) {
    const mainTasks = results.filter((r) => r.providerKey === p.key);
    const extraTasks = [];
    for (const mt of mainTasks) {
      if (mt.status === 'failed') continue;
      let doc;
      try {
        doc = parseDoc(p.format, readOriginal(mt.outPath));
      } catch (err) {
        console.error(`  ${p.key}: could not parse ${mt.outPath} to walk $ref: ${err}`);
        continue;
      }
      const refs = collectPathRefs(doc);
      for (const ref of refs) {
        const refUrl = new URL(ref, mt.url).href;
        const refOutPath = path.join(path.dirname(mt.outPath), ref);
        extraTasks.push({ providerKey: p.key, url: refUrl, outPath: refOutPath });
      }
    }
    console.log(`Phase 2 (${p.key}): found ${extraTasks.length} external $ref'd file(s) to fetch`);
    const extraRes = await runPool(extraTasks, async (t) => ({ ...t, ...(await fetchOne(t.url, t.outPath)) }), CONCURRENCY);
    extraResults.push(...extraRes);
  }

  const all = [...results, ...extraResults];

  // Per-provider summary.
  const byProvider = new Map();
  for (const r of all) {
    if (!byProvider.has(r.providerKey)) byProvider.set(r.providerKey, { downloaded: 0, 'skipped-existing': 0, failed: 0, bytes: 0 });
    const c = byProvider.get(r.providerKey);
    c[r.status] = (c[r.status] || 0) + 1;
    c.bytes += r.bytes || 0;
  }
  console.log('--- per-provider summary ---');
  for (const p of providers) {
    const c = byProvider.get(p.key) || { downloaded: 0, 'skipped-existing': 0, failed: 0, bytes: 0 };
    console.log(`${p.key}: downloaded=${c.downloaded} skipped=${c['skipped-existing']} failed=${c.failed} bytes=${c.bytes}`);
  }

  const failed = all.filter((r) => r.status === 'failed');
  if (failed.length > 0) {
    console.log('--- failed urls ---');
    for (const f of failed) console.log(`  ${f.providerKey} ${f.url}: ${f.error}`);
  }

  // specs.lock.json: one entry per successfully-fetched file. `path` points
  // at the stored `.gz` file (relative to SPECS_DIR); `bytes`/`sha256`
  // describe the UNCOMPRESSED original.
  const lock = all
    .filter((r) => r.status !== 'failed')
    .map((r) => ({
      provider: r.providerKey,
      path: path.relative(SPECS_DIR, gzPathFor(r.outPath)),
      url: r.url,
      bytes: r.bytes,
      sha256: r.sha256,
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');
  console.log(`Wrote ${LOCK_PATH} (${lock.length} entries)`);

  const totalFiles = all.length;
  const totalDownloaded = all.filter((r) => r.status === 'downloaded').length;
  const totalSkipped = all.filter((r) => r.status === 'skipped-existing').length;
  console.log(`--- totals: files=${totalFiles} downloaded=${totalDownloaded} skipped=${totalSkipped} failed=${failed.length} ---`);

  if (failed.length > 0) {
    console.error(`${failed.length} url(s) failed after retries`);
    process.exit(1);
  }
}

main();
