#!/usr/bin/env node
// CLI: node poc/m0/run-lex.mjs <out-prefix>
// Runs E9's hand-written-lexicon arbiter (arbiterLex, rules-lex.mjs) over
// all 292 operations, once per scope ('op'|'block'|'file'), regenerating
// the E8 learned model (verbMap only) from the BUILD half so nothing here
// depends on a scratchpad model file. Writes six CSVs in run-vn.mjs's
// column format and prints per-scope, per-half counts to stdout.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from './csv.mjs';
import { loadOps } from './spec-text.mjs';
import { halfOf } from './split.mjs';
import { RANK, methodDefault } from './rules.mjs';
import { loadLexicon, arbiterLex } from './rules-lex.mjs';
import { learn } from './learn-vn.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GROUND_TRUTH_CSV = path.join(HERE, '..', '..', 'data', 'camara-2026-09-01', 'ground-truth.csv');
const SCOPES = ['op', 'block', 'file'];
const HALVES = ['build', 'test'];
const OUT_HEADER = ['repo', 'file', 'path', 'method', 'operationId', 'class', 'confidence', 'rule_id', 'evidence'];
const NEGATIVE_CONTROLS = [
  { repo: 'ClickToDial', method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall' },
  { repo: 'WebRTC', method: 'PUT', path: '/sessions/{mediaSessionId}/status', operationId: 'updateSessionStatus' },
];

function joinKey(row) {
  return [row.repo, row.path, row.method, row.operationId].join('');
}

function loadGroundTruthByKey() {
  const rows = parseCsv(readFileSync(GROUND_TRUTH_CSV, 'utf8'));
  const byKey = new Map();
  for (const row of rows) byKey.set(joinKey(row), row);
  return byKey;
}

// Duplicated from rules-lex.mjs's private scopedText/matchStems: for
// reporting only (which stems fired, how often), independent of which
// rule ultimately decided the op.
function scopedText(op, scope) {
  const opText = [op.summary, op.description, op.operationId, op.path].filter(Boolean).join(' ');
  if (scope === 'op') return opText;
  if (scope === 'block') return [opText, op.opBlockText, op.infoDescription].filter(Boolean).join(' ');
  return op.fileText ?? '';
}

function matchStems(text, compiled) {
  const hits = [];
  for (const { stem, re } of compiled) if (re.test(text)) hits.push(stem);
  return hits;
}

function direction(ruleClass, gtClass) {
  if (ruleClass === gtClass) return 'agree';
  return RANK[ruleClass] > RANK[gtClass] ? 'over-tight' : 'wrong-loosening';
}

// CLI flags after the out-prefix: --lexicon=<file> --scope=op|block|file|all
// --nouns=all|path --readverbs=learned|hand --floor=method|x --label=<name>
function parseFlags(argv) {
  const flags = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) flags[m[1]] = m[2];
  }
  return flags;
}

const outPrefix = process.argv[2];
if (!outPrefix) {
  console.error('usage: node poc/m0/run-lex.mjs <out-prefix> [--lexicon=<file>] [--scope=op|block|file|all] [--nouns=all|path] [--readverbs=learned|hand] [--floor=method|x] [--label=<name>]');
  process.exit(1);
}
const flags = parseFlags(process.argv.slice(3));
const lexiconFile = flags.lexicon ?? 'lexicon.json';
const scopeFlag = flags.scope ?? 'all';
const nounSource = flags.nouns ?? 'all';
const readVerbsOpt = flags.readverbs ?? 'learned';
const nonSafeFloor = flags.floor ?? 'method';
const label = flags.label ?? null;
const arbiterOpts = { nounSource, readVerbs: readVerbsOpt, nonSafeFloor };
const runScopes = scopeFlag === 'all' ? SCOPES : [scopeFlag];

const model = learn({ verbMin: 2, verbP: 0.8, nounMin: 4, nounP: 0.5 });
if (label) console.log(`=== ${label} ===`);
console.log(`flags: lexicon=${lexiconFile} scope=${scopeFlag} nouns=${nounSource} readverbs=${readVerbsOpt} floor=${nonSafeFloor}`);
console.log(`E8 model regenerated: verbMap entries=${Object.keys(model.verbMap).length}, liveNouns entries=${model.liveNouns.length} (params ${JSON.stringify(model.params)})`);

const lexicon = loadLexicon(path.join(HERE, lexiconFile));
const ops = loadOps();
const gtByKey = loadGroundTruthByKey();

// Trivial baseline, for reference, computed once.
console.log('\n=== baseline: GET is r, else x ===');
for (const half of HALVES) {
  let agree = 0, overTight = 0, wrongLoosen = 0;
  for (const op of ops) {
    if (halfOf(op.repo) !== half) continue;
    const gt = gtByKey.get(joinKey(op));
    if (!gt) continue;
    const c = String(op.method).toUpperCase() === 'GET' ? 'r' : 'x';
    const d = direction(c, gt.gt_class);
    if (d === 'agree') agree++; else if (d === 'over-tight') overTight++; else wrongLoosen++;
  }
  console.log(`  ${half}: agree=${agree} over-tight=${overTight} wrong-loosening=${wrongLoosen}`);
}

for (const scope of runScopes) {
  console.log(`\n=== scope: ${scope} ===`);
  const rows = ops.map((op) => ({ op, result: arbiterLex(op, model, lexicon, scope, arbiterOpts) }));

  for (const half of HALVES) {
    const halfRows = rows.filter((r) => halfOf(r.op.repo) === half);
    writeFileSync(
      `${outPrefix}-${scope}-${half}.csv`,
      toCsv(halfRows.map(({ op, result }) => ({
        repo: op.repo, file: op.file, path: op.path, method: op.method, operationId: op.operationId,
        class: result.class, confidence: result.confidence, rule_id: result.rule_id, evidence: result.evidence,
      })), OUT_HEADER),
      'utf8'
    );

    let agree = 0, overTight = 0, wrongLoosen = 0, correctLowering = 0;
    const wrongRows = [];
    const overTightByRule = {};
    const stemCounts = {};
    for (const { op, result } of halfRows) {
      const gt = gtByKey.get(joinKey(op));
      if (!gt) continue;
      const d = direction(result.class, gt.gt_class);
      if (d === 'agree') agree++;
      else if (d === 'over-tight') { overTight++; overTightByRule[result.rule_id] = (overTightByRule[result.rule_id] ?? 0) + 1; }
      else { wrongLoosen++; wrongRows.push({ half, op, result, gt_class: gt.gt_class }); }
      if (result.class === 'r' && methodDefault(op.method) !== 'r' && gt.gt_class === 'r') correctLowering++;

      const text = scopedText(op, scope);
      for (const stem of matchStems(text, lexicon.verbRe)) stemCounts[stem] = (stemCounts[stem] ?? 0) + 1;
      for (const stem of matchStems(text, lexicon.nounRe)) stemCounts[stem] = (stemCounts[stem] ?? 0) + 1;
    }

    console.log(`  ${half}: agree=${agree} over-tight=${overTight} wrong-loosening=${wrongLoosen} correct-lowerings=${correctLowering}`);
    console.log(`  ${half} over-tight by rule_id: ${JSON.stringify(overTightByRule)}`);
    const stemTable = Object.entries(stemCounts).sort((a, b) => b[1] - a[1]);
    console.log(`  ${half} stems fired: ${stemTable.map(([s, n]) => `${s}=${n}`).join(', ') || '(none)'}`);

    for (const { op, result, gt_class } of wrongRows) {
      console.log(`  WRONG-LOOSENING [${half}] ${op.repo} ${op.method} ${op.path} ${op.operationId} rule=${result.rule_id} class=${result.class} gt=${gt_class} evidence="${result.evidence}"`);
    }
  }

  console.log('  negative controls:');
  for (const nc of NEGATIVE_CONTROLS) {
    const op = ops.find((o) => o.repo === nc.repo && o.method === nc.method && o.path === nc.path && o.operationId === nc.operationId);
    const result = op ? arbiterLex(op, model, lexicon, scope, arbiterOpts) : null;
    const pass = result && result.class === 'x' ? 'PASS' : 'FAIL';
    console.log(`    ${nc.repo} ${nc.method} ${nc.path} ${nc.operationId}: class=${result ? result.class : '(not found)'} — ${pass}`);
  }
}
