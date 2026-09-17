#!/usr/bin/env node
// Build a hold-out set of API operations from three public OpenAPI 3 JSON
// files that nobody in this project has labelled, for a later blind
// reading to produce ground truth. See docs/product/prd.md for context.
//
// Usage: node poc/m0/holdout-extract.mjs <corporaDir> <outDir>

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { methodDefault } from './rules.mjs';
import { toCsv } from './csv.mjs';

const REPOS = {
  twilio: {
    file: 'twilio.json',
    url: 'https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json',
  },
  stripe: {
    file: 'stripe.json',
    url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
  },
  github: {
    file: 'github.json',
    url: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json',
  },
};

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

function collectOps(doc) {
  // { path, method (lowercase), op }
  const ops = [];
  const paths = doc.paths ?? {};
  for (const p of Object.keys(paths)) {
    const pathItem = paths[p];
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const m of METHODS) {
      if (Object.prototype.hasOwnProperty.call(pathItem, m)) {
        ops.push({ path: p, method: m, op: pathItem[m] });
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
  const [, , corporaDir, outDir] = process.argv;
  if (!corporaDir || !outDir) {
    console.error('Usage: node poc/m0/holdout-extract.mjs <corporaDir> <outDir>');
    process.exit(1);
  }

  const rows = [];
  const shas = {};
  const counts = {};

  for (const repoName of Object.keys(REPOS)) {
    const info = REPOS[repoName];
    const raw = fs.readFileSync(path.join(corporaDir, info.file), 'utf8');
    const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
    shas[repoName] = sha256;
    const doc = JSON.parse(raw);
    const allOps = collectOps(doc);

    let selected = [];
    if (repoName === 'twilio') {
      selected = allOps.filter((o) => o.method === 'delete' || o.method === 'post');
    } else if (repoName === 'stripe') {
      selected = allOps.filter((o) => o.method === 'delete');
    } else if (repoName === 'github') {
      const candidates = allOps
        .filter((o) => o.method === 'delete' || o.method === 'put')
        .sort((a, b) => {
          if (a.path !== b.path) return a.path < b.path ? -1 : 1;
          return a.method < b.method ? -1 : a.method > b.method ? 1 : 0;
        });
      selected = candidates.filter((_, idx) => idx % 4 === 0);
    }

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

  const readme = `# Hold-out set — ${'2026-09-07'}

Three public OpenAPI 3 JSON files, none of them read or labelled by anyone
on this project before this extraction.

## Sources

- twilio: ${REPOS.twilio.url}
- stripe: ${REPOS.stripe.url}
- github: ${REPOS.github.url}

## SHA-256 (whole raw source file)

- twilio: ${shas.twilio}
- stripe: ${shas.stripe}
- github: ${shas.github}

## Selection rule

- twilio: select every op whose method is DELETE or POST.
- stripe: select every op whose method is DELETE.
- github: first collect every op whose method is DELETE or PUT, sorted by
  path (string sort) then method (string sort, so DELETE before PUT
  alphabetically — the secondary order doesn't matter, it only needs to be
  deterministic and reproducible). Assign each a 0-based index in that
  sorted order. Select the op if \`index % 4 === 0\` (i.e., every 4th one:
  indices 0, 4, 8, ...).

## Row counts

- twilio: ${counts.twilio}
- stripe: ${counts.stripe}
- github: ${counts.github}
- total: ${total}

No one in this project had read or labelled these operations before extraction; they exist to give the lexicon arbiter an untainted score.
`;
  fs.writeFileSync(path.join(outDir, 'README.md'), readme);

  console.log(`twilio: ${counts.twilio} rows`);
  console.log(`stripe: ${counts.stripe} rows`);
  console.log(`github: ${counts.github} rows`);
  console.log(`total: ${total} rows`);
  console.log(`rows with no summary and no description: ${noSummaryNoDesc}`);
}

main();
