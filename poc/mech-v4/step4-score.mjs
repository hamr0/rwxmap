// Step 4 measurement (GET): fixed candidate GET_ACTION used as RAISE (->x) and FLAG (stays r, marker loose).
// Measurement only. Run: node poc/mech-v4/step4-score.mjs
import fs from 'node:fs';
import { loadSets } from './sets.mjs';
import { classifyRow } from './flow.js';
import { splitTokens, stemMatches, verbForRow } from './tokens.js';

const WORDS = 'logout close connect create acquire revoke activate'.split(' ');
const RANK = { r: 0, w: 1, x: 2 };
const out = [];
const P = (s = '') => out.push(s);
const cnt = () => ({ r: 0, w: 0, x: 0 });
const isParam = (s) => s.startsWith('{') && s.endsWith('}');
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');

function matches(row) {
  const { verb } = verbForRow(row);
  const segs = String(row.path || '').split('/').filter((s) => s && !isParam(s));
  const pieces = segs.length ? segs[segs.length - 1].split('#').map(splitTokens).filter((t) => t.length) : [];
  const res = [];
  for (const word of WORDS) {
    let where = null;
    if (verb && stemMatches(verb, word)) where = 'lead-verb';
    else if (pieces.some((toks) => toks.some((t) => stemMatches(t, word)))) where = 'last-segment';
    if (where) res.push({ word, where });
  }
  return res;
}

const gets = loadSets().filter((s) => s.v4 && String(s.row.method || '').toUpperCase() === 'GET').map((s) => {
  const cur = classifyRow(s.row);
  return { set: s.set, id: s.id, row: s.row, truth: s.v4, cur, vendor: s.row.provider, m: matches(s.row) };
});

P('== 1) GET pile ==');
const tc = cnt(); for (const r of gets) tc[r.truth]++;
P(`  n=${gets.length} truth r=${tc.r} w=${tc.w} x=${tc.x}`);
const clsC = cnt(); const mkC = {}; for (const r of gets) { clsC[r.cur.class]++; mkC[r.cur.review] = (mkC[r.cur.review] || 0) + 1; }
P(`  current class r=${clsC.r} w=${clsC.w} x=${clsC.x}; markers ${JSON.stringify(mkC)}`);
const okPile = gets.length === 6283 && tc.r === 6271 && tc.w === 3 && tc.x === 9;
P(`  assert n=6283, r/w/x=6271/3/9: ${okPile ? 'OK' : 'FAIL'}`);
const leaks = gets.filter((r) => RANK[r.truth] > RANK[r.cur.class]);
P(`  current leaks (${leaks.length}):`);
for (const r of leaks) P(`    [${r.set}] ${r.id} | ${r.vendor} | ${r.row.path} | ${r.row.operationId} | truth=${r.truth} cls=${r.cur.class} | fired=${r.m.map((m) => m.word + '/' + m.where).join(',') || '-'}`);
P();

P('== 2) Per word, fitted (NOT quotable) ==');
P('  word       fires  r    w    x   vendors(x|w fire)  top-vendor-share');
const stats = (pile) => {
  const m = new Map(WORDS.map((w) => [w, { c: cnt(), v: new Map(), xw: new Set() }]));
  for (const r of pile) for (const b of r.m) { const e = m.get(b.word); e.c[r.truth]++; e.v.set(r.vendor, (e.v.get(r.vendor) || 0) + 1); if (r.truth !== 'r') e.xw.add(r.vendor); }
  return m;
};
const full = stats(gets);
for (const w of WORDS) {
  const e = full.get(w); const n = e.c.r + e.c.w + e.c.x;
  const top = [...e.v].sort((a, b) => b[1] - a[1])[0];
  P(`  ${w.padEnd(9)} ${String(n).padStart(5)} ${String(e.c.r).padStart(4)} ${String(e.c.w).padStart(4)} ${String(e.c.x).padStart(4)} ${String(e.xw.size).padStart(8)}   ${top ? `${pct(top[1], n)} (${top[0]} ${top[1]}/${n})` : 'n/a'}`);
}
const fired = gets.filter((r) => r.m.length);
const fc = cnt(); for (const r of fired) fc[r.truth]++;
P(`  rows fired (any word): ${fired.length} truth r=${fc.r} w=${fc.w} x=${fc.x}`);
P();

P('== 3) RAISE (fired -> x), LOVO by vendor (admit iff others: fires on truth x > fires on truth r) ==');
const vendors = [...new Set(gets.map((r) => r.vendor))];
const admitted = new Map();
for (const v of vendors) {
  const m = stats(gets.filter((r) => r.vendor !== v));
  admitted.set(v, new Set(WORDS.filter((w) => m.get(w).c.x > m.get(w).c.r)));
}
P(`  folds (vendors with GET rows): ${vendors.length}`);
for (const w of WORDS) P(`  ${w.padEnd(9)} admitted in ${[...admitted.values()].filter((s) => s.has(w)).length}/${vendors.length} folds`);
const tally = (isAdm) => {
  const t = { closed: 0, wRaised: 0, rRaised: 0, rows: [] };
  for (const r of gets) {
    const hit = r.m.find((b) => isAdm(r.vendor, b.word));
    if (!hit) continue;
    r.hit = hit; t.rows.push(r);
    if (r.truth === 'x') t.closed++; else if (r.truth === 'w') t.wRaised++; else t.rRaised++;
  }
  return t;
};
const lov = tally((v, w) => admitted.get(v).has(w));
const nLeaks = leaks.length;
P(`  LOVO: rows raised to x ${lov.rows.length}; leaks closed x->x (two-step fixed) ${lov.closed}; w rows raised to x (loose-1 -> too tight by one) ${lov.wRaised}; r rows raised to x (new two-step too tight) ${lov.rRaised}; leaks left ${nLeaks - lov.closed - lov.wRaised} of ${nLeaks} (a w row raised to x stops being a leak)`);
const fitAdm = new Set(WORDS.filter((w) => full.get(w).c.x > full.get(w).c.r));
const fit = tally((v, w) => fitAdm.has(w));
P(`  fitted (NOT quotable): admitted ${[...fitAdm].join(' ') || '(none)'}; raised ${fit.rows.length}; closed ${fit.closed}; w raised ${fit.wRaised}; r raised ${fit.rRaised}; leaks left ${nLeaks - fit.closed - fit.wRaised} of ${nLeaks}`);
lov.rows.forEach((r) => { r.lovoHit = true; });
P();

P('== 4) FLAG (fired GET stays r, marker loose; no LOVO) ==');
const flagged = fired;
const flaggedLeaks = flagged.filter((r) => RANK[r.truth] > RANK[r.cur.class]);
const falseFlags = flagged.filter((r) => r.truth === 'r');
P(`  flagged rows ${flagged.length}; of ${nLeaks} leaks flagged loose: ${flaggedLeaks.length}; false flags (truth r) ${falseFlags.length}; share of flagged that are real leaks ${flaggedLeaks.length}/${flagged.length} = ${pct(flaggedLeaks.length, flagged.length)}`);
const curSettled = flagged.filter((r) => r.cur.review === 'settled').length;
P(`  of flagged rows currently marked settled: ${curSettled}/${flagged.length}`);
P();

P('== 5) All rows fired, verbatim ==');
const tsv = ['set\tid\tprovider\tpath\toperationId\ttruth\tword\twhere'];
for (const r of fired) for (const b of r.m) {
  const line = [r.set, r.id, r.vendor, r.row.path, r.row.operationId, r.truth, b.word, b.where];
  tsv.push(line.join('\t'));
  P(`  [${r.set}] ${r.id} | ${r.vendor} | ${r.row.path} | ${r.row.operationId} | truth=${r.truth} | word=${b.word} (${b.where})`);
}
P(`  (${fired.length} rows, ${tsv.length - 1} word fires)`);

const here = new URL('./', import.meta.url);
fs.writeFileSync(new URL('step4-readout.txt', here), out.join('\n') + '\n');
fs.writeFileSync(new URL('step4-fires.tsv', here), tsv.join('\n') + '\n');
console.log(out.join('\n'));
process.exit(okPile ? 0 : 1);
