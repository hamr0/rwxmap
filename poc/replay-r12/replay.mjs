// Generic replay: score a peer model's per-row p answers through rwxmap's REAL
// mode-a second pass (src/secondpass.js), for sets that come only as ops.csv.
// Usage: node replay.mjs --ops ops.csv --truth truth.csv --p p.jsonl --out rows.csv
//        [--expect-mech rows-mech.csv] [--expect-rows rows-a.csv]
// Run from a scratch cwd with no .env. Vanilla node ESM, no deps.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import * as os from 'node:os';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { classifyOperations } = await import(`${REPO}/src/exporter.js`);
const { readAnswer } = await import(`${REPO}/src/secondpass.js`);

const { values: a } = parseArgs({ options: { 'lower-min-p': { type: 'string' }, ops: { type: 'string' }, truth: { type: 'string' }, p: { type: 'string' }, out: { type: 'string' }, 'expect-mech': { type: 'string' }, 'expect-rows': { type: 'string' } } });
const die = (m) => { console.error(`replay: ${m}`); process.exit(2); };
for (const k of ['ops', 'truth', 'p', 'out']) if (!a[k]) die(`--${k} is required`);

// ---- second pass: the real module, or (with --lower-min-p) a temp copy with only LOWER_MIN_P changed
let spFile = `${REPO}/src/secondpass.js`, cutoff = 0.97, tmpDir = null;
if (a['lower-min-p'] !== undefined) {
  cutoff = Number(a['lower-min-p']);
  if (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > 1) die(`--lower-min-p must be a number in 0..1, got ${a['lower-min-p']}`);
  const src = fs.readFileSync(`${REPO}/src/secondpass.js`, 'utf8');
  const line = 'export const LOWER_MIN_P = 0.97;';
  if (src.split(line).length !== 2) die(`expected line not found exactly once in src/secondpass.js: ${line}`);
  let copy = src.replace(line, () => `export const LOWER_MIN_P = ${cutoff};`);
  for (const imp of ['./flow.js', './modelcache.js']) {
    const from = `from '${imp}'`;
    if (copy.split(from).length !== 2) die(`import ${from} not found exactly once in src/secondpass.js`);
    copy = copy.replace(from, () => `from '${REPO}/src/${imp.slice(2)}'`);
  }
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secondpass-cut-'));
  spFile = path.join(tmpDir, 'secondpass.js');
  fs.writeFileSync(spFile, copy);
}
const { secondPass } = await import(spFile);
if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); // the import is done; the copy is not needed again
console.log(`second pass file: ${spFile}${a['lower-min-p'] !== undefined ? ' (temp copy)' : ' (real module)'}; lower cut-off ${cutoff}`);

function parseCsv(text) {
  const rows = []; let row = [], f = '', i = 0, q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; } f += c; i++; continue; }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(f); f = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
    f += c; i++;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const csv = (file) => { const r = parseCsv(fs.readFileSync(file, 'utf8')); const h = r[0]; return r.slice(1).filter((x) => !(x.length === 1 && x[0] === '')).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]]))); };
const q = (s) => (/[",\r\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const RANK = { r: 0, w: 1, x: 2 };
const pct = (n, d) => `${d ? (100 * n / d).toFixed(1) : '0.0'}%`;

// ---- inputs
const opsRows = csv(a.ops);
const need = ['id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
for (const k of need) if (!(k in (opsRows[0] || {}))) die(`ops.csv lacks column ${k}`);
if (new Set(opsRows.map((o) => o.id)).size !== opsRows.length) die('ops.csv duplicate ids');
const truthRows = csv(a.truth);
const labelCol = 'label' in (truthRows[0] || {}) ? 'label' : null;
if (!labelCol) die(`truth file has no label column (columns: ${Object.keys(truthRows[0] || {}).join(',')})`);
const truth = new Map();
for (const r of truthRows) { if (!(r[labelCol] in RANK)) die(`truth label not r|w|x for ${r.id}: ${r[labelCol]}`); if (truth.has(r.id)) die(`truth duplicate id ${r.id}`); truth.set(r.id, r[labelCol]); }
const pById = new Map(); let pDup = 0;
for (const l of fs.readFileSync(a.p, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); if (pById.has(r.id)) pDup++; pById.set(r.id, r); }
const models = [...new Set([...pById.values()].map((r) => r.model))];
if (models.length !== 1) die(`p file has ${models.length} model strings: ${models.join(', ')}`);
const model = models[0];

const opIds = new Set(opsRows.map((o) => o.id));
const noP = opsRows.filter((o) => !pById.has(o.id)).map((o) => o.id);
const pNoOps = [...pById.keys()].filter((id) => !opIds.has(id));
const noTruth = opsRows.filter((o) => !truth.has(o.id)).map((o) => o.id);
const truthNoOps = [...truth.keys()].filter((id) => !opIds.has(id));
console.log(`ops ${opsRows.length}; p rows ${pById.size} (model ${model}, duplicate ids in p: ${pDup}); truth ${truth.size}`);
console.log(`ops without p: ${noP.length}${noP.length ? ' [' + noP.slice(0, 20).join(' ') + ']' : ''}`);
console.log(`p without ops: ${pNoOps.length}${pNoOps.length ? ' [' + pNoOps.slice(0, 20).join(' ') + ']' : ''}`);
console.log(`ops without truth: ${noTruth.length}${noTruth.length ? ' [' + noTruth.slice(0, 20).join(' ') + ']' : ''}`);
console.log(`truth without ops: ${truthNoOps.length}`);
if (noP.length || noTruth.length) die('refusing: every op needs a p row and a truth label (counts above)');

// ---- operations in the CLI's shape: a field absent when empty (ops.csv cannot tell absent from "")
const gap = { operationId: 0, summary: 0, description: 0 };
const ops = opsRows.map((o) => {
  const row = { method: o.method.toUpperCase(), path: o.path };
  for (const k of Object.keys(gap)) { if (o[k] !== '') row[k] = o[k]; else gap[k]++; }
  return row;
});
console.log(`empty (treated as absent): operationId ${gap.operationId}, summary ${gap.summary}, description ${gap.description}`);

// ---- mechanical, then mode a
const mech = classifyOperations(ops);
const engine = async (items) => items.map((it) => { const r = pById.get(opsRows[it.index].id); return { pIsX: r.pIsX, pChanges: r.pChanges, model: r.model }; });
const sp = await secondPass(ops, mech, engine, { model });
const fin = sp.verdicts, s = sp.summary;

// ---- rows
const outcome = (letter, id) => { const d = RANK[letter] - RANK[truth.get(id)]; return d === 0 ? 'exact' : d < 0 ? 'loose' : 'tight'; };
const rows = opsRows.map((o, i) => ({ id: o.id, provider: o.provider, method: o.method, path: o.path, truth: truth.get(o.id), mech_letter: mech[i].class, mech_review: mech[i].review, letter: fin[i].class, review: fin[i].review, evidence: fin[i].source, rule: fin[i].rule, rw_letter: (readAnswer(pById.get(o.id), model) || {}).letter || '', rw_p: (readAnswer(pById.get(o.id), model) || { p: '' }).p, outcome: outcome(fin[i].class, o.id), mech_outcome: outcome(mech[i].class, o.id) }));
const cols = ['id', 'provider', 'method', 'path', 'truth', 'mech_letter', 'mech_review', 'letter', 'review', 'evidence', 'outcome', 'rule', 'rw_letter', 'rw_p'];
fs.writeFileSync(a.out, [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n') + '\n');

// ---- report
const tally = (rs, key) => { const t = { n: rs.length, exact: 0, loose: 0, tight: 0 }; for (const r of rs) t[r[key]]++; return t; };
const line = (l, t) => `${l.padEnd(18)} exact ${String(t.exact).padStart(4)} (${pct(t.exact, t.n).padStart(5)})  too loose ${String(t.loose).padStart(4)} (${pct(t.loose, t.n).padStart(5)})  too tight ${String(t.tight).padStart(4)} (${pct(t.tight, t.n).padStart(5)})  of ${t.n}`;
console.log('\n== totals ==');
console.log(line('mechanical', tally(rows, 'mech_outcome')));
console.log(line('mode a', tally(rows, 'outcome')));
console.log(`second pass: sent ${s.sent}, raised ${s.raised}, lowered ${s.lowered}, kept ${s.kept}, undecided ${s.undecided} (of ${rows.length} rows)`);
console.log('\n== per provider ==');
for (const p of [...new Set(rows.map((r) => r.provider))]) {
  const rs = rows.filter((r) => r.provider === p);
  console.log(line(`${p} mech`, tally(rs, 'mech_outcome')));
  console.log(line(`${p} mode a`, tally(rs, 'outcome')));
}

// ---- parity gates
let fail = false;
function gate(name, file, keys) {
  const exp = new Map(csv(file).map((r) => [r.id, r]));
  const d = []; let missing = 0;
  for (const r of rows) {
    const e = exp.get(r.id); if (!e) { missing++; continue; }
    const got = keys.map(([ek, rk]) => `${ek} ${r[rk]}`).join('/'), want = keys.map(([ek]) => `${ek} ${e[ek]}`).join('/');
    if (got !== want) d.push(`${r.id} expected ${want} replay ${got}`);
  }
  const extra = [...exp.keys()].filter((id) => !opIds.has(id)).length;
  console.log(`\n${name}: ${rows.length - d.length - missing}/${rows.length} match; ${d.length} differ; ${missing} ops not in expected file; ${extra} expected ids not in ops`);
  if (d.length || missing || extra) { fail = true; d.slice(0, 20).forEach((x) => console.log('  DIFF ' + x)); }
}
if (a['expect-mech']) gate('GATE G1 (mechanical letter+review)', a['expect-mech'], [['letter', 'mech_letter'], ['review', 'mech_review']]);
if (a['expect-rows']) gate('GATE G2 (mode a letter+review)', a['expect-rows'], [['letter', 'letter'], ['review', 'review']]);
if (fail) process.exit(3);
