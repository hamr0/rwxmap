// M1-C5: informed arbiter with the five mechanical fixes from C4 — loads
// the census + corpus-lean CSVs, sweeps the aggregation threshold T for
// both states of the corpus PATCH/POST w-lean switch (fix 5), prints both
// sweep tables, picks (T, switch) on CAMARA+holdout1 only, scores holdout2
// once at that setting, and writes the three named c5 outputs. C4's outputs
// are untouched.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../../m0/csv.mjs';
import { CLASS_ORDER, scoreRow, buildVerbTable, leadVerbWasMethodStripped } from './arbiter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
const LEANS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/corpus-leans.csv');
const OUT_ROWS = path.join(REPO_ROOT, 'docs/logs/m1/c5-rows.csv');
const OUT_FALSE_FLAGS = path.join(REPO_ROOT, 'docs/logs/m1/c5-false-flags.csv');
const OUT_SWEEP = path.join(REPO_ROOT, 'docs/logs/m1/c5-sweep.md');

const THRESHOLDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SETS = ['camara', 'holdout1', 'holdout2'];
const CORPUS_WLEAN_STATES = [true, false]; // fix 5: on, then off

const NUMERIC_LEAN_COLS = [
  'providers',
  'ops_total',
  'raw_get',
  'raw_post',
  'raw_put',
  'raw_patch',
  'raw_delete',
  'raw_head',
  'raw_options',
  'perprov_get',
  'perprov_post',
  'perprov_put',
  'perprov_patch',
  'perprov_delete',
  'perprov_head',
  'perprov_options',
];

function loadLeanIndex(leanRows) {
  const idx = new Map();
  for (const raw of leanRows) {
    if (raw.position !== 'lead') continue;
    const rec = { providers: 0 };
    for (const col of NUMERIC_LEAN_COLS) {
      const v = Number(raw[col]);
      rec[col] = Number.isFinite(v) ? v : 0;
    }
    idx.set(raw.token, rec);
  }
  return idx;
}

// Build the full ctx once (leanIndex + verbTable), score every census row at
// threshold T with the given switches, and return the array of {row, result}.
function scoreAllAt(censusRows, ctx, T, switches) {
  return censusRows.map((row) => ({ row, result: scoreRow(row, ctx, T, switches) }));
}

function summarize(scored, setName) {
  const rowsInSet = scored.filter((s) => s.row.set === setName);
  const n = rowsInSet.length;
  let assigned = 0;
  let review = 0;
  let leaks = 0;
  let overTight = 0;
  let exact = 0;
  for (const { row, result } of rowsInSet) {
    if (result.status === 'assigned') {
      assigned += 1;
      const predIdx = CLASS_ORDER[result.class];
      const truthIdx = CLASS_ORDER[row.gt_class];
      if (predIdx < truthIdx) leaks += 1;
      else if (predIdx > truthIdx) overTight += 1;
      else exact += 1;
    } else {
      review += 1;
    }
  }
  return { set: setName, n, assigned, review, leaks, overTight, exact, reviewPlusOverTight: review + overTight };
}

function formatTable(rows, header) {
  const colWidths = header.map((h) => h.length);
  const tableRows = rows.map((r) => r.map((c) => String(c)));
  for (const tr of tableRows) {
    tr.forEach((cell, i) => {
      colWidths[i] = Math.max(colWidths[i], cell.length);
    });
  }
  function fmtRow(cells) {
    return cells.map((c, i) => String(c).padEnd(colWidths[i])).join('  ');
  }
  const lines = [];
  lines.push(fmtRow(header));
  lines.push(colWidths.map((w) => '-'.repeat(w)).join('  '));
  for (const tr of tableRows) lines.push(fmtRow(tr));
  return lines.join('\n');
}

function main() {
  const censusRows = parseCsv(readFileSync(CENSUS_PATH, 'utf8'));
  const leanRows = parseCsv(readFileSync(LEANS_PATH, 'utf8'));

  const requiredCensusCols = ['set', 'repo', 'path', 'method', 'operationId', 'gt_class', 'security_scopes'];
  const censusHeader = censusRows.length ? Object.keys(censusRows[0]) : [];
  for (const col of requiredCensusCols) {
    if (!censusHeader.includes(col)) {
      throw new Error(`ESCALATE: census-ops.csv is missing required column "${col}"`);
    }
  }
  const requiredLeanCols = ['token', 'position', 'providers', ...NUMERIC_LEAN_COLS.filter((c) => c !== 'providers')];
  const leanHeader = leanRows.length ? Object.keys(leanRows[0]) : [];
  for (const col of requiredLeanCols) {
    if (!leanHeader.includes(col)) {
      throw new Error(`ESCALATE: corpus-leans.csv is missing required column "${col}"`);
    }
  }

  const leanIndex = loadLeanIndex(leanRows);
  const camaraRows = censusRows.filter((r) => r.set === 'camara');
  const verbTable = buildVerbTable(camaraRows);
  const ctx = { leanIndex, verbTable };

  // --- fix 3: rows touched (method-word lead token stripped), per set ---
  const strippedCounts = { camara: 0, holdout1: 0, holdout2: 0 };
  for (const row of censusRows) {
    if (leadVerbWasMethodStripped(row)) strippedCounts[row.set] += 1;
  }
  const strippedLine = `Fix 3 (method-word lead-token stripping) touched: camara ${strippedCounts.camara} of ${censusRows.filter((r) => r.set === 'camara').length}, holdout1 ${strippedCounts.holdout1} of ${censusRows.filter((r) => r.set === 'holdout1').length}, holdout2 ${strippedCounts.holdout2} of ${censusRows.filter((r) => r.set === 'holdout2').length}.`;
  console.log(strippedLine);

  // --- sweep, both switch states ---
  const sweepResults = []; // {corpusWLean, T, ...summary}
  const scoredByKey = new Map(); // `${corpusWLean}|${T}` -> scored
  for (const corpusWLean of CORPUS_WLEAN_STATES) {
    for (const T of THRESHOLDS) {
      const scored = scoreAllAt(censusRows, ctx, T, { corpusWLean });
      scoredByKey.set(`${corpusWLean}|${T}`, scored);
      for (const setName of SETS) {
        sweepResults.push({ corpusWLean, T, ...summarize(scored, setName) });
      }
    }
  }

  // --- print sweep tables, one per switch state ---
  const header = ['T', 'set', 'n', 'assigned', 'review', 'leaks', 'over_tight', 'exact', 'review+overtight'];
  const sweepTexts = {};
  for (const corpusWLean of CORPUS_WLEAN_STATES) {
    const rows = sweepResults
      .filter((r) => r.corpusWLean === corpusWLean)
      .map((r) => [r.T, r.set, r.n, r.assigned, r.review, r.leaks, r.overTight, r.exact, r.reviewPlusOverTight]);
    const label = corpusWLean ? 'corpus w-lean ON' : 'corpus w-lean OFF';
    const text = `${label}\n${formatTable(rows, header)}`;
    sweepTexts[corpusWLean] = text;
    console.log('\n' + text);
  }

  // --- selection: zero leaks on camara+holdout1 first, then minimize
  // (review+overtight) combined; ties broken by smallest T, then by
  // corpusWLean=true (ON) preferred over OFF. holdout2 is NOT used. ---
  let chosen = null; // {corpusWLean, T}
  let bestScore = Infinity;
  for (const corpusWLean of CORPUS_WLEAN_STATES) {
    for (const T of THRESHOLDS) {
      const byKey = sweepResults.filter((r) => r.corpusWLean === corpusWLean && r.T === T);
      const camara = byKey.find((r) => r.set === 'camara');
      const holdout1 = byKey.find((r) => r.set === 'holdout1');
      if (camara.leaks !== 0 || holdout1.leaks !== 0) continue;
      const combined = camara.reviewPlusOverTight + holdout1.reviewPlusOverTight;
      if (combined < bestScore) {
        bestScore = combined;
        chosen = { corpusWLean, T };
      }
      // ties: keep the first found, which iterates corpusWLean=true before
      // false, and T ascending within each — so ON and smaller T win ties.
    }
  }
  if (chosen === null) {
    throw new Error(
      'ESCALATE: no (corpusWLean, T) combination in the sweep achieves zero leaks on both camara and holdout1 — cannot select a setting.'
    );
  }
  const selectionLine = `Chosen corpusWLean = ${chosen.corpusWLean}, T = ${chosen.T} — minimizes (review + over-tight) = ${bestScore} on camara+holdout1 combined, subject to zero leaks on both sets (ties broken by corpusWLean=ON first, then smallest T). holdout2 was NOT used for selection; it is reported at every (switch, T) for transparency only.`;
  console.log('\n' + selectionLine);

  // --- score once at the chosen setting for the row-level outputs ---
  const finalScored = scoredByKey.get(`${chosen.corpusWLean}|${chosen.T}`);

  const rowCols = ['set', 'repo', 'path', 'method', 'operationId', 'gt_class', 'pred', 'confidence', 'status', 'evidence'];
  const outRows = finalScored.map(({ row, result }) => ({
    set: row.set,
    repo: row.repo,
    path: row.path,
    method: row.method,
    operationId: row.operationId,
    gt_class: row.gt_class,
    pred: result.class,
    confidence: result.confidence,
    status: result.status,
    evidence: result.evidence.join(';'),
  }));
  writeFileSync(OUT_ROWS, toCsv(outRows, rowCols));

  const falseFlags = outRows.filter((r) => r.status === 'assigned' && r.pred !== r.gt_class);
  writeFileSync(OUT_FALSE_FLAGS, toCsv(falseFlags, rowCols));

  // --- negative controls + queryAssistant, actual computed outcomes ---
  function findOutcome(operationId) {
    const hit = finalScored.find(({ row }) => row.operationId === operationId);
    if (!hit) return null;
    return { row: hit.row, result: hit.result };
  }
  const negControl1 = findOutcome('terminateCall');
  const negControl2 = findOutcome('updateSessionStatus');
  const queryAssistant = findOutcome('queryAssistant');

  function describeOutcome(label, found) {
    if (!found) return `${label}: NOT FOUND in census-ops.csv`;
    const { row, result } = found;
    return `${label}: method=${row.method} gt=${row.gt_class} prior=${result.prior} pred=${result.class} confidence=${result.confidence} status=${result.status} evidence=[${result.evidence.join(' ; ')}]`;
  }
  const negControlLines = [
    describeOutcome('ClickToDial terminateCall (DELETE, gt=x, negative control)', negControl1),
    describeOutcome('WebRTC updateSessionStatus (PUT, gt=x, negative control)', negControl2),
    describeOutcome('ModelAsAService queryAssistant (POST, gt=r as of the 2026-09-07 truth fix)', queryAssistant),
  ];
  console.log('\nNegative controls + queryAssistant:');
  for (const l of negControlLines) console.log('  ' + l);

  // --- write c5-sweep.md ---
  const md = [];
  md.push('# M1-C5 arbiter — threshold sweep, both corpus-w-lean switch states');
  md.push('');
  md.push(strippedLine);
  md.push('');
  for (const corpusWLean of CORPUS_WLEAN_STATES) {
    md.push('```');
    md.push(sweepTexts[corpusWLean]);
    md.push('```');
    md.push('');
  }
  md.push(`**${selectionLine}**`);
  md.push('');
  md.push('## Negative controls and queryAssistant — actual computed outcomes, at the chosen setting');
  md.push('');
  for (const l of negControlLines) md.push('- ' + l);
  md.push('');
  writeFileSync(OUT_SWEEP, md.join('\n') + '\n');

  console.log(`\nWrote ${OUT_ROWS}`);
  console.log(`Wrote ${OUT_FALSE_FLAGS} (${falseFlags.length} rows)`);
  console.log(`Wrote ${OUT_SWEEP}`);
}

main();
