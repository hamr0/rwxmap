// poc/jev-d87/score.mjs — scores a Jev run against the D87 flow's
// floor-post rows: can Jev safely lower x -> w on the rows the D87 ladder
// could not place a word on?
//
// Usage: node score.mjs <rows.json|rows.json.gz> <out.jsonl>
//
// Imports nothing from src/; imports poc/d87/flow.mjs (the ladder being
// measured) to compute the whole-flow effect of lowering.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { classifyRow } from '../d87/flow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const RANK = { r: 0, w: 1, x: 2 };
const THRESHOLDS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];
const BAR = 10;

function outcome(pred, truth) {
  if (RANK[pred] === RANK[truth]) return 'exact';
  return RANK[pred] < RANK[truth] ? 'leak' : 'over-tight';
}

function pct(n, denom) {
  return denom === 0 ? '0.0%' : `${((100 * n) / denom).toFixed(1)}%`;
}

// --- loading (same as poc/d87/readout.mjs) --------------------------------

function readJson(p) {
  const buf = fs.readFileSync(p);
  const json = p.endsWith('.gz') ? zlib.gunzipSync(buf) : buf;
  return JSON.parse(json.toString('utf8'));
}

function loadCombinedRows() {
  const gzPath = path.join(ROOT, 'data', 'combined-2026-09-21', 'rows.json.gz');
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(gzPath)));
}

function loadV3Truth() {
  const dir = path.join(ROOT, 'data', 'relabel-2026-09-22', 'label');
  const truth = new Map();
  for (let i = 1; i <= 9; i += 1) {
    const p = path.join(dir, `labels-${i}.csv`);
    const lines = fs.readFileSync(p, 'utf8').trim().split('\n').slice(1);
    for (const l of lines) {
      const parts = l.split(',');
      truth.set(parts[0], parts[1]);
    }
  }
  const rulingsPath = path.join(dir, 'rulings.csv');
  const rulingLines = fs.readFileSync(rulingsPath, 'utf8').trim().split('\n').slice(1);
  for (const l of rulingLines) {
    const parts = l.split(',');
    truth.set(parts[0], parts[2]);
  }
  return truth;
}

// truthClass per row_id over the WHOLE combined set: v1 r stands, else v3.
function buildTruthMap() {
  const rows = loadCombinedRows();
  const v3Truth = loadV3Truth();
  const map = new Map();
  for (const row of rows) {
    if (row.truth === 'r') {
      map.set(row.row_id, 'r');
      continue;
    }
    const v3 = v3Truth.get(row.row_id);
    if (v3 === undefined) throw new Error(`no v3 label for non-r row ${row.row_id}`);
    if (!['r', 'w', 'x'].includes(v3)) throw new Error(`row ${row.row_id} has invalid v3 label ${v3}`);
    map.set(row.row_id, v3);
  }
  return { rows, truthMap: map };
}

function readOutJsonl(p) {
  const map = new Map();
  const buf = fs.readFileSync(p);
  const text = (p.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8');
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const o = JSON.parse(line);
    map.set(o.row_id, o);
  }
  return map;
}

// --- main ------------------------------------------------------------------

function main() {
  const [, , rowsPath, outPath] = process.argv;
  if (!rowsPath || !outPath) {
    console.error('usage: node score.mjs <rows.json|rows.json.gz> <out.jsonl>');
    process.exit(2);
  }

  const floorRows = readJson(rowsPath);
  const outById = readOutJsonl(outPath);
  const { rows: fullRows, truthMap } = buildTruthMap();

  // Whole-flow base: predicted class + truthClass for all 6557 rows, computed
  // once. Lowering only ever touches floor-post rows, so re-tagging by
  // row_id is enough — no need to re-run classifyRow per threshold.
  for (const row of fullRows) {
    row.truthClass = truthMap.get(row.row_id);
    row.verdict = classifyRow(row);
  }
  function wholeFlowStats(loweredIds) {
    let exact = 0;
    let leak = 0;
    let overTight = 0;
    for (const row of fullRows) {
      const cls = loweredIds.has(row.row_id) ? 'w' : row.verdict.class;
      const o = outcome(cls, row.truthClass);
      if (o === 'exact') exact += 1;
      else if (o === 'leak') leak += 1;
      else overTight += 1;
    }
    return { exact, leak, overTight };
  }

  // Join: row + out + truth + p, split into eligible vs error.
  const joined = [];
  let errorCount = 0;
  for (const row of floorRows) {
    const out = outById.get(row.row_id);
    const truth = truthMap.get(row.row_id);
    if (truth === undefined) throw new Error(`no truth for floor row ${row.row_id}`);
    const p = out && !out.error && out.answers && out.answers.isX && typeof out.answers.isX.noul === 'number'
      ? out.answers.isX.noul
      : null;
    if (p === null) {
      errorCount += 1;
      joined.push({ ...row, truth, p: null, error: true });
    } else {
      joined.push({ ...row, truth, p, error: false });
    }
  }
  const eligible = joined.filter((r) => !r.error);

  console.log(`rows: ${floorRows.length} floor-post rows, ${eligible.length} eligible, ${errorCount} errors (excluded from lowering, stay x)`);
  console.log('');

  // ---- Fitted thresholds ---------------------------------------------------
  console.log('=== Fitted thresholds (lower to w when p <= t) ===');
  console.log('  t      lowered   fixed(w|r)   leaks(x)   ratio   bar>=10   whole-flow exact/leaks/over-tight (% of 6557)');
  for (const t of THRESHOLDS) {
    const lowered = eligible.filter((r) => r.p <= t);
    const fixed = lowered.filter((r) => r.truth === 'w' || r.truth === 'r').length;
    const leaks = lowered.filter((r) => r.truth === 'x').length;
    const ratio = fixed / Math.max(leaks, 1);
    const loweredIds = new Set(lowered.map((r) => r.row_id));
    const wf = wholeFlowStats(loweredIds);
    const mark = ratio >= BAR ? 'YES' : 'no';
    console.log(
      `  ${t.toFixed(2)}   ${String(lowered.length).padStart(5)}     ${String(fixed).padStart(4)}         ${String(leaks).padStart(3)}      ${ratio.toFixed(2).padStart(6)}    ${mark.padEnd(3)}     exact=${wf.exact} (${pct(wf.exact, fullRows.length)}) leaks=${wf.leak} (${pct(wf.leak, fullRows.length)}) over-tight=${wf.overTight} (${pct(wf.overTight, fullRows.length)})`,
    );
  }
  console.log('');

  // ---- LOVO ------------------------------------------------------------
  console.log(`=== LOVO (leave-one-provider-out, bar ratio>=${BAR}) ===`);
  const providers = [...new Set(eligible.map((r) => r.provider))].sort();
  const chosenT = new Map();
  let lovoFixed = 0;
  let lovoLeaks = 0;
  const lovoLoweredIds = new Set();
  const lovoLeakRows = [];

  for (const provider of providers) {
    const others = eligible.filter((r) => r.provider !== provider);
    const held = eligible.filter((r) => r.provider === provider);

    let best = null;
    for (const t of THRESHOLDS) {
      const lowered = others.filter((r) => r.p <= t);
      const fixed = lowered.filter((r) => r.truth === 'w' || r.truth === 'r').length;
      const leaks = lowered.filter((r) => r.truth === 'x').length;
      const ratio = fixed / Math.max(leaks, 1);
      if (ratio >= BAR && (!best || t > best.t)) best = { t, ratio };
    }

    if (!best) {
      chosenT.set(provider, null);
      console.log(`  ${provider.padEnd(16)} t=none (no threshold clears the bar on the other providers)  fixed=0  leaks=0`);
      continue;
    }
    chosenT.set(provider, best.t);
    const lowered = held.filter((r) => r.p <= best.t);
    const fixed = lowered.filter((r) => r.truth === 'w' || r.truth === 'r').length;
    const leaks = lowered.filter((r) => r.truth === 'x').length;
    lovoFixed += fixed;
    lovoLeaks += leaks;
    for (const r of lowered) {
      lovoLoweredIds.add(r.row_id);
      if (r.truth === 'x') lovoLeakRows.push(r);
    }
    console.log(`  ${provider.padEnd(16)} t=${best.t.toFixed(2)}  fixed=${fixed}  leaks=${leaks}`);
  }
  const lovoRatio = lovoFixed / Math.max(lovoLeaks, 1);
  console.log('');
  console.log(`  TOTAL  fixed=${lovoFixed}  leaks=${lovoLeaks}  ratio=${lovoRatio.toFixed(2)}`);
  const lovoWf = wholeFlowStats(lovoLoweredIds);
  console.log(
    `  whole-flow (LOVO): exact=${lovoWf.exact} (${pct(lovoWf.exact, fullRows.length)}) leaks=${lovoWf.leak} (${pct(lovoWf.leak, fullRows.length)}) over-tight=${lovoWf.overTight} (${pct(lovoWf.overTight, fullRows.length)})`,
  );
  console.log('');

  // ---- every LOVO leak --------------------------------------------------
  console.log(`=== Every leak at the LOVO-chosen thresholds (n=${lovoLeakRows.length}) ===`);
  for (const r of lovoLeakRows) {
    console.log(
      `  ${r.row_id}  ${r.provider}  ${r.operationId || ''}  ${JSON.stringify((r.summary || '').slice(0, 60))}  p=${r.p.toFixed(3)}  truth=${r.truth}`,
    );
  }
  console.log('');

  // ---- calibration table --------------------------------------------------
  console.log('=== Calibration: p bucket -> n, truth-x share ===');
  const buckets = Array.from({ length: 10 }, () => ({ n: 0, x: 0 }));
  for (const r of eligible) {
    const idx = Math.min(9, Math.floor(r.p * 10));
    buckets[idx].n += 1;
    if (r.truth === 'x') buckets[idx].x += 1;
  }
  for (let i = 0; i < 10; i += 1) {
    const lo = (i / 10).toFixed(1);
    const hi = ((i + 1) / 10).toFixed(1);
    const b = buckets[i];
    console.log(`  [${lo},${hi})   n=${String(b.n).padStart(4)}   truth-x=${String(b.x).padStart(4)} (${pct(b.x, b.n)})`);
  }
}

main();
