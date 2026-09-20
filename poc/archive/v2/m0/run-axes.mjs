#!/usr/bin/env node
// CLI: node poc/m0/run-axes.mjs <out-prefix> [--holdout=<gt.csv>] [--ops=<ops.csv>]
//
// E24: two independent axes over the same op — the r/w/x union arbiter
// (arbiterUnion, rules-union.mjs, pass2 on) for tool_class, and the
// destructive flag (destructiveFlag, rules-destructive.mjs) — computed
// from method + lead verb only, never from tool_class. The point is to
// measure how wrong PRD §4.3's current mapping (destructiveHint =
// tool_class == x) is against this second, independent signal, not to
// assert an answer.
//
// Same loading conventions as run-union.mjs: CAMARA mode (loadOps() +
// halfOf, build/test) by default; a hold-out ground-truth CSV via
// --holdout, joined against operations.csv (--ops, default the
// 2026-09-07 hold-out) via loadHoldoutOps (run-holdout.mjs).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from './csv.mjs';
import { loadOps } from './spec-text.mjs';
import { halfOf } from './split.mjs';
import { loadLexicon } from './rules-lex.mjs';
import { loadTables } from './rules-verb.mjs';
import { learn } from './learn-vn.mjs';
import { arbiterUnion } from './rules-union.mjs';
import { loadHoldoutOps } from './run-holdout.mjs';
import { destructiveFlag, loadDestructiveVerbs } from './rules-destructive.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CAMARA_GT_CSV = path.join(HERE, '..', '..', 'data', 'camara-2026-09-01', 'ground-truth.csv');
const HOLDOUT_OPS_CSV = path.join(HERE, '..', '..', 'data', 'holdout-2026-09-07', 'operations.csv');
const OUT_HEADER = ['repo', 'path', 'method', 'operationId', 'summary', 'tool_class', 'gt_class', 'confidence', 'destructive', 'd_rule', 'd_evidence'];
const NEGATIVE_CONTROLS = [
  { repo: 'ClickToDial', method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall' },
  { repo: 'WebRTC', method: 'PUT', path: '/sessions/{mediaSessionId}/status', operationId: 'updateSessionStatus' },
];

function parseFlags(argv) {
  const flags = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) flags[m[1]] = m[2];
  }
  return flags;
}

function joinKeyCamara(row) {
  return [row.repo, row.path, row.method, row.operationId].join('');
}

function loadCamaraGtByKey() {
  const rows = parseCsv(readFileSync(CAMARA_GT_CSV, 'utf8'));
  const byKey = new Map();
  for (const row of rows) byKey.set(joinKeyCamara(row), row);
  return byKey;
}

function toRow(op, result, dflag, gt) {
  return {
    repo: op.repo, path: op.path, method: op.method, operationId: op.operationId,
    summary: op.summary ?? '', tool_class: result.class, gt_class: gt ? gt.gt_class : '',
    confidence: result.confidence, destructive: dflag.destructive, d_rule: dflag.rule_id, d_evidence: dflag.evidence,
  };
}

// --- grids and checks ---

function gridByTruth(rows) {
  const grid = { r: { false: 0, true: 0 }, w: { false: 0, true: 0 }, x: { false: 0, true: 0 } };
  for (const r of rows) {
    if (r.gt_class !== 'r' && r.gt_class !== 'w' && r.gt_class !== 'x') continue;
    grid[r.gt_class][String(r.destructive)]++;
  }
  return grid;
}

function gridByTool(rows) {
  const grid = { r: { false: 0, true: 0 }, w: { false: 0, true: 0 }, x: { false: 0, true: 0 } };
  for (const r of rows) grid[r.tool_class][String(r.destructive)]++;
  return grid;
}

function printGrid(title, grid) {
  console.log(`  ${title}`);
  console.log('    class  destructive=false  destructive=true');
  for (const cls of ['r', 'w', 'x']) {
    console.log(`    ${cls}      ${String(grid[cls].false).padStart(17)}  ${String(grid[cls].true).padStart(16)}`);
  }
}

function mappingCheck(rows) {
  const toolXFlagFalse = [];
  const toolWFlagTrue = [];
  for (const r of rows) {
    if (r.tool_class === 'x' && r.destructive === false) toolXFlagFalse.push(r);
    if (r.tool_class === 'w' && r.destructive === true) toolWFlagTrue.push(r);
  }
  return { toolXFlagFalse, toolWFlagTrue };
}

function printMappingCheck(rows) {
  const { toolXFlagFalse, toolWFlagTrue } = mappingCheck(rows);
  console.log(`  MAPPING CHECK: tool=x,flag=false=${toolXFlagFalse.length} tool=w,flag=true=${toolWFlagTrue.length}`);
  console.log('    tool=x,flag=false examples:');
  for (const r of toolXFlagFalse.slice(0, 8)) console.log(`      ${r.operationId} — ${r.summary}`);
  console.log('    tool=w,flag=true examples:');
  for (const r of toolWFlagTrue.slice(0, 8)) console.log(`      ${r.operationId} — ${r.summary}`);
}

function printSamples(rows) {
  const gtWDestructiveTrue = rows.filter((r) => r.gt_class === 'w' && r.destructive === true);
  const gtXDestructiveFalse = rows.filter((r) => r.gt_class === 'x' && r.destructive === false);
  console.log(`  SAMPLES gt=w & destructive=true (n=${gtWDestructiveTrue.length}):`);
  for (const r of gtWDestructiveTrue.slice(0, 6)) console.log(`    ${r.operationId} ${r.method} — ${r.summary}`);
  console.log(`  SAMPLES gt=x & destructive=false (n=${gtXDestructiveFalse.length}):`);
  for (const r of gtXDestructiveFalse.slice(0, 6)) console.log(`    ${r.operationId} ${r.method} — ${r.summary}`);
}

function report(label, rows) {
  console.log(`=== ${label} (n=${rows.length}) ===`);
  printGrid('GRID BY TRUTH', gridByTruth(rows));
  printGrid('GRID BY TOOL', gridByTool(rows));
  printMappingCheck(rows);
  printSamples(rows);
}

function printNegativeControls(ops, ctx, destructiveVerbs) {
  console.log('=== NEGATIVE CONTROLS (CAMARA) ===');
  for (const nc of NEGATIVE_CONTROLS) {
    const op = ops.find((o) => o.repo === nc.repo && o.method === nc.method && o.path === nc.path && o.operationId === nc.operationId);
    if (!op) { console.log(`  ${nc.repo} ${nc.method} ${nc.path} ${nc.operationId}: (not found)`); continue; }
    const result = arbiterUnion(op, ctx, { pass2: true });
    const dflag = destructiveFlag(op, destructiveVerbs);
    console.log(`  ${nc.repo} ${nc.method} ${nc.path} ${nc.operationId}: tool_class=${result.class} destructive=${dflag.destructive} d_rule=${dflag.rule_id}`);
  }
}

function main() {
  const outPrefix = process.argv[2];
  if (!outPrefix) {
    console.error('usage: node poc/m0/run-axes.mjs <out-prefix> [--holdout=<gt.csv>] [--ops=<ops.csv>]');
    process.exit(1);
  }
  const flags = parseFlags(process.argv.slice(3));

  const model = learn({ verbMin: 2, verbP: 0.8, nounMin: 4, nounP: 0.5 });
  const lexicon = loadLexicon(path.join(HERE, 'lexicon-v2.json'));
  const tables = loadTables();
  const ctx = { model, lexicon, tables };
  const destructiveVerbs = loadDestructiveVerbs();

  if (flags.holdout) {
    const ops = loadHoldoutOps(readFileSync(flags.ops ?? HOLDOUT_OPS_CSV, 'utf8'));
    const gtRows = parseCsv(readFileSync(flags.holdout, 'utf8'));
    const gtByKey = new Map();
    for (const gt of gtRows) gtByKey.set([gt.repo, gt.path, gt.method].join(' '), gt);
    const gtByKeyFn = (op) => {
      const gt = gtByKey.get([op.repo, op.path, op.method].join(' '));
      return gt && gt.gt_class ? gt : null;
    };

    const rows = ops.map((op) => {
      const result = arbiterUnion(op, ctx, { pass2: true });
      const dflag = destructiveFlag(op, destructiveVerbs);
      return toRow(op, result, dflag, gtByKeyFn(op));
    });

    writeFileSync(`${outPrefix}.csv`, toCsv(rows, OUT_HEADER), 'utf8');
    report('TOTAL', rows);
    return;
  }

  // CAMARA mode.
  const ops = loadOps();
  const gtByKey = loadCamaraGtByKey();
  const gtByKeyFn = (op) => gtByKey.get(joinKeyCamara(op)) ?? null;

  const rows = ops.map((op) => {
    const result = arbiterUnion(op, ctx, { pass2: true });
    const dflag = destructiveFlag(op, destructiveVerbs);
    return toRow(op, result, dflag, gtByKeyFn(op));
  });

  for (const half of ['build', 'test']) {
    const halfRows = rows.filter((r, i) => halfOf(ops[i].repo) === half);
    writeFileSync(`${outPrefix}-${half}.csv`, toCsv(halfRows, OUT_HEADER), 'utf8');
    report(half, halfRows);
  }

  printNegativeControls(ops, ctx, destructiveVerbs);
}

main();
