// M1-C15 sweep: scores c15.mjs (both noTextRaise settings) against c11.mjs
// across all six sets, with a per-METHOD breakdown (the whole point of the
// per-method-floor shape), an evidence-vs-floor split, and the PUT/DELETE/
// PATCH "review pile" (floor:true rows there — measured, not decided, how
// many of those are truly x).
//
// This is a MEASUREMENT run. It adopts nothing and writes no default
// behaviour change to c11.mjs/judge.mjs/arbiter.mjs/c15.mjs.
//
// How to re-run: node poc/m1/arbiter/run-c15.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { CLASS_ORDER } from './arbiter.mjs';
import { classify as classifyC11 } from './c11.mjs';
import { classify as classifyC15 } from './c15.mjs';
import {
  REPO_ROOT,
  loadCensusRows,
  loadHoldout3,
  loadHoldout4,
  loadHoldout5,
} from './load-sets.mjs';

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c15-sweep.md');
const OUT_CSV = path.join(REPO_ROOT, 'docs/logs/m1/c15-leaks.csv');

const SETS = ['camara', 'holdout1', 'holdout2', 'holdout3', 'holdout4', 'holdout5'];
const METHODS = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE', 'PATCH'];

const CONFIGS = [
  { name: 'c11', classify: (row) => classifyC11(row) },
  { name: 'c15 (noTextRaise off)', classify: (row) => classifyC15(row, {}) },
  { name: 'c15 (noTextRaise on)', classify: (row) => classifyC15(row, { noTextRaise: true }) },
];

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

function summaryTableRow(label, setRows, scored) {
  const s = summaryRow(setRows, scored);
  return [label, s.n, s.exact, s.leaks, s.overTight, s.exactPct, s.leakPct, s.overTightPct];
}

function perSetTable(rows, sets, scored) {
  const table = sets.map((setName) => summaryTableRow(setName, rows.filter((r) => r.set === setName), scored));
  table.push(summaryTableRow('all', rows, scored));
  return table;
}

function perMethodTable(rows, methods, scored) {
  const table = methods
    .map((m) => [m, rows.filter((r) => r.method === m)])
    .filter(([, methodRows]) => methodRows.length > 0)
    .map(([m, methodRows]) => summaryTableRow(m, methodRows, scored));
  table.push(summaryTableRow('all', rows, scored));
  return table;
}

function evidenceFloorTable(rows, scored) {
  const evidenceRows = rows.filter((r) => scored.get(r).floor === false);
  const floorRows = rows.filter((r) => scored.get(r).floor === true);
  return [
    summaryTableRow('evidence', evidenceRows, scored),
    summaryTableRow('floor', floorRows, scored),
  ];
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
  const methodHeader = ['method', 'n', 'exact', 'leaks', 'over_tight', 'exact_pct', 'leak_pct', 'over_tight_pct'];
  const efHeader = ['bucket', 'n', 'exact', 'leaks', 'over_tight', 'exact_pct', 'leak_pct', 'over_tight_pct'];

  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  const scoredByConfig = new Map();
  const controlsByConfig = new Map();
  let controlsEverBroken = false;

  for (const { name, classify } of CONFIGS) {
    const scored = new Map();
    for (const row of allRows) scored.set(row, classify(row));
    scoredByConfig.set(name, scored);

    const c1Class = scored.get(control1).class;
    const c2Class = scored.get(control2).class;
    const ok = c1Class === 'x' && c2Class === 'x';
    controlsByConfig.set(name, { c1Class, c2Class, ok });
    if (!ok) controlsEverBroken = true;
  }

  push('# M1-C15 sweep: per-method-floor arbiter vs c11');
  push('');
  push('Measurement only — nothing here is adopted.');
  push('');
  push(`camara+holdout1+holdout2 (census): ${censusRows.length} rows. holdout3: ${holdout3Rows.length} rows. holdout4: ${holdout4Rows.length} rows. holdout5: ${holdout5Rows.length} rows. all: ${allRows.length} rows.`);
  push('');

  // --- per-set + per-method + evidence/floor tables, per configuration ----
  for (const { name } of CONFIGS) {
    const scored = scoredByConfig.get(name);
    push(`## Configuration: ${name}`);
    push('');
    push('### Per set');
    push('');
    push(mdTable(perSetTable(allRows, SETS, scored), header));
    push('');
    push('### Per method (all sets pooled)');
    push('');
    push(mdTable(perMethodTable(allRows, METHODS, scored), methodHeader));
    push('');
    push('### Evidence vs floor');
    push('');
    push(mdTable(evidenceFloorTable(allRows, scored), efHeader));
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

  // --- review pile: floor:true rows on PUT/DELETE/PATCH, per c15 config --
  push('## Review pile: floor:true rows on PUT/DELETE/PATCH');
  push('');
  const reviewPileTable = [];
  const csvLines = ['config,set,repo,method,operationId,truth,predicted,rule,evidence,label'];
  const allLeaksByConfig = new Map();

  for (const { name } of CONFIGS) {
    const scored = scoredByConfig.get(name);
    const raiseMethodRows = allRows.filter((r) => r.method === 'PUT' || r.method === 'DELETE' || r.method === 'PATCH');
    const reviewRows = raiseMethodRows.filter((r) => scored.get(r).floor === true);
    const trulyX = reviewRows.filter((r) => r.gt_class === 'x').length;
    reviewPileTable.push([name, reviewRows.length, trulyX]);

    // --- leak listing for this config ---
    const leaks = [];
    for (const row of allRows) {
      const result = scored.get(row);
      if (kindOf(result.class, row.gt_class) !== 'leak') continue;
      const label = (row.gt_class === 'x' && result.class === 'w') ? 'x-dressed-as-w' : '';
      leaks.push({ row, result, label });
      csvLines.push(csvLine([
        name, row.set, row.repo, row.method, row.operationId, row.gt_class, result.class,
        result.rule, result.evidence.join('|'), label,
      ]));
    }
    allLeaksByConfig.set(name, leaks);
  }
  push(mdTable(reviewPileTable, ['configuration', 'review_pile_n', 'truly_x']));
  push('');

  // --- full leak listing, per config ---
  push('## Leaks, full listing');
  push('');
  for (const { name } of CONFIGS) {
    const leaks = allLeaksByConfig.get(name);
    push(`### ${name} — ${leaks.length} leak(s)`);
    push('');
    if (leaks.length === 0) {
      push('(none)');
      push('');
      continue;
    }
    const leakTable = leaks.map(({ row, result, label }) => [
      row.set, row.method, row.operationId, row.gt_class, result.class, result.rule, label || '',
    ]);
    push(mdTable(leakTable, ['set', 'method', 'operationId', 'truth', 'predicted', 'rule', 'label']));
    push('');
  }

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD}`);

  writeFileSync(OUT_CSV, csvLines.join('\n') + '\n');
  console.log(`Wrote ${OUT_CSV}`);

  const c15OffLeaks = allLeaksByConfig.get('c15 (noTextRaise off)').length;
  const summaryBits = [
    `${allRows.length} rows`,
    `${CONFIGS.length} configs`,
    `c15(noTextRaise off) leaks=${c15OffLeaks}`,
    controlsEverBroken ? 'CONTROLS FAILED' : 'controls PASS',
  ];
  console.log(`\nSUMMARY: ${summaryBits.join(', ')}`);

  if (controlsEverBroken) {
    process.exit(1);
  }
}

main();
