// Loads the two tuning sets as rows
// {id, set, vendor, method, path, operationId, summary, description, truth, families}.
// A = export-v4-d141 (truth label_d141, non-QUERY rows, ops from their sources).
// B = exam #7 (burned, tuning only): ops.csv + truth.csv.
// Any id that cannot be joined is an error. Measurement only; reads, never writes.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../tools/csv.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MECH = '/home/hamr/PycharmProjects/rwxlite/data/m0/mechanical.jsonl.gz';
const text = (p) => {
  const buf = fs.readFileSync(p);
  return (p.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8');
};
const csv = (rel) => parseCsv(text(ROOT + rel));

/** The op shape classifyRow was fed when the export's lean was computed (poc/d141-pass/lean.mjs buildOp). */
export function toOp(r) {
  const o = { method: String(r.method).toUpperCase(), path: r.path };
  for (const k of ['operationId', 'summary', 'description']) if (r[k] !== '' && r[k] != null) o[k] = r[k];
  return o;
}

const pick = (o, id, set, truth, families, lean) => ({
  id, set, vendor: o.provider, method: String(o.method).toUpperCase(), path: o.path,
  operationId: o.operationId ?? '', summary: o.summary ?? '', description: o.description ?? '',
  truth, families, lean_letter: lean,
});

/** @returns {{rows:object[], report:object}} */
export function loadA() {
  const exp = csv('data/export-v4-d141-2026-11-19/export-v4-d141.csv');
  const kept = exp.filter((e) => e.lean_source !== 'm0q' && !e.id.endsWith('-q'));
  const dropped = exp.length - kept.length;
  const need = { ag: new Set(), ex3: new Set(), ex4: new Set(), fx: new Set() };
  for (const e of kept) {
    const p = e.id.split('-')[0];
    if (!need[p]) throw new Error('unknown id source for ' + e.id);
    need[p].add(e.id);
  }
  const src = { ag: new Map(), ex3: new Map(), ex4: new Map(), fx: new Map() };
  for (const line of text(MECH).split('\n')) {
    if (!line) continue;
    const j = JSON.parse(line);
    if (need.ag.has(j.id)) src.ag.set(j.id, j);
  }
  const files = { ex3: 'data/exam3-2026-11-04/ops.csv', ex4: 'data/exam4-2026-11-04/ops.csv', fx: 'data/rwxlite-fresh-2026-11-03/ops.csv.gz' };
  for (const k of Object.keys(files)) for (const r of csv(files[k])) src[k].set(r.id, r);
  const report = { total: exp.length, droppedQuery: dropped, joined: {}, missing: {} };
  const rows = [];
  for (const k of Object.keys(need)) { report.joined[k] = 0; report.missing[k] = 0; }
  for (const e of kept) {
    const p = e.id.split('-')[0];
    const o = src[p].get(e.id);
    if (!o) { report.missing[p]++; continue; }
    report.joined[p]++;
    rows.push(pick(o, e.id, 'A', e.label_d141, e.d141_families || '', e.lean_letter));
  }
  const miss = Object.values(report.missing).reduce((a, b) => a + b, 0);
  if (miss) throw new Error('set A: rows missing from source ' + JSON.stringify(report.missing));
  return { rows, report };
}

/** @returns {{rows:object[], report:object}} */
export function loadB() {
  const ops = csv('data/exam7-2026-11-19/ops.csv');
  const truth = new Map(csv('data/exam7-2026-11-19/truth.csv').map((r) => [r.id, r.label]));
  const byId = new Map(ops.map((o) => [o.id, o]));
  const missing = [...truth.keys()].filter((id) => !byId.has(id));
  if (missing.length) throw new Error('set B: truth ids missing from ops.csv: ' + missing.length);
  const rows = [...truth.keys()].map((id) => pick(byId.get(id), id, 'B', truth.get(id), '', undefined));
  return { rows, report: { truthSource: 'data/exam7-2026-11-19/truth.csv', ops: ops.length, truth: truth.size, joined: rows.length, opsWithoutTruth: ops.length - truth.size } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = loadA(); const b = loadB();
  console.log('A', JSON.stringify(a.report), 'rows', a.rows.length);
  console.log('B', JSON.stringify(b.report), 'rows', b.rows.length);
}
