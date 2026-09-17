#!/usr/bin/env node
// Walks every fetched spec in data/provider-corpus-2026-09-16/specs/ (see
// fetch.mjs) and writes one row per operation to
// data/provider-corpus-2026-09-16/ops.csv (then gzips it to ops.csv.gz;
// only the .gz is tracked — mirrors data/corpus/apis-guru-ops.csv.gz).
//
// Handles both OpenAPI 3.x and Swagger 2.0. For DigitalOcean
// (externalRefs: true), each path-item method is itself a $ref to an
// external file that carries the real operationId/summary/description —
// this script resolves those from the locally fetched copy (see fetch.mjs,
// which fetched exactly these files).
//
// Every spec is stored gzipped in place as `<original-name>.gz` (see
// fetch.mjs); this script reads and gunzips each one before parsing.
//
// VERIFICATION (the point of this script): after extraction, per-provider
// totals and per-method counts are compared against providers.json's
// `expected`. Exit code 1 if any provider mismatches, 0 only if all 15
// match exactly.
//
// Usage: node extract.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parse as parseYaml } from 'yaml';
import { toCsv } from '../m0/csv.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const PROVIDERS_PATH = path.join(import.meta.dirname, 'providers.json');
const DATA_DIR = path.join(REPO_ROOT, 'data/provider-corpus-2026-09-16');
const SPECS_DIR = path.join(DATA_DIR, 'specs');
const CSV_PATH = path.join(DATA_DIR, 'ops.csv');
const GZ_PATH = path.join(DATA_DIR, 'ops.csv.gz');

// Real HTTP methods only — parameters/servers/summary/description/$ref at
// path-item level are not operations.
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const EXPECTED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const HEADER = [
  'provider', 'spec_file', 'path', 'method', 'operationId', 'summary',
  'description', 'has_summary', 'has_description', 'has_operationId', 'deprecated',
];

function urlFileName(url) {
  return decodeURIComponent(new URL(url).pathname.split('/').pop());
}

function parseDoc(format, text) {
  return format === 'yaml' ? parseYaml(text) : JSON.parse(text);
}

// Reads and gunzips the original file stored at `<originalPath>.gz`.
function readOriginal(originalPath) {
  return zlib.gunzipSync(fs.readFileSync(originalPath + '.gz')).toString('utf8');
}

function originalExists(originalPath) {
  return fs.existsSync(originalPath + '.gz');
}

function str(v) {
  return v == null ? '' : String(v).trim();
}

function pushRow(rows, methodCounts, provider, specFile, p, method, op) {
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
  const M = method.toUpperCase();
  methodCounts[M] = (methodCounts[M] || 0) + 1;
}

// Extracts every inline operation from a fully-resolved doc's `paths`.
function extractInline(doc, provider, specFile, rows, methodCounts) {
  const paths = doc?.paths;
  if (!paths || typeof paths !== 'object') return;
  for (const [p, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;
      pushRow(rows, methodCounts, provider, specFile, p, method, op);
    }
  }
}

// DigitalOcean: each path-item method is `{ $ref: "resources/.../x.yml" }`.
// Resolve that ref against the main file's directory on disk and read the
// operation object directly from the fetched copy (see fetch.mjs).
function extractExternalRefs(doc, mainFileDir, provider, rows, methodCounts, warnings) {
  const paths = doc?.paths;
  if (!paths || typeof paths !== 'object') return;
  for (const [p, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of METHODS) {
      const methodVal = pathItem[method];
      if (!methodVal || typeof methodVal !== 'object') continue;
      const ref = methodVal.$ref;
      if (typeof ref !== 'string') continue;
      const refPath = path.join(mainFileDir, ref);
      let op;
      try {
        op = parseYaml(readOriginal(refPath));
      } catch (err) {
        warnings.push(`${provider}: could not read/parse $ref ${ref} for ${method.toUpperCase()} ${p}: ${err}`);
        continue;
      }
      if (!op || typeof op !== 'object') continue;
      const specFile = path.relative(path.join(SPECS_DIR, provider), refPath);
      pushRow(rows, methodCounts, provider, specFile, p, method, op);
    }
  }
}

function main() {
  const providers = JSON.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'));
  const rows = [];
  const warnings = [];
  const perProvider = new Map(); // key -> { total, methodCounts }

  for (const p of providers) {
    const methodCounts = {};
    const beforeCount = rows.length;

    for (const url of p.urls) {
      const filePath = path.join(SPECS_DIR, p.key, urlFileName(url));
      if (!originalExists(filePath)) {
        warnings.push(`${p.key}: missing fetched file ${filePath}.gz (run fetch.mjs first)`);
        continue;
      }
      let doc;
      try {
        doc = parseDoc(p.format, readOriginal(filePath));
      } catch (err) {
        warnings.push(`${p.key}: could not parse ${filePath}: ${err}`);
        continue;
      }

      if (p.externalRefs) {
        extractExternalRefs(doc, path.dirname(filePath), p.key, rows, methodCounts, warnings);
      } else {
        const specFile = path.relative(path.join(SPECS_DIR, p.key), filePath);
        extractInline(doc, p.key, specFile, rows, methodCounts);
      }
    }

    perProvider.set(p.key, { total: rows.length - beforeCount, methodCounts });
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const csvText = toCsv(rows, HEADER);
  fs.writeFileSync(CSV_PATH, csvText);
  fs.writeFileSync(GZ_PATH, zlib.gzipSync(Buffer.from(csvText, 'utf8')));

  console.log(`Total rows extracted: ${rows.length}`);
  console.log(`Wrote ${CSV_PATH} and ${GZ_PATH}`);
  if (warnings.length > 0) {
    console.log('--- warnings ---');
    for (const w of warnings) console.log(`  ${w}`);
  }

  // Verification table.
  console.log('--- verification: expected vs actual ---');
  const colWidth = 14;
  const header = ['provider', 'total', ...EXPECTED_METHODS].map((c) => c.padEnd(colWidth)).join('');
  console.log(header);

  let anyMismatch = false;
  for (const p of providers) {
    const actual = perProvider.get(p.key) || { total: 0, methodCounts: {} };
    const expTotal = p.expected.total;
    const actTotal = actual.total;
    const totalOk = expTotal === actTotal;
    if (!totalOk) anyMismatch = true;

    const cells = [`${p.key}${totalOk ? '' : ' *'}`.padEnd(colWidth)];
    cells.push(`${actTotal}/${expTotal}`.padEnd(colWidth));
    for (const m of EXPECTED_METHODS) {
      const exp = p.expected[m];
      const act = actual.methodCounts[m] || 0;
      const ok = exp === act;
      if (!ok) anyMismatch = true;
      cells.push(`${act}/${exp}${ok ? '' : '*'}`.padEnd(colWidth));
    }
    console.log(cells.join(''));
  }

  if (anyMismatch) {
    console.log('MISMATCH: one or more providers did not match expected counts exactly (see * above).');
    process.exit(1);
  }
  console.log('All 15 providers match expected counts exactly.');
  process.exit(0);
}

main();
