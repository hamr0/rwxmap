// v4 pass: group the Jev-vs-Sonnet disagreements for rule-by-rule review.
// Usage: node poc/v4-pass/disagree.mjs   (writes data/pass-v4-2026-11-05/suspects/disagree/)
import fs from 'node:fs';
import { parseCsv, toCsv } from '../../tools/csv.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const IN = ROOT + 'data/pass-v4-2026-11-05/';
const SUS = IN + 'suspects/';
const OUT = SUS + 'disagree/';
const SEED = 20261111;
const Q4 = ['accessChange', 'handsOver', 'outside', 'otherX'];
const PK = ['accessChange', 'narrowOnly', 'handsOver', 'outside', 'otherX'];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sus = parseCsv(fs.readFileSync(SUS + 'suspects-key.csv', 'utf8'));
const pk = new Map(parseCsv(fs.readFileSync(IN + 'pass-key.csv', 'utf8')).map((r) => [r.pass_id, r]));
const lab = new Map();
let nLabelRows = 0;
for (const f of fs.readdirSync(SUS).filter((n) => /^sbatch-\d+-labels\.csv$/.test(n)).sort()) {
  for (const r of parseCsv(fs.readFileSync(SUS + f, 'utf8'))) {
    nLabelRows++;
    if (lab.has(r.row_id)) { console.error('duplicate label ' + r.row_id); process.exit(1); }
    lab.set(r.row_id, r);
  }
}
const missing = sus.filter((s) => !lab.has(s.row_id)).length;
const extra = [...lab.keys()].filter((id) => !sus.some((s) => s.row_id === id)).length; // small, run once
console.log(`suspects ${sus.length}, label rows ${nLabelRows}, suspects without label ${missing}, labels without suspect ${extra}`);

const tally = (arr) => arr.reduce((m, k) => (m.set(k, (m.get(k) || 0) + 1), m), new Map());
console.log('jev labels', [...tally(sus.map((s) => s.jev_label))].join(' '));
console.log('sonnet classes', [...tally([...lab.values()].map((l) => l.truth_class))].join(' '));
console.log('sonnet confidence', [...tally([...lab.values()].map((l) => l.confidence))].join(' '));

const rows = [];
let weird = 0;
for (const s of sus) {
  const l = lab.get(s.row_id);
  if (!l) continue;
  const sc = l.truth_class, jl = s.jev_label;
  let dir = null;
  if (sc === '?') dir = 'son?';
  else if (jl === 'x' && sc === 'w') dir = 'jevX-sonW';
  else if (jl === 'x' && sc === 'r') dir = 'jevX-sonR';
  else if (jl === 'w' && sc === 'x') dir = 'jevW-sonX';
  else if (!['r', 'w', 'x'].includes(sc) || !['w', 'x'].includes(jl)) weird++;
  if (!dir) continue;
  const p = Object.fromEntries(PK.map((k) => [k, Number(s[k])]));
  let best = Q4[0];
  for (const k of Q4) if (p[k] > p[best]) best = k;
  let question = jl === 'w' && p[best] < 0.2 ? 'none' : best;
  if (p.narrowOnly >= 0.5) question += '+narrow';
  const conf = l.confidence === 'high' ? 'high' : 'low';
  const k = pk.get(s.pass_id);
  rows.push({
    group: `${dir}|${question}|${conf}`, row_id: s.row_id, pass_id: s.pass_id, category: s.category,
    direction: dir, question, sonnet_class: sc, sonnet_confidence: conf, sonnet_reason: l.reason, ...Object.fromEntries(PK.map((q) => [q, s[q]])),
    provider: k.provider, method: k.method, path: k.path, operationId: k.operationId, summary: k.summary,
  });
}
console.log(`unclassified-direction rows (unexpected class/label): ${weird}`);
console.log(`TOTAL disagreements: ${rows.length}  (son? rows: ${rows.filter((r) => r.direction === 'son?').length})`);

const gs = new Map();
for (const r of rows) (gs.get(r.group) || gs.set(r.group, []).get(r.group)).push(r);
const order = [...gs.entries()].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
const gid = new Map(order.map(([g], i) => [g, 'G' + String(i + 1).padStart(2, '0')]));
for (const r of rows) r.group_id = gid.get(r.group);
rows.sort((a, b) => (a.group_id < b.group_id ? -1 : a.group_id > b.group_id ? 1 : a.row_id < b.row_id ? -1 : 1));

const fmt = (m) => [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
const groups = order.map(([g, rs]) => {
  const [direction, question, sonnet_confidence] = g.split('|');
  const prov = fmt(tally(rs.map((r) => r.provider)));
  return {
    group_id: gid.get(g), direction, question, sonnet_confidence, rows: rs.length, distinct_providers: prov.length,
    top5_providers: prov.slice(0, 5).map(([a, b]) => `${a}:${b}`).join(';'),
    methods: fmt(tally(rs.map((r) => r.method))).map(([a, b]) => `${a}:${b}`).join(';'),
  };
});

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUT + 'disagree-rows.csv', toCsv(rows, ['group_id', 'row_id', 'pass_id', 'category', 'direction', 'question', 'sonnet_class', 'sonnet_confidence', 'sonnet_reason', ...PK, 'provider', 'method', 'path', 'operationId', 'summary']));
const GH = ['group_id', 'direction', 'question', 'sonnet_confidence', 'rows', 'distinct_providers', 'top5_providers', 'methods'];
fs.writeFileSync(OUT + 'groups.csv', toCsv(groups, GH));

const rnd = mulberry32(SEED);
let md = '# Disagreement group samples\n\n';
for (const g of groups) {
  md += `## ${GH.map((h) => `${h}=${g[h]}`).join(' | ')}\n\n`;
  const rs = rows.filter((r) => r.group_id === g.group_id);
  let pick = rs;
  if (rs.length > 10) { // partial Fisher-Yates, 10 draws
    const a = rs.slice();
    for (let i = 0; i < 10; i++) { const j = i + Math.floor(rnd() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; }
    pick = a.slice(0, 10);
  }
  for (const r of pick) {
    md += `- ${r.row_id} | ${r.provider} | ${r.method} ${r.operationId || r.path} | ${(r.summary || '').replace(/\s+/g, ' ').slice(0, 100)}\n` +
      `  Sonnet ${r.sonnet_class} (${r.sonnet_confidence}): ${(r.sonnet_reason || '').replace(/\s+/g, ' ')}\n` +
      `  p: ${Q4.map((q) => `${q}=${r[q]}`).join(' ')}\n`;
  }
  md += '\n';
}
fs.writeFileSync(OUT + 'groups-samples.md', md);

const sid = new Map(sus.map((s) => [s.row_id, s.pass_id]));
const ruled = ['s00752', 's04088', 's10211', 's03924', 's02968', 's07408'];
for (const id of ruled) if (!sid.has(id)) { console.error('ruling row not found ' + id); process.exit(1); }
fs.writeFileSync(OUT + 'rulings.csv', toCsv(ruled.map((id) => ({ row_id: id, pass_id: sid.get(id), ruled_class: 'x', source: 'user 2026-11-06 rule-3 spot-check' })), ['row_id', 'pass_id', 'ruled_class', 'source']));
console.log(`groups: ${groups.length}`);
