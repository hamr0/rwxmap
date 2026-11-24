import fs from 'node:fs';
import { parseCsv, toObjects, fmtRow } from './csv.mjs';
const here = new URL('.', import.meta.url).pathname;
const rd = f => toObjects(parseCsv(fs.readFileSync(here + f, 'utf8')));
const sonnet = new Map(rd('train-sonnet.csv').map(r => [r.op_id, r]));
const parts = fs.readdirSync(here + 'blind').filter(f => /^part-\d\d\.csv$/.test(f)).sort();
const info = new Map(); const rows = [];
for (const p of parts) {
  const nn = p.slice(5, 7), of = `out/O-${nn}.csv`;
  if (!fs.existsSync(here + of)) continue;
  for (const r of rd('blind/' + p)) info.set(r.op_id, r);
  for (const o of rd(of)) rows.push(o);
}
const pairs = {}; const dis = [], agr = [];
for (const o of rows) {
  const s = sonnet.get(o.op_id); if (!s) { console.error('FAIL: unknown op_id ' + o.op_id); process.exit(1); }
  const k = `sonnet ${s.sonnet_letter} / opus ${o.letter}`; pairs[k] = (pairs[k] || 0) + 1;
  (s.sonnet_letter === o.letter ? agr : dis).push({ o, s });
}
const fmt = (list) => list.map(({ o, s }, i) => fmtRow(i + 1, info.get(o.op_id),
  `sonnet: ${s.sonnet_letter} — ${s.sonnet_reason}\nopus: ${o.letter} (${o.confidence}) — ${o.reason}`)).join('\n');
fs.writeFileSync(here + 'disagree-numbered.txt', fmt(dis));
const k = Math.max(1, Math.floor(agr.length / 100));
const sample = []; for (let i = 0; i < agr.length && sample.length < 100; i += k) sample.push(agr[i]);
fs.writeFileSync(here + 'agree-sample-numbered.txt', fmt(sample));
console.log(`compared ${rows.length} rows from ${new Set(rows.map(r => r.op_id)).size} ids; agree ${agr.length}, disagree ${dis.length}; sample ${sample.length} (every ${k}th)`);
for (const [p, n] of Object.entries(pairs).sort()) console.log(`  ${p}: ${n}`);
