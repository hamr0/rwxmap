// Equivalence proof: src/load.js vs. the frozen poc/input/load.mjs.
//
// Loads every on-disk spec file named by the four sets' specs.lock.json
// (data/provider-corpus-2026-09-16, data/exam-2026-09-17,
// data/exam-2026-09-20, data/exam-2026-09-22) with BOTH loaders and
// compares: either both throw (same reason, with the source path stripped
// out of the message before comparing, since both are called with the
// same path anyway) or both succeed with identical sha256, bytes, format
// and a deep-equal operationsFrom(doc) output.
//
// PROOF_LOAD_SRC lets this be pointed at a scratch copy of src/load.js
// (outside the repo) to prove the proof can fail — see docs/logs/learnings.md.
//
// Run with: node tools/proof-load.js
// Prints the TRUE total differing-file count (every file counted, not just
// the ones kept for display) plus a sample of up to the first 10, and
// exits 1 on any difference; prints "All pins hold." and exits 0 otherwise.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

import { operationsFrom } from '../src/index.js';
import { loadSpec as loadSpecRef } from '../poc/input/load.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const MAX_REPORT = 10;

const loadSrcPath = process.env.PROOF_LOAD_SRC
  ? path.resolve(process.env.PROOF_LOAD_SRC)
  : path.join(repoRoot, 'src', 'load.js');
const { loadSpec: loadSpecNew } = await import(pathToFileURL(loadSrcPath).href);

const SETS = [
  'data/provider-corpus-2026-09-16',
  'data/exam-2026-09-17',
  'data/exam-2026-09-20',
  'data/exam-2026-09-22',
];

/**
 * @typedef {Object} SpecEntry
 * @property {string} provider
 * @property {string} path
 */

/** @returns {{ setDir: string, filePath: string, provider: string }[]} */
function collectFiles() {
  const files = [];
  for (const setDir of SETS) {
    const lockPath = path.join(repoRoot, setDir, 'specs.lock.json');
    /** @type {SpecEntry[]} */
    const entries = JSON.parse(readFileSync(lockPath, 'utf8'));
    for (const entry of entries) {
      const filePath = path.join(repoRoot, setDir, 'specs', entry.path);
      if (!existsSync(filePath)) {
        throw new Error(`proof-load: ${filePath}: named in ${lockPath} but not found on disk`);
      }
      files.push({ setDir, filePath, provider: entry.provider });
    }
  }
  return files;
}

/**
 * Strip the (identical, since both loaders see the same path) source path
 * out of an error message before comparing the two loaders' reasons, so a
 * message-formatting difference around the path itself can't hide as a
 * real behavioural difference — and can't hide a real one either.
 *
 * @param {string} message
 * @param {string} sourcePath
 * @returns {string}
 */
function stripSourcePath(message, sourcePath) {
  return message.split(sourcePath).join('<source>');
}

async function loadEither(fn, filePath) {
  try {
    const result = await fn(filePath);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

function deepEqual(a, b) {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const files = collectFiles();
  const diffs = [];

  for (const { filePath, provider } of files) {
    const [a, b] = await Promise.all([
      loadEither(loadSpecNew, filePath),
      loadEither(loadSpecRef, filePath),
    ]);

    if (a.ok !== b.ok) {
      diffs.push({
        provider, filePath,
        detail: `new ${a.ok ? 'succeeded' : `threw: ${a.reason}`}, ref ${b.ok ? 'succeeded' : `threw: ${b.reason}`}`,
      });
      continue;
    }

    if (!a.ok && !b.ok) {
      const reasonA = stripSourcePath(a.reason, filePath);
      const reasonB = stripSourcePath(b.reason, filePath);
      if (reasonA !== reasonB) {
        diffs.push({ provider, filePath, detail: `throw reason differs: new="${reasonA}" ref="${reasonB}"` });
      }
      continue;
    }

    // Both succeeded.
    const ra = a.result;
    const rb = b.result;
    if (ra.sha256 !== rb.sha256) {
      diffs.push({ provider, filePath, detail: `sha256 differs: new=${ra.sha256} ref=${rb.sha256}` });
      continue;
    }
    if (ra.bytes !== rb.bytes) {
      diffs.push({ provider, filePath, detail: `bytes differs: new=${ra.bytes} ref=${rb.bytes}` });
      continue;
    }
    if (ra.format !== rb.format) {
      diffs.push({ provider, filePath, detail: `format differs: new=${ra.format} ref=${rb.format}` });
      continue;
    }
    const opsA = operationsFrom(ra.doc);
    const opsB = operationsFrom(rb.doc);
    if (!deepEqual(opsA, opsB)) {
      diffs.push({ provider, filePath, detail: 'operationsFrom(doc) differs' });
    }
  }

  console.log(`Checked ${files.length} files across ${SETS.length} sets.`);
  if (diffs.length === 0) {
    console.log('All pins hold.');
    process.exit(0);
  }

  console.log(`Differences: ${diffs.length}`);
  for (const d of diffs.slice(0, MAX_REPORT)) {
    console.log(`  [${d.provider}] ${d.filePath}: ${d.detail}`);
  }
  if (diffs.length > MAX_REPORT) {
    console.log(`  ...and ${diffs.length - MAX_REPORT} more`);
  }
  process.exit(1);
}

await main();
