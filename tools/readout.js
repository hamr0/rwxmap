// Debugging readout for the whole flow — run with: node tools/readout.js
// Runs src/'s ladder over all 4171 corpus rows and writes the 12-column
// sheet run-proof/readout.csv, one line per operation, so a human can read
// what the classifier did row by row. Prints a per-step-per-source ledger
// afterwards. Test/dev tooling only — never part of the published library.
//
// This asserts nothing and pins nothing: tools/proof-flow.js owns the pins.
// It writes its own file and leaves run-proof/step3.csv (the frozen POC's
// product) and run-proof/flow.csv (the retired core's evidence) untouched.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadRows } from './corpus.js';
import { toCsv } from './csv.js';
import { classifyRow } from '../src/flow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_CSV = path.join(REPO_ROOT, 'run-proof/readout.csv');

const HEADER = ['provider', 'method', 'path', 'operationId', 'summary', 'truth',
  'confidence', 'class', 'step', 'rule', 'source', 'matched'];

/** r < w < x — the one ordering the whole project runs on. */
const ORDER = { r: 0, w: 1, x: 2 };

const rows = loadRows();
const flow = rows.map((row) => ({ row, hit: classifyRow(row) }));

mkdirSync(path.dirname(OUT_CSV), { recursive: true });
writeFileSync(OUT_CSV, toCsv(flow.map(({ row, hit }) => ({
  provider: row.provider,
  method: row.method,
  path: row.path,
  operationId: row.operationId,
  summary: row.summary,
  truth: row.truth,
  confidence: row.confidence,
  class: hit.class,
  step: hit.step,
  rule: hit.rule,
  source: hit.source,
  // A floor row matched nothing, so its cell is empty.
  matched: hit.matched.join('+'),
})), HEADER));
console.log(`wrote ${path.relative(REPO_ROOT, OUT_CSV)} (${flow.length} rows)`);

/**
 * Count claims / right / leaks / over-tight for one slice of the flow.
 * @param {Array<{row:{truth:string}, hit:{class:string}}>} pool
 * @returns {{claims:number, right:number, leaks:number, over:number}}
 */
function ledger(pool) {
  return {
    claims: pool.length,
    right: pool.filter(({ row, hit }) => hit.class === row.truth).length,
    leaks: pool.filter(({ row, hit }) => ORDER[hit.class] < ORDER[row.truth]).length,
    over: pool.filter(({ row, hit }) => ORDER[hit.class] > ORDER[row.truth]).length,
  };
}

const lines = [];
for (const step of [1, 2, 3]) {
  for (const source of ['list', 'floor']) {
    const l = ledger(flow.filter(({ hit }) => hit.step === step && hit.source === source));
    lines.push([`step ${step} ${source}`, l.claims, l.right, l.leaks, l.over]);
  }
}
const whole = ledger(flow);
lines.push(['WHOLE FLOW', whole.claims, whole.right, whole.leaks, whole.over]);

const head = ['scope', 'claims', 'right', 'leaks', 'over-tight'];
const widths = head.map((h, i) =>
  Math.max(h.length, ...lines.map((l) => String(l[i]).length)));
const render = (cells) => cells
  .map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i])))
  .join('  ');
console.log('\n' + render(head));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
for (const l of lines) console.log(render(l));
