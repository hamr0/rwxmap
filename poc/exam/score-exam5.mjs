// data/exam5-2026-09-14: score exam 5 against its blind truth (10 parts).
//
// Reads exam-blind.csv (2000 rows), exam-key.csv (row_id -> corpus_vendor,
// stratum) and exam-truth-part1..10.csv, classifies each scorable row
// (truth_class r/w/x) with the flow's classifyRow, and prints the same
// breakdown the scratch scorer did (all / PUT-DEL-PATCH / per-method /
// high-conf-only, truth mix, by step:rule, x-pile). Writes
// data/exam5-2026-09-14/score.csv with one row per scorable row, in
// row_id order.
//
// vendor MUST be corpus_vendor when present: the flow's mined lists are
// keyed by exact corpus vendor name, and an unknown name silently gets
// empty lists (a leak-shaped bug, not a crash) — see CLAUDE.md's rail on
// vendor identity.
//
// If both data/exam5-2026-09-14/exam-post-truth-part1.csv and
// exam-post-truth-part2.csv exist, the 300 POST-stratum rows' truth is
// overridden from those files (relabelled under the brief's POST
// paragraph revised 2026-09-15) instead of the original 10-part truth.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../flow/csv.mjs';
import { loadRows } from '../flow/corpus.mjs';
import { buildContext, classifyRow } from '../flow/flow.mjs';
import { verdictFor } from '../flow/ledger.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const D = path.join(ROOT, 'data', 'exam5-2026-09-14') + path.sep;

const { rows, vendors } = loadRows();
const ctx = buildContext(rows, vendors);

const blind = parseCsv(readFileSync(D + 'exam-blind.csv', 'utf8'));
const keyRows = parseCsv(readFileSync(D + 'exam-key.csv', 'utf8'));
const keyById = new Map(keyRows.map((k) => [k.row_id, k]));

if (blind.length !== 2000) {
  throw new Error(`expected 2000 blind rows, got ${blind.length}`);
}
if (keyRows.length !== 2000) {
  throw new Error(`expected 2000 key rows, got ${keyRows.length}`);
}

const truth = new Map();
for (let i = 1; i <= 10; i++) {
  const p = D + `exam-truth-part${i}.csv`;
  if (!existsSync(p)) throw new Error(`missing truth part ${i}: ${p}`);
  for (const t of parseCsv(readFileSync(p, 'utf8'))) truth.set(t.row_id, t);
}
if (truth.size !== 2000) {
  throw new Error(`expected 2000 truth rows across 10 parts, got ${truth.size}`);
}

const postTruthPath1 = D + 'exam-post-truth-part1.csv';
const postTruthPath2 = D + 'exam-post-truth-part2.csv';
const postTruth1Exists = existsSync(postTruthPath1);
const postTruth2Exists = existsSync(postTruthPath2);

if (postTruth1Exists !== postTruth2Exists) {
  throw new Error(
    'expected both exam-post-truth-part1.csv and exam-post-truth-part2.csv, found only ' +
      (postTruth1Exists ? 'part1' : 'part2'),
  );
}

if (postTruth1Exists && postTruth2Exists) {
  const postKeyRowIds = keyRows.filter((k) => k.stratum === 'POST').map((k) => k.row_id);
  if (postKeyRowIds.length !== 300) {
    throw new Error(`expected 300 POST-stratum key rows, got ${postKeyRowIds.length}`);
  }

  const validateAgainstBlind = (truthPartRows, blindPath, label) => {
    const blindPartRows = parseCsv(readFileSync(D + blindPath, 'utf8'));
    if (truthPartRows.length !== blindPartRows.length) {
      throw new Error(
        `${label}: expected ${blindPartRows.length} rows to match ${blindPath}, got ${truthPartRows.length}`,
      );
    }
    for (let i = 0; i < blindPartRows.length; i++) {
      if (truthPartRows[i].row_id !== blindPartRows[i].row_id) {
        throw new Error(
          `${label}: row_id order mismatch at index ${i} (${truthPartRows[i].row_id} vs ${blindPartRows[i].row_id} in ${blindPath})`,
        );
      }
      const cls = truthPartRows[i].truth_class;
      if (!['r', 'w', 'x', '?'].includes(cls)) {
        throw new Error(`${label}: row ${truthPartRows[i].row_id} has invalid truth_class "${cls}"`);
      }
      const conf = truthPartRows[i].confidence;
      if (conf !== 'high' && conf !== 'low') {
        throw new Error(`${label}: row ${truthPartRows[i].row_id} has invalid confidence "${conf}"`);
      }
    }
  };

  const postTruth1 = parseCsv(readFileSync(postTruthPath1, 'utf8'));
  const postTruth2 = parseCsv(readFileSync(postTruthPath2, 'utf8'));
  validateAgainstBlind(postTruth1, 'exam-post-blind-part1.csv', 'exam-post-truth-part1.csv');
  validateAgainstBlind(postTruth2, 'exam-post-blind-part2.csv', 'exam-post-truth-part2.csv');

  const postTruthUnion = new Map();
  for (const t of [...postTruth1, ...postTruth2]) postTruthUnion.set(t.row_id, t);
  const postKeyIdSet = new Set(postKeyRowIds);
  if (postTruthUnion.size !== 300 || postKeyRowIds.some((id) => !postTruthUnion.has(id))) {
    throw new Error('exam-post-truth-part1/2 union does not cover exactly the 300 POST-stratum row_ids');
  }
  for (const id of postTruthUnion.keys()) {
    if (!postKeyIdSet.has(id)) {
      throw new Error(`exam-post-truth row_id ${id} is not a POST-stratum row per exam-key.csv`);
    }
  }

  for (const [id, t] of postTruthUnion) truth.set(id, t);
  console.log('POST truth: relabel under brief revised 2026-09-15 (exam-post-truth-part1/2)');
} else {
  console.log('POST truth: original parts (brief before 2026-09-15)');
}

const scored = [];
for (const b of blind) {
  const k = keyById.get(b.row_id);
  if (!k) throw new Error('no key for row ' + b.row_id);
  const t = truth.get(b.row_id);
  if (!t || !['r', 'w', 'x'].includes(t.truth_class)) continue;
  const row = {
    vendor: k.corpus_vendor || b.provider,
    method: b.method,
    path: b.path,
    operationId: b.operationId,
    summary: b.summary || '',
    description: b.description || '',
  };
  const res = classifyRow(row, ctx);
  scored.push({
    ...b,
    stratum: k.stratum,
    cv: k.corpus_vendor,
    truth: t.truth_class,
    conf: t.confidence,
    treason: t.reason,
    cls: res.class,
    step: res.step,
    rule: res.rule,
    flag: res.flag || '',
    verdict: verdictFor(res, t.truth_class),
  });
}

const tab = (rs, name) => {
  const c = {};
  for (const r of rs) c[r.verdict] = (c[r.verdict] || 0) + 1;
  const n = rs.length || 1;
  const over = (c['FALSE-ALARM'] || 0) + (c['OVER-TIGHT'] || 0);
  console.log(
    name.padEnd(16),
    String(rs.length).padStart(5),
    'exact',
    String(c.ok || 0).padStart(4),
    (100 * (c.ok || 0) / n).toFixed(1) + '%',
    'leaks',
    String(c.LEAK || 0).padStart(3),
    (100 * (c.LEAK || 0) / n).toFixed(1) + '%',
    'over-tight',
    String(over).padStart(4),
    (100 * over / n).toFixed(1) + '%',
  );
};

console.log('scorable rows', scored.length, 'of', blind.length, 'truth rows', truth.size);
tab(scored, 'all');
tab(scored.filter((r) => ['PUT', 'DELETE', 'PATCH'].includes(r.method)), 'PUT/DEL/PATCH');
for (const m of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']) {
  tab(scored.filter((r) => r.method === m), m);
}
tab(scored.filter((r) => r.conf === 'high'), 'high-conf only');

const tc = {};
for (const r of scored) tc[r.truth] = (tc[r.truth] || 0) + 1;
console.log(
  'truth mix',
  tc,
  'x-share PUT/DEL/PATCH',
  (100 * scored.filter((r) => ['PUT', 'DELETE', 'PATCH'].includes(r.method) && r.truth === 'x').length /
    scored.filter((r) => ['PUT', 'DELETE', 'PATCH'].includes(r.method)).length).toFixed(1) + '%',
);

const byRule = {};
for (const r of scored) {
  const k = r.step + ':' + r.rule + (r.flag ? '/' + r.flag : '');
  byRule[k] = byRule[k] || { n: 0, ok: 0, LEAK: 0, 'FALSE-ALARM': 0, 'OVER-TIGHT': 0 };
  byRule[k].n++;
  byRule[k][r.verdict]++;
}
console.log('\nby step:rule');
for (const [k, v] of Object.entries(byRule).sort((a, b) => b[1].n - a[1].n)) {
  console.log(k.padEnd(28), JSON.stringify(v));
}

const xp = scored.filter((r) => r.flag === 'x-pile');
console.log(
  '\nx-pile rows',
  xp.length,
  'leaks inside',
  xp.filter((r) => r.verdict === 'LEAK').length,
  '| leaks total',
  scored.filter((r) => r.verdict === 'LEAK').length,
  '| leaks on evidence rows',
  scored.filter((r) => r.verdict === 'LEAK' && r.flag !== 'x-pile' && r.rule !== 'floor' && r.rule !== 'method').length,
);

const outHeader = [
  'row_id', 'stratum', 'provider', 'corpus_vendor', 'method', 'path', 'operationId', 'summary',
  'truth', 'confidence', 'truth_reason', 'step', 'class', 'rule', 'flag', 'verdict',
];
const outRows = scored.map((r) => ({
  row_id: r.row_id,
  stratum: r.stratum,
  provider: r.provider,
  corpus_vendor: r.cv,
  method: r.method,
  path: r.path,
  operationId: r.operationId,
  summary: r.summary,
  truth: r.truth,
  confidence: r.conf,
  truth_reason: r.treason,
  step: r.step,
  class: r.cls,
  rule: r.rule,
  flag: r.flag,
  verdict: r.verdict,
}));
writeFileSync(D + 'score.csv', toCsv(outRows, outHeader));

process.exit(0);
