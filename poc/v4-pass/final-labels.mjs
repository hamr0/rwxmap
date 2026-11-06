// Final v4 labels per pass row + vendor-check rulings (user, 2026-11-06).
// Usage: node poc/v4-pass/final-labels.mjs   (no args, deterministic)
// Step 1 label logic is COPIED from poc/v4-pass/vendor-check.mjs (that file runs on import, so it cannot be imported).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseCsv, toCsv } from '../../tools/csv.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const IN = ROOT + 'data/pass-v4-2026-11-05/';
const OUT = IN + 'vendor/';
const X_IDS = ['v4532', 'v3455', 'v3028', 'v2528', 'v13777', 'v13699', 'v13622', 'v13843'];
const RULING_SRC = 'user 2026-11-06 vendor cross-check';

// ---- v4 labels (copied from vendor-check.mjs step 1)
const key = parseCsv(fs.readFileSync(IN + 'pass-key.csv', 'utf8'));
const jev = new Map(fs.readFileSync(IN + 'jev-facts-pass.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((j) => [j.row_id, j.label]));
const fin = new Map(parseCsv(fs.readFileSync(IN + 'suspects/disagree/disagree-final.csv', 'utf8')).map((r) => [r.pass_id, r]));
const sKey = new Map(parseCsv(fs.readFileSync(IN + 'suspects/suspects-key.csv', 'utf8')).map((r) => [r.row_id, r.pass_id]));
const sonnet = new Map();
for (const f of fs.readdirSync(IN + 'suspects').filter((f) => /^sbatch-\d+-labels\.csv$/.test(f)).sort())
  for (const r of parseCsv(fs.readFileSync(IN + 'suspects/' + f, 'utf8'))) sonnet.set(sKey.get(r.row_id), r.truth_class);
const v4 = new Map();
for (const k of key) {
  const f = fin.get(k.pass_id), j = jev.get(k.pass_id);
  if (f) v4.set(k.pass_id, { label: f.final_class, source: 'disagree-final/' + f.source });
  else if (j) v4.set(k.pass_id, { label: j, source: sonnet.has(k.pass_id) ? (sonnet.get(k.pass_id) === 'r' ? 'jev-sonnet-r-kept-w' : 'jev-sonnet-agreed') : 'jev-unchecked' });
}

// ---- vendor rulings
const cand = parseCsv(fs.readFileSync(OUT + 'candidates-key.csv', 'utf8'));
const die = (m) => { console.error('FAIL: ' + m); process.exit(1); };
if (cand.length !== 45) die(`candidates-key.csv has ${cand.length} rows, expected 45`);
const candIds = new Set(cand.map((c) => c.pass_id));
if (candIds.size !== 45) die('candidates-key.csv has duplicate pass_ids');
for (const id of X_IDS) if (!candIds.has(id)) die(`${id} not in candidates-key.csv`);
const rulings = cand.map((c) => ({ pass_id: c.pass_id, ruled_class: X_IDS.includes(c.pass_id) ? 'x' : 'w', source: RULING_SRC }));
fs.writeFileSync(OUT + 'rulings.csv', toCsv(rulings, ['pass_id', 'ruled_class', 'source']));

// ---- final
const rows = [];
let changed = 0;
const changes = new Map();
for (const k of key) {
  const v = v4.get(k.pass_id);
  if (!v) continue;
  const r = rulings.find((x) => x.pass_id === k.pass_id);
  if (r) {
    if (r.ruled_class !== v.label) { changed++; changes.set(v.label + '->' + r.ruled_class, (changes.get(v.label + '->' + r.ruled_class) || 0) + 1); }
    rows.push({ pass_id: k.pass_id, v4_label: r.ruled_class, source: 'vendor-ruling' });
  } else rows.push({ pass_id: k.pass_id, v4_label: v.label, source: v.source });
}
const rulingsInRows = new Set(rows.map((r) => r.pass_id));
for (const r of rulings) if (!rulingsInRows.has(r.pass_id)) die(`ruled row ${r.pass_id} has no v4 label`);
const csv = toCsv(rows, ['pass_id', 'v4_label', 'source']);
fs.writeFileSync(IN + 'truth-v4-pass.csv', csv);
fs.writeFileSync(IN + 'truth-v4-pass.csv.sha256', `${crypto.createHash('sha256').update(Buffer.from(csv)).digest('hex')}  truth-v4-pass.csv\n`);

const tally = (f) => { const m = new Map(); for (const r of rows) m.set(f(r), (m.get(f(r)) || 0) + 1); return [...m].sort((a, b) => a[0].localeCompare(b[0])); };
console.log(`rows: ${rows.length}`);
console.log('by v4_label:'); tally((r) => r.v4_label).forEach(([k, n]) => console.log(`  ${k}: ${n}`));
console.log('by source:'); tally((r) => r.source).forEach(([k, n]) => console.log(`  ${k}: ${n}`));
console.log(`rows changed by vendor rulings: ${changed} (${[...changes].map(([k, n]) => k + ' ' + n).join(', ')})`);
