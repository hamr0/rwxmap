#!/usr/bin/env node
// CLI: node poc/m0/run-vn.mjs <model.json> <out-prefix>
// Runs arbiterVN (E8, verb+noun) over all 292 operations using a
// pre-learned model, and writes <prefix>-build.csv / <prefix>-test.csv in
// run.mjs's column format so diverge.mjs can consume them.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { toCsv } from './csv.mjs';
import { loadOps } from './spec-text.mjs';
import { halfOf } from './split.mjs';
import { arbiterVN } from './rules-vn.mjs';

const OUT_HEADER = [
  'repo', 'file', 'path', 'method', 'operationId',
  'class', 'confidence', 'rule_id', 'evidence',
];

function usage() {
  return 'usage: node poc/m0/run-vn.mjs <model.json> <out-prefix>';
}

/**
 * Score all 292 operations with arbiterVN against a given model, split
 * into build/test rows.
 * @param {object} model learn-vn.mjs's JSON shape
 * @returns {{build: Array<object>, test: Array<object>}}
 */
export function scoreAll(model) {
  const ops = loadOps();
  const build = [];
  const test = [];
  for (const op of ops) {
    const result = arbiterVN(op, model);
    const row = {
      repo: op.repo,
      file: op.file,
      path: op.path,
      method: op.method,
      operationId: op.operationId,
      class: result.class,
      confidence: result.confidence,
      rule_id: result.rule_id,
      evidence: result.evidence,
    };
    (halfOf(op.repo) === 'build' ? build : test).push(row);
  }
  return { build, test };
}

function main(argv) {
  const [modelPath, outPrefix] = argv;
  if (!modelPath || !outPrefix) {
    console.error(usage());
    return 1;
  }
  if (!existsSync(modelPath)) {
    console.error(`model file not found: ${modelPath}`);
    return 1;
  }
  const model = JSON.parse(readFileSync(modelPath, 'utf8'));
  const { build, test } = scoreAll(model);

  writeFileSync(`${outPrefix}-build.csv`, toCsv(build, OUT_HEADER), 'utf8');
  writeFileSync(`${outPrefix}-test.csv`, toCsv(test, OUT_HEADER), 'utf8');

  console.log(`build rows: ${build.length}, test rows: ${test.length}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
