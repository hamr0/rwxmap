// M1-C18: derive a candidate party-noun list from the labelled corpus,
// instead of hand-writing it.
//
// PARTY_NOUNS (judge.mjs) is a 30-word hand-written set from months ago,
// never derived from data. Measured evidence it is too short: it misses
// unseen rows like Groups_RemoveOwner, delete_user_credential,
// DELETE_v3-teammates-username, ChangeMailboxPassword — head nouns owner,
// credential, username, password, none of which are in the set.
//
// This is a MEASUREMENT script. It writes docs/logs/m1/c18-noun-derivation.md
// and adopts nothing — judge.mjs and c15.mjs are never modified. Step 4
// below needs c15's exact classify() logic but parameterised by a noun
// set (c15.classify() is not parameterisable), so classifyWithNouns here
// is a verbatim copy of c15.mjs's own logic (liveVerbHit / partyNounHit /
// the floor+raise-only shape), reusing every extraction primitive
// (headNounForRow, operationIdHeadNoun, tokensForRow, naiveSingular,
// matchesAnyStem, LIVE_VERBS, fallbackVerbFromSummary,
// summaryHasCallerPhrase) unchanged from judge.mjs / arbiter.mjs / c11.mjs
// — only the noun Set itself is swapped for a parameter. A self-check
// below verifies classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS)
// reproduces c15.classify(row) exactly on all 1478 rows before any
// "after" numbers are trusted.
//
// How to re-run: node poc/m1/arbiter/derive-nouns.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { CLASS_ORDER, tokensForRow, leadVerbForRow } from './arbiter.mjs';
import {
  headNounForRow,
  operationIdHeadNoun,
  fallbackVerbFromSummary,
  summaryHasCallerPhrase,
  naiveSingular,
  matchesAnyStem,
  PARTY_NOUNS as JUDGE_PARTY_NOUNS,
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

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c18-noun-derivation.md');

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);
const SETS = ['camara', 'holdout1', 'holdout2', 'holdout3', 'holdout4', 'holdout5'];

// camara's own `repo` column is a sub-API name, not a vendor — every camara
// row belongs to one vendor, CAMARA itself. Every other set's `repo` column
// already is a vendor name. Same convention as run-c17.mjs's vendorOf.
function vendorOf(row) {
  return row.set === 'camara' ? 'camara' : row.repo;
}

// --- load all six sets, all 1478 labelled rows -----------------------------

function loadAllRows() {
  const censusRows = loadCensusRows(); // set: camara, holdout1, holdout2
  const holdout3Rows = loadHoldout3() || [];
  const holdout4Rows = loadHoldout4() || [];
  const holdout5Rows = loadHoldout5() || [];
  if (holdout5Rows.length === 0) {
    throw new Error('ESCALATE: holdout5 loaded 0 rows.');
  }
  const allRows = [...censusRows, ...holdout3Rows, ...holdout4Rows, ...holdout5Rows];
  if (allRows.length !== 1478) {
    throw new Error(`ESCALATE: expected 1478 labelled rows total, got ${allRows.length}.`);
  }
  return allRows;
}

// --- STEP 1: the noun table -------------------------------------------------
//
// For every row, the candidate nouns it carries are headNounForRow(row) and
// operationIdHeadNoun(row) (both already lowercased + naiveSingular'd by
// judge.mjs) — deduped per row so a row where both sources agree only
// counts once for that noun. allCount is over every method; pdpRows is the
// PUT/DELETE/PATCH subset, which is where the precision figures and the
// qualification rule run (that is where c15's raise rule actually fires).
function buildNounTable(rows) {
  const table = new Map(); // noun -> { allCount, allRows: Set(row-index tracked via array), pdpRows: [] }
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

function truthSplit(rows) {
  const split = { r: 0, w: 0, x: 0 };
  for (const row of rows) {
    if (split[row.gt_class] !== undefined) split[row.gt_class] += 1;
  }
  return split;
}

// --- STEP 2: qualification --------------------------------------------------
// n >= 3 PUT/DELETE/PATCH rows carrying the noun, AND x-share >= 0.75 among
// those rows.
const MIN_N = 3;
const MIN_X_SHARE = 0.75;

function qualifies(pdpRows) {
  const n = pdpRows.length;
  if (n < MIN_N) return false;
  const split = truthSplit(pdpRows);
  return split.x / n >= MIN_X_SHARE;
}

// --- STEP 3: leave-one-vendor-out -------------------------------------------
//
// For a qualifying noun, group its PUT/DELETE/PATCH evidence rows by
// vendor. For each vendor v that contributes at least one such row,
// rebuild qualification using only rows from OTHER vendors (v's rows
// removed entirely) — this is the "qualifies-with-all-data minus v" test.
// A noun "qualifies under LOVO" only if it STILL qualifies with every
// single vendor removed in turn — i.e. no one vendor's rows are propping
// the noun up alone. Separately, for each held-out vendor, report whether
// the noun fires correctly (x-share) on that vendor's OWN rows carrying
// the noun — the held-out transfer check.
function lovoCheck(pdpRows) {
  const byVendor = new Map();
  for (const row of pdpRows) {
    const v = vendorOf(row);
    if (!byVendor.has(v)) byVendor.set(v, []);
    byVendor.get(v).push(row);
  }
  const vendors = [...byVendor.keys()].sort();
  const perVendor = [];
  let survivesEveryHoldout = true;
  for (const v of vendors) {
    const withoutV = pdpRows.filter((row) => vendorOf(row) !== v);
    const qualifiesWithoutV = qualifies(withoutV);
    if (!qualifiesWithoutV) survivesEveryHoldout = false;
    const heldOutRows = byVendor.get(v);
    const heldOutSplit = truthSplit(heldOutRows);
    const heldOutXShare = heldOutRows.length ? heldOutSplit.x / heldOutRows.length : null;
    perVendor.push({
      vendor: v,
      heldOutN: heldOutRows.length,
      heldOutXShare,
      nWithoutV: withoutV.length,
      xShareWithoutV: withoutV.length ? truthSplit(withoutV).x / withoutV.length : null,
      qualifiesWithoutV,
    });
  }
  return { vendors, perVendor, survivesEveryHoldout: vendors.length > 0 && survivesEveryHoldout };
}

// --- STEP 4: score c15-equivalent logic with an extended noun set ----------
//
// Verbatim copy of c15.mjs's liveVerbHit/partyNounHit/classify shape,
// parameterised by nounSet instead of the fixed PARTY_NOUNS/SHARED_NOUNS
// import. Every extraction primitive is imported unchanged from judge.mjs
// / arbiter.mjs / c11.mjs; only "is this word in the party/shared noun
// set" is swapped for a parameter, so this never re-derives or reinterprets
// c15's own matching rules.
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

// Faithful to c15.mjs's partyNounHit: the head-noun checks (summary, then
// operationId) test the FULL noun set (party plus shared), but the third
// fallback — any operationId token — tests SHARED_NOUNS only, never the
// party set. c15 never extends SHARED_NOUNS itself, so tokenSet is always
// the real, unmodified SHARED_NOUNS import, regardless of what headNounSet
// is being swept.
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

function classifyWithNouns(row, nounSet) {
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

  throw new Error(`derive-nouns: unrecognized method "${method}"`);
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
  let exact = 0, goal2Leaks = 0, goal1Errors = 0, overTight = 0;
  for (const row of rows) {
    const predClass = scoreFn(row).class;
    const kind = kindOf(predClass, row.gt_class);
    if (kind === 'exact') exact += 1;
    if (kind === 'overTight') overTight += 1;
    if (isGoal2Leak(predClass, row.gt_class)) goal2Leaks += 1;
    if (isGoal1Error(predClass, row.gt_class)) goal1Errors += 1;
  }
  return { n: rows.length, exact, goal2Leaks, goal1Errors, overTight };
}

// --- markdown helpers --------------------------------------------------------

function mdTable(rows, header) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.map((c) => String(c)).join(' | ')} |`);
  return lines.join('\n');
}

function pct(n, d) {
  if (!d) return 'n/a';
  return `${(100 * n / d).toFixed(1)}%`;
}

// --- main --------------------------------------------------------------------

function main() {
  const allRows = loadAllRows();

  // base-rate for x on PUT/DELETE/PATCH, over the whole corpus.
  const pdpAll = allRows.filter((r) => RAISE_METHODS.has(r.method));
  const pdpAllSplit = truthSplit(pdpAll);
  const baseRateX = pdpAllSplit.x / pdpAll.length;

  // STEP 1: noun table.
  const table = buildNounTable(allRows);

  // STEP 2: rank candidates by qualification.
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

  // STEP 3: LOVO for every qualifying candidate.
  const alreadyKnown = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);
  const lovoResults = qualifying.map((c) => ({
    ...c,
    alreadyKnown: alreadyKnown.has(c.noun),
    lovo: lovoCheck(c.pdpRows),
  }));
  const survivors = lovoResults.filter((c) => c.lovo.survivesEveryHoldout && !c.alreadyKnown);

  // STEP 4: score c15-equivalent logic, before vs after, over all 1478 rows.
  const baseNounSet = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);
  const extendedNounSet = new Set([...baseNounSet, ...survivors.map((c) => c.noun)]);

  // self-check: classifyWithNouns(row, baseNounSet) must reproduce
  // c15.classify(row) exactly, on every row, before any "after" number is
  // trusted.
  let mismatches = 0;
  for (const row of allRows) {
    const a = classifyC15(row).class;
    const b = classifyWithNouns(row, baseNounSet).class;
    if (a !== b) mismatches += 1;
  }
  if (mismatches > 0) {
    throw new Error(`ESCALATE: derive-nouns.mjs's copied classify logic disagrees with c15.classify on ${mismatches} rows — the copy is not faithful, do not trust the "after" numbers.`);
  }

  const beforeAll = scoreRows(allRows, (row) => classifyWithNouns(row, baseNounSet));
  const afterAll = scoreRows(allRows, (row) => classifyWithNouns(row, extendedNounSet));

  const perSetRows = [];
  for (const setName of SETS) {
    const setRows = allRows.filter((r) => r.set === setName);
    if (!setRows.length) continue;
    const before = scoreRows(setRows, (row) => classifyWithNouns(row, baseNounSet));
    const after = scoreRows(setRows, (row) => classifyWithNouns(row, extendedNounSet));
    perSetRows.push([setName, before.n, before.goal2Leaks, after.goal2Leaks, before.goal1Errors, after.goal1Errors, before.overTight, after.overTight, before.exact, after.exact]);
  }

  // STEP 5: the four hinted words.
  const hinted = ['owner', 'credential', 'username', 'password'];
  const hintedReport = hinted.map((word) => {
    const entry = table.get(word);
    if (!entry) return { word, found: false };
    const n = entry.pdpRows.length;
    const split = truthSplit(entry.pdpRows);
    const xShare = n ? split.x / n : 0;
    const qual = qualifies(entry.pdpRows);
    const lovo = qual ? lovoCheck(entry.pdpRows) : null;
    return {
      word, found: true, allCount: entry.allCount, pdpN: n, r: split.r, w: split.w, x: split.x,
      xShare, qualifies: qual, survivesLovo: lovo ? lovo.survivesEveryHoldout : null,
    };
  });

  // --- write markdown ---------------------------------------------------
  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  push('# M1-C18: deriving a party-noun list from the corpus');
  push('');
  push('Measurement only. judge.mjs and c15.mjs are never modified — this file');
  push('copies c15\'s classify logic verbatim (imports every primitive from');
  push('judge.mjs/arbiter.mjs/c11.mjs unchanged) and parameterises only the');
  push('noun Set, so the extended-set scoring is comparable to c15 itself.');
  push(`Self-check: classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS) matched`);
  push(`c15.classify(row) on all ${allRows.length} rows (${mismatches} mismatches) before any`);
  push('"after" number below was trusted.');
  push('');
  push(`All 1478 labelled rows, 6 sets: ${SETS.join(', ')}.`);
  push(`PUT/DELETE/PATCH base rate for truth x: ${pdpAllSplit.x}/${pdpAll.length} = ${pct(pdpAllSplit.x, pdpAll.length)}.`);
  push('');

  push('## Step 1-2: ranked candidate table');
  push('');
  push(`Qualification rule: n >= ${MIN_N} PUT/DELETE/PATCH rows carrying the noun`);
  push(`(as headNounForRow or operationIdHeadNoun), AND x-share >= ${MIN_X_SHARE * 100}%`);
  push('among those rows. Ranked by n (evidence volume) desc, then x-share desc.');
  push('allCount is the whole-corpus count (every method) so rare words stay visible.');
  push('');
  push(mdTable(
    qualifying.map((c) => [
      c.noun, c.allCount, c.pdpN, c.r, c.w, c.x, pct(c.x, c.pdpN),
      c.lift !== null ? `${c.lift.toFixed(2)}x` : 'n/a',
      alreadyKnown.has(c.noun) ? 'yes (PARTY_NOUNS/SHARED_NOUNS)' : 'no',
    ]),
    ['noun', 'allCount (all methods)', 'PDP n', 'r', 'w', 'x', 'x-share', 'lift over base', 'already known'],
  ));
  push('');
  push(`${qualifying.length} nouns qualified.`);
  push('');

  push('## Step 3: leave-one-vendor-out');
  push('');
  push('For each qualifying noun, its PUT/DELETE/PATCH evidence rows are grouped');
  push('by vendor; for each contributing vendor, qualification is rebuilt on the');
  push('OTHER vendors\' rows only. "survives LOVO" = yes only if the noun still');
  push('qualifies with EVERY vendor removed in turn — i.e. no single vendor\'s');
  push('rows are propping it up alone. A noun that only qualifies when its own');
  push('(sole) vendor is included is memorisation, marked below.');
  push('');
  push(mdTable(
    lovoResults.map((c) => [
      c.noun, c.pdpN, [...c.lovo.vendors].join(', '),
      c.lovo.survivesEveryHoldout ? 'yes' : 'no',
      c.alreadyKnown ? 'already known — excluded from candidate set' : (c.lovo.survivesEveryHoldout ? 'NEW candidate — survives' : 'rejected (memorisation)'),
    ]),
    ['noun', 'PDP n', 'vendors', 'survives LOVO', 'verdict'],
  ));
  push('');
  push('Per-vendor detail (qualifying nouns only):');
  push('');
  for (const c of lovoResults) {
    push(`**${c.noun}** (PDP n=${c.pdpN}, x-share=${pct(c.x, c.pdpN)}):`);
    push(mdTable(
      c.lovo.perVendor.map((v) => [
        v.vendor, v.heldOutN, v.heldOutXShare !== null ? pct(v.heldOutXShare * v.heldOutN, v.heldOutN) : 'n/a',
        v.nWithoutV, v.xShareWithoutV !== null ? pct(v.xShareWithoutV * v.nWithoutV, v.nWithoutV) : 'n/a',
        v.qualifiesWithoutV ? 'yes' : 'no',
      ]),
      ['held-out vendor', 'its own n', 'its own x-share', 'n w/o vendor', 'x-share w/o vendor', 'still qualifies w/o it'],
    ));
    push('');
  }

  push(`**${survivors.length} nouns survive LOVO and are new (not already in PARTY_NOUNS/SHARED_NOUNS):**`);
  push(survivors.length ? survivors.map((c) => `\`${c.noun}\``).join(', ') : '(none)');
  push('');

  push('## Step 4: scoring the LOVO-surviving set as an addition to PARTY_NOUNS');
  push('');
  push('Same c15-equivalent logic, whole corpus (all 1478 rows), before (PARTY_NOUNS');
  push('∪ SHARED_NOUNS as-is) vs after (plus the LOVO survivors above). Goal-2 leak =');
  push('truth x predicted w (under-classification). Goal-1 error = truth w predicted x');
  push('(over-classification). over-tight = every predicted-tighter-than-truth row');
  push('(goal-1 errors plus any r->w/x rows).');
  push('');
  push(mdTable(
    [['before', beforeAll.n, beforeAll.goal2Leaks, beforeAll.goal1Errors, beforeAll.overTight, beforeAll.exact],
     ['after', afterAll.n, afterAll.goal2Leaks, afterAll.goal1Errors, afterAll.overTight, afterAll.exact]],
    ['', 'n', 'goal-2 leaks (x->w)', 'goal-1 errors (w->x)', 'total over-tight', 'exact'],
  ));
  push('');
  push('Per-set:');
  push('');
  push(mdTable(perSetRows, ['set', 'n', 'leaks before', 'leaks after', 'goal-1 before', 'goal-1 after', 'over-tight before', 'over-tight after', 'exact before', 'exact after']));
  push('');

  push('## Step 5: owner, credential, username, password');
  push('');
  push('Checked with no hinting — whatever the derivation above found on its own.');
  push('');
  for (const h of hintedReport) {
    if (!h.found) {
      push(`- **${h.word}**: not found as a head noun anywhere in the 1478-row corpus. The corpus does not support it — that is a finding, not a failure.`);
    } else {
      const qualLine = h.qualifies
        ? `qualifies (n=${h.pdpN}, x-share=${pct(h.x, h.pdpN)})${h.survivesLovo === null ? '' : h.survivesLovo ? ', survives LOVO' : ', REJECTED under LOVO (memorisation)'}`
        : `does not qualify (PDP n=${h.pdpN}, x-share=${pct(h.x, h.pdpN)}, whole-corpus count=${h.allCount})`;
      push(`- **${h.word}**: ${qualLine}.`);
    }
  }
  push('');

  push('## Plain-English summary');
  push('');
  push(`Of ${qualifying.length} nouns that clear n>=${MIN_N} and x-share>=${MIN_X_SHARE * 100}% on`);
  push('PUT/DELETE/PATCH rows, the data supports adding these words to PARTY_NOUNS');
  push('(they survive leave-one-vendor-out, so no single vendor is carrying the');
  push('evidence alone):');
  push(survivors.length ? survivors.map((c) => `\`${c.noun}\``).join(', ') : '(none survive)');
  push('');
  push(`Adding them changes the whole-corpus score from ${beforeAll.goal2Leaks} goal-2 leaks / `
    + `${beforeAll.goal1Errors} goal-1 errors to ${afterAll.goal2Leaks} goal-2 leaks / `
    + `${afterAll.goal1Errors} goal-1 errors.`);
  push('');
  push('Of the four hinted words (owner, credential, username, password), the');
  push(`data on its own supports: ${hintedReport.filter((h) => h.found && h.qualifies && h.survivesLovo).map((h) => h.word).join(', ') || '(none)'}.`);

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD}`);
}

main();
