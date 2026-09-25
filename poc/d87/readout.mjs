// poc/d87/readout.mjs — measures the D87 ladder (poc/d87) against the v3
// relabel truth. Prints plain-text tables. Run: node poc/d87/readout.mjs
//
// Imports nothing from src/ or any other poc/ dir except this directory's
// own files.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { tokensForRow, matchingMembers, verbForRow } from './tokens.mjs';
import { CANT_UNDO } from './step2.mjs';
import { KEEP_W } from './step3.mjs';
import { classifyRow } from './flow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const RANK = { r: 0, w: 1, x: 2 };

function outcome(pred, truth) {
  if (RANK[pred] === RANK[truth]) return 'exact';
  return RANK[pred] < RANK[truth] ? 'leak' : 'over-tight';
}

function pct(n, denom) {
  return denom === 0 ? '0.0%' : `${((100 * n) / denom).toFixed(1)}%`;
}

function line(...cells) {
  console.log(cells.join('  '));
}

// --- load rows + truth ------------------------------------------------

function loadRows() {
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
      const rowId = parts[0];
      const cls = parts[1];
      truth.set(rowId, cls);
    }
  }
  const rulingsPath = path.join(dir, 'rulings.csv');
  const rulingLines = fs.readFileSync(rulingsPath, 'utf8').trim().split('\n').slice(1);
  for (const l of rulingLines) {
    const parts = l.split(',');
    const rowId = parts[0];
    const ruling = parts[2];
    truth.set(rowId, ruling);
  }
  return truth;
}

function attachTruth(rows, v3Truth) {
  for (const row of rows) {
    if (row.truth === 'r') {
      row.truthClass = 'r';
      continue;
    }
    const v3 = v3Truth.get(row.row_id);
    if (v3 === undefined) throw new Error(`no v3 label for non-r row ${row.row_id}`);
    if (!['r', 'w', 'x'].includes(v3)) throw new Error(`row ${row.row_id} has invalid v3 label ${v3}`);
    row.truthClass = v3;
  }
}

// --- fitted flow --------------------------------------------------------

function classifyAll(rows, words = {}) {
  for (const row of rows) {
    row.verdict = classifyRow(row, words);
    row.outcome = outcome(row.verdict.class, row.truthClass);
  }
}

// --- candidate: create / create + guard ----------------------------------

const CREATE = new Set(['create']);

function rowAllWords(row) {
  const summaryWords = (row.summary || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return [...tokensForRow(row), ...summaryWords];
}

function createClaims(row) {
  // Only meaningful on POST rows that the existing (unmodified) ladder
  // would floor at x: step1/step2/step3 all null.
  if ((row.method || '').toUpperCase() !== 'POST') return false;
  const { verb } = verbForRow(row);
  return matchingMembers(verb, CREATE).length > 0;
}

function guardBlocks(row) {
  return rowAllWords(row).some((w) => matchingMembers(w, CANT_UNDO).length > 0);
}

// Classify a row with the create candidate spliced in after the normal
// ladder, only on rows the ladder would otherwise floor-post. `guarded`
// controls whether the CANT_UNDO-token guard applies.
function classifyWithCreateCandidate(row, words, guarded) {
  const base = classifyRow(row, words);
  if (base.rule !== 'floor-post') return base;
  if (!createClaims(row)) return base;
  if (guarded && guardBlocks(row)) return base;
  return { class: 'w', step: 3, rule: guarded ? 'candidate-create-guarded' : 'candidate-create', source: 'list', matched: ['create'] };
}

// --- main ----------------------------------------------------------------

function main() {
  const rows = loadRows();
  const v3Truth = loadV3Truth();
  attachTruth(rows, v3Truth);
  classifyAll(rows);

  const providers = [...new Set(rows.map((r) => r.provider))].sort();

  console.log('D87 readout — poc/d87 vs v3 relabel truth');
  console.log(`rows: ${rows.length}, providers: ${providers.length}`);
  console.log('');

  // Truth counts.
  const truthCounts = { r: 0, w: 0, x: 0 };
  for (const row of rows) truthCounts[row.truthClass] += 1;
  console.log('Truth counts (v3):');
  line('  r', truthCounts.r, pct(truthCounts.r, rows.length));
  line('  w', truthCounts.w, pct(truthCounts.w, rows.length));
  line('  x', truthCounts.x, pct(truthCounts.x, rows.length));
  console.log('');

  // ---- A. Whole flow -----------------------------------------------------
  console.log('=== A. Whole flow ===');
  const totalsByOutcome = { exact: 0, leak: 0, 'over-tight': 0 };
  for (const row of rows) totalsByOutcome[row.outcome] += 1;
  line('rows', rows.length);
  line('exact', totalsByOutcome.exact, pct(totalsByOutcome.exact, rows.length));
  line('leaks', totalsByOutcome.leak, pct(totalsByOutcome.leak, rows.length));
  line('over-tight', totalsByOutcome['over-tight'], pct(totalsByOutcome['over-tight'], rows.length));
  console.log('');
  console.log('By method:');
  const methods = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'];
  for (const m of methods) {
    const mRows = rows.filter((r) => (r.method || '').toUpperCase() === m);
    if (mRows.length === 0) continue;
    const c = { exact: 0, leak: 0, 'over-tight': 0 };
    for (const row of mRows) c[row.outcome] += 1;
    line(
      `  ${m}`,
      `n=${mRows.length}`,
      `exact=${c.exact} (${pct(c.exact, mRows.length)})`,
      `leaks=${c.leak} (${pct(c.leak, mRows.length)})`,
      `over-tight=${c['over-tight']} (${pct(c['over-tight'], mRows.length)})`,
    );
  }
  console.log('');

  // ---- B. Ledger per step and rule ---------------------------------------
  console.log('=== B. Ledger per step and rule ===');
  const stepOf = new Map([[1, 'step1'], [2, 'step2'], [3, 'step3']]);
  for (const stepNum of [1, 2, 3]) {
    console.log(`-- ${stepOf.get(stepNum)} --`);
    const stepRows = rows.filter((r) => r.verdict.step === stepNum);
    const rules = [...new Set(stepRows.map((r) => r.verdict.rule))].sort();
    const combined = { claimed: 0, exact: 0, leak: 0, 'over-tight': 0 };
    for (const rule of rules) {
      const rRows = stepRows.filter((r) => r.verdict.rule === rule);
      const c = { exact: 0, leak: 0, 'over-tight': 0 };
      for (const row of rRows) c[row.outcome] += 1;
      line(
        `  ${rule}`,
        `claimed=${rRows.length}`,
        `exact=${c.exact}`,
        `leaks=${c.leak}`,
        `over-tight=${c['over-tight']}`,
      );
      combined.claimed += rRows.length;
      combined.exact += c.exact;
      combined.leak += c.leak;
      combined['over-tight'] += c['over-tight'];
    }
    line(
      '  combined',
      `claimed=${combined.claimed}`,
      `exact=${combined.exact}`,
      `leaks=${combined.leak}`,
      `over-tight=${combined['over-tight']}`,
    );
  }
  console.log('');

  // ---- C. Evidence split --------------------------------------------------
  console.log('=== C. Evidence split ===');
  for (const src of ['list', 'floor']) {
    const srcRows = rows.filter((r) => r.verdict.source === src);
    const c = { exact: 0, leak: 0, 'over-tight': 0 };
    for (const row of srcRows) c[row.outcome] += 1;
    line(
      `  source=${src}`,
      `n=${srcRows.length}`,
      `leaks=${c.leak} (${pct(c.leak, srcRows.length)})`,
      `over-tight=${c['over-tight']} (${pct(c['over-tight'], srcRows.length)})`,
    );
  }
  console.log('');
  console.log('Every leak on a list row:');
  const listLeaks = rows.filter((r) => r.verdict.source === 'list' && r.outcome === 'leak');
  line('  count', listLeaks.length);
  for (const row of listLeaks) {
    const summary = (row.summary || '').slice(0, 60);
    line(
      ' ',
      row.row_id,
      row.provider,
      row.method,
      row.operationId || '',
      JSON.stringify(summary),
      row.verdict.rule,
      JSON.stringify(row.verdict.matched),
      `truth=${row.truthClass}`,
      `pred=${row.verdict.class}`,
    );
  }
  console.log('');

  // ---- D. Per-member pricing ----------------------------------------------
  console.log('=== D. Per-member pricing ===');
  console.log('-- step3 KEEP_W (fitted, over rows each member claims in the full flow) --');
  for (const member of [...KEEP_W].sort()) {
    const claims = rows.filter(
      (r) => r.verdict.step === 3 && r.verdict.source === 'list' && r.verdict.matched.includes(member),
    );
    const fixed = claims.filter((r) => r.truthClass === 'w' || r.truthClass === 'r').length;
    const leaks = claims.filter((r) => r.truthClass === 'x').length;
    const ratio = fixed / Math.max(leaks, 1);
    const provs = new Set(claims.map((r) => r.provider));
    const mark = ratio < 10 ? '  <-- below ratio 10' : '';
    line(
      `  ${member}`,
      `claims=${claims.length}`,
      `fixed=${fixed}`,
      `leaks=${leaks}`,
      `ratio=${ratio.toFixed(2)}`,
      `providers=${provs.size}`,
      mark,
    );
  }
  console.log('');
  console.log('-- step2 CANT_UNDO (fitted) --');
  const neverFire = [];
  for (const member of [...CANT_UNDO].sort()) {
    const claims = rows.filter(
      (r) => r.verdict.step === 2 && r.verdict.source === 'list' && r.verdict.matched.includes(member),
    );
    if (claims.length === 0) {
      neverFire.push(member);
      continue;
    }
    const postClaims = claims.filter((r) => (r.method || '').toUpperCase() === 'POST');
    const writeClaims = claims.filter((r) => ['PUT', 'PATCH'].includes((r.method || '').toUpperCase()));
    const closed = writeClaims.filter((r) => r.truthClass === 'x').length;
    const falseAlarms = writeClaims.filter((r) => r.truthClass === 'w' || r.truthClass === 'r').length;
    const provs = new Set(claims.map((r) => r.provider));
    line(
      `  ${member}`,
      `POST-claims(evidence-only)=${postClaims.length}`,
      `PUT/PATCH-closed=${closed}`,
      `PUT/PATCH-false-alarms=${falseAlarms}`,
      `providers=${provs.size}`,
    );
  }
  console.log(`  never fire: ${neverFire.join(', ') || '(none)'}`);
  console.log('');

  // ---- E. Candidates not in the lists --------------------------------------
  console.log('=== E. Candidates NOT in the lists (pricing only) ===');

  function priceCreateCandidate(guarded) {
    const claims = rows.filter((r) => {
      if (r.verdict.rule !== 'floor-post') return false;
      if (!createClaims(r)) return false;
      if (guarded && guardBlocks(r)) return false;
      return true;
    });
    const fixed = claims.filter((r) => r.truthClass === 'w' || r.truthClass === 'r').length;
    const leaks = claims.filter((r) => r.truthClass === 'x').length;
    const ratio = fixed / Math.max(leaks, 1);
    return { claims, fixed, leaks, ratio };
  }

  function wholeFlowWithCandidate(guarded) {
    let exact = 0;
    let leak = 0;
    let overTight = 0;
    for (const row of rows) {
      const v = classifyWithCreateCandidate(row, {}, guarded);
      const o = outcome(v.class, row.truthClass);
      if (o === 'exact') exact += 1;
      else if (o === 'leak') leak += 1;
      else overTight += 1;
    }
    return { exact, leak, overTight };
  }

  console.log('-- create alone added to KEEP_W --');
  {
    const p = priceCreateCandidate(false);
    line('  fixed', p.fixed, 'leaks', p.leaks, 'ratio', p.ratio.toFixed(2));
    const wf = wholeFlowWithCandidate(false);
    line(
      '  whole-flow with it:',
      `exact=${wf.exact} (${pct(wf.exact, rows.length)})`,
      `leaks=${wf.leak} (${pct(wf.leak, rows.length)})`,
      `over-tight=${wf.overTight} (${pct(wf.overTight, rows.length)})`,
    );
  }
  console.log('');
  console.log('-- create + CANT_UNDO-token guard --');
  {
    const p = priceCreateCandidate(true);
    line('  fixed', p.fixed, 'leaks', p.leaks, 'ratio', p.ratio.toFixed(2));
    const wf = wholeFlowWithCandidate(true);
    line(
      '  whole-flow with it:',
      `exact=${wf.exact} (${pct(wf.exact, rows.length)})`,
      `leaks=${wf.leak} (${pct(wf.leak, rows.length)})`,
      `over-tight=${wf.overTight} (${pct(wf.overTight, rows.length)})`,
    );
    const stillLeak = p.claims.filter((r) => r.truthClass === 'x');
    console.log(`  create rows the guard still lets leak (n=${stillLeak.length}):`);
    for (const row of stillLeak) {
      line('   ', row.row_id, row.provider, row.operationId || '', JSON.stringify((row.summary || '').slice(0, 60)));
    }
  }
  console.log('');

  // ---- F. LOVO ---------------------------------------------------------
  console.log('=== F. LOVO (leave-one-provider-out) ===');

  function rebuildKeepW(otherRows) {
    const kept = new Set();
    for (const member of KEEP_W) {
      const claims = otherRows.filter((r) => {
        if ((r.method || '').toUpperCase() !== 'POST') return false;
        const { verb } = verbForRow(r);
        return matchingMembers(verb, new Set([member])).length > 0;
      });
      const fixed = claims.filter((r) => r.truthClass === 'w' || r.truthClass === 'r').length;
      const leaks = claims.filter((r) => r.truthClass === 'x').length;
      const provs = new Set(claims.map((r) => r.provider)).size;
      const ratio = fixed / Math.max(leaks, 1);
      if (leaks === 0 || (ratio >= 10 && provs >= 2)) kept.add(member);
    }
    return kept;
  }

  function rebuildCantUndo(otherRows) {
    const kept = new Set();
    for (const member of CANT_UNDO) {
      const claims = otherRows.filter((r) => {
        const method = (r.method || '').toUpperCase();
        if (!['POST', 'PUT', 'PATCH'].includes(method)) return false;
        const { verb } = verbForRow(r);
        return matchingMembers(verb, new Set([member])).length > 0;
      });
      if (claims.length === 0) {
        kept.add(member); // unfired member costs nothing
        continue;
      }
      const countX = claims.filter((r) => r.truthClass === 'x').length;
      const countWR = claims.filter((r) => r.truthClass === 'w' || r.truthClass === 'r').length;
      const provs = new Set(claims.map((r) => r.provider)).size;
      if (countX > countWR && provs >= 2) kept.add(member);
    }
    return kept;
  }

  function rebuildCreateCandidate(otherRows, guarded) {
    const claims = otherRows.filter((r) => {
      if ((r.method || '').toUpperCase() !== 'POST') return false;
      if (!createClaims(r)) return false;
      // Price against the OTHER providers' plain ladder (fitted lists),
      // consistent with the fitted pricing in section E.
      const base = classifyRow(r);
      if (base.rule !== 'floor-post') return false;
      if (guarded && guardBlocks(r)) return false;
      return true;
    });
    const fixed = claims.filter((r) => r.truthClass === 'w' || r.truthClass === 'r').length;
    const leaks = claims.filter((r) => r.truthClass === 'x').length;
    const provs = new Set(claims.map((r) => r.provider)).size;
    const ratio = fixed / Math.max(leaks, 1);
    return ratio >= 10 && provs >= 2;
  }

  const lovoRows = [];
  let lovoLeak = 0;
  let lovoOverTight = 0;
  let lovoExact = 0;
  const candTotals = {
    create: { fixed: 0, leaks: 0, keptCount: 0 },
    createGuarded: { fixed: 0, leaks: 0, keptCount: 0 },
  };

  for (const provider of providers) {
    const otherRows = rows.filter((r) => r.provider !== provider);
    const heldRows = rows.filter((r) => r.provider === provider);

    const rebuiltKeepW = rebuildKeepW(otherRows);
    const rebuiltCantUndo = rebuildCantUndo(otherRows);
    const words = { keepW: rebuiltKeepW, cantUndo: rebuiltCantUndo };

    let exact = 0;
    let leak = 0;
    let overTight = 0;
    for (const row of heldRows) {
      const v = classifyRow(row, words);
      const o = outcome(v.class, row.truthClass);
      if (o === 'exact') exact += 1;
      else if (o === 'leak') leak += 1;
      else overTight += 1;
    }
    lovoExact += exact;
    lovoLeak += leak;
    lovoOverTight += overTight;

    const createKept = rebuildCreateCandidate(otherRows, false);
    const createGuardedKept = rebuildCreateCandidate(otherRows, true);
    if (createKept) {
      const claims = heldRows.filter((r) => (r.method || '').toUpperCase() === 'POST' && createClaims(r) && classifyRow(r).rule === 'floor-post');
      candTotals.create.fixed += claims.filter((r) => r.truthClass === 'w' || r.truthClass === 'r').length;
      candTotals.create.leaks += claims.filter((r) => r.truthClass === 'x').length;
      candTotals.create.keptCount += 1;
    }
    if (createGuardedKept) {
      const claims = heldRows.filter(
        (r) => (r.method || '').toUpperCase() === 'POST' && createClaims(r) && classifyRow(r).rule === 'floor-post' && !guardBlocks(r),
      );
      candTotals.createGuarded.fixed += claims.filter((r) => r.truthClass === 'w' || r.truthClass === 'r').length;
      candTotals.createGuarded.leaks += claims.filter((r) => r.truthClass === 'x').length;
      candTotals.createGuarded.keptCount += 1;
    }

    lovoRows.push({ provider, n: heldRows.length, leak, overTight, keepWKept: rebuiltKeepW.size, cantUndoKept: rebuiltCantUndo.size });
    line(
      `  ${provider}`,
      `rows=${heldRows.length}`,
      `leaks=${leak}`,
      `over-tight=${overTight}`,
      `KEEP_W-kept=${rebuiltKeepW.size}/${KEEP_W.size}`,
      `CANT_UNDO-kept=${rebuiltCantUndo.size}/${CANT_UNDO.size}`,
    );
  }
  console.log('');
  console.log('TOTAL');
  line('  rows', rows.length, 'exact', lovoExact, 'leaks', lovoLeak, 'over-tight', lovoOverTight);
  console.log('');
  const fittedLeakPct = (100 * totalsByOutcome.leak) / rows.length;
  const lovoLeakPct = (100 * lovoLeak) / rows.length;
  const fittedOverTightPct = (100 * totalsByOutcome['over-tight']) / rows.length;
  const lovoOverTightPct = (100 * lovoOverTight) / rows.length;
  console.log('fitted-vs-LOVO:');
  line(
    `  leak % fitted=${fittedLeakPct.toFixed(1)}%`,
    `LOVO=${lovoLeakPct.toFixed(1)}%`,
    `diff=${(lovoLeakPct - fittedLeakPct).toFixed(1)}pt`,
  );
  line(
    `  over-tight % fitted=${fittedOverTightPct.toFixed(1)}%`,
    `LOVO=${lovoOverTightPct.toFixed(1)}%`,
    `diff=${(lovoOverTightPct - fittedOverTightPct).toFixed(1)}pt`,
  );
  console.log('');
  console.log('create candidate under LOVO:');
  {
    const t = candTotals.create;
    const ratio = t.fixed / Math.max(t.leaks, 1);
    line(`  kept on ${t.keptCount}/${providers.length} held-out providers`, `fixed=${t.fixed}`, `leaks=${t.leaks}`, `ratio=${ratio.toFixed(2)}`);
  }
  console.log('create+guard candidate under LOVO:');
  {
    const t = candTotals.createGuarded;
    const ratio = t.fixed / Math.max(t.leaks, 1);
    line(`  kept on ${t.keptCount}/${providers.length} held-out providers`, `fixed=${t.fixed}`, `leaks=${t.leaks}`, `ratio=${ratio.toFixed(2)}`);
  }
  console.log('');

  // ---- G. Per provider (fitted) --------------------------------------------
  console.log('=== G. Per provider (fitted) ===');
  for (const provider of providers) {
    const pRows = rows.filter((r) => r.provider === provider);
    const c = { exact: 0, leak: 0, 'over-tight': 0 };
    for (const row of pRows) c[row.outcome] += 1;
    line(
      `  ${provider}`,
      `n=${pRows.length}`,
      `exact=${pct(c.exact, pRows.length)}`,
      `leaks=${c.leak}`,
      `over-tight=${c['over-tight']}`,
    );
  }
}

main();
