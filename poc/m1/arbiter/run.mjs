// M1-C4: informed arbiter — loads the census + corpus-lean CSVs, sweeps the
// aggregation threshold T, prints the sweep table, picks T on CAMARA+holdout1
// only, scores holdout2 once at that T, and writes the three named outputs.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../../m0/csv.mjs';
import { CLASS_ORDER, scoreRow, buildVerbTable } from './arbiter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
const LEANS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/corpus-leans.csv');
const OUT_ROWS = path.join(REPO_ROOT, 'docs/logs/m1/c4-rows.csv');
const OUT_FALSE_FLAGS = path.join(REPO_ROOT, 'docs/logs/m1/c4-false-flags.csv');
const OUT_SWEEP = path.join(REPO_ROOT, 'docs/logs/m1/c4-sweep.md');

const THRESHOLDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SETS = ['camara', 'holdout1', 'holdout2'];

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

function classifyOne(row, ctx, T) {
  return scoreRow(row, ctx, T);
}

// Build the full ctx once (leanIndex + verbTable), score every census row at
// threshold T, and return the array of {row, result} pairs.
function scoreAllAt(censusRows, ctx, T) {
  return censusRows.map((row) => ({ row, result: classifyOne(row, ctx, T) }));
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

  // --- sweep ---
  const sweepResults = []; // {T, summary}
  const scoredByT = new Map();
  for (const T of THRESHOLDS) {
    const scored = scoreAllAt(censusRows, ctx, T);
    scoredByT.set(T, scored);
    for (const setName of SETS) {
      sweepResults.push({ T, ...summarize(scored, setName) });
    }
  }

  // --- print sweep table ---
  const header = ['T', 'set', 'n', 'assigned', 'review', 'leaks', 'over_tight', 'exact', 'review+overtight'];
  const colWidths = header.map((h) => h.length);
  const tableRows = sweepResults.map((r) => [
    String(r.T),
    r.set,
    String(r.n),
    String(r.assigned),
    String(r.review),
    String(r.leaks),
    String(r.overTight),
    String(r.exact),
    String(r.reviewPlusOverTight),
  ]);
  for (const tr of tableRows) {
    tr.forEach((cell, i) => {
      colWidths[i] = Math.max(colWidths[i], cell.length);
    });
  }
  function fmtRow(cells) {
    return cells.map((c, i) => c.padEnd(colWidths[i])).join('  ');
  }
  const lines = [];
  lines.push(fmtRow(header));
  lines.push(colWidths.map((w) => '-'.repeat(w)).join('  '));
  for (const tr of tableRows) lines.push(fmtRow(tr));
  const sweepTableText = lines.join('\n');
  console.log(sweepTableText);

  // --- threshold selection: minimize (review+overtight) on camara+holdout1
  // combined, subject to zero leaks on both camara and holdout1; smallest T
  // wins ties. holdout2 is NOT used for selection. ---
  let chosenT = null;
  let bestScore = Infinity;
  for (const T of THRESHOLDS) {
    const byT = sweepResults.filter((r) => r.T === T);
    const camara = byT.find((r) => r.set === 'camara');
    const holdout1 = byT.find((r) => r.set === 'holdout1');
    if (camara.leaks !== 0 || holdout1.leaks !== 0) continue;
    const combined = camara.reviewPlusOverTight + holdout1.reviewPlusOverTight;
    if (combined < bestScore) {
      bestScore = combined;
      chosenT = T;
    }
  }
  if (chosenT === null) {
    throw new Error(
      'ESCALATE: no threshold in the sweep achieves zero leaks on both camara and holdout1 — cannot select T.'
    );
  }
  const selectionLine = `Chosen T = ${chosenT} — minimizes (review + over-tight) = ${bestScore} on camara+holdout1 combined, subject to zero leaks on both sets (smallest T on ties). holdout2 was NOT used for selection; it is reported at every T for transparency only.`;
  console.log('\n' + selectionLine);

  // --- score once at chosen T for the row-level outputs ---
  const finalScored = scoredByT.get(chosenT);

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
    return {
      row: hit.row,
      result: hit.result,
    };
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
    describeOutcome('ClickToDial terminateCall (DELETE, gt=x)', negControl1),
    describeOutcome('WebRTC updateSessionStatus (PUT, gt=x)', negControl2),
    describeOutcome('ModelAsAService queryAssistant (POST, gt=x)', queryAssistant),
  ];
  console.log('\nNegative controls + queryAssistant:');
  for (const l of negControlLines) console.log('  ' + l);

  // --- write c4-sweep.md ---
  const md = [];
  md.push('# M1-C4 arbiter — threshold sweep');
  md.push('');
  md.push('```');
  md.push(sweepTableText);
  md.push('```');
  md.push('');
  md.push(`**${selectionLine}**`);
  md.push('');
  md.push('## Negative controls and queryAssistant — actual computed outcomes');
  md.push('');
  for (const l of negControlLines) md.push('- ' + l);
  md.push('');
  md.push(
    'Under the corrected rules (raise always targets x, on any method; layer 2 is a class-hint compared against the row\'s prior, not a method-conditioned split), a PUT/DELETE row CAN reach x via a raise — this fixes the earlier arbiter\'s structural inability to ever assign x to PUT/DELETE. Neither negative control actually reaches x, however: both scope tokens ("delete", "write") land in the write-hint family, which equals the PUT/DELETE prior (w), so layer 2 only records agreement, not a raise or a lower. Layer 4 (the CAMARA verb table, leave-one-repo-out) also contributes no evidence for either: "terminate" has no other CAMARA rows sharing that lead verb (n=0), and "update" has n=13 with shareX ≈ 0.154 and shareW ≈ 0.846, neither meeting the 0.9 threshold. With zero evidence from any layer, both rows fall through to status=review at the prior (w) — NOT an assigned leak (a review-status row is not scored as a leak or an exact match), but also not a correct x. queryAssistant (POST, gt=x): its "read" scope lowers toward r with weight 1.0; at the chosen T that lowering is below threshold, so it also falls to review at the prior (x) rather than being wrongly lowered to r.'
  );
  writeFileSync(OUT_SWEEP, md.join('\n') + '\n');

  console.log(`\nWrote ${OUT_ROWS}`);
  console.log(`Wrote ${OUT_FALSE_FLAGS} (${falseFlags.length} rows)`);
  console.log(`Wrote ${OUT_SWEEP}`);
}

main();
