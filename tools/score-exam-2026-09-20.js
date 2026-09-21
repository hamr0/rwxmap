// Exam scorer for the clean exam data/exam-2026-09-20. Test/dev tooling
// only — never part of the published library.
//
// This scores the clean exam ONCE (D24). The flow and Jev predictions in
// data/jev-2026-09-20/ were recorded before any truth label existed; their
// sha256 is checked here against the values written down at that time, so
// the run proves the predictions predate the labels. This script only joins
// predictions to labels and counts. It changes no classifier behaviour.
//
// Truth is the nine blind labels-N.csv files with the user's rulings
// (rulings.csv) overlaid. Each ruling asserts the raw label it replaces.
//
// A rule change means a NEW exam, not a re-score of this one.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const LABEL_DIR = path.join(REPO_ROOT, 'data/exam-2026-09-20/label');
const RULINGS_CSV = path.join(LABEL_DIR, 'rulings.csv');
const JEV_DIR = path.join(REPO_ROOT, 'data/jev-2026-09-20');
const ROWS_GZ = path.join(JEV_DIR, 'rowsE-exam.json.gz');
const A_GZ = path.join(JEV_DIR, 'outE-A.jsonl.gz');
const B_GZ = path.join(JEV_DIR, 'outE-B.jsonl.gz');

const EXPECTED_ROWS = 1003;
const LABEL_PARTS = 9;

// sha256 of the UNCOMPRESSED contents, recorded in data/jev-2026-09-20/README.md
// before any labeller saw a row.
const EXPECTED_SHA = {
  [ROWS_GZ]: '9c20637c670c39e5226a1a1a52bc438fd1c153b2c5eb6c9158b75757dc1ad27b',
  [A_GZ]: '33ad2ad48d91c36321711f568d297c46e092e44244a551c10e5ae57c1614f46c',
  [B_GZ]: 'db43859e2ccde74c6bf223d5830a19ce95e8dd4a5a4216b84abf893da695b140',
};

// The raise-only tier's threshold, fixed in advance: the value POC A picked
// on the build set. Not swept here.
const THRESHOLD = 0.70;

const ORDER = { r: 0, w: 1, x: 2 };
const CLASSES = ['r', 'w', 'x'];
const UNSURE = '?';
const METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];
const PROVIDERS = ['auth0', 'hubspot', 'zendesk', 'klaviyo', 'miro'];

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------- loading

function gunzipVerified(file) {
  const buf = gunzipSync(readFileSync(file));
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== EXPECTED_SHA[file]) {
    fail(`${path.relative(REPO_ROOT, file)} uncompressed sha256 ${sha}, expected ${EXPECTED_SHA[file]} — not the predictions recorded before labelling`);
  }
  return buf.toString('utf8');
}

function loadTruth() {
  const truthById = new Map();
  for (let part = 1; part <= LABEL_PARTS; part++) {
    const file = path.join(LABEL_DIR, `labels-${part}.csv`);
    for (const lab of parseCsv(readFileSync(file, 'utf8'))) {
      const id = (lab.row_id || '').trim();
      if (!id) fail(`labels-${part}.csv has a row with no row_id`);
      const truth = (lab.truth_class || '').trim();
      if (!CLASSES.includes(truth) && truth !== UNSURE) {
        fail(`labels-${part}.csv: row ${id} has truth_class "${truth}", expected one of r/w/x/?`);
      }
      if (truthById.has(id)) fail(`row ${id} is labelled twice (second time in labels-${part}.csv)`);
      truthById.set(id, truth);
    }
  }

  let applied = 0;
  const seen = new Set();
  for (const ru of parseCsv(readFileSync(RULINGS_CSV, 'utf8'))) {
    const id = (ru.row_id || '').trim();
    const labelled = (ru.labelled || '').trim();
    const ruled = (ru.ruled || '').trim();
    if (seen.has(id)) fail(`rulings.csv rules row ${id} twice`);
    seen.add(id);
    if (!truthById.has(id)) fail(`rulings.csv: row ${id} has no raw label in any labels-N.csv`);
    const raw = truthById.get(id);
    if (raw !== labelled) {
      fail(`rulings.csv: row ${id} says labelled "${labelled}" but the raw label is "${raw}" — the ruling does not match the label it replaces`);
    }
    if (!CLASSES.includes(ruled)) fail(`rulings.csv: row ${id} ruled "${ruled}", expected one of r/w/x`);
    truthById.set(id, ruled);
    applied++;
  }
  return { truthById, applied };
}

function loadRows() {
  const rows = JSON.parse(gunzipVerified(ROWS_GZ));
  if (!Array.isArray(rows)) fail('rowsE-exam.json is not an array');
  const byId = new Map();
  for (const r of rows) {
    if (byId.has(r.row_id)) fail(`rowsE-exam.json lists row ${r.row_id} twice`);
    if (!CLASSES.includes(r.flowClass)) fail(`rowsE-exam.json: row ${r.row_id} flowClass "${r.flowClass}" is not r/w/x`);
    byId.set(r.row_id, r);
  }
  return byId;
}

function loadJsonl(file, name, pick) {
  const byId = new Map();
  const lines = gunzipVerified(file).split('\n').filter((l) => l.trim() !== '');
  for (const l of lines) {
    const o = JSON.parse(l);
    if (o.error !== undefined) fail(`${name}: row ${o.row_id} carries an error: ${JSON.stringify(o.error)}`);
    if (byId.has(o.row_id)) fail(`${name} lists row ${o.row_id} twice`);
    byId.set(o.row_id, pick(o));
  }
  return byId;
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

function checkIds(name, map, ids) {
  if (map.size !== EXPECTED_ROWS) fail(`${name} has ${map.size} rows, expected ${EXPECTED_ROWS}`);
  for (const id of ids) if (!map.has(id)) fail(`${name} has no row ${id}`);
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

function ledgerLine(label, rows, predKey) {
  const t = { exact: 0, leak: 0, 'over-tight': 0 };
  for (const r of rows) t[verdict(r[predKey], r.truth)]++;
  const d = rows.length;
  return `  ${label.padEnd(10)} exact ${pct(t.exact, d).padEnd(20)} leaks ${pct(t.leak, d).padEnd(20)} over-tight ${pct(t['over-tight'], d)}`;
}

// ----------------------------------------------------------------- report

function reportPredictor(say, title, rows, predKey) {
  say(title);
  say(ledgerLine('whole', rows, predKey));
  say(' per method (each over its own rows):');
  for (const m of METHODS) say(ledgerLine(m, rows.filter((r) => r.method === m), predKey));
  say(' per provider (each over its own rows):');
  for (const p of PROVIDERS) say(ledgerLine(p, rows.filter((r) => r.provider === p), predKey));
  say(' confusion (rows truth, cols pred), counts:');
  say('              pred r   pred w   pred x   truth total');
  for (const truth of CLASSES) {
    const sel = rows.filter((r) => r.truth === truth);
    const cells = CLASSES.map((c) => String(sel.filter((r) => r[predKey] === c).length).padStart(8));
    say(`    truth ${truth} ${cells.join(' ')}   ${String(sel.length).padStart(11)}`);
  }
  const tot = CLASSES.map((c) => String(rows.filter((r) => r[predKey] === c).length).padStart(8));
  say(`    pred tot${tot.join(' ')}   ${String(rows.length).padStart(11)}`);
  say();
}

function raiseLine(label, rows) {
  const onW = rows.filter((r) => r.flowClass === 'w');
  const truthX = onW.filter((r) => r.truth === 'x');
  const closed = truthX.filter((r) => r.raised).length;
  const falseAlarm = onW.filter((r) => r.truth === 'w' && r.raised).length;
  const ratio = falseAlarm === 0 ? 'inf' : (closed / falseAlarm).toFixed(2);
  return `  ${label.padEnd(10)} flow-w rows ${String(onW.length).padStart(4)}   truth x ${pct(truthX.length, onW.length).padEnd(20)} leaks closed ${pct(closed, truthX.length).padEnd(18)} false alarms (truth w raised) ${String(falseAlarm).padStart(3)}   closed/false ${ratio}`;
}

// ------------------------------------------------------------------- main

const { truthById, applied } = loadTruth();
const rowsById = loadRows();
const aById = loadJsonl(A_GZ, 'Jev A', pickA);
const bById = loadJsonl(B_GZ, 'Jev B', pickB);

const ids = [...rowsById.keys()].sort();
checkIds('truth', truthById, ids);
checkIds('rowsE-exam.json', rowsById, ids);
checkIds('Jev A', aById, ids);
checkIds('Jev B', bById, ids);

const all = ids.map((id) => {
  const r = rowsById.get(id);
  const noul = aById.get(id);
  const raised = r.flowClass === 'w' && noul >= THRESHOLD;
  return {
    row_id: id,
    provider: r.provider,
    method: r.method,
    truth: truthById.get(id),
    flowClass: r.flowClass,
    jevB: bById.get(id),
    raised,
    flowJevA: raised ? 'x' : r.flowClass,
  };
});

for (const r of all) {
  if (!METHODS.includes(r.method)) fail(`row ${r.row_id} method "${r.method}" is not one of ${METHODS.join('/')}`);
  if (!PROVIDERS.includes(r.provider)) fail(`row ${r.row_id} provider "${r.provider}" is not one of ${PROVIDERS.join('/')}`);
}

const unsure = all.filter((r) => r.truth === UNSURE);
const rows = all.filter((r) => r.truth !== UNSURE);

const out = [];
const say = (s = '') => out.push(s);

say('EXAM data/exam-2026-09-20 — scored ONCE (D24). A rule change means a NEW exam.');
say('Classes r < w < x. leak = predicted looser than truth (under-classification, the go/no-go quantity).');
say('over-tight = predicted tighter than truth (over-classification, a usability cost). Never collapsed.');
say();
const dist = { r: 0, w: 0, x: 0, [UNSURE]: 0 };
for (const r of all) dist[r.truth]++;
say(`truth distribution over ${all.length} rows: r ${dist.r} / w ${dist.w} / x ${dist.x} / ? ${dist[UNSURE]}   rulings applied: ${applied}`);
say(`truth '?' rows: ${unsure.length} — excluded from every ledger below; ledgers run over ${rows.length} rows.`);
say(`raise-only threshold (fixed in advance): isX.noul >= ${THRESHOLD.toFixed(2)}`);
say();

reportPredictor(say, '1. FLOW — frozen mechanical tool (flowClass)', rows, 'flowClass');
reportPredictor(say, '2. JEV-B — cold r/w/x choice', rows, 'jevB');
reportPredictor(say, `3. FLOW+JEV-A — flow, raised w -> x when isX.noul >= ${THRESHOLD.toFixed(2)}; never lowers`, rows, 'flowJevA');

say(`4. JEV-A-ON-W — the raise-only tier alone, on rows where flowClass is w`);
say(raiseLine('whole', rows));
say(' per provider:');
for (const p of PROVIDERS) say(raiseLine(p, rows.filter((r) => r.provider === p)));

console.log(out.join('\n'));
