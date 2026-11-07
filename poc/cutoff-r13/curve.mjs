// Cut-off curve for rwxlite R13 vs 0.2.0 through poc/replay-r12/replay.mjs --lower-min-p.
// Usage (scratch cwd, no .env): node curve.mjs <scratchdir> <readout-copy-path>
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.resolve(process.argv[2] || '.');
const COPY = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const LITE = '/home/hamr/PycharmProjects/rwxlite/data/exam5-2026-11-07';
const E5 = `${REPO}/data/exam5-2026-11-07`, VAL = `${REPO}/.claude/scratchpad/rwxlite-val`;
const sets = [
  { name: 'exam5', ops: [`${E5}/ops.csv`], truth: [`${E5}/truth.csv`, '772ca84edf1e537f5e9b162229f59e3b0c439e55ba8f6f21f3070e058c70005a'],
    models: { R13: [`${LITE}/predictions-r13.csv`, '1633417853a141cab079513dc78e8b538714bd6f46b729adb95876b34d3a73de', 'rwxlite-0.3.1+bbe1997d', `${E5}/score/rows-a-r13-v4.csv`, [1220, 37, 186]],
              '0.2.0': [`${LITE}/predictions-v020.csv`, '906c0edd1a237172b3e08884f87faa538be7aacee64a633399f55905aa14f162', 'rwxlite-0.2.0+8503b655', `${E5}/score/rows-a-020-v4.csv`, [1272, 94, 77]] } },
  { name: 'val', ops: [`${VAL}/ops.csv`, 'efa3c5d9009757cd24f8ab75c440f7787adab3eea57bf1b8dae80c99b3339413'], truth: [`${VAL}/val-truth.csv`, '0281ff33daf43f64629850e4c5425f224c124d5ba5a1b70b53fe371ff5f66ec5'],
    models: { R13: [`${VAL}/predictions-r13-val.csv`, '6154fe749717a0bade4d4028f87cb196663d3b28d8da01a448d7ef12d1e6cdf0', null, null, [3815, 76, 289]],
              '0.2.0': [`${VAL}/predictions-v020-val.csv`, '6cf5b76ce6a6cca8a05cc9c59c8c9d73350e09c148ddead39680dcf83fd43af1', null, null, [3821, 192, 167]] } },
];
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const check = (f, want) => { if (want && sha(f) !== want) { console.error(`REFUSE: sha256 mismatch ${f}`); process.exit(2); } };
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
const pct = (n, d) => `${(100 * n / d).toFixed(2)}%`;
const RANK = { r: 0, w: 1, x: 2 };
const CUTS = [0.99, 0.97, 0.95, 0.93, 0.90, 0.85, 0.80];
const L = []; const P = (s = '') => { L.push(s); console.log(s); };
let parityFail = false;
const data = {}; // data[set][model][cut] = {rows, undecided}

for (const s of sets) {
  check(s.ops[0], s.ops[1]); check(s.truth[0], s.truth[1]);
  data[s.name] = {};
  for (const [mn, m] of Object.entries(s.models)) {
    check(m[0], m[1]);
    const preds = rd(m[0]);
    const jl = preds.map((r) => { if (m[2] && r.model !== m[2]) { console.error(`REFUSE: model ${r.model} != ${m[2]}`); process.exit(2); } return JSON.stringify({ id: r.exid ?? r.id, model: r.model, pIsX: Number(r.p_is_x), pChanges: Number(r.p_changes) }); });
    const pf = path.join(OUT, `p-${s.name}-${mn}.jsonl`); fs.writeFileSync(pf, jl.join('\n') + '\n');
    data[s.name][mn] = {};
    for (const c of CUTS) {
      const rf = path.join(OUT, `rows-${s.name}-${mn}-${c.toFixed(2)}.csv`);
      const r = spawnSync('node', [`${REPO}/poc/replay-r12/replay.mjs`, '--ops', s.ops[0], '--truth', s.truth[0], '--p', pf, '--out', rf, '--lower-min-p', String(c)], { encoding: 'utf8', cwd: process.cwd() });
      fs.writeFileSync(path.join(OUT, `log-${s.name}-${mn}-${c.toFixed(2)}.txt`), r.stdout + (r.stderr || ''));
      if (r.status !== 0) { console.error(`replay failed ${s.name} ${mn} ${c}: exit ${r.status}\n${r.stderr}${r.stdout.slice(-800)}`); process.exit(2); }
      const und = Number(/undecided (\d+)/.exec(r.stdout)[1]);
      data[s.name][mn][c] = { rows: rd(rf), und };
    }
  }
}
const tally = (rows) => { const t = { n: rows.length, exact: 0, l1: 0, l2: 0, tight: 0, lowered: 0 }; for (const r of rows) { const d = RANK[r.letter] - RANK[r.truth]; if (d === 0) t.exact++; else if (d === -1) t.l1++; else if (d <= -2) t.l2++; else t.tight++; if (r.rule === 'rwxlite-lower') t.lowered++; } t.loose = t.l1 + t.l2; return t; };

// ---- parity
P('== PARITY at 0.97 ==');
for (const s of sets) for (const [mn, m] of Object.entries(s.models)) {
  const rows = data[s.name][mn][0.97].rows, t = tally(rows);
  let msg = `${s.name} ${mn}: ${t.exact}/${t.loose}/${t.tight} of ${t.n} vs ${m[4].join('/')}`;
  let ok = t.exact === m[4][0] && t.loose === m[4][1] && t.tight === m[4][2];
  if (m[3]) { const exp = new Map(rd(m[3]).map((r) => [r.id, r])); let d = 0; const dl = []; for (const r of rows) { const e = exp.get(r.id); if (!e || e.letter !== r.letter || e.review !== r.review) { d++; if (dl.length < 20) dl.push(r.id); } } ok = ok && d === 0 && exp.size === rows.length; msg += `; rows vs ${path.basename(m[3])}: ${d} differ of ${rows.length} (expected file ${exp.size} rows)${d ? ' ' + dl.join(' ') : ''}`; }
  P(`${msg} -> ${ok ? 'PASS' : 'FAIL'}`); if (!ok) parityFail = true;
}
if (parityFail) { P('PARITY FAILED: curve not printed'); if (COPY) fs.writeFileSync(COPY, L.join('\n') + '\n'); fs.writeFileSync(path.join(OUT, 'readout.txt'), L.join('\n') + '\n'); process.exit(3); }

// ---- curve
for (const s of sets) for (const mn of Object.keys(s.models)) {
  const base = data[s.name][mn][0.97].rows, bm = new Map(base.map((r) => [r.id, r])), N = base.length;
  P(`\n== ${s.name} / ${mn} (N=${N}) ==`);
  P(['cut', 'exact', 'loose-1', 'loose-2', 'tooLoose', 'tooTight', 'lowered', 'undec', 'leaksAdd', '(%set)', 'tightFixed', '(%set)', 'fixed/leak'].map((x) => x.padStart(10)).join(''));
  for (const c of CUTS) {
    const { rows, und } = data[s.name][mn][c], t = tally(rows);
    let add = 0, fix = 0;
    for (const r of rows) { const b = bm.get(r.id); const lo = (x) => RANK[x.letter] < RANK[x.truth], ti = (x) => RANK[x.letter] > RANK[x.truth]; if (lo(r) && !lo(b)) add++; if (ti(b) && !ti(r)) fix++; }
    P([c.toFixed(2), t.exact, t.l1, t.l2, t.loose, t.tight, t.lowered, und, add, pct(add, N), fix, pct(fix, N), add ? (fix / add).toFixed(2) : (fix ? 'inf' : '-')].map((x) => String(x).padStart(10)).join(''));
  }
}
for (const c of [0.95, 0.90]) {
  const base = new Map(data.exam5.R13[0.97].rows.map((r) => [r.id, r]));
  const rows = data.exam5.R13[c].rows.filter((r) => RANK[r.letter] < RANK[r.truth] && !(RANK[base.get(r.id).letter] < RANK[r.truth]));
  P(`\n== leaks added at ${c.toFixed(2)} vs 0.97, R13 on exam5: ${rows.length} ==`);
  for (const r of rows) P(`${r.id}\t${r.provider}\t${r.method}\t${r.path}\t${r.truth}->${r.letter}\tp=${r.rw_p}\t(at 0.97: ${base.get(r.id).letter})`);
}
fs.writeFileSync(path.join(OUT, 'readout.txt'), L.join('\n') + '\n');
if (COPY) fs.writeFileSync(COPY, L.join('\n') + '\n');
