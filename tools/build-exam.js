#!/usr/bin/env node
// Builds data/exam-2026-09-17/ — the clean exam corpus of three unseen
// complete provider APIs (Okta, DocuSign, Xero).
//
// A fresh script, not an edit of the 15-provider corpus builder: that one
// (poc/archive/v2/provider-corpus/{fetch,extract}.mjs) is archived and
// frozen. This one mirrors its conventions exactly — same specs.lock.json
// shape, same ops.csv header and cell spellings — but is a single
// deterministic, re-runnable pass over three inline (no $ref'd
// path-items) specs, so it needs none of the archived script's worker
// pool or external-ref resolution.
//
// Fetch is resumable: a spec whose `.gz` already exists on disk is read
// from disk, never re-fetched, so a re-run makes no network calls and
// produces byte-identical output.
//
// specs.lock.json records each spec's url, the UNCOMPRESSED byte length
// and the sha256 of the UNCOMPRESSED original — verified to be what the
// 15-provider lock records.
//
// Usage: node tools/build-exam.js

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { toCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'data/exam-2026-09-17');
const SPECS_DIR = path.join(DATA_DIR, 'specs');
const LOCK_PATH = path.join(DATA_DIR, 'specs.lock.json');
const CSV_PATH = path.join(DATA_DIR, 'ops.csv');
const GZ_PATH = path.join(DATA_DIR, 'ops.csv.gz');

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

// Real HTTP methods only — parameters/servers/summary/description at
// path-item level are not operations.
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const REPORT_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const HEADER = [
  'provider', 'spec_file', 'path', 'method', 'operationId', 'summary',
  'description', 'has_summary', 'has_description', 'has_operationId', 'deprecated',
];

const PROVIDERS = [
  {
    key: 'okta',
    format: 'yaml',
    url: 'https://raw.githubusercontent.com/okta/okta-management-openapi-spec/master/dist/current/management-minimal.yaml',
    expected: { total: 734, GET: 290, POST: 235, PUT: 85, DELETE: 111, PATCH: 13 },
  },
  {
    key: 'docusign',
    format: 'json',
    url: 'https://raw.githubusercontent.com/docusign/OpenAPI-Specifications/master/esignature.rest.swagger-v2.1.json',
    expected: { total: 414, GET: 167, POST: 65, PUT: 105, DELETE: 77, PATCH: 0 },
  },
  {
    key: 'xero',
    format: 'yaml',
    url: 'https://raw.githubusercontent.com/XeroAPI/Xero-OpenAPI/master/xero_accounting.yaml',
    expected: { total: 235, GET: 126, POST: 46, PUT: 53, DELETE: 10, PATCH: 0 },
  },
];

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
// `<originalPath>.gz` first if that file is not already on disk.
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

function extractInline(doc, provider, specFile, rows, methodCounts) {
  const paths = doc?.paths;
  if (!paths || typeof paths !== 'object') return;
  for (const [p, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;
      const summary = str(op.summary);
      const description = str(op.description);
      const operationId = str(op.operationId);
      const M = method.toUpperCase();
      rows.push({
        provider,
        spec_file: specFile,
        path: p,
        method: M,
        operationId,
        summary,
        description,
        has_summary: String(summary !== ''),
        has_description: String(description !== ''),
        has_operationId: String(operationId !== ''),
        deprecated: String(op.deprecated === true),
      });
      methodCounts[M] = (methodCounts[M] || 0) + 1;
    }
  }
}

async function main() {
  fs.mkdirSync(SPECS_DIR, { recursive: true });

  const lock = [];
  const rows = [];
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

    const text = buf.toString('utf8');
    const doc = p.format === 'yaml' ? parseYaml(text) : JSON.parse(text);
    const version = doc.openapi ? `OpenAPI ${doc.openapi}` : doc.swagger ? `Swagger ${doc.swagger}` : 'unknown';
    console.log(`  spec version: ${version}`);

    const methodCounts = {};
    const before = rows.length;
    extractInline(doc, p.key, fileName, rows, methodCounts);
    perProvider.set(p.key, { total: rows.length - before, methodCounts });
  }

  lock.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');
  console.log(`Wrote ${LOCK_PATH} (${lock.length} entries)`);

  const csvText = toCsv(rows, HEADER);
  fs.writeFileSync(CSV_PATH, csvText);
  fs.writeFileSync(GZ_PATH, zlib.gzipSync(Buffer.from(csvText, 'utf8')));
  console.log(`Wrote ${CSV_PATH} and ${GZ_PATH} (${rows.length} rows)`);

  console.log('--- verification: actual/expected ---');
  const w = 14;
  console.log(['provider', 'total', ...REPORT_METHODS].map((c) => c.padEnd(w)).join(''));

  let anyMismatch = false;
  for (const p of PROVIDERS) {
    const actual = perProvider.get(p.key);
    const totalOk = actual.total === p.expected.total;
    if (!totalOk) anyMismatch = true;
    const cells = [`${p.key}${totalOk ? '' : ' *'}`.padEnd(w), `${actual.total}/${p.expected.total}`.padEnd(w)];
    for (const m of REPORT_METHODS) {
      const exp = p.expected[m];
      const act = actual.methodCounts[m] || 0;
      if (exp !== act) anyMismatch = true;
      cells.push(`${act}/${exp}${exp === act ? '' : '*'}`.padEnd(w));
    }
    console.log(cells.join(''));
  }

  // Any method outside the five reported ones would be silently dropped
  // from the table above, so name it explicitly.
  const extraMethods = new Set();
  for (const { methodCounts } of perProvider.values()) {
    for (const m of Object.keys(methodCounts)) if (!REPORT_METHODS.includes(m)) extraMethods.add(m);
  }
  if (extraMethods.size > 0) {
    anyMismatch = true;
    console.log(`UNEXPECTED METHODS present: ${[...extraMethods].sort().join(', ')}`);
  }

  if (anyMismatch) {
    console.log('MISMATCH: extracted counts do not match the scouted expectations exactly (see * above).');
    process.exit(1);
  }
  console.log(`All ${PROVIDERS.length} providers match expected counts exactly (${rows.length} rows total).`);
}

main();
