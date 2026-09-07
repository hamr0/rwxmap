#!/usr/bin/env node
// CLI: node poc/m0/learn-vn.mjs <out.json>
// Learns E8's verb+noun model from the BUILD half only, scored against
// hand-read ground truth. TEST-half wording never enters this file — see
// split.mjs. Thresholds are read from env: VERB_MIN, VERB_P, NOUN_MIN,
// NOUN_P.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from './csv.mjs';
import { loadOps } from './spec-text.mjs';
import { halfOf } from './split.mjs';
import { leadVerb, objectNouns } from './rules-vn.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GROUND_TRUTH_CSV = path.join(HERE, '..', '..', 'data', 'camara-2026-09-01', 'ground-truth.csv');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

export const VERB_MIN = Number(process.env.VERB_MIN ?? 2);
export const VERB_P = Number(process.env.VERB_P ?? 0.8);
export const NOUN_MIN = Number(process.env.NOUN_MIN ?? 2);
export const NOUN_P = Number(process.env.NOUN_P ?? 0.5);

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
 * Learn the verbMap and liveNouns tables from the BUILD half.
 * @param {{verbMin?:number, verbP?:number, nounMin?:number, nounP?:number}} [params]
 */
export function learn(params = {}) {
  const verbMin = params.verbMin ?? VERB_MIN;
  const verbP = params.verbP ?? VERB_P;
  const nounMin = params.nounMin ?? NOUN_MIN;
  const nounP = params.nounP ?? NOUN_P;

  const ops = loadOps();
  const gtByKey = loadGroundTruthByKey();

  const verbCounts = new Map(); // verb -> {r,w,x}
  const nounCounts = new Map(); // noun -> {x, notX}

  let buildOps = 0;
  for (const op of ops) {
    if (halfOf(op.repo) !== 'build') continue;
    const gt = gtByKey.get(joinKey(op));
    if (!gt) continue;
    buildOps++;

    const v = leadVerb(op);
    if (v) {
      if (!verbCounts.has(v)) verbCounts.set(v, { r: 0, w: 0, x: 0 });
      verbCounts.get(v)[gt.gt_class]++;
    }

    const method = String(op.method ?? '').toUpperCase();
    if (!SAFE_METHODS.has(method)) {
      const nouns = objectNouns(op);
      for (const n of nouns) {
        if (!nounCounts.has(n)) nounCounts.set(n, { x: 0, notX: 0 });
        const c = nounCounts.get(n);
        if (gt.gt_class === 'x') c.x++;
        else c.notX++;
      }
    }
  }

  const verbMap = {};
  for (const [verb, c] of verbCounts) {
    const support = c.r + c.w + c.x;
    if (support < verbMin) continue;
    const majorityClass = ['r', 'w', 'x'].reduce((best, cls) => (c[cls] > c[best] ? cls : best), 'r');
    const share = c[majorityClass] / support;
    if (share >= verbP) {
      verbMap[verb] = { class: majorityClass, r: c.r, w: c.w, x: c.x };
    }
  }

  const liveNouns = [];
  for (const [noun, c] of nounCounts) {
    const support = c.x + c.notX;
    if (support < nounMin) continue;
    const share = c.x / support;
    if (share >= nounP) liveNouns.push({ noun, nX: c.x, support });
  }
  liveNouns.sort((a, b) => b.support - a.support);

  return {
    params: { verbMin, verbP, nounMin, nounP },
    verbMap,
    liveNouns,
    stats: { buildOps, distinctVerbs: verbCounts.size, distinctNouns: nounCounts.size },
  };
}

function main(argv) {
  const [outPath] = argv;
  if (!outPath) {
    console.error('usage: node poc/m0/learn-vn.mjs <out.json>');
    return 1;
  }
  const model = learn();
  writeFileSync(outPath, JSON.stringify(model, null, 2) + '\n', 'utf8');
  console.log(`params: ${JSON.stringify(model.params)}`);
  console.log(`build ops scored: ${model.stats.buildOps}`);
  console.log(`verbMap entries: ${Object.keys(model.verbMap).length}, liveNouns entries: ${model.liveNouns.length}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
