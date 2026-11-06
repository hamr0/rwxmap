// v4 pass rest: pick the Jev-w rows with no Sonnet look (source jev-unchecked) for a blind check.
// Usage: node poc/v4-pass/rest.mjs   (writes data/pass-v4-2026-11-05/rest/, exits 1 if it exists)
// Deterministic (seeded).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseCsv, toCsv } from '../../tools/csv.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const IN = ROOT + 'data/pass-v4-2026-11-05/';
const OUT = IN + 'rest/';
const SHUFFLE_SEED = 20261109, BATCH = 200, EXPECT = 18576;
const PK = ['accessChange', 'narrowOnly', 'handsOver', 'outside', 'otherX'];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, seed) {
  const rnd = mulberry32(seed), a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const die = (m) => { console.error(m); process.exit(1); };

if (fs.existsSync(OUT)) die(`${OUT} already exists`);

const truth = parseCsv(fs.readFileSync(IN + 'truth-v4-pass.csv', 'utf8'));
const sel = truth.filter((r) => r.source === 'jev-unchecked');
if (sel.length !== EXPECT) die(`expected ${EXPECT} jev-unchecked rows, found ${sel.length}`);

const key = parseCsv(fs.readFileSync(IN + 'pass-key.csv', 'utf8'));
const jev = fs.readFileSync(IN + 'jev-facts-pass.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const byId = new Map(key.map((r) => [r.pass_id, r]));
const jById = new Map(jev.map((j) => [j.row_id, j]));
const susp = new Set(parseCsv(fs.readFileSync(IN + 'suspects/suspects-key.csv', 'utf8')).map((r) => r.pass_id));
for (const t of sel) {
  const id = t.pass_id;
  if (!byId.has(id)) die(`${id} not in pass-key.csv`);
  if (!jById.has(id)) die(`${id} not in jev-facts-pass.jsonl`);
  if (jById.get(id).label !== 'w') die(`${id} Jev label is ${jById.get(id).label}, not w`);
  if (susp.has(id)) die(`${id} is in suspects-key.csv`);
}

const shuffled = shuffle(sel, SHUFFLE_SEED);
const rows = shuffled.map((t, i) => {
  const j = jById.get(t.pass_id);
  const o = { row_id: 'g' + String(i + 1).padStart(5, '0'), pass_id: t.pass_id, jev_label: j.label };
  for (const k of PK) o[k] = j.p[k];
  return { o, r: byId.get(t.pass_id) };
});

fs.mkdirSync(OUT);
fs.writeFileSync(OUT + 'rest-key.csv', toCsv(rows.map((x) => x.o), ['row_id', 'pass_id', 'jev_label', ...PK]));
const bh = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
let nb = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  nb++;
  const name = `gbatch-${String(nb).padStart(3, '0')}-blind.csv`;
  const text = toCsv(rows.slice(i, i + BATCH).map((x) => ({ ...x.r, row_id: x.o.row_id })), bh);
  fs.writeFileSync(OUT + name, text);
  fs.writeFileSync(OUT + name + '.sha256', `${sha(Buffer.from(text))}  ${name}\n`);
}
fs.writeFileSync(OUT + 'README.md', `# v4 pass rest

The Jev-w rows of the v4 pass that no Sonnet has looked at (source jev-unchecked in truth-v4-pass.csv). ${rows.length} rows. None is in suspects/.

## Files
- rest-key.csv: row_id (g00001...), pass_id, jev_label, the five p values. Row ids assigned after a Fisher-Yates shuffle of the selected rows in truth-v4-pass.csv order, mulberry32 seed ${SHUFFLE_SEED}. Never give this file to a labeller.
- gbatch-NNN-blind.csv: ${nb} batches of ${BATCH} rows (last ${rows.length - (nb - 1) * BATCH}), in row_id order. Header ${bh.join(',')}. No Jev answer, no source. Each has a .sha256.

Labelled blind by one Sonnet labeller per batch under data/relabel-v4-2026-11-05/BRIEF-v4.md (amended version). Where Sonnet disagrees with Jev, the rows go to the user grouped by pattern (plan ruling (f)). A Sonnet r on its own never lowers a w (ruling D).
`);
console.log(JSON.stringify({ total: rows.length, batches: nb, last: rows.length - (nb - 1) * BATCH }));
