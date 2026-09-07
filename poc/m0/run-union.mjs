#!/usr/bin/env node
// CLI: node poc/m0/run-union.mjs <out-prefix> [--pass2=on|off] [--label=<name>]
//        [--holdout=<ground-truth.csv>]
// Runs E19's union arbiter (arbiterUnion, rules-union.mjs): E12b's word-list
// arbiter (arbiterLex) composed with E18's verb-led arbiter (arbiterVerb),
// tighter-wins. Mirrors run-verb.mjs's two modes: CAMARA (loadOps()+halfOf)
// or the 2026-09-07 hold-out CSV. The point of this experiment is the
// raisedBy breakdown of the x rows (both/wordlist-only/verb-only/neither),
// each split into truly-x vs. over-tightening, printed below the usual
// agree/over-tight/wrong-loosening/correct-lowerings counts.
//
// D23: pass 2 is confidence-only and must never change a class. This script
// scores every row with pass2 on AND off and asserts the classes match
// (prints "pass2 class changes: N", which must be 0) rather than trusting
// rules-union.mjs's own no-class-change discipline silently.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from './csv.mjs';
import { loadOps } from './spec-text.mjs';
import { halfOf } from './split.mjs';
import { RANK, methodDefault } from './rules.mjs';
import { loadLexicon } from './rules-lex.mjs';
import { loadTables } from './rules-verb.mjs';
import { learn } from './learn-vn.mjs';
import { arbiterUnion } from './rules-union.mjs';
import { loadHoldoutOps } from './run-holdout.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CAMARA_GT_CSV = path.join(HERE, '..', '..', 'data', 'camara-2026-09-01', 'ground-truth.csv');
const HOLDOUT_OPS_CSV = path.join(HERE, '..', '..', 'data', 'holdout-2026-09-07', 'operations.csv');
const OUT_HEADER_HOLDOUT = ['repo', 'path', 'method', 'operationId', 'class', 'confidence', 'rule_id', 'evidence', 'gt_class', 'agree', 'raised_by'];
const OUT_HEADER_CAMARA = ['repo', 'file', 'path', 'method', 'operationId', 'class', 'confidence', 'rule_id', 'evidence', 'gt_class', 'agree', 'raised_by'];
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

function toRow(op, result, gt) {
  return {
    repo: op.repo, file: op.file, path: op.path, method: op.method, operationId: op.operationId,
    class: result.class, confidence: result.confidence, rule_id: result.rule_id, evidence: result.evidence,
    gt_class: gt ? gt.gt_class : '', agree: result.agree, raised_by: result.raisedBy,
  };
}

function scoreRows(rows, gtByKeyFn) {
  let agree = 0, overTight = 0, wrongLoosen = 0, correctLowering = 0;
  const wrongRows = [];
  const overTightByRule = {};
  for (const { op, result } of rows) {
    const gt = gtByKeyFn(op);
    if (!gt) continue;
    const d = direction(result.class, gt.gt_class);
    if (d === 'agree') agree++;
    else if (d === 'over-tight') { overTight++; overTightByRule[result.rule_id] = (overTightByRule[result.rule_id] ?? 0) + 1; }
    else { wrongLoosen++; wrongRows.push({ op, result, gt_class: gt.gt_class, reason: gt.reason ?? '' }); }
    if (result.class === 'r' && methodDefault(op.method) !== 'r' && gt.gt_class === 'r') correctLowering++;
  }
  return { agree, overTight, wrongLoosen, correctLowering, wrongRows, overTightByRule };
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

// The point of the experiment: for every row the union called x, bucket it
// by which arbiter(s) raised it above the floor, and split each bucket by
// whether ground truth agrees (truly x) or not (over-tightening). Rows
// neither arbiter raised (raisedBy 'neither') that the union still called x
// only happen when the floor itself is x (a POST/PATCH) — bucketed the same
// way so a missed truly-x row among them (one the tool called something
// other than x) is visible in the "neither raisedBy" table's absence.
function raisedByBreakdown(rows, gtByKeyFn) {
  const buckets = { both: { truly: 0, over: 0 }, wordlist: { truly: 0, over: 0 }, verb: { truly: 0, over: 0 }, neither: { truly: 0, over: 0 } };
  for (const { op, result } of rows) {
    if (result.class !== 'x') continue;
    const gt = gtByKeyFn(op);
    if (!gt) continue;
    const bucket = buckets[result.raisedBy];
    if (gt.gt_class === 'x') bucket.truly++; else bucket.over++;
  }
  return buckets;
}

// One label's full report: agree/over-tight/wrong-loosening/correct-
// lowerings, trivial baseline, and the raisedBy breakdown.
function report(label, rows, gtByKeyFn) {
  const stats = scoreRows(rows, gtByKeyFn);
  console.log(`  ${label}: agree=${stats.agree} over-tight=${stats.overTight} wrong-loosening=${stats.wrongLoosen} correct-lowerings=${stats.correctLowering}`);
  console.log(`  ${label} over-tight by rule_id: ${JSON.stringify(stats.overTightByRule)}`);
  for (const r of stats.wrongRows) {
    console.log(`  WRONG-LOOSENING [${label}] ${r.op.repo} ${r.op.method} ${r.op.path} ${r.op.operationId} rule=${r.result.rule_id} class=${r.result.class} gt=${r.gt_class} evidence="${r.result.evidence}" gt_reason="${r.reason.slice(0, 160)}"`);
  }
  const b = trivialBaseline(rows, gtByKeyFn);
  console.log(`  ${label} trivial baseline: agree=${b.agree} over-tight=${b.overTight} wrong-loosening=${b.wrongLoosen}`);
  const buckets = raisedByBreakdown(rows, gtByKeyFn);
  console.log(`  ${label} x rows by raisedBy (truly-x / over-tightening):`);
  for (const key of ['both', 'wordlist', 'verb', 'neither']) {
    console.log(`    ${key}: truly-x=${buckets[key].truly} over-tightening=${buckets[key].over}`);
  }
}

function printNegativeControls(ops, ctx, opts) {
  console.log('  negative controls:');
  for (const nc of NEGATIVE_CONTROLS) {
    const op = ops.find((o) => o.repo === nc.repo && o.method === nc.method && o.path === nc.path && o.operationId === nc.operationId);
    const result = op ? arbiterUnion(op, ctx, opts) : null;
    const pass = result && result.class === 'x' ? 'PASS' : 'FAIL';
    console.log(`    ${nc.repo} ${nc.method} ${nc.path} ${nc.operationId}: class=${result ? result.class : '(not found)'} — ${pass}`);
  }
}

// D23 assertion: score every row with pass2 on AND off and confirm the
// class never differs. Returns the count of rows where it did (must be 0).
function countPass2ClassChanges(ops, ctx) {
  let changes = 0;
  for (const op of ops) {
    if (arbiterUnion(op, ctx, { pass2: false }).class !== arbiterUnion(op, ctx, { pass2: true }).class) changes++;
  }
  return changes;
}

function main() {
  const outPrefix = process.argv[2];
  if (!outPrefix) {
    console.error('usage: node poc/m0/run-union.mjs <out-prefix> [--pass2=on|off] [--label=<name>] [--holdout=<ground-truth.csv>]');
    process.exit(1);
  }
  const flags = parseFlags(process.argv.slice(3));
  const pass2On = (flags.pass2 ?? 'off') === 'on';
  const opts = { pass2: pass2On };
  const label = flags.label ?? null;

  const model = learn({ verbMin: 2, verbP: 0.8, nounMin: 4, nounP: 0.5 });
  const lexicon = loadLexicon(path.join(HERE, 'lexicon-v2.json'));
  const tables = loadTables();
  const ctx = { model, lexicon, tables };

  if (label) console.log(`=== ${label} ===`);
  console.log(`flags: pass2=${pass2On ? 'on' : 'off'}`);
  console.log(`E8 model regenerated: verbMap entries=${Object.keys(model.verbMap).length} (params ${JSON.stringify(model.params)})`);

  const ops = flags.holdout ? loadHoldoutOps(readFileSync(HOLDOUT_OPS_CSV, 'utf8')) : loadOps();

  const changes = countPass2ClassChanges(ops, ctx);
  console.log(`pass2 class changes: ${changes}`);
  if (changes !== 0) {
    console.error(`STOP: pass2 changed the class on ${changes} row(s) — D23 violated.`);
    process.exit(1);
  }

  const rows = ops.map((op) => ({ op, result: arbiterUnion(op, ctx, opts) }));

  if (flags.holdout) {
    const gtRows = parseCsv(readFileSync(flags.holdout, 'utf8'));
    const gtByKey = new Map();
    for (const gt of gtRows) gtByKey.set([gt.repo, gt.path, gt.method].join(' '), gt);
    const gtByKeyFn = (op) => {
      const gt = gtByKey.get([op.repo, op.path, op.method].join(' '));
      return gt && gt.gt_class ? gt : null;
    };
    const REPOS = ['twilio', 'stripe', 'github'];

    console.log('\n=== per repo ===');
    for (const repo of [...REPOS, 'TOTAL']) {
      report(repo, repo === 'TOTAL' ? rows : rows.filter((r) => r.op.repo === repo), gtByKeyFn);
    }

    const csvRows = rows.map(({ op, result }) => toRow(op, result, gtByKeyFn(op)));
    writeFileSync(`${outPrefix}.csv`, toCsv(csvRows, OUT_HEADER_HOLDOUT), 'utf8');
    return;
  }

  // CAMARA mode.
  const gtByKey = loadCamaraGtByKey();
  const gtByKeyFn = (op) => gtByKey.get(joinKeyCamara(op)) ?? null;

  console.log('\n=== E19 union arbiter ===');
  for (const half of ['build', 'test']) {
    const halfRows = rows.filter((r) => halfOf(r.op.repo) === half);
    writeFileSync(
      `${outPrefix}-${half}.csv`,
      toCsv(halfRows.map(({ op, result }) => toRow(op, result, gtByKeyFn(op))), OUT_HEADER_CAMARA),
      'utf8'
    );
    report(half, halfRows, gtByKeyFn);
  }

  printNegativeControls(ops, ctx, opts);
}

main();
