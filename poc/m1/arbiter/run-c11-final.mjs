// M1-C11 final scoring run: the adopted c11.mjs flow (frozen V3a), scored
// against census-ops.csv + ops-text.csv (camara, holdout1, holdout2), and —
// if present — a fourth "holdout3" set joined from
// data/holdout3-2026-09-08/{ground-truth,operations}.csv.
//
// Writes:
//   docs/logs/m1/c11-final.md         per-set + per-rule-per-set tables,
//                                      the two negative-control rows, and
//                                      every leaking row in full.
//   docs/logs/m1/c11-final-rows.csv   every scored row.
//   docs/logs/m1/c11-final-over-tight.csv   only over-tight rows.
//
// Asserts both negative controls (ClickToDial DELETE /calls/{callId}
// terminateCall, WebRTC PUT /sessions/{mediaSessionId}/status
// updateSessionStatus) come out 'x' — exits 1 otherwise.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../../m0/csv.mjs';
import { CLASS_ORDER } from './arbiter.mjs';
import { classify } from './c11.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CENSUS_PATH = path.join(REPO_ROOT, 'docs/logs/m1/census-ops.csv');
const TEXT_PATH = path.join(REPO_ROOT, 'docs/logs/m1/ops-text.csv');
const HOLDOUT3_DIR = path.join(REPO_ROOT, 'data/holdout3-2026-09-08');
const HOLDOUT3_GT = path.join(HOLDOUT3_DIR, 'ground-truth.csv');
const HOLDOUT3_OPS = path.join(HOLDOUT3_DIR, 'operations.csv');
const DATA_DIR = path.join(REPO_ROOT, 'data');

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c11-final.md');
const OUT_ROWS = path.join(REPO_ROOT, 'docs/logs/m1/c11-final-rows.csv');
const OUT_OVER_TIGHT = path.join(REPO_ROOT, 'docs/logs/m1/c11-final-over-tight.csv');

const RULES = ['locked', 'live-verb', 'party-noun', 'read-verb', 'no-text', 'floor'];

// --- helpers (mirrors run-c11.mjs/run-c11v.mjs's private helpers) ----------

function mdTable(rows, header) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.map((c) => String(c)).join(' | ')} |`);
  return lines.join('\n');
}

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

function kindOf(predClass, gtClass) {
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

// --- load census-ops.csv + ops-text.csv, exactly as run-c11.mjs does -------

function loadCensusRows() {
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

// --- load a holdout dir: join ground-truth.csv (gt_class) onto
// operations.csv (summary, description), key repo|path|method|operationId --

function loadHoldoutDir(dir, gtPath, opsPath, setName) {
  if (!existsSync(gtPath) || !existsSync(opsPath)) return null;

  const gtRows = parseCsv(readFileSync(gtPath, 'utf8'));
  const opsRows = parseCsv(readFileSync(opsPath, 'utf8'));

  const opsIndex = new Map();
  for (const o of opsRows) {
    opsIndex.set([o.repo, o.path, o.method, o.operationId].join('|'), o);
  }

  const rows = [];
  let joinMisses = 0;
  for (const gt of gtRows) {
    const key = [gt.repo, gt.path, gt.method, gt.operationId].join('|');
    const o = opsIndex.get(key);
    if (!o) { joinMisses += 1; continue; }
    rows.push({
      set: setName,
      repo: gt.repo,
      path: gt.path,
      method: gt.method,
      operationId: gt.operationId,
      gt_class: gt.gt_class,
      summary: o.summary || '',
      description: o.description || '',
    });
  }
  if (joinMisses > 0) {
    throw new Error(`ESCALATE: ${joinMisses} ${setName} ground-truth.csv rows had no matching row in operations.csv.`);
  }
  return rows;
}

function loadHoldout3() {
  return loadHoldoutDir(HOLDOUT3_DIR, HOLDOUT3_GT, HOLDOUT3_OPS, 'holdout3');
}

// --- load holdout4: every data/holdout4-*/ directory carrying both
// ground-truth.csv and operations.csv, all joined into set 'holdout4' -----

function loadHoldout4() {
  if (!existsSync(DATA_DIR)) return null;
  const dirNames = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('holdout4-'))
    .map((d) => d.name)
    .sort();
  if (dirNames.length === 0) return null;

  const rows = [];
  for (const name of dirNames) {
    const dir = path.join(DATA_DIR, name);
    const gtPath = path.join(dir, 'ground-truth.csv');
    const opsPath = path.join(dir, 'operations.csv');
    const dirRows = loadHoldoutDir(dir, gtPath, opsPath, 'holdout4');
    if (dirRows === null) continue;
    rows.push(...dirRows);
  }
  return rows.length ? rows : null;
}

// --- score ------------------------------------------------------------------

function scoreAll(rows) {
  const map = new Map();
  for (const row of rows) map.set(row, classify(row));
  return map;
}

function perSetSummary(rows, scored, sets) {
  const table = [];
  for (const setName of sets) {
    const setRows = rows.filter((r) => r.set === setName);
    const n = setRows.length;
    let exact = 0, leaks = 0, overTight = 0;
    for (const row of setRows) {
      const result = scored.get(row);
      const kind = kindOf(result.class, row.gt_class);
      if (kind === 'leak') leaks += 1;
      else if (kind === 'overTight') overTight += 1;
      else exact += 1;
    }
    const exactPct = n ? ((exact / n) * 100).toFixed(1) : '0.0';
    const leakPct = n ? ((leaks / n) * 100).toFixed(1) : '0.0';
    const overTightPct = n ? ((overTight / n) * 100).toFixed(1) : '0.0';
    table.push([setName, n, exact, leaks, overTight, exactPct, leakPct, overTightPct]);
  }
  return table;
}

function perRulePerSet(rows, scored, sets) {
  const table = [];
  for (const rule of RULES) {
    for (const setName of sets) {
      const setRows = rows.filter((r) => r.set === setName);
      let hit = 0, exact = 0, leaks = 0, overTight = 0;
      for (const row of setRows) {
        const result = scored.get(row);
        if (result.rule !== rule) continue;
        hit += 1;
        const kind = kindOf(result.class, row.gt_class);
        if (kind === 'leak') leaks += 1;
        else if (kind === 'overTight') overTight += 1;
        else exact += 1;
      }
      table.push([rule, setName, hit, exact, leaks, overTight]);
    }
  }
  return table;
}

function leakingRows(rows, scored) {
  return rows.filter((row) => kindOf(scored.get(row).class, row.gt_class) === 'leak')
    .map((row) => ({ row, result: scored.get(row) }));
}

function overTightRows(rows, scored) {
  return rows.filter((row) => kindOf(scored.get(row).class, row.gt_class) === 'overTight')
    .map((row) => ({ row, result: scored.get(row) }));
}

function findControlRow(rows, opId) {
  return rows.find((r) => r.operationId === opId);
}

function main() {
  const censusRows = loadCensusRows();
  const holdout3Rows = loadHoldout3();
  const holdout4Rows = loadHoldout4();

  const allRows = [
    ...censusRows,
    ...(holdout3Rows || []),
    ...(holdout4Rows || []),
  ];
  const sets = ['camara', 'holdout1', 'holdout2'];
  if (holdout3Rows) sets.push('holdout3');
  if (holdout4Rows) sets.push('holdout4');

  const scored = scoreAll(allRows);

  const summaryHeader = ['set', 'n', 'exact', 'leaks', 'over_tight', 'exact_pct', 'leak_pct', 'over_tight_pct'];
  const summaryTable = perSetSummary(allRows, scored, sets);

  const ruleHeader = ['rule', 'set', 'hit', 'exact', 'leaks', 'over_tight'];
  const ruleTable = perRulePerSet(allRows, scored, sets);

  const leaking = leakingRows(allRows, scored);
  const overTight = overTightRows(allRows, scored);

  // --- negative controls: must both be x ---
  const control1 = findControlRow(censusRows, 'terminateCall');
  const control2 = findControlRow(censusRows, 'updateSessionStatus');
  if (!control1 || !control2) {
    console.error('ESCALATE: could not find one or both negative-control rows in census-ops.csv (terminateCall, updateSessionStatus).');
    process.exit(1);
  }
  const control1Result = scored.get(control1);
  const control2Result = scored.get(control2);
  const controlsOk = control1Result.class === 'x' && control2Result.class === 'x';

  // --- stdout: per-set table ---
  console.log(fmtRows(summaryTable, summaryHeader));
  if (holdout3Rows === null) console.log('\nholdout3: not present');
  if (holdout4Rows === null) console.log('holdout4: not present');

  // --- docs/logs/m1/c11-final.md ---
  const md = [];
  md.push('# M1-C11 final: the adopted c11.mjs flow, scored');
  md.push('');
  md.push('c11.mjs\'s classify(row) — the C11 floor + raise-only shape frozen as V3a in');
  md.push('the M1-C11v sweep — scored against census-ops.csv (camara, holdout1,');
  md.push('holdout2) and, when present, holdout3 (data/holdout3-2026-09-08/).');
  md.push('');
  md.push(holdout3Rows === null ? 'holdout3: not present.' : `holdout3: present, ${holdout3Rows.length} rows.`);
  md.push(holdout4Rows === null ? 'holdout4: not present.' : `holdout4: present, ${holdout4Rows.length} rows.`);
  md.push('');
  md.push('## Per-set summary');
  md.push('');
  md.push(mdTable(summaryTable, summaryHeader));
  md.push('');
  md.push('## Per-rule, per-set breakdown');
  md.push('');
  md.push(mdTable(ruleTable, ruleHeader));
  md.push('');
  md.push('## Negative controls');
  md.push('');
  md.push('Both must be x.');
  md.push('');
  {
    const rows = [
      [control1.set, control1.repo, control1.method, control1.path, control1.operationId, control1Result.class, control1Result.rule, control1Result.evidence.join(';')],
      [control2.set, control2.repo, control2.method, control2.path, control2.operationId, control2Result.class, control2Result.rule, control2Result.evidence.join(';')],
    ];
    md.push(mdTable(rows, ['set', 'repo', 'method', 'path', 'operationId', 'class', 'rule', 'evidence']));
  }
  md.push('');
  md.push(controlsOk ? 'PASS — both controls x.' : 'FAIL — at least one control did not come out x.');
  md.push('');
  md.push(`## Leaking rows — ${leaking.length} rows`);
  md.push('');
  md.push(leaking.length
    ? mdTable(
        leaking.map(({ row, result }) => [
          row.set, row.repo, row.method, row.path, row.operationId || '(empty)',
          row.gt_class, result.class, result.rule, result.evidence.join(';'),
          truncate(row.summary, 100),
        ]),
        ['set', 'repo', 'method', 'path', 'operationId', 'gt', 'pred', 'rule', 'evidence', 'summary'],
      )
    : '(none)');
  md.push('');
  writeFileSync(OUT_MD, md.join('\n') + '\n');

  // --- docs/logs/m1/c11-final-rows.csv ---
  const outRows = allRows.map((row) => {
    const result = scored.get(row);
    return {
      set: row.set,
      repo: row.repo,
      method: row.method,
      path: row.path,
      operationId: row.operationId,
      gt_class: row.gt_class,
      pred: result.class,
      rule: result.rule,
      evidence: result.evidence.join(';'),
      summary: row.summary,
    };
  });
  const rowsHeader = ['set', 'repo', 'method', 'path', 'operationId', 'gt_class', 'pred', 'rule', 'evidence', 'summary'];
  writeFileSync(OUT_ROWS, toCsv(outRows, rowsHeader));

  // --- docs/logs/m1/c11-final-over-tight.csv: sorted by set, rule, repo ---
  const overTightSorted = [...overTight].sort((a, b) => {
    if (a.row.set !== b.row.set) return a.row.set < b.row.set ? -1 : 1;
    if (a.result.rule !== b.result.rule) return a.result.rule < b.result.rule ? -1 : 1;
    if (a.row.repo !== b.row.repo) return a.row.repo < b.row.repo ? -1 : 1;
    return 0;
  });
  const overTightRowsOut = overTightSorted.map(({ row, result }) => ({
    set: row.set,
    repo: row.repo,
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    gt_class: row.gt_class,
    pred: result.class,
    rule: result.rule,
    evidence: result.evidence.join(';'),
    summary: row.summary,
  }));
  writeFileSync(OUT_OVER_TIGHT, toCsv(overTightRowsOut, rowsHeader));

  console.log(`\nWrote ${OUT_MD}`);
  console.log(`Wrote ${OUT_ROWS}`);
  console.log(`Wrote ${OUT_OVER_TIGHT}`);
  console.log(`Leaking rows: ${leaking.length}`);
  console.log(`Over-tight rows: ${overTight.length}`);
  console.log(`Negative controls: ${controlsOk ? 'PASS' : 'FAIL'}`);

  if (!controlsOk) {
    console.error('ESCALATE: negative-control assertion failed.');
    process.exit(1);
  }
}

main();
