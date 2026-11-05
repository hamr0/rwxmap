// Cut-off what-if: run replay.mjs for each set x LOWER_MIN_P and tabulate vs 0.97.
// Usage (from a scratch cwd with no .env): node cutoff.mjs [outdir]
// Writes rows-<set>-<cut>.csv, log-<set>-<cut>.txt and report.md into outdir (default poc/replay-r12/out/cutoff).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OUT = process.argv[2] || path.join(HERE, 'out', 'cutoff');
fs.mkdirSync(OUT, { recursive: true });
const LITE = '/home/hamr/PycharmProjects/rwxlite/data';
const CUTS = [0.99, 0.97, 0.95, 0.93, 0.90];
const TRAINED = new Set(['exam-2026-11-03-fresh', 'gate-2026-11-06', 'gate-2026-11-07']);

const sets = [];
for (const s of ['exam-2026-11-03-fresh', 'gate-2026-11-03', 'gate-2026-11-04', 'gate-2026-11-06', 'gate-2026-11-07', 'r9-hand']) {
  const d = `${LITE}/r12/replay/${s}`;
  sets.push({ name: s, ops: `${d}/ops.csv`, truth: `${d}/truth.csv`, p: `${d}/p-v020-fp32.jsonl` });
}
const E4 = `${REPO}/data/exam4-2026-11-04`, E3 = `${REPO}/data/exam3-2026-11-04`;
sets.push({ name: 'exam4', ops: `${E4}/ops.csv`, truth: `${E4}/truth.csv`, p: `${LITE}/exam4/p-v020-fp32.jsonl`, parity: `${E4}/score/rows-a-fp32-base.csv`, totals: [1391, 16, 98] });
sets.push({ name: 'exam3', ops: `${E3}/ops.csv`, truth: `${E3}/truth.csv`, p: `${LITE}/exam3/p-v020-fp32.jsonl`, totals: [1192, 15, 170] });

// csv reader (quotes)
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
  const h = rows[0];
  return rows.slice(1).filter((x) => !(x.length === 1 && x[0] === '')).map((x) => Object.fromEntries(h.map((k, j) => [k, x[j]])));
}
const rd = (f) => parseCsv(fs.readFileSync(f, 'utf8'));
const pct = (n, d) => `${d ? (100 * n / d).toFixed(1) : '0.0'}%`;
const tally = (rows) => { const t = { n: rows.length, exact: 0, loose: 0, tight: 0, lowered: 0 }; for (const r of rows) { t[r.outcome]++; if (r.rule === 'rwxlite-lower') t.lowered++; } return t; };

const data = {}; // data[set][cut] = rows
const status = {};
for (const s of sets) {
  data[s.name] = {};
  for (const c of CUTS) {
    const rows = path.join(OUT, `rows-${s.name}-${c.toFixed(2)}.csv`);
    const args = [path.join(HERE, 'replay.mjs'), '--ops', s.ops, '--truth', s.truth, '--p', s.p, '--out', rows, '--lower-min-p', String(c)];
    const r = spawnSync('node', args, { encoding: 'utf8', cwd: process.cwd() });
    fs.writeFileSync(path.join(OUT, `log-${s.name}-${c.toFixed(2)}.txt`), r.stdout + (r.stderr || ''));
    if (r.status !== 0) { status[s.name] = `replay failed (exit ${r.status}): ${(r.stderr || '').split('\n')[0]}`; break; }
    data[s.name][c] = rd(rows);
  }
  if (status[s.name]) continue;
  // parity at 0.97
  const base = data[s.name][0.97], t = tally(base);
  let msg = `at 0.97: ${t.exact}/${t.loose}/${t.tight} of ${t.n}`;
  let ok = true;
  if (s.totals) { ok = s.totals[0] === t.exact && s.totals[1] === t.loose && s.totals[2] === t.tight; msg += ` vs committed ${s.totals.join('/')} ${ok ? 'MATCH' : 'MISMATCH'}`; }
  if (s.parity) {
    const exp = new Map(rd(s.parity).map((r) => [r.id, r])); let d = 0;
    for (const r of base) { const e = exp.get(r.id); if (!e || e.letter !== r.letter || e.review !== r.review) d++; }
    ok = ok && d === 0; msg += `; rows vs ${path.basename(s.parity)}: ${d} differ of ${base.length}`;
  }
  status[s.name] = ok ? `parity ok (${msg})` : `EXCLUDED, parity failed (${msg})`;
  if (!ok) delete data[s.name];
}

// ---- report
const L = [];
const kept = sets.filter((s) => data[s.name]);
L.push('# cut-off what-if: LOWER_MIN_P, mode a, rwxlite 0.2.0 fp32\n');
L.push('## parity / inclusion');
for (const s of sets) L.push(`- ${s.name}${TRAINED.has(s.name) ? ' [in rwxlite training]' : ''}: ${status[s.name]}`);
const block = (title, names) => {
  L.push(`\n## ${title}\n`);
  L.push('| cut-off | N | exact | too loose | too tight | lowered | leaks added vs 0.97 | leaks closed vs 0.97 |');
  L.push('|---|---|---|---|---|---|---|---|');
  const base = {}; for (const n of names) base[n] = new Map(data[n][0.97].map((r) => [r.id, r]));
  for (const c of CUTS) {
    const agg = { n: 0, exact: 0, loose: 0, tight: 0, lowered: 0 }; let added = 0, closed = 0;
    for (const n of names) {
      const t = tally(data[n][c]); for (const k of Object.keys(agg)) agg[k] += t[k];
      for (const r of data[n][c]) { const b = base[n].get(r.id); if (r.outcome === 'loose' && b.outcome !== 'loose') added++; if (r.outcome !== 'loose' && b.outcome === 'loose') closed++; }
    }
    L.push(`| ${c.toFixed(2)} | ${agg.n} | ${agg.exact} (${pct(agg.exact, agg.n)}) | ${agg.loose} (${pct(agg.loose, agg.n)}) | ${agg.tight} (${pct(agg.tight, agg.n)}) | ${agg.lowered} | ${added} | ${closed} |`);
  }
};
for (const s of kept) block(`${s.name}${TRAINED.has(s.name) ? ' [in training]' : ''}`, [s.name]);
const all = kept.map((s) => s.name), clean = all.filter((n) => !TRAINED.has(n));
block(`POOLED, all included sets (${all.join(', ')})`, all);
block(`POOLED WITHOUT training sets (${clean.join(', ')})`, clean);

// added leaks, per cut-off, rows listed
const kind = (r) => `${r.truth}->${r.letter}`;
for (const c of CUTS) {
  if (c === 0.97) continue;
  L.push(`\n## leaks added at ${c.toFixed(2)} vs 0.97 (truth->letter), all rows\n`);
  const rowsOut = [];
  for (const n of kept.map((s) => s.name)) {
    const b = new Map(data[n][0.97].map((r) => [r.id, r]));
    for (const r of data[n][c]) {
      const bb = b.get(r.id);
      if (r.outcome === 'loose' && bb.outcome !== 'loose') rowsOut.push({ n, r, was: bb });
    }
  }
  const by = {}; for (const x of rowsOut) by[kind(x.r)] = (by[kind(x.r)] || 0) + 1;
  L.push(`total ${rowsOut.length}; by kind: ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}; of which in training sets: ${rowsOut.filter((x) => TRAINED.has(x.n)).length}\n`);
  if (rowsOut.length) {
    L.push('| set | id | provider | method | path | truth | letter | kind | p(accepted letter) | at 0.97 was |');
    L.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const { n, r, was } of rowsOut) L.push(`| ${n}${TRAINED.has(n) ? '*' : ''} | ${r.id} | ${r.provider} | ${r.method} | ${r.path} | ${r.truth} | ${r.letter} | ${kind(r)} | ${Number(r.rw_p).toFixed(4)} | ${was.letter} (${was.outcome}) |`);
  }
  // closed
  const closedRows = [];
  for (const n of kept.map((s) => s.name)) {
    const b = new Map(data[n][0.97].map((r) => [r.id, r]));
    for (const r of data[n][c]) { const bb = b.get(r.id); if (r.outcome !== 'loose' && bb.outcome === 'loose') closedRows.push(`${n}/${r.id} ${r.provider} ${r.method} ${r.path} truth ${r.truth}: ${bb.letter} -> ${r.letter}`); }
  }
  L.push(`\nclosed at ${c.toFixed(2)} (leaks at 0.97 that are not leaks now): ${closedRows.length}`);
  closedRows.forEach((x) => L.push(`- ${x}`));
}
// 0.99 direction: rows that were lowered at 0.97 and are not now (added leaks negative) are in the 'closed' list above.
fs.writeFileSync(path.join(OUT, 'report.md'), L.join('\n') + '\n');
console.log(L.join('\n'));
