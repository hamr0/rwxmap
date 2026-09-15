import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from '../flow/csv.mjs';
import { loadRows } from '../flow/corpus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const D = path.join(ROOT, 'data', 'calibration-2026-09-15') + path.sep;

const argv = process.argv.slice(2);
const SET = argv.includes('holdback') ? 'holdback' : argv.includes('v2') ? 'v2' : 'v1';
console.log(`set: ${SET}`);

const { rows } = loadRows();
const key = new Map(parseCsv(readFileSync(D + 'postcal-key.csv', 'utf8')).map(k => [k.row_id, k]));

const parts = SET === 'holdback' ? [''] : [1, 2];
const labelFile = n => SET === 'holdback' ? D + 'postcal-holdback-labels.csv'
  : SET === 'v2' ? D + `postcal-v2-labels-part${n}.csv`
  : D + `postcal-labels-part${n}.csv`;
const blindFile = n => SET === 'holdback' ? D + 'postcal-holdback-blind.csv' : D + `postcal-blind-part${n}.csv`;

const labels = [];
for (const n of parts) {
  const p = labelFile(n);
  if (!existsSync(p)) throw new Error(`missing ${p}`);
  const blind = parseCsv(readFileSync(blindFile(n), 'utf8'));
  const lab = parseCsv(readFileSync(p, 'utf8'));
  if (lab.length !== blind.length) throw new Error(`part ${n}: ${lab.length} labels vs ${blind.length} rows`);
  lab.forEach((l, i) => {
    if (l.row_id !== blind[i].row_id) throw new Error(`part ${n} row ${i} id mismatch`);
    if (!['high', 'low'].includes(l.confidence)) throw new Error(`part ${n} bad confidence ${l.confidence}`);
    if (!['r', 'w', 'x', '?'].includes(l.truth_class)) throw new Error(`part ${n} bad truth_class ${l.truth_class}`);
    const k = key.get(l.row_id);
    if (!k) throw new Error(`part ${n} row ${l.row_id}: no key entry`);
    const isHoldback = k.split === 'holdback';
    if (SET === 'holdback' && !isHoldback) throw new Error(`row ${l.row_id}: split ${k.split} is not holdback`);
    if (SET !== 'holdback' && isHoldback) throw new Error(`row ${l.row_id}: split holdback must not appear in ${SET}`);
    labels.push({ l, b: blind[i] });
  });
}

const conf = {}, sheet = { r: 0, w: 0, x: 0, '?': 0 }, truth = { r: 0, w: 0, x: 0 };
let agree = 0, n = 0;
const byV = {};
const off = [];
for (const { l, b } of labels) {
  const k = key.get(l.row_id);
  const t = rows[Number(k.corpus_index)];
  if (t.method !== 'POST' || t.path !== b.path || (t.operationId || '') !== (b.operationId || '')) {
    throw new Error(`row ${l.row_id} does not match corpus_index ${k.corpus_index}`);
  }
  sheet[l.truth_class]++;
  if (l.truth_class === '?') continue;
  n++;
  truth[t.gt_class]++;
  const c = `${t.gt_class}->${l.truth_class}`;
  conf[c] = (conf[c] || 0) + 1;
  if (t.gt_class === l.truth_class) agree++;
  const v = byV[t.vendor] = byV[t.vendor] || { n: 0, agree: 0, tx: 0, sx: 0 };
  v.n++;
  if (t.gt_class === l.truth_class) v.agree++;
  if (t.gt_class === 'x') v.tx++;
  if (l.truth_class === 'x') v.sx++;
  if (t.gt_class !== l.truth_class) {
    off.push({ c, v: t.vendor, op: b.operationId, s: (b.summary || b.description || '').slice(0, 70), conf: l.confidence, why: l.reason });
  }
}

console.log(`labelled ${labels.length}, scorable ${n}, '?' ${sheet['?']}`);
console.log(`agree ${agree}/${n} = ${(100 * agree / n).toFixed(1)}%   (write-row bar: 185/200 = 92.5%)`);
console.log(`x-share: corpus truth ${(100 * truth.x / n).toFixed(1)}%  sheet ${(100 * sheet.x / n).toFixed(1)}%   | exam 5 POST sheet x-share 12.0%`);
console.log('truth mix', truth, ' sheet mix', sheet);
console.log('confusion', conf);
console.log('\nper vendor: n, agree, truth x, sheet x');
for (const [v, o] of Object.entries(byV).sort((a, b) => b[1].n - a[1].n)) {
  console.log(v.padEnd(12), String(o.n).padStart(3), 'agree', String(o.agree).padStart(3), `(${(100 * o.agree / o.n).toFixed(0)}%)`, 'truth x', String(o.tx).padStart(3), 'sheet x', String(o.sx).padStart(3));
}
if (argv.includes('rows')) {
  console.log('\n--- disagreements');
  for (const o of off.sort((a, b) => a.c.localeCompare(b.c) || a.v.localeCompare(b.v))) {
    console.log(`${o.c} ${o.conf} | ${o.v} | ${o.op} | ${o.s} || ${o.why}`);
  }
}
