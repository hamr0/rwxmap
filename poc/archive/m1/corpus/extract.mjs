#!/usr/bin/env node
// M1-C3: walk every fetched spec (Swagger 2 / OpenAPI 3) in CORPUS_DIR/specs/
// and emit one row per operation to CORPUS_DIR/ops.csv. Excludes hold-out
// vendor providers so they never leak into the corpus leans (see
// docs/product/prd.md PRD §8, D7). Vanilla Node, zero deps.
//
// Usage: node extract.mjs

import fs from 'node:fs';
import path from 'node:path';
import { toCsv } from '../../m0/csv.mjs';

const CORPUS_DIR = process.env.CORPUS_DIR
  || '/tmp/claude-1000/-home-hamr-PycharmProjects-rwxmap/5e1207e7-5a40-4424-afe1-4b1a53e86dc5/scratchpad/corpus/';
const SPECS_DIR = path.join(CORPUS_DIR, 'specs');
const OUT_PATH = path.join(CORPUS_DIR, 'ops.csv');

// Hold-out vendors: exact provider-string match (key before first ':'),
// never substring — apis.guru uses distinct provider strings for
// subdomains (e.g. "graph.microsoft.com" vs "github.com" are different
// keys), so exact equality is the correct and simplest exclusion rule.
const EXCLUDED_PROVIDERS = new Set([
  'twilio.com', 'stripe.com', 'github.com', 'box.com', 'pagerduty.com', 'adyen.com',
]);

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

function fileToKey(fileName) {
  return fileName.replace(/\.json$/, '').replace(/__/g, ':');
}

function truncateSummary(summary) {
  if (!summary) return '';
  const oneLine = String(summary).replace(/[\r\n]+/g, ' ');
  return oneLine.slice(0, 120);
}

function main() {
  const files = fs.readdirSync(SPECS_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Found ${files.length} spec files`);

  let parseFailures = 0;
  let excludedApis = 0;
  let excludedOps = 0;
  let includedApis = 0;
  const rows = [];

  for (const file of files) {
    const key = fileToKey(file);
    const provider = key.split(':')[0];

    let doc;
    try {
      const raw = fs.readFileSync(path.join(SPECS_DIR, file), 'utf8');
      doc = JSON.parse(raw);
    } catch {
      parseFailures++;
      continue;
    }

    const paths = doc.paths;
    if (!paths || typeof paths !== 'object') continue;

    let opsForThisApi = 0;
    for (const [p, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;
      for (const method of METHODS) {
        if (method === 'trace') continue; // out of scope per brief
        const op = pathItem[method];
        if (!op || typeof op !== 'object') continue;
        opsForThisApi++;
        if (EXCLUDED_PROVIDERS.has(provider)) continue;
        rows.push({
          provider,
          key,
          method: method.toUpperCase(),
          path: p,
          operationId: op.operationId ? String(op.operationId) : '',
          summary: truncateSummary(op.summary),
        });
      }
    }

    if (EXCLUDED_PROVIDERS.has(provider)) {
      excludedApis++;
      excludedOps += opsForThisApi;
    } else {
      includedApis++;
    }
  }

  fs.mkdirSync(CORPUS_DIR, { recursive: true });
  const header = ['provider', 'key', 'method', 'path', 'operationId', 'summary'];
  fs.writeFileSync(OUT_PATH, toCsv(rows, header));

  console.log(`Parse failures: ${parseFailures}`);
  console.log(`Included APIs: ${includedApis}, ops: ${rows.length}`);
  console.log(`Excluded (hold-out vendors) APIs: ${excludedApis}, ops: ${excludedOps}`);
  console.log(`Total (pre-exclusion) APIs: ${includedApis + excludedApis}, ops: ${rows.length + excludedOps}`);
  console.log('Wrote', OUT_PATH);
}

main();
