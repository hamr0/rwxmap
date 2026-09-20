// data/exam5-2026-09-14: relabel exam 5's POST rows under the brief revised
// 2026-09-15 (data/calibration-2026-09-14/BRIEF.md, POST paragraph fixed and
// checked once on the corpus POST holdback — see
// data/calibration-2026-09-15/README.md "Revised brief check"). Exam 5's
// original POST truth came from the brief before that fix and is not
// trustworthy (POST creates called w where corpus truth calls them x).
//
// Reads exam-blind.csv and exam-key.csv, selects the 300 rows whose key
// stratum is POST, in the order they appear in exam-blind.csv, and writes
// two blind labelling parts (150 + 150) with the same header and columns as
// exam-blind.csv. Deterministic: no randomness, same input -> same output.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv, toCsv } from '../flow/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const D = path.join(ROOT, 'data', 'exam5-2026-09-14') + path.sep;

const BLIND_HEADER = ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];

const blind = parseCsv(readFileSync(D + 'exam-blind.csv', 'utf8'));
const keyRows = parseCsv(readFileSync(D + 'exam-key.csv', 'utf8'));
const keyById = new Map(keyRows.map((k) => [k.row_id, k]));

const postRows = [];
for (const b of blind) {
  const k = keyById.get(b.row_id);
  if (!k) throw new Error('no key for row ' + b.row_id);
  if (k.stratum !== 'POST') continue;
  if (b.method !== 'POST') {
    throw new Error(`row ${b.row_id} has POST stratum but method ${b.method}`);
  }
  postRows.push(b);
}

if (postRows.length !== 300) {
  throw new Error(`expected 300 POST-stratum rows, got ${postRows.length}`);
}
for (const r of postRows) {
  if (r.method !== 'POST') throw new Error(`row ${r.row_id} is not POST`);
}

const part1 = postRows.slice(0, 150);
const part2 = postRows.slice(150, 300);
if (part1.length !== 150 || part2.length !== 150) {
  throw new Error(`expected 150+150, got ${part1.length}+${part2.length}`);
}

writeFileSync(D + 'exam-post-blind-part1.csv', toCsv(part1, BLIND_HEADER));
writeFileSync(D + 'exam-post-blind-part2.csv', toCsv(part2, BLIND_HEADER));

console.log('wrote', part1.length, 'rows to exam-post-blind-part1.csv');
console.log('wrote', part2.length, 'rows to exam-post-blind-part2.csv');
process.exit(0);
