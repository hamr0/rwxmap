// Pre-registration of the frozen ladder's predictions on the clean exam —
// run with: node tools/predict-exam.js
// Runs src/'s ladder over all 1383 UNLABELLED rows of
// data/exam-2026-09-17 and writes run-proof/exam-2026-09-17-predictions.csv,
// one line per operation. Test/dev tooling only — never part of the
// published library.
//
// THIS RUNS BEFORE TRUTH EXISTS AND SCORES NOTHING. The exam carries no
// truth column, so there is no accuracy, no leak count and no over-tight
// count anywhere in this file, and there must never be one: the point is
// to put the predictions on the record (committable, timestamped, with a
// sha256) BEFORE any labelling happens, so the labels cannot be read back
// into the rules. Scoring is a separate step, after the labels land.
//
// It writes its own file and touches nothing else under run-proof/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from './csv.js';
import { classifyRow } from '../src/flow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const EXAM_DIR = path.join(REPO_ROOT, 'data/exam-2026-09-17');
const OPS_GZ = path.join(EXAM_DIR, 'ops.csv.gz');
const OUT_CSV = path.join(REPO_ROOT, 'run-proof/exam-2026-09-17-predictions.csv');

export const EXPECTED_ROWS = 1383;

/** Per-provider row counts, as data/exam-2026-09-17/README.md states them. */
const EXPECTED_BY_PROVIDER = { okta: 734, docusign: 414, xero: 235 };

const HEADER = ['provider', 'method', 'path', 'operationId', 'summary',
  'class', 'step', 'rule', 'source', 'matched'];

const ops = parseCsv(gunzipSync(readFileSync(OPS_GZ)).toString('utf8'));

if (ops.length !== EXPECTED_ROWS) {
  throw new Error(`ops.csv.gz has ${ops.length} rows, expected ${EXPECTED_ROWS}`);
}
for (const [provider, want] of Object.entries(EXPECTED_BY_PROVIDER)) {
  const got = ops.filter((row) => row.provider === provider).length;
  if (got !== want) {
    throw new Error(`provider ${provider} has ${got} rows, expected ${want}`);
  }
}
const unknown = [...new Set(ops.map((row) => row.provider))]
  .filter((p) => !Object.hasOwn(EXPECTED_BY_PROVIDER, p));
if (unknown.length > 0) {
  throw new Error(`ops.csv.gz has unexpected provider(s): ${unknown.join(', ')}`);
}

// src/types.js's Operation is method/path/operationId/summary only — no
// description (deliberately, D78) and no provider. The provider is carried
// alongside the verdict for the report, never into the classifier.
const flow = ops.map((row) => ({
  provider: row.provider,
  row: {
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    summary: row.summary,
  },
  hit: classifyRow({
    method: row.method,
    path: row.path,
    operationId: row.operationId,
    summary: row.summary,
  }),
}));

mkdirSync(path.dirname(OUT_CSV), { recursive: true });
writeFileSync(OUT_CSV, toCsv(flow.map(({ provider, row, hit }) => ({
  provider,
  method: row.method,
  path: row.path,
  operationId: row.operationId,
  summary: row.summary,
  class: hit.class,
  step: hit.step,
  rule: hit.rule,
  source: hit.source,
  // A floor row matched nothing, so its cell is empty.
  matched: hit.matched.join('+'),
})), HEADER));
console.log(`wrote ${path.relative(REPO_ROOT, OUT_CSV)} (${flow.length} rows)`);

/**
 * Render a table: first column left-aligned, the rest right-aligned.
 * @param {string[]} head
 * @param {Array<Array<string|number>>} lines
 */
function table(head, lines) {
  const widths = head.map((h, i) =>
    Math.max(h.length, ...lines.map((l) => String(l[i]).length)));
  const render = (cells) => cells
    .map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i])))
    .join('  ');
  console.log('\n' + render(head));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const l of lines) console.log(render(l));
}

const providers = Object.keys(EXPECTED_BY_PROVIDER);
const slice = (provider) => flow.filter((f) => f.provider === provider);
const empty = (pool, field) => pool.filter((f) => (f.row[field] || '') === '').length;

// Parse sanity: the columns a human reads to see the extraction is not
// broken. NOT a quality measure of the classifier.
table(['provider', 'rows', 'empty operationId', 'empty summary', 'empty path'],
  providers.map((p) => {
    const pool = slice(p);
    return [p, pool.length, empty(pool, 'operationId'), empty(pool, 'summary'),
      empty(pool, 'path')];
  }));

// Which step claimed each row, and whether a word list fired or the method
// floor decided it. Deliberately NOT the r/w/x class distribution: nobody
// looks at the class split before the labels exist, because seeing it
// tempts a tuning decision on the exam's own rows (D24).
table(['provider', 'step 1', 'step 2', 'step 3', 'list', 'floor'],
  providers.map((p) => {
    const pool = slice(p);
    const step = (n) => pool.filter((f) => f.hit.step === n).length;
    const source = (s) => pool.filter((f) => f.hit.source === s).length;
    return [p, step(1), step(2), step(3), source('list'), source('floor')];
  }));

const sha = createHash('sha256').update(readFileSync(OUT_CSV)).digest('hex');
console.log(`\nsha256(${path.relative(REPO_ROOT, OUT_CSV)}) = ${sha}`);
