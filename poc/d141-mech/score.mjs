// Scores candidate words for src/step2.js GET_ACTION (rule get-action) and PATH_X_WORDS (rule path-x-word).
// Measurement only. Run: node poc/d141-mech/score.mjs <candidates.json>
//   candidates.json = {"getAction": [...], "pathXWords": [...]}
// Sets A (export-v4-d141) and B (exam #7) are always scored and reported separately, never pooled.
// Candidate = classifyRow(row, {getAction: GET_ACTION U cand, pathXWords: PATH_X_WORDS U cand}).
// Fires are rows whose class changes (a list word can only raise a row to x).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyRow } from '../../src/flow.js';
import { GET_ACTION, PATH_X_WORDS } from '../../src/step2.js';
import { loadA, loadB, toOp } from './load.mjs';

const RANK = { r: 0, w: 1, x: 2 };
const EXAMPLES = 15;

function wordSets(spec) {
  return {
    getAction: new Set([...GET_ACTION, ...(spec.getAction || [])]),
    pathXWords: new Set([...PATH_X_WORDS, ...(spec.pathXWords || [])]),
  };
}

// Classes for the given row indexes under a word spec; rows whose baseline is x cannot change (lists only raise).
function classesFor(ops, base, idx, spec) {
  const w = wordSets(spec);
  const out = new Map();
  for (const i of idx) out.set(i, base[i] === 'x' ? 'x' : classifyRow(ops[i], w).class);
  return out;
}

/** exact / loose1 / loose2 / tight of predicted classes against truth. */
export function tally(rows, classes) {
  const t = { n: rows.length, exact: 0, loose1: 0, loose2: 0, tight: 0 };
  rows.forEach((r, i) => {
    const d = RANK[classes[i]] - RANK[r.truth];
    if (d === 0) t.exact++; else if (d === -1) t.loose1++; else if (d <= -2) t.loose2++; else t.tight++;
  });
  return t;
}

function kindOf(truth, from) {
  if (truth === 'x') return from === 'r' ? 'loose2Closed' : 'loose1Closed';
  if (truth === 'r' && from === 'r') return 'tightFromR';
  if (truth === 'w' && from === 'w') return 'tightFromW';
  return 'wrongOther';
}
const newKinds = () => ({ loose2Closed: 0, loose1Closed: 0, tightFromR: 0, tightFromW: 0, wrongOther: 0 });

// Fires of one spec over all rows: [{i, from, to, kind, right}]
function fires(rows, ops, base, spec) {
  const cls = classesFor(ops, base, rows.map((_, i) => i), spec);
  const out = [];
  for (const [i, c] of cls) {
    if (c !== base[i]) out.push({ i, from: base[i], to: c, kind: kindOf(rows[i].truth, base[i]), right: rows[i].truth === 'x' });
  }
  return out;
}

function perVendor(rows, fl) {
  const pv = new Map();
  for (const f of fl) {
    const v = rows[f.i].vendor;
    if (!pv.has(v)) pv.set(v, { right: 0, wrong: 0 });
    pv.get(v)[f.right ? 'right' : 'wrong']++;
  }
  return pv;
}

/**
 * Score one set. rows: load.mjs rows. cand: {getAction, pathXWords}.
 * Returns per-word results, the joint result (all words), LOVO results and totals.
 */
export function scoreSet(rows, cand) {
  const ops = rows.map(toOp);
  const base = ops.map((o) => classifyRow(o).class);
  const words = [
    ...[...new Set(cand.getAction || [])].map((w) => ({ word: w, list: 'getAction' })),
    ...[...new Set(cand.pathXWords || [])].map((w) => ({ word: w, list: 'pathXWords' })),
  ];
  const vendors = [...new Set(rows.map((r) => r.vendor))].sort();

  for (const w of words) {
    w.inList = (w.list === 'getAction' ? GET_ACTION : PATH_X_WORDS).has(w.word);
    w.fires = fires(rows, ops, base, { [w.list]: [w.word] });
    w.right = w.fires.filter((f) => f.right).length;
    w.wrong = w.fires.length - w.right;
    w.kinds = newKinds(); for (const f of w.fires) w.kinds[f.kind]++;
    w.pv = perVendor(rows, w.fires);
    w.rightVendors = [...w.pv.values()].filter((v) => v.right > 0).length;
    // LOVO: adopt for vendor V only if on all other vendors pooled right > wrong and right >= 1.
    w.lovo = { right: 0, wrong: 0, adoptedIn: 0 };
    w.adoptedFor = new Set();
    for (const V of vendors) {
      const v = w.pv.get(V) || { right: 0, wrong: 0 };
      const oR = w.right - v.right, oW = w.wrong - v.wrong;
      if (oR > oW && oR >= 1) { w.adoptedFor.add(V); w.lovo.right += v.right; w.lovo.wrong += v.wrong; w.lovo.adoptedIn++; }
    }
  }

  // Joint: every word together, fitted.
  const all = { getAction: cand.getAction || [], pathXWords: cand.pathXWords || [] };
  const jointFires = fires(rows, ops, base, all);
  const fitted = base.slice(); for (const f of jointFires) fitted[f.i] = f.to;
  const jointKinds = newKinds(); for (const f of jointFires) jointKinds[f.kind]++;

  // Joint LOVO: per vendor, only the words adopted for that vendor, applied to its rows.
  const byVendor = new Map(); rows.forEach((r, i) => { if (!byVendor.has(r.vendor)) byVendor.set(r.vendor, []); byVendor.get(r.vendor).push(i); });
  const lovoCls = base.slice();
  const lovoKinds = newKinds(); let lovoFires = 0;
  for (const V of vendors) {
    const spec = { getAction: words.filter((w) => w.list === 'getAction' && w.adoptedFor.has(V)).map((w) => w.word),
                   pathXWords: words.filter((w) => w.list === 'pathXWords' && w.adoptedFor.has(V)).map((w) => w.word) };
    if (!spec.getAction.length && !spec.pathXWords.length) continue;
    for (const [i, c] of classesFor(ops, base, byVendor.get(V), spec)) {
      if (c !== base[i]) { lovoCls[i] = c; lovoKinds[kindOf(rows[i].truth, base[i])]++; lovoFires++; }
    }
  }
  return {
    n: rows.length, words, vendors, base, ops,
    joint: { fires: jointFires.length, right: jointFires.filter((f) => f.right).length, kinds: jointKinds },
    lovo: { fires: lovoFires, kinds: lovoKinds, right: lovoKinds.loose1Closed + lovoKinds.loose2Closed, wrong: lovoFires - lovoKinds.loose1Closed - lovoKinds.loose2Closed },
    totals: { baseline: tally(rows, base), fitted: tally(rows, fitted), lovo: tally(rows, lovoCls) },
  };
}

// ---------- formatting ----------
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
const tl = (name, t) => `  ${name.padEnd(9)} exact ${t.exact} (${pct(t.exact, t.n)})  too loose ${t.loose1 + t.loose2} (loose-1 ${t.loose1}, loose-2 ${t.loose2})  too tight ${t.tight}  of ${t.n}`;
const kl = (k) => `loose-2 closed ${k.loose2Closed}, loose-1 closed ${k.loose1Closed}, new too-tight from r ${k.tightFromR}, new too-tight from w ${k.tightFromW}, other wrong ${k.wrongOther}`;

export function format(setName, rows, res) {
  const L = [];
  L.push(`################ SET ${setName} (${res.n} rows, ${res.vendors.length} vendors) ################`);
  L.push('Right = fire on a truth-x row; wrong = fire on a truth r or w row. Fires = rows whose class changes (counts are true counts, never capped by the example sample).');
  L.push('A word whose right fires all come from ONE vendor gets nothing under LOVO: it is not adopted for that vendor (no other vendor backs it) and for every other vendor it has no rows to fire on.');
  L.push('Note: LOVO neutralises single-vendor words by construction.');
  L.push('', 'TOTALS (this set only)');
  L.push(tl('baseline', res.totals.baseline), tl('fitted', res.totals.fitted), tl('LOVO', res.totals.lovo));
  L.push(`  joint fitted fires ${res.joint.fires} (right ${res.joint.right}, wrong ${res.joint.fires - res.joint.right}): ${kl(res.joint.kinds)}`);
  L.push(`  joint LOVO fires ${res.lovo.fires} (right ${res.lovo.right}, wrong ${res.lovo.wrong}): ${kl(res.lovo.kinds)}`);
  for (const w of res.words) {
    L.push('', `--- ${setName} / ${w.list} / "${w.word}"${w.inList ? '  (ALREADY in the shipped list: no-op)' : ''} ---`);
    L.push(`  fires ${w.fires.length}: right ${w.right}, wrong ${w.wrong}; ${kl(w.kinds)}`);
    L.push(`  distinct vendors with a right fire: ${w.rightVendors}`);
    L.push(`  LOVO: adopted for ${w.lovo.adoptedIn} of ${res.vendors.length} vendors, right ${w.lovo.right}, wrong ${w.lovo.wrong}` +
      (w.right > 0 && w.rightVendors === 1 ? '  [all right fires from one vendor: nothing under LOVO]' : ''));
    const pv = [...w.pv.entries()].sort((a, b) => (b[1].right - a[1].right) || (a[0] < b[0] ? -1 : 1));
    L.push('  per vendor (right/wrong): ' + (pv.length ? pv.map(([v, c]) => `${v} ${c.right}/${c.wrong}`).join(', ') : '(none)'));
    for (const [label, isRight] of [['right', true], ['wrong', false]]) {
      const sel = w.fires.filter((f) => f.right === isRight);
      L.push(`  ${label} examples (${Math.min(EXAMPLES, sel.length)} of ${sel.length}):`);
      for (const f of sel.slice(0, EXAMPLES)) {
        const r = rows[f.i];
        L.push(`    ${r.id} | ${r.vendor} | ${r.method} ${r.path} | ${r.summary} | truth ${r.truth} ${f.from}->${f.to}`);
      }
    }
  }
  return L.join('\n');
}

// ---------- main ----------
async function main() {
  const file = process.argv[2];
  if (!file) { console.error('usage: node poc/d141-mech/score.mjs <candidates.json>'); process.exit(1); }
  const cand = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const k of ['getAction', 'pathXWords']) {
    if (!Array.isArray(cand[k]) || cand[k].some((w) => typeof w !== 'string' || !w)) throw new Error(`candidates.${k} must be an array of non-empty strings`);
  }
  const out = [];
  const P = (s) => { out.push(s); console.log(s); };
  const a = loadA(), b = loadB();
  P(`candidates: ${file}  getAction ${cand.getAction.length}, pathXWords ${cand.pathXWords.length}`);
  P(`set A join: ${JSON.stringify(a.report)}  rows scored ${a.rows.length}`);
  P(`set B join: ${JSON.stringify(b.report)}  (truth source: ${b.report.truthSource})`);
  // Parity: today's src must equal the export's lean on every non-QUERY row of A.
  let mism = 0; const bad = [];
  for (const r of a.rows) { const c = classifyRow(toOp(r)).class; if (c !== r.lean_letter) { mism++; if (bad.length < 10) bad.push(`${r.id} src=${c} lean=${r.lean_letter}`); } }
  P(`parity check, set A baseline letter vs export lean_letter: ${mism} mismatches of ${a.rows.length}`);
  if (mism) { for (const l of bad) P('  ' + l); console.error('STOP: src differs from the export lean'); process.exit(2); }
  const ra = scoreSet(a.rows, cand); const rb = scoreSet(b.rows, cand);
  P(''); P(format('A', a.rows, ra)); P(''); P(format('B', b.rows, rb));
  P(''); P(`changes vs baseline (joint fitted): A ${ra.joint.fires}, B ${rb.joint.fires}`);
  finish(file, out);
}
function finish(file, out) {
  const dir = fileURLToPath(new URL('./out/', import.meta.url));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `score-${path.basename(file, '.json')}.txt`), out.join('\n') + '\n');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
