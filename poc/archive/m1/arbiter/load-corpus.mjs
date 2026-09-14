// Loader for the single canonical labelled corpus (data/corpus/labelled.csv),
// built by poc/m1/corpus/build-labelled.mjs from the four loaders in
// load-sets.mjs. This is an ADDITIONAL path — load-sets.mjs and its four
// loaders are untouched and remain the source of truth the corpus is built
// from; nothing that reads them today changes.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../../m0/csv.mjs';
import { REPO_ROOT } from './load-sets.mjs';

export const LABELLED_CORPUS_PATH = path.join(REPO_ROOT, 'data/corpus/labelled.csv');

/**
 * Read data/corpus/labelled.csv and return its rows as an array of plain
 * objects keyed by column name (the CSV parser handles RFC-4180-ish
 * quoting: commas, quotes and newlines inside quoted fields round-trip).
 * @returns {Array<Record<string, string>>}
 */
export function loadLabelledCorpus() {
  const text = readFileSync(LABELLED_CORPUS_PATH, 'utf8');
  return parseCsv(text);
}
