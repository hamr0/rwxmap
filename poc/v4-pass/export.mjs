// Plan step 5: merged v4 export for rwxlite. Writes new files only.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseCsv, toCsv } from '../../tools/csv.js';

const D = new URL('../../data/', import.meta.url).pathname;
const OUT = D + 'export-v4-2026-11-06/';
const IN = {
  pass: 'pass-v4-2026-11-05/truth-v4-pass.csv',
  key: 'pass-v4-2026-11-05/pass-key.csv',
  conflicts: 'pass-v4-2026-11-05/conflicts.csv',
  inherit: 'pass-v4-2026-11-05/inherit.csv',
  p1key: 'pilot-v4-2026-11-05/pilot-key.csv',
  p1truth: 'pilot-v4-2026-11-05/truth-v4.csv',
  p2key: 'pilot2-v4-2026-11-06/pilot-key.csv',
  p2truth: 'pilot2-v4-2026-11-06/truth-v4.csv',
};
const sha = (b) => createHash('sha256').update(b).digest('hex');
const raw = {}, T = {};
for (const [k, p] of Object.entries(IN)) { raw[k] = readFileSync(D + p); T[k] = parseCsv(raw[k].toString('utf8')); }

// pilot1 source_set -> pass set name
const P1SET = {
  'provider-corpus-2026-09-16': 'combined', 'exam-2026-09-17': 'combined', 'exam-2026-09-20': 'combined',
  'buildset-2026-09-18': 'buildset', 'exam-2026-09-22': 'exam22', 'exam3-2026-11-04': 'exam3',
  'exam4-2026-11-04': 'exam4', 'rwxlite-fresh-2026-11-03': 'fresh',
};
const SETFLAG = {
  rwxlite: 'rwxlite', buildset: 'tuning', 'relabel-buildset': 'tuning', exam22: 'burned', exam3: 'burned',
  exam4: 'burned', fresh: 'burned', calibA: 'diagnostic', calibB: 'diagnostic', calibC: 'diagnostic', corpus: 'diagnostic',
};
const flagOf = (set, id) => {
  if (set === 'combined') return id.startsWith('pc-') ? 'tuning' : (id.startsWith('x17-') || id.startsWith('x20-')) ? 'burned' : null;
  return SETFLAG[set] ?? null;
};

const prefixes = {};
const bump = (src, s) => { prefixes[src] ??= {}; prefixes[src][s] = (prefixes[src][s] || 0) + 1; };
const pairs = (o) => o.split(';').filter(Boolean).map((x) => { const i = x.indexOf(':'); return [x.slice(0, i), x.slice(i + 1)]; });
for (const r of T.key) for (const [s] of pairs(r.origins)) bump('pass-key', s);
for (const r of T.conflicts) for (const [s] of pairs(r.origins)) bump('conflicts', s);
for (const r of T.p1key) bump('pilot1', r.source_set);
for (const r of T.p2key) for (const [s] of pairs(r.origins)) bump('pilot2', s);
console.log('origin set prefixes:'); console.log(JSON.stringify(prefixes, null, 1));
const unknown = [];
for (const r of T.p1key) if (!P1SET[r.source_set]) unknown.push('pilot1:' + r.source_set);
for (const [src, m] of Object.entries(prefixes)) if (src !== 'pilot1') for (const s of Object.keys(m)) if (!(s in SETFLAG) && s !== 'combined') unknown.push(src + ':' + s);
if (unknown.length) { console.log('UNMAPPED', [...new Set(unknown)]); process.exit(1); }

const RANK = { r: 0, w: 1, x: 2 };
const textOf = (r) => ({ provider: r.provider, method: r.method, path: r.path, operationId: r.operationId, summary: r.summary, description: r.description });
const cands = new Map(); // "set\0id" -> [{label, label_source, text}]
const add = (set, id, label, label_source, text) => {
  if (!(label in RANK)) throw new Error(`bad label ${label} for ${set}:${id}`);
  const k = set + '\0' + id;
  if (!cands.has(k)) cands.set(k, []);
  cands.get(k).push({ label, label_source, text });
};

const keyById = new Map(T.key.map((r) => [r.pass_id, r]));
if (keyById.size !== T.key.length) throw new Error('duplicate pass_id in pass-key');
let passMissing = 0;
for (const p of T.pass) {
  const k = keyById.get(p.pass_id);
  if (!k) { passMissing++; continue; }
  for (const [s, id] of pairs(k.origins)) add(s, id, p.v4_label, p.source, textOf(k));
}
for (const c of T.conflicts) for (const [s, id] of pairs(c.origins)) add(s, id, 'x', 'conflict-v3-x', textOf(c));
const p1truth = new Map(T.p1truth.map((r) => [r.pilot_id, r.label]));
let p1n = 0;
for (const r of T.p1key) { const l = p1truth.get(r.pilot_id); if (!l) throw new Error('p1 no truth ' + r.pilot_id); p1n++; add(P1SET[r.source_set], r.source_id, l, 'pilot1-v4', textOf(r)); }
const p2truth = new Map(T.p2truth.map((r) => [r.row_id, r.label]));
for (const r of T.p2key) { const l = p2truth.get(r.pilot_id); if (!l) throw new Error('p2 no truth ' + r.pilot_id); for (const [s, id] of pairs(r.origins)) add(s, id, l, 'pilot2-v4', textOf(r)); }

// rwxlite ids whose normalised key was pilot-1-labelled or an x-conflict: merge.mjs dropped the whole key, so the
// rwxlite id sharing it was never labelled above. Same key as merge.mjs (copied).
const ws = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const meth = (m) => { const u = String(m || '').toUpperCase(); return u === 'QUERY' ? 'GET' : u; };
const normProv = (p) => String(p || '').toLowerCase().replace(/\.(com|io|app|sh|dev|ai|co|net|org)$/, '');
const normKey = (x) => [normProv(x.provider), meth(x.method), x.path, x.operationId || '', ws(x.summary)].join('|');
const RWXLITE_UNIQUE = '/home/hamr/PycharmProjects/rwxlite/data/v4/rwxlite-w-unique.csv';
const rlRaw = readFileSync(RWXLITE_UNIQUE); const rlAll = parseCsv(rlRaw.toString('utf8'));
const p1ByKey = new Map();
for (const r of T.p1key) { const k = normKey(r); if (!p1ByKey.has(k)) p1ByKey.set(k, []); p1ByKey.get(k).push(p1truth.get(r.pilot_id)); }
const cfKeys = new Set(T.conflicts.map((c) => c.norm_key));
const tightest = (ls) => ls.reduce((b, l) => (RANK[l] > RANK[b] ? l : b));
const keyAdded = { p1: [], conflict: [] }, keyUnmatched = [];
for (const r of rlAll) {
  if (r.variant_kind === 'surface' || cands.has('rwxlite\0' + r.your_id)) continue;
  const k = normKey(r);
  if (p1ByKey.has(k)) { const l = tightest(p1ByKey.get(k)); add('rwxlite', r.your_id, l, 'pilot1-v4-by-key', textOf(r)); keyAdded.p1.push(l); }
  else if (cfKeys.has(k)) { add('rwxlite', r.your_id, 'x', 'conflict-v3-x-by-key', textOf(r)); keyAdded.conflict.push('x'); }
  else keyUnmatched.push(r.your_id);
}
if (keyUnmatched.length) { console.log('UNMATCHED rwxlite ids', keyUnmatched.length, keyUnmatched.slice(0, 20)); process.exit(1); }
const tally = (ls) => ls.reduce((m, l) => { m[l] = (m[l] || 0) + 1; return m; }, {});
console.log('by-key added: pilot1', keyAdded.p1.length, tally(keyAdded.p1), 'conflict', keyAdded.conflict.length, tally(keyAdded.conflict));
const pilotCounts = (tr) => { const m = {}; for (const r of tr) m[r.label] = (m[r.label] || 0) + 1; return m; };
const p1c = pilotCounts(T.p1truth), p2c = pilotCounts(T.p2truth);

const rows = [], multi = [];
const cnt = { flag: {}, label: {}, flagLabel: {}, source: {}, set: {} };
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
const keys = [...cands.keys()].sort((a, b) => { const [sa, ia] = a.split('\0'), [sb, ib] = b.split('\0'); return sa < sb ? -1 : sa > sb ? 1 : ia < ib ? -1 : ia > ib ? 1 : 0; });
for (const k of keys) {
  const [set, id] = k.split('\0');
  const list = cands.get(k);
  let best = list[0];
  for (const c of list) if (RANK[c.label] > RANK[best.label]) best = c;
  // pilot2's user-ruled r labels override the pass label (coordinator ruling): the one loosening exception
  const ruledR = list.find((c) => c.label_source === 'pilot2-v4' && c.label === 'r');
  if (ruledR) best = ruledR;
  const flag = flagOf(set, id);
  if (!flag) throw new Error(`no flag for ${set}:${id}`);
  if (list.length > 1) multi.push({ set, id, sources: list.map((c) => `${c.label_source}=${c.label}`).join(' | '), kept: best.label, differ: new Set(list.map((c) => c.label)).size > 1 ? 'yes' : 'no' });
  rows.push({ id, set, ...best.text, label: best.label, brief: 'BRIEF-v4', flag, label_source: best.label_source });
  inc(cnt.set, set); inc(cnt.flag, flag); inc(cnt.label, best.label); inc(cnt.flagLabel, flag + '/' + best.label); inc(cnt.source, best.label_source);
}

// inherit: fill from export if the seed id is present, else "seed"
const byId = new Map();
for (const r of rows) { if (!byId.has(r.id)) byId.set(r.id, new Set()); byId.get(r.id).add(r.label); }
let inhResolved = 0, inhAmbiguous = 0;
const inh = T.inherit.map((r) => {
  const s = byId.get(r.variant_of);
  let label = 'seed';
  if (s) { inhResolved++; if (s.size > 1) { inhAmbiguous++; label = [...s].sort((a, b) => RANK[b] - RANK[a])[0]; } else label = [...s][0]; }
  return { your_id: r.your_id, variant_of: r.variant_of, label };
});

const H = ['id', 'set', 'provider', 'method', 'path', 'operationId', 'summary', 'description', 'label', 'brief', 'flag', 'label_source'];
mkdirSync(OUT, { recursive: true });
const exportCsv = toCsv(rows, H);
const inhCsv = toCsv(inh, ['your_id', 'variant_of', 'label']);
const multiCsv = toCsv(multi, ['set', 'id', 'sources', 'kept', 'differ']);
writeFileSync(OUT + 'export-v4.csv', exportCsv);
writeFileSync(OUT + 'inherit-v4.csv', inhCsv);
writeFileSync(OUT + 'multi-source-ids.csv', multiCsv);
writeFileSync(OUT + 'export-v4.csv.sha256', sha(exportCsv) + '  export-v4.csv\n');
writeFileSync(OUT + 'inherit-v4.csv.sha256', sha(inhCsv) + '  inherit-v4.csv\n');

const sorted = (o) => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `- ${k}: ${v}`).join('\n');
const differing = multi.filter((m) => m.differ === 'yes').length;
const readme = `# export-v4 (2026-11-06)

## Purpose
The v4 training labels for rwxlite round 13, labelled under BRIEF-v4 and D137. Written as an addition: no existing file was changed. Built by \`poc/v4-pass/export.mjs\` (no args, deterministic).

## Inputs (sha256)
${Object.entries(IN).map(([k, p]) => `- ${p}: ${sha(raw[k])}`).join('\n')}

## Rules
- One row per origin id (set + id). Output sorted by set, then id.
- Pass rows: each origin of each pass row gets that row's v4_label; label_source is the truth-v4-pass source. Text comes from pass-key.
- Conflicts: label x, label_source conflict-v3-x (v3 truth already has x). Text from conflicts.csv.
- Pilots: label_source pilot1-v4 or pilot2-v4. Pilot1 source_set is normalised to the pass set names (provider-corpus-2026-09-16, exam-2026-09-17, exam-2026-09-20 -> combined; buildset-2026-09-18 -> buildset; exam-2026-09-22 -> exam22; exam3-2026-11-04 -> exam3; exam4-2026-11-04 -> exam4; rwxlite-fresh-2026-11-03 -> fresh). Pilot2 labels apply to every origin id of the row. Pilot2's 5 r labels are user-ruled fixes and stay r.
- An id with labels from more than one source keeps the tighter label (x over w over r), except that pilot2's 5 user-ruled r labels override the pass label (the one loosening exception); on a tie the first source in the order pass, conflict, pilot1, pilot2 supplies label_source and text. Every such id is listed with its sources in multi-source-ids.csv (${multi.length} ids, ${differing} where the labels differ).
- By-key rows: rwxlite ids (from rwxlite-w-unique.csv, sha256 ${sha(rlRaw)}) that merge.mjs left out because their normalised key was pilot-1-labelled or a v3 x-conflict get that row's label (pilot-1 truth label, or x), label_source pilot1-v4-by-key or conflict-v3-x-by-key, and their own text. Added: ${keyAdded.p1.length} by pilot1 key, ${keyAdded.conflict.length} by conflict key. The build fails if any non-surface rwxlite-w-unique id is missing, or any surface one is not in inherit-v4.csv.
- brief is BRIEF-v4 for every row.
- Flags: rwxlite -> rwxlite; combined by id prefix (pc- tuning; x17-, x20- burned); buildset, relabel-buildset -> tuning; exam22, exam3, exam4, fresh -> burned; calibA, calibB, calibC, corpus -> diagnostic.
- inherit-v4.csv: ${T.inherit.length} rwxlite surface variants (your_id, variant_of). rwxlite gives each variant its seed's v4 label from this export: label is "seed" unless variant_of appears as an id in export-v4.csv, in which case that label is filled in (${inhResolved} resolved, ${inhAmbiguous} of them with an id shared across sets, tightest kept).

## Counts
Rows: ${rows.length}

By set:
${sorted(cnt.set)}

By flag:
${sorted(cnt.flag)}

By label:
${sorted(cnt.label)}

By flag and label:
${sorted(cnt.flagLabel)}

By label_source:
${sorted(cnt.source)}

## Known gap
18,576 pass rows carry Jev's label only (Jev-w, never Sonnet-checked). Sonnet's 5% sample of such rows found 21 of 978 were x (2.1%).
`;
writeFileSync(OUT + 'README.md', readme);

{
  const exp = new Set(rows.filter((r) => r.set === 'rwxlite').map((r) => r.id)), inhIds = new Set(inh.map((r) => r.your_id));
  const bad = [];
  for (const r of rlAll) { if (r.variant_kind === 'surface' ? !inhIds.has(r.your_id) : !exp.has(r.your_id)) bad.push(r.your_id); }
  if (bad.length) { console.log('COVERAGE FAIL', bad.length, bad.slice(0, 20)); process.exit(1); }
  console.log('coverage ok: rwxlite-w-unique', rlAll.length, 'non-surface in export, surface in inherit');
}
console.log('pass rows without key:', passMissing);
console.log('pilot1 labels', p1c, 'pilot2 labels', p2c);
console.log('export rows', rows.length);
console.log('set', cnt.set); console.log('flag', cnt.flag); console.log('label', cnt.label); console.log('flag/label', cnt.flagLabel); console.log('label_source', cnt.source);
console.log('multi-source ids', multi.length, 'differing', differing); for (const m of multi) console.log(JSON.stringify(m));
console.log('inherit', T.inherit.length, 'resolved', inhResolved, 'ambiguous', inhAmbiguous);
console.log('sha export', sha(exportCsv), 'inherit', sha(inhCsv));
