#!/usr/bin/env node
// M1-C8 step 1: text extraction — summary + description for all 719
// labelled operations, for use as the prose layer (D30: prose last,
// raise-only). Vanilla Node, zero deps.
//
// CAMARA: operations.csv carries no text; resolve op.summary/op.description
// from the YAML spec the same way poc/m1/census/run.mjs resolves every
// other CAMARA field (yaml-mini.mjs's parseYaml + lib.mjs's methodOp).
//
// Hold-out 1 / hold-out 2: their operations.csv already carries the exact
// summary/description columns extracted from the source JSON spec at
// hold-out-creation time (spot-checked against box.json's /ai/ask POST
// directly — identical text, modulo the newline collapsing done here) —
// reading them from operations.csv gives the same result as re-parsing the
// hold-out JSON spec, with no extra fetch/parse machinery and no dependency
// on where this session's copy of the hold-out spec JSONs lives, so that is
// what this does; the hold-out spec JSON files are not read here at all.
// No leakage: the blind readers who set ground truth for both hold-out sets
// were given only repo/path/method/operationId (see their READMEs) — the
// text columns existed in operations.csv but were withheld from them, so
// this is the first place summary/description are used as a signal.
//
// Usage: node extract-text.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../census/yaml-mini.mjs';
import { methodOp } from '../census/lib.mjs';
import { parseCsv, toCsv } from '../../m0/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CAMARA_ROOT = path.join(REPO_ROOT, 'data/camara-2026-09-01');
const HOLDOUT1_ROOT = path.join(REPO_ROOT, 'data/holdout-2026-09-07');
const HOLDOUT2_ROOT = path.join(REPO_ROOT, 'data/holdout2-2026-09-07');
const OUT_PATH = path.join(REPO_ROOT, 'docs/logs/m1/ops-text.csv');

function readText(p) { return fs.readFileSync(p, 'utf8'); }

// Collapse all whitespace runs (including embedded newlines) to a single
// space and trim.
function collapse(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function first600(s) {
  return collapse(s).slice(0, 600);
}

// --- CAMARA: resolve summary/description from the YAML spec ---------------
function loadCamaraText() {
  const opsRows = parseCsv(readText(path.join(CAMARA_ROOT, 'operations.csv')));
  const specCache = new Map();
  const out = [];
  const unresolved = [];
  for (const r of opsRows) {
    const specPath = path.join(CAMARA_ROOT, 'specs', r.repo, r.file);
    let doc = specCache.get(specPath);
    if (!doc) {
      doc = parseYaml(readText(specPath));
      specCache.set(specPath, doc);
    }
    const op = methodOp(doc, r.path, r.method);
    if (!op) unresolved.push(`${r.repo} ${r.method} ${r.path} ${r.operationId}`);
    out.push({
      set: 'camara',
      repo: r.repo,
      path: r.path,
      method: r.method,
      operationId: r.operationId,
      summary: op ? collapse(op.summary) : '',
      description: op ? first600(op.description) : '',
    });
  }
  if (unresolved.length) {
    console.error('CAMARA operations that failed to resolve in their spec:');
    for (const u of unresolved) console.error('  ' + u);
  }
  return out;
}

// --- hold-out sets: text already sits in operations.csv --------------------
function loadHoldoutText(setName, root) {
  const opsRows = parseCsv(readText(path.join(root, 'operations.csv')));
  return opsRows.map((r) => ({
    set: setName,
    repo: r.repo,
    path: r.path,
    method: r.method,
    operationId: r.operationId,
    summary: collapse(r.summary),
    description: first600(r.description),
  }));
}

function main() {
  const rows = [
    ...loadCamaraText(),
    ...loadHoldoutText('holdout1', HOLDOUT1_ROOT),
    ...loadHoldoutText('holdout2', HOLDOUT2_ROOT),
  ];

  const header = ['set', 'repo', 'path', 'method', 'operationId', 'summary', 'description'];
  fs.writeFileSync(OUT_PATH, toCsv(rows, header));

  function coverage(rowSet, label) {
    const n = rowSet.length;
    const hasSummary = rowSet.filter((r) => r.summary !== '').length;
    const hasDescription = rowSet.filter((r) => r.description !== '').length;
    const neither = rowSet.filter((r) => r.summary === '' && r.description === '').length;
    console.log(`${label} (n=${n}): summary ${hasSummary}, description ${hasDescription}, neither ${neither}`);
  }

  console.log(`Wrote ${OUT_PATH} (${rows.length} rows)`);
  coverage(rows, 'ALL');
  for (const setName of ['camara', 'holdout1', 'holdout2']) {
    coverage(rows.filter((r) => r.set === setName), setName);
  }
}

main();
