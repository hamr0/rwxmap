// M1-C26: give each word ONE job — the hand list stops raising and starts
// excluding.
//
// Today's shape runs TWO word lists that disagree with each other:
//   - c11.mjs's 43-word hand list (PARTY_NOUNS + SHARED_NOUNS), consumed by
//     c15.mjs's `partyNounHit`, RAISES a PUT/DELETE/PATCH row from the w
//     floor to x — "this noun means someone else's thing";
//   - c20.mjs's mined 439-word "yours" allowlist, consumed by
//     `classifyC20`, LEAVES a floor row at w — "every noun here means your
//     own thing".
// 14 words sit on both lists meaning opposite things; because c15's raise
// rule runs first (inside classifyC20's own `classifyBase` call) and
// returns early, the hand list always wins on those words today — the
// allowlist's opinion on them is silently unreachable.
//
// C26 resolves the contradiction by giving each word exactly one job:
//   - the 43 hand words STOP being a raise rule (removed entirely — see
//     classifyC26Base below, which is c15.mjs's classify with the
//     party-noun step deleted);
//   - the same 43 words become a NOT-YOURS FILTER instead: mechanically
//     removed from any allowlist before it is used to score a row, via
//     excludeNotYours(). A word may never simultaneously mean "definitely
//     someone else's" and "definitely yours".
//
// This file creates no new word list and tunes nothing — NOT_YOURS is
// exactly the union of c11.mjs's own PARTY_NOUNS and SHARED_NOUNS, and
// excludeNotYours is a pure set-difference applied mechanically to
// whatever allowlist a caller passes in. The LOVO bar used for measurement
// below (minN=2, minW=0.80) is goal 2's already-adopted bar (D48), copied
// as a hardcoded constant, not reswept.
//
// This is GOAL 2 measurement only (goal 2 = "x dressed as w", truth x
// predicted w). Goal-1 false alarms are reported as a single informational
// number per config, never optimised or discussed here.
//
// c11.mjs, c15.mjs, c19.mjs, c20.mjs, judge.mjs, arbiter.mjs and every
// other existing pass file are imported unchanged and never modified.
//
// How to re-run: node poc/m1/arbiter/c26.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { CLASS_ORDER, tokensForRow, leadVerbForRow } from './arbiter.mjs';
import {
  headNounForRow,
  operationIdHeadNoun,
  fallbackVerbFromSummary,
  summaryHasCallerPhrase,
  matchesAnyStem,
} from './judge.mjs';
import { LIVE_VERBS, PARTY_NOUNS, SHARED_NOUNS, READ_VERBS } from './c11.mjs';
import { classify as classifyC15 } from './c15.mjs';
import { REPO_ROOT } from './load-sets.mjs';
import { loadCombinedCorpus, buildNounTable } from './c19.mjs';
import { cleanNounTable, nounStats, buildLovoAllowlists, classifyC20 } from './c20.mjs';

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c26-exclusive.md');

// Goal 2's already-adopted LOVO bar (D48). Hardcoded, not swept here.
const GOAL2_MIN_N = 2;
const GOAL2_MIN_W = 0.80;

// --- item 1: NOT_YOURS ------------------------------------------------
export const NOT_YOURS = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);

// --- item 2: classifyC26Base ---------------------------------------------
//
// Copied from c15.mjs's classify()/liveVerbHit(), with the party-noun raise
// step (c15's Step 2, partyNounHit) removed entirely — copied rather than
// editing c15.mjs to export its internals, per the brief. Everything else
// (METHOD_FLOOR, the locked-method floor, the POST read-verb lower, the
// live-verb raise including its caller-phrase guard) is identical to c15.
const METHOD_FLOOR = {
  GET: 'r',
  HEAD: 'r',
  OPTIONS: 'r',
  POST: 'x',
  PUT: 'w',
  DELETE: 'w',
  PATCH: 'w',
};

function isLockedMethod(method) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function isRaiseMethod(method) {
  return method === 'PUT' || method === 'DELETE' || method === 'PATCH';
}

// Copied verbatim from c15.mjs's liveVerbHit.
function liveVerbHit(row) {
  const { tokens } = tokensForRow(row);
  for (const t of tokens) {
    const tok = t.toLowerCase();
    if (matchesAnyStem(tok, LIVE_VERBS)) return { source: 'opid', word: tok };
  }
  const sLeadVerb = fallbackVerbFromSummary(row.summary);
  if (matchesAnyStem(sLeadVerb, LIVE_VERBS)) return { source: 'summary', word: sLeadVerb };
  return null;
}

export function classifyC26Base(row) {
  const method = row.method;
  const floor = METHOD_FLOOR[method];

  // GET/HEAD/OPTIONS: no word rules run at all.
  if (isLockedMethod(method)) {
    return { class: 'r', rule: 'floor', evidence: [], floor: true };
  }

  // POST: lower only, via the read-verb rule.
  if (method === 'POST') {
    const verb = leadVerbForRow(row);
    if (matchesAnyStem(verb, READ_VERBS)) {
      return { class: 'r', rule: 'read-verb', evidence: [`opid:${verb}`], floor: false };
    }
    return { class: floor, rule: 'floor', evidence: [], floor: true };
  }

  // PUT/DELETE/PATCH: raise only via live-verb. NO party-noun rule of any
  // kind — this is the one change from c15's classify.
  if (isRaiseMethod(method)) {
    const extraEvidence = [];

    const liveHit = liveVerbHit(row);
    if (liveHit) {
      if (summaryHasCallerPhrase(row.summary)) {
        extraEvidence.push('caller-phrase');
      } else {
        return { class: 'x', rule: 'live-verb', evidence: [`${liveHit.source}:${liveHit.word}`], floor: false };
      }
    }

    return { class: floor, rule: 'floor', evidence: extraEvidence, floor: true };
  }

  throw new Error(`c26.classifyC26Base: unrecognized method "${method}"`);
}

// --- item 3: excludeNotYours ----------------------------------------------
export function excludeNotYours(allowlist) {
  const out = new Set();
  for (const word of allowlist) {
    if (!NOT_YOURS.has(word)) out.add(word);
  }
  return out;
}

// --- item 4: classifyC26 --------------------------------------------------
export function classifyC26(row, junkSet, allowlist) {
  return classifyC20(row, junkSet, excludeNotYours(allowlist), classifyC26Base);
}

// --- shared scoring helpers (goal 2 + informational goal 1 + all-loosening) --

function isGoal2Leak(predClass, gtClass) { return gtClass === 'x' && predClass === 'w'; }
function isGoal1FalseAlarm(predClass, gtClass) { return gtClass === 'w' && predClass === 'x'; }

const GOAL1_RULE_BUCKETS = ['floor', 'live-verb', 'no-own-noun'];

function scoreConfig(rows, classifyFn) {
  let goal2Leaks = 0, goal1Total = 0, allLoosening = 0;
  const goal1ByRule = Object.fromEntries(GOAL1_RULE_BUCKETS.map((k) => [k, 0]));
  let goal1Other = 0;
  const goal2LeakRows = [];
  for (const row of rows) {
    const res = classifyFn(row);
    const predIdx = CLASS_ORDER[res.class];
    const truthIdx = CLASS_ORDER[row.gt_class];
    if (predIdx < truthIdx) allLoosening += 1;
    if (isGoal2Leak(res.class, row.gt_class)) {
      goal2Leaks += 1;
      goal2LeakRows.push({ row, res });
    }
    if (isGoal1FalseAlarm(res.class, row.gt_class)) {
      goal1Total += 1;
      if (GOAL1_RULE_BUCKETS.includes(res.rule)) goal1ByRule[res.rule] += 1;
      else goal1Other += 1;
    }
  }
  return { n: rows.length, goal2Leaks, goal2LeakRows, goal1Total, goal1ByRule, goal1Other, allLoosening };
}

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

function configRow(name, s) {
  return [
    name, s.n,
    `${s.goal2Leaks} (${pct(s.goal2Leaks, s.n)})`,
    `${s.goal1Total} (${pct(s.goal1Total, s.n)})`,
    s.goal1ByRule.floor, s.goal1ByRule['live-verb'], s.goal1ByRule['no-own-noun'], s.goal1Other,
    `${s.allLoosening} (${pct(s.allLoosening, s.n)})`,
  ];
}
const CONFIG_HEADER = [
  'config', 'n', 'goal-2 leaks (x->w)', 'goal-1 false alarms (info only)',
  'goal-1 fa: floor', 'goal-1 fa: live-verb', 'goal-1 fa: no-own-noun', 'goal-1 fa: other',
  'all-loosening',
];

function rowKey(row) {
  return `${row.vendor}\t${row.method}\t${row.operationId || ''}\t${row.path || ''}`;
}

function leakRowListing(entries) {
  return entries.map(({ row, res }) => [
    row.vendor, row.method, row.operationId || '(none)', row.path || '(none)',
    row.gt_class, res.class, res.rule,
  ]);
}
const LEAK_ROW_HEADER = ['vendor', 'method', 'operationId', 'path', 'truth', 'predicted', 'rule'];

// --- main ------------------------------------------------------------------

export function runReport() {
  const { allRows } = loadCombinedCorpus();
  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  if (allRows.length !== 5465) {
    throw new Error(`ESCALATE: expected 5465 combined-corpus rows, got ${allRows.length}.`);
  }
  const vendors = [...new Set(allRows.map((r) => r.vendor))].sort();
  if (vendors.length !== 332) {
    throw new Error(`ESCALATE: expected 332 distinct vendors, got ${vendors.length}.`);
  }

  push('# M1-C26: one job per word — hand list becomes a NOT-YOURS filter');
  push('');
  push(`Combined corpus: ${allRows.length} rows, ${vendors.length} vendors. Both asserted before scoring.`);
  push('');

  // noun pipeline, exactly as c24/c25 do it
  const rawTable = buildNounTable(allRows);
  const { junkSet, cleanTable } = cleanNounTable(rawTable);
  const stats = nounStats(cleanTable);
  const perVendorAllowlists = buildLovoAllowlists(stats, vendors, GOAL2_MIN_N, GOAL2_MIN_W);

  // excludeNotYours applied per-vendor allowlist, once per vendor, for
  // reporting the removed-word count/list (mechanical, same set every
  // vendor since NOT_YOURS never varies by vendor -- but each vendor's
  // allowlist can differ in which of those words it actually contains, so
  // report the union across all vendor allowlists actually built).
  const everRemoved = new Set();
  for (const v of vendors) {
    const a = perVendorAllowlists.get(v);
    for (const w of a) {
      if (NOT_YOURS.has(w)) everRemoved.add(w);
    }
  }
  const removedList = [...everRemoved].sort();

  // --- config A: frozen baseline ---
  const cfgA = (row) => classifyC20(row, junkSet, perVendorAllowlists.get(row.vendor));
  const scoreA = scoreConfig(allRows, cfgA);

  if (scoreA.goal2Leaks !== 89) {
    throw new Error(`ESCALATE: baseline config A (classifyC20 with default base, LOVO minN=${GOAL2_MIN_N} minW=${GOAL2_MIN_W}) scored ${scoreA.goal2Leaks} goal-2 leaks, not the expected 89 — the harness disagrees with the adopted D48 number, do not trust configs B/C/D below.`);
  }

  // --- config B: c15 base kept, allowlist made exclusive ---
  const cfgB = (row) => classifyC20(row, junkSet, excludeNotYours(perVendorAllowlists.get(row.vendor)));
  const scoreB = scoreConfig(allRows, cfgB);

  // --- config C: c26 base, allowlist NOT exclusive ---
  const cfgC = (row) => classifyC20(row, junkSet, perVendorAllowlists.get(row.vendor), classifyC26Base);
  const scoreC = scoreConfig(allRows, cfgC);

  // --- config D: c26 as designed ---
  const cfgD = (row) => classifyC26(row, junkSet, perVendorAllowlists.get(row.vendor));
  const scoreD = scoreConfig(allRows, cfgD);

  push('## Four configurations, LOVO, all 5465 rows');
  push('');
  push('A = frozen baseline: classifyC20(row, junkSet, vendorAllowlist), default base (real c15.classify). MUST reproduce goal-2 = 89.');
  push('B = c15 base kept, allowlist made exclusive (excludeNotYours applied).');
  push('C = c26 base (no party-noun rule), allowlist NOT made exclusive.');
  push('D = c26 as designed — c26 base + exclusive allowlist. The candidate.');
  push('');
  push(mdTable([
    configRow('A. frozen baseline (c15 + C20, default)', scoreA),
    configRow('B. c15 base + exclusive allowlist', scoreB),
    configRow('C. c26 base (no party-noun) + full allowlist', scoreC),
    configRow('D. c26 as designed (c26 base + exclusive allowlist)', scoreD),
  ], CONFIG_HEADER));
  push('');
  push('Goal-1 false-alarm columns are informational only (goal 1 is not this pass\'s job) — reported, not optimised.');
  push('');

  push('## excludeNotYours: what it removed');
  push('');
  push(`NOT_YOURS (PARTY_NOUNS ∪ SHARED_NOUNS from c11.mjs): ${NOT_YOURS.size} words.`);
  push(`Across all ${vendors.length} per-vendor LOVO allowlists (minN=${GOAL2_MIN_N}, minW=${GOAL2_MIN_W}), the union of words actually removed by excludeNotYours: ${removedList.length} words.`);
  push('');
  push(removedList.length ? removedList.map((w) => `\`${w}\``).join(', ') : '(none removed)');
  push('');

  // --- PASS/FAIL ---
  const pass = scoreD.goal2Leaks <= 89;
  push('## PASS/FAIL');
  push('');
  push(`Config D goal-2 leaks: ${scoreD.goal2Leaks}. Baseline A goal-2 leaks: ${scoreA.goal2Leaks}. ${pass ? 'PASS' : 'FAIL'} (D <= A required).`);
  push('');

  // --- regression / rescued rows, D vs A ---
  const aLeakKeys = new Map(scoreA.goal2LeakRows.map(({ row }) => [rowKey(row), row]));
  const dLeakKeys = new Map(scoreD.goal2LeakRows.map(({ row, res }) => [rowKey(row), { row, res }]));

  const regressionEntries = [];
  for (const [key, entry] of dLeakKeys.entries()) {
    if (!aLeakKeys.has(key)) regressionEntries.push(entry);
  }
  const rescuedEntries = [];
  for (const [key, row] of aLeakKeys.entries()) {
    if (!dLeakKeys.has(key)) {
      // find D's actual prediction on this row for the listing
      const res = cfgD(row);
      rescuedEntries.push({ row, res });
    }
  }

  push('## Regression rows (goal-2 leak under D, not under A)');
  push('');
  push(regressionEntries.length ? mdTable(leakRowListing(regressionEntries), LEAK_ROW_HEADER) : '(none — empty list)');
  push('');

  push('## Rescued rows (goal-2 leak under A, not under D)');
  push('');
  push(rescuedEntries.length ? mdTable(leakRowListing(rescuedEntries), LEAK_ROW_HEADER) : '(none — empty list)');
  push('');

  return lines.join('\n') + '\n';
}

function main() {
  const report = runReport();
  writeFileSync(OUT_MD, report);
  console.log(`\nWrote ${OUT_MD}`);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
