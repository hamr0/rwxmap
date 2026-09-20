#!/usr/bin/env node
// E25 runner. Scores arbiter25 (poc/m0/exp-e25/arbiter25.mjs) on CAMARA's two
// halves and on a hold-out CSV, with the same counters run-union.mjs prints:
// agree / over-tight / wrong-loosening / correct-lowerings, plus the wrong
// loosenings themselves and the two negative controls.
//
// usage: node poc/m0/exp-e25/run25.mjs [--variant=a,b,c] [--holdout=...] [--ops=...] [--csv=<prefix>]
// variants: base summaryOnly firstSentence partyHeadOnly ownObjects readVerbs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../csv.mjs';
import { loadOps } from '../spec-text.mjs';
import { halfOf } from '../split.mjs';
import { RANK, methodDefault } from '../rules.mjs';
import { loadLexicon } from '../rules-lex.mjs';
import { loadTables } from '../rules-verb.mjs';
import { learn } from '../learn-vn.mjs';
import { arbiterUnion } from '../rules-union.mjs';
import { loadHoldoutOps } from '../run-holdout.mjs';
import { arbiter25 } from './arbiter25.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
const CAMARA_GT = path.join(ROOT, 'data', 'camara-2026-09-01', 'ground-truth.csv');
const HOLDOUT_OPS = path.join(ROOT, 'data', 'holdout-2026-09-07', 'operations.csv');
const NEG = [
  { repo: 'ClickToDial', method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall' },
  { repo: 'WebRTC', method: 'PUT', path: '/sessions/{mediaSessionId}/status', operationId: 'updateSessionStatus' },
];

const flags = {};
for (const a of process.argv.slice(2)) { const m = a.match(/^--([^=]+)=(.*)$/); if (m) flags[m[1]] = m[2]; }

const OWN_OBJECTS = new Set(JSON.parse(readFileSync(path.join(HERE, 'own-objects.json'), 'utf8')).heads);
const RV = JSON.parse(readFileSync(path.join(HERE, 'read-verbs.json'), 'utf8'));
const EXTRA_READ = new Set(RV.verbs);
const EXTRA_READ_V = new Set([...RV.verbs, ...RV.withValidate]);
const MODIFY_VERBS = new Set(JSON.parse(readFileSync(path.join(HERE, 'modify-verbs.json'), 'utf8')).verbs);

function buildOpts(spec) {
  const opts = { pass2: true };
  for (const name of spec.split(',').filter(Boolean)) {
    if (name === 'base') continue;
    else if (name === 'ownObjects') opts.ownObjects = OWN_OBJECTS;
    else if (name === 'readVerbs') opts.readVerbs = EXTRA_READ;
    else if (name === 'readVerbsValidate') opts.readVerbs = EXTRA_READ_V;
    else if (name === 'modifyVerbs') { opts.writeFloorW = true; opts.modifyVerbs = MODIFY_VERBS; }
    else opts[name] = true;
  }
  return opts;
}

const dir = (c, gt) => c === gt ? 'agree' : (RANK[c] > RANK[gt] ? 'over' : 'leak');

function score(rows, gtFn, label) {
  let agree = 0, over = 0, leak = 0, low = 0, overHigh = 0, trulyXHigh = 0, trulyXLow = 0;
  const leaks = [];
  for (const { op, result } of rows) {
    const gt = gtFn(op); if (!gt) continue;
    const hi = result.confidence === 'high';
    if (gt.gt_class === 'x' && result.class === 'x') { if (hi) trulyXHigh++; else trulyXLow++; }
    const d = dir(result.class, gt.gt_class);
    if (d === 'agree') agree++; else if (d === 'over') { over++; if (hi) overHigh++; }
    else { leak++; leaks.push({ op, result, gt: gt.gt_class }); }
    if (result.class === 'r' && methodDefault(op.method) !== 'r' && gt.gt_class === 'r') low++;
  }
  console.log(`  ${label}: agree=${agree} over-tight=${over} wrong-loosening=${leak} correct-lowerings=${low} | over-tight@high=${overHigh} truly-x@high=${trulyXHigh} truly-x@low=${trulyXLow}`);
  for (const l of leaks) console.log(`  LEAK [${label}] ${l.op.repo} ${l.op.method} ${l.op.path} ${l.op.operationId} class=${l.result.class} gt=${l.gt} conf=${l.result.confidence} rule=${l.result.rule_id} ev="${l.result.evidence.slice(0, 140)}"`);
  return { agree, over, leak, low };
}

function main() {
  const spec = flags.variant ?? 'base';
  const opts = buildOpts(spec);
  const useBaseline = spec === 'e19';
  const model = learn({ verbMin: 2, verbP: 0.8, nounMin: 4, nounP: 0.5 });
  const ctx = { model, lexicon: loadLexicon(path.join(HERE, '..', 'lexicon-v2.json')), tables: loadTables() };
  const call = (op) => useBaseline ? arbiterUnion(op, ctx, { pass2: true }) : arbiter25(op, ctx, opts);
  console.log(`=== E25 variant: ${spec} ===`);

  const ops = flags.holdout ? loadHoldoutOps(readFileSync(flags.ops ?? HOLDOUT_OPS, 'utf8')) : loadOps();
  const rows = ops.map((op) => ({ op, result: call(op) }));

  if (flags.holdout) {
    const gtByKey = new Map();
    for (const gt of parseCsv(readFileSync(flags.holdout, 'utf8'))) gtByKey.set([gt.repo, gt.path, gt.method].join(' '), gt);
    const gtFn = (op) => { const gt = gtByKey.get([op.repo, op.path, op.method].join(' ')); return gt && gt.gt_class ? gt : null; };
    score(rows, gtFn, 'TOTAL');
    if (flags.csv) writeFileSync(`${flags.csv}.csv`, toCsv(rows.map(({ op, result }) => ({ repo: op.repo, path: op.path, method: op.method, operationId: op.operationId, summary: op.summary ?? '', class: result.class, confidence: result.confidence, rule_id: result.rule_id, evidence: result.evidence, gt_class: gtFn(op)?.gt_class ?? '' })), ['repo', 'path', 'method', 'operationId', 'summary', 'class', 'confidence', 'rule_id', 'evidence', 'gt_class']), 'utf8');
    return;
  }

  const gtByKey = new Map();
  for (const r of parseCsv(readFileSync(CAMARA_GT, 'utf8'))) gtByKey.set([r.repo, r.path, r.method, r.operationId].join(''), r);
  const gtFn = (op) => gtByKey.get([op.repo, op.path, op.method, op.operationId].join('')) ?? null;
  for (const half of ['build', 'test']) {
    const hr = rows.filter((r) => halfOf(r.op.repo) === half);
    score(hr, gtFn, half);
    if (flags.csv) writeFileSync(`${flags.csv}-${half}.csv`, toCsv(hr.map(({ op, result }) => ({ repo: op.repo, path: op.path, method: op.method, operationId: op.operationId, summary: op.summary ?? '', class: result.class, confidence: result.confidence, rule_id: result.rule_id, evidence: result.evidence, gt_class: gtFn(op)?.gt_class ?? '' })), ['repo', 'path', 'method', 'operationId', 'summary', 'class', 'confidence', 'rule_id', 'evidence', 'gt_class']), 'utf8');
  }
  console.log('  negative controls:');
  for (const nc of NEG) {
    const op = ops.find((o) => o.repo === nc.repo && o.method === nc.method && o.path === nc.path && o.operationId === nc.operationId);
    const r = op ? call(op) : null;
    console.log(`    ${nc.operationId}: class=${r ? r.class : 'n/a'} — ${r && r.class === 'x' ? 'PASS' : 'FAIL'}`);
  }
}
main();
