// M1-C11: "floor + raise-only" shape.
//
// Floor = method prior (methodPrior from arbiter.mjs: GET/HEAD/OPTIONS -> r
// locked, PUT/DELETE -> w, POST/PATCH -> x). On top of the floor, only two
// raise rules ever fire, both fed by the fixed verb/noun lists already
// admitted in earlier passes (judge.mjs's LIVE_VERBS/PARTY_NOUNS):
//   - live-verb: any method, any operationId token or the summary's lead
//     word hits LIVE_VERBS -> raise to x.
//   - party-noun: PUT/DELETE/PATCH only (POST/PATCH's prior is already x,
//     so only PUT/DELETE actually change class here; PATCH is included per
//     brief for evidence-trail completeness) -> raise to x.
// Nothing here ever LOWERS a class, with one measured exception: variant B
// (switches.readListOn), which lowers a POST row to r when its operationId
// lead verb is in a small hand-written READ_VERBS list. This is scored both
// on and off, never assumed.
//
// scoreC11 is a pure function (row, switches) -> {class, rule, evidence[]}.
// switches: { callerPhraseOn (default false): a caller phrase in the
//   summary ("for the authenticated user", "your account", ...) suppresses
//   the party-noun raise for that row, recording 'caller-phrase' as
//   evidence on whatever the row's final rule ends up being instead;
//   readListOn (default false): variant B, see above }.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../../m0/csv.mjs';
import { CLASS_ORDER, methodPrior, leadVerbForRow } from './arbiter.mjs';
import {
  LIVE_VERBS,
  PARTY_NOUNS,
  headNounForRow,
  operationIdHeadNoun,
  operationIdAnyLiveToken,
  summaryLeadVerb,
  summaryHasCallerPhrase,
} from './judge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
const TEXT_PATH = path.join(REPO_ROOT, 'docs/logs/m1/ops-text.csv');
const OUT_ROWS = path.join(REPO_ROOT, 'docs/logs/m1/c11-rows.csv');
const OUT_SWEEP = path.join(REPO_ROOT, 'docs/logs/m1/c11-sweep.md');

const SETS = ['camara', 'holdout1', 'holdout2'];
const RULES = ['floor', 'live-verb', 'party-noun', 'read-verb'];

// Variant B (M1-C11 hand list, review with the user): a POST row whose
// operationId lead verb is one of these is lowered from the x floor to r.
const READ_VERBS = new Set([
  'retrieve', 'verify', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'validate', 'count', 'lookup', 'assess', 'find',
]);

function isParty(word) {
  return word !== '' && (PARTY_NOUNS.has(word) || word === 'repository');
}

// --- pure scoring function --------------------------------------------------

export function scoreC11(row, switches = {}) {
  const callerPhraseOn = switches.callerPhraseOn === true;
  const readListOn = switches.readListOn === true;
  const method = row.method;

  // 1. floor = method prior; GET/HEAD/OPTIONS locked at r, done.
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { class: 'r', rule: 'floor', evidence: [] };
  }
  const prior = methodPrior(method);

  const extraEvidence = [];

  // 2. live-verb raise, any method.
  const opidLiveTok = operationIdAnyLiveToken(row);
  if (opidLiveTok) {
    return { class: 'x', rule: 'live-verb', evidence: [`opid:${opidLiveTok}`] };
  }
  const sLeadVerb = summaryLeadVerb(row);
  if (LIVE_VERBS.has(sLeadVerb)) {
    return { class: 'x', rule: 'live-verb', evidence: [`summary:${sLeadVerb}`] };
  }

  // 3. party-noun raise, PUT/DELETE/PATCH only (POST is already x from the
  // floor, so it never reaches this check).
  if (method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const noun = headNounForRow(row);
    const opidNoun = operationIdHeadNoun(row);
    const nounIsParty = isParty(noun);
    const opidIsParty = isParty(opidNoun);
    if (nounIsParty || opidIsParty) {
      if (callerPhraseOn && summaryHasCallerPhrase(row.summary)) {
        extraEvidence.push('caller-phrase');
      } else {
        const evidence = nounIsParty ? [`summary:${noun}`] : [`opid:${opidNoun}`];
        return { class: 'x', rule: 'party-noun', evidence };
      }
    }
  }

  // 4. variant B: POST-only read-verb lower, measured, never assumed.
  if (readListOn && method === 'POST') {
    const verb = leadVerbForRow(row);
    if (READ_VERBS.has(verb)) {
      return { class: 'r', rule: 'read-verb', evidence: [`opid:${verb}`, ...extraEvidence] };
    }
  }

  // 5. else: floor.
  return { class: prior, rule: 'floor', evidence: extraEvidence };
}

// --- I/O + sweep -------------------------------------------------------------

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

function main() {
  const censusRows = parseCsv(readFileSync(CENSUS_PATH, 'utf8'));
  const textRows = parseCsv(readFileSync(TEXT_PATH, 'utf8'));

  const requiredCensusCols = ['set', 'repo', 'path', 'method', 'operationId', 'gt_class'];
  const censusHeader = censusRows.length ? Object.keys(censusRows[0]) : [];
  for (const col of requiredCensusCols) {
    if (!censusHeader.includes(col)) throw new Error(`ESCALATE: census-ops.csv is missing required column "${col}"`);
  }

  // --- join ops-text.csv onto census rows (same join key/pattern as run-c10.mjs) ---
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

  const COMBOS = [
    { key: 'base', callerPhraseOn: false, readListOn: false },
    { key: 'readList', callerPhraseOn: false, readListOn: true },
    { key: 'callerPhrase', callerPhraseOn: true, readListOn: false },
    { key: 'both', callerPhraseOn: true, readListOn: true },
  ];

  // score every row under every combo
  const scoredByCombo = new Map(); // combo.key -> row -> result
  for (const combo of COMBOS) {
    const map = new Map();
    for (const row of censusRows) {
      map.set(row, scoreC11(row, { callerPhraseOn: combo.callerPhraseOn, readListOn: combo.readListOn }));
    }
    scoredByCombo.set(combo.key, map);
  }

  // --- per-combo, per-set summary table ---
  const summaryRows = [];
  for (const combo of COMBOS) {
    const scored = scoredByCombo.get(combo.key);
    for (const setName of SETS) {
      const rows = censusRows.filter((r) => r.set === setName);
      const n = rows.length;
      let exact = 0, leaks = 0, overTight = 0;
      for (const row of rows) {
        const result = scored.get(row);
        const kind = classify(result.class, row.gt_class);
        if (kind === 'leak') leaks += 1;
        else if (kind === 'overTight') overTight += 1;
        else exact += 1;
      }
      const leakPct = n ? ((leaks / n) * 100).toFixed(1) : '0.0';
      const overTightPct = n ? ((overTight / n) * 100).toFixed(1) : '0.0';
      summaryRows.push([combo.key, setName, n, exact, leaks, overTight, leakPct, overTightPct]);
    }
  }
  const summaryHeader = ['combo', 'set', 'n', 'exact', 'leaks', 'over_tight', 'leak_pct', 'over_tight_pct'];
  const summaryText = fmtRows(summaryRows, summaryHeader);
  console.log(summaryText);

  // --- per-combo, per-rule table ---
  const ruleRowsByCombo = new Map();
  for (const combo of COMBOS) {
    const scored = scoredByCombo.get(combo.key);
    const rows = [];
    for (const rule of RULES) {
      for (const setName of SETS) {
        const setRows = censusRows.filter((r) => r.set === setName);
        let hit = 0, exact = 0, leaks = 0, overTight = 0;
        for (const row of setRows) {
          const result = scored.get(row);
          if (result.rule !== rule) continue;
          hit += 1;
          const kind = classify(result.class, row.gt_class);
          if (kind === 'leak') leaks += 1;
          else if (kind === 'overTight') overTight += 1;
          else exact += 1;
        }
        rows.push([rule, setName, hit, exact, leaks, overTight]);
      }
    }
    ruleRowsByCombo.set(combo.key, rows);
  }
  const ruleHeader = ['rule', 'set', 'hit', 'exact', 'leaks', 'over_tight'];

  // --- Hidden x missed: combo base, PUT/DELETE/PATCH, gt_class x, rule floor ---
  const baseScored = scoredByCombo.get('base');
  const hiddenXMissed = censusRows.filter((row) => {
    if (row.method !== 'PUT' && row.method !== 'DELETE' && row.method !== 'PATCH') return false;
    if (row.gt_class !== 'x') return false;
    const result = baseScored.get(row);
    return result.rule === 'floor';
  });

  // --- Party-noun over-tight: combo base, rule party-noun, gt_class != x ---
  const partyNounOverTight = censusRows.filter((row) => {
    const result = baseScored.get(row);
    return result.rule === 'party-noun' && row.gt_class !== 'x';
  }).map((row) => ({ row, result: baseScored.get(row) }));

  // --- Read-list leaks: combo readList (readListOn=true, callerPhraseOn=false) ---
  const readListScored = scoredByCombo.get('readList');
  const readListLeaks = censusRows.filter((row) => {
    const result = readListScored.get(row);
    return result.rule === 'read-verb' && row.gt_class !== 'r';
  });

  // --- Caller-phrase effect: base (callerPhraseOn=false) vs callerPhrase combo ---
  const callerPhraseScored = scoredByCombo.get('callerPhrase');
  const callerPhraseEffect = censusRows.filter((row) => {
    const off = baseScored.get(row);
    const on = callerPhraseScored.get(row);
    return off.class !== on.class;
  }).map((row) => ({ row, off: baseScored.get(row), on: callerPhraseScored.get(row) }));

  // --- write docs/logs/m1/c11-sweep.md ---
  const sweepLines = [];
  sweepLines.push('# M1-C11: floor + raise-only sweep');
  sweepLines.push('');
  sweepLines.push('Four combos: callerPhraseOn x readListOn (each false/true). Floor = method prior;');
  sweepLines.push('raises only from live-verb and party-noun (fixed lists from judge.mjs); readListOn');
  sweepLines.push('is the one measured POST-only lowering variant (variant B).');
  sweepLines.push('');
  sweepLines.push('## Per-combo, per-set summary');
  sweepLines.push('');
  sweepLines.push(mdTable(summaryRows, summaryHeader));
  sweepLines.push('');
  sweepLines.push('## Per-combo, per-rule breakdown');
  for (const combo of COMBOS) {
    sweepLines.push('');
    sweepLines.push(`### combo=${combo.key} (callerPhraseOn=${combo.callerPhraseOn}, readListOn=${combo.readListOn})`);
    sweepLines.push('');
    sweepLines.push(mdTable(ruleRowsByCombo.get(combo.key), ruleHeader));
  }
  sweepLines.push('');
  sweepLines.push(`## Hidden x missed (combo=base: callerPhraseOn=false, readListOn=false) — ${hiddenXMissed.length} rows`);
  sweepLines.push('');
  sweepLines.push('PUT/DELETE/PATCH rows with gt_class x that the floor+raise-only shape never catches.');
  sweepLines.push('');
  {
    const rows = hiddenXMissed.map((row) => [row.set, row.repo, row.method, row.path, row.operationId || '(empty)', truncate(row.summary, 80)]);
    sweepLines.push(mdTable(rows, ['set', 'repo', 'method', 'path', 'operationId', 'summary']));
  }
  sweepLines.push('');
  sweepLines.push(`## Party-noun over-tight (combo=base) — ${partyNounOverTight.length} rows`);
  sweepLines.push('');
  sweepLines.push('party-noun raises where the ground truth is not x.');
  sweepLines.push('');
  {
    const rows = partyNounOverTight.map(({ row, result }) => [row.set, row.repo, row.method, row.path, row.operationId || '(empty)', truncate(row.summary, 80), result.evidence.join(';')]);
    sweepLines.push(mdTable(rows, ['set', 'repo', 'method', 'path', 'operationId', 'summary', 'evidence']));
  }
  sweepLines.push('');
  sweepLines.push(`## Read-list leaks (readListOn=true, callerPhraseOn=false) — ${readListLeaks.length} rows`);
  sweepLines.push('');
  sweepLines.push('read-verb POST lowerings where the ground truth is not r.');
  sweepLines.push('');
  {
    const rows = readListLeaks.map((row) => [row.set, row.repo, row.method, row.path, row.operationId || '(empty)', truncate(row.summary, 80)]);
    sweepLines.push(mdTable(rows, ['set', 'repo', 'method', 'path', 'operationId', 'summary']));
  }
  sweepLines.push('');
  sweepLines.push(`## Caller-phrase effect (base vs callerPhraseOn=true) — ${callerPhraseEffect.length} rows changed`);
  sweepLines.push('');
  sweepLines.push('Rows whose predicted class differs when callerPhraseOn flips from false to true.');
  sweepLines.push('');
  {
    const rows = callerPhraseEffect.map(({ row, off, on }) => [row.set, row.repo, row.method, row.path, row.operationId || '(empty)', row.gt_class, off.class, on.class]);
    sweepLines.push(mdTable(rows, ['set', 'repo', 'method', 'path', 'operationId', 'gt_class', 'pred_off', 'pred_on']));
  }
  sweepLines.push('');
  writeFileSync(OUT_SWEEP, sweepLines.join('\n') + '\n');

  // --- write docs/logs/m1/c11-rows.csv (base combo, plus single-switch columns) ---
  const outRows = censusRows.map((row) => {
    const base = baseScored.get(row);
    const rl = readListScored.get(row);
    const cp = callerPhraseScored.get(row);
    return {
      set: row.set,
      repo: row.repo,
      method: row.method,
      path: row.path,
      operationId: row.operationId,
      gt_class: row.gt_class,
      pred: base.class,
      rule: base.rule,
      evidence: base.evidence.join(';'),
      pred_readlist: rl.class,
      pred_callerphrase: cp.class,
    };
  });
  const outHeader = ['set', 'repo', 'method', 'path', 'operationId', 'gt_class', 'pred', 'rule', 'evidence', 'pred_readlist', 'pred_callerphrase'];
  writeFileSync(OUT_ROWS, toCsv(outRows, outHeader));

  console.log(`\nWrote ${OUT_SWEEP}`);
  console.log(`Wrote ${OUT_ROWS}`);
  console.log(`Hidden x missed: ${hiddenXMissed.length}`);
  console.log(`Party-noun over-tight: ${partyNounOverTight.length}`);
  console.log(`Read-list leaks: ${readListLeaks.length}`);
  console.log(`Caller-phrase effect: ${callerPhraseEffect.length}`);
}

main();
