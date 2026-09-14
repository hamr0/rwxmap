// M1-C18: derive a party-noun list over the combined corpus (the six
// original labelled sets PLUS exam 2), then leave-one-vendor-out check it,
// then score c15-equivalent logic with/without the admitted nouns.
//
// Two prior POCs (c16, c17) were measured three times each and closed
// nothing outside the set they were derived from — both deleted this pass
// (docs/logs/m1/c16-*.{md,csv} and c17-*.{md,csv} stay as the evidence
// they failed). This is a fresh derivation, on ~2472 rows instead of 1478,
// with a genuine leave-one-vendor-out admission bar (246 exam-2 providers
// count as their own vendors, same as any other set's `repo`).
//
// MEASUREMENT ONLY. judge.mjs and c15.mjs are never modified. Step 4 needs
// c15's exact classify() logic but parameterised by a noun set (c15's own
// classify() is not parameterisable), so classifyWithNouns here is a
// verbatim copy of c15.mjs's liveVerbHit/partyNounHit/classify shape,
// reusing every extraction primitive (headNounForRow, operationIdHeadNoun,
// naiveSingular, matchesAnyStem, LIVE_VERBS, fallbackVerbFromSummary,
// summaryHasCallerPhrase) unchanged from judge.mjs/arbiter.mjs/c11.mjs —
// only the noun Set itself is a parameter. A self-check verifies
// classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS) reproduces
// c15.classify(row) exactly on the original 1478 rows before any "after"
// number is trusted.
//
// How to re-run: node poc/m1/arbiter/c18.mjs
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

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c18-sweep.md');
const EXAM2_DIR = path.join(REPO_ROOT, 'data/exam2-2026-09-10');
const EXAM2_BLIND = path.join(EXAM2_DIR, 'exam-blind.csv');
const EXAM2_TRUTH_PARTS = [1, 2, 3, 4, 5].map((n) => path.join(EXAM2_DIR, `exam-truth-part${n}.csv`));

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);
const ORIGINAL_SETS = ['camara', 'holdout1', 'holdout2', 'holdout3', 'holdout4', 'holdout5'];
const ALL_SETS = [...ORIGINAL_SETS, 'exam2'];

// --- PART B: load and normalise the combined corpus ------------------------
//
// camara's own `repo` column is a sub-API name, not a vendor — every camara
// row belongs to one vendor, CAMARA itself. Every other original set's
// `repo` column already is a vendor name. exam2's `provider` column is its
// vendor label (246 distinct providers). vendorFor resolves this once, per
// row, at load time — normalised rows carry the resolved value directly as
// `vendor`, so nothing downstream re-derives it.
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

function loadExam2Rows() {
  const blindRows = parseCsv(readFileSync(EXAM2_BLIND, 'utf8'));
  const truthRows = [];
  for (const p of EXAM2_TRUTH_PARTS) {
    truthRows.push(...parseCsv(readFileSync(p, 'utf8')));
  }
  if (blindRows.length !== 1000) {
    throw new Error(`ESCALATE: expected 1000 exam2-blind rows, got ${blindRows.length}.`);
  }
  if (truthRows.length !== 1000) {
    throw new Error(`ESCALATE: expected 1000 exam2-truth rows across 5 parts, got ${truthRows.length}.`);
  }

  const truthByRowId = new Map();
  for (const t of truthRows) {
    if (truthByRowId.has(t.row_id)) {
      throw new Error(`ESCALATE: duplicate exam2 truth row_id ${t.row_id}.`);
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
      set: 'exam2',
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
    throw new Error(`ESCALATE: ${joinMisses} exam2-blind rows had no matching truth row by row_id.`);
  }
  return { rows: out, dropped, total: blindRows.length };
}

export function loadCombinedCorpus() {
  const originalRows = loadOriginalRows();
  const { rows: exam2Rows, dropped, total } = loadExam2Rows();
  const allRows = [...originalRows, ...exam2Rows];
  return { allRows, originalRows, exam2Rows, exam2Dropped: dropped, exam2Total: total };
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

// --- PART C: candidate head-noun table --------------------------------
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

// --- PART D: leave-one-vendor-out --------------------------------------
//
// For a qualifying noun, group its PUT/DELETE/PATCH evidence rows by
// vendor (row.vendor, resolved at load time — camara is one vendor, every
// other original-set repo is a vendor, every exam2 provider is a vendor).
// For each vendor contributing at least one such row, rebuild qualification
// with that vendor's rows removed. ADMITTED only if it still qualifies
// with EVERY vendor removed in turn.
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

// --- PART E: c15-equivalent classify, parameterised by noun set -------
//
// Verbatim copy of c15.mjs's own liveVerbHit/partyNounHit/classify shape.
// Every extraction primitive is imported unchanged from
// judge.mjs/arbiter.mjs/c11.mjs; only the noun Set used for the head-noun
// checks is a parameter. The third fallback (any operationId token) always
// tests the real, unmodified SHARED_NOUNS import — c15 never extends
// SHARED_NOUNS itself, so neither does this copy.
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

  throw new Error(`c18: unrecognized method "${method}"`);
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
  const { allRows, originalRows, exam2Rows, exam2Dropped, exam2Total } = loadCombinedCorpus();

  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  push('# M1-C18: party-noun derivation over the combined corpus');
  push('');
  push('Measurement only. judge.mjs and c15.mjs are never modified — c18.mjs');
  push('copies c15\'s classify logic verbatim (imports every primitive from');
  push('judge.mjs/arbiter.mjs/c11.mjs unchanged) and parameterises only the');
  push('noun Set, so the extended-set scoring is comparable to c15 itself.');
  push('');
  push('c16 and c17 (two prior noun/switch POCs) are deleted this pass — both');
  push('were measured three times and closed nothing outside the set they were');
  push('read from. docs/logs/m1/c16-*.{md,csv} and c17-*.{md,csv} stay in place');
  push('as the evidence they failed.');
  push('');

  // --- PART B report ---
  push('## Part B: the combined corpus');
  push('');
  push(`Original 6 sets (camara, holdout1, holdout2, holdout3, holdout4, holdout5): ${originalRows.length} rows.`);
  push(`Exam 2: ${exam2Total} blind rows, ${exam2Dropped} dropped for truth_class '?', ${exam2Rows.length} usable.`);
  push(`Combined: ${allRows.length} rows.`);
  push('');
  const combinedSplit = truthSplit(allRows);
  push(`Truth split, combined: r=${combinedSplit.r}, w=${combinedSplit.w}, x=${combinedSplit.x} `
    + `(${pct(combinedSplit.r, allRows.length)} / ${pct(combinedSplit.w, allRows.length)} / ${pct(combinedSplit.x, allRows.length)}).`);
  const origSplit = truthSplit(originalRows);
  push(`Truth split, original 1478: r=${origSplit.r}, w=${origSplit.w}, x=${origSplit.x}.`);
  const exam2Split = truthSplit(exam2Rows);
  push(`Truth split, exam2 ${exam2Rows.length}: r=${exam2Split.r}, w=${exam2Split.w}, x=${exam2Split.x}.`);
  const exam2ConfSplit = { high: 0, low: 0 };
  for (const r of exam2Rows) { if (exam2ConfSplit[r.confidence] !== undefined) exam2ConfSplit[r.confidence] += 1; }
  push(`Exam2 confidence split: high=${exam2ConfSplit.high}, low=${exam2ConfSplit.low}.`);
  push('');

  // --- PART C: candidate table ---
  const pdpAll = allRows.filter((r) => RAISE_METHODS.has(r.method));
  const pdpAllSplit = truthSplit(pdpAll);
  const baseRateX = pdpAllSplit.x / pdpAll.length;

  const table = buildNounTable(allRows);
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
  const alreadyKnown = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);

  push('## Part C: candidate head nouns (PUT/DELETE/PATCH rows only)');
  push('');
  push(`Qualification rule: n >= ${MIN_N} PUT/DELETE/PATCH rows carrying the noun`);
  push(`(as headNounForRow or operationIdHeadNoun), AND x-share >= ${MIN_X_SHARE * 100}%`);
  push('among those rows. Not tuned — run once as specified.');
  push(`PUT/DELETE/PATCH base rate for truth x, combined corpus: ${pdpAllSplit.x}/${pdpAll.length} = ${pct(pdpAllSplit.x, pdpAll.length)}.`);
  push('');
  push(mdTable(
    qualifying.map((c) => [
      c.noun, c.allCount, c.pdpN, c.r, c.w, c.x, pct(c.x, c.pdpN),
      c.lift !== null ? `${c.lift.toFixed(2)}x` : 'n/a',
      alreadyKnown.has(c.noun) ? 'yes' : 'no',
    ]),
    ['noun', 'allCount (all methods)', 'PDP n', 'r', 'w', 'x', 'x-share', 'lift over base', 'already in PARTY/SHARED_NOUNS'],
  ));
  push('');
  push(`${qualifying.length} nouns qualified.`);
  push('');

  // --- PART D: LOVO ---
  const lovoResults = qualifying.map((c) => ({
    ...c,
    alreadyKnown: alreadyKnown.has(c.noun),
    lovo: lovoCheck(c.pdpRows),
  }));
  const survivors = lovoResults.filter((c) => c.lovo.survivesEveryHoldout && !c.alreadyKnown);
  const rejected = lovoResults.filter((c) => !c.lovo.survivesEveryHoldout && !c.alreadyKnown);

  push('## Part D: leave-one-vendor-out admission');
  push('');
  push('Each vendor = camara (one vendor for all camara rows), every other');
  push('original set\'s `repo` column, or one of exam2\'s `provider` values (up to');
  push('246 distinct providers in the blind file; fewer if dropping \'?\' rows');
  push('happened to remove a provider\'s only row).');
  push('For each qualifying noun, its PDP evidence rows are grouped by vendor;');
  push('for each contributing vendor, qualification is rebuilt on the OTHER');
  push('vendors\' rows only. ADMITTED only if it still qualifies with EVERY');
  push('vendor removed in turn — a noun that only qualifies with its sole');
  push('propping vendor included is memorisation, listed separately, not admitted.');
  push('');
  push(mdTable(
    lovoResults.map((c) => [
      c.noun, c.pdpN, c.lovo.vendors.length,
      c.lovo.survivesEveryHoldout ? 'yes' : 'no',
      c.alreadyKnown ? 'already known — excluded from candidate set' : (c.lovo.survivesEveryHoldout ? 'ADMITTED' : 'rejected (memorisation)'),
    ]),
    ['noun', 'PDP n', '# vendors', 'survives LOVO', 'verdict'],
  ));
  push('');
  push(`**${survivors.length} nouns ADMITTED** (survive LOVO, not already in PARTY_NOUNS/SHARED_NOUNS):`);
  push(survivors.length ? survivors.map((c) => `\`${c.noun}\``).join(', ') : '(none)');
  push('');
  push(`**${rejected.length} nouns rejected as memorisation** (qualify on the full set but fail with at least one vendor removed):`);
  push(rejected.length ? rejected.map((c) => `\`${c.noun}\``).join(', ') : '(none)');
  push('');

  // --- PART E: scoring ---
  const baseNounSet = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);
  const admittedNounSet = new Set([...baseNounSet, ...survivors.map((c) => c.noun)]);

  // self-check on the ORIGINAL 1478 rows only.
  let mismatches = 0;
  for (const row of originalRows) {
    const a = classifyC15(row).class;
    const b = classifyWithNouns(row, baseNounSet).class;
    if (a !== b) mismatches += 1;
  }
  if (mismatches > 0) {
    throw new Error(`ESCALATE: c18.mjs's copied classify logic disagrees with c15.classify on ${mismatches} of the original 1478 rows — the copy is not faithful, do not trust any "after" number.`);
  }

  const highConfRows = allRows.filter((r) => r.confidence === 'high');

  const configs = [
    { name: 'c15 as-is', nounSet: baseNounSet, rows: allRows },
    { name: 'c15 + admitted nouns', nounSet: admittedNounSet, rows: allRows },
    { name: 'c15 + admitted nouns, high-confidence rows only', nounSet: admittedNounSet, rows: highConfRows },
  ];

  push('## Part E: scoring');
  push('');
  push(`Self-check: classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS) matched`);
  push(`c15.classify(row) on all ${originalRows.length} original rows (${mismatches} mismatches) before any`);
  push('"after" number below was trusted.');
  push('');
  push('Goal-2 leak = truth x predicted w (under-classification, the go/no-go gate).');
  push('Goal-1 error = truth w predicted x (over-classification, a usability cost).');
  push('over-tight = every predicted-tighter-than-truth row (goal-1 errors plus any r->w/x rows).');
  push('floor leaks = of the goal-2 leaks, how many landed on the unresolved floor (res.floor true), not a fired word rule.');
  push('');

  const summaryRows = [];
  for (const cfg of configs) {
    const res = scoreRows(cfg.rows, (row) => classifyWithNouns(row, cfg.nounSet));
    summaryRows.push([cfg.name, res.n, res.goal2Leaks, res.floorLeaks, res.goal1Errors, res.overTight, res.exact]);
  }
  push('### Full combined corpus (and high-confidence subset for config 3)');
  push('');
  push(mdTable(summaryRows, ['config', 'n', 'goal-2 leaks (x->w)', 'of which floor leaks', 'goal-1 errors (w->x)', 'total over-tight', 'exact']));
  push('');

  push('### Broken out: original 1478 rows only');
  push('');
  const origBreakoutRows = [];
  for (const cfg of configs) {
    const rows = cfg.rows.filter((r) => ORIGINAL_SETS.includes(r.set));
    const res = scoreRows(rows, (row) => classifyWithNouns(row, cfg.nounSet));
    origBreakoutRows.push([cfg.name, res.n, res.goal2Leaks, res.floorLeaks, res.goal1Errors, res.overTight, res.exact]);
  }
  push(mdTable(origBreakoutRows, ['config', 'n', 'goal-2 leaks (x->w)', 'of which floor leaks', 'goal-1 errors (w->x)', 'total over-tight', 'exact']));
  push('');

  push('### Broken out: exam2 rows only');
  push('');
  const exam2BreakoutRows = [];
  for (const cfg of configs) {
    const rows = cfg.rows.filter((r) => r.set === 'exam2');
    const res = scoreRows(rows, (row) => classifyWithNouns(row, cfg.nounSet));
    exam2BreakoutRows.push([cfg.name, res.n, res.goal2Leaks, res.floorLeaks, res.goal1Errors, res.overTight, res.exact]);
  }
  push(mdTable(exam2BreakoutRows, ['config', 'n', 'goal-2 leaks (x->w)', 'of which floor leaks', 'goal-1 errors (w->x)', 'total over-tight', 'exact']));
  push('');

  // --- top 25 head nouns still on leaks after admitted nouns are added ---
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
  push('Input to the next pass. Counted over the full combined corpus, config 2');
  push('(c15 + admitted nouns). A leak row can contribute up to two nouns (summary');
  push('head noun and operationId head noun, deduped per row).');
  push('');
  push(mdTable(topLeakNouns.map(([noun, n]) => [noun, n]), ['noun', 'leak rows']));
  push('');

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD}`);
}

// Guarded so c18.test.mjs can import the exported helpers without paying
// for a full derivation-and-report run (and without the ESCALATE checks in
// main() firing) on every test invocation.
import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
