// M1-C11v: variation sweep on top of the C11 "floor + raise-only" shape.
//
// scoreV(row, cfg) generalises run-c11.mjs's scoreC11 into a pure, fully
// configurable scorer (see the cfg fields documented on scoreV below). This
// file does not import scoreC11 and does not modify run-c11.mjs — run-c11.mjs
// exports only scoreC11 (nothing else useful to reuse directly), so the
// loading/join, classify() and table-formatting helpers below are copies of
// run-c11.mjs's private helpers, kept behaviourally identical.
//
// ADMISSION NOTE: admission (whether a variation is worth keeping) is judged
// on camara + holdout1 only. holdout2 is scored and printed for every run,
// but it is NEVER used to decide anything here — it is a still-unseen "clean
// exam" set per the project's D24 rule (tune/fit only on camara + holdout1).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../../m0/csv.mjs';
import { CLASS_ORDER, methodPrior, leadVerbForRow, tokensForRow } from './arbiter.mjs';
import {
  LIVE_VERBS,
  OWN_VERBS,
  PARTY_NOUNS,
  headNounForRow,
  operationIdHeadNoun,
  summaryLeadVerb,
  summaryHasCallerPhrase,
  isCallerShapedPath,
  naiveSingular,
  fallbackVerbFromSummary,
} from './judge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
const TEXT_PATH = path.join(REPO_ROOT, 'docs/logs/m1/ops-text.csv');
const OUT_ROWS = path.join(REPO_ROOT, 'docs/logs/m1/c11v-rows.csv');
const OUT_SWEEP = path.join(REPO_ROOT, 'docs/logs/m1/c11v-sweep.md');

const SETS = ['camara', 'holdout1', 'holdout2'];
const ADMISSION_SETS = ['camara', 'holdout1'];

// Variant B's hand list (run-c11.mjs, verbatim) — copied here, not imported,
// since run-c11.mjs does not export it.
const C11_READ_VERBS = new Set([
  'retrieve', 'verify', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'validate', 'count', 'lookup', 'assess', 'find',
]);

// --- V1-baseline defaults ----------------------------------------------------

const DEFAULT_LIVE_VERBS = new Set(LIVE_VERBS);
const DEFAULT_PARTY_NOUNS = new Set([...PARTY_NOUNS, 'repository']);
const DEFAULT_READ_VERBS = new Set([...C11_READ_VERBS].filter((w) => w !== 'validate'));

// --- pure scoring function --------------------------------------------------

function isInSet(word, set) {
  return word !== '' && set.has(word);
}

// party-noun hit for a row, given a party-noun source policy. Returns
// { hit, source, word } | { hit: false }.
function partyHit(row, partyNouns, partySource) {
  const summaryNoun = headNounForRow(row);
  const opidNoun = operationIdHeadNoun(row);
  const summaryIsParty = isInSet(summaryNoun, partyNouns);
  const opidIsParty = isInSet(opidNoun, partyNouns);

  if (partySource === 'summary') {
    return summaryIsParty ? { hit: true, source: 'summary', word: summaryNoun } : { hit: false };
  }
  if (partySource === 'opid') {
    return opidIsParty ? { hit: true, source: 'opid', word: opidNoun } : { hit: false };
  }
  // 'both' and 'anytoken' both check the two head nouns first, in the same
  // order as run-c11.mjs's scoreC11 (summary head noun, then opid head noun).
  if (summaryIsParty) return { hit: true, source: 'summary', word: summaryNoun };
  if (opidIsParty) return { hit: true, source: 'opid', word: opidNoun };
  if (partySource === 'anytoken') {
    const { tokens } = tokensForRow(row);
    for (const t of tokens) {
      const tok = naiveSingular(t.toLowerCase());
      if (isInSet(tok, partyNouns)) return { hit: true, source: 'anytoken', word: tok };
    }
  }
  return { hit: false };
}

// True when the row's summary/opid head noun is a party noun under the
// GIVEN partyNouns set, checked with the fixed 'both' policy (summary OR
// opid) regardless of the row's own partySource cfg — used only by
// patch-own/post-own, which per the brief always look at "head noun
// (summary or opid)", not the row's configured party source.
function headNounIsParty(row, partyNouns) {
  const summaryNoun = headNounForRow(row);
  const opidNoun = operationIdHeadNoun(row);
  return isInSet(summaryNoun, partyNouns) || isInSet(opidNoun, partyNouns);
}

// scoreV(row, cfg) -> { class, rule, evidence[] }
//
// cfg (all optional, default to the V1-baseline value in brackets):
//   liveVerbs    Set  [LIVE_VERBS]
//   partyNouns   Set  [PARTY_NOUNS plus 'repository']
//   readVerbs    Set  [C11's READ_VERBS minus 'validate']
//   readListOn   bool [true]  — POST lower to r when leadVerbForRow is a
//                readVerbs hit.
//   readSummaryOn bool [false] — POST lower to r when the summary's lead
//                word (fallbackVerbFromSummary, singularised via
//                summaryLeadVerb) is a readVerbs hit AND nothing raised.
//   callerPhraseOn bool [true] — summaryHasCallerPhrase suppresses the
//                party-noun raise.
//   callerPathOn bool [false] — isCallerShapedPath(row.path) also
//                suppresses the party-noun raise.
//   partySource  'both'|'summary'|'opid'|'anytoken' ['both'] — which noun
//                source(s) feed the party raise.
//   patchOwnOn   bool [false] — PATCH, nothing raised, leadVerbForRow in
//                OWN_VERBS, head noun (summary or opid) not party -> w,
//                rule 'patch-own'.
//   postOwnOn    bool [false] — same, POST -> w, rule 'post-own'. The
//                read-verb checks run first, so post-own only fires when
//                they did not.
//
// Rule order: locked GET/HEAD/OPTIONS -> r; live-verb raise; party-noun
// raise (PUT/DELETE/PATCH, subject to caller suppression); read-verb lower
// (POST); patch-own / post-own lowers; else floor.
export function scoreV(row, cfg = {}) {
  const liveVerbs = cfg.liveVerbs || DEFAULT_LIVE_VERBS;
  const partyNouns = cfg.partyNouns || DEFAULT_PARTY_NOUNS;
  const readVerbs = cfg.readVerbs || DEFAULT_READ_VERBS;
  const readListOn = cfg.readListOn !== false;
  const readSummaryOn = cfg.readSummaryOn === true;
  const callerPhraseOn = cfg.callerPhraseOn !== false;
  const callerPathOn = cfg.callerPathOn === true;
  const partySource = cfg.partySource || 'both';
  const patchOwnOn = cfg.patchOwnOn === true;
  const postOwnOn = cfg.postOwnOn === true;

  const method = row.method;

  // 1. floor = method prior; GET/HEAD/OPTIONS locked at r, done.
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { class: 'r', rule: 'floor', evidence: [] };
  }
  const prior = methodPrior(method);
  const extraEvidence = [];

  // 2. live-verb raise, any method.
  const { tokens } = tokensForRow(row);
  let opidLiveTok = null;
  for (const t of tokens) {
    const tok = t.toLowerCase();
    if (isInSet(tok, liveVerbs)) { opidLiveTok = tok; break; }
  }
  if (opidLiveTok) {
    return { class: 'x', rule: 'live-verb', evidence: [`opid:${opidLiveTok}`] };
  }
  const sLeadVerb = summaryLeadVerb(row);
  if (isInSet(sLeadVerb, liveVerbs)) {
    return { class: 'x', rule: 'live-verb', evidence: [`summary:${sLeadVerb}`] };
  }

  // 3. party-noun raise, PUT/DELETE/PATCH only (POST is already x from the
  // floor, so it never reaches this check).
  if (method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const party = partyHit(row, partyNouns, partySource);
    if (party.hit) {
      let suppressed = false;
      if (callerPhraseOn && summaryHasCallerPhrase(row.summary)) {
        suppressed = true;
        extraEvidence.push('caller-phrase');
      }
      if (callerPathOn && isCallerShapedPath(row.path)) {
        suppressed = true;
        extraEvidence.push('caller-path');
      }
      if (!suppressed) {
        return { class: 'x', rule: 'party-noun', evidence: [`${party.source}:${party.word}`] };
      }
    }
  }

  // 4. read-verb lower, POST only.
  if (method === 'POST') {
    if (readListOn) {
      const verb = leadVerbForRow(row);
      if (isInSet(verb, readVerbs)) {
        return { class: 'r', rule: 'read-verb', evidence: [`opid:${verb}`, ...extraEvidence] };
      }
    }
    if (readSummaryOn) {
      const sVerb = summaryLeadVerb(row);
      if (isInSet(sVerb, readVerbs)) {
        return { class: 'r', rule: 'read-verb', evidence: [`summary:${sVerb}`, ...extraEvidence] };
      }
    }
  }

  // 5. patch-own / post-own lowers — only reached when nothing above raised
  // or lowered this row.
  if (patchOwnOn && method === 'PATCH') {
    const verb = leadVerbForRow(row);
    if (isInSet(verb, OWN_VERBS) && !headNounIsParty(row, partyNouns)) {
      return { class: 'w', rule: 'patch-own', evidence: [`opid:${verb}`, ...extraEvidence] };
    }
  }
  if (postOwnOn && method === 'POST') {
    const verb = leadVerbForRow(row);
    if (isInSet(verb, OWN_VERBS) && !headNounIsParty(row, partyNouns)) {
      return { class: 'w', rule: 'post-own', evidence: [`opid:${verb}`, ...extraEvidence] };
    }
  }

  // 6. else: floor.
  return { class: prior, rule: 'floor', evidence: extraEvidence };
}

// --- I/O + table helpers (copies of run-c11.mjs's private helpers; that
// file exports nothing else, so these are duplicated rather than imported) --

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

function mdTable(rows, header) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.map((c) => String(c)).join(' | ')} |`);
  return lines.join('\n');
}

function classify(predClass, gtClass) {
  const predIdx = CLASS_ORDER[predClass];
  const truthIdx = CLASS_ORDER[gtClass];
  if (predIdx < truthIdx) return 'leak';
  if (predIdx > truthIdx) return 'overTight';
  return 'exact';
}

function truncate(s, n) {
  const str = s || '';
  return str.length > n ? str.slice(0, n) + '...' : str;
}

function loadRows() {
  const censusRows = parseCsv(readFileSync(CENSUS_PATH, 'utf8'));
  const textRows = parseCsv(readFileSync(TEXT_PATH, 'utf8'));

  const requiredCensusCols = ['set', 'repo', 'path', 'method', 'operationId', 'gt_class'];
  const censusHeader = censusRows.length ? Object.keys(censusRows[0]) : [];
  for (const col of requiredCensusCols) {
    if (!censusHeader.includes(col)) throw new Error(`ESCALATE: census-ops.csv is missing required column "${col}"`);
  }

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
  return censusRows;
}

// --- sweep machinery ---------------------------------------------------------

function scoreAll(censusRows, cfg) {
  const map = new Map();
  for (const row of censusRows) map.set(row, scoreV(row, cfg));
  return map;
}

function perSetSummary(censusRows, scored) {
  const rows = [];
  const counts = {};
  for (const setName of SETS) {
    const setRows = censusRows.filter((r) => r.set === setName);
    const n = setRows.length;
    let exact = 0, leaks = 0, overTight = 0;
    for (const row of setRows) {
      const result = scored.get(row);
      const kind = classify(result.class, row.gt_class);
      if (kind === 'leak') leaks += 1;
      else if (kind === 'overTight') overTight += 1;
      else exact += 1;
    }
    const leakPct = n ? ((leaks / n) * 100).toFixed(1) : '0.0';
    const overTightPct = n ? ((overTight / n) * 100).toFixed(1) : '0.0';
    rows.push([setName, n, exact, leaks, overTight, leakPct, overTightPct]);
    counts[setName] = { n, exact, leaks, overTight };
  }
  return { rows, counts };
}

function admissionCounts(censusRows, scored) {
  let leaks = 0, overTight = 0;
  for (const row of censusRows) {
    if (!ADMISSION_SETS.includes(row.set)) continue;
    const result = scored.get(row);
    const kind = classify(result.class, row.gt_class);
    if (kind === 'leak') leaks += 1;
    else if (kind === 'overTight') overTight += 1;
  }
  return { leaks, overTight };
}

function leakingRows(censusRows, scored) {
  return censusRows.filter((row) => {
    const result = scored.get(row);
    return classify(result.class, row.gt_class) === 'leak';
  }).map((row) => ({ row, result: scored.get(row) }));
}

function changedRows(censusRows, baseScored, newScored) {
  return censusRows.filter((row) => baseScored.get(row).class !== newScored.get(row).class)
    .map((row) => ({ row, base: baseScored.get(row), neu: newScored.get(row) }));
}

const SUMMARY_HEADER = ['set', 'n', 'exact', 'leaks', 'over_tight', 'leak_pct', 'over_tight_pct'];

function leakRowsTable(leaking) {
  const rows = leaking.map(({ row, result }) => [
    row.set, row.repo, row.method, row.path, row.operationId || '(empty)',
    row.gt_class, result.class, result.rule, result.evidence.join(';'),
    truncate(row.summary, 70),
  ]);
  return mdTable(rows, ['set', 'repo', 'method', 'path', 'operationId', 'gt', 'pred', 'rule', 'evidence', 'summary']);
}

function changedRowsTable(changed) {
  const rows = changed.map(({ row, base, neu }) => [
    row.set, row.repo, row.method, row.path, row.operationId || '(empty)',
    row.gt_class, base.class, neu.class, neu.evidence.join(';'),
    truncate(row.summary, 70),
  ]);
  return mdTable(rows, ['set', 'repo', 'method', 'path', 'operationId', 'gt', 'pred_v1', 'pred_new', 'evidence', 'summary']);
}

function main() {
  const censusRows = loadRows();

  // --- V1 baseline ---
  const V1_CFG = {
    liveVerbs: DEFAULT_LIVE_VERBS,
    partyNouns: DEFAULT_PARTY_NOUNS,
    readVerbs: DEFAULT_READ_VERBS,
    readListOn: true,
    readSummaryOn: false,
    callerPhraseOn: true,
    callerPathOn: false,
    partySource: 'both',
    patchOwnOn: false,
    postOwnOn: false,
  };
  const v1Scored = scoreAll(censusRows, V1_CFG);
  const v1Summary = perSetSummary(censusRows, v1Scored);
  const v1Admission = admissionCounts(censusRows, v1Scored);
  const v1Leaking = leakingRows(censusRows, v1Scored);

  console.log('=== V1 baseline ===');
  console.log(fmtRows(v1Summary.rows, SUMMARY_HEADER));
  console.log('');

  const sweepLines = [];
  sweepLines.push('# M1-C11v: variation sweep on the C11 floor + raise-only shape');
  sweepLines.push('');
  sweepLines.push('scoreV(row, cfg) generalises run-c11.mjs\'s scoreC11 (see the doc comment on');
  sweepLines.push('scoreV in poc/m1/arbiter/run-c11v.mjs for the full cfg field list). run-c11.mjs');
  sweepLines.push('is not modified.');
  sweepLines.push('');
  sweepLines.push('**Admission is judged on camara + holdout1 only.** holdout2 is scored and');
  sweepLines.push('printed for every run below, but it is never used to decide anything — it is');
  sweepLines.push('the still-unseen "clean exam" set (D24: tune/fit only on camara + holdout1,');
  sweepLines.push('holdout2 scored once per rule change and never used to pick shapes).');
  sweepLines.push('');
  sweepLines.push('## V1 baseline');
  sweepLines.push('');
  sweepLines.push('Defaults: liveVerbs=LIVE_VERBS, partyNouns=PARTY_NOUNS+repository,');
  sweepLines.push('readVerbs=C11 READ_VERBS minus validate, readListOn=true, readSummaryOn=false,');
  sweepLines.push('callerPhraseOn=true, callerPathOn=false, partySource=both, patchOwnOn=false,');
  sweepLines.push('postOwnOn=false.');
  sweepLines.push('');
  sweepLines.push(mdTable(v1Summary.rows, SUMMARY_HEADER));
  sweepLines.push('');
  sweepLines.push(`### V1 leaking rows — ${v1Leaking.length} rows`);
  sweepLines.push('');
  sweepLines.push(v1Leaking.length ? leakRowsTable(v1Leaking) : '(none)');
  sweepLines.push('');

  // --- V3-V8 named runs -------------------------------------------------------
  const runs = [
    {
      name: 'V3a', desc: 'readVerbs += get (readSummaryOn off)',
      cfg: { ...V1_CFG, readVerbs: new Set([...DEFAULT_READ_VERBS, 'get']) },
    },
    {
      name: 'V3b', desc: 'readSummaryOn=true (readVerbs unchanged)',
      cfg: { ...V1_CFG, readSummaryOn: true },
    },
    {
      name: 'V3c', desc: 'readVerbs += get, readSummaryOn=true',
      cfg: { ...V1_CFG, readVerbs: new Set([...DEFAULT_READ_VERBS, 'get']), readSummaryOn: true },
    },
    { name: 'V4', desc: 'callerPathOn=true', cfg: { ...V1_CFG, callerPathOn: true } },
    { name: 'V5', desc: "partySource='anytoken'", cfg: { ...V1_CFG, partySource: 'anytoken' } },
    { name: 'V6a', desc: "partySource='summary'", cfg: { ...V1_CFG, partySource: 'summary' } },
    { name: 'V6b', desc: "partySource='opid'", cfg: { ...V1_CFG, partySource: 'opid' } },
    { name: 'V7', desc: 'patchOwnOn=true', cfg: { ...V1_CFG, patchOwnOn: true } },
    { name: 'V8', desc: 'postOwnOn=true', cfg: { ...V1_CFG, postOwnOn: true } },
  ];

  const runResults = new Map(); // name -> { scored, summary, admission, leaking, changed }
  for (const run of runs) {
    const scored = scoreAll(censusRows, run.cfg);
    const summary = perSetSummary(censusRows, scored);
    const admission = admissionCounts(censusRows, scored);
    const leaking = leakingRows(censusRows, scored);
    const changed = changedRows(censusRows, v1Scored, scored);
    runResults.set(run.name, { scored, summary, admission, leaking, changed });

    console.log(`=== ${run.name}: ${run.desc} ===`);
    console.log(fmtRows(summary.rows, SUMMARY_HEADER));
    for (const setName of SETS) {
      const b = v1Summary.counts[setName];
      const n = summary.counts[setName];
      console.log(`  delta vs V1 (${setName}): leaks ${n.leaks - b.leaks >= 0 ? '+' : ''}${n.leaks - b.leaks}, over_tight ${n.overTight - b.overTight >= 0 ? '+' : ''}${n.overTight - b.overTight}`);
    }
    console.log(`  rows changed vs V1: ${changed.length}`);
    console.log('');

    sweepLines.push(`## ${run.name}: ${run.desc}`);
    sweepLines.push('');
    sweepLines.push(mdTable(summary.rows, SUMMARY_HEADER));
    sweepLines.push('');
    sweepLines.push('Delta vs V1:');
    sweepLines.push('');
    for (const setName of SETS) {
      const b = v1Summary.counts[setName];
      const n = summary.counts[setName];
      sweepLines.push(`- ${setName}: leaks ${n.leaks - b.leaks >= 0 ? '+' : ''}${n.leaks - b.leaks}, over_tight ${n.overTight - b.overTight >= 0 ? '+' : ''}${n.overTight - b.overTight}`);
    }
    sweepLines.push('');
    sweepLines.push(`### ${run.name} rows changed vs V1 — ${changed.length} rows`);
    sweepLines.push('');
    sweepLines.push(changed.length ? changedRowsTable(changed) : '(none)');
    sweepLines.push('');
    sweepLines.push(`### ${run.name} leaking rows — ${leaking.length} rows`);
    sweepLines.push('');
    sweepLines.push(leaking.length ? leakRowsTable(leaking) : '(none)');
    sweepLines.push('');
  }

  // --- V2: leave-one-word-out sweep -------------------------------------------
  // Attribute each V1 raise to the single word that produced it, by parsing
  // scoreV's own evidence string (word after the ':').
  const liveHits = new Map(); // word -> count
  const partyHits = new Map(); // word -> count
  for (const row of censusRows) {
    const result = v1Scored.get(row);
    if (result.rule === 'live-verb') {
      const word = result.evidence[0].split(':')[1];
      liveHits.set(word, (liveHits.get(word) || 0) + 1);
    } else if (result.rule === 'party-noun') {
      const word = result.evidence[0].split(':')[1];
      partyHits.set(word, (partyHits.get(word) || 0) + 1);
    }
  }

  const v2Rows = [];
  const zeroHitWords = [];
  function runLeaveOneOut(word, source, hits) {
    if (hits === 0) {
      zeroHitWords.push(`${source}:${word}`);
      return;
    }
    let cfg;
    if (source === 'live') {
      const liveVerbs = new Set(DEFAULT_LIVE_VERBS);
      liveVerbs.delete(word);
      cfg = { ...V1_CFG, liveVerbs };
    } else {
      const partyNouns = new Set(DEFAULT_PARTY_NOUNS);
      partyNouns.delete(word);
      cfg = { ...V1_CFG, partyNouns };
    }
    const scored = scoreAll(censusRows, cfg);
    const admission = admissionCounts(censusRows, scored);
    const leaksAdded = admission.leaks - v1Admission.leaks;
    const overTightRemoved = v1Admission.overTight - admission.overTight;
    v2Rows.push({ word, source, hits, leaksAdded, overTightRemoved });
  }
  for (const word of DEFAULT_LIVE_VERBS) runLeaveOneOut(word, 'live', liveHits.get(word) || 0);
  for (const word of DEFAULT_PARTY_NOUNS) runLeaveOneOut(word, 'party', partyHits.get(word) || 0);

  v2Rows.sort((a, b) => (b.leaksAdded - a.leaksAdded) || (b.overTightRemoved - a.overTightRemoved));

  const v2Header = ['word', 'source', 'hits', 'leaks_added', 'over_tight_removed'];
  const v2TableRows = v2Rows.map((r) => [r.word, r.source, r.hits, r.leaksAdded, r.overTightRemoved]);
  console.log('=== V2: leave-one-word-out (admission scope: camara+holdout1) ===');
  console.log(fmtRows(v2TableRows, v2Header));
  console.log(`zero-hit words (${zeroHitWords.length}): ${zeroHitWords.join(', ')}`);
  console.log('');

  sweepLines.push('## V2: leave-one-word-out');
  sweepLines.push('');
  sweepLines.push('For every word in liveVerbs and partyNouns (V1 defaults), V1 rerun with that');
  sweepLines.push('one word removed from its own list. hits = rows that word resolved (was the');
  sweepLines.push('evidence word for) in V1, all sets. leaks_added/over_tight_removed are measured');
  sweepLines.push('on the admission scope (camara+holdout1) only. Sorted by leaks_added desc, then');
  sweepLines.push('over_tight_removed desc.');
  sweepLines.push('');
  sweepLines.push(mdTable(v2TableRows, v2Header));
  sweepLines.push('');
  sweepLines.push(`Zero-hit words (${zeroHitWords.length}, not run, not in the table above): ${zeroHitWords.join(', ')}`);
  sweepLines.push('');

  writeFileSync(OUT_SWEEP, sweepLines.join('\n') + '\n');

  // --- rows CSV: V1 prediction plus one column per named run ---
  const outRows = censusRows.map((row) => {
    const base = v1Scored.get(row);
    const out = {
      set: row.set,
      repo: row.repo,
      method: row.method,
      path: row.path,
      operationId: row.operationId,
      gt_class: row.gt_class,
      pred_v1: base.class,
      rule_v1: base.rule,
      evidence_v1: base.evidence.join(';'),
    };
    for (const run of runs) {
      out[`pred_${run.name}`] = runResults.get(run.name).scored.get(row).class;
    }
    return out;
  });
  const outHeader = ['set', 'repo', 'method', 'path', 'operationId', 'gt_class', 'pred_v1', 'rule_v1', 'evidence_v1', ...runs.map((r) => `pred_${r.name}`)];
  writeFileSync(OUT_ROWS, toCsv(outRows, outHeader));

  console.log(`Wrote ${OUT_SWEEP}`);
  console.log(`Wrote ${OUT_ROWS}`);
}

main();
