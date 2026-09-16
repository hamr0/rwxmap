#!/usr/bin/env node
// Build a FOURTH hold-out set of API operations from three public OpenAPI 3
// JSON files that nobody in this project has labelled, for a later blind
// reading. Modelled directly on holdout3-extract.mjs: GET is included,
// same output columns, same candidate ordering (all path × method sorted
// by path then method), same index % N selection. See
// docs/product/prd.md for context.
//
// Usage: node poc/m0/holdout4-extract.mjs <sourceDir> <outDir>

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { methodDefault } from './rules.mjs';
import { toCsv } from './csv.mjs';

const REPOS = {
  linode: {
    file: 'linode.json',
    url: 'https://raw.githubusercontent.com/linode/linode-api-docs/development/openapi.json',
  },
  cloudflare: {
    file: 'cloudflare.json',
    url: 'https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json',
  },
  x: {
    file: 'x.json',
    url: 'https://api.twitter.com/2/openapi.json',
  },
};

// Selection rule, verbatim: N chosen per vendor so each vendor yields
// roughly 60-80 rows: N = round(candidates / 70), minimum 1. Candidates
// were counted as 449 (linode), 3451 (cloudflare), 190 (x), giving
// linode N=6, cloudflare N=49, x N=3. Index from 0 over the candidate
// list (sorted by path then method), select where index % N === 0.
const SELECT_N = { linode: 6, cloudflare: 49, x: 3 };

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const HEADER = [
  'repo', 'source_url', 'sha256', 'path', 'method', 'operationId',
  'summary', 'description', 'has_callbacks', 'has_409', 'has_sink',
  'default_class',
];

function cleanDescription(s) {
  if (!s) return '';
  let out = s.replace(/<[^>]+>/g, ' ');
  out = out.replace(/\s+/g, ' ').trim();
  if (out.length > 700) out = out.slice(0, 699) + '…';
  return out;
}

function resolveRef(doc, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/');
  let node = doc;
  for (const p of parts) {
    if (node == null) return undefined;
    node = node[p.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return node;
}

function hasSink(doc, op) {
  let reqBody = op.requestBody;
  if (!reqBody) return false;
  if (reqBody.$ref) reqBody = resolveRef(doc, reqBody.$ref);
  if (!reqBody) return false;
  let schema = reqBody.content?.['application/json']?.schema;
  if (!schema) return false;
  if (schema.$ref) schema = resolveRef(doc, schema.$ref);
  if (!schema) return false;
  return Object.prototype.hasOwnProperty.call(schema.properties ?? {}, 'sink');
}

// Collect { path, method (lowercase), op } for every real operation object.
// A path item that is itself $ref-only (no inline method objects) yields
// no candidates and is silently skipped, per the brief.
function collectOps(doc) {
  const ops = [];
  const paths = doc.paths ?? {};
  for (const p of Object.keys(paths)) {
    const pathItem = paths[p];
    if (!pathItem || typeof pathItem !== 'object') continue;
    if (pathItem.$ref) continue; // $ref-only path item: skip
    for (const m of METHODS) {
      if (Object.prototype.hasOwnProperty.call(pathItem, m)) {
        const op = pathItem[m];
        if (!op || typeof op !== 'object') continue; // no operation object
        ops.push({ path: p, method: m, op });
      }
    }
  }
  return ops;
}

function buildRow(repoName, repoInfo, sha256, doc, path_, method, op) {
  return {
    repo: repoName,
    source_url: repoInfo.url,
    sha256,
    path: path_,
    method: method.toUpperCase(),
    operationId: op.operationId ?? '',
    summary: op.summary ?? '',
    description: cleanDescription(op.description ?? ''),
    has_callbacks: Object.prototype.hasOwnProperty.call(op, 'callbacks') && !!op.callbacks,
    has_409: Object.prototype.hasOwnProperty.call(op.responses ?? {}, '409'),
    has_sink: hasSink(doc, op),
    default_class: methodDefault(method),
  };
}

function main() {
  const [, , sourceDir, outDir] = process.argv;
  if (!sourceDir || !outDir) {
    console.error('Usage: node poc/m0/holdout4-extract.mjs <sourceDir> <outDir>');
    process.exit(1);
  }

  const rows = [];
  const shas = {};
  const counts = {};

  for (const repoName of Object.keys(REPOS)) {
    const info = REPOS[repoName];
    const raw = fs.readFileSync(path.join(sourceDir, info.file), 'utf8');
    const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
    shas[repoName] = sha256;
    const doc = JSON.parse(raw);
    const allOps = collectOps(doc);

    const candidates = allOps.slice().sort((a, b) => {
      if (a.path !== b.path) return a.path < b.path ? -1 : 1;
      return a.method < b.method ? -1 : a.method > b.method ? 1 : 0;
    });
    const n = SELECT_N[repoName];
    const selected = candidates.filter((_, idx) => idx % n === 0);

    counts[repoName] = selected.length;
    for (const { path: p, method, op } of selected) {
      rows.push(buildRow(repoName, info, sha256, doc, p, method, op));
    }
  }

  fs.mkdirSync(outDir, { recursive: true });

  const csv = toCsv(rows, HEADER);
  fs.writeFileSync(path.join(outDir, 'operations.csv'), csv);

  const total = rows.length;
  const noSummaryNoDesc = rows.filter((r) => r.summary === '' && r.description === '').length;
  const noSummaryNoDescByRepo = {};
  for (const repoName of Object.keys(REPOS)) {
    noSummaryNoDescByRepo[repoName] = rows.filter(
      (r) => r.repo === repoName && r.summary === '' && r.description === ''
    ).length;
  }

  const methodCounts = {};
  for (const r of rows) methodCounts[r.method] = (methodCounts[r.method] ?? 0) + 1;
  const methodLines = Object.keys(methodCounts).sort()
    .map((m) => `- ${m}: ${methodCounts[m]}`).join('\n');

  const readme = `# Hold-out set 4 — 2026-09-08

Three public OpenAPI 3 JSON files, none of them read or labelled by anyone
on this project before this extraction.

## Sources

- linode: ${REPOS.linode.url}
- cloudflare: ${REPOS.cloudflare.url}
- x: ${REPOS.x.url}

## SHA-256 (whole raw source file)

- linode: ${shas.linode}
- cloudflare: ${shas.cloudflare}
- x: ${shas.x}

## Selection rule

N per vendor chosen so each vendor yields roughly 60-80 rows:
N = round(candidates / 70), minimum 1. linode — every 6th candidate
(449 candidates); cloudflare — every 49th candidate (3451 candidates); x —
every 3rd candidate (190 candidates). Index from 0 and select where
\`index % N === 0\`. Candidates are all path × method (get/post/put/patch/
delete) pairs, sorted by path (string sort) then method (string sort) for
determinism. A path item that is $ref-only, or a method entry that is not
an operation object, is skipped and not counted as a candidate.

## Row counts

### Per repo

- linode: ${counts.linode}
- cloudflare: ${counts.cloudflare}
- x: ${counts.x}
- total: ${total}

### Per method

${methodLines}

No one in this project had read or labelled these operations before
extraction. Like data/holdout2-2026-09-07/ and data/holdout3-2026-09-08/,
this set includes GET operations, so it can measure correct lowerings and
the usefulness half of the gate.

## Ground truth (pending)
`;
  fs.writeFileSync(path.join(outDir, 'README.md'), readme);

  console.log(`linode: ${counts.linode} rows`);
  console.log(`cloudflare: ${counts.cloudflare} rows`);
  console.log(`x: ${counts.x} rows`);
  console.log(`total: ${total} rows`);
  for (const m of Object.keys(methodCounts).sort()) {
    console.log(`method ${m}: ${methodCounts[m]} rows`);
  }
  console.log(`rows with no summary and no description: ${noSummaryNoDesc}`);
  for (const repoName of Object.keys(REPOS)) {
    console.log(`  ${repoName}: ${noSummaryNoDescByRepo[repoName]}`);
  }
}

main();
