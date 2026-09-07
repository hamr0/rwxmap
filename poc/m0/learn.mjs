#!/usr/bin/env node
// CLI: node poc/m0/learn.mjs <out.json>
// Derives the harm/read word lists for the E7 text arbiter (PRD §4.5) from
// the BUILD half only, scored against hand-read ground truth. TEST-half
// wording never enters this file — see split.mjs.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from './csv.mjs';
import { loadOps } from './spec-text.mjs';
import { halfOf } from './split.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GROUND_TRUTH_CSV = path.join(HERE, '..', '..', 'data', 'camara-2026-09-01', 'ground-truth.csv');

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'api', 'request', 'response',
  'will', 'are', 'its', 'has', 'have', 'been', 'from', 'was', 'not', 'all',
  'any', 'can', 'may', 'must', 'shall', 'should', 'provided', 'given',
  'using', 'use', 'used', 'when', 'which', 'into', 'than', 'then', 'there',
  'their', 'they', 'only', 'also', 'more', 'one', 'two', 'per', 'via', 'see',
  'e.g.', 'i.e.', 'etc', 'information', 'operation', 'endpoint', 'service',
  'data', 'user', 'device', 'network',
]);

export const MIN_SUPPORT = Number(process.env.MIN_SUPPORT ?? 4);
export const HARM_P = Number(process.env.HARM_P ?? 0.85);
export const READ_P = Number(process.env.READ_P ?? 0.85);

/**
 * Tokenize summary+description the same way for learning and for the
 * arbiter: lowercase, split on non-letters, keep tokens of length >= 3,
 * drop stopwords, dedupe per operation (presence, not frequency).
 * @param {string} summary
 * @param {string} description
 * @returns {Set<string>}
 */
export function tokenize(summary, description) {
  const text = `${summary ?? ''} ${description ?? ''}`.toLowerCase();
  const words = text.split(/[^a-z]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(words);
}

function joinKey(row) {
  return [row.repo, row.path, row.method, row.operationId].join('');
}

function loadGroundTruthByKey() {
  const rows = parseCsv(readFileSync(GROUND_TRUTH_CSV, 'utf8'));
  const byKey = new Map();
  for (const row of rows) byKey.set(joinKey(row), row);
  return byKey;
}

/**
 * Learn harm/read token lists from the BUILD half of operations, scored
 * against ground truth.
 * @param {{minSupport?: number, harmP?: number, readP?: number}} [params]
 */
export function learn(params = {}) {
  const minSupport = params.minSupport ?? MIN_SUPPORT;
  const harmP = params.harmP ?? HARM_P;
  const readP = params.readP ?? READ_P;

  const ops = loadOps();
  const gtByKey = loadGroundTruthByKey();

  const counts = new Map(); // token -> {nR, nW, nX}
  let buildOps = 0;
  for (const op of ops) {
    if (halfOf(op.repo) !== 'build') continue;
    const gt = gtByKey.get(joinKey(op));
    if (!gt) continue;
    buildOps++;
    const tokens = tokenize(op.summary, op.description);
    for (const token of tokens) {
      if (!counts.has(token)) counts.set(token, { nR: 0, nW: 0, nX: 0 });
      const c = counts.get(token);
      c[`n${gt.gt_class.toUpperCase()}`]++;
    }
  }

  const entries = [];
  for (const [token, c] of counts) {
    const support = c.nR + c.nW + c.nX;
    entries.push({ token, nX: c.nX, nR: c.nR, nW: c.nW, support });
  }

  const harm = entries
    .filter((e) => e.support >= minSupport && e.nX / e.support >= harmP)
    .sort((a, b) => b.support - a.support);
  const read = entries
    .filter((e) => e.support >= minSupport && e.nR / e.support >= readP)
    .sort((a, b) => b.support - a.support);

  return {
    minSupport,
    harmP,
    readP,
    harm,
    read,
    stats: { buildOps, distinctTokens: counts.size },
  };
}

function main(argv) {
  const [outPath] = argv;
  if (!outPath) {
    console.error('usage: node poc/m0/learn.mjs <out.json>');
    return 1;
  }
  const model = learn();
  writeFileSync(outPath, JSON.stringify(model, null, 2) + '\n', 'utf8');
  console.log(`minSupport=${model.minSupport} harmP=${model.harmP} readP=${model.readP}`);
  console.log(`build ops scored: ${model.stats.buildOps}, distinct tokens: ${model.stats.distinctTokens}`);
  console.log(`harm tokens: ${model.harm.length}, read tokens: ${model.read.length}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
