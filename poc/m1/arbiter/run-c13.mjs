// M1-C13 measurement pass: scores c13.classify across eight opts
// configurations (baseline, B, A, C, A+B, A+C, B+C, A+B+C) against all six
// sets (camara, holdout1, holdout2, holdout3, holdout4, holdout5), so the
// three hold-out-5 fixes can be reported on numbers, not assertion. This is
// a MEASUREMENT run — it adopts nothing and writes no default behaviour
// change to c11.mjs/judge.mjs/arbiter.mjs.
//
// How to re-run: node poc/m1/arbiter/run-c13.mjs
import { writeFileSync } from 'node:fs';
import { CLASS_ORDER } from './arbiter.mjs';
import { classify as classifyC13 } from './c13.mjs';
import {
  loadCensusRows,
  loadHoldout3,
  loadHoldout4,
  loadHoldout5,
} from './load-sets.mjs';

const RESULTS_PATH = '/tmp/claude-1000/-home-hamr-PycharmProjects-rwxmap/960d60ce-3202-4373-b6af-7eea710c4449/scratchpad/c13-results.md';

const CONFIGS = [
  { name: 'baseline', opts: {} },
  { name: 'B (textFallback)', opts: { textFallback: true } },
  { name: 'A (readGet)', opts: { readGet: true } },
  { name: 'C (stem)', opts: { stem: true } },
  { name: 'A+B', opts: { readGet: true, textFallback: true } },
  { name: 'A+C', opts: { readGet: true, stem: true } },
  { name: 'B+C', opts: { textFallback: true, stem: true } },
  { name: 'A+B+C', opts: { readGet: true, textFallback: true, stem: true } },
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

function findControlRow(rows, opId) {
  return rows.find((r) => r.operationId === opId);
}

function main() {
  const censusRows = loadCensusRows(); // carries set: camara, holdout1, holdout2
  const holdout3Rows = loadHoldout3() || [];
  const holdout4Rows = loadHoldout4() || [];
  const holdout5Rows = loadHoldout5() || [];

  if (holdout5Rows.length === 0) {
    console.error('ESCALATE: holdout5 loaded 0 rows — data/holdout5-2026-09-08/ missing or ground-truth.csv/operations.csv did not join.');
    process.exit(1);
  }

  const allRows = [...censusRows, ...holdout3Rows, ...holdout4Rows, ...holdout5Rows];
  const sets = ['camara', 'holdout1', 'holdout2', 'holdout3', 'holdout4', 'holdout5'];

  const control1 = findControlRow(censusRows, 'terminateCall'); // ClickToDial DELETE /calls/{callId}
  const control2 = findControlRow(censusRows, 'updateSessionStatus'); // WebRTC PUT /sessions/{mediaSessionId}/status
  if (!control1 || !control2) {
    console.error('ESCALATE: could not find one or both negative-control rows in census-ops.csv.');
    process.exit(1);
  }

  const header = ['set', 'n', 'exact', 'leaks', 'over_tight', 'exact_pct', 'leak_pct', 'over_tight_pct'];
  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  push('# M1-C13 measurement pass: 8 configurations x 6 sets');
  push('');
  push('Measurement only — nothing here is adopted. c13.classify(row, opts) with');
  push('opts={} is proven identical to c11.classify(row) by c13.test.mjs.');
  push('');

  const scoredByConfig = new Map();
  const controlsByConfig = new Map();
  let controlsEverBroken = false;

  for (const { name, opts } of CONFIGS) {
    const classify = (row) => classifyC13(row, opts);
    const scored = new Map();
    for (const row of allRows) scored.set(row, classify(row));
    scoredByConfig.set(name, scored);

    const c1Class = scored.get(control1).class;
    const c2Class = scored.get(control2).class;
    const ok = c1Class === 'x' && c2Class === 'x';
    controlsByConfig.set(name, { c1Class, c2Class, ok });
    if (!ok) controlsEverBroken = true;

    push(`## Configuration: ${name}`);
    push('');
    push(`opts: ${JSON.stringify(opts)}`);
    push('');
    push(mdTable(perSetTable(allRows, sets, scored), header));
    push('');
    push(`Negative controls — terminateCall: ${c1Class}, updateSessionStatus: ${c2Class} — ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) push(`**ESCALATE: configuration "${name}" broke a negative control.**`);
    push('');
  }

  // --- remaining leaks under the full combination (A+B+C) -----------------
  const fullScored = scoredByConfig.get('A+B+C');
  const remainingLeaks = [];
  for (const row of allRows) {
    const result = fullScored.get(row);
    if (kindOf(result.class, row.gt_class) === 'leak') {
      remainingLeaks.push([row.repo, row.method, row.operationId, row.gt_class, result.class]);
    }
  }
  push('## Remaining leaks under A+B+C (full combination)');
  push('');
  if (remainingLeaks.length === 0) {
    push('None.');
  } else {
    push(mdTable(remainingLeaks, ['repo', 'method', 'operationId', 'truth', 'predicted']));
  }
  push('');

  // --- rows changed vs baseline, for A+B+C ---------------------------------
  const baselineScored = scoredByConfig.get('baseline');
  let tightened = 0, loosened = 0;
  for (const row of allRows) {
    const before = baselineScored.get(row).class;
    const after = fullScored.get(row).class;
    if (before === after) continue;
    if (CLASS_ORDER[after] > CLASS_ORDER[before]) tightened += 1;
    else loosened += 1;
  }
  push('## Rows changed vs baseline (A+B+C full combination)');
  push('');
  push(`tightened: ${tightened}`);
  push(`loosened: ${loosened}`);
  push(`total changed: ${tightened + loosened}`);
  push('');

  // --- controls summary table ----------------------------------------------
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

  writeFileSync(RESULTS_PATH, lines.join('\n') + '\n');
  console.log(`\nWrote ${RESULTS_PATH}`);

  if (controlsEverBroken) {
    process.exit(1);
  }
}

main();
