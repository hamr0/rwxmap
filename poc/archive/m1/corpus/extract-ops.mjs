#!/usr/bin/env node
// Walks data/corpus/apis-guru-specs/ (Swagger 2 / OpenAPI 3, one file per
// API key — see fetch-corpus.mjs) and writes one row per operation to
// data/corpus/apis-guru-ops.csv.gz (gzipped; read with
// `zcat data/corpus/apis-guru-ops.csv.gz | head`).
//
// IMPORTANT: this file keeps EVERY provider, including hold-out vendors.
// The earlier extractor (poc/m1/corpus/extract.mjs) dropped hold-out
// vendors at extract time, which meant a later question about them could
// only be answered by re-downloading the whole corpus. Filtering for taint
// (excluding hold-out vendors from corpus leans, etc.) is an analysis-time
// decision made when reading this file, never a collection-time one.
//
// Usage: node extract-ops.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { toCsv } from '../../m0/csv.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const SPECS_DIR = path.join(REPO_ROOT, 'data/corpus/apis-guru-specs');
const OUT_PATH = path.join(REPO_ROOT, 'data/corpus/apis-guru-ops.csv.gz');

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

const HEADER = [
  'provider', 'api_key', 'spec_version', 'path', 'method', 'operationId',
  'summary', 'description', 'tags', 'has_request_body', 'response_codes',
  'security_scopes',
];

function fileToKey(fileName) {
  return fileName.replace(/\.json$/, '').replace(/__/g, ':');
}

function oneLine(text) {
  if (!text) return '';
  return String(text).replace(/[\r\n]+/g, ' ').trim();
}

function detectSpecVersion(doc) {
  if (doc.swagger && String(doc.swagger).startsWith('2')) return 'swagger2';
  if (doc.openapi && String(doc.openapi).startsWith('3')) return 'openapi3';
  // Fallback: guess from shape.
  if (doc.paths) return doc.openapi ? 'openapi3' : 'swagger2';
  return 'unknown';
}

function hasRequestBody(op, pathItem, specVersion) {
  if (specVersion === 'openapi3') {
    return !!op.requestBody;
  }
  // Swagger 2: look at operation-level params, falling back to
  // path-item-level shared params (both can carry body/formData params).
  const opParams = Array.isArray(op.parameters) ? op.parameters : [];
  const pathParams = Array.isArray(pathItem?.parameters) ? pathItem.parameters : [];
  const allParams = [...pathParams, ...opParams];
  return allParams.some((p) => p && (p.in === 'body' || p.in === 'formData'));
}

function responseCodes(op) {
  if (!op.responses || typeof op.responses !== 'object') return '';
  return Object.keys(op.responses).join('|');
}

function securityScopes(op) {
  if (!Array.isArray(op.security)) return '';
  const scopes = new Set();
  for (const req of op.security) {
    if (!req || typeof req !== 'object') continue;
    for (const scopeList of Object.values(req)) {
      if (Array.isArray(scopeList)) {
        for (const s of scopeList) scopes.add(String(s));
      }
    }
  }
  return [...scopes].join('|');
}

function main() {
  let files;
  try {
    files = fs.readdirSync(SPECS_DIR).filter((f) => f.endsWith('.json'));
  } catch (err) {
    console.error(`Could not read ${SPECS_DIR}: ${err}`);
    process.exit(1);
  }
  console.log(`Found ${files.length} spec files in ${SPECS_DIR}`);

  const rows = [];
  const providers = new Set();
  const apiKeys = new Set();
  const methodCounts = {};
  let parseFailures = 0;

  for (const file of files) {
    const key = fileToKey(file);
    const provider = key.split(':')[0];

    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(path.join(SPECS_DIR, file), 'utf8'));
    } catch {
      parseFailures++;
      continue;
    }

    const paths = doc.paths;
    if (!paths || typeof paths !== 'object') continue;

    const specVersion = detectSpecVersion(doc);
    let sawOp = false;

    for (const [p, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;
      for (const method of METHODS) {
        const op = pathItem[method];
        if (!op || typeof op !== 'object') continue;
        sawOp = true;

        rows.push({
          provider,
          api_key: key,
          spec_version: specVersion,
          path: p,
          method: method.toUpperCase(),
          operationId: op.operationId ? String(op.operationId) : '',
          summary: oneLine(op.summary),
          description: oneLine(op.description).slice(0, 500),
          tags: Array.isArray(op.tags) ? op.tags.join('|') : '',
          has_request_body: String(hasRequestBody(op, pathItem, specVersion)),
          response_codes: responseCodes(op),
          security_scopes: securityScopes(op),
        });

        methodCounts[method.toUpperCase()] = (methodCounts[method.toUpperCase()] || 0) + 1;
      }
    }

    if (sawOp) {
      providers.add(provider);
      apiKeys.add(key);
    }
  }

  rows.sort((a, b) => {
    if (a.api_key !== b.api_key) return a.api_key < b.api_key ? -1 : 1;
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    return a.method < b.method ? -1 : a.method > b.method ? 1 : 0;
  });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, zlib.gzipSync(Buffer.from(toCsv(rows, HEADER), 'utf8')));

  const outBytes = fs.statSync(OUT_PATH).size;

  console.log(`Parse failures: ${parseFailures}`);
  console.log(`Total operations: ${rows.length}`);
  console.log(`Distinct providers: ${providers.size}`);
  console.log(`Distinct api_keys: ${apiKeys.size}`);
  console.log('Per-method counts:');
  for (const m of METHODS.map((m) => m.toUpperCase())) {
    if (methodCounts[m]) console.log(`  ${m}: ${methodCounts[m]}`);
  }
  console.log(`Output file: ${OUT_PATH} (${outBytes} bytes gzipped)`);
}

main();
