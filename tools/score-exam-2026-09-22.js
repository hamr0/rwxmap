// Exam scorer for the M3 clean exam data/exam-2026-09-22. Test/dev tooling
// only — never part of the published library.
//
// This scores the clean exam ONCE (D24). Cloudflare, PagerDuty and Sentry —
// 4279 operations across three complete official APIs the rules never saw
// before labelling. Once scored, it is BURNED: a rule change from here
// needs a new exam, never a re-score of this one.
//
// Truth is data/exam-2026-09-22/labelled.csv (the ten blind labels-N.csv
// files joined to ops.csv, with the two D93 user rulings from
// data/exam-2026-09-22/label/rulings.csv applied on top — see
// tools/build-labelled.mjs-equivalent logic that produced that file).
//
// The classifier is called from src/ directly (classifyRow, src/flow.js);
// no rule logic is copied here and no expected score is hard-coded anywhere.
//
// MECHANICAL ONLY. This exam has no Jev answers of its own — the only Jev
// answers on disk (data/jev-2026-09-22/) are floor-post rows drawn from the
// COMBINED tuning set, not from this exam, and must not be used here. The
// with-Jev score for this exam is a separate pass pending answer collection
// over this exam's own floor rows. This script prints mechanical results
// only; applyJev() below is wired for that future pass and is never called.
//
// Ledger conventions follow tools/score-exam.js / tools/score-combined-2026-09-21.js:
// exact / leak / over-tight, counts AND percentages with the denominator
// named in the same line, never collapsed into one accuracy number, order
// r < w < x.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from './csv.js';
import { classifyRow, reviewHint } from '../src/flow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DIR = path.join(REPO_ROOT, 'data/exam-2026-09-22');
const LABELLED_CSV = path.join(DIR, 'labelled.csv');

const EXPECTED_ROWS = 4279;
const CLASSES = ['r', 'w', 'x'];
const ORDER = { r: 0, w: 1, x: 2 };
const METHOD_ORDER = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const PROVIDER_ORDER = ['cloudflare', 'pagerduty', 'sentry'];

// D89 gate item 1 (docs/product/prd.md): leaks on evidence: list rows at
// or under 2 per 100 list rows, every one listed.
const GATE1_MAX_PER_100 = 2;

// D94 gate (with-Jev section only): leaks overall at or under 2% of all rows.
const GATE_D94_MAX_LEAK_PCT = 2;

// --jev adds the with-Jev section. WITHOUT it this script prints exactly
// what it has always printed: the mechanical section, unchanged.
const WITH_JEV = process.argv.slice(2).includes('--jev');

// --jev-selfcheck runs the fail-closed self-check alone and exits. It reads
// no answers, scores nothing and prints no score: it exists so the
// fail-closed guarantee can be exercised on the real code without running a
// pass over the exam.
const SELFCHECK_ONLY = process.argv.slice(2).includes('--jev-selfcheck');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------- loading

function loadRows() {
  const text = readFileSync(LABELLED_CSV, 'utf8');
  const csvRows = parseCsv(text);
  if (csvRows.length !== EXPECTED_ROWS) {
    fail(`labelled.csv has ${csvRows.length} rows, expected ${EXPECTED_ROWS}`);
  }

  const seen = new Set();
  const rows = [];
  for (const r of csvRows) {
    const id = (r.row_id || '').trim();
    if (!id) fail('labelled.csv has a row with no row_id');
    if (seen.has(id)) fail(`labelled.csv lists row ${id} twice`);
    seen.add(id);

    const truth = (r.truth_class || '').trim();
    if (!CLASSES.includes(truth)) {
      fail(`row ${id}: truth_class "${truth}" is not r/w/x — labelled.csv must carry no unresolved '?'`);
    }

    const op = {
      method: r.method || '',
      path: r.path || '',
      operationId: r.operationId || '',
      summary: r.summary || '',
      description: r.description || '',
    };
    const verdict = classifyRow(op);
    if (!CLASSES.includes(verdict.class)) {
      fail(`classifyRow gave row ${id} class ${JSON.stringify(verdict.class)}`);
    }

    rows.push({
      row_id: id,
      provider: r.provider || '',
      method: r.method || '',
      operationId: r.operationId || '',
      truth,
      predicted: verdict.class,
      step: verdict.step,
      rule: verdict.rule,
      source: verdict.source,
      review: verdict.review,
      matched: (verdict.matched || []).join('+'),
    });
  }
  if (seen.size !== EXPECTED_ROWS) fail(`labelled.csv covers ${seen.size} unique row_ids, expected ${EXPECTED_ROWS}`);
  return rows;
}

// --------------------------------------------------------------- counting

function verdict(pred, truth) {
  if (pred === truth) return 'exact';
  return ORDER[pred] < ORDER[truth] ? 'leak' : 'over-tight';
}

function pct(n, d) {
  if (d === 0) return `${n} / 0 (n/a)`;
  return `${n} / ${d} (${((n / d) * 100).toFixed(1)}%)`;
}

function tally(rows) {
  const t = { rows: rows.length, exact: 0, leak: 0, 'over-tight': 0 };
  for (const r of rows) t[verdict(r.predicted, r.truth)]++;
  return t;
}

function line(label, t, width = 22) {
  return `  ${label.padEnd(width)} rows ${String(t.rows).padStart(5)}   exact ${pct(t.exact, t.rows).padEnd(20)} leaks ${pct(t.leak, t.rows).padEnd(20)} over-tight ${pct(t['over-tight'], t.rows)}`;
}

// ------------------------------------------------- review-hint breakdown
//
// The second published signal beside `evidence` (src/flow.js's reviewHint,
// the one writer of the field). This section exists so the signal can be
// DEBUGGED: it asserts nothing, gates nothing and changes no line above it.
const REVIEW_HINTS = ['tight', 'loose', 'settled'];

/**
 * One line per hint: the rows in it, the leaks in it and the over-tight in
 * it, each as a count over the named denominator. Leaks and over-tight are
 * kept on their own columns, never collapsed.
 * @param {object[]} rs the rows to break down (their `predicted` is the
 *   class being scored, mechanical or with-Jev)
 * @param {(r: object) => string} reviewOf the hint to read off a row
 * @returns {string[]}
 */
function reviewLines(rs, reviewOf) {
  const all = tally(rs);
  const out = [];
  for (const hint of REVIEW_HINTS) {
    const sel = rs.filter((r) => reviewOf(r) === hint);
    const t = tally(sel);
    out.push(
      `   ${hint.padEnd(8)} rows ${pct(t.rows, all.rows).padEnd(22)} of all ${all.rows} rows`
      + `   leaks ${pct(t.leak, all.leak).padEnd(18)} of all ${all.leak} leaks`
      + `   over-tight ${pct(t['over-tight'], all['over-tight']).padEnd(20)} of all ${all['over-tight']} over-tight`,
    );
  }
  const stray = rs.filter((r) => !REVIEW_HINTS.includes(reviewOf(r)));
  if (stray.length) out.push(`   BUG: ${stray.length} rows carry no valid review hint`);
  return out;
}

function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

function bySort(order) {
  return (a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : a > b ? 1 : 0);
  };
}

// ----------------------------------------------------------------- Jev
//
// Run only with --jev. Without the flag this whole section is inert and the
// script's output is exactly the mechanical output it has always printed.
//
// The three D95 tiers are INDEPENDENT: each reads only its own pile of
// mechanical verdicts (selected by the rule that claimed the row), may make
// only its own ONE-WAY move, and keeps its OWN ledger. No tier reads a
// verdict another tier produced, and no two piles overlap.
//
// THRESHOLDS ARE FROZEN. The three numbers below were fixed BEFORE any row
// of this exam was read through Jev, and they are deliberately NOT
// sweepable from the command line: this exam is scored once (D24), and a
// threshold picked on its own rows would make it a tuning set.
const JEV_LOWER_T = 0.10; // jev-lower:     lower x -> w when p(isX)     <= 0.10
const JEV_RAISE_WX_T = 0.80; // jev-raise-wx:  raise w -> x when p(isX)     >= 0.80
const JEV_RAISE_GET_T = 0.50; // jev-raise-get: raise r -> w when p(changes) >= 0.50

const JEV_DIR = path.join(REPO_ROOT, 'data/jev-exam-2026-09-22');

/**
 * The three tiers. `select` picks this tier's pile out of the mechanical
 * verdicts; `question` is the answers key its p must come from; `from`/`to`
 * are the only classes it may move between.
 */
const JEV_TIERS = [
  {
    tier: 'jev-lower',
    file: 'out-lower.jsonl',
    question: 'isX',
    from: 'x',
    to: 'w',
    direction: 'lower',
    threshold: JEV_LOWER_T,
    select: (r) => r.rule === 'floor-post',
  },
  {
    tier: 'jev-raise-wx',
    file: 'out-raise-wx.jsonl',
    question: 'isX',
    from: 'w',
    to: 'x',
    direction: 'raise',
    threshold: JEV_RAISE_WX_T,
    select: (r) => r.rule === 'method-floor',
  },
  {
    tier: 'jev-raise-get',
    file: 'out-raise-get.jsonl',
    question: 'changes',
    from: 'r',
    to: 'w',
    direction: 'raise',
    threshold: JEV_RAISE_GET_T,
    select: (r) => r.rule === 'method' && r.predicted === 'r',
  },
];

/**
 * The model's p for this tier's question, or null when the answer is
 * missing, errored or malformed. FAIL CLOSED: null means no move. A NaN, an
 * out-of-range number, a non-number, a missing key and an `error` object all
 * land here.
 * @param {object|undefined} ans one JSONL line
 * @param {string} key question key
 * @returns {number|null}
 */
function jevP(ans, key) {
  if (!ans || typeof ans !== 'object') return null;
  if (ans.error !== undefined && ans.error !== null) return null;
  const a = ans.answers && ans.answers[key];
  if (!a || typeof a !== 'object') return null;
  const p = a.noul;
  if (typeof p !== 'number') return null;
  if (!Number.isFinite(p)) return null; // NaN and +-Infinity never move a row
  if (!(p >= 0 && p <= 1)) return null; // written so NaN fails this test too
  return p;
}

/**
 * Whether this tier fires on p. Every comparison is guarded by
 * Number.isFinite FIRST, so a NaN can never satisfy it: `NaN > 0.10` being
 * false once silently lowered rows to w in this project, and that direction
 * of bug must be impossible here.
 * @param {{direction: string, threshold: number}} spec
 * @param {number|null} p
 */
function jevFires(spec, p) {
  if (p === null || typeof p !== 'number' || !Number.isFinite(p)) return false;
  if (!(p >= 0 && p <= 1)) return false;
  return spec.direction === 'lower' ? p <= spec.threshold : p >= spec.threshold;
}

/** A tier may only make its own move. Anything else is a bug, not a result. */
function assertJevMove(spec, from, to) {
  if (from !== spec.from) fail(`${spec.tier} moves from ${spec.from}, got ${from}`);
  if (to !== spec.to) fail(`${spec.tier} may only move to ${spec.to}, got ${to}`);
  const dir = ORDER[to] > ORDER[from] ? 'raise' : ORDER[to] < ORDER[from] ? 'lower' : 'none';
  if (dir !== spec.direction) fail(`${spec.tier} may only ${spec.direction}, ${from}->${to} is a ${dir}`);
}

/**
 * Startup self-check. Throws if any unusable answer, or any in-range value
 * on the wrong side of the threshold, would move a row in ANY of the three
 * tiers — and also throws if a plainly usable answer does NOT move one,
 * because a check that can never fail proves nothing.
 */
function jevSelfCheck() {
  const unusable = [
    undefined,
    null,
    42,
    {},
    { row_id: 'a' },
    { row_id: 'a', error: 'boom' },
    { row_id: 'a', error: { message: 'boom' }, answers: { isX: { noul: 0.01 } }, },
    { row_id: 'a', answers: null },
    { row_id: 'a', answers: {} },
    { row_id: 'a', answers: { other: { noul: 0.01 } } },
    { row_id: 'a', answers: { isX: null } },
    { row_id: 'a', answers: { isX: {} } },
    { row_id: 'a', answers: { isX: { noul: null } } },
    { row_id: 'a', answers: { isX: { noul: '0.01' } } },
    { row_id: 'a', answers: { isX: { noul: NaN } } },
    { row_id: 'a', answers: { isX: { noul: Infinity } } },
    { row_id: 'a', answers: { isX: { noul: -Infinity } } },
    { row_id: 'a', answers: { isX: { noul: -0.5 } } },
    { row_id: 'a', answers: { isX: { noul: 1.5 } } },
    { row_id: 'a', answers: { changes: { noul: NaN } } },
    { row_id: 'a', answers: { changes: { noul: 2 } } },
  ];
  for (const spec of JEV_TIERS) {
    for (const bad of unusable) {
      const p = jevP(bad, spec.question);
      if (p !== null && !(p >= 0 && p <= 1)) {
        throw new Error(`self-check: ${spec.tier} read an out-of-range p from ${JSON.stringify(bad)}`);
      }
      if (jevFires(spec, p)) {
        throw new Error(`self-check: ${spec.tier} would MOVE a row on unusable answer ${JSON.stringify(bad)}`);
      }
    }
    // Second layer: the SAME bad values fed straight into jevFires, bypassing
    // jevP. Both layers must refuse independently — a fail-open in either one
    // is enough to lower a row to w on a NaN, which has happened before.
    const rawBad = [null, undefined, NaN, Infinity, -Infinity, -0.5, 1.5, '0.01', {}];
    for (const p of rawBad) {
      if (jevFires(spec, /** @type {any} */ (p))) {
        throw new Error(`self-check: ${spec.tier} would MOVE a row on raw p ${String(p)}`);
      }
    }
    // A value on the wrong side of the frozen threshold must not fire.
    const wrongSide = spec.direction === 'lower' ? spec.threshold + 0.01 : spec.threshold - 0.01;
    if (jevFires(spec, wrongSide)) {
      throw new Error(`self-check: ${spec.tier} fired at p=${wrongSide}, wrong side of ${spec.threshold}`);
    }
    // ...and a value at the frozen threshold must fire, or the check is dead.
    if (!jevFires(spec, spec.threshold)) {
      throw new Error(`self-check: ${spec.tier} did not fire at its own threshold ${spec.threshold} — check is dead`);
    }
    assertJevMove(spec, spec.from, spec.to);
  }
  return unusable.length * JEV_TIERS.length;
}

/** Read a JSONL answers file into row_id -> object. A torn final line is dropped (fail closed). */
function readJsonl(p) {
  const map = new Map();
  const text = readFileSync(p, 'utf8');
  for (const lineText of text.split('\n')) {
    if (!lineText.trim()) continue;
    let o;
    try {
      o = JSON.parse(lineText);
    } catch {
      continue; // a partial line from a kill leaves its row unanswered = no move
    }
    if (o && typeof o === 'object' && typeof o.row_id === 'string') map.set(o.row_id, o);
  }
  return map;
}

/**
 * Apply all three tiers to the mechanical rows. Returns one report per tier
 * plus the per-row jev verdict. Rows not in any pile, and rows with no
 * usable answer, keep the mechanical verdict exactly.
 * @param {object[]} rows the mechanical rows from loadRows()
 * @param {Map<string, Map<string, object>>} answersByTier tier -> row_id -> answer
 */
function applyJev(rows, answersByTier) {
  for (const r of rows) r.jevPredicted = r.predicted; // default: unmoved
  const reports = [];
  const claimed = new Map(); // row_id -> tier, to prove the piles do not overlap

  for (const spec of JEV_TIERS) {
    const answers = answersByTier.get(spec.tier);
    const pile = rows.filter(spec.select);
    const rep = {
      tier: spec.tier,
      spec,
      pile: pile.length,
      moved: 0,
      noAnswer: 0,
      leaksClosed: 0,
      newLeaks: 0,
      overTightFixed: 0,
      overTightCreated: 0,
    };
    for (const r of pile) {
      if (claimed.has(r.row_id)) fail(`row ${r.row_id} is in two piles: ${claimed.get(r.row_id)} and ${spec.tier}`);
      claimed.set(r.row_id, spec.tier);
      if (r.predicted !== spec.from) {
        fail(`${spec.tier} pile row ${r.row_id} is class ${r.predicted}, expected ${spec.from}`);
      }
      const p = jevP(answers.get(r.row_id), spec.question);
      if (p === null) rep.noAnswer += 1;
      if (!jevFires(spec, p)) continue;
      assertJevMove(spec, r.predicted, spec.to);
      const before = verdict(r.predicted, r.truth);
      const after = verdict(spec.to, r.truth);
      r.jevPredicted = spec.to;
      r.jevTier = spec.tier;
      r.jevP = p;
      rep.moved += 1;
      if (before === 'leak' && after !== 'leak') rep.leaksClosed += 1;
      if (before !== 'leak' && after === 'leak') rep.newLeaks += 1;
      if (before === 'over-tight' && after !== 'over-tight') rep.overTightFixed += 1;
      if (before !== 'over-tight' && after === 'over-tight') rep.overTightCreated += 1;
    }
    reports.push(rep);
  }
  return reports;
}

// ------------------------------------------------------------------- main

if (SELFCHECK_ONLY) {
  const n = jevSelfCheck();
  console.log(
    `fail-closed self-check: ${n} unusable-answer cases across ${JEV_TIERS.length} tiers, none moved a row; each tier fires at its own frozen threshold and not on the wrong side of it.`,
  );
  process.exit(0);
}

const rows = loadRows();

const providersSeen = [...new Set(rows.map((r) => r.provider))].sort(bySort(PROVIDER_ORDER));
const methodsSeen = [...new Set(rows.map((r) => r.method))].sort(bySort(METHOD_ORDER));

const out = [];
const say = (s = '') => out.push(s);

// --------------------------------------------------------------- 1. header
say('====================================================================');
say('M3 CLEAN EXAM — data/exam-2026-09-22 — SCORED ONCE, BURNED (D24)');
say('====================================================================');
say('3 complete official provider APIs never previously labelled: cloudflare,');
say('pagerduty, sentry — 4279 operations total. A rule change from here needs');
say('a NEW exam, never a re-score of this one.');
say();
say("Classes r < w < x. leak = predicted looser than truth (under-classification,");
say('the security-cost / go-no-go direction). over-tight = predicted tighter than');
say('truth (over-classification, a usability cost). The two are counted and');
say('reported separately, never collapsed into one accuracy number.');
say();
say('MECHANICAL ONLY (no Jev). This exam has no Jev answers of its own; the');
say('with-Jev score is a separate pass pending answer collection over this');
say("exam's own floor rows (see applyJev() in this file — not run here).");
say();

// --------------------------------------------------------- 2. whole flow
say('1. WHOLE-FLOW MECHANICAL LEDGER — all 4279 rows');
say(line('all rows', tally(rows)));
say();

// -------------------------------------------------------------- 3. vendor
say('2. PER VENDOR');
say('   cloudflare is 84% of the rows (3575 of 4279) — the pooled line above');
say('   must never be quoted alone; read each vendor line, cloudflare included.');
for (const p of providersSeen) {
  const sel = rows.filter((r) => r.provider === p);
  say(line(`${p} (n=${sel.length})`, tally(sel)));
}
say();

// -------------------------------------------------------------- 4. method
say('3. PER METHOD');
for (const m of methodsSeen) {
  const sel = rows.filter((r) => r.method === m);
  say(line(`${m} (n=${sel.length})`, tally(sel)));
}
say();

// ----------------------------------------------------------- 5. evidence
say('4. EVIDENCE vs FLOOR (source = list means a word list fired; floor means');
say('   the HTTP method alone decided with no word evidence — D77)');
const evidence = rows.filter((r) => r.source === 'list');
const floor = rows.filter((r) => r.source === 'floor');
const other = rows.filter((r) => r.source !== 'list' && r.source !== 'floor');
const tWhole = tally(rows);
say(line('evidence (source=list)', tally(evidence)));
say(line('floor (source=floor)', tally(floor)));
if (other.length) say(line('other sources', tally(other)));
say(`  leaks on evidence rows: ${pct(tally(evidence).leak, tWhole.leak)} of all leaks`);
say(`  leaks on floor rows:    ${pct(tally(floor).leak, tWhole.leak)} of all leaks`);
say();

// ----------------------------------------------------------- 6. leak list
const leaks = rows.filter((r) => verdict(r.predicted, r.truth) === 'leak');
say(`5. LEAK DETAIL — every one of ${leaks.length} leak rows, untruncated`);
if (leaks.length === 0) say('  (none)');
for (const r of leaks) {
  say(`  ${r.row_id}  ${r.provider}  ${r.method}  operationId ${r.operationId}`);
  say(`      predicted ${r.predicted}  truth ${r.truth}   step ${r.step}  rule ${r.rule}  source ${r.source}  matched "${r.matched}"`);
}
say();

// ------------------------------------------------------------ 7. gate
say('6. D89 GATE ITEM 1 — leaks on list rows at or under 2 per 100 list rows,');
say('   every one listed. (Items 2-4 are not printed here: the PRD states them');
say("   against a different pre-registered exam's rulings and this script does");
say('   not invent numbers for them against this exam.)');
const listLeaks = evidence.filter((r) => verdict(r.predicted, r.truth) === 'leak');
const listRate = evidence.length === 0 ? 0 : (listLeaks.length / evidence.length) * 100;
say(`   list rows: ${evidence.length}`);
say(`   leaks on list rows: ${listLeaks.length}`);
say(`   rate: ${listRate.toFixed(2)} per 100 list rows (bar: <= ${GATE1_MAX_PER_100} per 100)`);
say(`   gate item 1: ${listRate <= GATE1_MAX_PER_100 ? 'PASS' : 'FAIL'}`);
if (listLeaks.length > 0) {
  say('   list-row leaks, individually:');
  for (const r of listLeaks) {
    say(`     ${r.row_id}  ${r.provider}  ${r.method}  predicted ${r.predicted} truth ${r.truth}  rule ${r.rule}  matched "${r.matched}"`);
  }
} else {
  say('   (no list-row leaks)');
}
say();

// ------------------------------------------------ review hint (mechanical)
say('REVIEW HINT BREAKDOWN — MECHANICAL. The hint is the second published');
say('signal beside evidence: which rows a provider should look at. It is');
say('derived from method + class + source and asserts nothing the tool does');
say('not already publish. tight = likely tighter than needed, review to');
say('loosen. loose = decided by the method floor with no evidence either way,');
say('review to confirm. settled = neither. This section gates nothing.');
for (const l of reviewLines(rows, (r) => r.review)) say(l);
say();

// ------------------------------------------------------------ 8. with Jev
if (WITH_JEV) {
  const checked = jevSelfCheck();
  const answersByTier = new Map();
  for (const spec of JEV_TIERS) {
    const p = path.join(JEV_DIR, spec.file);
    let m;
    try {
      m = readJsonl(p);
    } catch (e) {
      fail(`cannot read ${path.relative(REPO_ROOT, p)} for ${spec.tier}: ${e.message}`);
    }
    answersByTier.set(spec.tier, m);
  }
  const reports = applyJev(rows, answersByTier);

  say('====================================================================');
  say('WITH JEV — the three D95 tiers at FROZEN thresholds');
  say('====================================================================');
  say('This section supersedes the "MECHANICAL ONLY" note in the header above:');
  say('it was written before this exam had Jev answers of its own. The');
  say('mechanical numbers printed above are unchanged by this section.');
  say();
  say('Thresholds were frozen BEFORE any exam row was read through Jev and are');
  say('not settable from the command line (D24: this exam is scored once, so a');
  say('threshold picked on its rows would turn it into a tuning set):');
  for (const spec of JEV_TIERS) {
    const cmp = spec.direction === 'lower' ? '<=' : '>=';
    say(`   ${spec.tier.padEnd(14)} ${spec.from} -> ${spec.to}  when answers.${spec.question}.noul ${cmp} ${spec.threshold.toFixed(2)}`);
  }
  say(`   fail-closed self-check: ${checked} unusable-answer cases across 3 tiers, none moved a row.`);
  say();

  say('7. PER-TIER LEDGERS — each over its OWN pile only, never blended');
  for (const rep of reports) {
    const spec = rep.spec;
    say(`  ${rep.tier}  (${spec.from} -> ${spec.to}, question ${spec.question}, t=${spec.threshold.toFixed(2)})`);
    say(`    pile size            ${rep.pile} rows of the 4279 exam rows (${pct(rep.pile, EXPECTED_ROWS)} of all rows)`);
    say(`    rows moved           ${pct(rep.moved, rep.pile)} of this tier's ${rep.pile} pile rows`);
    say(`    no usable answer     ${pct(rep.noAnswer, rep.pile)} of this tier's ${rep.pile} pile rows (stayed ${spec.from}, fail closed)`);
    say(`    leaks closed         ${rep.leaksClosed} of this tier's ${rep.pile} pile rows`);
    say(`    new leaks            ${rep.newLeaks} of this tier's ${rep.pile} pile rows`);
    say(`    over-tight fixed     ${rep.overTightFixed} of this tier's ${rep.pile} pile rows`);
    say(`    over-tight created   ${rep.overTightCreated} of this tier's ${rep.pile} pile rows`);
  }
  say();

  // A moved row's review hint is RECOMPUTED through src/flow.js's reviewHint
  // — the same one writer src/jev.js's applyJev calls — because a row whose
  // class moved must not carry the hint its old class earned. An unmoved row
  // keeps the mechanical hint exactly.
  const jevRows = rows.map((r) => ({
    ...r,
    predicted: r.jevPredicted,
    review: r.jevTier ? reviewHint(r.method, r.jevPredicted, 'jev') : r.review,
  }));
  say('8. WHOLE-EXAM WITH-JEV LEDGER — all 4279 rows (counts and percentages');
  say('   of those 4279; leaks and over-tight are never collapsed into one');
  say('   accuracy number)');
  say(line('all rows (+Jev)', tally(jevRows)));
  say();

  say('9. ROWS WITH NO USABLE ANSWER — missing, errored, missing key, non-finite');
  say('   or out of [0,1]. Every one kept the mechanical verdict exactly.');
  for (const rep of reports) {
    say(`  ${rep.tier.padEnd(14)} ${pct(rep.noAnswer, rep.pile)} of this tier's pile rows`);
  }
  say();

  const jevLeaks = jevRows.filter((r) => verdict(r.predicted, r.truth) === 'leak');
  const leakPct = (jevLeaks.length / EXPECTED_ROWS) * 100;
  say('10. D94 GATE — leaks overall at or under 2% of all 4279 exam rows');
  say(`   leaks with Jev: ${pct(jevLeaks.length, EXPECTED_ROWS)} of all rows (bar: <= ${GATE_D94_MAX_LEAK_PCT}% of all rows)`);
  say(`   D94 gate: ${leakPct <= GATE_D94_MAX_LEAK_PCT ? 'PASS' : 'FAIL'}`);
  if (jevLeaks.length === 0) {
    say('   (no leaks)');
  } else if (jevLeaks.length <= 60) {
    say(`   every one of the ${jevLeaks.length} leaking rows:`);
    for (const r of jevLeaks) {
      const rule = r.jevTier ? `${r.jevTier} (p=${r.jevP}, was ${r.rule})` : r.rule;
      say(`     ${r.row_id}  ${r.provider}  ${r.method}  operationId ${r.operationId}`);
      say(`         truth ${r.truth}  predicted ${r.predicted}  deciding rule ${rule}`);
    }
  } else {
    say(`   ${jevLeaks.length} leaking rows — over the 60-row listing limit, not listed individually.`);
  }
  say();

  // ------------------------------------------------ review hint (with Jev)
  say('REVIEW HINT BREAKDOWN — WITH JEV. Same three hints, over the with-Jev');
  say('classes: a moved row is re-hinted from its new class (source jev), an');
  say('unmoved row keeps its mechanical hint. This section gates nothing.');
  for (const l of reviewLines(jevRows, (r) => r.review)) say(l);
  say();
}

console.log(out.join('\n'));
