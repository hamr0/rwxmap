// v3 (src/flow.js) vs v4 (poc/mech-v4/flow.js) on every labelled row, scored against v4 truth.
import fs from 'node:fs';
import { loadSets } from './sets.mjs';
import { classifyRow as c3 } from '../../src/flow.js';
import { classifyRow as c4 } from './flow.js';

const RANK = { r: 0, w: 1, x: 2 };
const bucket = (cls, truth) => {
  const d = RANK[truth] - RANK[cls];
  return d === 0 ? 'exact' : d === 1 ? 'loose1' : d === 2 ? 'loose2' : 'tight';
};
const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'others'];
const methodOf = (m) => { const u = String(m || '').toUpperCase(); return METHODS.includes(u) ? u : 'others'; };
const MARKERS = ['tight', 'loose', 'settled'];

const rows = loadSets().filter((s) => s.v4).map((s) => {
  const a = c3(s.row), b = c4(s.row);
  return { set: s.set, id: s.id, row: s.row, truth: s.v4, method: methodOf(s.row.method), a, b, ba: bucket(a.class, s.v4), bb: bucket(b.class, s.v4) };
});

const out = [];
const P = (s = '') => out.push(s);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
const n = rows.length;

P('== a) totals (scored against v4 truth) ==');
const tot = (k) => {
  const c = { exact: 0, loose1: 0, loose2: 0, tight: 0 };
  for (const r of rows) c[r[k]]++;
  return c;
};
const ta = tot('ba'), tb = tot('bb');
P(`n=${n}`);
for (const [name, t] of [['v3', ta], ['v4', tb]]) {
  const loose = t.loose1 + t.loose2;
  P(`${name}: exact=${t.exact} (${pct(t.exact, n)}) loose-1=${t.loose1} (${pct(t.loose1, n)}) loose-2=${t.loose2} (${pct(t.loose2, n)}) too-loose-total=${loose} (${pct(loose, n)}) too-tight=${t.tight} (${pct(t.tight, n)})`);
}
P();

P('== b) per method (v3 | v4): n, exact, loose-1, loose-2, tight ==');
for (const m of METHODS) {
  const rs = rows.filter((r) => r.method === m);
  const f = (k) => { const c = { exact: 0, loose1: 0, loose2: 0, tight: 0 }; for (const r of rs) c[r[k]]++; return `exact=${c.exact} loose-1=${c.loose1} loose-2=${c.loose2} tight=${c.tight}`; };
  P(`${m.padEnd(7)} n=${rs.length}  v3: ${f('ba')}  |  v4: ${f('bb')}`);
}
P();

P('== c) marker table: method x marker (n, exact, too loose, too tight) ==');
const markerTable = (name, cls, k) => {
  P(`-- ${name}`);
  for (const m of METHODS) for (const mk of MARKERS) {
    const rs = rows.filter((r) => r.method === m && r[cls].review === mk);
    if (!rs.length) continue;
    const ex = rs.filter((r) => r[k] === 'exact').length;
    const lo = rs.filter((r) => r[k] === 'loose1' || r[k] === 'loose2').length;
    const ti = rs.filter((r) => r[k] === 'tight').length;
    P(`  ${m.padEnd(7)} ${mk.padEnd(8)} n=${rs.length} exact=${ex} too-loose=${lo} too-tight=${ti}`);
  }
  const loose = rows.filter((r) => r[k] === 'loose1' || r[k] === 'loose2');
  const tight = rows.filter((r) => r[k] === 'tight');
  const nl = loose.filter((r) => r[cls].review !== 'settled').length;
  const nt = tight.filter((r) => r[cls].review !== 'settled').length;
  P(`  too-loose rows carrying a non-settled marker: ${nl}/${loose.length} (${pct(nl, loose.length)})`);
  P(`  too-tight rows carrying a non-settled marker: ${nt}/${tight.length} (${pct(nt, tight.length)})`);
};
markerTable('v3', 'a', 'ba');
markerTable('v4', 'b', 'bb');
P();

P('== d) class changes v3 -> v4 ==');
const changed = rows.filter((r) => r.a.class !== r.b.class);
P(`rows changed: ${changed.length}`);
const groups = new Map();
for (const r of changed) {
  const key = `${r.method} ${r.a.class}->${r.b.class}`;
  if (!groups.has(key)) groups.set(key, { x: 0, w: 0, r: 0 });
  groups.get(key)[r.truth]++;
}
for (const [k, g] of [...groups].sort()) P(`  ${k}: n=${g.x + g.w + g.r} truth x=${g.x} w=${g.w} r=${g.r}`);
const hdr = ['set', 'id', 'provider', 'method', 'path', 'v3_class', 'v3_rule', 'v4_class', 'v4_rule', 'v4_matched', 'truth'];
const tsv = [hdr.join('\t'), ...changed.map((r) => [r.set, r.id, r.row.provider, r.row.method, r.row.path, r.a.class, r.a.rule, r.b.class, r.b.rule, (r.b.matched || []).join('|'), r.truth].join('\t'))];
fs.writeFileSync(new URL('./score-v4-changes.tsv', import.meta.url), tsv.join('\n') + '\n');
P('full list: poc/mech-v4/score-v4-changes.tsv');
P();

P('== e) marker changes v3 -> v4 (by method) ==');
const mc = new Map();
for (const r of rows) {
  if (r.a.review === r.b.review) continue;
  const key = `${r.method} ${r.a.review}->${r.b.review}`;
  mc.set(key, (mc.get(key) || 0) + 1);
}
for (const [k, v] of [...mc].sort()) P(`  ${k}: ${v}`);
P(`  total rows with a changed marker: ${[...mc.values()].reduce((a, b) => a + b, 0)}`);
P();

P('== asserts ==');
let fail = false;
const check = (name, ok) => { if (!ok) fail = true; P(`${ok ? 'PASS' : 'FAIL'}: ${name}`); };
check('n == 16486', n === 16486);
check('only PUT/PATCH/POST rows change class', changed.every((r) => ['PUT', 'PATCH', 'POST'].includes(r.method)));
check("every PUT/PATCH class change is w->x rule path-x-word", changed.filter((r) => r.method !== 'POST').every((r) => r.a.class === 'w' && r.b.class === 'x' && r.b.rule === 'path-x-word'));
check("every POST class change is w->x rule path-x-word or x->w rule content-noun", changed.filter((r) => r.method === 'POST').every((r) => (r.a.class === 'w' && r.b.class === 'x' && r.b.rule === 'path-x-word') || (r.a.class === 'x' && r.b.class === 'w' && r.b.rule === 'content-noun')));
check('no GET/HEAD/DELETE row changes class or marker', rows.every((r) => !['GET', 'HEAD', 'DELETE'].includes(r.method) || (r.a.class === r.b.class && r.a.review === r.b.review)));

const text = out.join('\n') + '\n';
fs.writeFileSync(new URL('./score-v4-readout.txt', import.meta.url), text);
console.log(text);
process.exit(fail ? 1 : 0);
