#!/usr/bin/env node
// CLI: node poc/m0/run-verb.mjs <out-prefix> [--parties=object|anywhere]
//        [--label=<name>] [--holdout=<ground-truth.csv>]
// Runs E18's verb-led arbiter (arbiterVerb, rules-verb.mjs).
// Without --holdout: scores all 292 CAMARA ops (loadOps/halfOf), split
// build/test, writing <prefix>-build.csv / <prefix>-test.csv.
// With --holdout=<ground-truth.csv>: scores the 2026-09-07 hold-out set
// (data/holdout-2026-09-07/operations.csv), grouped per repo the way
// run-holdout.mjs does, writing <prefix>.csv with an added gt_class column.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from './csv.mjs';
import { loadOps } from './spec-text.mjs';
import { halfOf } from './split.mjs';
import { RANK, methodDefault } from './rules.mjs';
import { leadVerb } from './rules-vn.mjs';
import { loadTables, arbiterVerb } from './rules-verb.mjs';
import { loadHoldoutOps } from './run-holdout.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CAMARA_GT_CSV = path.join(HERE, '..', '..', 'data', 'camara-2026-09-01', 'ground-truth.csv');
const OUT_HEADER = ['repo', 'file', 'path', 'method', 'operationId', 'class', 'confidence', 'rule_id', 'evidence'];
const OUT_HEADER_HOLDOUT = [...OUT_HEADER.filter((h) => h !== 'file'), 'gt_class'];
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

function direction(ruleClass, gtClass) {
  if (ruleClass === gtClass) return 'agree';
  return RANK[ruleClass] > RANK[gtClass] ? 'over-tight' : 'wrong-loosening';
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

// Track which lead verbs and which party words fired, across all scored
// rows, for the reporting table.
function recordFiring(op, result, tables, verbCounts, partyCounts) {
  const v = leadVerb(op);
  if (v) verbCounts[v] = (verbCounts[v] ?? 0) + 1;
  if (result.rule_id === 'V3-party-object') {
    const m = /party=(\S+)/.exec(result.evidence);
    if (m) partyCounts[m[1]] = (partyCounts[m[1]] ?? 0) + 1;
  }
}

function printFiringTable(label, verbCounts, partyCounts) {
  const verbTable = Object.entries(verbCounts).sort((a, b) => b[1] - a[1]);
  const partyTable = Object.entries(partyCounts).sort((a, b) => b[1] - a[1]);
  console.log(`  ${label} lead verbs fired: ${verbTable.map(([v, n]) => `${v}=${n}`).join(', ') || '(none)'}`);
  console.log(`  ${label} party words fired: ${partyTable.map(([p, n]) => `${p}=${n}`).join(', ') || '(none)'}`);
}

function printNegativeControls(ops, tables, opts) {
  console.log('  negative controls:');
  for (const nc of NEGATIVE_CONTROLS) {
    const op = ops.find((o) => o.repo === nc.repo && o.method === nc.method && o.path === nc.path && o.operationId === nc.operationId);
    const result = op ? arbiterVerb(op, tables, opts) : null;
    const pass = result && result.class === 'x' ? 'PASS' : 'FAIL';
    console.log(`    ${nc.repo} ${nc.method} ${nc.path} ${nc.operationId}: class=${result ? result.class : '(not found)'} — ${pass}`);
  }
}

function scoreRows(rows, gtByKeyFn) {
  let agree = 0, overTight = 0, wrongLoosen = 0, correctLowering = 0;
  const wrongRows = [];
  const overTightByRule = {};
  for (const { op, result } of rows) {
    const gt = gtByKeyFn(op);
    if (!gt) continue;
    const gtClass = gt.gt_class;
    const d = direction(result.class, gtClass);
    if (d === 'agree') agree++;
    else if (d === 'over-tight') { overTight++; overTightByRule[result.rule_id] = (overTightByRule[result.rule_id] ?? 0) + 1; }
    else { wrongLoosen++; wrongRows.push({ op, result, gt_class: gtClass, reason: gt.reason ?? '' }); }
    if (result.class === 'r' && methodDefault(op.method) !== 'r' && gtClass === 'r') correctLowering++;
  }
  return { agree, overTight, wrongLoosen, correctLowering, wrongRows, overTightByRule };
}

function printStats(label, stats) {
  console.log(`  ${label}: agree=${stats.agree} over-tight=${stats.overTight} wrong-loosening=${stats.wrongLoosen} correct-lowerings=${stats.correctLowering}`);
  console.log(`  ${label} over-tight by rule_id: ${JSON.stringify(stats.overTightByRule)}`);
  for (const r of stats.wrongRows) {
    console.log(`  WRONG-LOOSENING [${label}] ${r.op.repo} ${r.op.method} ${r.op.path} ${r.op.operationId} rule=${r.result.rule_id} class=${r.result.class} gt=${r.gt_class} evidence="${r.result.evidence}" gt_reason="${r.reason.slice(0, 160)}"`);
  }
}

function trivialBaseline(rows, gtByKeyFn) {
  let agree = 0, overTight = 0, wrongLoosen = 0;
  for (const { op } of rows) {
    const gt = gtByKeyFn(op);
    if (!gt) continue;
    const c = String(op.method).toUpperCase() === 'GET' ? 'r' : 'x';
    const d = direction(c, gt.gt_class);
    if (d === 'agree') agree++; else if (d === 'over-tight') overTight++; else wrongLoosen++;
  }
  return { agree, overTight, wrongLoosen };
}

function main() {
  const outPrefix = process.argv[2];
  if (!outPrefix) {
    console.error('usage: node poc/m0/run-verb.mjs <out-prefix> [--parties=object|anywhere] [--label=<name>] [--holdout=<ground-truth.csv>]');
    process.exit(1);
  }
  const flags = parseFlags(process.argv.slice(3));
  const partySource = flags.parties ?? 'object';
  const opts = { partySource };
  const label = flags.label ?? null;

  const tables = loadTables();
  if (label) console.log(`=== ${label} ===`);
  console.log(`flags: parties=${partySource}`);

  if (flags.holdout) {
    const HOLDOUT_CSV = path.join(HERE, '..', '..', 'data', 'holdout-2026-09-07', 'operations.csv');
    const ops = loadHoldoutOps(readFileSync(HOLDOUT_CSV, 'utf8'));
    const gtRows = parseCsv(readFileSync(flags.holdout, 'utf8'));
    const gtByKey = new Map();
    for (const gt of gtRows) gtByKey.set([gt.repo, gt.path, gt.method].join(' '), gt);
    const gtByKeyFn = (op) => {
      const gt = gtByKey.get([op.repo, op.path, op.method].join(' '));
      return gt && gt.gt_class ? gt : null;
    };

    const rows = ops.map((op) => ({ op, result: arbiterVerb(op, tables, opts) }));
    const REPOS = ['twilio', 'stripe', 'github'];

    const allCsvRows = [];
    console.log('\n=== per repo ===');
    for (const repo of [...REPOS, 'TOTAL']) {
      const repoRows = repo === 'TOTAL' ? rows : rows.filter((r) => r.op.repo === repo);
      const stats = scoreRows(repoRows, gtByKeyFn);
      printStats(repo, stats);
    }

    console.log('\n=== trivial baseline: everything x (no GETs in this set) ===');
    for (const repo of [...REPOS, 'TOTAL']) {
      const repoRows = repo === 'TOTAL' ? rows : rows.filter((r) => r.op.repo === repo);
      const b = trivialBaseline(repoRows, gtByKeyFn);
      console.log(`  ${repo}: agree=${b.agree} over-tight=${b.overTight} wrong-loosening=${b.wrongLoosen}`);
    }

    const verbCounts = {}, partyCounts = {};
    for (const { op, result } of rows) recordFiring(op, result, tables, verbCounts, partyCounts);
    console.log('\n=== firing table ===');
    printFiringTable('TOTAL', verbCounts, partyCounts);

    printNegativeControls(ops, tables, opts);

    for (const { op, result } of rows) {
      const gt = gtByKeyFn(op);
      allCsvRows.push({
        repo: op.repo, path: op.path, method: op.method, operationId: op.operationId,
        class: result.class, confidence: result.confidence, rule_id: result.rule_id, evidence: result.evidence,
        gt_class: gt ? gt.gt_class : '',
      });
    }
    writeFileSync(`${outPrefix}.csv`, toCsv(allCsvRows, OUT_HEADER_HOLDOUT), 'utf8');
    return;
  }

  // CAMARA mode.
  const ops = loadOps();
  const gtByKey = loadCamaraGtByKey();
  const gtByKeyFn = (op) => gtByKey.get(joinKeyCamara(op)) ?? null;
  const rows = ops.map((op) => ({ op, result: arbiterVerb(op, tables, opts) }));

  console.log('\n=== trivial baseline: GET is r, else x ===');
  for (const half of ['build', 'test']) {
    const halfRows = rows.filter((r) => halfOf(r.op.repo) === half);
    const b = trivialBaseline(halfRows, gtByKeyFn);
    console.log(`  ${half}: agree=${b.agree} over-tight=${b.overTight} wrong-loosening=${b.wrongLoosen}`);
  }

  console.log('\n=== E18 verb-led arbiter ===');
  for (const half of ['build', 'test']) {
    const halfRows = rows.filter((r) => halfOf(r.op.repo) === half);
    writeFileSync(
      `${outPrefix}-${half}.csv`,
      toCsv(halfRows.map(({ op, result }) => ({
        repo: op.repo, file: op.file, path: op.path, method: op.method, operationId: op.operationId,
        class: result.class, confidence: result.confidence, rule_id: result.rule_id, evidence: result.evidence,
      })), OUT_HEADER),
      'utf8'
    );
    const stats = scoreRows(halfRows, gtByKeyFn);
    printStats(half, stats);

    const verbCounts = {}, partyCounts = {};
    for (const { op, result } of halfRows) recordFiring(op, result, tables, verbCounts, partyCounts);
    printFiringTable(half, verbCounts, partyCounts);
  }

  printNegativeControls(ops, tables, opts);
}

main();
