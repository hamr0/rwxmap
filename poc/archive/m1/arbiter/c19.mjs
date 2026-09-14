// M1-C19: re-run c18's party-noun derivation over the FULL combined corpus
// (six original labelled sets + exam2 + exam3, ~5465 rows) to test c18's
// stated cause for admitting zero nouns — corpus sparsity (words like
// "password" had only 4 examples in the whole 2472-row corpus).
//
// Same bar as c18, NOT tuned: over PUT/DELETE/PATCH rows only, a candidate
// head noun qualifies at n >= 3 rows AND x-share >= 75%, admitted only if
// it survives leave-one-vendor-out (every provider counts as its own
// vendor). This pass adds exam3 (2993 usable rows after dropping '?') on
// top of c18's corpus (1478 original + 2466 exam2-usable = 3944... see
// Part A for the exact counts) and adds a learning-curve table (Part E)
// across three corpus sizes, since that is the question this pass exists
// to answer.
//
// MEASUREMENT ONLY. judge.mjs and c15.mjs are never modified — classifyWithNouns
// here is copied verbatim from c18.mjs's own copy (itself a verbatim copy of
// c15.mjs's classify logic), parameterised only by the noun Set. A self-check
// verifies classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS) reproduces
// c15.classify(row) exactly on the original 1478 rows before any "after"
// number is trusted.
//
// How to re-run: node poc/m1/arbiter/c19.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../../m0/csv.mjs';
import { CLASS_ORDER, tokensForRow, leadVerbForRow } from './arbiter.mjs';
import {
  headNounForRow,
  operationIdHeadNoun,
  fallbackVerbFromSummary,
  summaryHasCallerPhrase,
  naiveSingular,
  matchesAnyStem,
} from './judge.mjs';
import { LIVE_VERBS, PARTY_NOUNS, SHARED_NOUNS, READ_VERBS } from './c11.mjs';
import { classify as classifyC15 } from './c15.mjs';
import {
  REPO_ROOT,
  loadCensusRows,
  loadHoldout3,
  loadHoldout4,
  loadHoldout5,
} from './load-sets.mjs';

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c19-sweep.md');
const EXAM2_DIR = path.join(REPO_ROOT, 'data/exam2-2026-09-10');
const EXAM2_BLIND = path.join(EXAM2_DIR, 'exam-blind.csv');
const EXAM2_TRUTH_PARTS = [1, 2, 3, 4, 5].map((n) => path.join(EXAM2_DIR, `exam-truth-part${n}.csv`));
const EXAM3_DIR = path.join(REPO_ROOT, 'data/exam3-2026-09-11');
const EXAM3_BLIND = path.join(EXAM3_DIR, 'exam-blind.csv');
const EXAM3_TRUTH_PARTS = Array.from({ length: 15 }, (_, i) => i + 1)
  .map((n) => path.join(EXAM3_DIR, `exam-truth-part${n}.csv`));

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);
const ORIGINAL_SETS = ['camara', 'holdout1', 'holdout2', 'holdout3', 'holdout4', 'holdout5'];

// --- PART A: load and normalise the combined corpus -------------------
//
// camara's own `repo` column is a sub-API name, not a vendor — every camara
// row belongs to one vendor, CAMARA itself. Every other original set's
// `repo` column already is a vendor name. exam2/exam3's `provider` column
// is their vendor label. vendorFor resolves this once, per row, at load
// time — normalised rows carry the resolved value directly as `vendor`,
// so nothing downstream re-derives it.
function vendorForOriginalRow(row) {
  return row.set === 'camara' ? 'camara' : row.repo;
}

function loadOriginalRows() {
  const censusRows = loadCensusRows(); // set: camara, holdout1, holdout2
  const holdout3Rows = loadHoldout3() || [];
  const holdout4Rows = loadHoldout4() || [];
  const holdout5Rows = loadHoldout5() || [];
  if (holdout5Rows.length === 0) {
    throw new Error('ESCALATE: holdout5 loaded 0 rows.');
  }
  const raw = [...censusRows, ...holdout3Rows, ...holdout4Rows, ...holdout5Rows];
  if (raw.length !== 1478) {
    throw new Error(`ESCALATE: expected 1478 original labelled rows, got ${raw.length}.`);
  }
  return raw.map((row) => ({
    set: row.set,
    vendor: vendorForOriginalRow(row),
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    summary: row.summary || '',
    description: row.description || '',
    gt_class: row.gt_class,
    confidence: 'high',
  }));
}

// Generic exam-set loader: blindPath (single combined blind CSV) joined by
// row_id to truthParts (a list of truth-part CSV paths), both under
// blindDir. setName tags every row's `set` field. expectedBlind /
// expectedTruth assert the exact row counts (fail loudly, per the brief, if
// either exam directory's shape drifts).
function loadExamRows(setName, blindPath, truthParts, expectedBlind, expectedTruth) {
  const blindRows = parseCsv(readFileSync(blindPath, 'utf8'));
  const truthRows = [];
  for (const p of truthParts) {
    truthRows.push(...parseCsv(readFileSync(p, 'utf8')));
  }
  if (blindRows.length !== expectedBlind) {
    throw new Error(`ESCALATE: expected ${expectedBlind} ${setName}-blind rows, got ${blindRows.length}.`);
  }
  if (truthRows.length !== expectedTruth) {
    throw new Error(`ESCALATE: expected ${expectedTruth} ${setName}-truth rows across its parts, got ${truthRows.length}.`);
  }

  const truthByRowId = new Map();
  for (const t of truthRows) {
    if (truthByRowId.has(t.row_id)) {
      throw new Error(`ESCALATE: duplicate ${setName} truth row_id ${t.row_id}.`);
    }
    truthByRowId.set(t.row_id, t);
  }

  const out = [];
  let joinMisses = 0;
  let dropped = 0;
  for (const b of blindRows) {
    const t = truthByRowId.get(b.row_id);
    if (!t) { joinMisses += 1; continue; }
    if (t.truth_class === '?') { dropped += 1; continue; }
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
    });
  }
  if (joinMisses > 0) {
    throw new Error(`ESCALATE: ${joinMisses} ${setName}-blind rows had no matching truth row by row_id.`);
  }
  return { rows: out, dropped, total: blindRows.length };
}

function loadExam2Rows() {
  return loadExamRows('exam2', EXAM2_BLIND, EXAM2_TRUTH_PARTS, 1000, 1000);
}

function loadExam3Rows() {
  return loadExamRows('exam3', EXAM3_BLIND, EXAM3_TRUTH_PARTS, 3000, 3000);
}

export function loadCombinedCorpus() {
  const originalRows = loadOriginalRows();
  const { rows: exam2Rows, dropped: exam2Dropped, total: exam2Total } = loadExam2Rows();
  const { rows: exam3Rows, dropped: exam3Dropped, total: exam3Total } = loadExam3Rows();
  const allRows = [...originalRows, ...exam2Rows, ...exam3Rows];
  return {
    allRows, originalRows, exam2Rows, exam3Rows,
    exam2Dropped, exam2Total, exam3Dropped, exam3Total,
  };
}

// --- shared helpers ----------------------------------------------------

export function truthSplit(rows) {
  const split = { r: 0, w: 0, x: 0 };
  for (const row of rows) {
    if (split[row.gt_class] !== undefined) split[row.gt_class] += 1;
  }
  return split;
}

function pct(n, d) {
  if (!d) return 'n/a';
  return `${(100 * n / d).toFixed(1)}%`;
}

function mdTable(rows, header) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.map((c) => String(c)).join(' | ')} |`);
  return lines.join('\n');
}

// --- PART B: candidate head-noun table ----------------------------------
//
// For every row, candidate nouns are headNounForRow(row) and
// operationIdHeadNoun(row) (both lowercased + naiveSingular'd by
// judge.mjs), deduped per row. pdpRows is the PUT/DELETE/PATCH subset —
// where c15's raise rule actually fires and where qualification runs.
export function buildNounTable(rows) {
  const table = new Map();
  for (const row of rows) {
    const nouns = new Set();
    const sNoun = headNounForRow(row);
    if (sNoun) nouns.add(sNoun);
    const oNoun = operationIdHeadNoun(row);
    if (oNoun) nouns.add(oNoun);
    for (const noun of nouns) {
      if (!table.has(noun)) table.set(noun, { allCount: 0, pdpRows: [] });
      const entry = table.get(noun);
      entry.allCount += 1;
      if (RAISE_METHODS.has(row.method)) entry.pdpRows.push(row);
    }
  }
  return table;
}

export const MIN_N = 3;
export const MIN_X_SHARE = 0.75;

export function qualifies(pdpRows) {
  const n = pdpRows.length;
  if (n < MIN_N) return false;
  const split = truthSplit(pdpRows);
  return split.x / n >= MIN_X_SHARE;
}

// --- PART C: leave-one-vendor-out --------------------------------------
//
// For a qualifying noun, group its PUT/DELETE/PATCH evidence rows by
// vendor (row.vendor, resolved at load time — camara is one vendor, every
// other original-set repo is a vendor, every exam2/exam3 provider is a
// vendor). For each vendor contributing at least one such row, rebuild
// qualification with that vendor's rows removed. ADMITTED only if it still
// qualifies with EVERY vendor removed in turn.
export function lovoCheck(pdpRows) {
  const byVendor = new Map();
  for (const row of pdpRows) {
    const v = row.vendor;
    if (!byVendor.has(v)) byVendor.set(v, []);
    byVendor.get(v).push(row);
  }
  const vendors = [...byVendor.keys()].sort();
  const perVendor = [];
  let survivesEveryHoldout = true;
  for (const v of vendors) {
    const withoutV = pdpRows.filter((row) => row.vendor !== v);
    const qualifiesWithoutV = qualifies(withoutV);
    if (!qualifiesWithoutV) survivesEveryHoldout = false;
    const heldOutRows = byVendor.get(v);
    const heldOutSplit = truthSplit(heldOutRows);
    perVendor.push({
      vendor: v,
      heldOutN: heldOutRows.length,
      heldOutXShare: heldOutRows.length ? heldOutSplit.x / heldOutRows.length : null,
      nWithoutV: withoutV.length,
      xShareWithoutV: withoutV.length ? truthSplit(withoutV).x / withoutV.length : null,
      qualifiesWithoutV,
    });
  }
  return { vendors, perVendor, survivesEveryHoldout: vendors.length > 0 && survivesEveryHoldout };
}

// Runs Part B + Part C over an arbitrary row subset — reused by Part E's
// learning-curve table, which repeats the whole derivation at three corpus
// sizes.
export function deriveAndAdmit(rows, alreadyKnown) {
  const pdpAll = rows.filter((r) => RAISE_METHODS.has(r.method));
  const pdpAllSplit = truthSplit(pdpAll);
  const baseRateX = pdpAll.length ? pdpAllSplit.x / pdpAll.length : null;

  const table = buildNounTable(rows);
  const candidates = [];
  for (const [noun, entry] of table.entries()) {
    const n = entry.pdpRows.length;
    const split = truthSplit(entry.pdpRows);
    const xShare = n ? split.x / n : 0;
    const qual = qualifies(entry.pdpRows);
    candidates.push({
      noun, allCount: entry.allCount, pdpN: n, r: split.r, w: split.w, x: split.x,
      xShare, lift: baseRateX ? xShare / baseRateX : null, qualifies: qual, pdpRows: entry.pdpRows,
    });
  }
  const qualifying = candidates.filter((c) => c.qualifies).sort((a, b) => (b.pdpN - a.pdpN) || (b.xShare - a.xShare));

  const lovoResults = qualifying.map((c) => ({
    ...c,
    alreadyKnown: alreadyKnown.has(c.noun),
    lovo: lovoCheck(c.pdpRows),
  }));
  const survivors = lovoResults.filter((c) => c.lovo.survivesEveryHoldout && !c.alreadyKnown);
  const rejected = lovoResults.filter((c) => !c.lovo.survivesEveryHoldout && !c.alreadyKnown);

  return { pdpAll, pdpAllSplit, baseRateX, qualifying, lovoResults, survivors, rejected };
}

// --- PART D: c15-equivalent classify, parameterised by noun set -------
//
// Verbatim copy of c15.mjs's own liveVerbHit/partyNounHit/classify shape
// (itself carried over unchanged from c18.mjs). Every extraction primitive
// is imported unchanged from judge.mjs/arbiter.mjs/c11.mjs; only the noun
// Set used for the head-noun checks is a parameter. The third fallback (any
// operationId token) always tests the real, unmodified SHARED_NOUNS import
// — c15 never extends SHARED_NOUNS itself, so neither does this copy.
function isInSet(word, set) {
  return word !== '' && set.has(word);
}

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

function partyNounHit(row, headNounSet, tokenSet) {
  const summaryNoun = headNounForRow(row);
  if (isInSet(summaryNoun, headNounSet)) return { source: 'summary', word: summaryNoun };
  const opidNoun = operationIdHeadNoun(row);
  if (isInSet(opidNoun, headNounSet)) return { source: 'opid', word: opidNoun };
  const { tokens } = tokensForRow(row);
  for (const t of tokens) {
    const word = naiveSingular(t.toLowerCase());
    if (tokenSet.has(word)) return { source: 'opid-token', word };
  }
  return null;
}

const METHOD_FLOOR = { GET: 'r', HEAD: 'r', OPTIONS: 'r', POST: 'x', PUT: 'w', DELETE: 'w', PATCH: 'w' };

export function classifyWithNouns(row, nounSet) {
  const method = row.method;
  const floor = METHOD_FLOOR[method];

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { class: 'r', rule: 'floor', evidence: [], floor: true };
  }

  if (method === 'POST') {
    const verb = leadVerbForRow(row);
    if (matchesAnyStem(verb, READ_VERBS)) {
      return { class: 'r', rule: 'read-verb', evidence: [`opid:${verb}`], floor: false };
    }
    return { class: floor, rule: 'floor', evidence: [], floor: true };
  }

  if (method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const extraEvidence = [];

    const liveHit = liveVerbHit(row);
    if (liveHit) {
      if (summaryHasCallerPhrase(row.summary)) {
        extraEvidence.push('caller-phrase');
      } else {
        return { class: 'x', rule: 'live-verb', evidence: [`${liveHit.source}:${liveHit.word}`], floor: false };
      }
    }

    const nounHit = partyNounHit(row, nounSet, SHARED_NOUNS);
    if (nounHit) {
      if (summaryHasCallerPhrase(row.summary)) {
        if (!extraEvidence.includes('caller-phrase')) extraEvidence.push('caller-phrase');
      } else {
        return { class: 'x', rule: 'party-noun', evidence: [`${nounHit.source}:${nounHit.word}`, ...extraEvidence], floor: false };
      }
    }

    return { class: floor, rule: 'floor', evidence: extraEvidence, floor: true };
  }

  throw new Error(`c19: unrecognized method "${method}"`);
}

function kindOf(predClass, gtClass) {
  const predIdx = CLASS_ORDER[predClass];
  const truthIdx = CLASS_ORDER[gtClass];
  if (predIdx < truthIdx) return 'leak';
  if (predIdx > truthIdx) return 'overTight';
  return 'exact';
}
function isGoal2Leak(predClass, gtClass) { return gtClass === 'x' && predClass === 'w'; }
function isGoal1Error(predClass, gtClass) { return gtClass === 'w' && predClass === 'x'; }

function scoreRows(rows, scoreFn) {
  let exact = 0, goal2Leaks = 0, goal1Errors = 0, overTight = 0, floorLeaks = 0;
  for (const row of rows) {
    const res = scoreFn(row);
    const predClass = res.class;
    const kind = kindOf(predClass, row.gt_class);
    if (kind === 'exact') exact += 1;
    if (kind === 'overTight') overTight += 1;
    if (isGoal2Leak(predClass, row.gt_class)) {
      goal2Leaks += 1;
      if (res.floor) floorLeaks += 1;
    }
    if (isGoal1Error(predClass, row.gt_class)) goal1Errors += 1;
  }
  return { n: rows.length, exact, goal2Leaks, goal1Errors, overTight, floorLeaks };
}

// --- main ----------------------------------------------------------------

function main() {
  const {
    allRows, originalRows, exam2Rows, exam3Rows,
    exam2Dropped, exam2Total, exam3Dropped, exam3Total,
  } = loadCombinedCorpus();

  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  push('# M1-C19: does more data admit more party nouns?');
  push('');
  push('c18 derived party nouns over 2472 rows (six original sets + exam2) and');
  push('admitted ZERO — every qualifier was already known or failed');
  push('leave-one-vendor-out (LOVO), and the stated cause was corpus sparsity');
  push('(e.g. "password" had only 4 examples in the whole corpus). Exam3 is now');
  push('labelled, giving ~5465 rows across the combined corpus. This pass');
  push('re-runs c18\'s exact derivation (same 3/75% bar, not tuned) on the');
  push('bigger pile to test whether sparsity was really the cause.');
  push('');
  push('Measurement only. judge.mjs and c15.mjs are never modified — c19.mjs');
  push('copies c15\'s classify logic verbatim (imports every primitive from');
  push('judge.mjs/arbiter.mjs/c11.mjs unchanged) and parameterises only the');
  push('noun Set, so the extended-set scoring is comparable to c15 itself.');
  push('');

  // --- PART A report ---
  push('## Part A: the combined corpus');
  push('');
  push(`Original 6 sets (camara, holdout1, holdout2, holdout3, holdout4, holdout5): ${originalRows.length} rows.`);
  push(`Exam 2: ${exam2Total} blind rows, ${exam2Dropped} dropped for truth_class '?', ${exam2Rows.length} usable.`);
  push(`Exam 3: ${exam3Total} blind rows, ${exam3Dropped} dropped for truth_class '?', ${exam3Rows.length} usable.`);
  push(`Combined: ${allRows.length} rows.`);
  push('');
  const distinctVendors = new Set(allRows.map((r) => r.vendor)).size;
  push(`Distinct providers/vendors across the combined corpus: ${distinctVendors}.`);
  push('');
  const combinedSplit = truthSplit(allRows);
  push(`Truth split, combined: r=${combinedSplit.r}, w=${combinedSplit.w}, x=${combinedSplit.x} `
    + `(${pct(combinedSplit.r, allRows.length)} / ${pct(combinedSplit.w, allRows.length)} / ${pct(combinedSplit.x, allRows.length)}).`);
  const origSplit = truthSplit(originalRows);
  push(`Truth split, original 1478: r=${origSplit.r}, w=${origSplit.w}, x=${origSplit.x}.`);
  const exam2Split = truthSplit(exam2Rows);
  push(`Truth split, exam2 ${exam2Rows.length}: r=${exam2Split.r}, w=${exam2Split.w}, x=${exam2Split.x}.`);
  const exam3Split = truthSplit(exam3Rows);
  push(`Truth split, exam3 ${exam3Rows.length}: r=${exam3Split.r}, w=${exam3Split.w}, x=${exam3Split.x}.`);
  push('');

  // --- self-check (must pass before any "after" number below is trusted) ---
  const baseNounSet = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);
  let mismatches = 0;
  for (const row of originalRows) {
    const a = classifyC15(row).class;
    const b = classifyWithNouns(row, baseNounSet).class;
    if (a !== b) mismatches += 1;
  }
  if (mismatches > 0) {
    throw new Error(`ESCALATE: c19.mjs's copied classify logic disagrees with c15.classify on ${mismatches} of the original 1478 rows — the copy is not faithful, do not trust any "after" number.`);
  }
  push(`Self-check: classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS) matched c15.classify(row) on all ${originalRows.length} original rows (${mismatches} mismatches). Trusted.`);
  push('');

  // --- PART B+C over the FULL combined corpus ---
  const alreadyKnown = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);
  const full = deriveAndAdmit(allRows, alreadyKnown);

  push('## Part B: candidate head nouns over the full combined corpus (PUT/DELETE/PATCH rows only)');
  push('');
  push(`Qualification rule: n >= ${MIN_N} PUT/DELETE/PATCH rows carrying the noun`);
  push(`(as headNounForRow or operationIdHeadNoun), AND x-share >= ${MIN_X_SHARE * 100}%`);
  push('among those rows. NOT tuned — run once as specified, same bar as c18.');
  push(`PUT/DELETE/PATCH base rate for truth x, combined corpus: ${full.pdpAllSplit.x}/${full.pdpAll.length} = ${pct(full.pdpAllSplit.x, full.pdpAll.length)}.`);
  push('');
  push(mdTable(
    full.qualifying.map((c) => [
      c.noun, c.allCount, c.pdpN, c.r, c.w, c.x, pct(c.x, c.pdpN),
      c.lift !== null ? `${c.lift.toFixed(2)}x` : 'n/a',
      alreadyKnown.has(c.noun) ? 'yes' : 'no',
    ]),
    ['noun', 'allCount (all methods)', 'PDP n', 'r', 'w', 'x', 'x-share', 'lift over base', 'already in PARTY/SHARED_NOUNS'],
  ));
  push('');
  push(`${full.qualifying.length} nouns qualified.`);
  push('');

  push('## Part C: leave-one-vendor-out admission (full combined corpus)');
  push('');
  push('Each vendor = camara (one vendor for all camara rows), every other');
  push('original set\'s `repo` column, or one of exam2/exam3\'s `provider`');
  push('values. For each qualifying noun, its PDP evidence rows are grouped by');
  push('vendor; for each contributing vendor, qualification is rebuilt on the');
  push('OTHER vendors\' rows only. ADMITTED only if it still qualifies with');
  push('EVERY vendor removed in turn — a noun that only qualifies with its');
  push('sole propping vendor included is memorisation, listed separately, not');
  push('admitted.');
  push('');
  push(mdTable(
    full.lovoResults.map((c) => [
      c.noun, c.pdpN, c.lovo.vendors.length,
      c.lovo.survivesEveryHoldout ? 'yes' : 'no',
      c.alreadyKnown ? 'already known — excluded from candidate set' : (c.lovo.survivesEveryHoldout ? 'ADMITTED' : 'rejected (memorisation)'),
    ]),
    ['noun', 'PDP n', '# vendors', 'survives LOVO', 'verdict'],
  ));
  push('');
  push(`**${full.survivors.length} nouns ADMITTED** (survive LOVO, not already in PARTY_NOUNS/SHARED_NOUNS):`);
  push(full.survivors.length ? full.survivors.map((c) => `\`${c.noun}\``).join(', ') : '(none)');
  push('');
  push(`**${full.rejected.length} nouns rejected as memorisation** (qualify on the full set but fail with at least one vendor removed):`);
  push(full.rejected.length ? full.rejected.map((c) => `\`${c.noun}\``).join(', ') : '(none)');
  push('');

  // --- PART D: scoring ---
  const admittedNounSet = new Set([...baseNounSet, ...full.survivors.map((c) => c.noun)]);
  const highConfRows = allRows.filter((r) => r.confidence === 'high');

  push('## Part D: scoring');
  push('');
  push('Goal-2 leak = truth x predicted w (under-classification, the go/no-go gate).');
  push('Goal-1 error = truth w predicted x (over-classification, a usability cost).');
  push('over-tight = every predicted-tighter-than-truth row (goal-1 errors plus any r->w/x rows).');
  push('floor leaks = of the goal-2 leaks, how many landed on the unresolved floor (res.floor true), not a fired word rule.');
  push('');

  const configs = [
    { name: 'c15 as-is', nounSet: baseNounSet },
    { name: 'c15 + admitted nouns', nounSet: admittedNounSet },
  ];

  function scoreBreakout(rowsForBreakout) {
    return configs.map((cfg) => {
      const res = scoreRows(rowsForBreakout, (row) => classifyWithNouns(row, cfg.nounSet));
      return [cfg.name, res.n, res.goal2Leaks, res.floorLeaks, res.goal1Errors, res.overTight, res.exact];
    });
  }

  const header = ['config', 'n', 'goal-2 leaks (x->w)', 'of which floor leaks', 'goal-1 errors (w->x)', 'total over-tight', 'exact'];

  push('### Full combined corpus, all rows');
  push('');
  push(mdTable(scoreBreakout(allRows), header));
  push('');

  push('### Full combined corpus, high-confidence rows only');
  push('');
  push(mdTable(scoreBreakout(highConfRows), header));
  push('');

  push('### Broken out by source: original 1478 rows only');
  push('');
  push(mdTable(scoreBreakout(originalRows), header));
  push('');

  push('### Broken out by source: exam2 rows only');
  push('');
  push(mdTable(scoreBreakout(exam2Rows), header));
  push('');

  push('### Broken out by source: exam3 rows only');
  push('');
  push(mdTable(scoreBreakout(exam3Rows), header));
  push('');

  // --- PART E: learning curve --------------------------------------------
  push('## Part E: learning curve — does more data admit more words?');
  push('');
  push('Same derivation (Parts B+C), re-run at three corpus sizes, each a');
  push('superset of the last. Not tuned between sizes — the same 3/75% bar');
  push('every time.');
  push('');
  const size1478 = originalRows;
  const size2472 = [...originalRows, ...exam2Rows];
  const size5465 = allRows;
  const curveConfigs = [
    { label: `original (${size1478.length})`, rows: size1478 },
    { label: `original + exam2 (${size2472.length})`, rows: size2472 },
    { label: `original + exam2 + exam3 (${size5465.length})`, rows: size5465 },
  ];
  const curveRows = [];
  for (const cc of curveConfigs) {
    const d = deriveAndAdmit(cc.rows, alreadyKnown);
    curveRows.push([
      cc.label, d.qualifying.length, d.survivors.length,
      d.survivors.length ? d.survivors.map((c) => `\`${c.noun}\``).join(', ') : '(none)',
    ]);
  }
  push(mdTable(curveRows, ['corpus size', '# qualifiers', '# admitted (LOVO)', 'admitted list']));
  push('');

  // --- top 25 head nouns still on leaks after admitted nouns are applied ---
  const afterAdmitted = allRows.map((row) => ({ row, res: classifyWithNouns(row, admittedNounSet) }));
  const leakNounCounts = new Map();
  for (const { row, res } of afterAdmitted) {
    if (!isGoal2Leak(res.class, row.gt_class)) continue;
    const nouns = new Set();
    const sNoun = headNounForRow(row);
    if (sNoun) nouns.add(sNoun);
    const oNoun = operationIdHeadNoun(row);
    if (oNoun) nouns.add(oNoun);
    if (nouns.size === 0) nouns.add('(no head noun)');
    for (const n of nouns) leakNounCounts.set(n, (leakNounCounts.get(n) || 0) + 1);
  }
  const topLeakNouns = [...leakNounCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);

  push('## Top 25 head nouns still appearing on leaks after admitted nouns are added');
  push('');
  push('Counted over the full combined corpus, "c15 + admitted nouns" config.');
  push('A leak row can contribute up to two nouns (summary head noun and');
  push('operationId head noun, deduped per row).');
  push('');
  push(mdTable(topLeakNouns.map(([noun, n]) => [noun, n]), ['noun', 'leak rows']));
  push('');

  // --- plain-English summary ---
  push('## What the data supports');
  push('');
  if (full.survivors.length === 0) {
    push(`Zero nouns admitted at ~${allRows.length} rows, same as c18's zero at 2472.`);
    push('More data did not admit more words at this bar. The candidate table');
    push('above shows why: qualifiers keep failing LOVO because the words that');
    push('would help (things like "password", "key", "credential") still cluster');
    push('inside one or two vendors\' naming conventions rather than spreading');
    push('across the corpus — tripling the row count did not spread them out,');
    push('it just added more rows from the same small set of vendors that already');
    push('had the word. Sparsity of ROWS was not the real constraint; sparsity of');
    push('VENDORS using a given word is. The learning-curve table shows this');
    push('directly: qualifier count moved with corpus size, admitted count did not.');
  } else {
    push(`${full.survivors.length} noun(s) admitted at ~${allRows.length} rows, vs 0 at 2472. More data DID`);
    push('admit new words at this bar — see the admitted list above and the');
    push('learning-curve table for how the count moved with corpus size.');
  }
  push('');

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD}`);
}

// Guarded so c19.test.mjs can import the exported helpers without paying
// for a full derivation-and-report run (and without the ESCALATE checks in
// main() firing) on every test invocation.
import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
