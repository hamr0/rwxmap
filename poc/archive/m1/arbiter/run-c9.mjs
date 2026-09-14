// M1-C9: the two-pass shape.
//
// Pass 1 = the UNMODIFIED C7 arbiter (all layers 1, 2, 2b, 3, 4, 5, 6
// active, T = 0.75) — round-2 coordinator correction: layer3On/layer4On
// are passed as true (scoreRow's default; arbiter.mjs still carries the
// switches, they're just not used to suppress anything here anymore).
// Removing layers 3/4 in round 1 cost 23 truth-r CAMARA POSTs their corpus
// read-lean, which the floor then wrongly tightened — pass 1 is now
// byte-for-byte C7. A row pass 1 assigns keeps that result (pass=1); a row
// pass 1 leaves in review is handed to pass 2.
//
// Pass 2 = judge.mjs's R1-R5 cascade + floor, run only on those review
// rows. Rule admission is measured, not assumed: each of R1, R2, R3, R4
// (judgePostOwn) is independently checked for >=1 leak on CAMARA or
// hold-out 1; a leaking rule is turned off for the final score (never
// silently — the exact leaking rows are reported). Hold-out 2 is scored
// once, at the very end, with the final admitted+floor configuration —
// never used to decide admission.
//
// Round 3 (coordinator corrections, 2026-09-08) adds two more independently
// measured switches, each reported on and off BEFORE the standard
// per-rule admission runs on whichever state is chosen:
//   - pathPartyOn (feeds R2 only): measured off vs on, admitted on only if
//     it adds zero leaks on CAMARA/hold-out 1.
//   - liveTokenOn (feeds R1 only, but changes which rows even reach R3):
//     measured off vs on; the point is whether R3 reaches zero leaks on
//     CAMARA + hold-out 1 once updateRebootRequest is caught by R1 instead.
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
  bodyPropKeysForRow,
  buildFlagTable,
  flagPresent,
  buildLayer6Table,
  pathParamKeysForRow,
  schemaPropKeysForRow,
  countsForKey,
  shareX,
} from './arbiter.mjs';
import { judgeRow, leadVerbForJudge, headNounForRow, pathPartyIdForRow } from './judge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
const LEANS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/corpus-leans.csv');
const TEXT_PATH = path.join(REPO_ROOT, 'docs/logs/m1/ops-text.csv');
const C8_ROWS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/c8-rows.csv');
const OUT_ROWS = path.join(REPO_ROOT, 'docs/logs/m1/c9-rows.csv');
const OUT_FALSE_FLAGS = path.join(REPO_ROOT, 'docs/logs/m1/c9-false-flags.csv');
const OUT_SWEEP = path.join(REPO_ROOT, 'docs/logs/m1/c9-sweep.md');
const OUT_MISSES = path.join(REPO_ROOT, 'docs/logs/m1/c9-judge-misses.md');

const PASS1_T = 0.75;
const MIN_N = 5;
const MIN_SHARE = 0.9;
const SETS = ['camara', 'holdout1', 'holdout2'];
const ADMIT_SETS = ['camara', 'holdout1']; // rule admission looks only here

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

function classify(predClass, gtClass) {
  const predIdx = CLASS_ORDER[predClass];
  const truthIdx = CLASS_ORDER[gtClass];
  if (predIdx < truthIdx) return 'leak';
  if (predIdx > truthIdx) return 'overTight';
  return 'exact';
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

  // --- join ops-text.csv onto census rows (same join key/pattern as run-c8.mjs) ---
  const textIndex = new Map();
  for (const t of textRows) {
    textIndex.set([t.set, t.repo, t.path, t.method, t.operationId].join('|'), t);
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

  const emptyOpIdRows = censusRows.filter((r) => (r.operationId || '').trim() === '');
  console.log(`Rows with empty operationId (judge's summary-fallback fires for these): ${emptyOpIdRows.length}`);
  for (const r of emptyOpIdRows) console.log(`  ${r.set}/${r.repo} ${r.method} ${r.path} summary="${r.summary}"`);

  const NUMERIC_LEAN_COLS = [
    'providers', 'ops_total',
    'raw_get', 'raw_post', 'raw_put', 'raw_patch', 'raw_delete', 'raw_head', 'raw_options',
    'perprov_get', 'perprov_post', 'perprov_put', 'perprov_patch', 'perprov_delete', 'perprov_head', 'perprov_options',
  ];
  function loadLeanIndex(rows) {
    const idx = new Map();
    for (const raw of rows) {
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
  const leanIndex = loadLeanIndex(leanRows);
  const camaraRows = censusRows.filter((r) => r.set === 'camara');
  const holdout1Rows = censusRows.filter((r) => r.set === 'holdout1');
  const camaraHoldout1Rows = camaraRows.concat(holdout1Rows);

  // --- pass-1 ctx: exactly the C7 shape (layers 1, 2, 2b, 3, 4, 5, 6 all
  // active — round-2 correction 1 restores layer3On/layer4On to true).
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

  const verbTable = buildVerbTable(camaraRows);
  const pass1Ctx = { leanIndex, verbTable, scopeFamilyTables, bodyPropTable, admittedBodyProps, flagTables, admittedFlags, layer6Categories };
  // Round-2 coordinator correction 1: pass 1 is byte-for-byte C7 — both
  // switches true (scoreRow's own default; stated explicitly here so the
  // choice is visible, not implicit).
  const pass1Switches = { layer3On: true, layer4On: true };

  const pass1Scored = censusRows.map((row) => ({ row, result: scoreRow(row, pass1Ctx, PASS1_T, pass1Switches) }));
  const pass1Assigned = pass1Scored.filter(({ result }) => result.status === 'assigned');
  const pass1Review = pass1Scored.filter(({ result }) => result.status === 'review');
  console.log(`\nPass 1 (T=${PASS1_T}, byte-for-byte C7, layer3On/layer4On both true): assigned ${pass1Assigned.length}, review ${pass1Review.length} of ${censusRows.length}.`);
  for (const setName of SETS) {
    const n = censusRows.filter((r) => r.set === setName).length;
    const a = pass1Assigned.filter(({ row }) => row.set === setName).length;
    console.log(`  ${setName}: ${a}/${n} assigned in pass 1, ${n - a} handed to pass 2.`);
  }

  // --- pass 2: run the full R1-R4 cascade (raw, unfiltered) on the review
  // rows, floorOn false for the rule-level measurement (floor is a separate
  // axis, reported on its own below) ----------------------------------------
  const rawSwitches = { r1On: true, r2On: true, r3On: true, judgePostOwn: true, pathPartyOn: false, liveTokenOn: false, floorOn: false };
  function scorePass2(reviewEntries, switches) {
    return reviewEntries.map(({ row }) => ({ row, result: judgeRow(row, switches) }));
  }

  // per-rule table: rows hit / exact / leaks / over-tight, split by set,
  // for the raw (unfiltered — all rules on) measurement.
  const RULES = ['R1', 'R2', 'R3', 'R4'];
  function perRuleTable(pass2Scored) {
    const table = new Map(); // rule -> set -> {hit, exact, leaks, overTight, rows:[]}
    for (const rule of RULES) {
      table.set(rule, new Map(SETS.map((s) => [s, { hit: 0, exact: 0, leaks: 0, overTight: 0, rows: [] }])));
    }
    for (const { row, result } of pass2Scored) {
      if (!RULES.includes(result.rule)) continue;
      const bucket = table.get(result.rule).get(row.set);
      bucket.hit += 1;
      bucket.rows.push({ row, result });
      const kind = classify(result.class, row.gt_class);
      if (kind === 'leak') bucket.leaks += 1;
      else if (kind === 'overTight') bucket.overTight += 1;
      else bucket.exact += 1;
    }
    return table;
  }
  function ruleTableRows(table) {
    const rows = [];
    for (const rule of RULES) {
      for (const setName of SETS) {
        const b = table.get(rule).get(setName);
        rows.push([rule, setName, b.hit, b.exact, b.leaks, b.overTight]);
      }
    }
    return rows;
  }
  function ruleTableText(table) {
    return fmtRows(ruleTableRows(table), ['rule', 'set', 'hit', 'exact', 'leaks', 'over_tight']);
  }
  function leaksOnAdmitSets(table, rule) {
    let leaks = [];
    for (const setName of ADMIT_SETS) {
      const b = table.get(rule).get(setName);
      leaks = leaks.concat(b.rows.filter(({ row, result }) => classify(result.class, row.gt_class) === 'leak'));
    }
    return leaks;
  }

  // --- final tables: floorOn false and floorOn true, admitted rules only ---
  // (defined here, ahead of use, so the round-3 switch-decision pipeline
  // below can also use it to compute review+over-tight cost)
  function finalSummary(pass1ScoredArg, pass2Scored, setName) {
    const pass1InSet = pass1ScoredArg.filter(({ row }) => row.set === setName);
    const n = pass1InSet.length;
    let assigned = 0, review = 0, leaks = 0, overTight = 0, exact = 0;
    for (const { row, result } of pass1InSet) {
      let finalResult = result;
      if (result.status === 'review') {
        const p2 = pass2Scored.find((e) => e.row === row);
        finalResult = p2.result;
      }
      if (finalResult.status === 'assigned') {
        assigned += 1;
        const kind = classify(finalResult.class, row.gt_class);
        if (kind === 'leak') leaks += 1;
        else if (kind === 'overTight') overTight += 1;
        else exact += 1;
      } else {
        review += 1;
      }
    }
    return { set: setName, n, assigned, review, leaks, overTight, exact };
  }

  // --- round 3 fix: for a candidate source-switch combo, run the FULL
  // pipeline (raw -> reject any rule with >=1 leak on camara/holdout1 ->
  // admitted, floorOn=false) and report its review+over-tight cost on
  // camara+holdout1. The switch decision below picks the candidate with the
  // lower cost among candidates that reach zero leaks (rejection always
  // reaches zero leaks; a candidate that only gets there by sacrificing a
  // whole rule pays for it here, as a higher review+over-tight cost) —
  // ties go to OFF. This replaces the earlier (wrong) rule that chose "on"
  // whenever raw leaks were zero, ignoring cost. ---------------------------
  function evaluateSourceSwitches(sourceSwitches) {
    const raw = scorePass2(pass1Review, { ...rawSwitches, ...sourceSwitches });
    const rawTable = perRuleTable(raw);
    const rejected = new Set();
    const rejectionLines = [];
    for (const rule of RULES) {
      const leakingRows = leaksOnAdmitSets(rawTable, rule);
      if (leakingRows.length > 0) {
        rejected.add(rule);
        for (const { row, result } of leakingRows) {
          const verb = leadVerbForJudge(row);
          const noun = headNounForRow(row);
          rejectionLines.push(`${rule} REJECTED: operationId=${row.operationId || '(empty)'} method=${row.method} verb=${verb} noun=${noun} gt=${row.gt_class} pred=${result.class} set=${row.set} repo=${row.repo}`);
        }
      }
    }
    const admittedSwitchesLocal = {
      r1On: !rejected.has('R1'),
      r2On: !rejected.has('R2'),
      r3On: !rejected.has('R3'),
      judgePostOwn: !rejected.has('R4'),
      ...sourceSwitches,
      floorOn: false,
    };
    const admittedPass2Local = scorePass2(pass1Review, admittedSwitchesLocal);
    const admitSummaries = ADMIT_SETS.map((s) => finalSummary(pass1Scored, admittedPass2Local, s));
    const reviewSum = admitSummaries.reduce((a, s) => a + s.review, 0);
    const overTightSum = admitSummaries.reduce((a, s) => a + s.overTight, 0);
    return { rawTable, rejected, rejectionLines, admittedSwitches: admittedSwitchesLocal, admitSummaries, reviewSum, overTightSum, cost: reviewSum + overTightSum };
  }

  const rawPass2 = scorePass2(pass1Review, rawSwitches);
  const rawRuleTable = perRuleTable(rawPass2);
  const rawRuleTableText = ruleTableText(rawRuleTable);
  console.log('\nPer-rule table, RAW (all rules on, judgePostOwn=true, pathPartyOn=false, liveTokenOn=false, floorOn=false):');
  console.log(rawRuleTableText);

  // Also report judgePostOwn=false raw (R4 never fires there; its rows fall
  // through to R5 instead) — item 1 of the report asks for R1-R4 at both
  // judgePostOwn states.
  const rawPass2PostOwnOff = scorePass2(pass1Review, { ...rawSwitches, judgePostOwn: false });
  const rawRuleTablePostOwnOff = perRuleTable(rawPass2PostOwnOff);
  const rawRuleTablePostOwnOffText = ruleTableText(rawRuleTablePostOwnOff);
  console.log('\nPer-rule table, RAW (all rules on, judgePostOwn=false, floorOn=false) — R4 rows fall to R5 instead:');
  console.log(rawRuleTablePostOwnOffText);

  // --- round 3 fix (coordinator, 2026-09-08): the switch decision must be
  // zero leaks on camara/holdout1 FIRST, then the LOWER review+over-tight
  // cost on camara/holdout1 (admitted rules, floorOn=false) — not "on
  // whenever raw leaks are zero", which ignored cost. Rejection always
  // reaches zero leaks (a leaking rule is simply disabled), so the cost
  // comparison below already embeds the zero-leaks-first requirement: a
  // source that forces a rule to be rejected pays for it in a higher
  // review+over-tight cost. Ties go to OFF.
  //
  // liveTokenOn is decided FIRST (holding pathPartyOn at its OFF baseline —
  // it does not interact with R1/R3) because it determines whether R3 is
  // admitted at all, and that admission status is exactly the context the
  // pathPartyOn decision needs (with R3 admitted, some Stripe {customer}
  // rows that pathPartyOn would flag x land correctly at w via R3 instead).
  const liveTokenOff = evaluateSourceSwitches({ pathPartyOn: false, liveTokenOn: false });
  const liveTokenOn = evaluateSourceSwitches({ pathPartyOn: false, liveTokenOn: true });
  console.log('\nRound 3, correction 3: R1 any-operationId-token live-verb source, liveTokenOn OFF vs ON (admitted rules, floorOn=false, camara+holdout1):');
  console.log(fmtRows(
    [
      ['off', liveTokenOff.reviewSum, liveTokenOff.overTightSum, liveTokenOff.cost, [...liveTokenOff.rejected].join(',') || 'none'],
      ['on', liveTokenOn.reviewSum, liveTokenOn.overTightSum, liveTokenOn.cost, [...liveTokenOn.rejected].join(',') || 'none'],
    ],
    ['liveTokenOn', 'review', 'over_tight', 'cost', 'rejected'],
  ));
  const liveTokenOnChosen = liveTokenOn.cost < liveTokenOff.cost; // tie -> off
  console.log(`Chosen: liveTokenOn=${liveTokenOnChosen} (off cost ${liveTokenOff.cost}, on cost ${liveTokenOn.cost}).`);

  // pathPartyOn decided second, holding liveTokenOn at its chosen value.
  const pathPartyOff = evaluateSourceSwitches({ pathPartyOn: false, liveTokenOn: liveTokenOnChosen });
  const pathPartyOn = evaluateSourceSwitches({ pathPartyOn: true, liveTokenOn: liveTokenOnChosen });
  console.log('\nRound 3, correction 2: R2 path-party-id source, pathPartyOn OFF vs ON (admitted rules, floorOn=false, camara+holdout1):');
  console.log(fmtRows(
    [
      ['off', pathPartyOff.reviewSum, pathPartyOff.overTightSum, pathPartyOff.cost, [...pathPartyOff.rejected].join(',') || 'none'],
      ['on', pathPartyOn.reviewSum, pathPartyOn.overTightSum, pathPartyOn.cost, [...pathPartyOn.rejected].join(',') || 'none'],
    ],
    ['pathPartyOn', 'review', 'over_tight', 'cost', 'rejected'],
  ));
  const pathPartyOnChosen = pathPartyOn.cost < pathPartyOff.cost; // tie -> off
  console.log(`Chosen: pathPartyOn=${pathPartyOnChosen} (off cost ${pathPartyOff.cost}, on cost ${pathPartyOn.cost}).`);

  // Full per-rule tables at both states, for transparency (item asked for
  // "print the comparison in c9-sweep.md").
  const rawRuleTablePathPartyOnText = ruleTableText(perRuleTable(scorePass2(pass1Review, { ...rawSwitches, pathPartyOn: true, liveTokenOn: liveTokenOnChosen })));
  const rawRuleTablePathPartyOffText = ruleTableText(perRuleTable(scorePass2(pass1Review, { ...rawSwitches, pathPartyOn: false, liveTokenOn: liveTokenOnChosen })));
  const rawRuleTableLiveTokenOnText = ruleTableText(perRuleTable(scorePass2(pass1Review, { ...rawSwitches, liveTokenOn: true, pathPartyOn: false })));
  const rawRuleTableLiveTokenOffText = ruleTableText(perRuleTable(scorePass2(pass1Review, { ...rawSwitches, liveTokenOn: false, pathPartyOn: false })));

  // --- final chosen combination: whichever pathPartyOn evaluation was
  // selected already carries the chosen liveTokenOn, so its own admission
  // result (rejected rules, admittedSwitches) IS the final one — no need to
  // recompute. -------------------------------------------------------------
  const chosen = pathPartyOnChosen ? pathPartyOn : pathPartyOff;
  const rejected = chosen.rejected;
  const rejectionLines = chosen.rejectionLines;
  const admittedSwitches = chosen.admittedSwitches;
  console.log('\nRule admission decisions (at the chosen source switches):');
  if (rejectionLines.length === 0) {
    console.log('  All of R1, R2, R3, R4 admitted — zero leaks on camara/holdout1.');
  } else {
    for (const l of rejectionLines) console.log('  ' + l);
  }

  const admittedPass2 = scorePass2(pass1Review, admittedSwitches);
  const admittedRuleTable = perRuleTable(admittedPass2);
  const admittedRuleTableText = fmtRows(ruleTableRows(admittedRuleTable), ['rule', 'set', 'hit', 'exact', 'leaks', 'over_tight']);
  console.log('\nPer-rule table, ADMITTED-ONLY (rejected rules disabled, floorOn=false):');
  console.log(admittedRuleTableText);

  function buildFinal(floorOn) {
    const switches = { ...admittedSwitches, floorOn };
    const pass2 = scorePass2(pass1Review, switches);
    const rows = SETS.map((s) => finalSummary(pass1Scored, pass2, s));
    return { pass2, rows };
  }
  const finalFloorOff = buildFinal(false);
  const finalFloorOn = buildFinal(true);

  const finalHeader = ['set', 'n', 'assigned', 'review', 'leaks', 'over_tight', 'exact'];
  const finalFloorOffText = fmtRows(finalFloorOff.rows.map((r) => [r.set, r.n, r.assigned, r.review, r.leaks, r.overTight, r.exact]), finalHeader);
  const finalFloorOnText = fmtRows(finalFloorOn.rows.map((r) => [r.set, r.n, r.assigned, r.review, r.leaks, r.overTight, r.exact]), finalHeader);
  console.log('\nFinal numbers, admitted rules only, floorOn=FALSE:');
  console.log(finalFloorOffText);
  console.log('\nFinal numbers, admitted rules only, floorOn=TRUE:');
  console.log(finalFloorOnText);

  // --- chosen final configuration: admitted rules + floorOn=true. Floor is
  // chosen ON because it is the only axis that clears every POST/PATCH row
  // out of open review, consistent with the repo's fail-closed invariant
  // (CLAUDE.md: unknown -> the tighter class, never loosen without
  // evidence) — PUT/DELETE rows a rule doesn't resolve still legitimately
  // stay in review (no floor reaches them). This choice is reported, not
  // assumed; see the sweep file for both floorOn states in full.
  const finalPass2 = finalFloorOn.pass2;
  const finalRows = censusRows.map((row) => {
    const p1 = pass1Scored.find((e) => e.row === row);
    if (p1.result.status === 'assigned') {
      return { row, result: p1.result, pass: '1', rule: '' };
    }
    const p2 = finalPass2.find((e) => e.row === row).result;
    return { row, result: p2, pass: p2.rule === 'floor' ? 'floor' : '2', rule: p2.rule };
  });

  const rowCols = ['set', 'repo', 'path', 'method', 'operationId', 'gt_class', 'pred', 'confidence', 'status', 'evidence', 'pass', 'rule'];
  const outRows = finalRows.map(({ row, result, pass, rule }) => ({
    set: row.set, repo: row.repo, path: row.path, method: row.method, operationId: row.operationId,
    gt_class: row.gt_class, pred: result.class, confidence: result.confidence, status: result.status,
    evidence: result.evidence.join(';'), pass, rule,
  }));
  writeFileSync(OUT_ROWS, toCsv(outRows, rowCols));

  const falseFlags = outRows.filter((r) => r.status === 'assigned' && r.pred !== r.gt_class);
  writeFileSync(OUT_FALSE_FLAGS, toCsv(falseFlags, rowCols));

  // --- negative controls + queryAssistant -----------------------------------
  function findOutcome(operationId) {
    const hit = finalRows.find(({ row }) => row.operationId === operationId);
    if (!hit) return null;
    return hit;
  }
  const negControl1 = findOutcome('terminateCall');
  const negControl2 = findOutcome('updateSessionStatus');
  const queryAssistant = findOutcome('queryAssistant');
  function describeOutcome(label, found) {
    if (!found) return `${label}: NOT FOUND in census-ops.csv`;
    const { row, result, pass, rule } = found;
    return `${label}: method=${row.method} gt=${row.gt_class} pred=${result.class} confidence=${result.confidence} status=${result.status} pass=${pass} rule=${rule || '(pass1)'} evidence=[${result.evidence.join(' ; ')}]`;
  }
  const negControlLines = [
    describeOutcome('ClickToDial terminateCall (DELETE, gt=x, negative control)', negControl1),
    describeOutcome('WebRTC updateSessionStatus (PUT, gt=x, negative control)', negControl2),
    describeOutcome('ModelAsAService queryAssistant (POST, gt=r)', queryAssistant),
  ];
  console.log('\nNegative controls + queryAssistant:');
  for (const l of negControlLines) console.log('  ' + l);

  // --- review breakdown at the chosen (final) configuration -----------------
  const reviewFinal = finalRows.filter(({ result }) => result.status === 'review');
  const breakdownMap = new Map();
  for (const { row } of reviewFinal) {
    const key = [row.set, row.method, row.gt_class].join('|');
    breakdownMap.set(key, (breakdownMap.get(key) || 0) + 1);
  }
  const breakdownRows = Array.from(breakdownMap.entries())
    .map(([key, count]) => [...key.split('|'), count])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]));
  const breakdownText = fmtRows(breakdownRows, ['set', 'method', 'truth', 'count']);
  console.log('\nReview breakdown at the chosen configuration (set x method x truth):');
  console.log(breakdownText);

  // --- rows changed vs c8-rows.csv -------------------------------------------
  const c8Rows = parseCsv(readFileSync(C8_ROWS_PATH, 'utf8'));
  const c8Index = new Map();
  for (const r of c8Rows) c8Index.set([r.set, r.repo, r.path, r.method, r.operationId].join('|'), r);
  const changed = [];
  for (const r of outRows) {
    const key = [r.set, r.repo, r.path, r.method, r.operationId].join('|');
    const prev = c8Index.get(key);
    if (!prev) { changed.push({ key, kind: 'new-row', prev: null, cur: r }); continue; }
    if (prev.pred !== r.pred || prev.status !== r.status) changed.push({ key, kind: 'changed', prev, cur: r });
  }
  const changedBySet = { camara: 0, holdout1: 0, holdout2: 0 };
  for (const c of changed) changedBySet[c.cur.set] = (changedBySet[c.cur.set] || 0) + 1;
  console.log(`\nRows changed vs c8-rows.csv: ${changed.length} (camara ${changedBySet.camara || 0}, holdout1 ${changedBySet.holdout1 || 0}, holdout2 ${changedBySet.holdout2 || 0}).`);

  // --- every leak anywhere, any set, any pass, at the chosen config --------
  const allLeaks = outRows.filter((r) => r.status === 'assigned' && CLASS_ORDER[r.pred] < CLASS_ORDER[r.gt_class]);
  console.log(`\nLeaks at the chosen (admitted+floorOn) configuration: ${allLeaks.length}`);
  for (const r of allLeaks) console.log(`  ${r.set}/${r.repo} ${r.method} ${r.operationId} gt=${r.gt_class} pred=${r.pred} pass=${r.pass} rule=${r.rule} evidence=[${r.evidence}]`);

  // --- judge-misses.md: every pass-2 row (final config) that is over-tight
  // or a leak -----------------------------------------------------------------
  const judgeMisses = finalRows.filter(({ pass, result, row }) => pass !== '1' && result.status === 'assigned' && result.class !== row.gt_class);
  const missLines = judgeMisses.map(({ row, result, rule }) => {
    const verb = leadVerbForJudge(row);
    const noun = headNounForRow(row);
    const pid = pathPartyIdForRow(row);
    const kind = classify(result.class, row.gt_class);
    return { row, result, rule, verb, noun, pid, kind };
  });

  // --- write c9-sweep.md -----------------------------------------------------
  const smd = [];
  smd.push('# M1-C9 — the two-pass shape: pass 1 (byte-for-byte C7, layer3On/layer4On both true) + pass 2 judge');
  smd.push('');
  smd.push(`Pass 1: T = ${PASS1_T}, byte-for-byte C7 (layer3On/layer4On both true — round-2 coordinator correction 1). Assigned ${pass1Assigned.length}/${censusRows.length}, handed ${pass1Review.length} to pass 2.`);
  smd.push('');
  for (const setName of SETS) {
    const n = censusRows.filter((r) => r.set === setName).length;
    const a = pass1Assigned.filter(({ row }) => row.set === setName).length;
    smd.push(`- ${setName}: ${a}/${n} assigned in pass 1, ${n - a} handed to pass 2.`);
  }
  smd.push('');
  smd.push('## Per-rule table, RAW (all rules on, judgePostOwn=true, pathPartyOn=false, liveTokenOn=false, floorOn=false)');
  smd.push('');
  smd.push('```');
  smd.push(rawRuleTableText);
  smd.push('```');
  smd.push('');
  smd.push('## Per-rule table, RAW (all rules on, judgePostOwn=false, floorOn=false) — R4 rows fall to R5 instead');
  smd.push('');
  smd.push('```');
  smd.push(rawRuleTablePostOwnOffText);
  smd.push('```');
  smd.push('');
  smd.push('## Round 3 fix (coordinator, 2026-09-08): switch decision is zero-leaks-first, THEN lower review+over-tight cost (admitted rules, floorOn=false, camara+holdout1) — ties go to OFF');
  smd.push('');
  smd.push('### Correction 3: R1 any-operationId-token live-verb source, liveTokenOn OFF vs ON (decided first — it gates R3 admission)');
  smd.push('');
  smd.push('```');
  smd.push(fmtRows(
    [
      ['off', liveTokenOff.reviewSum, liveTokenOff.overTightSum, liveTokenOff.cost, [...liveTokenOff.rejected].join(',') || 'none'],
      ['on', liveTokenOn.reviewSum, liveTokenOn.overTightSum, liveTokenOn.cost, [...liveTokenOn.rejected].join(',') || 'none'],
    ],
    ['liveTokenOn', 'review', 'over_tight', 'cost', 'rejected'],
  ));
  smd.push('```');
  smd.push('');
  smd.push(`Chosen: liveTokenOn=${liveTokenOnChosen} (off cost ${liveTokenOff.cost} vs on cost ${liveTokenOn.cost}). With liveTokenOn on, R1 catches updateRebootRequest via the "reboot" token before R3 ever sees it, clearing R3's only camara/holdout1 leak — that is reflected above as R3 no longer appearing in the "on" row's rejected list.`);
  smd.push('');
  smd.push('Full per-rule tables, liveTokenOn off vs on (pathPartyOn held off):');
  smd.push('```');
  smd.push('-- liveTokenOn=false --');
  smd.push(rawRuleTableLiveTokenOffText);
  smd.push('-- liveTokenOn=true --');
  smd.push(rawRuleTableLiveTokenOnText);
  smd.push('```');
  smd.push('');
  smd.push(`### Correction 2: R2 path-party-id source, pathPartyOn OFF vs ON (decided second, liveTokenOn held at the chosen value = ${liveTokenOnChosen})`);
  smd.push('');
  smd.push('```');
  smd.push(fmtRows(
    [
      ['off', pathPartyOff.reviewSum, pathPartyOff.overTightSum, pathPartyOff.cost, [...pathPartyOff.rejected].join(',') || 'none'],
      ['on', pathPartyOn.reviewSum, pathPartyOn.overTightSum, pathPartyOn.cost, [...pathPartyOn.rejected].join(',') || 'none'],
    ],
    ['pathPartyOn', 'review', 'over_tight', 'cost', 'rejected'],
  ));
  smd.push('```');
  smd.push('');
  smd.push(`Chosen: pathPartyOn=${pathPartyOnChosen} (off cost ${pathPartyOff.cost} vs on cost ${pathPartyOn.cost}). With R3 admitted, path-party-id rows that pathPartyOn would flag x (e.g. Stripe {customer} paths) mostly land correctly at w via R3 instead when pathPartyOn is off — turning it on trades that correct R3 resolution for an over-tight R2 hit, raising cost. This corrects the earlier (wrong) rule that chose "on" purely because raw leaks were zero, ignoring that cost.`);
  smd.push('');
  smd.push('Full per-rule tables, pathPartyOn off vs on (liveTokenOn held at the chosen value):');
  smd.push('```');
  smd.push('-- pathPartyOn=false --');
  smd.push(rawRuleTablePathPartyOffText);
  smd.push('-- pathPartyOn=true --');
  smd.push(rawRuleTablePathPartyOnText);
  smd.push('```');
  smd.push('');
  smd.push(`## Rule admission decisions (>=1 leak on camara or holdout1 rejects a rule, at the chosen source switches: pathPartyOn=${pathPartyOnChosen}, liveTokenOn=${liveTokenOnChosen})`);
  smd.push('');
  if (rejectionLines.length === 0) {
    smd.push('All of R1, R2, R3, R4 admitted — zero leaks on camara/holdout1.');
  } else {
    smd.push('```');
    for (const l of rejectionLines) smd.push(l);
    smd.push('```');
  }
  smd.push('');
  smd.push('## Per-rule table, ADMITTED-ONLY (rejected rules disabled, floorOn=false)');
  smd.push('');
  smd.push('```');
  smd.push(admittedRuleTableText);
  smd.push('```');
  smd.push('');
  smd.push('## Final numbers, admitted rules only, floorOn = FALSE');
  smd.push('');
  smd.push('```');
  smd.push(finalFloorOffText);
  smd.push('```');
  smd.push('');
  smd.push('## Final numbers, admitted rules only, floorOn = TRUE (chosen configuration)');
  smd.push('');
  smd.push('```');
  smd.push(finalFloorOnText);
  smd.push('```');
  smd.push('');
  smd.push('## Negative controls and queryAssistant — at the chosen (admitted+floorOn) configuration');
  smd.push('');
  for (const l of negControlLines) smd.push('- ' + l);
  smd.push('');
  smd.push('## Review breakdown at the chosen configuration (set x method x truth)');
  smd.push('');
  smd.push('```');
  smd.push(breakdownText);
  smd.push('```');
  smd.push('');
  smd.push(`## Rows changed vs c8-rows.csv: ${changed.length} (camara ${changedBySet.camara || 0}, holdout1 ${changedBySet.holdout1 || 0}, holdout2 ${changedBySet.holdout2 || 0})`);
  smd.push('');
  if (changed.length) {
    smd.push('```');
    for (const c of changed) smd.push(`${c.kind} ${c.key}  gt=${c.cur.gt_class}  c8:${c.prev ? `${c.prev.pred}/${c.prev.status}` : 'n/a'} -> c9:${c.cur.pred}/${c.cur.status} (pass=${c.cur.pass} rule=${c.cur.rule})`);
    smd.push('```');
    smd.push('');
  }
  smd.push(`## Every leak anywhere, any set, any pass, at the chosen configuration: ${allLeaks.length}`);
  smd.push('');
  if (allLeaks.length) {
    smd.push('```');
    for (const r of allLeaks) smd.push(`${r.set}/${r.repo} ${r.method} ${r.operationId} gt=${r.gt_class} pred=${r.pred} pass=${r.pass} rule=${r.rule} evidence=[${r.evidence}]`);
    smd.push('```');
  } else {
    smd.push('None.');
  }
  smd.push('');
  smd.push(`## Empty-operationId rows (judge summary-fallback): ${emptyOpIdRows.length}`);
  smd.push('');
  if (emptyOpIdRows.length) {
    smd.push('```');
    for (const r of emptyOpIdRows) smd.push(`${r.set}/${r.repo} ${r.method} ${r.path} summary="${r.summary}"`);
    smd.push('```');
  } else {
    smd.push('None found in census-ops.csv / ops-text.csv — see the delegate report for the discrepancy this raises against the M1-C9 brief\'s "~16, all Twilio" note.');
  }
  smd.push('');
  writeFileSync(OUT_SWEEP, smd.join('\n') + '\n');

  // --- write c9-judge-misses.md -----------------------------------------------
  const mmd = [];
  mmd.push('# M1-C9 — pass-2 misses (over-tight and leaks) at the chosen (admitted+floorOn) configuration');
  mmd.push('');
  mmd.push(`Every pass-2 row (rule R1-R4/floor/R5-review does not appear here since review is not a miss) whose final prediction is NOT exact, for the orchestrator to re-read the LIVE_VERBS/OWN_VERBS/PARTY_NOUNS lists against. Total: ${missLines.length}.`);
  mmd.push('');
  mmd.push('```');
  mmd.push(fmtRows(
    missLines.map((m) => [m.kind, m.row.set, m.row.repo, m.row.operationId || '(empty)', m.row.method, m.verb, m.noun, m.pid.present ? m.pid.param : 'no', m.rule, m.row.gt_class, m.result.class, `"${(m.row.summary || '').slice(0, 70)}"`]),
    ['kind', 'set', 'repo', 'operationId', 'method', 'verb', 'noun', 'pathPartyId', 'rule', 'gt', 'pred', 'summary'],
  ));
  mmd.push('```');
  mmd.push('');
  writeFileSync(OUT_MISSES, mmd.join('\n') + '\n');

  console.log(`\nWrote ${OUT_ROWS}`);
  console.log(`Wrote ${OUT_FALSE_FLAGS} (${falseFlags.length} rows)`);
  console.log(`Wrote ${OUT_SWEEP}`);
  console.log(`Wrote ${OUT_MISSES} (${missLines.length} rows)`);

  // --- hold-out 2, scored once, reported, not used for any decision --------
  const ho2 = finalFloorOn.rows.find((r) => r.set === 'holdout2');
  console.log(`\nHold-out 2 (scored once, final admitted+floorOn configuration, NOT used to select anything): n=${ho2.n} assigned=${ho2.assigned} review=${ho2.review} leaks=${ho2.leaks} over_tight=${ho2.overTight} exact=${ho2.exact}`);
}

main();
