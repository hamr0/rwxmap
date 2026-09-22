// poc/d87/lovo3.mjs — the D87 ladder scored the hard way: leave THREE
// providers out at a time (not one), over the whole combined set. This is
// a harder read of the SAME tuning data poc/d87/readout.mjs's LOVO section
// (F) scores leave-one-out on — not a clean exam, never used to pick a
// shape (D24). Run: node poc/d87/lovo3.mjs
//
// Imports the graduated src/ ladder itself (classifyRow, tokens, applyJev)
// — this measures src/, not a poc/ copy of it. Reuses the SAME adoption
// rules poc/d87/readout.mjs's LOVO section (F) uses to rebuild
// CANT_UNDO/KEEP_W; nothing here invents a new adoption rule.
//
// NOTE on classifyRow: src/flow.js's classifyRow(row, words) now exposes
// the same words seam every step already had — this file passes the
// fold's rebuilt {cantUndo, keepW} straight through it rather than
// reproducing the ladder's run order itself. step1's own lists
// (READ_VERBS/SAFE_VERBS) are never rebuilt here, exactly as
// poc/d87/readout.mjs's LOVO section never rebuilds them either — only
// CANT_UNDO and KEEP_W move.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { matchingMembers, verbForRow } from '../../src/tokens.js';
import { CANT_UNDO } from '../../src/step2.js';
import { KEEP_W } from '../../src/step3.js';
import { classifyRow } from '../../src/flow.js';
import { applyJev, needsJev } from '../../src/jev.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const RANK = { r: 0, w: 1, x: 2 };
const CANT_UNDO_FULL = [...CANT_UNDO].sort();
const KEEP_W_FULL = [...KEEP_W].sort();

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

// --- 1. load rows + v3 truth, exactly as poc/d87/readout.mjs -------------

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

// --- 2. load Jev floor-post answers, keyed by row_id ----------------------

function loadJevAnswers() {
  const p = path.join(ROOT, 'data', 'jev-2026-09-22', 'out-floor.jsonl.gz');
  const text = zlib.gunzipSync(fs.readFileSync(p)).toString('utf8');
  const map = new Map();
  for (const l of text.split('\n')) {
    if (!l.trim()) continue;
    const o = JSON.parse(l);
    map.set(o.row_id, o);
  }
  return map;
}

// Build the {p, model} shape applyJev expects, or undefined when the row
// has no usable answer at all (missing row_id, an error entry, or a
// malformed noul field) — applyJev's own fail-closed checks handle the
// rest (bad p range, missing model string), but we track "no answer"
// separately here so it can be reported on its own.
function jevAnswerFor(jevMap, rowId) {
  const o = jevMap.get(rowId);
  if (!o || o.error) return { answer: undefined, hadEntry: Boolean(o) };
  const p = o.answers && o.answers.isX && o.answers.isX.noul;
  if (typeof p !== 'number' || !Number.isFinite(p)) return { answer: undefined, hadEntry: true };
  return { answer: { p, model: o.model }, hadEntry: true };
}

// --- 3. precompute per-row, once ------------------------------------------

function precomputeRows(rows) {
  for (const row of rows) {
    const method = (row.method || '').toUpperCase();
    row._method = method;
    const { verb } = verbForRow(row);
    row._verb = verb;
    // Every member of CANT_UNDO/KEEP_W this row's verb matches, against the
    // FULL (fitted) lists. A fold's rebuilt (sub-)set can only ever be a
    // subset of these, so this is the complete set of members a rebuild
    // could possibly still let fire on this row.
    row._cantUndoHits = (method === 'POST' || method === 'PUT' || method === 'PATCH')
      ? matchingMembers(verb, CANT_UNDO)
      : [];
    row._keepWHits = method === 'POST' ? matchingMembers(verb, KEEP_W) : [];
  }
}

// --- per-member, per-provider aggregates (built once, reused every fold) --

// perMember[member] = Map<provider, {a: number, b: number}>
// CANT_UNDO: a = truth-x count (agrees), b = truth-w/r count (false alarm).
// KEEP_W:    a = truth-w/r count (fixed), b = truth-x count (leak).
function buildMemberProviderAgg(rows, members, hitsField, isAgree) {
  const perMember = new Map();
  for (const m of members) perMember.set(m, new Map());
  for (const row of rows) {
    const hits = row[hitsField];
    if (hits.length === 0) continue;
    for (const m of hits) {
      const byProvider = perMember.get(m);
      let cell = byProvider.get(row.provider);
      if (!cell) {
        cell = { a: 0, b: 0 };
        byProvider.set(row.provider, cell);
      }
      if (isAgree(row.truthClass)) cell.a += 1;
      else cell.b += 1;
    }
  }
  return perMember;
}

// --- rebuild decisions, IDENTICAL to poc/d87/readout.mjs's LOVO section F -

function keepWMemberKept(fixed, leak, provs) {
  const ratio = fixed / Math.max(leak, 1);
  return leak === 0 || (ratio >= 10 && provs >= 2);
}

// Called as decide(a, b, provs) by rebuildForFold, where a = countX
// (agrees) and b = countWR (false alarms) — same shape as keepWMemberKept.
function cantUndoMemberKept(countX, countWR, provs) {
  const claimsCount = countX + countWR;
  if (claimsCount === 0) return true; // unfired member costs nothing
  return countX > countWR && provs >= 2;
}

function rebuildForFold(perMemberAgg, members, heldOut, decide) {
  const kept = new Set();
  for (const m of members) {
    const byProvider = perMemberAgg.get(m);
    let a = 0;
    let b = 0;
    let provs = 0;
    for (const [provider, cell] of byProvider) {
      if (heldOut.has(provider)) continue;
      a += cell.a;
      b += cell.b;
      provs += 1;
    }
    if (decide(a, b, provs)) kept.add(m);
  }
  return kept;
}

// --- classification for one row, via the src/ ladder's own classifyRow ---

function classifyFold(row, cantUndoSet, keepWSet) {
  return classifyRow(row, { cantUndo: cantUndoSet, keepW: keepWSet });
}

// --- main ------------------------------------------------------------------

function main() {
  const t0 = Date.now();

  const rows = loadRows();
  const v3Truth = loadV3Truth();
  attachTruth(rows, v3Truth);
  precomputeRows(rows);

  const jevMap = loadJevAnswers();
  for (const row of rows) {
    const { answer, hadEntry } = jevAnswerFor(jevMap, row.row_id);
    row._jevAnswer = answer;
    row._jevHadEntry = hadEntry;
  }

  const providers = [...new Set(rows.map((r) => r.provider))].sort();
  const rowsByProvider = new Map(providers.map((p) => [p, rows.filter((r) => r.provider === p)]));

  const cantUndoAgg = buildMemberProviderAgg(rows, CANT_UNDO_FULL, '_cantUndoHits', (t) => t === 'x');
  const keepWAgg = buildMemberProviderAgg(rows, KEEP_W_FULL, '_keepWHits', (t) => t === 'w' || t === 'r');

  console.log('D87 leave-THREE-providers-out — poc/d87/lovo3.mjs vs v3 relabel truth');
  console.log(`rows: ${rows.length}, providers: ${providers.length}, triples: C(23,3) = ${(23 * 22 * 21) / 6}`);
  console.log('');

  // Triples, in index form for speed, generated once.
  const triples = [];
  for (let i = 0; i < providers.length; i += 1) {
    for (let j = i + 1; j < providers.length; j += 1) {
      for (let k = j + 1; k < providers.length; k += 1) {
        triples.push([providers[i], providers[j], providers[k]]);
      }
    }
  }

  // Micro totals.
  let totalN = 0;
  const mechTotals = { exact: 0, leak: 0, 'over-tight': 0 };
  const jevTotals = { exact: 0, leak: 0, 'over-tight': 0 };
  let noJevAnswerInstances = 0; // (row, fold) pairs: floor-post + no usable answer
  const noJevAnswerRowIds = new Set(); // distinct rows ever hitting that case

  const foldStats = []; // {providers, n, leakMech, otMech, leakJev, otJev}

  // Member-drop tallies.
  const cantUndoDropCount = new Map(CANT_UNDO_FULL.map((m) => [m, 0]));
  const keepWDropCount = new Map(KEEP_W_FULL.map((m) => [m, 0]));
  let cantUndoKeptSum = 0;
  let keepWKeptSum = 0;

  // Per-provider accumulators.
  const provAgg = new Map(providers.map((p) => [p, {
    n: 0, leakMech: 0, otMech: 0, leakJev: 0, otJev: 0,
  }]));

  for (const triple of triples) {
    const heldOut = new Set(triple);

    const keptCantUndo = rebuildForFold(cantUndoAgg, CANT_UNDO_FULL, heldOut, cantUndoMemberKept);
    const keptKeepW = rebuildForFold(keepWAgg, KEEP_W_FULL, heldOut, keepWMemberKept);

    cantUndoKeptSum += keptCantUndo.size;
    keepWKeptSum += keptKeepW.size;
    for (const m of CANT_UNDO_FULL) if (!keptCantUndo.has(m)) cantUndoDropCount.set(m, cantUndoDropCount.get(m) + 1);
    for (const m of KEEP_W_FULL) if (!keptKeepW.has(m)) keepWDropCount.set(m, keepWDropCount.get(m) + 1);

    let n = 0;
    let leakMech = 0;
    let otMech = 0;
    let leakJev = 0;
    let otJev = 0;

    for (const provider of triple) {
      const pRows = rowsByProvider.get(provider);
      const agg = provAgg.get(provider);
      for (const row of pRows) {
        const verdict = classifyFold(row, keptCantUndo, keptKeepW);
        const mechOutcome = outcome(verdict.class, row.truthClass);

        let jevVerdict = verdict;
        if (needsJev(verdict)) {
          if (!row._jevAnswer) {
            noJevAnswerInstances += 1;
            noJevAnswerRowIds.add(row.row_id);
          }
          jevVerdict = applyJev(verdict, row._jevAnswer);
        }
        const jevOutcome = outcome(jevVerdict.class, row.truthClass);

        n += 1;
        if (mechOutcome === 'leak') leakMech += 1;
        else if (mechOutcome === 'over-tight') otMech += 1;
        if (jevOutcome === 'leak') leakJev += 1;
        else if (jevOutcome === 'over-tight') otJev += 1;

        mechTotals[mechOutcome] += 1;
        jevTotals[jevOutcome] += 1;

        agg.n += 1;
        if (mechOutcome === 'leak') agg.leakMech += 1;
        else if (mechOutcome === 'over-tight') agg.otMech += 1;
        if (jevOutcome === 'leak') agg.leakJev += 1;
        else if (jevOutcome === 'over-tight') agg.otJev += 1;
      }
    }

    totalN += n;
    foldStats.push({
      providers: triple,
      n,
      leakMech, otMech, leakJev, otJev,
      leakPctMech: (100 * leakMech) / n,
      otPctMech: (100 * otMech) / n,
      leakPctJev: (100 * leakJev) / n,
      otPctJev: (100 * otJev) / n,
    });
  }

  const elapsedMs = Date.now() - t0;
  console.log(`runtime: ${(elapsedMs / 1000).toFixed(1)}s for ${triples.length} folds`);
  console.log('');

  // ---- Overall micro-average -----------------------------------------------
  console.log('=== Overall micro-average across all 1771 folds ===');
  console.log('(every row of the 6557 appears in C(22,2) = 231 folds as a held-out row; totals below are pooled over all fold classifications)');
  line('  total (row, fold) classifications', totalN, `(expected ${rows.length} * 231 = ${rows.length * 231})`);
  console.log('  mechanical:');
  line('    exact', mechTotals.exact, pct(mechTotals.exact, totalN));
  line('    leaks', mechTotals.leak, pct(mechTotals.leak, totalN));
  line('    over-tight', mechTotals['over-tight'], pct(mechTotals['over-tight'], totalN));
  console.log('  with Jev:');
  line('    exact', jevTotals.exact, pct(jevTotals.exact, totalN));
  line('    leaks', jevTotals.leak, pct(jevTotals.leak, totalN));
  line('    over-tight', jevTotals['over-tight'], pct(jevTotals['over-tight'], totalN));
  console.log('');

  // ---- Spread across folds -------------------------------------------------
  console.log('=== Spread across the 1771 folds ===');
  function stat(arr, key) {
    const vals = arr.map((f) => f[key]).sort((a, b) => a - b);
    const mid = vals.length >> 1;
    const median = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    return { min: vals[0], median, max: vals[vals.length - 1] };
  }
  for (const [label, key] of [
    ['leak % (mechanical)', 'leakPctMech'],
    ['over-tight % (mechanical)', 'otPctMech'],
    ['leak % (with Jev)', 'leakPctJev'],
    ['over-tight % (with Jev)', 'otPctJev'],
  ]) {
    const s = stat(foldStats, key);
    line(`  ${label}:`, `min=${s.min.toFixed(1)}%`, `median=${s.median.toFixed(1)}%`, `max=${s.max.toFixed(1)}%`);
  }
  console.log('');

  console.log('10 worst folds by leak % (mechanical):');
  const worstMech = [...foldStats].sort((a, b) => b.leakPctMech - a.leakPctMech).slice(0, 10);
  for (const f of worstMech) {
    line(
      `  ${f.providers.join(' + ')}`,
      `n=${f.n}`,
      `leaks=${f.leakMech} (${f.leakPctMech.toFixed(1)}%)`,
      `over-tight=${f.otMech} (${f.otPctMech.toFixed(1)}%)`,
    );
  }
  console.log('');
  console.log('10 worst folds by leak % (with Jev):');
  const worstJev = [...foldStats].sort((a, b) => b.leakPctJev - a.leakPctJev).slice(0, 10);
  for (const f of worstJev) {
    line(
      `  ${f.providers.join(' + ')}`,
      `n=${f.n}`,
      `leaks=${f.leakJev} (${f.leakPctJev.toFixed(1)}%)`,
      `over-tight=${f.otJev} (${f.otPctJev.toFixed(1)}%)`,
    );
  }
  console.log('');

  // ---- Per provider ---------------------------------------------------------
  console.log('=== Per provider, averaged over the 231 folds it appears in ===');
  console.log('(its row count is fixed across those folds, so pooled-average == mean-of-per-fold-rate here)');
  const provRows = providers.map((p) => {
    const agg = provAgg.get(p);
    const perFoldN = agg.n / 231;
    return {
      provider: p,
      perFoldN,
      leakPctMech: (100 * agg.leakMech) / agg.n,
      otPctMech: (100 * agg.otMech) / agg.n,
      leakPctJev: (100 * agg.leakJev) / agg.n,
      otPctJev: (100 * agg.otJev) / agg.n,
    };
  }).sort((a, b) => b.leakPctMech - a.leakPctMech);
  for (const p of provRows) {
    line(
      `  ${p.provider}`,
      `rows=${p.perFoldN.toFixed(0)}`,
      `leak%(mech)=${p.leakPctMech.toFixed(1)}%`,
      `over-tight%(mech)=${p.otPctMech.toFixed(1)}%`,
      `leak%(jev)=${p.leakPctJev.toFixed(1)}%`,
      `over-tight%(jev)=${p.otPctJev.toFixed(1)}%`,
    );
  }
  console.log('');

  // ---- List survival ---------------------------------------------------------
  console.log('=== List survival across the 1771 folds ===');
  line(
    '  CANT_UNDO members surviving per fold, average',
    (cantUndoKeptSum / triples.length).toFixed(2),
    `/ ${CANT_UNDO_FULL.length}`,
  );
  line(
    '  KEEP_W members surviving per fold, average',
    (keepWKeptSum / triples.length).toFixed(2),
    `/ ${KEEP_W_FULL.length}`,
  );
  console.log('');
  console.log('  CANT_UNDO members dropped most often (folds dropped / 1771):');
  const cantUndoDrops = [...cantUndoDropCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [m, c] of cantUndoDrops) if (c > 0) line(`    ${m}`, c, pct(c, triples.length));
  if (cantUndoDrops.every(([, c]) => c === 0)) console.log('    (none — every member survives every fold)');
  console.log('');
  console.log('  KEEP_W members dropped most often (folds dropped / 1771):');
  const keepWDrops = [...keepWDropCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [m, c] of keepWDrops) if (c > 0) line(`    ${m}`, c, pct(c, triples.length));
  if (keepWDrops.every(([, c]) => c === 0)) console.log('    (none — every member survives every fold)');
  console.log('');

  // ---- Jev coverage -----------------------------------------------------------
  console.log('=== Jev answer coverage ===');
  line(
    '  (row, fold) instances that were floor-post with no usable Jev answer (stayed x)',
    noJevAnswerInstances,
    `of ${totalN} total classifications`,
  );
  line('  distinct rows that ever hit that case, across any fold', noJevAnswerRowIds.size, `of ${rows.length} rows`);
  console.log('');

  // ---- Comparison with fitted and leave-ONE-out ------------------------------
  console.log('=== Comparison ===');
  console.log('  fitted (whole 6557-row set, module lists, no holdout): 5418 exact / 64 leaks / 1075 over-tight (mechanical); 6176 / 72 / 309 (with Jev)');
  console.log('  leave-ONE-out (poc/d87/readout.mjs, section F, mechanical only, no Jev, of 6557 rows): 5390 exact (82.2%) / 64 leaks (1.0%) / 1103 over-tight (16.8%)');
  console.log(
    `  leave-THREE-out (this script): exact=${mechTotals.exact} (${pct(mechTotals.exact, totalN)}) leaks=${mechTotals.leak} (${pct(mechTotals.leak, totalN)}) over-tight=${mechTotals['over-tight']} (${pct(mechTotals['over-tight'], totalN)}) [mechanical, pooled over 1771 folds]`,
  );
  console.log(
    `                                exact=${jevTotals.exact} (${pct(jevTotals.exact, totalN)}) leaks=${jevTotals.leak} (${pct(jevTotals.leak, totalN)}) over-tight=${jevTotals['over-tight']} (${pct(jevTotals['over-tight'], totalN)}) [with Jev, pooled over 1771 folds]`,
  );
  console.log('  NOTE: these are the SAME 6557 rows as the fitted and leave-one-out numbers above, just re-split and re-scored 1771 different ways — this is a harder read of the same tuning data, not a clean exam (D24). No rule shape should be picked from this file alone.');
  console.log('');
  console.log(`total runtime: ${(elapsedMs / 1000).toFixed(1)}s`);
}

main();
