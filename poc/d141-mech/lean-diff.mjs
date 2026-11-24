// Lean diff for rwxlite: the pre-D144 lean against the lean from today's src (D144 in step2.js), on two sets.
// Never reads exam #8. Writes only poc/d141-mech/out/lean-diff-{exam7,export}.csv. Exit 1 on any error.
//   (a) exam #7: old = data/exam7-2026-11-19/lean/lean.csv (built at 96ebb46); new = classifyOperations on ops.csv.
//   (b) export-v4-d141 (all 106,848 rows, QUERY copies included): old = its lean_letter / lean_rule columns;
//       new = rebuilt the way poc/d141-pass/build.mjs built it (same leanAll, same op sources, QUERY copies from the
//       base ag- op with the method set to QUERY).
// A differing row is accepted only if it is a D144 change: new rule get-action or path-x-word, and step2's own
// `matched` list for the row holds only D144 words (refresh / verify, callback, login). Anything else is an error.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../tools/csv.js';
import { leanAll, buildOp } from '../d141-pass/lean.mjs';
import { step2 } from '../../src/step2.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'poc/d141-mech/out/';
const MECH = '/home/hamr/PycharmProjects/rwxlite/data/m0/mechanical.jsonl.gz';
const RANK = { r: 0, w: 1, x: 2 };
const D144 = { 'get-action': new Set(['refresh']), 'path-x-word': new Set(['verify', 'callback', 'login']) };
const READ = new Set(['GET', 'HEAD', 'OPTIONS', 'QUERY']);

const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };
const text = (p) => { const b = fs.readFileSync(p); return (p.endsWith('.gz') ? zlib.gunzipSync(b) : b).toString('utf8'); };
const csv = (rel) => parseCsv(text(ROOT + rel));
const enc = (s) => (/[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
const fmt = (m) => [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, n]) => `    ${k}: ${n}`).join('\n') || '    (none)';

/** rows: [{id, op (method,path,...), old_letter, old_rule}] -> report, writes `outFile`; returns the error count. */
function compare(name, rows, outFile) {
  const news = leanAll(rows.map((r) => r.op));
  if (news.length !== rows.length) fail(`${name}: lean length ${news.length} != ${rows.length}`);
  const letters = new Map(), ruleOnly = new Map(), changed = [];
  const errors = [];
  let lowered = 0;
  const oldRules = new Set(), newRules = new Set();
  rows.forEach((r, i) => {
    const n = news[i];
    if (!(n.lean_letter in RANK) || !(r.old_letter in RANK)) { errors.push(`${r.id}: bad letter old ${r.old_letter} new ${n.lean_letter}`); return; }
    oldRules.add(r.old_rule); newRules.add(n.lean_rule);
    if (n.lean_letter === r.old_letter && n.lean_rule === r.old_rule) return;
    changed.push({ r, n });
    if (n.lean_letter !== r.old_letter) {
      bump(letters, `${r.old_letter}->${n.lean_letter}`);
      if (RANK[n.lean_letter] < RANK[r.old_letter]) lowered++;
    } else bump(ruleOnly, `${r.old_letter} ${r.old_rule} -> ${n.lean_rule}`);
    // D144 check: the change must come from one of the four words.
    const words = D144[n.lean_rule];
    const m = String(r.op.method).toUpperCase();
    if (!words) { errors.push(`${r.id} ${m} ${r.op.path}: changed to rule ${n.lean_rule}, not a D144 rule`); return; }
    if (words === D144['get-action'] ? !READ.has(m) : READ.has(m) || m === 'DELETE') { errors.push(`${r.id} ${m} ${r.op.path}: rule ${n.lean_rule} on method ${m}`); return; }
    const s = step2(r.op);
    const matched = s && s.rule === n.lean_rule ? s.matched : [];
    if (!matched.length || !matched.every((w) => words.has(w))) errors.push(`${r.id} ${m} ${r.op.path}: matched [${matched.join(',')}] is not only D144 words`);
  });
  const lines = ['id,method,path,old_letter,old_rule,new_letter,new_rule'];
  for (const { r, n } of changed) lines.push([r.id, String(r.op.method).toUpperCase(), r.op.path, r.old_letter, r.old_rule, n.lean_letter, n.lean_rule].map(enc).join(','));
  fs.writeFileSync(OUT + outFile, lines.join('\n') + '\n');
  const brandNew = [...newRules].filter((x) => !oldRules.has(x)).sort();
  console.log(`== ${name} ==`);
  console.log(`rows checked: ${rows.length}; changed: ${changed.length} (written to poc/d141-mech/out/${outFile})`);
  console.log(`letter changes (old->new): ${[...letters].reduce((a, [, n]) => a + n, 0)}\n${fmt(letters)}`);
  console.log(`rule-only changes (same letter), old_rule -> new_rule: ${[...ruleOnly].reduce((a, [, n]) => a + n, 0)}\n${fmt(ruleOnly)}`);
  console.log(`lowered letters: ${lowered}`);
  console.log(brandNew.length ? `new rule names not in the old lean: ${brandNew.join(', ')}` : 'new rule names not in the old lean: none');
  if (lowered) errors.push(`${lowered} lowered letters`);
  if (errors.length) { console.error(`${name}: ${errors.length} ERRORS (first 20):\n  ` + errors.slice(0, 20).join('\n  ')); }
  return { errors: errors.length, changed };
}

// ---- (a) exam #7
const ops7 = csv('data/exam7-2026-11-19/ops.csv');
const lean7 = new Map(csv('data/exam7-2026-11-19/lean/lean.csv').map((r) => [r.id, r]));
if (lean7.size !== ops7.length) fail(`exam7: lean rows ${lean7.size} != ops ${ops7.length}`);
const rows7 = ops7.map((o) => {
  const l = lean7.get(o.id);
  if (!l) fail('exam7: no old lean for ' + o.id);
  return { id: o.id, op: buildOp(o), old_letter: l.lean_letter, old_rule: l.lean_rule };
});
const r7 = compare('exam #7 (old lean built at 96ebb46)', rows7, 'lean-diff-exam7.csv');

// ---- (b) the full export
const exp = csv('data/export-v4-d141-2026-11-19/export-v4-d141.csv');
const m0 = new Map();
for (const line of text(MECH).split('\n')) if (line) { const j = JSON.parse(line); m0.set(j.id, j); }
const files = { ex3: 'data/exam3-2026-11-04/ops.csv', ex4: 'data/exam4-2026-11-04/ops.csv', fx: 'data/rwxlite-fresh-2026-11-03/ops.csv.gz' };
const srcs = {};
for (const [k, f] of Object.entries(files)) srcs[k] = new Map(csv(f).map((r) => [r.id, r]));
let nQuery = 0;
const rowsE = exp.map((e) => {
  const mq = /^(ag-\d+)-q$/.exec(e.id);
  let o;
  if (mq) { const b = m0.get(mq[1]); if (!b) fail('export: no base op for ' + e.id); o = { ...b, method: 'QUERY' }; nQuery++; }
  else { const p = e.id.split('-')[0]; o = p === 'ag' ? m0.get(e.id) : srcs[p]?.get(e.id); }
  if (!o) fail('export: no source op for ' + e.id);
  if (e.lean_letter === '' || e.lean_rule === '') fail('export: empty old lean for ' + e.id);
  return { id: e.id, op: buildOp(o), old_letter: e.lean_letter, old_rule: e.lean_rule };
});
console.log(`export rows ${rowsE.length}, of which QUERY copies ${nQuery}`);
const rE = compare('export-v4-d141, all rows incl. QUERY copies (old lean = its columns, built at 1c25be1)', rowsE, 'lean-diff-export.csv');
const qChanged = rE.changed.filter((c) => /-q$/.test(c.r.id)).length;
console.log(`changed rows that are QUERY copies: ${qChanged}`);

if (r7.errors + rE.errors) fail(`${r7.errors + rE.errors} errors`);
console.log('OK: every differing row is a D144 change (new rule get-action or path-x-word, matched only refresh/verify/callback/login); 0 other differences');
