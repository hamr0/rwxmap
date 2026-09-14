// M1-C11 V9: APIs.guru corpus as a CANDIDATE MAKER for the live-verb list,
// not as a lookup (that was V-something-else's job; this file never scores
// a row against the corpus directly — it only uses corpus stats to propose
// new words for LIVE_VERBS, then scores those proposals the normal way,
// through scoreV, on the labelled rows).
//
// Reuses run-c11v.mjs's scoreV (exported) unmodified, and copies the
// handful of private loader/table helpers that file does not export
// (loadRows, fmtRows, mdTable, classify, truncate) rather than editing that
// file, per the brief. run-c11v.mjs is not touched.
//
// Step 1 (candidate making): read docs/logs/m1/corpus-leans.csv, position
// == 'lead' rows only. For each token with providers >= 10, compute
// postShare = perprov_post / (sum of all seven perprov_* columns). Drop any
// token already in LIVE_VERBS, OWN_VERBS, or run-c11v.mjs's V1 readVerbs
// default (C11's READ_VERBS minus 'validate') — those already have a job in
// the arbiter — plus HTTP method words and a short stopword list. Rank the
// rest by postShare desc, then providers desc. Print the top 40 with, per
// token, how many labelled rows (camara+holdout1+holdout2, tokensForRow-style
// token set) it hits, split by gt class. This table is for hand review only.
//
// Step 2 (scoring): three candidate-verb-list runs on top of the V1+'get'
// config (V1 defaults from run-c11v.mjs, readVerbs = C11 READ_VERBS minus
// validate, plus 'get') — liveVerbs = LIVE_VERBS plus the top 10/20/40
// candidates with postShare >= 0.6 (a candidate below that bar never enters
// any run, so a run may end up with fewer than its nominal N words; this is
// reported, not silently padded). Admission is judged on camara + holdout1
// only, per D24; holdout2 is scored and printed for every run but never
// used to decide.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from '../../m0/csv.mjs';
import { CLASS_ORDER, tokensForRow } from './arbiter.mjs';
import { LIVE_VERBS, OWN_VERBS } from './judge.mjs';
import { scoreV } from './run-c11v.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
const TEXT_PATH = path.join(REPO_ROOT, 'docs/logs/m1/ops-text.csv');
const CORPUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/corpus-leans.csv');
const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c11-v9.md');

const SETS = ['camara', 'holdout1', 'holdout2'];
const ADMISSION_SETS = ['camara', 'holdout1'];
const PERPROV_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

// --- copies of run-c11v.mjs's private helpers (that file exports only
// scoreV; these are duplicated rather than imported, per the brief) --------

const C11_READ_VERBS = new Set([
  'retrieve', 'verify', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'validate', 'count', 'lookup', 'assess', 'find',
]);
const DEFAULT_READ_VERBS = new Set([...C11_READ_VERBS].filter((w) => w !== 'validate'));
const READ_VERBS_PLUS_GET = new Set([...DEFAULT_READ_VERBS, 'get']);

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

// --- step 1: candidate making ----------------------------------------------

const STOPWORDS = new Set(['a', 'an', 'the', 'to', 'of', 'for', 'and', 'by', 'is', 'are']);
const HTTP_METHOD_WORDS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

function buildExclusionSet() {
  const s = new Set();
  for (const w of LIVE_VERBS) s.add(w);
  for (const w of OWN_VERBS) s.add(w);
  for (const w of DEFAULT_READ_VERBS) s.add(w);
  for (const w of HTTP_METHOD_WORDS) s.add(w);
  for (const w of STOPWORDS) s.add(w);
  return s;
}

function loadCandidates() {
  const corpusRows = parseCsv(readFileSync(CORPUS_PATH, 'utf8'));
  const leadRows = corpusRows.filter((r) => r.position === 'lead');
  const exclusion = buildExclusionSet();

  const candidates = [];
  for (const row of leadRows) {
    const providers = Number(row.providers);
    if (!Number.isFinite(providers) || providers < 10) continue;
    const token = (row.token || '').trim().toLowerCase();
    if (!token || exclusion.has(token)) continue;
    let perprovSum = 0;
    for (const m of PERPROV_METHODS) perprovSum += Number(row[`perprov_${m}`] || 0);
    const postShare = perprovSum > 0 ? Number(row.perprov_post || 0) / perprovSum : 0;
    candidates.push({ token, providers, opsTotal: Number(row.ops_total || 0), postShare });
  }
  candidates.sort((a, b) => (b.postShare - a.postShare) || (b.providers - a.providers));
  return candidates;
}

// token -> { r, w, x } counts over ALL labelled rows (camara+holdout1+holdout2),
// via each row's tokensForRow-style token set (arbiter.mjs's own tokenizer).
function buildTokenHitIndex(censusRows) {
  const index = new Map();
  for (const row of censusRows) {
    const { tokens } = tokensForRow(row);
    const seen = new Set(tokens.map((t) => t.toLowerCase()));
    for (const tok of seen) {
      if (!index.has(tok)) index.set(tok, { r: 0, w: 0, x: 0 });
      const counts = index.get(tok);
      if (row.gt_class === 'r' || row.gt_class === 'w' || row.gt_class === 'x') {
        counts[row.gt_class] += 1;
      }
    }
  }
  return index;
}

// --- main --------------------------------------------------------------

function main() {
  const censusRows = loadRows();
  const mdLines = [];

  mdLines.push('# M1-C11 V9: APIs.guru corpus as a candidate maker for LIVE_VERBS');
  mdLines.push('');
  mdLines.push('scoreV(row, cfg) is run-c11v.mjs\'s scorer, imported unmodified. This file');
  mdLines.push('does not score against the corpus directly — it only uses corpus lead-token');
  mdLines.push('stats to PROPOSE new LIVE_VERBS candidates, then scores those proposals on');
  mdLines.push('the labelled rows the normal way. run-c11v.mjs is not modified.');
  mdLines.push('');
  mdLines.push('**Admission is judged on camara + holdout1 only.** holdout2 is scored and');
  mdLines.push('printed for every run below, but it is never used to decide anything (D24).');
  mdLines.push('');

  // --- step 1: candidates ---
  const candidates = loadCandidates();
  const hitIndex = buildTokenHitIndex(censusRows);
  const top40 = candidates.slice(0, 40);

  const candHeader = ['token', 'providers', 'ops_total', 'postShare', 'n_r', 'n_w', 'n_x'];
  const candRows = top40.map((c) => {
    const hits = hitIndex.get(c.token) || { r: 0, w: 0, x: 0 };
    return [c.token, c.providers, c.opsTotal, c.postShare.toFixed(3), hits.r, hits.w, hits.x];
  });

  console.log('=== Step 1: top 40 corpus candidates for LIVE_VERBS (postShare desc, providers desc) ===');
  console.log(fmtRows(candRows, candHeader));
  console.log(`(${candidates.length} candidates total after providers>=10 + exclusions)`);
  console.log('');

  mdLines.push('## Step 1: candidate table (top 40)');
  mdLines.push('');
  mdLines.push('position==\'lead\' rows only, providers >= 10, excluding tokens already in');
  mdLines.push('LIVE_VERBS, OWN_VERBS, run-c11v.mjs\'s V1 readVerbs (C11 READ_VERBS minus');
  mdLines.push('validate), HTTP method words, and a short stopword list (a, an, the, to, of,');
  mdLines.push('for, and, by, is, are). postShare = perprov_post / sum(all seven perprov_*).');
  mdLines.push('n_r/n_w/n_x = count of labelled rows (camara+holdout1+holdout2) whose');
  mdLines.push('tokensForRow token set contains this token, split by gt class.');
  mdLines.push('');
  mdLines.push(`${candidates.length} candidates total after providers>=10 + exclusions.`);
  mdLines.push('');
  mdLines.push(mdTable(candRows, candHeader));
  mdLines.push('');

  // --- step 2: scoring ---
  const qualifying = candidates.filter((c) => c.postShare >= 0.6);
  console.log(`Qualifying candidates (postShare >= 0.6): ${qualifying.length}`);
  console.log('');
  mdLines.push(`Qualifying candidates (postShare >= 0.6) for the scoring runs below: ${qualifying.length}.`);
  mdLines.push('');

  const V1_PLUS_GET_CFG = {
    // liveVerbs, partyNouns: left at scoreV's own V1 defaults.
    readVerbs: READ_VERBS_PLUS_GET,
    readListOn: true,
    readSummaryOn: false,
    callerPhraseOn: true,
    callerPathOn: false,
    partySource: 'both',
    patchOwnOn: false,
    postOwnOn: false,
  };

  function scoreAll(cfg) {
    const map = new Map();
    for (const row of censusRows) map.set(row, scoreV(row, cfg));
    return map;
  }

  function perSetSummary(scored) {
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

  function leakingRows(scored) {
    return censusRows.filter((row) => classify(scored.get(row).class, row.gt_class) === 'leak')
      .map((row) => ({ row, result: scored.get(row) }));
  }

  function changedRows(baseScored, newScored) {
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
    return mdTable(rows, ['set', 'repo', 'method', 'path', 'operationId', 'gt', 'pred_before', 'pred_after', 'evidence', 'summary70']);
  }

  // baseline: V1 + get
  const baseScored = scoreAll(V1_PLUS_GET_CFG);
  const baseSummary = perSetSummary(baseScored);

  console.log('=== Baseline: V1 + get (readVerbs += get) ===');
  console.log(fmtRows(baseSummary.rows, SUMMARY_HEADER));
  console.log('');

  mdLines.push('## Baseline: V1 + get');
  mdLines.push('');
  mdLines.push('V1 defaults from run-c11v.mjs (liveVerbs=LIVE_VERBS, partyNouns=PARTY_NOUNS+');
  mdLines.push('repository, readListOn=true, readSummaryOn=false, callerPhraseOn=true,');
  mdLines.push('callerPathOn=false, partySource=both, patchOwnOn=false, postOwnOn=false),');
  mdLines.push('readVerbs = C11 READ_VERBS minus validate, plus \'get\'.');
  mdLines.push('');
  mdLines.push(mdTable(baseSummary.rows, SUMMARY_HEADER));
  mdLines.push('');

  const runSpecs = [
    { n: 10, label: 'top 10' },
    { n: 20, label: 'top 20' },
    { n: 40, label: 'top 40' },
  ];

  for (const spec of runSpecs) {
    const picked = qualifying.slice(0, spec.n);
    const shortfallNote = picked.length < spec.n
      ? `only ${picked.length} of ${spec.n} qualify (postShare >= 0.6)`
      : `${picked.length} words used`;
    const liveVerbs = new Set([...LIVE_VERBS, ...picked.map((c) => c.token)]);
    const cfg = { ...V1_PLUS_GET_CFG, liveVerbs };
    const scored = scoreAll(cfg);
    const summary = perSetSummary(scored);
    const leaking = leakingRows(scored);
    const changed = changedRows(baseScored, scored);

    let admissionLeaksDelta = 0, admissionOverTightDelta = 0;
    for (const setName of ADMISSION_SETS) {
      const b = baseSummary.counts[setName];
      const n2 = summary.counts[setName];
      admissionLeaksDelta += n2.leaks - b.leaks;
      admissionOverTightDelta += n2.overTight - b.overTight;
    }

    console.log(`=== Run: liveVerbs + ${spec.label} corpus candidates (${shortfallNote}) ===`);
    console.log(`words added: ${picked.map((c) => c.token).join(', ') || '(none)'}`);
    console.log(fmtRows(summary.rows, SUMMARY_HEADER));
    for (const setName of SETS) {
      const b = baseSummary.counts[setName];
      const n2 = summary.counts[setName];
      console.log(`  delta vs V1+get (${setName}): leaks ${n2.leaks - b.leaks >= 0 ? '+' : ''}${n2.leaks - b.leaks}, over_tight ${n2.overTight - b.overTight >= 0 ? '+' : ''}${n2.overTight - b.overTight}`);
    }
    console.log(`  admission scope (camara+holdout1) delta: leaks ${admissionLeaksDelta >= 0 ? '+' : ''}${admissionLeaksDelta}, over_tight ${admissionOverTightDelta >= 0 ? '+' : ''}${admissionOverTightDelta}`);
    console.log(`  rows changed vs V1+get: ${changed.length}`);
    console.log('');

    mdLines.push(`## Run: liveVerbs + ${spec.label} corpus candidates (postShare >= 0.6 only; ${shortfallNote})`);
    mdLines.push('');
    mdLines.push(`Words added: ${picked.map((c) => c.token).join(', ') || '(none)'}`);
    mdLines.push('');
    mdLines.push(mdTable(summary.rows, SUMMARY_HEADER));
    mdLines.push('');
    mdLines.push('Delta vs V1+get:');
    mdLines.push('');
    for (const setName of SETS) {
      const b = baseSummary.counts[setName];
      const n2 = summary.counts[setName];
      mdLines.push(`- ${setName}: leaks ${n2.leaks - b.leaks >= 0 ? '+' : ''}${n2.leaks - b.leaks}, over_tight ${n2.overTight - b.overTight >= 0 ? '+' : ''}${n2.overTight - b.overTight}`);
    }
    mdLines.push('');
    mdLines.push(`Admission scope (camara+holdout1) delta: leaks ${admissionLeaksDelta >= 0 ? '+' : ''}${admissionLeaksDelta}, over_tight ${admissionOverTightDelta >= 0 ? '+' : ''}${admissionOverTightDelta}.`);
    mdLines.push('');
    mdLines.push(`### rows changed vs V1+get — ${changed.length} rows`);
    mdLines.push('');
    mdLines.push(changed.length ? changedRowsTable(changed) : '(none)');
    mdLines.push('');
    mdLines.push(`### leaking rows — ${leaking.length} rows`);
    mdLines.push('');
    mdLines.push(leaking.length ? leakRowsTable(leaking) : '(none)');
    mdLines.push('');
  }

  writeFileSync(OUT_MD, mdLines.join('\n') + '\n');
  console.log(`Wrote ${OUT_MD}`);
}

main();
