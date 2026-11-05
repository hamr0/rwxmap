// v4 pass merge: build the deduped set of rows to label under BRIEF-v4.
// Usage: node poc/v4-pass/merge.mjs   (writes data/pass-v4-2026-11-05/)
// Read-only on every input. Loader logic copied from the inventory scripts.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { parseCsv, toCsv } from '../../tools/csv.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const D = ROOT + 'data/';
const OUT = D + 'pass-v4-2026-11-05/';
const RWXLITE = '/home/hamr/PycharmProjects/rwxlite/data/v4/rwxlite-w-unique.csv';
const RWXLITE_SHA = 'a40d1f59dc56b31628e1a48cf8b1c99e9159d6dff0b645050079e141d7edd558';
const SEED = 20261106;
const BATCH = 200;

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ---- rwxlite file: check sha first
const rlBuf = fs.readFileSync(RWXLITE);
if (sha(rlBuf) !== RWXLITE_SHA) {
  console.error('rwxlite-w-unique.csv sha256 mismatch: ' + sha(rlBuf));
  process.exit(1);
}

const rd = (p) => {
  const b = fs.readFileSync(D + p);
  return p.endsWith('.gz') ? zlib.gunzipSync(b).toString() : b.toString();
};
const rows = (p) => parseCsv(rd(p));

// ---- keys
const ws = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const meth = (m) => { const u = String(m || '').toUpperCase(); return u === 'QUERY' ? 'GET' : u; };
const normProv = (p) => String(p || '').toLowerCase().replace(/\.(com|io|app|sh|dev|ai|co|net|org)$/, '');
const rawKey = (x) => [String(x.provider).toLowerCase(), meth(x.method), x.path, x.operationId || '', ws(x.summary)].join('|');
const normKey = (x) => [normProv(x.provider), meth(x.method), x.path, x.operationId || '', ws(x.summary)].join('|');

// ---- rwxmap v3 sets (all rows, all classes)
const v3 = []; // {set,id,provider,method,path,operationId,summary,description,label}
const addV3 = (set, a, idf, lab) => {
  for (const x of a) v3.push({ set, id: idf(x), provider: x.provider, method: x.method, path: x.path,
    operationId: x.operationId || '', summary: x.summary || '', description: x.description || '', label: lab(x) });
};
addV3('combined', rows('combined-2026-09-21/labelled.csv'), (x) => x.row_id, (x) => x.truth_class);
addV3('buildset', rows('relabel-buildset-2026-09-23/labelled.csv'), (x) => x.row_id, (x) => x.truth_class);
addV3('exam22', rows('exam-2026-09-22/labelled.csv'), (x) => x.row_id, (x) => x.truth_class);
for (const [s, d] of [['exam3', 'exam3-2026-11-04'], ['exam4', 'exam4-2026-11-04']]) {
  const t = new Map(rows(d + '/truth-d136.csv').map((x) => [x.id, x.label]));
  addV3(s, rows(d + '/ops.csv'), (x) => x.id, (x) => t.get(x.id));
}
{
  const t = new Map(rows('rwxlite-fresh-2026-11-03/truth.csv').map((x) => [x.id, x.label]));
  addV3('fresh', rows('rwxlite-fresh-2026-11-03/ops.csv.gz'), (x) => x.id, (x) => t.get(x.id));
}
const v3w = v3.filter((x) => x.label === 'w');
const v3x = v3.filter((x) => x.label === 'x');

// ---- pre-v3: calibration (A+B+C, joined as pre.mjs does) and corpus/labelled.csv, every row
const pre = [];
for (const s of ['A', 'B', 'C']) {
  const b = new Map(rows(`calibration-2026-09-14/calib${s}-blind.csv`).map((x) => [x.row_id, x]));
  for (const l of rows(`calibration-2026-09-14/calib${s}-labels.csv`)) {
    const x = b.get(l.row_id);
    pre.push({ set: 'calib' + s, id: l.row_id, provider: x.provider, method: x.method, path: x.path,
      operationId: x.operationId || '', summary: x.summary || '', description: x.description || '' });
  }
}
// calibration: the 550 label rows collapse to 543 unique ops under the old key (provider|method|path|operationId)
const preCorpus = rows('corpus/labelled.csv');
preCorpus.forEach((x, i) => pre.push({ set: 'corpus', id: 'R' + String(i + 1).padStart(4, '0'), provider: x.repo,
  method: x.method, path: x.path, operationId: x.operationId || '', summary: x.summary || '', description: x.description || '' }));
const calibUnique = new Set(pre.filter((x) => x.set.startsWith('calib')).map((x) => [x.provider, x.method, x.path, x.operationId].join('|'))).size;

// ---- rwxlite
const rlAll = parseCsv(rlBuf.toString('utf8'));
const rlSurface = rlAll.filter((x) => x.variant_kind === 'surface');
const rlContrast = rlAll.filter((x) => x.variant_kind === 'contrast');
const rlPlain = rlAll.filter((x) => !x.variant_kind);
const rlRow = (x, kind) => ({ set: 'rwxlite', id: x.your_id, provider: x.provider, method: x.method, path: x.path,
  operationId: x.operationId || '', summary: x.summary || '', description: x.description || '', kind });

// ---- origin items entering the merge
// rank: lower = preferred text source (rwxmap first)
const items = [];
for (const x of v3w) items.push({ ...x, origin: 'v3', rank: 0 });
for (const x of pre) items.push({ ...x, origin: 'pre', rank: 1 });
for (const x of rlPlain) items.push({ ...rlRow(x), origin: 'rl', rank: 2 });
for (const x of rlContrast) items.push({ ...rlRow(x), origin: 'rlc', rank: 2 });
for (const it of items) { it.rk = rawKey(it); it.nk = normKey(it); }

const report = [];
const R = (s) => { report.push(s); console.log(s); };
const uniq = (arr, f) => new Set(arr.map(f)).size;

R('## counts');
const inCounts = {
  'rwxmap v3 w rows': v3w.length,
  'rwxmap pre-v3 rows (calibration label rows 550 + corpus 1186)': pre.length,
  'rwxlite rows (all)': rlAll.length,
  'rwxlite plain rows': rlPlain.length,
  'rwxlite contrast variants': rlContrast.length,
  'rwxlite surface variants': rlSurface.length,
};
for (const [k, v] of Object.entries(inCounts)) R(`in: ${k}: ${v}`);
R(`v3 rows total (all classes): ${v3.length}; v3 x rows: ${v3x.length}`);
R(`calibration unique ops under old key: ${calibUnique}`);

// overlap under both keys, over items entering the merge (surface excluded up front)
R(`items entering merge (v3 w + pre-v3 + rwxlite plain + contrast): ${items.length}`);
R(`unique under raw key: ${uniq(items, (x) => x.rk)}; overlap (rows lost to dedupe): ${items.length - uniq(items, (x) => x.rk)}`);
R(`unique under normalised key: ${uniq(items, (x) => x.nk)}; overlap (rows lost to dedupe): ${items.length - uniq(items, (x) => x.nk)}`);
for (const kf of ['rk', 'nk']) {
  const g = (o) => new Set(items.filter((x) => x.origin === o).map((x) => x[kf]));
  const a = g('v3'), b = g('pre'), c = new Set([...g('rl'), ...g('rlc')]);
  const inter = (p, q) => [...p].filter((k) => q.has(k)).length;
  R(`[${kf}] unique keys: v3 ${a.size}, pre ${b.size}, rwxlite ${c.size}; v3&pre ${inter(a, b)}, v3&rwxlite ${inter(a, c)}, pre&rwxlite ${inter(b, c)}`);
}
// within-origin repeats
for (const o of ['v3', 'pre', 'rl', 'rlc']) {
  const s = items.filter((x) => x.origin === o);
  R(`within ${o}: ${s.length} rows, ${uniq(s, (x) => x.nk)} unique normalised keys`);
}

// ---- group on normalised key
const groups = new Map();
for (const it of items) { if (!groups.has(it.nk)) groups.set(it.nk, []); groups.get(it.nk).push(it); }
const gkeys = [...groups.keys()].sort();

// normalised-only merges
const nOnly = [];
for (const k of gkeys) {
  const g = groups.get(k);
  const raws = [...new Set(g.map((x) => x.rk))].sort();
  if (raws.length > 1) nOnly.push({ k, raws });
}
R(`keys that merge only under the normalised key: ${nOnly.length}`);
R('## normalised-only pairs (up to 30)');
for (const x of nOnly.slice(0, 30)) {
  const [p1, ...rest] = x.raws[0].split('|');
  const [p2] = x.raws[1].split('|');
  R(`- ${p1} <> ${p2} | ${rest[0]} ${rest[1]} | ${rest[2]}`);
}

// ---- exclusions
// x keys from v3 (all rwxmap truth); rwxlite export holds only w
const xKeys = new Set(v3x.map(normKey));
const pilot = parseCsv(fs.readFileSync(D + 'pilot-v4-2026-11-05/pilot-key.csv', 'utf8'));
const pilotKeys = new Set(pilot.map(normKey));
R(`pilot rows read: ${pilot.length}; unique keys ${pilotKeys.size}`);

const passRows = [], conflicts = [];
let pilotExcl = 0;
const pilotOverlapByRaw = new Set(pilot.map(rawKey));
let pilotExclRaw = 0;
for (const k of gkeys) {
  const g = groups.get(k);
  if (g.some((x) => pilotOverlapByRaw.has(x.rk))) pilotExclRaw++;
  if (pilotKeys.has(k)) { pilotExcl++; continue; }
  if (xKeys.has(k)) { conflicts.push({ k, g }); continue; }
  passRows.push({ k, g });
}
R(`unique keys after merge (normalised): ${gkeys.length}`);
R(`pilot-labelled keys excluded: ${pilotExcl} (raw-key match would give ${pilotExclRaw})`);
R(`x-conflict keys excluded (after pilot): ${conflicts.length}`);

// pilot check: how many pilot keys were found in the merge at all
R(`pilot keys present in merged groups: ${[...pilotKeys].filter((k) => groups.has(k)).length} of ${pilotKeys.size}`);

// surface variants -> inherit.csv; report how many collide with a pass key (informational)
const inherit = rlSurface.map((x) => ({ your_id: x.your_id, variant_of: x.variant_of }));
const passKeySet = new Set(passRows.map((p) => p.k));
R(`surface variants excluded: ${rlSurface.length} (their key also in the pass: ${rlSurface.filter((x) => passKeySet.has(normKey(x))).length})`);

// ---- build pass rows
const origins = (g) => [...new Set(g.map((x) => x.set + ':' + x.id))];
const stratumOf = (g) => {
  if (g.some((x) => x.origin === 'v3')) return 'w-v3';
  if (g.some((x) => x.origin === 'pre')) return 'pre-v3';
  if (g.some((x) => x.origin === 'rl')) return 'w-v3';
  return 'contrast-variant';
};
const finalRows = passRows.map(({ k, g }, i) => {
  const t = [...g].sort((a, b) => a.rank - b.rank)[0]; // stable: input order within a rank
  return { pass_id: 'v' + String(i + 1).padStart(4, '0'), norm_key: k, provider: t.provider, method: t.method, path: t.path,
    operationId: t.operationId, summary: t.summary, description: t.description,
    origins: origins(g).join(';'), stratum: stratumOf(g) };
});
const sc = {};
for (const r of finalRows) sc[r.stratum] = (sc[r.stratum] || 0) + 1;
R(`final pass rows: ${finalRows.length}; by stratum ${JSON.stringify(sc)}`);

// ---- shuffle (seeded mulberry32, Fisher-Yates) and batches
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const order = finalRows.map((_, i) => i);
for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
const shuffled = order.map((i) => finalRows[i]);

// ---- write
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^batch-\d+-blind\.csv(\.sha256)?$/.test(f)) fs.unlinkSync(OUT + f);
const w = (name, text) => fs.writeFileSync(OUT + name, text);

w('pass-key.csv', toCsv(finalRows, ['pass_id', 'norm_key', 'provider', 'method', 'path', 'operationId', 'summary', 'description', 'origins', 'stratum']));
w('inherit.csv', toCsv(inherit, ['your_id', 'variant_of']));
w('conflicts.csv', toCsv(conflicts.map(({ k, g }) => {
  const t = [...g].sort((a, b) => a.rank - b.rank)[0];
  const xs = v3x.filter((x) => normKey(x) === k);
  return { norm_key: k, provider: t.provider, method: t.method, path: t.path, operationId: t.operationId, summary: t.summary,
    origins: origins(g).join(';'), x_in: [...new Set(xs.map((x) => x.set + ':' + x.id))].join(';') };
}), ['norm_key', 'provider', 'method', 'path', 'operationId', 'summary', 'origins', 'x_in']));

const bh = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
let nb = 0;
for (let i = 0; i < shuffled.length; i += BATCH) {
  nb++;
  const name = `batch-${String(nb).padStart(3, '0')}-blind.csv`;
  const text = toCsv(shuffled.slice(i, i + BATCH).map((r) => ({ row_id: r.pass_id, ...r })), bh);
  w(name, text);
  w(name + '.sha256', `${sha(Buffer.from(text))}  ${name}\n`);
}
R(`batches: ${nb} (200 rows each, last ${shuffled.length - (nb - 1) * BATCH})`);

R('## conflict examples (10)');
for (const c of conflicts.slice(0, 10)) {
  const t = c.g[0];
  const xs = v3x.filter((x) => normKey(x) === c.k);
  R(`- ${t.provider} ${t.method} ${t.path} [${t.operationId}] origins ${origins(c.g).join(';')} ; x in ${[...new Set(xs.map((x) => x.set + ':' + x.id))].join(';')}`);
}

// ---- README
const inputs = [
  ['rwxlite-w-unique.csv', RWXLITE_SHA + ' (checked)'],
  ['pilot-key.csv', sha(fs.readFileSync(D + 'pilot-v4-2026-11-05/pilot-key.csv'))],
  ['exam3 truth-d136.csv', sha(fs.readFileSync(D + 'exam3-2026-11-04/truth-d136.csv'))],
  ['exam4 truth-d136.csv', sha(fs.readFileSync(D + 'exam4-2026-11-04/truth-d136.csv'))],
  ['combined labelled.csv', sha(fs.readFileSync(D + 'combined-2026-09-21/labelled.csv'))],
  ['relabel-buildset labelled.csv', sha(fs.readFileSync(D + 'relabel-buildset-2026-09-23/labelled.csv'))],
  ['exam-2026-09-22 labelled.csv', sha(fs.readFileSync(D + 'exam-2026-09-22/labelled.csv'))],
  ['rwxlite-fresh truth.csv', sha(fs.readFileSync(D + 'rwxlite-fresh-2026-11-03/truth.csv'))],
  ['corpus labelled.csv', sha(fs.readFileSync(D + 'corpus/labelled.csv'))],
];
for (const s of ['A', 'B', 'C']) {
  inputs.push([`calib${s}-blind.csv`, sha(fs.readFileSync(D + `calibration-2026-09-14/calib${s}-blind.csv`))]);
  inputs.push([`calib${s}-labels.csv`, sha(fs.readFileSync(D + `calibration-2026-09-14/calib${s}-labels.csv`))]);
}
const readme = `# Pass v4 merge (2026-11-05)

Built by \`poc/v4-pass/merge.mjs\` (node, no arguments). Read-only on every input. Re-running gives byte-identical output.

## Inputs (sha256 of the files read)

${inputs.map(([n, h]) => `- ${n}: ${h}`).join('\n')}

Also read: ops.csv of exam3, exam4 and rwxlite-fresh (row text for those sets).

## Counts at every step

${report.filter((l) => !l.startsWith('## ') && !l.startsWith('- ')).map((l) => '- ' + l).join('\n')}

## Seed

Shuffle: Fisher-Yates over pass-key order with mulberry32, seed ${SEED}. Batches of ${BATCH} rows, taken in shuffled order. Blind row_id is pass_id.

## Rules

- Merge key (rwxlite's): provider lowercased + method (QUERY folded to GET) + path + operationId + summary (whitespace collapsed, lowercased).
- Dedupe is on the normalised key: same, with the provider also stripped of a trailing .com/.io/.app/.sh/.dev/.ai/.co/.net/.org. Overlap is reported under both.
- Inputs: all w rows of the v3 sets (combined, buildset, exam22, exam3 and exam4 via truth-d136, fresh); every row of the pre-v3 sets (calibration A+B+C label rows, corpus/labelled.csv) whatever its label; rwxlite w rows.
- Pilot rows (pilot-key.csv, matched on normalised key) are already labelled under v4 and are excluded.
- Surface variants (variant_kind surface) are excluded and listed in inherit.csv (your_id, variant_of; variant_of is rwxlite's seed id, not present in its export). Contrast variants are labelled (stratum contrast-variant unless the key also comes from another origin).
- Conflicts: a key with an x label anywhere in the v3 rwxmap truth (all classes) stands as x under tighten-only; excluded and listed in conflicts.csv. rwxlite's export holds only w. Pre-v3 old labels never count as conflicts.
- Row text: rwxmap v3 text if any, else rwxmap pre-v3, else rwxlite. origins lists set:id for every origin (corpus ids are R + 1-based data-row number).
- Stratum: w-v3 if any v3 w origin (or rwxlite plain row with no rwxmap origin); else pre-v3 if any pre-v3 origin; else contrast-variant.
- Files: pass-key.csv, batch-NNN-blind.csv (+ .sha256), inherit.csv, conflicts.csv.
`;
w('README.md', readme);
