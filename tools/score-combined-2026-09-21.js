// Scorer for the combined labelled corpus data/combined-2026-09-21. Test/dev
// tooling only — never part of the published library.
//
// DIAGNOSTIC over TUNING data, not an exam. Every source in the combined set
// has been tuned on or scored (the provider corpus is the tuning set, both
// exams are burned — D24), so no number printed here is a generalization
// claim. It reports every step of the classifier, the whole flow, Jev alone
// and flow+Jev over the same rows, with the ledger conventions of
// tools/score-exam-2026-09-20.js: exact / leak / over-tight, counts and % with
// the denominator named, never collapsed, order r < w < x.
//
// The classifier is called from src/ directly; no rule logic is copied here.
// No expected score is hard-coded anywhere in this file.
//
// Inputs (in data/combined-2026-09-21/):
//   rows.json.gz             built by tools/build-combined-2026-09-21.js
//   outA.jsonl[.gz]          raw Jev A output (answers.isX.noul)
//   outB.jsonl[.gz]          raw Jev B output (answers.rwx.choice)
//
// Usage: node tools/score-combined-2026-09-21.js
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { step1 } from '../src/step1.js';
import { step2 } from '../src/step2.js';
import { step3 } from '../src/step3.js';
import { classifyRow } from '../src/flow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DIR = path.join(REPO_ROOT, 'data/combined-2026-09-21');
const ROWS_GZ = path.join(DIR, 'rows.json.gz');

// The raise-only tier's fixed threshold: the value POC A picked on the build
// set, the same one tools/score-exam-2026-09-20.js scored the exam with.
const THRESHOLD = 0.70;
const SWEEP = [0.50, 0.60, 0.70, 0.80, 0.90];
// The adoption bar for a hand raiser: at least BAR leaks closed per false
// alarm. LOVO picks each fold's threshold against it (section 8).
const BAR = 10;

const ORDER = { r: 0, w: 1, x: 2 };
const CLASSES = ['r', 'w', 'x'];
const METHOD_ORDER = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------- loading

function readMaybeGz(base) {
  const plain = path.join(DIR, `${base}.jsonl`);
  const gz = `${plain}.gz`;
  const hasPlain = existsSync(plain);
  const hasGz = existsSync(gz);
  if (hasPlain && hasGz) fail(`both ${base}.jsonl and ${base}.jsonl.gz exist — remove one so it is clear which is scored`);
  if (!hasPlain && !hasGz) fail(`neither ${base}.jsonl nor ${base}.jsonl.gz exists in ${path.relative(REPO_ROOT, DIR)}`);
  const file = hasPlain ? plain : gz;
  const buf = hasPlain ? readFileSync(file) : gunzipSync(readFileSync(file));
  return { file, text: buf.toString('utf8'), sha: createHash('sha256').update(buf).digest('hex') };
}

function loadJsonl(base, name, pick) {
  const { file, text, sha } = readMaybeGz(base);
  const byId = new Map();
  for (const l of text.split('\n')) {
    if (l.trim() === '') continue;
    const o = JSON.parse(l);
    if (o.error !== undefined) fail(`${name}: row ${o.row_id} carries an error: ${JSON.stringify(o.error)}`);
    if (byId.has(o.row_id)) fail(`${name} lists row ${o.row_id} twice`);
    byId.set(o.row_id, pick(o));
  }
  return { byId, file, sha };
}

function pickA(o) {
  const v = o.answers?.isX?.noul;
  if (typeof v !== 'number' || !(v >= 0 && v <= 1)) fail(`Jev A: row ${o.row_id} isX.noul ${JSON.stringify(v)} is not a number in 0..1`);
  return v;
}

function pickB(o) {
  const c = o.answers?.rwx?.choice;
  if (!CLASSES.includes(c)) fail(`Jev B: row ${o.row_id} rwx.choice ${JSON.stringify(c)} is not r/w/x`);
  return c;
}

// --------------------------------------------------------------- counting

function verdict(pred, truth) {
  if (pred === truth) return 'exact';
  return ORDER[pred] < ORDER[truth] ? 'leak' : 'over-tight';
}

function pct(n, d) {
  if (d === 0) return `${n} / 0 (n/a)`;
  return `${n} / ${d} (${((n / d) * 100).toFixed(1)}%)`;
}

function ledgerLine(label, rows, predKey, width = 14) {
  const t = { exact: 0, leak: 0, 'over-tight': 0 };
  for (const r of rows) t[verdict(r[predKey], r.truth)]++;
  const d = rows.length;
  return `  ${label.padEnd(width)} exact ${pct(t.exact, d).padEnd(22)} leaks ${pct(t.leak, d).padEnd(22)} over-tight ${pct(t['over-tight'], d)}`;
}

function confusion(say, rows, predKey) {
  say(' confusion (rows truth, cols pred), counts:');
  say('              pred r   pred w   pred x   truth total');
  for (const truth of CLASSES) {
    const sel = rows.filter((r) => r.truth === truth);
    const cells = CLASSES.map((c) => String(sel.filter((r) => r[predKey] === c).length).padStart(8));
    say(`    truth ${truth} ${cells.join(' ')}   ${String(sel.length).padStart(11)}`);
  }
  const tot = CLASSES.map((c) => String(rows.filter((r) => r[predKey] === c).length).padStart(8));
  say(`    pred tot${tot.join(' ')}   ${String(rows.length).padStart(11)}`);
}

function breakdown(say, rows, predKey, { perSource = false, withConfusion = true } = {}) {
  say(ledgerLine('whole', rows, predKey));
  say(' per method (each over its own rows):');
  for (const m of METHODS) say(ledgerLine(m, rows.filter((r) => r.method === m), predKey));
  say(' per provider (each over its own rows):');
  for (const p of PROVIDERS) say(ledgerLine(p, rows.filter((r) => r.provider === p), predKey));
  if (perSource) {
    say(' per source (each over its own rows):');
    for (const s of SOURCES) say(ledgerLine(s, rows.filter((r) => r.source === s), predKey));
  }
  if (withConfusion) confusion(say, rows, predKey);
}

// Raise tier: on rows the flow calls w, raise to x when isX.noul >= thr.
function raiseCounts(rows, thr) {
  const onW = rows.filter((r) => r.flowClass === 'w');
  const truthX = onW.filter((r) => r.truth === 'x').length;
  const closed = onW.filter((r) => r.truth === 'x' && r.noul >= thr).length;
  const falseAlarm = onW.filter((r) => r.truth === 'w' && r.noul >= thr).length;
  return { onW: onW.length, truthX, closed, falseAlarm };
}

const ratioStr = (c, f) => (f === 0 ? (c === 0 ? 'n/a' : 'inf') : (c / f).toFixed(2));

function raiseLine(label, rows) {
  const k = raiseCounts(rows, THRESHOLD);
  return `  ${label.padEnd(22)} flow-w rows ${String(k.onW).padStart(5)}   truth x ${pct(k.truthX, k.onW).padEnd(22)} leaks closed ${pct(k.closed, k.truthX).padEnd(20)} false alarms (truth w raised) ${String(k.falseAlarm).padStart(4)}   closed/false ${ratioStr(k.closed, k.falseAlarm)}`;
}

// Does a threshold clear the adoption bar on these counts? closed/false >= BAR;
// false 0 passes only with closed > 0 (0 closed / 0 false tells nothing).
function passesBar(k) {
  if (k.falseAlarm === 0) return k.closed > 0;
  return k.closed >= BAR * k.falseAlarm;
}

// Per fold: the LOWEST threshold (= most leaks closed) whose training counts
// clear the bar; if none does, the tightest-precision end of the sweep.
// Maximising the ratio instead would always pick the top threshold, where
// 0 false alarms reads as inf — an artifact of the rule, not of transfer.
function pickThreshold(rows) {
  for (const thr of [...SWEEP].sort((a, b) => a - b)) {
    const k = { ...raiseCounts(rows, thr), thr };
    if (passesBar(k)) return k;
  }
  const top = Math.max(...SWEEP);
  return { ...raiseCounts(rows, top), thr: top };
}

// ------------------------------------------------------------------- main

const rowsBuf = gunzipSync(readFileSync(ROWS_GZ));
const rowsSha = createHash('sha256').update(rowsBuf).digest('hex');
const base = JSON.parse(rowsBuf.toString('utf8'));
if (!Array.isArray(base)) fail('rows.json is not an array');

const A = loadJsonl('outA', 'Jev A', pickA);
const B = loadJsonl('outB', 'Jev B', pickB);

const seen = new Set();
for (const r of base) {
  if (seen.has(r.row_id)) fail(`rows.json lists row ${r.row_id} twice`);
  seen.add(r.row_id);
  if (!CLASSES.includes(r.truth)) fail(`row ${r.row_id} truth "${r.truth}" is not r/w/x`);
  if (!A.byId.has(r.row_id)) fail(`Jev A has no answer for row ${r.row_id}`);
  if (!B.byId.has(r.row_id)) fail(`Jev B has no answer for row ${r.row_id}`);
}
for (const [name, m] of [['Jev A', A.byId], ['Jev B', B.byId]]) {
  if (m.size !== base.length) fail(`${name} has ${m.size} answers for ${base.length} rows`);
  for (const id of m.keys()) if (!seen.has(id)) fail(`${name} answers row ${id}, which is not in rows.json`);
}

const ruleStep = new Map();
const ruleSource = new Map();
const all = [...base]
  .sort((a, b) => (a.row_id < b.row_id ? -1 : a.row_id > b.row_id ? 1 : 0))
  .map((b) => {
    const op = { method: b.method, path: b.path, operationId: b.operationId, summary: b.summary, description: b.description };
    const s1 = step1(op);
    const s2 = step2(op);
    const s3 = step3(op);
    const f = classifyRow(op);
    if (!CLASSES.includes(f.class)) fail(`classifyRow gave row ${b.row_id} class ${JSON.stringify(f.class)}`);
    if (ruleStep.has(f.rule) && ruleStep.get(f.rule) !== f.step) fail(`rule "${f.rule}" reported under step ${ruleStep.get(f.rule)} and step ${f.step}`);
    ruleStep.set(f.rule, f.step);
    ruleSource.set(f.rule, f.source);
    const noul = A.byId.get(b.row_id);
    const raised = f.class === 'w' && noul >= THRESHOLD;
    return {
      row_id: b.row_id,
      source: b.source,
      provider: b.provider,
      method: b.method,
      truth: b.truth,
      s1,
      s2,
      s3,
      flowClass: f.class,
      flowStep: f.step,
      flowRule: f.rule,
      flowSource: f.source,
      noul,
      jevB: B.byId.get(b.row_id),
      raised,
      flowJevA: raised ? 'x' : f.class,
    };
  });

// The flow's attribution must agree with the steps run standalone: a row
// the flow gives to step N carries exactly the verdict step N gives alone.
for (const r of all) {
  const alone = { 1: r.s1, 2: r.s2 }[r.flowStep];
  if (r.flowStep === 1 || r.flowStep === 2) {
    if (!alone || alone.rule !== r.flowRule || alone.class !== r.flowClass) fail(`row ${r.row_id}: flow says step ${r.flowStep}/${r.flowRule} but that step alone says ${JSON.stringify(alone)}`);
  }
}

const bySort = (order) => (a, b) => {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : a > b ? 1 : 0);
};
const METHODS = [...new Set(all.map((r) => r.method))].sort(bySort(METHOD_ORDER));
const PROVIDERS = [...new Set(all.map((r) => r.provider))].sort();
const SOURCES = [...new Set(all.map((r) => r.source))].sort(bySort(['pc', 'x17', 'x20']));
const RULES = [...ruleStep.keys()].sort((a, b) => ruleStep.get(a) - ruleStep.get(b) || (a < b ? -1 : 1));
const STEPS = [...new Set(RULES.map((r) => ruleStep.get(r)))].sort();

const out = [];
const say = (s = '') => out.push(s);

// ------------------------------------------------------------ 1. header
say('COMBINED data/combined-2026-09-21 — DIAGNOSTIC over tuning data — not an exam, no generalization claim.');
say('Every source here was tuned on or already scored (provider corpus = tuning set; exams 09-17 and 09-20 burned, D24).');
say('Classes r < w < x. leak = predicted looser than truth (under-classification, a security cost).');
say('over-tight = predicted tighter than truth (over-classification, a usability cost). Never collapsed.');
say();
say(`rows.json sha256 (uncompressed) ${rowsSha}`);
say(`Jev A ${path.relative(REPO_ROOT, A.file)} sha256 ${A.sha}`);
say(`Jev B ${path.relative(REPO_ROOT, B.file)} sha256 ${B.sha}`);
const dist = (rows) => CLASSES.map((c) => `${c} ${rows.filter((r) => r.truth === c).length}`).join(' / ');
say(`truth distribution over ${all.length} rows: ${dist(all)}`);
for (const s of SOURCES) say(`  source ${s.padEnd(4)} ${String(all.filter((r) => r.source === s).length).padStart(5)} rows: ${dist(all.filter((r) => r.source === s))}`);
say(`providers ${PROVIDERS.length}, methods ${METHODS.join('/')}`);
say(`raise-only threshold (fixed, sections 5-7): isX.noul >= ${THRESHOLD.toFixed(2)}`);
say();

// -------------------------------------------------------------- 2. flow
say('2. FLOW — classifyRow (src/flow.js)');
breakdown(say, all, 'flowClass', { perSource: true });
say();

// ---------------------------------------------------------- 3. per step
say('3. PER STEP — each over only the rows whose FINAL flow verdict that step/rule produced');
say(' rule -> step mapping (from the verdict classifyRow returned; source = floor|list):');
for (const rule of RULES) say(`    ${rule.padEnd(22)} step ${ruleStep.get(rule)}   source ${ruleSource.get(rule)}`);
say(' standalone claims (each step run alone on every row, not the flow): ' +
  `step1 ${all.filter((r) => r.s1).length}, step2 ${all.filter((r) => r.s2).length}, step3 raise-word ${all.filter((r) => r.s3).length} of ${all.length}`);
for (const st of STEPS) {
  const sRows = all.filter((r) => r.flowStep === st);
  say(` step ${st} — claims ${pct(sRows.length, all.length)} of all rows`);
  say(ledgerLine(`step ${st} all`, sRows, 'flowClass', 22));
  for (const src of ['list', 'floor']) {
    const g = sRows.filter((r) => r.flowSource === src);
    if (g.length === 0) continue;
    const names = RULES.filter((ru) => ruleStep.get(ru) === st && ruleSource.get(ru) === src).join('+');
    say(ledgerLine(`${src === 'list' ? 'word' : 'floor'} (${names})`, g, 'flowClass', 22));
  }
  for (const rule of RULES.filter((ru) => ruleStep.get(ru) === st)) {
    const g = sRows.filter((r) => r.flowRule === rule);
    say(ledgerLine(`  rule ${rule}`, g, 'flowClass', 22) + `   claims ${g.length}`);
  }
}
const floorBefore = all.filter((r) => r.s2 && r.s2.source === 'floor');
const floorRaised = floorBefore.filter((r) => r.flowStep === 3);
say(` step 2 floor claims made standalone: ${floorBefore.length}; of those, raised to x by step 3 in the flow: ${pct(floorRaised.length, floorBefore.length)}`);
say('   (the raised rows are counted under step 3 above, not step 2; the line below is step 2 floor BEFORE the raise, class w, for reference)');
say(ledgerLine('step 2 floor pre-raise', floorBefore.map((r) => ({ ...r, pre: r.s2.class })), 'pre', 22));
say();

// ------------------------------------------------------------ 4. Jev B
say('4. JEV-B — cold r/w/x choice');
breakdown(say, all, 'jevB');
say();

// ------------------------------------------------------- 5. flow+Jev A
say(`5. FLOW+JEV-A — flow, raised w -> x when isX.noul >= ${THRESHOLD.toFixed(2)}; never lowers`);
breakdown(say, all, 'flowJevA', { withConfusion: false });
say();

// ---------------------------------------------------------- 6. A on w
say(`6. JEV-A-ON-W — the raise-only tier alone, on rows where the flow class is w (threshold ${THRESHOLD.toFixed(2)})`);
say(raiseLine('whole', all));
say(' per provider:');
for (const p of PROVIDERS) say(raiseLine(p, all.filter((r) => r.provider === p)));
say(' by the rule that gave the w:');
for (const rule of RULES) {
  const g = all.filter((r) => r.flowRule === rule && r.flowClass === 'w');
  if (g.length) say(raiseLine(`${rule} (step ${ruleStep.get(rule)})`, g));
}
say();

// ------------------------------------------------ 7. step 2 head to head
const s2Rows = all.filter((r) => r.flowStep === 2);
say(`7. STEP 2 HEAD-TO-HEAD — the ${s2Rows.length} rows whose final verdict came from step 2, three predictors over the same rows`);
say(ledgerLine('step 2', s2Rows, 'flowClass', 22));
say(ledgerLine('JEV-B', s2Rows, 'jevB', 22));
say(ledgerLine('FLOW+JEV-A', s2Rows, 'flowJevA', 22));
const dis = new Map();
for (const r of s2Rows) {
  if (r.flowClass === r.jevB) continue;
  const k = `${r.truth}|${r.flowClass}|${r.jevB}`;
  dis.set(k, (dis.get(k) || 0) + 1);
}
const disTotal = [...dis.values()].reduce((a, b) => a + b, 0);
say(` step 2 vs JEV-B disagreements: ${pct(disTotal, s2Rows.length)} — counts by (truth, step2, jevB):`);
say('    truth  step2  jevB   rows   who is exact');
for (const k of [...dis.keys()].sort((a, b) => {
  const [ta, sa, ja] = a.split('|');
  const [tb, sb, jb] = b.split('|');
  return ORDER[ta] - ORDER[tb] || ORDER[sa] - ORDER[sb] || ORDER[ja] - ORDER[jb];
})) {
  const [t, s, j] = k.split('|');
  const who = s === t ? 'step2' : j === t ? 'jevB' : 'neither';
  say(`    ${t.padEnd(6)} ${s.padEnd(6)} ${j.padEnd(6)} ${String(dis.get(k)).padStart(5)}   ${who}`);
}
say();

// ------------------------------------------------------------- 8. LOVO
say('8. RAISE TIER THRESHOLD — fitted sweep (TUNING, all providers) vs leave-one-vendor-out (the honest number)');
say(` fitted sweep over all ${PROVIDERS.length} providers, flow-w rows only:`);
say('    thr    flow-w   truth x   closed   false   closed/false');
for (const thr of SWEEP) {
  const k = raiseCounts(all, thr);
  say(`    ${thr.toFixed(2)}  ${String(k.onW).padStart(7)}  ${String(k.truthX).padStart(8)}  ${String(k.closed).padStart(7)}  ${String(k.falseAlarm).padStart(6)}   ${ratioStr(k.closed, k.falseAlarm)}`);
}
say(` LOVO: per held-out provider, pick the LOWEST threshold from {${SWEEP.map((t) => t.toFixed(2)).join(', ')}} whose closed/false on the other ${PROVIDERS.length - 1}`);
say(`   clears the adoption bar (>= ${BAR}; 0 false passes only with closed > 0); none passes -> ${Math.max(...SWEEP).toFixed(2)}. Apply it to the held-out provider.`);
say('    held-out        thr    train closed/false (ratio)    held-out flow-w  truth x  closed  false');
let lovoClosed = 0;
let lovoFalse = 0;
let lovoTruthX = 0;
for (const p of PROVIDERS) {
  const train = all.filter((r) => r.provider !== p);
  const test = all.filter((r) => r.provider === p);
  const best = pickThreshold(train);
  const h = raiseCounts(test, best.thr);
  lovoClosed += h.closed;
  lovoFalse += h.falseAlarm;
  lovoTruthX += h.truthX;
  const trainStr = `${best.closed}/${best.falseAlarm} (${ratioStr(best.closed, best.falseAlarm)})`;
  say(`    ${p.padEnd(14)}  ${best.thr.toFixed(2)}   ${trainStr.padEnd(28)}  ${String(h.onW).padStart(15)}  ${String(h.truthX).padStart(7)}  ${String(h.closed).padStart(6)}  ${String(h.falseAlarm).padStart(5)}`);
}
say(` LOVO pooled over ${PROVIDERS.length} folds: leaks closed ${pct(lovoClosed, lovoTruthX)} of flow-w truth-x rows, false alarms ${lovoFalse}, closed/false ${ratioStr(lovoClosed, lovoFalse)}`);
say(' The fitted sweep is tuning; the LOVO line is the honest number — and even it is over tuning data, not an exam.');

console.log(out.join('\n'));
