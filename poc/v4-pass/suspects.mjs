// v4 pass suspects: pick the rows a second blind labeller must look at.
// Usage: node poc/v4-pass/suspects.mjs   (writes data/pass-v4-2026-11-05/suspects/)
// Reads pass-key.csv and jev-facts-pass.jsonl; deterministic (seeded).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseCsv, toCsv } from '../../tools/csv.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const IN = ROOT + 'data/pass-v4-2026-11-05/';
const OUT = IN + 'suspects/';
const SAMPLE_SEED = 20261107, SHUFFLE_SEED = 20261108, BATCH = 200;
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

const key = parseCsv(fs.readFileSync(IN + 'pass-key.csv', 'utf8'));
const jev = fs.readFileSync(IN + 'jev-facts-pass.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const byId = new Map(key.map((r) => [r.pass_id, r]));
const jById = new Map(jev.map((j) => [j.row_id, j]));
if (byId.size !== key.length || jById.size !== jev.length ||
    byId.size !== jById.size || [...byId.keys()].some((id) => !jById.has(id))) {
  console.error(`id mismatch: key ${key.length} (${byId.size} unique), jsonl ${jev.length} (${jById.size} unique)`);
  process.exit(1);
}

const cat = new Map(); // pass_id -> category
const labels = {};
for (const r of key) { const l = jById.get(r.pass_id).label; labels[l] = (labels[l] || 0) + 1; }
const rest = [];
for (const r of key) {
  const j = jById.get(r.pass_id);
  if (j.label === 'x') cat.set(r.pass_id, 'jev-x');
  else if (j.label === 'w') {
    if (j.p && PK.some((k) => j.p[k] >= 0.2 && j.p[k] < 0.5)) cat.set(r.pass_id, 'near');
    else rest.push(r.pass_id);
  }
}
const nSample = Math.round(rest.length * 0.05);
for (const id of shuffle(rest, SAMPLE_SEED).slice(0, nSample)) cat.set(id, 'sample');

const picked = key.filter((r) => cat.has(r.pass_id));
const shuffled = shuffle(picked, SHUFFLE_SEED);
const rows = shuffled.map((r, i) => {
  const j = jById.get(r.pass_id);
  const o = { row_id: 's' + String(i + 1).padStart(5, '0'), pass_id: r.pass_id, category: cat.get(r.pass_id), jev_label: j.label };
  for (const k of PK) o[k] = j.p[k];
  return { o, r };
});

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^sbatch-\d+-blind\.csv(\.sha256)?$/.test(f)) fs.unlinkSync(OUT + f);
fs.writeFileSync(OUT + 'suspects-key.csv', toCsv(rows.map((x) => x.o), ['row_id', 'pass_id', 'category', 'jev_label', ...PK]));
const bh = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
let nb = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  nb++;
  const name = `sbatch-${String(nb).padStart(3, '0')}-blind.csv`;
  const text = toCsv(rows.slice(i, i + BATCH).map((x) => ({ ...x.r, row_id: x.o.row_id })), bh);
  fs.writeFileSync(OUT + name, text);
  fs.writeFileSync(OUT + name + '.sha256', `${sha(Buffer.from(text))}  ${name}\n`);
}
const cnt = (c) => rows.filter((x) => x.o.category === c).length;
fs.writeFileSync(OUT + 'README.md', `# v4 pass suspects

Rows from the full v4 pass (${key.length} rows, Jev facts pass) that get a blind check.

## Rules (user ruling, fixed before the Jev run)
- jev-x: every row whose Jev label is x. ${cnt('jev-x')} rows.
- near: Jev label w, with any of the five p values >= 0.2 and < 0.5. ${cnt('near')} rows.
- sample: seeded random 5% (rounded to the nearest whole row) of the remaining Jev-w rows. ${rest.length} remaining, ${nSample} drawn. Seed ${SAMPLE_SEED}, mulberry32 over a Fisher-Yates shuffle of the pass-key order. ${cnt('sample')} rows.

Total ${rows.length} rows. Jev labels seen: ${JSON.stringify(labels)}.

## Files
- suspects-key.csv: row_id (s00001...), pass_id, category, jev_label, the five p values. Row ids assigned after a Fisher-Yates shuffle, mulberry32 seed ${SHUFFLE_SEED}. Never give this file to a labeller.
- sbatch-NNN-blind.csv: ${nb} batches of ${BATCH} rows (last ${rows.length - (nb - 1) * BATCH}), taken in shuffled order, so all three categories are mixed. Header row_id,provider,method,path,operationId,summary,description. No category, no Jev answer, no source. Each has a .sha256.

Labelled blind by one Sonnet labeller per batch under BRIEF-v4. Where Sonnet disagrees with Jev, a second blind Sonnet looks. Rows still split go to the user grouped by pattern.
`);
console.log(JSON.stringify({ total: rows.length, 'jev-x': cnt('jev-x'), near: cnt('near'), sample: cnt('sample'), remainingW: rest.length, batches: nb, labels }));
