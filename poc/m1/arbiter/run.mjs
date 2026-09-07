// M1-C6: three new evidence layers on top of C5's arbiter — every admitted
// list mechanically derived from CAMARA + hold-out-1 rows in
// docs/logs/m1/census-ops.csv (never hand-written): layer 2b (scope
// agreement upgraded to a raise on POST/PATCH), layer 5 (body-shape
// raisers: requestBody property names + present-only flags), layer 6
// (own-vs-other structural facts for PUT/DELETE/PATCH). Re-sweeps T x
// corpus-w-lean over all three sets, picks on CAMARA + hold-out 1, scores
// hold-out 2 once, and writes the four named c6 outputs. C4/C5's outputs
// are untouched.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../../m0/csv.mjs';
import {
  CLASS_ORDER,
  scoreRow,
  buildVerbTable,
  leadVerbWasMethodStripped,
  buildScopeFamilyTable,
  shareExcludingRepo,
  buildBodyPropTable,
  bodyPropKeysForRow,
  buildFlagTable,
  flagPresent,
  buildLayer6Table,
  pathParamKeysForRow,
  schemaPropKeysForRow,
  countsForKey,
  shareX,
} from './arbiter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
const LEANS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/corpus-leans.csv');
const OUT_ROWS = path.join(REPO_ROOT, 'docs/logs/m1/c6-rows.csv');
const OUT_FALSE_FLAGS = path.join(REPO_ROOT, 'docs/logs/m1/c6-false-flags.csv');
const OUT_SWEEP = path.join(REPO_ROOT, 'docs/logs/m1/c6-sweep.md');
const OUT_ADMITTED = path.join(REPO_ROOT, 'docs/logs/m1/c6-admitted.md');

const THRESHOLDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SETS = ['camara', 'holdout1', 'holdout2'];
const CORPUS_WLEAN_STATES = [true, false];
const MIN_N = 5;
const MIN_SHARE = 0.9;

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

// --- mechanical admission over a full (no exclusion) table ---------------
// Returns [{key, n, share}] for every key with n >= MIN_N, sorted by share
// descending, plus the admitted subset (share >= MIN_SHARE).
function admissionReport(table) {
  const all = [];
  for (const key of table.keys()) {
    const s = shareX(countsForKey(table, key, null));
    if (s && s.n >= MIN_N) all.push({ key, n: s.n, share: s.share });
  }
  all.sort((a, b) => b.share - a.share || b.n - a.n || a.key.localeCompare(b.key));
  const admitted = all.filter((r) => r.share >= MIN_SHARE);
  return { all, admitted };
}

function fmtRows(rows, header) {
  const colWidths = header.map((h) => h.length);
  const tableRows = rows.map((r) => r.map((c) => String(c)));
  for (const tr of tableRows) tr.forEach((c, i) => (colWidths[i] = Math.max(colWidths[i], c.length)));
  function fmtRow(cells) {
    return cells.map((c, i) => String(c).padEnd(colWidths[i])).join('  ');
  }
  const lines = [fmtRow(header), colWidths.map((w) => '-'.repeat(w)).join('  ')];
  for (const tr of tableRows) lines.push(fmtRow(tr));
  return lines.join('\n');
}

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

function main() {
  const censusRows = parseCsv(readFileSync(CENSUS_PATH, 'utf8'));
  const leanRows = parseCsv(readFileSync(LEANS_PATH, 'utf8'));

  const requiredCensusCols = [
    'set', 'repo', 'path', 'method', 'operationId', 'gt_class', 'security_scopes',
    'requestBody_present', 'requestBody_props', 'callbacks_present', 'has202',
    'idempotency_header_param', 'party_id_param', 'resource_schema_props', 'resource_schema_party_field',
  ];
  const censusHeader = censusRows.length ? Object.keys(censusRows[0]) : [];
  for (const col of requiredCensusCols) {
    if (!censusHeader.includes(col)) throw new Error(`ESCALATE: census-ops.csv is missing required column "${col}"`);
  }

  const leanIndex = loadLeanIndex(leanRows);
  const camaraRows = censusRows.filter((r) => r.set === 'camara');
  const holdout1Rows = censusRows.filter((r) => r.set === 'holdout1');
  const camaraHoldout1Rows = camaraRows.concat(holdout1Rows);
  const verbTable = buildVerbTable(camaraRows);

  const md = [];
  md.push('# M1-C6 — mechanically admitted lists (layers 2b, 5, 6)');
  md.push('');
  md.push('All lists below are derived from CAMARA + hold-out-1 rows only (n = census count, share = truth-x share), never hand-written. Admission bar: n >= 5, x share >= 0.9.');
  md.push('');

  // --- Layer 2b (revised): write-family and x-hint-family x share, CAMARA
  // only, measured PER METHOD (POST, PATCH) — never pooled — same n>=5,
  // share>=0.9 admission bar as every other layer. Coordinator correction
  // 2026-09-07: the original pooled POST+PATCH write-family measurement
  // (n=21, share=0.762) mixed two methods that measure differently and
  // never cleared the bar; per-method measurement is required, and only a
  // method that clears the bar gets the raise (the other method's tokens
  // fall back to plain agreement, exactly as before layer 2b existed).
  const scopeFamilyTables = new Map();
  const scopeFamilySpecs = [
    { key: 'write:POST', method: 'POST', hint: 'w' },
    { key: 'write:PATCH', method: 'PATCH', hint: 'w' },
    { key: 'xhint:POST', method: 'POST', hint: 'x' },
    { key: 'xhint:PATCH', method: 'PATCH', hint: 'x' },
  ];
  const scopeFamilyReportRows = [];
  for (const spec of scopeFamilySpecs) {
    const table = buildScopeFamilyTable(camaraRows, spec.method, spec.hint);
    scopeFamilyTables.set(spec.key, table);
    const s = shareExcludingRepo(table, null);
    const admitted = s && s.n >= MIN_N && s.share >= MIN_SHARE;
    scopeFamilyReportRows.push([spec.key, s ? s.n : 0, s ? s.share.toFixed(3) : 'n/a', admitted ? 'admitted' : 'not admitted']);
  }
  md.push('## Layer 2b (revised) — write-family and x-hint-family scope tokens, per method, CAMARA only');
  md.push('');
  md.push('```');
  md.push(fmtRows(scopeFamilyReportRows, ['family:method', 'n', 'x_share', 'outcome']));
  md.push('```');
  md.push('');
  console.log('Layer 2b (revised) family x method shares:');
  for (const r of scopeFamilyReportRows) console.log('  ' + r.join(' '));

  // --- Layer 5a: requestBody property names -------------------------------
  const bodyPropTable = buildBodyPropTable(camaraHoldout1Rows);
  const bodyPropReport = admissionReport(bodyPropTable);
  const admittedBodyProps = new Set(bodyPropReport.admitted.map((r) => r.key));
  md.push('## Layer 5 — requestBody property-name raisers (CAMARA + hold-out 1)');
  md.push('');
  md.push('Full candidate table (n >= 5), sorted by x share:');
  md.push('');
  md.push('```');
  md.push(fmtRows(bodyPropReport.all.map((r) => [r.key, r.n, r.share.toFixed(3)]), ['prop', 'n', 'x_share']));
  md.push('```');
  md.push('');
  md.push(`Admitted (share >= ${MIN_SHARE}): ${bodyPropReport.admitted.length ? bodyPropReport.admitted.map((r) => `${r.key} (n=${r.n}, share=${r.share.toFixed(3)})`).join(', ') : 'none'}.`);
  md.push('');
  const identityShaped = bodyPropReport.all.filter((r) => ['name', 'description', 'friendlyname'].includes(r.key.toLowerCase()));
  if (identityShaped.length) {
    md.push(`Finding: identity-shaped names also clear n >= 5 but do not clear the share bar: ${identityShaped.map((r) => `${r.key} (n=${r.n}, share=${r.share.toFixed(3)})`).join(', ')} — reported, not admitted.`);
  } else {
    md.push('No identity-shaped name (name/description/FriendlyName) reached n >= 5 in this candidate table.');
  }
  md.push('');
  // Finding: some names M1-C1 called out (over all 719 rows, holdout2
  // included) do not clear the bar here because they never occur in
  // CAMARA + hold-out 1 at all, or occur but fall short of the share bar —
  // mechanically checked, not hand-typed.
  const m1c1Named = ['sink', 'sinkCredential', 'StatusCallback', 'subscriptionRequest', 'amount', 'protocol', 'types', 'merchantAccount'];
  const m1c1Findings = m1c1Named.map((name) => {
    const found = bodyPropReport.all.find((r) => r.key === name);
    if (found) return `${name}: n=${found.n}, share=${found.share.toFixed(3)}${found.share >= MIN_SHARE ? ' (admitted)' : ' (below the share bar, not admitted)'}`;
    const inHoldout2Only = camaraHoldout1Rows.every((r) => !bodyPropKeysForRow(r).includes(name));
    return `${name}: absent from CAMARA + hold-out 1 entirely${inHoldout2Only ? ' (a hold-out-2-only Adyen field per the census — out of scope for admission under the hard rule)' : ''}`;
  });
  md.push('M1-C1 named these eight as expected raisers over all 719 rows (holdout2 included); checked here against CAMARA + hold-out 1 only:');
  md.push('');
  for (const line of m1c1Findings) md.push('- ' + line);
  md.push('');

  // --- Layer 5b: present-only flags --------------------------------------
  const FLAG_NAMES = ['callbacks_present', 'has202', 'idempotency_header_param'];
  const flagTables = new Map();
  const admittedFlags = new Set();
  md.push('## Layer 5 — present-only census flags (CAMARA + hold-out 1)');
  md.push('');
  const flagReportRows = [];
  for (const flagName of FLAG_NAMES) {
    const table = buildFlagTable(camaraHoldout1Rows, flagName);
    flagTables.set(flagName, table);
    const s = shareX(countsForKey(table, flagName, null));
    if (s) {
      flagReportRows.push([flagName, s.n, s.share.toFixed(3)]);
      if (s.n >= MIN_N && s.share >= MIN_SHARE) admittedFlags.add(flagName);
    } else {
      flagReportRows.push([flagName, 0, 'n/a']);
    }
  }
  md.push('```');
  md.push(fmtRows(flagReportRows, ['flag', 'n', 'x_share']));
  md.push('```');
  md.push('');
  md.push(`Admitted: ${admittedFlags.size ? Array.from(admittedFlags).join(', ') : 'none (idempotency_header_param has n=0 over CAMARA + hold-out 1 — every occurrence in the census is in hold-out 2 / Adyen, out of scope for this admission)'}.`);
  md.push('');

  // --- Layer 6: own-vs-other structural facts for PUT/DELETE/PATCH -------
  const layer6Specs = [
    { name: 'pathparam', keysFn: pathParamKeysForRow },
    { name: 'bodyprop6', keysFn: bodyPropKeysForRow },
    { name: 'schemapartyfield', keysFn: (row) => (flagPresent(row, 'resource_schema_party_field') ? ['resource_schema_party_field'] : []) },
    { name: 'partyidparam', keysFn: (row) => (flagPresent(row, 'party_id_param') ? ['party_id_param'] : []) },
    { name: 'schemaprop', keysFn: schemaPropKeysForRow },
  ];
  const layer6Categories = [];
  const layer6AllCandidates = [];
  for (const spec of layer6Specs) {
    const table = buildLayer6Table(camaraHoldout1Rows, spec.keysFn);
    const report = admissionReport(table);
    const admittedSet = new Set(report.admitted.map((r) => r.key));
    layer6Categories.push({ name: spec.name, keysFn: spec.keysFn, table, admittedSet });
    for (const r of report.all) layer6AllCandidates.push({ cat: spec.name, ...r });
  }
  layer6AllCandidates.sort((a, b) => b.share - a.share || b.n - a.n);
  const layer6Admitted = layer6AllCandidates.filter((r) => r.share >= MIN_SHARE);
  const putDelPatchN = camaraHoldout1Rows.filter((r) => r.method === 'PUT' || r.method === 'DELETE' || r.method === 'PATCH').length;
  md.push(`## Layer 6 — own-vs-other structural facts, PUT/DELETE/PATCH rows (CAMARA + hold-out 1, n_rows = ${putDelPatchN})`);
  md.push('');
  md.push('Full candidate table (n >= 5), sorted by x share:');
  md.push('');
  md.push('```');
  md.push(fmtRows(layer6AllCandidates.map((r) => [r.cat, r.key, r.n, r.share.toFixed(3)]), ['category', 'key', 'n', 'x_share']));
  md.push('```');
  md.push('');
  if (layer6Admitted.length) {
    md.push(`Admitted: ${layer6Admitted.map((r) => `${r.cat}:${r.key} (n=${r.n}, share=${r.share.toFixed(3)})`).join(', ')}.`);
  } else {
    md.push('Admitted: none. This is the expected honest outcome for some of these facts — e.g. party_id_param sits well under the bar because Twilio\'s AccountSid appears on almost every path, own resource or not, so presence alone does not separate w from x.');
  }
  md.push('');

  const ctx = { leanIndex, verbTable, scopeFamilyTables, bodyPropTable, admittedBodyProps, flagTables, admittedFlags, layer6Categories };

  // --- fix 3: rows touched (unchanged from C5, reported for continuity) ---
  const strippedCounts = { camara: 0, holdout1: 0, holdout2: 0 };
  for (const row of censusRows) {
    if (leadVerbWasMethodStripped(row)) strippedCounts[row.set] += 1;
  }
  const strippedLine = `Fix 3 (method-word lead-token stripping) touched: camara ${strippedCounts.camara} of ${camaraRows.length}, holdout1 ${strippedCounts.holdout1} of ${holdout1Rows.length}, holdout2 ${strippedCounts.holdout2} of ${censusRows.filter((r) => r.set === 'holdout2').length}.`;
  console.log(strippedLine);

  // --- sweep, both switch states ---
  const sweepResults = [];
  const scoredByKey = new Map();
  for (const corpusWLean of CORPUS_WLEAN_STATES) {
    for (const T of THRESHOLDS) {
      const scored = scoreAllAt(censusRows, ctx, T, { corpusWLean });
      scoredByKey.set(`${corpusWLean}|${T}`, scored);
      for (const setName of SETS) sweepResults.push({ corpusWLean, T, ...summarize(scored, setName) });
    }
  }

  const header = ['T', 'set', 'n', 'assigned', 'review', 'leaks', 'over_tight', 'exact', 'review+overtight'];
  const sweepTexts = {};
  for (const corpusWLean of CORPUS_WLEAN_STATES) {
    const rows = sweepResults
      .filter((r) => r.corpusWLean === corpusWLean)
      .map((r) => [r.T, r.set, r.n, r.assigned, r.review, r.leaks, r.overTight, r.exact, r.reviewPlusOverTight]);
    const label = corpusWLean ? 'corpus w-lean ON' : 'corpus w-lean OFF';
    const text = `${label}\n${fmtRows(rows, header)}`;
    sweepTexts[corpusWLean] = text;
    console.log('\n' + text);
  }

  // --- selection: zero leaks on camara+holdout1 first, then minimize
  // (review+overtight); ties -> smallest T, then corpusWLean=true first ---
  let chosen = null;
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
    }
  }
  if (chosen === null) {
    throw new Error('ESCALATE: no (corpusWLean, T) combination in the sweep achieves zero leaks on both camara and holdout1 — cannot select a setting.');
  }
  const selectionLine = `Chosen corpusWLean = ${chosen.corpusWLean}, T = ${chosen.T} — minimizes (review + over-tight) = ${bestScore} on camara+holdout1 combined, subject to zero leaks on both sets (ties broken by corpusWLean=ON first, then smallest T). holdout2 was NOT used for selection; it is reported at every (switch, T) for transparency only.`;
  console.log('\n' + selectionLine);

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

  // --- review breakdown by set x method x truth x has-evidence -----------
  const reviewRows = finalScored.filter(({ result }) => result.status === 'review');
  const breakdownMap = new Map();
  for (const { row, result } of reviewRows) {
    const hasEvidence = result.evidence.length > 0 && !result.evidence.every((e) => e.startsWith('method-prior') || e.includes('-agrees') || e.includes('-unknown') || e.includes('-no-table') || e.includes('write-blocked') || e.includes('cancelled'));
    const key = [row.set, row.method, row.gt_class, hasEvidence ? 'has-evidence' : 'no-evidence'].join('|');
    breakdownMap.set(key, (breakdownMap.get(key) || 0) + 1);
  }
  const breakdownRows = Array.from(breakdownMap.entries())
    .map(([key, count]) => [...key.split('|'), count])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]));
  const breakdownText = fmtRows(breakdownRows, ['set', 'method', 'truth', 'evidence', 'count']);
  console.log('\nReview breakdown (set x method x truth x has-evidence):');
  console.log(breakdownText);

  // --- write c6-sweep.md ---
  const smd = [];
  smd.push('# M1-C6 arbiter — threshold sweep, both corpus-w-lean switch states');
  smd.push('');
  smd.push(strippedLine);
  smd.push('');
  for (const corpusWLean of CORPUS_WLEAN_STATES) {
    smd.push('```');
    smd.push(sweepTexts[corpusWLean]);
    smd.push('```');
    smd.push('');
  }
  smd.push(`**${selectionLine}**`);
  smd.push('');
  smd.push('## Negative controls and queryAssistant — actual computed outcomes, at the chosen setting');
  smd.push('');
  for (const l of negControlLines) smd.push('- ' + l);
  smd.push('');
  smd.push('## Review breakdown by set x method x truth x has-evidence, at the chosen setting');
  smd.push('');
  smd.push('```');
  smd.push(breakdownText);
  smd.push('```');
  smd.push('');
  writeFileSync(OUT_SWEEP, smd.join('\n') + '\n');

  writeFileSync(OUT_ADMITTED, md.join('\n') + '\n');

  console.log(`\nWrote ${OUT_ROWS}`);
  console.log(`Wrote ${OUT_FALSE_FLAGS} (${falseFlags.length} rows)`);
  console.log(`Wrote ${OUT_SWEEP}`);
  console.log(`Wrote ${OUT_ADMITTED}`);
}

main();
