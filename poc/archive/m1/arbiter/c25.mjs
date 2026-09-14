// M1-C25: exam-4 scorer for the FROZEN M1 shapes, as adopted.
//
// This file scores three already-decided rules — c15 (the method-prior
// arbiter), C20 (goal 2's allowlist raise layer, adopted bar minN=2,
// minW=0.80 per D48), and C22 (goal 1's allowlist-wins loosen layer,
// adopted variant N, bar minN=5, minW=0.95 per D51) — on a set none of
// those rules has ever seen. NOTHING here is tuned, swept, or re-derived
// from the scored set: every classifier is imported unchanged
// (classifyC15/classifyC20/classifyC22), and the two allowlists used are
// built ONCE from the full 5465-row combined corpus via c20's own exported
// pipeline (buildNounTable -> cleanNounTable -> nounStats ->
// deriveAllowlist), at exactly the bars already adopted. No leave-one-
// vendor-out rebuild is needed here: every exam-4 provider is, by
// make-exam4.mjs's own exclusion rule, absent from the 332-provider
// combined-corpus burn list, so a corpus-built allowlist is already
// out-of-sample with respect to whatever set is passed on the command
// line — this is not a LOVO substitute for a set that DOES share
// providers with the corpus, it relies specifically on that exclusion
// guarantee.
//
// Exam-set loader: c19.mjs's own exam-loading logic (the blind file joined
// to its exam-truth-partN files by row_id, dropping '?' rows) lives in
// loadExamRows(), a private, NOT-exported function in c19.mjs. It is
// already written generically (setName/blindPath/truthParts/expected
// counts are all parameters) — not hard-wired to exam 3 in its logic, only
// in the two call sites (loadExam2Rows/loadExam3Rows) that supply its
// arguments. Per the brief: reuse it if exported or parameterisable,
// escalate if hard-wired and not reusable. It is parameterisable but not
// exported, and c19.mjs may not be modified to export it (out of scope for
// this file, which touches no existing file). The judgement call made
// here, flagged for review rather than silently made: treat this the same
// way c18/c19 themselves treat classify logic that lives in a sibling file
// without being reusable in the needed shape — copy the join logic
// verbatim (loadExamSet below), generalised only to discover its N truth-
// part files from the directory instead of a hardcoded list, and PROVE
// fidelity with a dry run against exam 3 whose scorable-row count (2993)
// is checked against c19's own published number
// (docs/logs/m1/c19-sweep.md: "Exam 3: 3000 blind rows, 7 dropped for
// truth_class '?', 2993 usable") rather than assumed equal. If that
// dry-run count does not match, nothing in this file should be trusted.
//
// Reporting rule (the user's, non-negotiable): each goal is scored on its
// OWN ledger, never on the combined one.
//   - Goal 2's ledger = config 2 (c15 + C20): its goal-2 leaks (truth x,
//     said w), and, separately, the goal-1 false alarms its own
//     'no-own-noun' rule adds.
//   - Goal 1's ledger = config 3 (c15 + C22): the goal-1 false alarms left
//     from the word rules after C22, how many rows C22 rescued versus
//     config 1 (c15 alone), and the leaks C22 adds versus config 1 —
//     charged to goal 1.
//   - Config 4 (c15 + C20 + C22 composed) appears ONLY on a line labelled
//     "combined" and is never reported as either goal's own number.
//
// How to re-run (dry run, exam 3 only — exam 3 is INSIDE the combined
// corpus so its numbers are in-sample and meaningless as a result; it only
// proves the loader and every config run):
//   node poc/m1/arbiter/c25.mjs data/exam3-2026-09-11 /tmp/c25-dryrun.md
//
// Scoring exam 4 for real is the orchestrator's job, once, after labelling
// completes:
//   node poc/m1/arbiter/c25.mjs data/exam4-2026-09-12 <outMd>
//
// judge.mjs, arbiter.mjs, c11.mjs, c15.mjs, c19.mjs, c20.mjs and c22.mjs
// are never modified by this file.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../m0/csv.mjs';
import { CLASS_ORDER } from './arbiter.mjs';
import { REPO_ROOT } from './load-sets.mjs';
import { classify as classifyC15 } from './c15.mjs';
import { loadCombinedCorpus, buildNounTable } from './c19.mjs';
import { cleanNounTable, nounStats, deriveAllowlist, classifyC20 } from './c20.mjs';
import { classifyC22 } from './c22.mjs';

// --- corpus-derived allowlists, built ONCE, per the adopted bars --------
//
// Goal 2 (D48): C20, minN=2, minW=0.80.
// Goal 1 (D51): C22 variant N, minN=5, minW=0.95.
const GOAL2_MIN_N = 2;
const GOAL2_MIN_W = 0.80;
const GOAL1_MIN_N = 5;
const GOAL1_MIN_W = 0.95;
const GOAL1_VARIANT = 'N';

// Committed corpus (LOVO) predictions, cited from the PRD (D48/D51/D52),
// not recomputed here.
const CORPUS_LOVO = {
  goal2LeaksN: 89,
  goal2LeaksDenom: 5465,
  goal1Baseline: 522,
  goal1Rescued: 61,
  goal1NewLeaks: 6,
  goal1Denom: 5465,
};

export function buildAllowlists() {
  const { allRows } = loadCombinedCorpus();
  const rawTable = buildNounTable(allRows);
  const { junkSet, cleanTable } = cleanNounTable(rawTable);
  const stats = nounStats(cleanTable);
  const a20 = deriveAllowlist(stats, GOAL2_MIN_N, GOAL2_MIN_W);
  const a22 = deriveAllowlist(stats, GOAL1_MIN_N, GOAL1_MIN_W);
  return { allRows, junkSet, a20, a22 };
}

// --- exam-set loader (generalised copy of c19.mjs's private loadExamRows,
// see header comment for why this is a copy and not an import) ----------
export function loadExamSet(examDir) {
  const blindPath = path.join(examDir, 'exam-blind.csv');
  const blindRows = parseCsv(readFileSync(blindPath, 'utf8'));

  const truthFiles = readdirSync(examDir)
    .filter((f) => /^exam-truth-part\d+\.csv$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (truthFiles.length === 0) {
    throw new Error(`ESCALATE: no exam-truth-part*.csv files found in ${examDir}.`);
  }

  const truthRows = [];
  for (const f of truthFiles) {
    truthRows.push(...parseCsv(readFileSync(path.join(examDir, f), 'utf8')));
  }
  if (truthRows.length !== blindRows.length) {
    throw new Error(`ESCALATE: ${examDir}'s blind file has ${blindRows.length} rows but its ${truthFiles.length} truth part(s) total ${truthRows.length} rows -- structural mismatch, do not trust a score from this set.`);
  }

  const truthByRowId = new Map();
  for (const t of truthRows) {
    if (truthByRowId.has(t.row_id)) {
      throw new Error(`ESCALATE: duplicate truth row_id ${t.row_id} in ${examDir}.`);
    }
    truthByRowId.set(t.row_id, t);
  }

  const setName = path.basename(examDir);
  const out = [];
  let joinMisses = 0;
  let dropped = 0;
  let lowConf = 0;
  for (const b of blindRows) {
    const t = truthByRowId.get(b.row_id);
    if (!t) { joinMisses += 1; continue; }
    if (t.truth_class === '?') { dropped += 1; continue; }
    if (t.confidence !== 'high') lowConf += 1;
    out.push({
      set: setName,
      vendor: b.provider,
      method: b.method,
      path: b.path,
      operationId: b.operationId,
      summary: b.summary || '',
      description: b.description || '',
      gt_class: t.truth_class,
      confidence: t.confidence,
      reason: t.reason || '',
    });
  }
  if (joinMisses > 0) {
    throw new Error(`ESCALATE: ${joinMisses} ${setName} blind rows had no matching truth row by row_id.`);
  }
  return {
    rows: out, dropped, lowConf,
    totalBlind: blindRows.length, truthFileCount: truthFiles.length,
  };
}

// --- classifiers (each an unchanged import, no forked logic) ------------

export function classifyConfig1(row) {
  return classifyC15(row);
}
export function classifyConfig2(row, junkSet, a20) {
  return classifyC20(row, junkSet, a20);
}
export function classifyConfig3(row, junkSet, a22) {
  return classifyC22(row, junkSet, a22, GOAL1_VARIANT);
}
export function classifyConfig4(row, junkSet, a20, a22) {
  return classifyC22(row, junkSet, a22, GOAL1_VARIANT, (rr) => classifyC20(rr, junkSet, a20));
}

// --- scoring ---------------------------------------------------------------

const GOAL1_RULE_BUCKETS = ['floor', 'live-verb', 'party-noun', 'no-own-noun', 'allowlist-wins'];

function kindOf(predClass, gtClass) {
  const predIdx = CLASS_ORDER[predClass];
  const truthIdx = CLASS_ORDER[gtClass];
  if (predIdx < truthIdx) return 'leak';
  if (predIdx > truthIdx) return 'overTight';
  return 'exact';
}

export function scoreConfig(rows, classifyFn) {
  let exact = 0, allLoosening = 0, goal2Leaks = 0;
  const goal1ByRule = Object.fromEntries(GOAL1_RULE_BUCKETS.map((k) => [k, 0]));
  let goal1Other = 0;
  for (const row of rows) {
    const res = classifyFn(row);
    const kind = kindOf(res.class, row.gt_class);
    if (kind === 'exact') exact += 1;
    if (kind === 'leak') allLoosening += 1;
    if (row.gt_class === 'x' && res.class === 'w') goal2Leaks += 1;
    if (row.gt_class === 'w' && res.class === 'x') {
      if (GOAL1_RULE_BUCKETS.includes(res.rule)) goal1ByRule[res.rule] += 1;
      else goal1Other += 1;
    }
  }
  const goal1Total = GOAL1_RULE_BUCKETS.reduce((s, k) => s + goal1ByRule[k], 0) + goal1Other;
  return { n: rows.length, exact, allLoosening, goal2Leaks, goal1ByRule, goal1Other, goal1Total };
}

// rescued/newLeaks are always measured against config-1 (c15 alone), the
// same definition c22.mjs's own scoreC22 uses.
export function rescueDelta(rows, baseFn, layeredFn) {
  let rescued = 0, newLeaks = 0;
  const rescuedRows = [];
  const newLeakRows = [];
  for (const row of rows) {
    const base = baseFn(row);
    const layered = layeredFn(row);
    if (row.gt_class === 'w' && base.class === 'x' && layered.class === 'w') {
      rescued += 1;
      rescuedRows.push(row);
    }
    if (row.gt_class === 'x' && base.class === 'x' && layered.class === 'w') {
      newLeaks += 1;
      newLeakRows.push(row);
    }
  }
  return { rescued, newLeaks, rescuedRows, newLeakRows };
}

// --- reporting helpers -------------------------------------------------

function pct(n, d) {
  if (!d) return 'n/a';
  return `${(100 * n / d).toFixed(1)}%`;
}

function mdCell(v) {
  return String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function mdTable(rows, header) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.map(mdCell).join(' | ')} |`);
  return lines.join('\n');
}

function rowListing(rows) {
  return rows.map((r) => [
    r.method, r.path, r.operationId || '(none)', r.summary || '(none)',
    r.gt_class, r.confidence, r.reason || '(none)', r.vendor,
  ]);
}
const LISTING_HEADER = ['method', 'path', 'operationId', 'summary', 'truth', 'confidence', 'reason', 'provider'];

function configTableRow(name, res) {
  return [
    name, res.n,
    `${res.goal2Leaks} (${pct(res.goal2Leaks, res.n)})`,
    res.goal1ByRule.floor, res.goal1ByRule['live-verb'], res.goal1ByRule['party-noun'],
    res.goal1ByRule['no-own-noun'], res.goal1ByRule['allowlist-wins'], res.goal1Other,
    `${res.goal1Total} (${pct(res.goal1Total, res.n)})`,
    `${res.allLoosening} (${pct(res.allLoosening, res.n)})`,
    res.exact,
  ];
}
const CONFIG_TABLE_HEADER = [
  'config', 'n', 'goal-2 leaks (x->w)',
  'goal-1 fa: floor', 'goal-1 fa: live-verb', 'goal-1 fa: party-noun',
  'goal-1 fa: no-own-noun', 'goal-1 fa: allowlist-wins', 'goal-1 fa: other',
  'goal-1 fa total', 'all-loosening', 'exact',
];

// --- main ----------------------------------------------------------------

export function runReport(examDir) {
  const { allRows: corpusRows, junkSet, a20, a22 } = buildAllowlists();
  const { rows, dropped, lowConf, totalBlind, truthFileCount } = loadExamSet(examDir);
  const highConfRows = rows.filter((r) => r.confidence === 'high');

  const cfg1 = (row) => classifyConfig1(row);
  const cfg2 = (row) => classifyConfig2(row, junkSet, a20);
  const cfg3 = (row) => classifyConfig3(row, junkSet, a22);
  const cfg4 = (row) => classifyConfig4(row, junkSet, a20, a22);

  const lines = [];
  const push = (s) => lines.push(s);

  push(`# M1-C25: exam-4 scorer — frozen shapes on ${path.basename(examDir)}`);
  push('');
  push('Configs, via the real exported classifiers only (no forked logic):');
  push('1. c15 alone.');
  push('2. c15 + C20 (goal 2\'s own ledger) — allowlist minN=2, minW=0.80 (D48).');
  push('3. c15 + C22 (goal 1\'s own ledger) — variant N, allowlist minN=5, minW=0.95 (D51).');
  push('4. combined: c15 + C20 + C22, composed as classifyC22(row, junk, a22, \'N\', rr => classifyC20(rr, junk, a20)). Reported ONLY on lines labelled "combined" — never as either goal\'s own number.');
  push('');
  push(`Allowlists built ONCE from the full ${corpusRows.length}-row combined corpus (goal-2 allowlist: ${a20.size} words; goal-1 allowlist: ${a22.size} words). Every provider in ${path.basename(examDir)} is, by construction (make-exam4.mjs's own exclusion rule for exam 4; exam 3 predates that rule but is scored here only as a plumbing dry run), absent from the corpus this allowlist was built on — no leave-one-vendor-out rebuild is needed or performed.`);
  push('');

  push('## Set loaded');
  push('');
  push(`${examDir}: ${totalBlind} blind rows, ${truthFileCount} truth-part file(s), ${dropped} dropped for truth_class '?', ${rows.length} scorable.`);
  push(`Of the ${rows.length} scorable rows: ${rows.length - lowConf} high-confidence, ${lowConf} low-confidence.`);
  push('');

  push('## Scores, all scorable rows');
  push('');
  push(mdTable([
    configTableRow('1. c15 alone', scoreConfig(rows, cfg1)),
    configTableRow('2. c15 + C20', scoreConfig(rows, cfg2)),
    configTableRow('3. c15 + C22', scoreConfig(rows, cfg3)),
    configTableRow('4. combined (c15 + C20 + C22)', scoreConfig(rows, cfg4)),
  ], CONFIG_TABLE_HEADER));
  push('');

  push('## Scores, high-confidence rows only (truth is a band — repeat headline counts on the sub-band judges were most sure of)');
  push('');
  push(mdTable([
    configTableRow('1. c15 alone', scoreConfig(highConfRows, cfg1)),
    configTableRow('2. c15 + C20', scoreConfig(highConfRows, cfg2)),
    configTableRow('3. c15 + C22', scoreConfig(highConfRows, cfg3)),
    configTableRow('4. combined (c15 + C20 + C22)', scoreConfig(highConfRows, cfg4)),
  ], CONFIG_TABLE_HEADER));
  push('');

  // --- Goal 2's own ledger: config 2 ---
  const goal2AllScore = scoreConfig(rows, cfg2);
  push('## Goal 2\'s own ledger (config 2: c15 + C20)');
  push('');
  push(`Goal-2 leaks (truth x, said w): ${goal2AllScore.goal2Leaks} of ${rows.length} (${pct(goal2AllScore.goal2Leaks, rows.length)}).`);
  push(`False alarms C20's own 'no-own-noun' rule adds (truth w, said x, rule=no-own-noun): ${goal2AllScore.goal1ByRule['no-own-noun']} of ${rows.length} (${pct(goal2AllScore.goal1ByRule['no-own-noun'], rows.length)}).`);
  push('');
  push(`Corpus LOVO prediction for comparison (D48, not recomputed here): ${CORPUS_LOVO.goal2LeaksN}/${CORPUS_LOVO.goal2LeaksDenom} = ${pct(CORPUS_LOVO.goal2LeaksN, CORPUS_LOVO.goal2LeaksDenom)} goal-2 leaks.`);
  push('');
  push(`Every goal-2 leak under config 2, in full (${goal2AllScore.goal2Leaks} rows):`);
  push('');
  const goal2LeakRows = rows.filter((r) => r.gt_class === 'x' && cfg2(r).class === 'w');
  push(goal2LeakRows.length ? mdTable(rowListing(goal2LeakRows), LISTING_HEADER) : '(none)');
  push('');

  // --- Goal 1's own ledger: config 3 ---
  const goal1AllScore = scoreConfig(rows, cfg3);
  const goal1WordRuleFa = goal1AllScore.goal1ByRule['live-verb'] + goal1AllScore.goal1ByRule['party-noun'];
  const delta13 = rescueDelta(rows, cfg1, cfg3);
  push('## Goal 1\'s own ledger (config 3: c15 + C22)');
  push('');
  push(`Goal-1 false alarms left from the word rules after C22 (rule=live-verb or party-noun, truth w): ${goal1WordRuleFa} of ${rows.length} (${pct(goal1WordRuleFa, rows.length)}).`);
  push(`Rescued vs config 1 (c15 alone): ${delta13.rescued}.`);
  push(`Leaks C22 adds vs config 1, charged to goal 1: ${delta13.newLeaks}.`);
  push('');
  push(`Corpus LOVO prediction for comparison (D51, not recomputed here): baseline ${CORPUS_LOVO.goal1Baseline} word-rule false alarms, ${CORPUS_LOVO.goal1Rescued} rescued, ${CORPUS_LOVO.goal1NewLeaks} new leaks, on ${CORPUS_LOVO.goal1Denom} rows.`);
  push('');
  push(`Every leak C22 adds under config 3 vs config 1, in full (${delta13.newLeaks} rows):`);
  push('');
  push(delta13.newLeakRows.length ? mdTable(rowListing(delta13.newLeakRows), LISTING_HEADER) : '(none)');
  push('');
  push(`Every row C22 rescued under config 3 vs config 1, in full (${delta13.rescued} rows):`);
  push('');
  push(delta13.rescuedRows.length ? mdTable(rowListing(delta13.rescuedRows), LISTING_HEADER) : '(none)');
  push('');

  // --- combined, labelled only ---
  const combinedScore = scoreConfig(rows, cfg4);
  push('## combined (config 4: c15 + C20 + C22) — labelled combined, not either goal\'s own number');
  push('');
  push(`combined goal-2 leaks: ${combinedScore.goal2Leaks} (${pct(combinedScore.goal2Leaks, rows.length)}). combined goal-1 false-alarm total: ${combinedScore.goal1Total} (${pct(combinedScore.goal1Total, rows.length)}). combined all-loosening: ${combinedScore.allLoosening} (${pct(combinedScore.allLoosening, rows.length)}). combined exact: ${combinedScore.exact}.`);
  push('');

  push('## Note on this run');
  if (path.basename(examDir).startsWith('exam3')) {
    push('');
    push('THIS IS THE DRY RUN, on exam 3. Exam 3 is inside the 5465-row combined');
    push('corpus the allowlists above were built from, so every number in this');
    push('report is IN-SAMPLE and MEANINGLESS as a result. This run exists only');
    push('to prove the loader joins correctly (the row count above must read');
    push('"3000 blind rows, ... 2993 scorable", matching c19.mjs\'s own published');
    push('figure in docs/logs/m1/c19-sweep.md) and that every config runs without');
    push('error. Do not read the leak/rescue counts above as a real result.');
  } else {
    push('');
    push('Exam 4 providers are, by construction, absent from the combined corpus');
    push('these allowlists were built on (make-exam4.mjs\'s own exclusion rule) —');
    push('this is a genuine held-out score, not in-sample.');
  }
  push('');

  return lines.join('\n') + '\n';
}

function main() {
  const [, , examDir, outMd] = process.argv;
  if (!examDir || !outMd) {
    console.error('Usage: node poc/m1/arbiter/c25.mjs <examDir> <outMd>');
    process.exit(1);
  }
  const resolvedExamDir = path.isAbsolute(examDir) ? examDir : path.join(REPO_ROOT, examDir);
  const report = runReport(resolvedExamDir);
  writeFileSync(outMd, report);
  console.log(report);
  console.log(`\nWrote ${outMd}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
