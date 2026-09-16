#!/usr/bin/env node
// M1-C3: download every spec listed in APIs.guru's v2 API list (list.json)
// into CORPUS_DIR/specs/, one JSON file per index key. Resumable (skips
// files already on disk), concurrency-limited, size-capped. Vanilla Node,
// zero deps — global fetch + AbortController for the timeout.
//
// Usage: node fetch.mjs

import fs from 'node:fs';
import path from 'node:path';
import { toCsv } from '../../m0/csv.mjs';

const CORPUS_DIR = process.env.CORPUS_DIR
  || '/tmp/claude-1000/-home-hamr-PycharmProjects-rwxmap/5e1207e7-5a40-4424-afe1-4b1a53e86dc5/scratchpad/corpus/';
const LIST_PATH = path.join(CORPUS_DIR, 'list.json');
const SPECS_DIR = path.join(CORPUS_DIR, 'specs');
const LOG_PATH = path.join(CORPUS_DIR, 'fetch-log.csv');

const CONCURRENCY = 8;
const TIMEOUT_MS = 45_000;
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function keyToFile(key) {
  return key.replace(/:/g, '__') + '.json';
}

// Fetch a single URL with a timeout and a hard size cap, enforced both via
// Content-Length (if present) and while streaming the body (in case the
// header is absent or understates the real size).
async function fetchCapped(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`http ${res.status}`);
    }
    const cl = res.headers.get('content-length');
    if (cl && Number(cl) > MAX_BYTES) {
      return { tooLarge: true, bytes: Number(cl) };
    }
    if (!res.body) {
      const text = await res.text();
      const bytes = Buffer.byteLength(text, 'utf8');
      if (bytes > MAX_BYTES) return { tooLarge: true, bytes };
      return { tooLarge: false, bytes, text };
    }
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        controller.abort();
        return { tooLarge: true, bytes: total };
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { tooLarge: false, bytes: buf.byteLength, text: buf.toString('utf8') };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOne(key, url) {
  const outPath = path.join(SPECS_DIR, keyToFile(key));
  if (fs.existsSync(outPath)) {
    const bytes = fs.statSync(outPath).size;
    return { key, provider: key.split(':')[0], status: 'cached', bytes };
  }

  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fetchCapped(url);
      if (result.tooLarge) {
        return { key, provider: key.split(':')[0], status: 'skipped-size', bytes: result.bytes };
      }
      fs.writeFileSync(outPath, result.text);
      return { key, provider: key.split(':')[0], status: 'ok', bytes: result.bytes };
    } catch (err) {
      lastErr = err;
    }
  }
  return { key, provider: key.split(':')[0], status: 'failed', bytes: 0, error: String(lastErr) };
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
  const list = JSON.parse(fs.readFileSync(LIST_PATH, 'utf8'));
  const entries = Object.entries(list);
  fs.mkdirSync(SPECS_DIR, { recursive: true });

  console.log(`Loaded ${entries.length} entries from list.json`);

  const counts = { ok: 0, cached: 0, 'skipped-size': 0, failed: 0 };
  const logRows = [];
  let processed = 0;

  await runPool(entries, async ([key, entry]) => {
    const preferred = entry.preferred;
    const swaggerUrl = entry.versions?.[preferred]?.swaggerUrl;
    let result;
    if (!swaggerUrl) {
      result = { key, provider: key.split(':')[0], status: 'failed', bytes: 0, error: 'no swaggerUrl' };
    } else {
      result = await fetchOne(key, swaggerUrl);
    }
    counts[result.status] = (counts[result.status] || 0) + 1;
    logRows.push({ key: result.key, provider: result.provider, status: result.status, bytes: String(result.bytes) });
    processed++;
    if (processed % 100 === 0) {
      console.log(`[${processed}/${entries.length}] ok=${counts.ok} cached=${counts.cached} failed=${counts.failed} skipped-size=${counts['skipped-size']}`);
    }
    return result;
  }, CONCURRENCY);

  fs.writeFileSync(LOG_PATH, toCsv(logRows, ['key', 'provider', 'status', 'bytes']));
  console.log(`[${processed}/${entries.length}] ok=${counts.ok} cached=${counts.cached} failed=${counts.failed} skipped-size=${counts['skipped-size']}`);
  console.log('Wrote', LOG_PATH);
}

main();
