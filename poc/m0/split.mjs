// The build/test split for M0's text signal (PRD §4.5 / §4.2).
// Split by repository, never by operation, so no repository's wording can
// leak from build into test: the 60 distinct repos in operations.csv are
// sorted ascending and alternated, index 0,2,4... to BUILD and 1,3,5... to
// TEST. This is fixed by sort order and must never be adjusted to change
// a result.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from './csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPERATIONS_CSV = path.join(HERE, '..', '..', 'data', 'camara-2026-09-01', 'operations.csv');

function computeRepos() {
  const rows = parseCsv(readFileSync(OPERATIONS_CSV, 'utf8'));
  const repos = [...new Set(rows.map((r) => r.repo))].sort();
  const build = new Set();
  const test = new Set();
  repos.forEach((repo, i) => {
    (i % 2 === 0 ? build : test).add(repo);
  });
  return { build, test };
}

const { build, test } = computeRepos();

export const BUILD_REPOS = build;
export const TEST_REPOS = test;

export function halfOf(repo) {
  if (BUILD_REPOS.has(repo)) return 'build';
  if (TEST_REPOS.has(repo)) return 'test';
  throw new Error(`unknown repo: ${repo}`);
}
