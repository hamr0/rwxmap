// v4 pass: apply the user's 2026-11-06 group rulings to the disagree rows.
// Usage: node poc/v4-pass/settle.mjs  (no args; reads disagree-rows.csv + rulings.csv)
import fs from 'node:fs';
import { parseCsv, toCsv } from '../../tools/csv.js';

const DIR = new URL('../../data/pass-v4-2026-11-05/suspects/disagree/', import.meta.url).pathname;
const SRC = 'user 2026-11-06';
const spec = {
  sonnet: 'G03 G07 G08 G10 G11 G13 G14 G15 G17 G19 G20 G21 G22 G23 G25 G26 G27 G28 G31 G33',
  x: 'G02 G05 G09 G12 G32 G34',
  w: 'G16 G18 G24 G29 G30',
  pending: 'G01 G04 G06',
};
const ruling = {};
for (const [r, ids] of Object.entries(spec)) for (const g of ids.split(' ')) ruling[g] = r;

const rows = parseCsv(fs.readFileSync(DIR + 'disagree-rows.csv', 'utf8'));
const rowRulings = parseCsv(fs.readFileSync(DIR + 'rulings.csv', 'utf8'));
const key = (r) => r.row_id + '|' + r.pass_id;
const override = new Map(rowRulings.map((r) => [key(r), r]));

const groups = [...new Set(rows.map((r) => r.group_id))].sort();
const unruled = groups.filter((g) => !ruling[g]);
if (unruled.length) console.log('WARNING groups with no ruling:', unruled.join(' '));
const missing = Object.keys(ruling).filter((g) => !groups.includes(g));
if (missing.length) console.log('NOTE ruled groups absent from rows:', missing.join(' '));

// group-rulings.csv
const grows = groups.filter((g) => ruling[g]).map((g) => ({ group_id: g, ruling: ruling[g], source: SRC }));
fs.writeFileSync(DIR + 'group-rulings.csv', toCsv(grows, ['group_id', 'ruling', 'source']));

// settled + pending
const settled = [];
const pending = [];
const overrideLog = [];
const seen = new Set();
for (const r of rows) {
  const k = key(r);
  const ov = override.get(k);
  const gr = ruling[r.group_id];
  let groupClass = null;
  if (gr === 'sonnet') groupClass = r.sonnet_class;
  else if (gr === 'x' || gr === 'w') groupClass = gr;
  if (ov) {
    seen.add(k);
    settled.push({ row_id: r.row_id, pass_id: r.pass_id, group_id: r.group_id, final_class: ov.ruled_class, source: 'row-ruling' });
    overrideLog.push({ r, groupRuling: gr, groupClass, ruled: ov.ruled_class });
  } else if (gr === 'pending' || !gr) {
    pending.push(r);
  } else {
    settled.push({ row_id: r.row_id, pass_id: r.pass_id, group_id: r.group_id, final_class: groupClass, source: 'group' });
  }
}
fs.writeFileSync(DIR + 'settled.csv', toCsv(settled, ['row_id', 'pass_id', 'group_id', 'final_class', 'source']));

// verb / noun
function words(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}
function lastPart(s) {
  const i = s.lastIndexOf('.');
  if (i < 0) return s;
  const tail = s.slice(i + 1);
  return tail === '' ? s : tail;
}
function verbNoun(r) {
  for (const src of [r.operationId, r.path]) {
    if (src && src.trim()) {
      const w = words(lastPart(src));
      if (w.length) return mk(w);
    }
  }
  return mk(words(r.summary || ''));
}
function mk(w) {
  if (!w.length) return { verb: '', noun: '' };
  let n = w[w.length - 1];
  if (n.endsWith('s') && !n.endsWith('ss')) n = n.slice(0, -1);
  return { verb: w[0], noun: n };
}
const crows = pending.map((r) => ({
  group_id: r.group_id, row_id: r.row_id, pass_id: r.pass_id, provider: r.provider,
  method: r.method, operationId: r.operationId, summary: r.summary, ...verbNoun(r),
}));
fs.writeFileSync(DIR + 'c-rows.csv', toCsv(crows, ['group_id', 'row_id', 'pass_id', 'provider', 'method', 'operationId', 'summary', 'verb', 'noun']));

// c-profile.md
function top(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).slice(0, n);
}
const lines = ['# Pending groups: verb / noun profile', ''];
for (const g of ['G01', 'G04', 'G06']) {
  const rs = crows.filter((r) => r.group_id === g);
  const v = new Map(), n = new Map(), p = new Map();
  for (const r of rs) {
    v.set(r.verb, (v.get(r.verb) || 0) + 1);
    n.set(r.noun, (n.get(r.noun) || 0) + 1);
    const pk = r.verb + ' ' + r.noun;
    p.set(pk, (p.get(pk) || 0) + 1);
  }
  const t60 = top(p, 60);
  const cov = t60.reduce((s, [, c]) => s + c, 0);
  lines.push(`## ${g} (${rs.length} rows)`, '', '### Top 40 verbs', '');
  for (const [k, c] of top(v, 40)) lines.push(`- ${k || '(empty)'}: ${c}`);
  lines.push('', '### Top 60 nouns', '');
  for (const [k, c] of top(n, 60)) lines.push(`- ${k || '(empty)'}: ${c}`);
  lines.push('', '### Top 60 verb+noun pairs', '');
  for (const [k, c] of t60) lines.push(`- ${k}: ${c}`);
  lines.push('', `Top 60 pairs cover ${cov} of ${rs.length} rows (${(100 * cov / rs.length).toFixed(1)}%).`, '');
}
fs.writeFileSync(DIR + 'c-profile.md', lines.join('\n'));

// report
const tally = (f) => settled.reduce((m, s) => ((m[f(s)] = (m[f(s)] || 0) + 1), m), {});
console.log('input rows', rows.length, 'settled', settled.length, 'pending', pending.length);
console.log('by class', JSON.stringify(tally((s) => s.final_class)));
console.log('by source', JSON.stringify(tally((s) => s.source)));
console.log('by source+class', JSON.stringify(tally((s) => s.source + ':' + s.final_class)));
console.log('override rows:');
for (const o of overrideLog) {
  const changed = o.groupClass === null ? 'group pending (no group class)' : o.groupClass === o.ruled ? 'unchanged' : `CHANGED (group would give ${o.groupClass})`;
  console.log(`  ${o.r.row_id} ${o.r.pass_id} ${o.r.group_id} group-ruling=${o.groupRuling} sonnet=${o.r.sonnet_class} -> ${o.ruled}: ${changed}`);
}
const unmatched = rowRulings.filter((r) => !seen.has(key(r)));
if (unmatched.length) console.log('WARNING rulings with no matching row:', unmatched.map(key).join(' '));
