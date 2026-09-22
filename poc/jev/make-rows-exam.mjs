// Builds the Jev row set for the clean exam data/exam-2026-09-20/.
//
// No `truth` field: this exam is unlabelled, and that is the point — the
// rows go to Jev before any label exists.
//
// `flowClass` is the frozen mechanical tool's own prediction, recorded here
// so the raise-only tier can later be scored on the subset the flow calls
// `w`. It is NEVER sent to Jev: stateFor() in criteria.mjs is the only thing
// that reaches the API, and it is frozen.
//
// Usage: node poc/jev/make-rows-exam.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseCsv } from '/home/hamr/PycharmProjects/rwxmap/tools/csv.js';
import { classifyRow } from '/home/hamr/PycharmProjects/rwxmap/src/index.js';

const DIR = '/home/hamr/PycharmProjects/rwxmap/data/exam-2026-09-20/';
const OUT = '/home/hamr/PycharmProjects/rwxmap/data/jev-2026-09-20/rowsE-exam.json';
const ID_COLS = ['provider', 'method', 'path', 'operationId'];
const EXPECTED = 1003;

function die(msg) {
  console.error('STOP: ' + msg);
  process.exit(1);
}

const keyPath = DIR + 'label/key.csv';
if (!existsSync(keyPath)) die(`${keyPath} does not exist yet — nothing to join against.`);

const ops = parseCsv(readFileSync(DIR + 'ops.csv', 'utf8'));
const key = parseCsv(readFileSync(keyPath, 'utf8'));

// Index ops by the composite id. Keep every hit so a non-1:1 join is caught
// rather than silently resolved by last-write-wins.
const idx = new Map();
for (const o of ops) {
  const k = ID_COLS.map((c) => o[c]).join('|');
  if (!idx.has(k)) idx.set(k, []);
  idx.get(k).push(o);
}

const rows = [];
const missing = [];
const ambiguous = [];
for (const k of key) {
  const id = ID_COLS.map((c) => k[c]).join('|');
  const hits = idx.get(id) || [];
  if (hits.length === 0) {
    missing.push(k.row_id + ' ' + id);
    continue;
  }
  if (hits.length > 1) {
    ambiguous.push(`${k.row_id} ${id} (${hits.length} ops rows)`);
    continue;
  }
  const o = hits[0];
  rows.push({
    row_id: k.row_id,
    provider: k.provider,
    method: o.method,
    path: o.path,
    operationId: o.operationId,
    summary: o.summary,
    description: o.description,
    flowClass: classifyRow({
      method: o.method,
      path: o.path,
      operationId: o.operationId,
      summary: o.summary,
      description: o.description,
    }).class,
  });
}

if (missing.length)
  die(`${missing.length} key rows have no ops row:\n  ` + missing.slice(0, 10).join('\n  '));
if (ambiguous.length)
  die(
    `${ambiguous.length} key rows match more than one ops row:\n  ` +
      ambiguous.slice(0, 10).join('\n  '),
  );

const dupIds = new Set();
const seen = new Set();
for (const r of rows) {
  if (seen.has(r.row_id)) dupIds.add(r.row_id);
  seen.add(r.row_id);
}
if (dupIds.size) die(`${dupIds.size} duplicate row_id values, e.g. ${[...dupIds][0]}`);

if (rows.length !== EXPECTED) die(`expected ${EXPECTED} rows, joined ${rows.length}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(rows, null, 1));

const tally = (pick) => {
  const m = new Map();
  for (const r of rows) m.set(pick(r), (m.get(pick(r)) || 0) + 1);
  return [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k}:${v}`).join(' ');
};

console.log(`rows ${rows.length} -> ${OUT}`);
console.log('flowClass ' + tally((r) => r.flowClass));
console.log('method    ' + tally((r) => r.method));
