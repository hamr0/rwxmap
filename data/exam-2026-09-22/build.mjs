#!/usr/bin/env node
// Builds data/exam-2026-09-22/ops.csv — the M3 clean exam corpus of three
// unseen complete provider APIs (Cloudflare, PagerDuty, Sentry).
//
// Specs are already on disk, gzipped, at
// data/exam-2026-09-22/specs/<provider>.json.gz (downloaded and hashed
// separately) — this script only extracts, it never fetches. The
// spec_file column in ops.csv still names the underlying spec
// (<provider>.json, ungzipped) since that identifies the API the rows
// came from, not the file this script reads off disk. Mirrors the
// conventions of tools/build-exam.js (the
// data/exam-2026-09-17 builder): same ops.csv header (plus a leading
// row_id column, documented in README.md) and same cell spellings. A
// fresh script rather than an edit of that one, since these three specs
// are already local JSON with no $ref'd path-items to resolve and no
// YAML to parse.
//
// Usage: node data/exam-2026-09-22/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { toCsv } from '../../tools/csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = __dirname;
const SPECS_DIR = path.join(DATA_DIR, 'specs');
const CSV_PATH = path.join(DATA_DIR, 'ops.csv');
const GZ_PATH = path.join(DATA_DIR, 'ops.csv.gz');

// Real HTTP methods only — parameters/servers/summary/description at
// path-item level are not operations. Only the five reported methods are
// emitted; any other method present would be silently dropped, so its
// presence is checked and reported explicitly below.
const METHODS = ['get', 'post', 'put', 'delete', 'patch'];
const REPORT_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const ALL_OPENAPI_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

const HEADER = [
  'row_id', 'provider', 'spec_file', 'path', 'method', 'operationId', 'summary',
  'description', 'has_summary', 'has_description', 'has_operationId', 'deprecated',
];

const PROVIDERS = [
  {
    key: 'cloudflare',
    specFile: 'cloudflare.json',
    expected: { total: 3575, GET: 1758, POST: 750, PUT: 350, DELETE: 450, PATCH: 267 },
  },
  {
    key: 'pagerduty',
    specFile: 'pagerduty.json',
    expected: { total: 465, GET: 211, POST: 105, PUT: 77, DELETE: 71, PATCH: 1 },
  },
  {
    key: 'sentry',
    specFile: 'sentry.json',
    expected: { total: 239, GET: 130, POST: 37, PUT: 33, DELETE: 37, PATCH: 2 },
  },
];

const str = (v) => (v == null ? '' : String(v).trim());

function extractInline(doc, provider, specFile, rows, methodCounts, extraMethods, seenKeys) {
  const paths = doc?.paths;
  if (!paths || typeof paths !== 'object') return;
  for (const [p, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    // Note any operation present under a method outside the five reported
    // ones, so it isn't silently dropped without comment.
    for (const m of ALL_OPENAPI_METHODS) {
      if (!METHODS.includes(m) && pathItem[m] && typeof pathItem[m] === 'object') {
        extraMethods.add(m.toUpperCase());
      }
    }

    for (const method of METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;
      const M = method.toUpperCase();

      const dupKey = `${p}\u0000${M}`;
      if (seenKeys.has(dupKey)) {
        throw new Error(`duplicate (path, method) within ${provider}: ${M} ${p}`);
      }
      seenKeys.add(dupKey);

      const summary = str(op.summary);
      const description = str(op.description);
      const operationId = str(op.operationId);
      if (!operationId) {
        throw new Error(`missing operationId: ${provider} ${M} ${p}`);
      }
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

function main() {
  const rows = [];
  const perProvider = new Map();
  const extraMethods = new Set();

  for (const p of PROVIDERS) {
    const specGzPath = path.join(SPECS_DIR, `${p.specFile}.gz`);
    if (!fs.existsSync(specGzPath)) {
      throw new Error(`spec not found: ${specGzPath} (expected to already be on disk)`);
    }
    const text = zlib.gunzipSync(fs.readFileSync(specGzPath)).toString('utf8');
    const doc = JSON.parse(text);
    const version = doc.openapi ? `OpenAPI ${doc.openapi}` : doc.swagger ? `Swagger ${doc.swagger}` : 'unknown';
    console.log(`${p.key}: read ${p.specFile}.gz, spec version ${version}`);

    const methodCounts = {};
    const before = rows.length;
    const seenKeys = new Set();
    extractInline(doc, p.key, p.specFile, rows, methodCounts, extraMethods, seenKeys);
    perProvider.set(p.key, { total: rows.length - before, methodCounts });
  }

  // Assign stable row_ids in emission order, prefix x22-, zero-padded to
  // 4 digits.
  rows.forEach((row, i) => {
    row.row_id = `x22-${String(i + 1).padStart(4, '0')}`;
  });

  const csvText = toCsv(rows, HEADER);
  fs.writeFileSync(CSV_PATH, csvText);
  fs.writeFileSync(GZ_PATH, zlib.gzipSync(Buffer.from(csvText, 'utf8')));
  console.log(`Wrote ${CSV_PATH} and ${GZ_PATH} (${rows.length} rows)`);

  console.log('--- verification: actual/expected ---');
  const w = 14;
  console.log(['provider', 'total', ...REPORT_METHODS].map((c) => c.padEnd(w)).join(''));

  let anyMismatch = false;
  let expectedTotal = 0;
  for (const p of PROVIDERS) {
    expectedTotal += p.expected.total;
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

  if (rows.length !== expectedTotal) {
    anyMismatch = true;
    console.log(`TOTAL MISMATCH: extracted ${rows.length} rows, expected ${expectedTotal}`);
  } else {
    console.log(`Grand total: ${rows.length}/${expectedTotal}`);
  }

  if (extraMethods.size > 0) {
    anyMismatch = true;
    console.log(`UNEXPECTED METHODS present (outside GET/POST/PUT/DELETE/PATCH): ${[...extraMethods].sort().join(', ')}`);
  }

  // Every row has an operationId (enforced above at extraction time, but
  // re-checked here against the assembled rows too).
  const missingOpId = rows.filter((r) => !r.operationId);
  if (missingOpId.length > 0) {
    anyMismatch = true;
    console.log(`MISSING operationId on ${missingOpId.length} rows`);
  }

  if (anyMismatch) {
    console.log('MISMATCH: extracted counts do not match the scouted expectations exactly (see * above).');
    process.exit(1);
  }
  console.log(`All ${PROVIDERS.length} providers match expected counts exactly (${rows.length} rows total).`);
}

main();
