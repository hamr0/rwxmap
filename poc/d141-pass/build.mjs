// Builds data/export-v4-d141-2026-11-19/. Usage: node build.mjs [outdir]  (run validate.mjs and merge.mjs first)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './validate.mjs';
import { leanAll, parsePrefix } from './lean.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const OUT = resolve(process.argv[2] || join(root, 'data/export-v4-d141-2026-11-19'));
const LITE = '/home/hamr/PycharmProjects/rwxlite/data/';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvLine = (a) => a.map(csvCell).join(',') + '\r\n';
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const inputs = {};
const rd = (label, path, gz) => { const b = readFileSync(path); inputs[label] = sha(b); return gz ? gunzipSync(b).toString('utf8') : b.toString('utf8'); };

// round13 rows
const rows = [];
for (const split of ['train', 'val'])
  for (const l of rd(`rwxlite/data/round13/${split}.jsonl`, LITE + `round13/${split}.jsonl`).split('\n').filter(Boolean)) {
    const j = JSON.parse(l); rows.push({ id: j.id, split, label: j.label, text: j.text });
  }
rows.sort((a, b) => (a.split < b.split ? -1 : a.split > b.split ? 1 : byId(a, b)));
if (new Set(rows.map((r) => r.id)).size !== rows.length) throw new Error('duplicate ids across train/val');

// merged D141 labels
const merged = new Map();
{
  const m = parseCsv(rd('poc/d141-pass/merged.csv', join(here, 'merged.csv')));
  for (const r of m.slice(1)) merged.set(r[0], { split: r[1], fam: r[2], old: r[3], letter: r[4], conf: r[5], nw: r[6], ch: r[7], reason: r[8] });
  rd('poc/d141-pass/candidates.csv', join(here, 'candidates.csv'));
  for (let p = 1; p <= 13; p++) { const n = String(p).padStart(2, '0'); rd(`poc/d141-pass/out/part-${n}.csv`, join(here, 'out', `part-${n}.csv`)); }
}
const promptSha = sha(readFileSync(join(here, 'LABEL-PROMPT.md')));
if (promptSha !== '6688192669b5e4ed9fad653b312be83f565d5bb4f06240d10ac9ebb37aabe524') throw new Error('LABEL-PROMPT.md sha mismatch ' + promptSha);

// original ops per id
const ops = new Map();
const m0 = rd('rwxlite/data/m0/mechanical.jsonl.gz', LITE + 'm0/mechanical.jsonl.gz', true);
for (const l of m0.split('\n').filter(Boolean)) { const j = JSON.parse(l); ops.set(j.id, { src: 'm0', o: j }); }
const fromCsv = (src, label, path, gz) => {
  const t = parseCsv(rd(label, path, gz)); const h = t[0], ix = Object.fromEntries(h.map((n, i) => [n, i]));
  for (const r of t.slice(1)) { if (r.length !== h.length) throw new Error(src + ' bad row ' + r[0]); ops.set(r[0], { src, o: { method: r[ix.method], path: r[ix.path], operationId: r[ix.operationId], summary: r[ix.summary], description: r[ix.description] } }); }
};
fromCsv('exam3', 'data/exam3-2026-11-04/ops.csv', join(root, 'data/exam3-2026-11-04/ops.csv'));
fromCsv('exam4', 'data/exam4-2026-11-04/ops.csv', join(root, 'data/exam4-2026-11-04/ops.csv'));
fromCsv('fresh', 'data/rwxlite-fresh-2026-11-03/ops.csv.gz', join(root, 'data/rwxlite-fresh-2026-11-03/ops.csv.gz'), true);

const wantSrc = (id) => (id.startsWith('ag-') ? 'm0' : id.startsWith('ex3-') ? 'exam3' : id.startsWith('ex4-') ? 'exam4' : id.startsWith('fx-') ? 'fresh' : null);
const resolved = rows.map((r) => { const e = ops.get(r.id); return e && e.src === wantSrc(r.id) ? e : null; });
const idx = [], opsList = [];
resolved.forEach((e, i) => { if (e) { idx.push(i); opsList.push(e.o); } });
const leans = leanAll(opsList);
const lean = new Array(rows.length).fill(null);
idx.forEach((i, k) => { lean[i] = leans[k]; });

const qIdx = [], qOps = [];
rows.forEach((r, i) => { const mm = /^(ag-\d+)-q$/.exec(r.id); if (!mm) return; const e = ops.get(mm[1]); if (e && e.src === 'm0') { qIdx.push(i); qOps.push({ ...e.o, method: 'QUERY' }); } });
const qLeans = leanAll(qOps);
const isQ = new Array(rows.length).fill(false);
qIdx.forEach((i, k) => { lean[i] = qLeans[k]; isQ[i] = true; });

const srcCount = { m0: 0, m0q: 0, exam3: 0, exam4: 0, fresh: 0, missing: 0 };
const q = { differ: 0 };
const stale = { train: 0, val: 0 }, staleLetter = { train: 0, val: 0 }, nopre = { train: 0, val: 0 }; const staleEx = [], staleRules = {};
let csv = csvLine(['id', 'split', 'label_v4', 'label_d141', 'changed', 'd141_families', 'd141_confidence', 'lean_letter', 'lean_rule', 'lean_source']);
const RANK = { r: 0, w: 1, x: 2 }; const lowerNA = { n: 0, fam: {} };
const chg = { train: [], val: [] }; const cnt = { cand: 0, candTrain: 0, candVal: 0, changed: 0 };
rows.forEach((r, i) => {
  const m = merged.get(r.id);
  if (m) {
    if (m.split !== r.split || m.old !== r.label) throw new Error(`merged mismatch for ${r.id}: ${m.split}/${m.old} vs ${r.split}/${r.label}`);
    cnt.cand++; cnt[r.split === 'train' ? 'candTrain' : 'candVal']++;
  }
  if (m && RANK[m.letter] < RANK[m.old]) { lowerNA.n++; for (const f of m.fam) { const k = `${f} ${m.old}->${m.letter}`; lowerNA.fam[k] = (lowerNA.fam[k] || 0) + 1; } }
  const nw = m ? m.nw : r.label, ch = nw !== r.label ? 1 : 0;
  if (ch) { cnt.changed++; chg[r.split].push({ id: r.id, a: r.label, b: nw, f: m.fam, reason: m.reason }); }
  const L = lean[i], s = isQ[i] ? 'm0q' : resolved[i] ? resolved[i].src : 'missing';
  srcCount[s]++;
  if (L) {
    const p = parsePrefix(r.text);
    if (!p) nopre[r.split]++;
    else if (p.letter !== L.lean_letter || p.rule !== L.lean_rule) {
      if (isQ[i]) q.differ++;
      stale[r.split]++; if (p.letter !== L.lean_letter) staleLetter[r.split]++;
      const k = `${p.letter} ${p.rule} -> ${L.lean_letter} ${L.lean_rule}`; staleRules[k] = (staleRules[k] || 0) + 1;
      if (staleEx.length < 10) staleEx.push(`${r.id} ${k}`);
    }
  }
  csv += csvLine([r.id, r.split, r.label, nw, ch, m ? m.fam : '', m ? m.conf : '', L ? L.lean_letter : '', L ? L.lean_rule : '', s]);
});

mkdirSync(OUT, { recursive: true });
const files = {};
const put = (name, content) => { writeFileSync(join(OUT, name), content); const h = sha(Buffer.from(content)); files[name] = h; writeFileSync(join(OUT, name + '.sha256'), `${h}  ${name}\n`); };
put('export-v4-d141.csv', csv);
for (const s of ['train', 'val']) {
  let c = csvLine(['id', 'label_v4', 'label_d141', 'd141_families', 'reason']);
  for (const x of chg[s].sort(byId)) c += csvLine([x.id, x.a, x.b, x.f, x.reason]);
  put(`changed-${s}.csv`, c);
}

const topRules = Object.entries(staleRules).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `- ${k}: ${v}`).join('\n');
const moves = {}; for (const s of ['train', 'val']) for (const x of chg[s]) { const k = `${s} ${x.a}->${x.b}`; moves[k] = (moves[k] || 0) + 1; }
const readme = `# export-v4-d141 (2026-11-19)

Purpose: the D141 relabel of rwxlite's round13 train and val rows, with the mechanical lean recomputed for each row.
D141 relabel: the BRIEF-v4 addendum (commit 54355e1) applied to ${cnt.cand} candidate rows picked by the rwxlite net
(\`poc/d141-pass/rwxlite-net.md\`, \`pattern-net.json\`), labelled blind in 13 parts with \`poc/d141-pass/LABEL-PROMPT.md\`
(sha256 6688192669b5e4ed9fad653b312be83f565d5bb4f06240d10ac9ebb37aabe524).

This is an addition. No existing file was changed; round13 train.jsonl and val.jsonl are untouched and the labeller outputs are used as delivered.

## Files
- export-v4-d141.csv: one row per round13 train and val id (${rows.length}), sorted by split then id. Columns: id, split, label_v4 (round13 label), label_d141 (merged label; equals label_v4 for non-candidates), changed (0/1), d141_families, d141_confidence (candidates only), lean_letter, lean_rule, lean_source (m0, m0q, exam3, exam4, fresh, missing).
- changed-train.csv, changed-val.csv: id, label_v4, label_d141, d141_families, reason (labeller's reason).
- *.sha256: sha256 of each of the three CSVs.

## Merge rule
Tighten-only: label_d141 = the tighter (x > w > r) of label_v4 and the labeller letter, whatever the confidence. The pass may raise a label but never lowers one. Reason: export-v4 labels are user-ruled truth (D137), and a single blind labeller's opinion does not overrule it. Reading the 183 lowered rows of the earlier merge showed 103 that were not D141 cases (unban/unlock/enable user, soft deletes, GitHub Actions permission sets), and the group-family lowers were mostly calendar accept/decline calls under /groups. D141(c) "plain group update is w" applies to exam #7 labelling and later; it is not used to lower existing truth here. The labeller's letter stays visible in poc/d141-pass/merged.csv (column labeller_letter), so the rejected lowers can be read.
Lowers not applied: ${lowerNA.n} (candidate rows where the labeller letter is looser than label_v4; by family and move, a row in several families counts in each: ${Object.keys(lowerNA.fam).sort().map((k) => `${k} ${lowerNA.fam[k]}`).join('; ')}). Non-candidates keep label_v4.

## Lean rule and sources
lean_letter and lean_rule come from rwxmap's shipped \`src/exporter.js\` classifyOperations (src/ is identical to commit 1c25be1; \`git diff 1c25be1 -- src/\` is empty), on the original operation (method upper-cased, path, and operationId/summary/description when non-empty), exactly as rwxlite r15/label_mech.mjs builds them. lean_rule is the rule as it appears in the text prefix, so rule credential-set is written cant-undo-verb (rwxlite src/text.js alias). Computed by \`poc/d141-pass/lean.mjs\`.
Reproduction check first: 2000 rows (every 99th) of rwxlite data/r15/labels/final-labels-r15-d141.csv.gz against the prefixes in texts-r15.jsonl: 2000 match, 0 mismatch (\`repro-lean.mjs\`).
Original operation sources: ag- ids from rwxlite data/m0/mechanical.jsonl.gz (m0); ex3- from data/exam3-2026-11-04/ops.csv (exam3); ex4- from data/exam4-2026-11-04/ops.csv (exam4); fx- from data/rwxlite-fresh-2026-11-03/ops.csv.gz (fresh). QUERY copies: ids ag-N-q are QUERY copies of ag-N; their lean is computed from the base ag-N op in m0 with the method set to QUERY (lean_source=m0q): ${srcCount.m0q} rows, ${q.differ} differ from the stored prefix (letter or rule). Unresolved: lean_source=missing, lean fields empty (${srcCount.missing} rows).

## Counts
- rows: ${rows.length} (train ${rows.filter((r) => r.split === 'train').length}, val ${rows.filter((r) => r.split === 'val').length})
- candidates: ${cnt.cand} (train ${cnt.candTrain}, val ${cnt.candVal}); changed: ${cnt.changed} (train ${chg.train.length}, val ${chg.val.length})
- changed by family and move (a row in several families counts in each): ${(() => { const f = {}; for (const s of ['train', 'val']) for (const x of chg[s]) for (const fa of x.f) { const k = `${fa} ${x.a}->${x.b}`; f[k] = (f[k] || 0) + 1; } return Object.keys(f).sort().map((k) => `${k} ${f[k]}`).join('; '); })()}
- moves: ${Object.keys(moves).sort().map((k) => `${k} ${moves[k]}`).join('; ')}
- lean_source: m0 ${srcCount.m0}, m0q ${srcCount.m0q}, exam3 ${srcCount.exam3}, exam4 ${srcCount.exam4}, fresh ${srcCount.fresh}, missing ${srcCount.missing}
- computed lean differs from the stored round13 text prefix (letter or rule): train ${stale.train}, val ${stale.val} (letter differs: train ${staleLetter.train}, val ${staleLetter.val}); stored prefix unparsable: train ${nopre.train}, val ${nopre.val}
- most common differences (stored -> computed):
${topRules}

## Input sha256
${Object.entries(inputs).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
- poc/d141-pass/LABEL-PROMPT.md: ${promptSha}

## Output sha256
${Object.entries(files).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Rebuild
\`\`\`
cd poc/d141-pass
node validate.mjs && node merge.mjs && node repro-lean.mjs && node build.mjs
\`\`\`
Reads /home/hamr/PycharmProjects/rwxlite/data in place (read-only). Output is deterministic; two runs are byte-identical.
`;
writeFileSync(join(OUT, 'README.md'), readme);
console.log(readme.split('## Counts')[1].split('## Input')[0]);
console.log('stale examples:\n' + staleEx.join('\n'));
console.log(files);
