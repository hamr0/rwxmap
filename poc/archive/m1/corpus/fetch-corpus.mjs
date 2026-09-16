#!/usr/bin/env node
// Downloads every spec listed in APIs.guru's v2 API list (list.json) into
// data/corpus/apis-guru-specs/, one JSON file per API key. The raw specs are
// gitignored (they're large and re-fetchable); this script exists so a
// re-extract never needs a re-download. Resumable: a file that already
// exists, is non-empty, and parses as JSON is skipped without a re-fetch.
// Vanilla Node, zero deps — global fetch + AbortController for the timeout.
//
// Usage:
//   node fetch-corpus.mjs             # full run (all APIs in list.json)
//   node fetch-corpus.mjs --limit 10  # only the first 10 APIs (for testing)

import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const OUT_DIR = path.join(REPO_ROOT, 'data/corpus/apis-guru-specs');
const LIST_URL = 'https://api.apis.guru/v2/list.json';

const CONCURRENCY = 6;
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

function parseArgs(argv) {
  let limit = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') {
      limit = Number(argv[i + 1]);
      i++;
    }
  }
  return { limit };
}

function keyToFile(key) {
  return key.replace(/:/g, '__') + '.json';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A file counts as already-fetched only if it exists, is non-empty, and
// parses as JSON — a truncated or corrupt prior download must be retried,
// not silently treated as done.
function isFetched(outPath) {
  if (!fs.existsSync(outPath)) return false;
  let stat;
  try {
    stat = fs.statSync(outPath);
  } catch {
    return false;
  }
  if (stat.size === 0) return false;
  try {
    JSON.parse(fs.readFileSync(outPath, 'utf8'));
    return true;
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

async function fetchOne(key, url) {
  const outPath = path.join(OUT_DIR, keyToFile(key));
  if (isFetched(outPath)) {
    return { key, status: 'skipped-existing', bytes: fs.statSync(outPath).size };
  }

  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(500 * 2 ** (attempt - 1)); // 500ms, 1s, 2s backoff
    }
    try {
      const res = await fetchWithTimeout(url);
      if (res.status === 404) {
        return { key, status: 'failed', bytes: 0, error: 'http 404' };
      }
      if (res.status >= 500) {
        lastErr = new Error(`http ${res.status}`);
        continue; // retryable
      }
      if (!res.ok) {
        return { key, status: 'failed', bytes: 0, error: `http ${res.status}` };
      }
      const text = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { key, status: 'failed', bytes: 0, error: 'non-JSON body' };
      }
      const bytes = Buffer.byteLength(text, 'utf8');
      fs.writeFileSync(outPath, JSON.stringify(parsed));
      return { key, status: 'downloaded', bytes };
    } catch (err) {
      lastErr = err;
      // network error / timeout: retryable
    }
  }
  return { key, status: 'failed', bytes: 0, error: String(lastErr) };
}

// Simple worker-pool: N workers pull the next index off a shared queue.
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

async function main() {
  const { limit } = parseArgs(process.argv.slice(2));

  let list;
  try {
    const res = await fetchWithTimeout(LIST_URL);
    if (!res.ok) throw new Error(`http ${res.status}`);
    list = await res.json();
  } catch (err) {
    console.error(`Could not fetch ${LIST_URL}: ${err}`);
    process.exit(1);
  }

  let entries = Object.entries(list);
  console.log(`Loaded ${entries.length} entries from list.json`);
  if (limit != null && Number.isFinite(limit)) {
    entries = entries.slice(0, limit);
    console.log(`--limit ${limit}: processing first ${entries.length} entries`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const counts = { downloaded: 0, 'skipped-existing': 0, failed: 0 };
  const failedKeys = [];
  let processed = 0;

  await runPool(entries, async ([key, entry]) => {
    const preferred = entry.preferred;
    const versions = entry.versions || {};
    const versionKeys = Object.keys(versions);
    let versionEntry = null;
    if (preferred && versions[preferred]) {
      versionEntry = versions[preferred];
    } else if (versionKeys.length > 0) {
      versionEntry = versions[versionKeys[versionKeys.length - 1]];
    }
    const swaggerUrl = versionEntry?.swaggerUrl;

    let result;
    if (!swaggerUrl) {
      result = { key, status: 'failed', bytes: 0, error: 'no swaggerUrl' };
    } else {
      result = await fetchOne(key, swaggerUrl);
    }

    counts[result.status] = (counts[result.status] || 0) + 1;
    if (result.status === 'failed') {
      failedKeys.push(`${key} (${result.error})`);
    }
    processed++;
    if (processed % 50 === 0) {
      console.log(
        `[${processed}/${entries.length}] downloaded=${counts.downloaded} `
        + `skipped-existing=${counts['skipped-existing']} failed=${counts.failed}`,
      );
    }
    return result;
  }, CONCURRENCY);

  let totalBytes = 0;
  try {
    for (const f of fs.readdirSync(OUT_DIR)) {
      totalBytes += fs.statSync(path.join(OUT_DIR, f)).size;
    }
  } catch {
    // OUT_DIR read failure shouldn't crash the summary
  }

  console.log('--- summary ---');
  console.log(`done/total: ${processed}/${entries.length}`);
  console.log(`downloaded: ${counts.downloaded}`);
  console.log(`skipped-existing: ${counts['skipped-existing']}`);
  console.log(`failed: ${counts.failed}`);
  console.log(`total bytes on disk (${OUT_DIR}): ${totalBytes}`);
  if (failedKeys.length > 0) {
    console.log('failed keys:');
    for (const k of failedKeys) console.log(`  - ${k}`);
  }
}

main();
