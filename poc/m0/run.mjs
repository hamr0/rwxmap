#!/usr/bin/env node
// CLI: node poc/m0/run.mjs <experiment> <operations.csv> <out.csv>
// Applies one of rules.mjs's EXPERIMENTS to an operations CSV and writes
// a per-operation classification CSV. Prints class/confidence counts.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { parseCsv, toCsv } from './csv.mjs';
import { EXPERIMENTS } from './rules.mjs';

const OUT_HEADER = [
  'repo', 'file', 'path', 'method', 'operationId',
  'class', 'confidence', 'rule_id', 'evidence',
];

function usage() {
  return 'usage: node poc/m0/run.mjs <experiment> <operations.csv> <out.csv>';
}

function main(argv) {
  const [experimentName, inPath, outPath] = argv;

  if (!experimentName || !inPath || !outPath) {
    console.error(usage());
    return 1;
  }

  const experiment = EXPERIMENTS[experimentName];
  if (!experiment) {
    console.error(`unknown experiment: ${experimentName}`);
    console.error(`known experiments: ${Object.keys(EXPERIMENTS).join(', ')}`);
    return 1;
  }

  if (!existsSync(inPath)) {
    console.error(`input file not found: ${inPath}`);
    return 1;
  }

  const text = readFileSync(inPath, 'utf8');
  const rows = parseCsv(text);

  const outRows = [];
  const classCounts = { r: 0, w: 0, x: 0 };
  const confidenceCounts = {};

  for (const row of rows) {
    const op = {
      method: row.method,
      path: row.path,
      operationId: row.operationId,
    };
    const result = experiment.fn(op, experiment.ruleset);

    classCounts[result.class] = (classCounts[result.class] ?? 0) + 1;
    confidenceCounts[result.confidence] = (confidenceCounts[result.confidence] ?? 0) + 1;

    outRows.push({
      repo: row.repo,
      file: row.file,
      path: row.path,
      method: row.method,
      operationId: row.operationId,
      class: result.class,
      confidence: result.confidence,
      rule_id: result.rule_id,
      evidence: result.evidence,
    });
  }

  writeFileSync(outPath, toCsv(outRows, OUT_HEADER), 'utf8');

  console.log(`experiment: ${experimentName} (${experiment.name})`);
  console.log(`rows: ${rows.length}`);
  console.log('class counts:', classCounts);
  console.log('confidence counts:', confidenceCounts);

  return 0;
}

const exitCode = main(process.argv.slice(2));
process.exit(exitCode);
