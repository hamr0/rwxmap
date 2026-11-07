// v4 pass rcheck: second blind look at the suspect rows the first labeller called r.
// Usage: node poc/v4-pass/rcheck.mjs   (writes data/pass-v4-2026-11-05/suspects/rcheck/)
// Read-only on every input; deterministic (seeded).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseCsv, toCsv } from '../../tools/csv.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const DIR = ROOT + 'data/pass-v4-2026-11-05/suspects/';
const OUT = DIR + 'rcheck/';
const SEED = 20261109, EXPECTED = 201;

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
const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };

const files = fs.readdirSync(DIR).filter((f) => /^sbatch-\d+-blind\.csv$/.test(f)).sort();
const blind = new Map(), labels = new Map();
let nBlind = 0, nLab = 0;
for (const f of files) {
  for (const r of parseCsv(fs.readFileSync(DIR + f, 'utf8'))) {
    nBlind++;
    if (blind.has(r.row_id)) fail('duplicate blind row_id ' + r.row_id);
    blind.set(r.row_id, r);
  }
  const lf = f.replace('-blind.csv', '-labels.csv');
  if (!fs.existsSync(DIR + lf)) fail('missing ' + lf);
  for (const r of parseCsv(fs.readFileSync(DIR + lf, 'utf8'))) {
    nLab++;
    if (labels.has(r.row_id)) fail('duplicate label row_id ' + r.row_id);
    labels.set(r.row_id, r);
  }
}
const key = new Map(parseCsv(fs.readFileSync(DIR + 'suspects-key.csv', 'utf8')).map((r) => [r.row_id, r]));
console.log(`files ${files.length}, blind rows ${nBlind}, label rows ${nLab}, key rows ${key.size}`);

const picked = [];
for (const [id, l] of labels) {
  if (l.truth_class !== 'r') continue;
  if (!blind.has(id)) fail('label row_id missing from blind files: ' + id);
  if (!key.has(id)) fail('label row_id missing from suspects-key: ' + id);
  picked.push(id);
}
console.log(`truth_class r: ${picked.length} (expected ${EXPECTED})`);
if (picked.length !== EXPECTED) fail(`count ${picked.length} != ${EXPECTED}`);

const shuffled = shuffle(picked, SEED);
const bh = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
const blindRows = [], keyRows = [];
shuffled.forEach((id, i) => {
  const nid = 'r' + String(i + 1).padStart(3, '0');
  blindRows.push({ ...blind.get(id), row_id: nid });
  const k = key.get(id), l = labels.get(id);
  keyRows.push({ rcheck_id: nid, row_id: id, pass_id: k.pass_id, category: k.category, jev_label: k.jev_label,
    first_class: l.truth_class, first_confidence: l.confidence, first_reason: l.reason });
});

fs.mkdirSync(OUT, { recursive: true });
const text = toCsv(blindRows, bh);
fs.writeFileSync(OUT + 'rcheck-blind.csv', text);
fs.writeFileSync(OUT + 'rcheck-blind.csv.sha256', `${sha(Buffer.from(text))}  rcheck-blind.csv\n`);
fs.writeFileSync(OUT + 'rcheck-key.csv', toCsv(keyRows, ['rcheck_id', 'row_id', 'pass_id', 'category', 'jev_label', 'first_class', 'first_confidence', 'first_reason']));

const tally = (f) => { const c = {}; for (const r of picked) { const v = f(r); c[v] = (c[v] || 0) + 1; } return c; };
const byMethod = tally((id) => blind.get(id).method.toUpperCase());
const byCat = tally((id) => key.get(id).category);
console.log('by method', JSON.stringify(byMethod));
console.log('by category', JSON.stringify(byCat));

fs.writeFileSync(OUT + 'README.md', `# v4 pass rcheck

Purpose: a second blind labeller on the ${picked.length} suspect rows the first suspect labeller called r. A row becomes r only if both say r (user ruling of 2026-11-06).

## Inputs
- sbatch-NNN-blind.csv and sbatch-NNN-labels.csv (${files.length} pairs) in the parent folder; suspects-key.csv for pass_id, category and Jev label.
- Selection: every labelled row with truth_class r. ${picked.length} rows.

## Seed
Fisher-Yates shuffle, mulberry32 seed ${SEED}. New ids r001..r${String(picked.length).padStart(3, '0')} assigned after the shuffle.

## Counts
- By method: ${JSON.stringify(byMethod)}
- By category: ${JSON.stringify(byCat)}

## Files
- rcheck-blind.csv: header ${bh.join(',')}. Row text verbatim from the sbatch blind files. No old s-id, first label, category or Jev answer. Has a .sha256.
- rcheck-key.csv: rcheck_id,row_id,pass_id,category,jev_label,first_class,first_confidence,first_reason. The key file is never given to a labeller.
`);
