#!/usr/bin/env node
// Read-out (not a score) of the frozen poc/flow classifier over the new
// 15-provider corpus (data/provider-corpus-2026-09-16/ops.csv.gz). These
// rows carry no ground truth, so this reports what the classifier decided
// and how — never an accuracy/leak/over-tight number, because there is
// nothing to score against.
//
// Writes run-proof/provider-corpus.csv (one row per operation) and
// run-proof/provider-corpus.md (the tables below), and prints the same
// tables to stdout. Imports poc/flow's frozen code; copies nothing from it.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadRows } from '../flow/corpus.mjs';
import { buildContext, classifyRow } from '../flow/flow.mjs';
import { parseCsv, toCsv } from '../flow/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OPS_GZ_PATH = path.join(REPO_ROOT, 'data/provider-corpus-2026-09-16/ops.csv.gz');
const OUT_CSV_PATH = path.join(REPO_ROOT, 'run-proof/provider-corpus.csv');
const OUT_MD_PATH = path.join(REPO_ROOT, 'run-proof/provider-corpus.md');

const EXPECTED_ROWS = 4171;
const EXPECTED_PROVIDERS = [
  'asana', 'canva', 'datadog', 'digitalocean', 'figma', 'intercom', 'jira',
  'mailchimp', 'meta-whatsapp', 'openai', 'paypal', 'spotify', 'square',
  'stripe', 'zoom',
];

function escalate(msg) {
  console.error('ESCALATE:', msg);
  process.exit(1);
}

// --- load ------------------------------------------------------------------

function loadNewRows() {
  const gz = readFileSync(OPS_GZ_PATH);
  const text = gunzipSync(gz).toString('utf8');
  const rows = parseCsv(text);
  const requiredCols = ['provider', 'method', 'path', 'operationId', 'summary'];
  const header = rows.length ? Object.keys(rows[0]) : [];
  for (const col of requiredCols) {
    if (!header.includes(col)) escalate(`ops.csv is missing required column "${col}"`);
  }
  return rows.map((r) => ({
    vendor: r.provider,
    method: r.method,
    path: r.path,
    operationId: r.operationId,
    summary: r.summary || '',
  }));
}

// --- decision-provenance labelling ------------------------------------------

// Which (step, rule) pairs classifyRow can hand back, and whether each is
// "evidence" (a rule with signal fired) or "floor" (the method-only
// default, no text was read). GET/HEAD/OPTIONS only ever get step1/method;
// POST only ever gets step1/read-verb or step3/floor; PUT/DELETE/PATCH only
// ever gets one of step2's five outcomes (flow.mjs classifyRow, step2.mjs
// classifyStep2). rule 'floor' shows up at two different `step` numbers —
// step2's own x-pile fallback and flow.mjs's step3 POST fallback — labelled
// separately here since the STEP field is what decided the row.
function decisionLabel(result) {
  return `step${result.step}:${result.rule}`;
}
function isEvidence(result) {
  return result.rule !== 'floor' && result.rule !== 'method';
}

// --- tables ------------------------------------------------------------------

function pct(n, total) {
  return total === 0 ? '0.0%' : `${(100 * n / total).toFixed(1)}%`;
}

function emptyClassCounts() {
  return { r: 0, w: 0, x: 0, n: 0 };
}

function bump(counts, cls) {
  counts[cls] += 1;
  counts.n += 1;
}

function classCountsRow(counts) {
  return `${counts.n} | ${counts.r} (${pct(counts.r, counts.n)}) | ${counts.w} (${pct(counts.w, counts.n)}) | ${counts.x} (${pct(counts.x, counts.n)})`;
}

function buildTables(results) {
  const byProvider = new Map(); // provider -> classCounts
  const byMethod = new Map(); // method -> classCounts
  const byProviderMethodLabel = new Map(); // provider -> method -> label -> n
  const byProviderEvidence = new Map(); // provider -> { evidence, floor }
  const byMethodEvidence = new Map(); // method -> { evidence, floor }
  const byProviderXPile = new Map(); // provider -> count
  let totalEvidence = 0;
  let totalFloor = 0;
  let totalXPile = 0;

  for (const { provider, method, result } of results) {
    if (!byProvider.has(provider)) byProvider.set(provider, emptyClassCounts());
    bump(byProvider.get(provider), result.class);

    if (!byMethod.has(method)) byMethod.set(method, emptyClassCounts());
    bump(byMethod.get(method), result.class);

    if (!byProviderMethodLabel.has(provider)) byProviderMethodLabel.set(provider, new Map());
    const pm = byProviderMethodLabel.get(provider);
    if (!pm.has(method)) pm.set(method, new Map());
    const labelMap = pm.get(method);
    const label = decisionLabel(result);
    labelMap.set(label, (labelMap.get(label) || 0) + 1);

    const evidence = isEvidence(result);
    if (!byProviderEvidence.has(provider)) byProviderEvidence.set(provider, { evidence: 0, floor: 0 });
    const pe = byProviderEvidence.get(provider);
    if (evidence) pe.evidence += 1; else pe.floor += 1;

    if (!byMethodEvidence.has(method)) byMethodEvidence.set(method, { evidence: 0, floor: 0 });
    const me = byMethodEvidence.get(method);
    if (evidence) me.evidence += 1; else me.floor += 1;

    if (evidence) totalEvidence += 1; else totalFloor += 1;

    if (result.flag === 'x-pile') {
      totalXPile += 1;
      byProviderXPile.set(provider, (byProviderXPile.get(provider) || 0) + 1);
    }
  }

  return {
    byProvider, byMethod, byProviderMethodLabel,
    byProviderEvidence, byMethodEvidence, byProviderXPile,
    totalEvidence, totalFloor, totalXPile,
  };
}

function renderMarkdown(results, tables, providers, methods) {
  const total = results.length;
  const lines = [];
  lines.push('# Provider corpus read-out (poc/flow, frozen)');
  lines.push('');
  lines.push(`${total} rows, ${providers.length} providers, ${methods.length} methods. These rows carry no ground truth — this is a read-out of what the frozen classifier decided, never an accuracy score.`);
  lines.push('');

  lines.push('## Per-provider class split');
  lines.push('');
  lines.push('| provider | n | r | w | x |');
  lines.push('|---|---|---|---|---|');
  for (const provider of providers) {
    const c = tables.byProvider.get(provider) || emptyClassCounts();
    lines.push(`| ${provider} | ${classCountsRow(c)} |`);
  }
  lines.push('');

  lines.push('## Per-method class split (all 15 providers)');
  lines.push('');
  lines.push('| method | n | r | w | x |');
  lines.push('|---|---|---|---|---|');
  for (const method of methods) {
    const c = tables.byMethod.get(method) || emptyClassCounts();
    lines.push(`| ${method} | ${classCountsRow(c)} |`);
  }
  lines.push('');

  lines.push('## Per-provider x per-method: which step/rule decided each row');
  lines.push('');
  lines.push('| provider | method | n | decision (label: n) |');
  lines.push('|---|---|---|---|');
  for (const provider of providers) {
    const pm = tables.byProviderMethodLabel.get(provider) || new Map();
    for (const method of methods) {
      const labelMap = pm.get(method);
      if (!labelMap) continue;
      const n = [...labelMap.values()].reduce((a, b) => a + b, 0);
      const parts = [...labelMap.entries()].sort((a, b) => b[1] - a[1]).map(([l, c]) => `${l}: ${c}`).join(', ');
      lines.push(`| ${provider} | ${method} | ${n} | ${parts} |`);
    }
  }
  lines.push('');

  lines.push('## Evidence vs floor');
  lines.push('');
  lines.push('"evidence" = an actual rule fired on the row\'s text (read-verb, live-verb, other-noun, money-noun, yours-noun). "floor" = the method-only default with no text read (step1 GET/HEAD/OPTIONS, step2\'s x-pile fallback, step3\'s POST fallback).');
  lines.push('');
  lines.push(`Overall: ${tables.totalEvidence} evidence (${pct(tables.totalEvidence, total)}), ${tables.totalFloor} floor (${pct(tables.totalFloor, total)}). x-pile flag: ${tables.totalXPile} rows (${pct(tables.totalXPile, total)}).`);
  lines.push('');
  lines.push('| provider | n | evidence | floor | x-pile |');
  lines.push('|---|---|---|---|---|');
  for (const provider of providers) {
    const c = tables.byProvider.get(provider) || emptyClassCounts();
    const e = tables.byProviderEvidence.get(provider) || { evidence: 0, floor: 0 };
    const xp = tables.byProviderXPile.get(provider) || 0;
    lines.push(`| ${provider} | ${c.n} | ${e.evidence} (${pct(e.evidence, c.n)}) | ${e.floor} (${pct(e.floor, c.n)}) | ${xp} (${pct(xp, c.n)}) |`);
  }
  lines.push('');
  lines.push('| method | n | evidence | floor |');
  lines.push('|---|---|---|---|');
  for (const method of methods) {
    const c = tables.byMethod.get(method) || emptyClassCounts();
    const e = tables.byMethodEvidence.get(method) || { evidence: 0, floor: 0 };
    lines.push(`| ${method} | ${c.n} | ${e.evidence} (${pct(e.evidence, c.n)}) | ${e.floor} (${pct(e.floor, c.n)}) |`);
  }
  lines.push('');

  lines.push('## Providers ranked by share of rows that hit the floor with no evidence');
  lines.push('');
  lines.push('| rank | provider | n | floor | floor share |');
  lines.push('|---|---|---|---|---|');
  const ranked = providers
    .map((provider) => {
      const c = tables.byProvider.get(provider) || emptyClassCounts();
      const e = tables.byProviderEvidence.get(provider) || { evidence: 0, floor: 0 };
      return { provider, n: c.n, floor: e.floor, share: c.n === 0 ? 0 : e.floor / c.n };
    })
    .sort((a, b) => b.share - a.share);
  ranked.forEach((r, i) => {
    lines.push(`| ${i + 1} | ${r.provider} | ${r.n} | ${r.floor} | ${pct(r.floor, r.n)} |`);
  });
  lines.push('');

  const confident = ranked.filter((r) => r.share < 0.5).map((r) => r.provider);
  const guessed = ranked.filter((r) => r.share >= 0.5).map((r) => r.provider);
  lines.push('## Read confidently vs mostly guessed');
  lines.push('');
  lines.push(
    (confident.length
      ? `The frozen core reads confidently (most rows decided by a fired rule, not just method) for: ${confident.join(', ')}.`
      : 'No provider had a majority of rows decided by a fired rule.') +
    ' ' +
    (guessed.length
      ? `It mostly guesses from the method alone (most rows hit the floor with no evidence) for: ${guessed.join(', ')}.`
      : 'Every provider had most rows decided by a fired rule.')
  );
  lines.push('');

  return lines.join('\n');
}

// --- main --------------------------------------------------------------------

function main() {
  const { rows: corpusRows, vendors: corpusVendors } = loadRows();
  if (!corpusVendors.includes('stripe')) {
    escalate('stripe was expected to be one of the 332 corpus vendors and was not found.');
  }

  const newRows = loadNewRows();
  if (newRows.length !== EXPECTED_ROWS) {
    escalate(`expected ${EXPECTED_ROWS} new-corpus rows, got ${newRows.length}.`);
  }

  const providersInData = new Set(newRows.map((r) => r.vendor));
  for (const p of EXPECTED_PROVIDERS) {
    if (!providersInData.has(p)) escalate(`expected provider "${p}" not found in ops.csv.`);
  }
  if (providersInData.size !== EXPECTED_PROVIDERS.length) {
    escalate(`expected exactly ${EXPECTED_PROVIDERS.length} providers, found ${providersInData.size}: ${[...providersInData].sort().join(', ')}`);
  }

  const allVendors = [...new Set([...corpusVendors, ...EXPECTED_PROVIDERS])];
  const ctx = buildContext(corpusRows, allVendors);

  const results = newRows.map((row) => ({
    provider: row.vendor,
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    summary: row.summary,
    result: classifyRow(row, ctx),
  }));

  const csvHeader = ['provider', 'method', 'path', 'operationId', 'summary', 'class', 'step', 'rule', 'flag'];
  const csvRows = results.map((r) => ({
    provider: r.provider,
    method: r.method,
    path: r.path,
    operationId: r.operationId,
    summary: r.summary,
    class: r.result.class,
    step: r.result.step,
    rule: r.result.rule,
    flag: r.result.flag,
  }));
  writeFileSync(OUT_CSV_PATH, toCsv(csvRows, csvHeader));

  const providers = [...EXPECTED_PROVIDERS].sort();
  const methods = [...new Set(results.map((r) => r.method))].sort();
  const tables = buildTables(results);
  const md = renderMarkdown(results, tables, providers, methods);
  writeFileSync(OUT_MD_PATH, md);
  console.log(md);

  console.log(`\nWrote ${OUT_CSV_PATH}`);
  console.log(`Wrote ${OUT_MD_PATH}`);
}

main();
