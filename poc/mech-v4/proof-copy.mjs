// Proof: src/ (shipped v4, D138) equals the frozen reference poc/mech-v4 in output on the
// six tuning sets: same JSON verdict for every row, plus pinned scores against two truths.
// Exit 0 only if every pin holds; exit 1 otherwise. Rows without truth are counted as skipped.
// Usage: node poc/mech-v4/proof-copy.mjs [path-to-reference-flow.js]
// (the optional path swaps in a scratch copy of poc/mech-v4/flow.js to prove the proof can fail)
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { classifyRow as classifySrc } from '../../src/flow.js';
import { loadSets } from './sets.mjs';

const refPath = process.argv[2] ? path.resolve(process.argv[2]) : new URL('./flow.js', import.meta.url).pathname;
const { classifyRow: classifyRef } = await import(pathToFileURL(refPath).href);

const ord = { r: 0, w: 1, x: 2 };
const cls = (pred, truth) => (ord[pred] === ord[truth] ? 'exact' : ord[pred] < ord[truth] ? 'loose' : 'tight');
const blank = () => ({ n: 0, exact: 0, loose: 0, tight: 0 });
const bump = (m, k, c) => { const t = m.get(k) || m.set(k, blank()).get(k); t.n++; t[c]++; };
const pct = (a, n) => (100 * a / n).toFixed(1) + '%';
const line = (k, t) => `${String(k).padEnd(10)} n=${t.n} exact ${t.exact} (${pct(t.exact, t.n)}) loose ${t.loose} (${pct(t.loose, t.n)}) tight ${t.tight} (${pct(t.tight, t.n)})`;

const all = loadSets();
const loaded = new Map(), skipped = new Map();
let compared = 0, diffs = 0;
const samples = [];
const tot3 = blank(), tot4 = blank(), perSet = new Map(), perMethod = new Map();
const mtruth = new Map();
for (const s of all) {
  loaded.set(s.set, (loaded.get(s.set) || 0) + 1);
  if (!s.v3) { skipped.set(s.set, (skipped.get(s.set) || 0) + 1); continue; }
  compared++;
  const a = classifySrc(s.row), b = classifyRef(s.row);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    diffs++;
    if (samples.length < 10) samples.push({ set: s.set, id: s.id, method: s.row.method, operationId: s.row.operationId, src: a, ref: b });
  }
  const c3 = cls(b.class, s.v3), c4 = cls(b.class, s.v4);
  tot3.n++; tot3[c3]++; tot4.n++; tot4[c4]++;
  bump(perSet, s.set, c4);
  bump(perMethod, s.row.method, c4);
  const mt = mtruth.get(s.row.method) || mtruth.set(s.row.method, { r: 0, w: 0, x: 0 }).get(s.row.method);
  mt[s.v4]++;
}
let skipTotal = 0;
for (const [k, n] of loaded) { const sk = skipped.get(k) || 0; skipTotal += sk; console.log(`set ${k.padEnd(9)} loaded ${n} skipped(no truth) ${sk}`); }
console.log(`skipped total ${skipTotal}`);
console.log(`compared ${compared}`);
console.log(`differences ${diffs}`);
for (const d of samples) console.log('DIFF', JSON.stringify(d));
console.log('\nsrc verdicts vs v3 truth (original labels):', line('ALL', tot3));
console.log('src verdicts vs v4 truth (D137 labels):', line('ALL', tot4));
console.log('\nper set (v4 truth):');
for (const [k, t] of perSet) console.log(' ' + line(k, t));
console.log('\nper method (v4 truth): method, n, truth r/w/x, exact, too loose, too tight');
for (const [k, t] of [...perMethod].sort((a, b) => b[1].n - a[1].n)) {
  const m = mtruth.get(k);
  console.log(` ${String(k).padEnd(8)} n=${t.n} truth r/w/x ${m.r}/${m.w}/${m.x} exact ${t.exact} loose ${t.loose} tight ${t.tight}`);
}

const checks = [
  ['compared == 16486', compared === 16486],
  ['differences == 0', diffs === 0],
  ['skipped (no truth) == 0', skipTotal === 0],
  ['v3 truth (original labels) exact/loose/tight == 13096/119/3271', tot3.exact === 13096 && tot3.loose === 119 && tot3.tight === 3271],
  ['v4 truth (D137 labels) exact/loose/tight == 14048/421/2017', tot4.exact === 14048 && tot4.loose === 421 && tot4.tight === 2017],
];
console.log('');
let fail = false;
for (const [n, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) fail = true; }
process.exit(fail ? 1 : 0);
