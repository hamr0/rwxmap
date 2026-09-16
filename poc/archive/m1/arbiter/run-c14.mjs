// M1-C14 sweep: measures all 8 combinations of c14.mjs's three switches
// (readGet, textFallback, nounStem) across all six sets, reports exact/
// leak/over-tight counts and percentages, a hold-out-5 per-vendor
// breakdown (that is where the three known defects live — see c14.mjs's
// header), and both negative controls under every combination.
//
// This is a MEASUREMENT run — it adopts nothing and writes no default
// behaviour change to c11.mjs/judge.mjs/arbiter.mjs. It also asserts the
// tightening-only doctrine: any row that LOOSENS under any combination
// versus the all-switches-off baseline is a doctrine violation and is
// flagged loudly at the top of the written sweep file.
//
// How to re-run: node poc/m1/arbiter/run-c14.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { CLASS_ORDER } from './arbiter.mjs';
import { classify as classifyC14 } from './c14.mjs';
import {
  REPO_ROOT,
  loadCensusRows,
  loadHoldout3,
  loadHoldout4,
  loadHoldout5,
} from './load-sets.mjs';

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c14-sweep.md');
const OUT_CSV = path.join(REPO_ROOT, 'docs/logs/m1/c14-changed-rows.csv');

const CONFIGS = [
  { name: 'baseline', opts: {} },
  { name: 'readGet', opts: { readGet: true } },
  { name: 'textFallback', opts: { textFallback: true } },
  { name: 'nounStem', opts: { nounStem: true } },
  { name: 'readGet+textFallback', opts: { readGet: true, textFallback: true } },
  { name: 'readGet+nounStem', opts: { readGet: true, nounStem: true } },
  { name: 'textFallback+nounStem', opts: { textFallback: true, nounStem: true } },
  { name: 'readGet+textFallback+nounStem', opts: { readGet: true, textFallback: true, nounStem: true } },
];

const SETS = ['camara', 'holdout1', 'holdout2', 'holdout3', 'holdout4', 'holdout5'];

function kindOf(predClass, gtClass) {
  const predIdx = CLASS_ORDER[predClass];
  const truthIdx = CLASS_ORDER[gtClass];
  if (predIdx < truthIdx) return 'leak';
  if (predIdx > truthIdx) return 'overTight';
  return 'exact';
}

function mdTable(rows, header) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.map((c) => String(c)).join(' | ')} |`);
  return lines.join('\n');
}

function summaryRow(setRows, scored) {
  const n = setRows.length;
  let exact = 0, leaks = 0, overTight = 0;
  for (const row of setRows) {
    const result = scored.get(row);
    const kind = kindOf(result.class, row.gt_class);
    if (kind === 'leak') leaks += 1;
    else if (kind === 'overTight') overTight += 1;
    else exact += 1;
  }
  const pct = (c) => (n ? ((c / n) * 100).toFixed(1) : '0.0');
  return { n, exact, leaks, overTight, exactPct: pct(exact), leakPct: pct(leaks), overTightPct: pct(overTight) };
}

function perSetTable(rows, sets, scored) {
  const table = [];
  for (const setName of sets) {
    const setRows = rows.filter((r) => r.set === setName);
    const s = summaryRow(setRows, scored);
    table.push([setName, s.n, s.exact, s.leaks, s.overTight, s.exactPct, s.leakPct, s.overTightPct]);
  }
  const all = summaryRow(rows, scored);
  table.push(['all', all.n, all.exact, all.leaks, all.overTight, all.exactPct, all.leakPct, all.overTightPct]);
  return table;
}

function vendorTable(holdout5Rows, scored) {
  const vendors = ['slack', 'notion', 'amazon'];
  const table = [];
  for (const vendor of vendors) {
    const vendorRows = holdout5Rows.filter((r) => r.repo === vendor);
    const s = summaryRow(vendorRows, scored);
    table.push([vendor, s.n, s.exact, s.leaks, s.overTight, s.exactPct, s.leakPct, s.overTightPct]);
  }
  return table;
}

function findControlRow(rows, opId) {
  return rows.find((r) => r.operationId === opId);
}

function csvField(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(fields) {
  return fields.map(csvField).join(',');
}

function main() {
  const censusRows = loadCensusRows(); // set: camara, holdout1, holdout2
  const holdout3Rows = loadHoldout3() || [];
  const holdout4Rows = loadHoldout4() || [];
  const holdout5Rows = loadHoldout5() || [];

  if (holdout5Rows.length === 0) {
    console.error('ESCALATE: holdout5 loaded 0 rows — data/holdout5-2026-09-08/ missing or ground-truth.csv/operations.csv did not join.');
    process.exit(1);
  }

  const allRows = [...censusRows, ...holdout3Rows, ...holdout4Rows, ...holdout5Rows];

  const control1 = findControlRow(censusRows, 'terminateCall'); // ClickToDial DELETE /calls/{callId}
  const control2 = findControlRow(censusRows, 'updateSessionStatus'); // WebRTC PUT /sessions/{mediaSessionId}/status
  if (!control1 || !control2) {
    console.error('ESCALATE: could not find one or both negative-control rows in census-ops.csv.');
    process.exit(1);
  }

  const header = ['set', 'n', 'exact', 'leaks', 'over_tight', 'exact_pct', 'leak_pct', 'over_tight_pct'];
  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  const scoredByConfig = new Map();
  const controlsByConfig = new Map();
  let controlsEverBroken = false;

  for (const { name, opts } of CONFIGS) {
    const classify = (row) => classifyC14(row, opts);
    const scored = new Map();
    for (const row of allRows) scored.set(row, classify(row));
    scoredByConfig.set(name, scored);

    const c1Class = scored.get(control1).class;
    const c2Class = scored.get(control2).class;
    const ok = c1Class === 'x' && c2Class === 'x';
    controlsByConfig.set(name, { c1Class, c2Class, ok });
    if (!ok) controlsEverBroken = true;
  }

  // --- rows changed vs baseline, under EVERY combination (not just the
  // full one) — feeds both the doctrine check and the changed-rows CSV ---
  const baselineScored = scoredByConfig.get('baseline');
  const changedRows = []; // { config, row, before, after }
  let anyLoosened = false;
  for (const { name } of CONFIGS) {
    if (name === 'baseline') continue;
    const scored = scoredByConfig.get(name);
    for (const row of allRows) {
      const before = baselineScored.get(row);
      const after = scored.get(row);
      if (before.class === after.class && before.rule === after.rule
        && JSON.stringify(before.evidence) === JSON.stringify(after.evidence)) continue;
      if (before.class === after.class) continue; // rule/evidence-only change, not a class change
      const direction = CLASS_ORDER[after.class] > CLASS_ORDER[before.class] ? 'tightened' : 'loosened';
      if (direction === 'loosened') anyLoosened = true;
      changedRows.push({ config: name, row, before, after, direction });
    }
  }

  // --- assemble markdown ---

  push('# M1-C14 sweep: 8 switch combinations x 6 sets');
  push('');
  if (anyLoosened) {
    push('**DOCTRINE VIOLATION: at least one row LOOSENED under a switch combination.**');
    push('**This pass is supposed to be tightening-only — see the changed-rows CSV.**');
    push('');
  } else {
    push('No row loosened under any combination versus the all-switches-off baseline —');
    push('this pass stayed tightening-only, as intended.');
    push('');
  }
  push('Measurement only — nothing here is adopted. c14.classify(row) with');
  push('opts={} is proven identical to c11.classify(row) by c14.test.mjs.');
  push('');
  push(`holdout3: ${holdout3Rows.length} rows. holdout4: ${holdout4Rows.length} rows. holdout5: ${holdout5Rows.length} rows.`);
  push('');

  for (const { name, opts } of CONFIGS) {
    const scored = scoredByConfig.get(name);
    push(`## Configuration: ${name}`);
    push('');
    push(`opts: ${JSON.stringify(opts)}`);
    push('');
    push(mdTable(perSetTable(allRows, SETS, scored), header));
    push('');
    push('### hold-out 5, per vendor');
    push('');
    push(mdTable(vendorTable(holdout5Rows, scored), header));
    push('');
    const c = controlsByConfig.get(name);
    push(`Negative controls — terminateCall: ${c.c1Class}, updateSessionStatus: ${c.c2Class} — ${c.ok ? 'PASS' : 'FAIL'}`);
    if (!c.ok) push(`**ESCALATE: configuration "${name}" broke a negative control.**`);
    push('');
  }

  push('## Negative controls, all configurations');
  push('');
  const controlsTable = [];
  for (const { name } of CONFIGS) {
    const c = controlsByConfig.get(name);
    controlsTable.push([name, c.c1Class, c.c2Class, c.ok ? 'PASS' : 'FAIL']);
  }
  push(mdTable(controlsTable, ['configuration', 'terminateCall', 'updateSessionStatus', 'result']));
  push('');
  push(controlsEverBroken ? '**ESCALATE: at least one configuration broke a negative control.**' : 'PASS — both controls x in every configuration.');
  push('');

  push('## Rows changed vs baseline, across every non-baseline configuration');
  push('');
  const tightenedCount = changedRows.filter((c) => c.direction === 'tightened').length;
  const loosenedCount = changedRows.filter((c) => c.direction === 'loosened').length;
  push(`tightened: ${tightenedCount}`);
  push(`loosened: ${loosenedCount}`);
  push(`total changed rows (config x row pairs): ${changedRows.length}`);
  push('');
  push('Full row-level detail is in docs/logs/m1/c14-changed-rows.csv.');
  push('');

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD}`);

  // --- changed-rows CSV ---
  const csvLines = ['config,set,repo,method,operationId,truth,baseline_class,new_class,new_rule,new_evidence,direction'];
  for (const { config, row, before, after, direction } of changedRows) {
    csvLines.push(csvLine([
      config,
      row.set,
      row.repo,
      row.method,
      row.operationId,
      row.gt_class,
      before.class,
      after.class,
      after.rule,
      after.evidence.join('|'),
      direction,
    ]));
  }
  writeFileSync(OUT_CSV, csvLines.join('\n') + '\n');
  console.log(`Wrote ${OUT_CSV}`);

  const summaryBits = [
    `${allRows.length} rows`,
    `${CONFIGS.length} configs`,
    `${changedRows.length} changed (config,row) pairs`,
    `${tightenedCount} tightened`,
    `${loosenedCount} loosened`,
    controlsEverBroken ? 'CONTROLS FAILED' : 'controls PASS',
  ];
  console.log(`\nSUMMARY: ${summaryBits.join(', ')}`);

  if (controlsEverBroken || anyLoosened) {
    process.exit(1);
  }
}

main();
