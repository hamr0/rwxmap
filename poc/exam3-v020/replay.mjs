// Replay per-row rwxlite p files through rwxmap's REAL secondPass (src read-only).
// Gate 1: mechanical verdicts equal rows-mech.csv. Gate 2: r10 replays equal the
// committed CLI rows (letter AND review). Only then 0.2.0 is reported.
// Run from a scratch cwd with no .env. Vanilla node ESM.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
const REPO = '/home/hamr/PycharmProjects/rwxmap';
const EXAM = path.join(REPO, 'data/exam3-2026-11-04');
const P = '/home/hamr/PycharmProjects/rwxlite/data/exam3';
const { loadSpec } = await import(`${REPO}/src/load.js`);
const { operationsFrom, classifyOperations } = await import(`${REPO}/src/exporter.js`);
const { secondPass } = await import(`${REPO}/src/secondpass.js`);
const { parseCsv } = await import(`${EXAM}/score/score.mjs`);

const VENDORS = { clerk: 'clerk.com', neon: 'neon.com', supabase: 'supabase.com', mux: 'mux.com', netbird: 'netbird.io', ory: 'ory.sh', novu: 'novu.co' };
const RANK = { r: 0, w: 1, x: 2 };
const out = [];
const log = (s = '') => { out.push(s); console.log(s); };
const pct = (n, d) => `${(100 * n / d).toFixed(1)}%`;
const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const csv = (f) => { const r = parseCsv(fs.readFileSync(f, 'utf8')); const h = r[0]; return r.slice(1).filter((x) => x.length > 1).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]]))); };
const opsCsv = csv(`${EXAM}/ops.csv`);
const truth = new Map(csv(`${EXAM}/truth.csv`).map((r) => [r.id, r.label]));
const rowsOf = (n) => new Map(csv(`${EXAM}/score/rows-${n}.csv`).map((r) => [r.id, r]));

// ---- p files
const PFILES = {
  'r10-fp32': ['p-r10-fp32.jsonl', 'fb374d424c7011570d39a6b124e30ac3f3ba746fa90895bbd24b15776bb2d2ab'],
  'r10-int8': ['p-r10-int8pc.jsonl', 'bfb3cd9141d4d3191f5ac72291f900319014f6d38cf035da83bc7ea12479102e'],
  'v020-fp32': ['p-v020-fp32.jsonl', 'cc16eede63676c71f8ae0e40a1286b735493d2fd62199a7dd75d23a0aa32f95e'],
  'v020-int8': ['p-v020-int8pc.jsonl', '2521154d7822e23f3ff34e1ddc9d38e7d27c7dcec0a64716c9dbe4f2b55d5c8b'],
};
const pData = {};
for (const [k, [f, want]] of Object.entries(PFILES)) {
  const fp = path.join(P, f);
  if (sha(fp) !== want) throw new Error(`sha256 mismatch ${f}`);
  const rows = fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const models = [...new Set(rows.map((r) => r.model))];
  if (models.length !== 1) throw new Error(`${f}: ${models.length} model strings`);
  if (byId.size !== rows.length) throw new Error(`${f}: duplicate ids`);
  for (const o of opsCsv) if (!byId.has(o.id)) throw new Error(`${f}: missing ${o.id}`);
  pData[k] = { byId, model: models[0], n: rows.length };
  log(`p file ${f}: sha256 OK, ${rows.length} rows, model string ${models[0]}`);
}
log('NOTE: v020-fp32 file carries stale local-dev model string rwxlite-0.1.0+8503b655 (published v0.2.0 fp32 = rwxlite-0.2.0+8503b655, same weights); each file\'s own string is passed to secondPass as the run model. Files not rewritten.');

// ---- mechanical verdicts, per vendor, as the CLI does
const idByKey = new Map(opsCsv.map((o) => [`${o.provider}\0${o.method}\0${o.path}`, o.id]));
if (idByKey.size !== opsCsv.length) throw new Error('ops key not unique');
const vend = []; // {stem, provider, ops, verdicts, ids}
const seen = new Set();
for (const [stem, provider] of Object.entries(VENDORS)) {
  const f = fs.readdirSync(`${EXAM}/specs`).filter((x) => x.startsWith(`${stem}.`));
  if (f.length !== 1) throw new Error(`spec ${stem}`);
  const { doc } = await loadSpec(path.join(EXAM, 'specs', f[0]));
  const ops = operationsFrom(doc);
  const verdicts = classifyOperations(ops);
  const ids = ops.map((o) => { const id = idByKey.get(`${provider}\0${o.method}\0${o.path}`); if (!id) throw new Error(`no ops row for ${provider} ${o.method} ${o.path}`); if (seen.has(id)) throw new Error(`dup ${id}`); seen.add(id); return id; });
  vend.push({ stem, provider, ops, verdicts, ids });
}
if (seen.size !== opsCsv.length) throw new Error(`joined ${seen.size} of ${opsCsv.length} ops`);
log(`mechanical verdicts built for ${seen.size} ops over ${vend.length} specs (joined 1:1 to ops.csv)`);

// ---- gate 1
const mech = rowsOf('mech');
let bad = [];
for (const v of vend) v.verdicts.forEach((d, i) => { const m = mech.get(v.ids[i]); if (m.letter !== d.class || m.review !== d.review || m.evidence !== d.source) bad.push(`${v.ids[i]} csv ${m.letter}/${m.review}/${m.evidence} replay ${d.class}/${d.review}/${d.source}`); });
log(`\nGATE 1 mechanical vs rows-mech.csv (class, review, evidence): ${seen.size - bad.length}/${seen.size} match`);
if (bad.length) { bad.slice(0, 50).forEach((b) => log('  MISMATCH ' + b)); log('STOP'); fs.writeFileSync(path.join(REPO, 'poc/exam3-v020/out.txt'), out.join('\n') + '\n'); process.exit(2); }

// ---- run
async function run(pkey, confidence) {
  const { byId, model } = pData[pkey];
  const res = new Map();
  const sum = { sent: 0, raised: 0, lowered: 0, kept: 0, undecided: 0 };
  for (const v of vend) {
    const engine = async (items) => items.map((it) => { const r = byId.get(v.ids[it.index]); return { pIsX: r.pIsX, pChanges: r.pChanges, model: r.model }; });
    const opt = confidence === undefined ? { model } : { model, confidence };
    const r = await secondPass(v.ops, v.verdicts, engine, opt);
    r.verdicts.forEach((d, i) => res.set(v.ids[i], { letter: d.class, review: d.review, evidence: d.source }));
    for (const k of Object.keys(sum)) sum[k] += r.summary[k];
  }
  return { res, sum };
}
const CFG = { a: undefined, b95: 95 };
const COMMITTED = { 'a-fp32': 'a-fp32', 'a-int8': 'a-int8', 'b95-fp32': 'b95-fp32', 'b95-int8': 'b95-int8' };
const results = {};
for (const q of ['fp32', 'int8']) for (const m of ['a', 'b95']) results[`r10/${m}-${q}`] = await run(`r10-${q}`, CFG[m]);
// 0.2.0 is replayed for fp32 ONLY (int8 failed parity; no int8 0.2.0 number is computed)
for (const m of ['a', 'b95']) results[`v020/${m}-fp32`] = await run('v020-fp32', CFG[m]);

// ---- gate 2
log('\nGATE 2 r10 replay vs committed CLI rows (letter AND review; evidence shown separately):');
let gate2 = true, gate2fp32 = true;
for (const name of Object.keys(COMMITTED)) {
  const com = rowsOf(name); const rep = results[`r10/${name}`].res;
  const d = []; let evd = 0;
  for (const o of opsCsv) { const c = com.get(o.id), r = rep.get(o.id); if (c.letter !== r.letter || c.review !== r.review) d.push(`${o.id} csv ${c.letter}/${c.review} replay ${r.letter}/${r.review}`); if (c.evidence !== r.evidence) evd++; }
  log(`  ${name}: letter+review match ${opsCsv.length - d.length}/${opsCsv.length}; evidence differs on ${evd}`);
  if (d.length) { gate2 = false; if (name.endsWith('fp32')) gate2fp32 = false; d.slice(0, 50).forEach((x) => log('    DIFF ' + x)); }
}
log(`GATE 2: ${gate2 ? 'PASS' : 'FAIL'}`);
log(`GATE 2 fp32 only (a-fp32, b95-fp32): ${gate2fp32 ? 'PASS' : 'FAIL'}; int8 FAILED parity, so int8 0.2.0 is not computed or reported`);
if (!gate2fp32) { log('STOP: fp32 parity failed'); fs.writeFileSync(path.join(REPO, 'poc/exam3-v020/out.txt'), out.join('\n') + '\n'); process.exit(3); }

// ---- scoring
const tally = (rs) => { const t = { n: 0, exact: 0, loose: 0, tight: 0 }; for (const [id, r] of rs) { t.n++; const d = RANK[r.letter] - RANK[truth.get(id)]; if (d === 0) t.exact++; else if (d < 0) t.loose++; else t.tight++; } return t; };
const line = (l, t) => `${l.padEnd(16)} exact ${String(t.exact).padStart(4)} (${pct(t.exact, t.n).padStart(5)})  too loose ${String(t.loose).padStart(4)} (${pct(t.loose, t.n).padStart(5)})  too tight ${String(t.tight).padStart(4)} (${pct(t.tight, t.n).padStart(5)})  of ${t.n}`;
const tm = tally(mech);
log('\n== scores (of 1377) ==');
log(line('mech', tm));
for (const q of ['fp32']) for (const m of ['a', 'b95']) for (const ver of ['r10', 'v020']) {
  const R = results[`${ver}/${m}-${q}`]; const t = tally(R.res); const s = R.sum;
  log(line(`${ver} ${m}-${q}`, t) + `  | sent ${s.sent} raised ${s.raised} lowered ${s.lowered} kept ${s.kept} undecided ${s.undecided}`);
}
log('\n== D133 mode-a bar vs mech (too loose <= ' + tm.loose + ', exact >= ' + (tm.exact + 69) + ' = mech ' + tm.exact + ' + 69) ==');
for (const q of ['fp32']) for (const ver of ['r10', 'v020']) {
  const t = tally(results[`${ver}/a-${q}`].res);
  const lo = t.loose <= tm.loose, ex = t.exact >= tm.exact + 69;
  log(`${ver} a-${q}: too loose ${t.loose} (${lo ? 'OK' : 'FAIL'}); exact ${t.exact}, +${t.exact - tm.exact} rows = ${((t.exact - tm.exact) * 100 / t.n).toFixed(2)} pts (${ex ? 'OK' : 'FAIL'}) => ${lo && ex ? 'PASS' : 'FAIL'}`);
}

// ---- diffs
const cls = (l, id) => { const d = RANK[l] - RANK[truth.get(id)]; return d === 0 ? 'exact' : d < 0 ? 'too loose' : 'too tight'; };
log('\n== row-level diffs, 0.2.0 vs r10 (same variant, same mode) ==');
const byId = new Map(opsCsv.map((o) => [o.id, o]));
for (const q of ['fp32']) for (const m of ['a', 'b95']) {
  const A = results[`r10/${m}-${q}`].res, B = results[`v020/${m}-${q}`].res;
  const diffs = []; let rOnly = 0, vOnly = 0, neither = 0;
  for (const o of opsCsv) {
    const a = A.get(o.id), b = B.get(o.id); if (a.letter === b.letter) continue;
    const tr = truth.get(o.id); const ra = a.letter === tr, rb = b.letter === tr;
    const who = ra ? 'r10' : rb ? '0.2.0' : 'neither'; if (ra) rOnly++; else if (rb) vOnly++; else neither++;
    diffs.push(`${o.id} | ${o.provider} | ${o.method} | ${o.path} | truth ${tr} | r10 ${a.letter} (${cls(a.letter, o.id)}) | 0.2.0 ${b.letter} (${cls(b.letter, o.id)}) | right: ${who}`);
  }
  log(`\n-- ${m}-${q}: ${diffs.length} rows differ in letter: r10 right & 0.2.0 wrong ${rOnly}; 0.2.0 right & r10 wrong ${vOnly}; neither right ${neither}`);
  diffs.forEach((d) => log('  ' + d));
}
fs.writeFileSync(path.join(REPO, 'poc/exam3-v020/out.txt'), out.join('\n') + '\n');
