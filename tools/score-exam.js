// Exam scorer for the clean exam data/exam-2026-09-17. Test/dev tooling
// only — never part of the published library.
//
// This scores the clean exam ONCE (D24). The predictions in
// run-proof/exam-2026-09-17-predictions.csv were pre-registered before any
// truth label existed; this script only joins them to the labels and counts.
// It changes no classifier behaviour and reads no word list.
//
// A rule change means a NEW exam, not a re-score of this one. Re-running
// this script after touching a rule turns the exam into a tuning set and
// destroys the only honest generalization number the project has.
//
// The join is BY ROW INDEX: prediction row N is ops.csv row N, and ops.csv
// row N carries row_id e{N padded to 4}. That index is the only link, so
// every row is re-checked on method AND operationId AND path and the run
// hard-fails on the first disagreement.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const EXAM_DIR = path.join(REPO_ROOT, 'data/exam-2026-09-17');
const OPS_GZ = path.join(EXAM_DIR, 'ops.csv.gz');
const LABEL_DIR = path.join(EXAM_DIR, 'label');
const KEY_CSV = path.join(LABEL_DIR, 'key.csv');
const PRED_CSV = path.join(REPO_ROOT, 'run-proof/exam-2026-09-17-predictions.csv');
const OUT_CSV = path.join(REPO_ROOT, 'run-proof/exam-2026-09-17-score.csv');

const EXPECTED_ROWS = 1383;
const LABEL_PARTS = 7;
// Committed post-D80 truth totals. If the labels move, this is not the
// exam that was pre-registered — hard-fail rather than report a new number.
const EXPECTED_TRUTH = { r: 594, w: 415, x: 374 };

const ORDER = { r: 0, w: 1, x: 2 };
const CLASSES = ['r', 'w', 'x'];

function fail(msg) {
  throw new Error(msg);
}

function rowId(index) {
  return 'e' + String(index + 1).padStart(4, '0');
}

// ---------------------------------------------------------------- loading

function loadTruth() {
  const truthById = new Map();
  for (let part = 1; part <= LABEL_PARTS; part++) {
    const file = path.join(LABEL_DIR, `labels-${part}.csv`);
    for (const lab of parseCsv(readFileSync(file, 'utf8'))) {
      const id = (lab.row_id || '').trim();
      if (!id) continue;
      const truth = (lab.truth_class || '').trim();
      if (!ORDER.hasOwnProperty(truth) || !CLASSES.includes(truth)) {
        fail(`labels-${part}.csv: row ${id} has truth_class "${truth}", expected one of r/w/x`);
      }
      if (truthById.has(id)) {
        fail(`row ${id} is labelled twice (second time in labels-${part}.csv)`);
      }
      truthById.set(id, {
        truth,
        confidence: (lab.confidence || '').trim(),
        reason: (lab.reason || '').trim(),
      });
    }
  }
  return truthById;
}

function loadRows() {
  const ops = parseCsv(gunzipSync(readFileSync(OPS_GZ)).toString('utf8'));
  const preds = parseCsv(readFileSync(PRED_CSV, 'utf8'));
  const key = parseCsv(readFileSync(KEY_CSV, 'utf8'));

  if (ops.length !== EXPECTED_ROWS) fail(`ops.csv.gz has ${ops.length} rows, expected ${EXPECTED_ROWS}`);
  if (preds.length !== EXPECTED_ROWS) fail(`predictions csv has ${preds.length} rows, expected ${EXPECTED_ROWS}`);
  if (key.length !== EXPECTED_ROWS) fail(`key.csv has ${key.length} rows, expected ${EXPECTED_ROWS}`);

  const truthById = loadTruth();
  if (truthById.size !== EXPECTED_ROWS) {
    fail(`labels cover ${truthById.size} row_ids, expected ${EXPECTED_ROWS}`);
  }

  // key.csv is keyed by row_id and used only to cross-check the index join.
  const keyById = new Map();
  for (const k of key) {
    const id = (k.row_id || '').trim();
    if (keyById.has(id)) fail(`key.csv lists row ${id} twice`);
    keyById.set(id, k);
  }

  const rows = [];
  for (let i = 0; i < EXPECTED_ROWS; i++) {
    const op = ops[i];
    const p = preds[i];
    const id = rowId(i);

    for (const field of ['method', 'operationId', 'path']) {
      if ((p[field] || '') !== (op[field] || '')) {
        fail(`row index ${i} (${id}): predictions ${field} "${p[field]}" != ops.csv ${field} "${op[field]}" — the two files are not in the same order`);
      }
    }
    if ((p.provider || '') !== (op.provider || '')) {
      fail(`row index ${i} (${id}): predictions provider "${p.provider}" != ops.csv provider "${op.provider}"`);
    }

    const k = keyById.get(id);
    if (!k) fail(`row ${id} (ops index ${i}) has no entry in key.csv`);
    for (const field of ['method', 'operationId', 'path']) {
      if ((k[field] || '') !== (op[field] || '')) {
        fail(`row ${id} (ops index ${i}): key.csv ${field} "${k[field]}" != ops.csv ${field} "${op[field]}" — row_id assignment does not match ops order`);
      }
    }

    const label = truthById.get(id);
    if (!label) fail(`row ${id} has no truth label in any labels-N.csv`);

    const predicted = (p.class || '').trim();
    if (!CLASSES.includes(predicted)) {
      fail(`row ${id}: predicted class "${predicted}" is not one of r/w/x`);
    }

    let verdict;
    if (predicted === label.truth) verdict = 'exact';
    else if (ORDER[predicted] < ORDER[label.truth]) verdict = 'leak';
    else verdict = 'over-tight';

    rows.push({
      row_id: id,
      provider: op.provider || '',
      method: op.method || '',
      path: op.path || '',
      operationId: op.operationId || '',
      truth: label.truth,
      confidence: label.confidence,
      predicted,
      step: p.step || '',
      rule: p.rule || '',
      source: p.source || '',
      matched: p.matched || '',
      verdict,
      reason: label.reason,
    });
  }

  const truthTotals = { r: 0, w: 0, x: 0 };
  for (const row of rows) truthTotals[row.truth]++;
  for (const c of CLASSES) {
    if (truthTotals[c] !== EXPECTED_TRUTH[c]) {
      fail(`truth totals are r ${truthTotals.r} / w ${truthTotals.w} / x ${truthTotals.x}, expected r ${EXPECTED_TRUTH.r} / w ${EXPECTED_TRUTH.w} / x ${EXPECTED_TRUTH.x} — the labels are not the committed post-D80 truth`);
    }
  }

  return rows;
}

// --------------------------------------------------------------- counting

function tally(rows) {
  const t = { rows: rows.length, exact: 0, leak: 0, 'over-tight': 0 };
  for (const row of rows) t[row.verdict]++;
  return t;
}

function pct(n, d) {
  if (d === 0) return `n/a (0/0)`;
  return `${((n / d) * 100).toFixed(1)}% (${n}/${d})`;
}

function line(label, t) {
  return `${label.padEnd(26)} rows ${String(t.rows).padStart(5)}   exact ${pct(t.exact, t.rows).padEnd(20)} leaks ${pct(t.leak, t.rows).padEnd(20)} over-tight ${pct(t['over-tight'], t.rows)}`;
}

function groupBy(rows, keyFn) {
  const m = new Map();
  for (const row of rows) {
    const k = keyFn(row);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(row);
  }
  return m;
}

// ----------------------------------------------------------------- report

function report(rows) {
  const out = [];
  const say = (s = '') => out.push(s);

  say('EXAM data/exam-2026-09-17 — scored ONCE (D24). A rule change means a NEW exam.');
  say('Classes r < w < x. leak = predicted looser than truth (the go/no-go quantity).');
  say('over-tight = predicted tighter than truth (a usability cost only).');
  say('The three verdicts are never collapsed into one accuracy number.');
  say();

  const whole = tally(rows);
  say('1. WHOLE EXAM');
  say(line('all rows', whole));
  say();

  say('2. PER STEP x PER SOURCE (claims)');
  const steps = [...new Set(rows.map((r) => r.step))].sort();
  const sources = [...new Set(rows.map((r) => r.source))].sort();
  for (const step of steps) {
    for (const source of sources) {
      const sel = rows.filter((r) => r.step === step && r.source === source);
      if (sel.length === 0) continue;
      say(line(`step ${step} / ${source}`, tally(sel)));
    }
    say(line(`step ${step} / ALL`, tally(rows.filter((r) => r.step === step))));
  }
  say();

  say('3. PER PROVIDER');
  for (const [provider, sel] of [...groupBy(rows, (r) => r.provider)].sort((a, b) => a[0].localeCompare(b[0]))) {
    say(line(provider, tally(sel)));
  }
  say();

  say('4. PER METHOD');
  const methodOrder = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const byMethod = groupBy(rows, (r) => r.method);
  const methods = [...byMethod.keys()].sort((a, b) => {
    const ia = methodOrder.indexOf(a), ib = methodOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  for (const m of methods) say(line(m, tally(byMethod.get(m))));
  say();

  say('5. CONFUSION (truth x predicted), counts');
  say('            pred r   pred w   pred x     truth total');
  for (const truth of CLASSES) {
    const sel = rows.filter((r) => r.truth === truth);
    const cells = CLASSES.map((p) => String(sel.filter((r) => r.predicted === p).length).padStart(8));
    say(`  truth ${truth} ${cells.join(' ')}   ${String(sel.length).padStart(10)}`);
  }
  const predTotals = CLASSES.map((p) => String(rows.filter((r) => r.predicted === p).length).padStart(8));
  say(`  pred tot ${predTotals.join(' ')}   ${String(rows.length).padStart(10)}`);
  say();

  say('6. EVIDENCE vs FLOOR');
  const evidence = rows.filter((r) => r.source === 'list');
  const floor = rows.filter((r) => r.source === 'floor');
  const other = rows.filter((r) => r.source !== 'list' && r.source !== 'floor');
  say(line('evidence (source=list)', tally(evidence)));
  say(line('floor (source=floor)', tally(floor)));
  if (other.length) say(line(`other sources`, tally(other)));
  say(`  leaks on evidence rows: ${pct(tally(evidence).leak, whole.leak)} of all leaks`);
  say(`  leaks on floor rows:    ${pct(tally(floor).leak, whole.leak)} of all leaks`);
  say();

  const leaks = rows.filter((r) => r.verdict === 'leak');
  say(`7. LEAK DETAIL — every one of ${leaks.length} leak rows, untruncated`);
  if (leaks.length === 0) say('  (none)');
  for (const r of leaks) {
    say(`  ${r.row_id}  ${r.provider}  ${r.method} ${r.path}`);
    say(`      operationId: ${r.operationId}`);
    say(`      truth ${r.truth} (${r.confidence}) -> predicted ${r.predicted}   step ${r.step}  rule ${r.rule}  source ${r.source}  matched "${r.matched}"`);
    say(`      truth reason: ${r.reason}`);
  }
  say();

  say('8. LEAKS BY TRUTH CONFIDENCE');
  const confs = [...new Set(leaks.map((r) => r.confidence || '(blank)'))].sort();
  for (const c of confs) {
    const n = leaks.filter((r) => (r.confidence || '(blank)') === c).length;
    say(`  confidence ${c.padEnd(10)} ${pct(n, leaks.length)} of leaks`);
  }
  if (leaks.length === 0) say('  (no leaks)');
  say();

  return out.join('\n');
}

// ------------------------------------------------------------------- main

const rows = loadRows();

const header = [
  'row_id', 'provider', 'method', 'path', 'operationId',
  'truth', 'confidence', 'predicted', 'step', 'rule', 'source', 'matched', 'verdict',
];
writeFileSync(OUT_CSV, toCsv(rows, header));

console.log(report(rows));
const sha = createHash('sha256').update(readFileSync(OUT_CSV)).digest('hex');
console.log(`wrote ${path.relative(REPO_ROOT, OUT_CSV)}`);
console.log(`sha256 ${sha}`);
