// M1-C8: layer 7, prose words (summary + description), the LAST layer per
// D30 ("prose last; raise-only"). Everything through layer 6 is unchanged
// from C7 (corpusWLean fixed ON, the C6/C7 chosen setting); this script
// adds the word layer, sweeps T x wordsOn, picks on CAMARA + hold-out 1,
// scores hold-out 2 once, and writes the four named c8 outputs.
//
// Word admission (mechanical, never hand-written):
//   1. tokenize each row's summary + description (docs/logs/m1/ops-text.csv,
//      produced by extract-text.mjs): lowercase, split on non-letters, drop
//      tokens under 3 chars (arbiter.mjs's tokenizeProse).
//   2. drop any token present in more than 40% of CAMARA + hold-out-1 ROWS
//      (row presence, not raw occurrence count) — this replaces a
//      hand-written stopword list (arbiter.mjs's highFrequencyWordTable).
//      The surviving per-row token set is attached as row.words and used by
//      every set (camara/holdout1/holdout2 alike).
//   3. build a word -> repo -> {r,w,x} table from CAMARA + hold-out-1 rows'
//      surviving tokens; admit a token at n >= 5, truth-x share >= 0.9 (the
//      same bar every other layer uses), leave-one-repo-out at score time
//      (rowExcludeRepo, same as layers 5/6).
//   4. also compute (report only, never wired) the same table's truth-w
//      share, to see whether the words carry own-vs-other at all.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../../m0/csv.mjs';
import {
  CLASS_ORDER,
  scoreRow,
  buildVerbTable,
  buildScopeFamilyTable,
  shareExcludingRepo,
  buildBodyPropTable,
  buildFlagTable,
  flagPresent,
  buildLayer6Table,
  pathParamKeysForRow,
  schemaPropKeysForRow,
  bodyPropKeysForRow,
  countsForKey,
  shareX,
  shareW,
  tokenizeProse,
  highFrequencyWordTable,
  buildWordTable,
  wordKeysForRow,
} from './arbiter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
const LEANS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/corpus-leans.csv');
const TEXT_PATH = path.join(REPO_ROOT, 'docs/logs/m1/ops-text.csv');
const C7_ROWS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/c7-rows.csv');
const OUT_ROWS = path.join(REPO_ROOT, 'docs/logs/m1/c8-rows.csv');
const OUT_FALSE_FLAGS = path.join(REPO_ROOT, 'docs/logs/m1/c8-false-flags.csv');
const OUT_SWEEP = path.join(REPO_ROOT, 'docs/logs/m1/c8-sweep.md');
const OUT_ADMITTED = path.join(REPO_ROOT, 'docs/logs/m1/c8-admitted.md');

const THRESHOLDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SETS = ['camara', 'holdout1', 'holdout2'];
const WORDS_STATES = [true, false];
const CORPUS_WLEAN = true; // C6/C7 chosen setting, unchanged in this checkpoint
const MIN_N = 5;
const MIN_SHARE = 0.9;
const HIGH_FREQ_MAX_ROW_FRACTION = 0.4;

const NUMERIC_LEAN_COLS = [
  'providers', 'ops_total',
  'raw_get', 'raw_post', 'raw_put', 'raw_patch', 'raw_delete', 'raw_head', 'raw_options',
  'perprov_get', 'perprov_post', 'perprov_put', 'perprov_patch', 'perprov_delete', 'perprov_head', 'perprov_options',
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
  let assigned = 0, review = 0, leaks = 0, overTight = 0, exact = 0;
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
  const textRows = parseCsv(readFileSync(TEXT_PATH, 'utf8'));

  const requiredCensusCols = [
    'set', 'repo', 'path', 'method', 'operationId', 'gt_class', 'security_scopes',
    'requestBody_present', 'requestBody_props', 'callbacks_present', 'has202',
    'idempotency_header_param', 'party_id_param', 'resource_schema_props', 'resource_schema_party_field',
  ];
  const censusHeader = censusRows.length ? Object.keys(censusRows[0]) : [];
  for (const col of requiredCensusCols) {
    if (!censusHeader.includes(col)) throw new Error(`ESCALATE: census-ops.csv is missing required column "${col}"`);
  }

  // --- join ops-text.csv onto census rows by identity key ------------------
  const textIndex = new Map();
  for (const t of textRows) {
    const key = [t.set, t.repo, t.path, t.method, t.operationId].join('|');
    textIndex.set(key, t);
  }
  let textJoinMisses = 0;
  for (const row of censusRows) {
    const key = [row.set, row.repo, row.path, row.method, row.operationId].join('|');
    const t = textIndex.get(key);
    if (!t) { textJoinMisses += 1; row.summary = ''; row.description = ''; continue; }
    row.summary = t.summary || '';
    row.description = t.description || '';
  }
  if (textJoinMisses > 0) {
    throw new Error(`ESCALATE: ${textJoinMisses} census-ops.csv rows had no matching row in ops-text.csv — the two files are out of sync.`);
  }

  const leanIndex = loadLeanIndex(leanRows);
  const camaraRows = censusRows.filter((r) => r.set === 'camara');
  const holdout1Rows = censusRows.filter((r) => r.set === 'holdout1');
  const camaraHoldout1Rows = camaraRows.concat(holdout1Rows);
  const verbTable = buildVerbTable(camaraRows);

  const md = [];
  md.push('# M1-C8 — layer 7 word admission (prose last, D30)');
  md.push('');
  md.push('Everything through layer 6 is unchanged from C6/C7 (corpusWLean fixed ON — see c6-admitted.md for those admitted lists). This file covers layer 7 only.');
  md.push('');

  // --- carried-over layers 2b/5/6, built exactly as in run.mjs (C7) --------
  const scopeFamilyTables = new Map();
  for (const spec of [
    { key: 'write:POST', method: 'POST', hint: 'w' },
    { key: 'write:PATCH', method: 'PATCH', hint: 'w' },
    { key: 'xhint:POST', method: 'POST', hint: 'x' },
    { key: 'xhint:PATCH', method: 'PATCH', hint: 'x' },
  ]) {
    scopeFamilyTables.set(spec.key, buildScopeFamilyTable(camaraRows, spec.method, spec.hint));
  }
  const bodyPropTable = buildBodyPropTable(camaraHoldout1Rows);
  const bodyPropReport = admissionReport(bodyPropTable);
  const admittedBodyProps = new Set(bodyPropReport.admitted.map((r) => r.key));
  const FLAG_NAMES = ['callbacks_present', 'has202', 'idempotency_header_param'];
  const flagTables = new Map();
  const admittedFlags = new Set();
  for (const flagName of FLAG_NAMES) {
    const table = buildFlagTable(camaraHoldout1Rows, flagName);
    flagTables.set(flagName, table);
    const s = shareX(countsForKey(table, flagName, null));
    if (s && s.n >= MIN_N && s.share >= MIN_SHARE) admittedFlags.add(flagName);
  }
  const layer6Specs = [
    { name: 'pathparam', keysFn: pathParamKeysForRow },
    { name: 'bodyprop6', keysFn: bodyPropKeysForRow },
    { name: 'schemapartyfield', keysFn: (row) => (flagPresent(row, 'resource_schema_party_field') ? ['resource_schema_party_field'] : []) },
    { name: 'partyidparam', keysFn: (row) => (flagPresent(row, 'party_id_param') ? ['party_id_param'] : []) },
    { name: 'schemaprop', keysFn: schemaPropKeysForRow },
  ];
  const layer6Categories = layer6Specs.map((spec) => {
    const table = buildLayer6Table(camaraHoldout1Rows, spec.keysFn);
    const report = admissionReport(table);
    return { name: spec.name, keysFn: spec.keysFn, table, admittedSet: new Set(report.admitted.map((r) => r.key)) };
  });

  // --- layer 7: tokenize every row ------------------------------------------
  for (const row of censusRows) {
    row.rawWords = tokenizeProse(row.summary, row.description);
  }
  const camaraHoldout1RawWordSets = camaraHoldout1Rows.map((r) => r.rawWords);
  const droppedHighFreq = highFrequencyWordTable(camaraHoldout1RawWordSets, HIGH_FREQ_MAX_ROW_FRACTION);
  const droppedSorted = Array.from(droppedHighFreq.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  md.push(`## Layer 7 — high-frequency drop (replaces a stopword list)`);
  md.push('');
  md.push(`Tokens present in more than ${(HIGH_FREQ_MAX_ROW_FRACTION * 100).toFixed(0)}% of the ${camaraHoldout1Rows.length} CAMARA + hold-out-1 rows (row presence, not raw occurrence count) are dropped from every row's vocabulary, all three sets alike:`);
  md.push('');
  md.push('```');
  md.push(fmtRows(droppedSorted.map(([t, c]) => [t, c, (c / camaraHoldout1Rows.length).toFixed(3)]), ['token', 'rows', 'row_fraction']));
  md.push('```');
  md.push('');

  // apply the drop set to every row, all three sets
  for (const row of censusRows) {
    const words = new Set();
    for (const t of row.rawWords) if (!droppedHighFreq.has(t)) words.add(t);
    row.words = words;
  }

  // --- layer 7: admission table, CAMARA + hold-out 1, n >= 5 ---------------
  const wordTable = buildWordTable(camaraHoldout1Rows);
  const wordReport = admissionReport(wordTable);
  const admittedWords = new Set(wordReport.admitted.map((r) => r.key));

  md.push(`## Layer 7 — x-share admission table (n >= ${MIN_N}, over CAMARA + hold-out 1)`);
  md.push('');
  md.push(`Admitted (share >= ${MIN_SHARE}): ${wordReport.admitted.length ? wordReport.admitted.map((r) => `${r.key} (n=${r.n}, share=${r.share.toFixed(3)})`).join(', ') : 'none'}.`);
  md.push('');
  const topRejected = wordReport.all.filter((r) => !admittedWords.has(r.key)).sort((a, b) => b.n - a.n || b.share - a.share).slice(0, 30);
  md.push('Top 30 rejected candidates by n (n >= 5, share < 0.9):');
  md.push('');
  md.push('```');
  md.push(fmtRows(topRejected.map((r) => [r.key, r.n, r.share.toFixed(3)]), ['word', 'n', 'x_share']));
  md.push('```');
  md.push('');

  console.log('Layer 7 admitted x-words:');
  for (const r of wordReport.admitted) console.log(`  ${r.key}  n=${r.n}  share=${r.share.toFixed(3)}`);
  console.log('Layer 7 top 30 rejected by n:');
  for (const r of topRejected) console.log(`  ${r.key}  n=${r.n}  share=${r.share.toFixed(3)}`);

  // --- layer 7: w-share table, computed but NEVER wired --------------------
  const wShareAll = [];
  for (const key of wordTable.keys()) {
    const s = shareW(countsForKey(wordTable, key, null));
    if (s && s.n >= MIN_N) wShareAll.push({ key, n: s.n, share: s.share });
  }
  wShareAll.sort((a, b) => b.share - a.share || b.n - a.n || a.key.localeCompare(b.key));
  const wShareAdmittedLike = wShareAll.filter((r) => r.share >= MIN_SHARE);
  md.push(`## Layer 7 — w-share table (own-vs-other visibility only, NEVER wired into scoring; n >= ${MIN_N})`);
  md.push('');
  md.push(wShareAdmittedLike.length
    ? `Tokens that would say "own" at the same 0.9 bar: ${wShareAdmittedLike.map((r) => `${r.key} (n=${r.n}, share=${r.share.toFixed(3)})`).join(', ')}.`
    : 'No token reaches w share >= 0.9 at n >= 5 — the words do not carry own-vs-other either, same finding as layer 6\'s structural facts.');
  md.push('');
  console.log('Layer 7 w-share table (n>=5, share>=0.9, NOT wired):');
  if (wShareAdmittedLike.length) {
    for (const r of wShareAdmittedLike) console.log(`  ${r.key}  n=${r.n}  w_share=${r.share.toFixed(3)}`);
  } else {
    console.log('  none');
  }

  const ctx = {
    leanIndex, verbTable, scopeFamilyTables, bodyPropTable, admittedBodyProps,
    flagTables, admittedFlags, layer6Categories, wordTable, admittedWords,
  };

  // --- sweep, T x wordsOn, corpusWLean fixed ON -----------------------------
  const sweepResults = [];
  const scoredByKey = new Map();
  for (const wordsOn of WORDS_STATES) {
    for (const T of THRESHOLDS) {
      const scored = scoreAllAt(censusRows, ctx, T, { corpusWLean: CORPUS_WLEAN, wordsOn });
      scoredByKey.set(`${wordsOn}|${T}`, scored);
      for (const setName of SETS) sweepResults.push({ wordsOn, T, ...summarize(scored, setName) });
    }
  }

  const header = ['T', 'set', 'n', 'assigned', 'review', 'leaks', 'over_tight', 'exact', 'review+overtight'];
  const sweepTexts = {};
  for (const wordsOn of WORDS_STATES) {
    const rows = sweepResults
      .filter((r) => r.wordsOn === wordsOn)
      .map((r) => [r.T, r.set, r.n, r.assigned, r.review, r.leaks, r.overTight, r.exact, r.reviewPlusOverTight]);
    const label = wordsOn ? 'words ON' : 'words OFF';
    const text = `${label}\n${fmtRows(rows, header)}`;
    sweepTexts[wordsOn] = text;
    console.log('\n' + text);
  }

  // --- selection: zero leaks on camara+holdout1 first, then minimize
  // (review+overtight); ties -> smallest T, then wordsOn=true first --------
  let chosen = null;
  let bestScore = Infinity;
  for (const wordsOn of WORDS_STATES) {
    for (const T of THRESHOLDS) {
      const byKey = sweepResults.filter((r) => r.wordsOn === wordsOn && r.T === T);
      const camara = byKey.find((r) => r.set === 'camara');
      const holdout1 = byKey.find((r) => r.set === 'holdout1');
      if (camara.leaks !== 0 || holdout1.leaks !== 0) continue;
      const combined = camara.reviewPlusOverTight + holdout1.reviewPlusOverTight;
      if (combined < bestScore) {
        bestScore = combined;
        chosen = { wordsOn, T };
      }
    }
  }
  if (chosen === null) {
    throw new Error('ESCALATE: no (wordsOn, T) combination in the sweep achieves zero leaks on both camara and holdout1 — cannot select a setting.');
  }
  const selectionLine = `Chosen wordsOn = ${chosen.wordsOn}, T = ${chosen.T} (corpusWLean fixed ON, the C6/C7 setting) — minimizes (review + over-tight) = ${bestScore} on camara+holdout1 combined, subject to zero leaks on both sets (ties broken by wordsOn=true first, then smallest T). holdout2 was NOT used for selection; it is reported at every (switch, T) for transparency only.`;
  console.log('\n' + selectionLine);

  const finalScored = scoredByKey.get(`${chosen.wordsOn}|${chosen.T}`);

  const rowCols = ['set', 'repo', 'path', 'method', 'operationId', 'gt_class', 'pred', 'confidence', 'status', 'evidence'];
  const outRows = finalScored.map(({ row, result }) => ({
    set: row.set, repo: row.repo, path: row.path, method: row.method, operationId: row.operationId,
    gt_class: row.gt_class, pred: result.class, confidence: result.confidence, status: result.status,
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
    describeOutcome('ModelAsAService queryAssistant (POST, gt=r)', queryAssistant),
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

  // --- rows that changed vs c7-rows.csv -------------------------------------
  const c7Rows = parseCsv(readFileSync(C7_ROWS_PATH, 'utf8'));
  const c7Index = new Map();
  for (const r of c7Rows) c7Index.set([r.set, r.repo, r.path, r.method, r.operationId].join('|'), r);
  const changed = [];
  for (const r of outRows) {
    const key = [r.set, r.repo, r.path, r.method, r.operationId].join('|');
    const prev = c7Index.get(key);
    if (!prev) { changed.push({ key, kind: 'new-row', prev: null, cur: r }); continue; }
    if (prev.pred !== r.pred || prev.status !== r.status) changed.push({ key, kind: 'changed', prev, cur: r });
  }
  const changedBySet = { camara: 0, holdout1: 0, holdout2: 0 };
  for (const c of changed) changedBySet[c.cur.set] = (changedBySet[c.cur.set] || 0) + 1;
  const newLeaks = changed.filter((c) => {
    const predIdx = CLASS_ORDER[c.cur.pred];
    const truthIdx = CLASS_ORDER[c.cur.gt_class];
    return c.cur.status === 'assigned' && predIdx < truthIdx && !(c.prev && c.prev.status === 'assigned' && CLASS_ORDER[c.prev.pred] < CLASS_ORDER[c.prev.gt_class]);
  });
  console.log(`\nRows changed vs c7-rows.csv: ${changed.length} (camara ${changedBySet.camara || 0}, holdout1 ${changedBySet.holdout1 || 0}, holdout2 ${changedBySet.holdout2 || 0}); new leaks introduced: ${newLeaks.length}.`);
  for (const c of changed) {
    console.log(`  ${c.kind} ${c.key}  gt=${c.cur.gt_class}  c7:${c.prev ? `${c.prev.pred}/${c.prev.status}` : 'n/a'} -> c8:${c.cur.pred}/${c.cur.status}`);
  }

  // --- write outputs ---------------------------------------------------------
  const smd = [];
  smd.push('# M1-C8 arbiter — threshold sweep, words ON/OFF (corpusWLean fixed ON)');
  smd.push('');
  smd.push('Layer 7 (prose words, D30 "prose last") added on top of the unchanged C6/C7 pipeline (layers 1-6, corpusWLean fixed ON — see c6-admitted.md and c7-sweep.md for those). Layer 7\'s own admitted list is in c8-admitted.md.');
  smd.push('');
  for (const wordsOn of WORDS_STATES) {
    smd.push('```');
    smd.push(sweepTexts[wordsOn]);
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
  smd.push(`## Rows changed vs c7-rows.csv: ${changed.length} (camara ${changedBySet.camara || 0}, holdout1 ${changedBySet.holdout1 || 0}, holdout2 ${changedBySet.holdout2 || 0}); new leaks introduced: ${newLeaks.length}`);
  smd.push('');
  if (changed.length) {
    smd.push('```');
    for (const c of changed) smd.push(`${c.kind} ${c.key}  gt=${c.cur.gt_class}  c7:${c.prev ? `${c.prev.pred}/${c.prev.status}` : 'n/a'} -> c8:${c.cur.pred}/${c.cur.status}`);
    smd.push('```');
    smd.push('');
  }
  writeFileSync(OUT_SWEEP, smd.join('\n') + '\n');
  writeFileSync(OUT_ADMITTED, md.join('\n') + '\n');

  console.log(`\nWrote ${OUT_ROWS}`);
  console.log(`Wrote ${OUT_FALSE_FLAGS} (${falseFlags.length} rows)`);
  console.log(`Wrote ${OUT_SWEEP}`);
  console.log(`Wrote ${OUT_ADMITTED}`);
}

main();
