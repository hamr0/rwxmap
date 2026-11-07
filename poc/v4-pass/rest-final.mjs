// Gap pass: fold blind Sonnet checks of the 18,576 jev-unchecked rows (+ user rulings 2026-11-06) into a NEW truth file.
// Usage: node poc/v4-pass/rest-final.mjs   (no args, deterministic). Writes new files only.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseCsv, toCsv } from '../../tools/csv.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const IN = ROOT + 'data/pass-v4-2026-11-05/';
const REST = IN + 'rest/';
const die = (m) => { console.error('FAIL: ' + m); process.exit(1); };

const truth = parseCsv(fs.readFileSync(IN + 'truth-v4-pass.csv', 'utf8'));
const pk = new Map(parseCsv(fs.readFileSync(IN + 'pass-key.csv', 'utf8')).map((r) => [r.pass_id, r]));
const rkey = parseCsv(fs.readFileSync(REST + 'rest-key.csv', 'utf8'));
const rkById = new Map(rkey.map((r) => [r.row_id, r]));
if (rkById.size !== rkey.length) die('duplicate row_id in rest-key');

const sonnet = new Map();
const files = fs.readdirSync(REST).filter((f) => /^gbatch-\d+-labels\.csv$/.test(f)).sort();
for (const f of files) for (const r of parseCsv(fs.readFileSync(REST + f, 'utf8'))) {
  if (sonnet.has(r.row_id)) die('duplicate label for ' + r.row_id);
  if (!['r', 'w', 'x'].includes(r.truth_class)) die(`bad class ${r.truth_class} ${r.row_id}`);
  sonnet.set(r.row_id, r);
}
const byPass = new Map();
for (const [rid, s] of sonnet) {
  const k = rkById.get(rid); if (!k) die('label row_id not in rest-key: ' + rid);
  byPass.set(k.pass_id, { rid, s, k });
}
const unchecked = truth.filter((t) => t.source === 'jev-unchecked');
if (unchecked.length !== 18576) die(`jev-unchecked ${unchecked.length}`);
if (sonnet.size !== 18576 || byPass.size !== 18576 || rkey.length !== 18576) die(`coverage sonnet ${sonnet.size} byPass ${byPass.size} key ${rkey.length}`);
for (const t of unchecked) if (!byPass.has(t.pass_id)) die('uncovered ' + t.pass_id);

// ---- gap-x-groups
const ORDER = ['accessChange', 'handsOver', 'outside', 'otherX'];
const top = (k) => { let b = ORDER[0]; for (const q of ORDER) if (Number(k[q]) > Number(k[b])) b = q; return b; };
const xs = [];
for (const { rid, s, k } of byPass.values()) if (s.truth_class === 'x') {
  const p = pk.get(k.pass_id); if (!p) die('no pass-key ' + k.pass_id);
  xs.push({ row_id: rid, pass_id: k.pass_id, gkey: top(k) + '/' + s.confidence, jev_top_question: top(k), sonnet_confidence: s.confidence, provider: p.provider, method: p.method, operationId: p.operationId, reason: s.reason });
}
xs.sort((a, b) => (a.row_id < b.row_id ? -1 : 1));
const sizes = new Map();
for (const x of xs) sizes.set(x.gkey, (sizes.get(x.gkey) || 0) + 1);
const gkeys = [...sizes].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
const expect = { 'otherX/low': 151, 'accessChange/low': 31, 'handsOver/low': 25, 'outside/low': 18, 'otherX/high': 9, 'accessChange/high': 2 };
const got = Object.fromEntries(gkeys);
if (xs.length !== 236 || JSON.stringify(Object.entries(got).sort()) !== JSON.stringify(Object.entries(expect).sort())) die('group sizes differ: ' + JSON.stringify(got));
const gid = new Map(gkeys.map(([k], i) => [k, 'H0' + (i + 1)]));
for (const x of xs) x.group_id = gid.get(x.gkey);
fs.writeFileSync(REST + 'gap-x-groups.csv', toCsv(xs, ['row_id', 'pass_id', 'group_id', 'jev_top_question', 'sonnet_confidence', 'provider', 'method', 'operationId', 'reason']));
fs.writeFileSync(REST + 'group-rulings.csv', toCsv([...gid.values()].sort().map((g) => ({ group_id: g, ruling: 'sonnet', source: 'user 2026-11-06' })), ['group_id', 'ruling', 'source']));
console.log('groups: ' + gkeys.map(([k, n]) => `${gid.get(k)}=${k}:${n}`).join(' '));

// ---- truth-v4-pass-gap
const rows = truth.map((t) => {
  if (t.source !== 'jev-unchecked') return t;
  const c = byPass.get(t.pass_id).s.truth_class;
  if (c === 'x') return { pass_id: t.pass_id, v4_label: 'x', source: 'gap-ruling-x' };
  if (c === 'w') return { pass_id: t.pass_id, v4_label: 'w', source: 'gap-sonnet-agreed' };
  return { pass_id: t.pass_id, v4_label: 'w', source: 'gap-sonnet-r-kept-w' };
});
if (rows.length !== 33321) die('row count ' + rows.length);
const rank = { r: 0, w: 1, x: 2 };
rows.forEach((r, i) => { if (rank[r.v4_label] < rank[truth[i].v4_label] || r.pass_id !== truth[i].pass_id) die('loosened/reordered ' + r.pass_id); });
const csv = toCsv(rows, ['pass_id', 'v4_label', 'source']);
fs.writeFileSync(IN + 'truth-v4-pass-gap.csv', csv);
fs.writeFileSync(IN + 'truth-v4-pass-gap.csv.sha256', `${crypto.createHash('sha256').update(Buffer.from(csv)).digest('hex')}  truth-v4-pass-gap.csv\n`);
const tally = (f) => { const m = new Map(); for (const r of rows) m.set(f(r), (m.get(f(r)) || 0) + 1); return [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)); };
console.log('rows: ' + rows.length);
console.log('by v4_label:'); tally((r) => r.v4_label).forEach(([k, n]) => console.log(`  ${k}: ${n}`));
console.log('by source:'); tally((r) => r.source).forEach(([k, n]) => console.log(`  ${k}: ${n}`));
