// Corpus loader for poc/step1 — reads the 15-provider corpus
// (data/provider-corpus-2026-09-16) and joins the 21 blind labelling files
// onto it. Imports nothing from poc/flow or poc/archive.
//
// The join is BY ROW INDEX: key.csv row N describes ops.csv row N. That is
// the only link between the two files, so every index is re-checked on
// method and operationId and the load hard-fails on the first disagreement.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from './csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const CORPUS_DIR = path.join(REPO_ROOT, 'data/provider-corpus-2026-09-16');
const OPS_GZ = path.join(CORPUS_DIR, 'ops.csv.gz');
const LABEL_DIR = path.join(CORPUS_DIR, 'label');
const KEY_CSV = path.join(LABEL_DIR, 'key.csv');
const LABEL_PARTS = 21;

export const EXPECTED_ROWS = 4171;

const CLASSES = new Set(['r', 'w', 'x']);

/**
 * Load every corpus row with its truth label attached.
 * @returns {Array<{rowId:string, provider:string, method:string, path:string,
 *   operationId:string, summary:string, description:string, truth:string,
 *   confidence:string}>}
 */
export function loadRows() {
  const ops = parseCsv(gunzipSync(readFileSync(OPS_GZ)).toString('utf8'));
  const key = parseCsv(readFileSync(KEY_CSV, 'utf8'));

  if (ops.length !== EXPECTED_ROWS) {
    throw new Error(`ops.csv.gz has ${ops.length} rows, expected ${EXPECTED_ROWS}`);
  }
  if (key.length !== EXPECTED_ROWS) {
    throw new Error(`key.csv has ${key.length} rows, expected ${EXPECTED_ROWS}`);
  }

  // row_id -> { truth_class, confidence }, from all 21 labels files.
  const truthById = new Map();
  for (let part = 1; part <= LABEL_PARTS; part++) {
    const file = path.join(LABEL_DIR, `labels-${String(part).padStart(2, '0')}.csv`);
    for (const lab of parseCsv(readFileSync(file, 'utf8'))) {
      const rowId = (lab.row_id || '').trim();
      if (!rowId) continue;
      const truth = (lab.truth_class || '').trim();
      if (!CLASSES.has(truth)) {
        throw new Error(`labels-${String(part).padStart(2, '0')}.csv: row ${rowId} has truth_class "${truth}", expected one of r/w/x`);
      }
      if (truthById.has(rowId)) {
        throw new Error(`row ${rowId} is labelled twice (second time in labels-${String(part).padStart(2, '0')}.csv)`);
      }
      truthById.set(rowId, { truth, confidence: (lab.confidence || '').trim() });
    }
  }

  const rows = [];
  for (let i = 0; i < EXPECTED_ROWS; i++) {
    const op = ops[i];
    const k = key[i];
    if ((k.method || '') !== (op.method || '')) {
      throw new Error(`row index ${i} (${k.row_id}): key.csv method "${k.method}" != ops.csv method "${op.method}" — the two files are not in the same order`);
    }
    if ((k.operationId || '') !== (op.operationId || '')) {
      throw new Error(`row index ${i} (${k.row_id}): key.csv operationId "${k.operationId}" != ops.csv operationId "${op.operationId}" — the two files are not in the same order`);
    }
    const label = truthById.get(k.row_id);
    if (!label) throw new Error(`row ${k.row_id} has no truth label in any labels-NN.csv`);
    rows.push({
      rowId: k.row_id,
      provider: op.provider || '',
      method: op.method || '',
      path: op.path || '',
      operationId: op.operationId || '',
      summary: op.summary || '',
      description: op.description || '',
      truth: label.truth,
      confidence: label.confidence,
    });
  }
  return rows;
}
