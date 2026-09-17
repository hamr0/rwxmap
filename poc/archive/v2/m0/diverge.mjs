#!/usr/bin/env node
// CLI: node poc/m0/diverge.mjs <run-out.csv> <ground-truth.csv> <divergence-out.md>
// Joins a run.mjs output against a hand-read ground truth on
// repo+path+method+operationId, and writes a divergence report.
// The gate verdict (go/no-go) is the human's; this script only counts.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { parseCsv } from './csv.mjs';
import { RANK } from './rules.mjs';

function usage() {
  return 'usage: node poc/m0/diverge.mjs <run-out.csv> <ground-truth.csv> <divergence-out.md>';
}

function joinKey(row) {
  return [row.repo, row.path, row.method, row.operationId].join('');
}

const NEGATIVE_CONTROLS = [
  { repo: 'ClickToDial', method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall' },
  { repo: 'WebRTC', method: 'PUT', path: '/sessions/{mediaSessionId}/status', operationId: 'updateSessionStatus' },
];

function bump(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function renderCountBlock(counts) {
  const lines = [];
  lines.push(`- rows joined: ${counts.joined}`);
  lines.push(`- unjoined (in run, not in ground truth): ${counts.unjoinedRun.length}`);
  for (const id of counts.unjoinedRun) lines.push(`  - ${id}`);
  lines.push(`- unjoined (in ground truth, not in run): ${counts.unjoinedGt.length}`);
  for (const id of counts.unjoinedGt) lines.push(`  - ${id}`);
  lines.push(`- agree: ${counts.direction.agree ?? 0}`);
  lines.push(`- WRONG-LOOSENING: ${counts.direction['WRONG-LOOSENING'] ?? 0}`);
  lines.push(`- over-tight: ${counts.direction['over-tight'] ?? 0}`);
  lines.push('');
  lines.push('By method:');
  for (const [method, byDir] of Object.entries(counts.byMethod)) {
    lines.push(`  - ${method}: ${JSON.stringify(byDir)}`);
  }
  lines.push('');
  lines.push('By confidence:');
  for (const [confidence, byDir] of Object.entries(counts.byConfidence)) {
    lines.push(`  - ${confidence}: ${JSON.stringify(byDir)}`);
  }
  return lines.join('\n');
}

function renderTable(rows) {
  const header = '| repo | method | path | operationId | rule class | confidence | rule_id | evidence | gt_class | gt reason |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|';
  const body = rows.map((r) =>
    `| ${r.repo} | ${r.method} | ${r.path} | ${r.operationId} | ${r.class} | ${r.confidence} | ${r.rule_id} | ${r.evidence} | ${r.gt_class} | ${r.reason} |`
  );
  return [header, sep, ...body].join('\n');
}

function main(argv) {
  const [runPath, gtPath, outPath] = argv;

  if (!runPath || !gtPath || !outPath) {
    console.error(usage());
    return 1;
  }
  if (!existsSync(runPath)) {
    console.error(`run output file not found: ${runPath}`);
    return 1;
  }
  if (!existsSync(gtPath)) {
    console.error(`ground truth file not found: ${gtPath}`);
    return 1;
  }

  const runRows = parseCsv(readFileSync(runPath, 'utf8'));
  const gtRows = parseCsv(readFileSync(gtPath, 'utf8'));

  const gtByKey = new Map();
  for (const row of gtRows) gtByKey.set(joinKey(row), row);

  const runByKey = new Map();
  for (const row of runRows) runByKey.set(joinKey(row), row);

  const unjoinedRun = [];
  const unjoinedGt = [];
  const wrongLoosenings = [];
  const overTightenings = [];
  const direction = {};
  const byMethod = {};
  const byConfidence = {};
  let joined = 0;

  for (const [key, runRow] of runByKey) {
    const gtRow = gtByKey.get(key);
    if (!gtRow) {
      unjoinedRun.push(runRow.operationId);
      continue;
    }
    joined++;

    const rRank = RANK[runRow.class];
    const gRank = RANK[gtRow.gt_class];
    let dir;
    if (runRow.class === gtRow.gt_class) dir = 'agree';
    else if (rRank < gRank) dir = 'WRONG-LOOSENING';
    else dir = 'over-tight';

    bump(direction, dir);
    byMethod[runRow.method] = byMethod[runRow.method] ?? {};
    bump(byMethod[runRow.method], dir);
    byConfidence[runRow.confidence] = byConfidence[runRow.confidence] ?? {};
    bump(byConfidence[runRow.confidence], dir);

    const combined = { ...runRow, gt_class: gtRow.gt_class, reason: gtRow.reason };
    if (dir === 'WRONG-LOOSENING') wrongLoosenings.push(combined);
    if (dir === 'over-tight') overTightenings.push(combined);
  }

  for (const [key, gtRow] of gtByKey) {
    if (!runByKey.has(key)) unjoinedGt.push(gtRow.operationId);
  }

  const counts = { joined, unjoinedRun, unjoinedGt, direction, byMethod, byConfidence };

  const negControlLines = NEGATIVE_CONTROLS.map((nc) => {
    const key = joinKey(nc);
    const runRow = runByKey.get(key);
    const gtRow = gtByKey.get(key);
    const ruleClass = runRow ? runRow.class : '(not found in run output)';
    const gtClass = gtRow ? gtRow.gt_class : '(not found in ground truth)';
    const pass = runRow && runRow.class === 'x' ? 'PASS' : 'FAIL';
    return `- ${nc.repo} ${nc.method} ${nc.path} \`${nc.operationId}\`: rule class = ${ruleClass}, gt class = ${gtClass} — ${pass}`;
  });

  const md = [
    '# M0 divergence report',
    '',
    '## Counts',
    '',
    renderCountBlock(counts),
    '',
    '## Wrong loosenings',
    '',
    wrongLoosenings.length > 0 ? renderTable(wrongLoosenings) : '(none)',
    '',
    '## Over-tightenings',
    '',
    overTightenings.length > 0 ? renderTable(overTightenings) : '(none)',
    '',
    '## Negative controls',
    '',
    ...negControlLines,
    '',
  ].join('\n');

  writeFileSync(outPath, md, 'utf8');

  console.log(`joined: ${joined}`);
  console.log(`unjoined (run only): ${unjoinedRun.length}`);
  console.log(`unjoined (gt only): ${unjoinedGt.length}`);
  console.log('direction counts:', direction);
  console.log('by method:', byMethod);
  console.log('by confidence:', byConfidence);
  for (const line of negControlLines) console.log(line);

  return 0;
}

const exitCode = main(process.argv.slice(2));
process.exit(exitCode);
