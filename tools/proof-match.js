// Equivalence proof: src/key.js + src/match.js vs. the frozen
// poc/match/key.mjs + poc/match/match.mjs.
//
// Reuses poc/match/measure.mjs's spec-walking approach (the same four
// sets, the same specs.lock.json-driven file collection, the same
// deterministic id-rotation URL synthesis) to build one concrete URL per
// operation in every locked, loadable spec across the four sets
// (data/provider-corpus-2026-09-16, data/exam-2026-09-17,
// data/exam-2026-09-20, data/exam-2026-09-22), skipping digitalocean's
// resource fragments and hubspot's tar.gz collection exactly as
// measure.mjs does.
//
// For every synthesized (method, url):
//   - src requestKey(method, url) is compared BYTE-FOR-BYTE against
//     poc/match/key.mjs's requestKey(method, url) with its default
//     options (no mixedIds) — src.key.js ports only the adopted rules,
//     so the two must agree exactly under the POC's default call.
//   - src matchOperation(ops, servers, method, url) is compared against
//     poc/match/match.mjs's matchOperation on the same four inputs, on
//     op identity (by array index into the SAME `ops` array — both
//     matchers are handed the identical ops/servers), serverBase,
//     hostMatched, tie and tieCount.
//
// This file may import from poc/match/ (it exists only to compare
// against it), unlike src/ itself, which may not.
//
// Run with: node tools/proof-match.js
// Prints the total compared, then the TRUE differences count per
// comparison (every synthesized call counted, never capped by the
// display sample), then up to 10 examples of each. Exits 0 and prints
// "All pins hold." only when every comparison is clean; exits 1
// otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpec } from '../src/load.js';
import { operationsFrom } from '../src/index.js';

import { requestKey as requestKeyNew } from '../src/key.js';
import { matchOperation as matchOperationNew } from '../src/match.js';
import { requestKey as requestKeyRef } from '../poc/match/key.mjs';
import { matchOperation as matchOperationRef } from '../poc/match/match.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MAX_REPORT = 10;

const SETS = [
  'data/provider-corpus-2026-09-16',
  'data/exam-2026-09-17',
  'data/exam-2026-09-20',
  'data/exam-2026-09-22',
];

const ROTATION = [
  '12345',
  '550e8400-e29b-41d4-a716-446655440000',
  'abcdef0123456789abcdef01',
  'cus_NffrFeUfNV2Hib',
];
const NAME_OVERRIDE_RE = /name|slug|key/i;

/** @returns {{setDir: string, provider: string, filePath: string, lockPath: string}[]} */
function collectSpecFiles() {
  const files = [];
  for (const setDir of SETS) {
    const lockPath = path.join(REPO_ROOT, setDir, 'specs.lock.json');
    const entries = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    for (const entry of entries) {
      if (entry.provider === 'hubspot') continue; // tar.gz collection, not one loadable doc
      if (entry.provider === 'digitalocean' && entry.path.includes('/resources/')) continue; // fragments, skipped per the brief
      const filePath = path.join(REPO_ROOT, setDir, 'specs', entry.path);
      files.push({ setDir, provider: entry.provider, filePath, lockPath: entry.path });
    }
  }
  return files;
}

/**
 * @param {string} url
 * @param {Record<string, {default?: string, enum?: string[]}>} variables
 * @returns {string}
 */
function resolveServerVariables(url, variables) {
  if (!variables || typeof variables !== 'object') return url;
  return url.replace(/\{([^}]+)\}/g, (whole, name) => {
    const v = variables[name];
    if (!v) return whole;
    if (typeof v.default === 'string') return v.default;
    if (Array.isArray(v.enum) && v.enum.length > 0) return String(v.enum[0]);
    return name;
  });
}

/**
 * @param {any} doc
 * @returns {string[]} resolved, absolute server base URLs, doc order,
 *   deduplicated by exact string.
 */
function resolvedServers(doc) {
  const urls = [];
  if (Array.isArray(doc.servers) && doc.servers.length > 0) {
    for (const s of doc.servers) {
      if (!s || typeof s.url !== 'string') continue;
      urls.push(resolveServerVariables(s.url, s.variables));
    }
  } else if (typeof doc.host === 'string' && doc.host) {
    // Swagger 2.
    const scheme = Array.isArray(doc.schemes) && doc.schemes.length > 0 ? doc.schemes[0] : 'https';
    const basePath = typeof doc.basePath === 'string' ? doc.basePath : '';
    urls.push(`${scheme}://${doc.host}${basePath}`);
  }
  return [...new Set(urls)];
}

/**
 * @param {string} templatePath
 * @param {[number]} counterRef
 * @returns {string}
 */
function fillTemplate(templatePath, counterRef) {
  return templatePath.replace(/\{([^}]+)\}/g, (whole, name) => {
    if (NAME_OVERRIDE_RE.test(name)) return 'acme-prod';
    const value = ROTATION[counterRef[0] % ROTATION.length];
    counterRef[0] += 1;
    return value;
  });
}

/** @param {string} base */
function stripTrailingSlash(base) {
  return base.endsWith('/') && base.length > 1 ? base.slice(0, -1) : base;
}

// Each entry holds `sample` (at most MAX_REPORT rows, for display) and
// `count` (every differing call, uncapped) — the two must never be
// conflated; `count` is the true total printed, never the display sample
// size.
const diffs = {
  key: { sample: [], count: 0 },
  matchIdentity: { sample: [], count: 0 },
  matchServerBase: { sample: [], count: 0 },
  matchHostMatched: { sample: [], count: 0 },
  matchTie: { sample: [], count: 0 },
  matchTieCount: { sample: [], count: 0 },
};

function recordDiff(bucket, detail) {
  bucket.count += 1;
  if (bucket.sample.length < MAX_REPORT) bucket.sample.push(detail);
}

let totalCompared = 0;

async function measureOneSpec(file) {
  let doc;
  try {
    ({ doc } = await loadSpec(file.filePath));
  } catch {
    return; // unloadable spec: nothing to compare for it (same as measure.mjs's loadError skip)
  }

  const ops = operationsFrom(doc);
  const servers = resolvedServers(doc);
  if (servers.length === 0) return; // no servers to build a URL against (same as measure.mjs's noServers skip)

  const primaryBase = stripTrailingSlash(servers[0]);
  const counterRef = [0];

  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx];
    const filledPath = fillTemplate(op.path || '', counterRef);
    const url = `${primaryBase}${filledPath}`;
    totalCompared += 1;

    // --- requestKey ---
    let keyNew, keyNewErr, keyRef, keyRefErr;
    try { keyNew = requestKeyNew(op.method, url); } catch (err) { keyNewErr = err instanceof Error ? err.message : String(err); }
    try { keyRef = requestKeyRef(op.method, url); } catch (err) { keyRefErr = err instanceof Error ? err.message : String(err); }
    if (keyNewErr !== undefined || keyRefErr !== undefined) {
      if (keyNewErr !== keyRefErr) {
        recordDiff(diffs.key, { provider: file.provider, method: op.method, path: op.path, url, detail: `throw: new="${keyNewErr}" ref="${keyRefErr}"` });
      }
    } else if (keyNew !== keyRef) {
      recordDiff(diffs.key, { provider: file.provider, method: op.method, path: op.path, url, detail: `new=${JSON.stringify(keyNew)} ref=${JSON.stringify(keyRef)}` });
    }

    // --- matchOperation ---
    let mNew, mNewErr, mRef, mRefErr;
    try { mNew = matchOperationNew(ops, servers, op.method, url); } catch (err) { mNewErr = err instanceof Error ? err.message : String(err); }
    try { mRef = matchOperationRef(ops, servers, op.method, url); } catch (err) { mRefErr = err instanceof Error ? err.message : String(err); }

    if (mNewErr !== undefined || mRefErr !== undefined) {
      if (mNewErr !== mRefErr) {
        recordDiff(diffs.matchIdentity, { provider: file.provider, method: op.method, path: op.path, url, detail: `throw: new="${mNewErr}" ref="${mRefErr}"` });
      }
      continue;
    }

    const newIsNull = mNew === null;
    const refIsNull = mRef === null;
    if (newIsNull !== refIsNull) {
      recordDiff(diffs.matchIdentity, { provider: file.provider, method: op.method, path: op.path, url, detail: `null mismatch: new=${newIsNull ? 'null' : 'match'} ref=${refIsNull ? 'null' : 'match'}` });
      continue;
    }
    if (newIsNull && refIsNull) continue;

    // Op identity: both matchers were handed the SAME `ops` array, so
    // identity is compared by index into it.
    const newIdx = ops.indexOf(mNew.op);
    const refIdx = ops.indexOf(mRef.op);
    if (newIdx !== refIdx) {
      recordDiff(diffs.matchIdentity, { provider: file.provider, method: op.method, path: op.path, url, detail: `op idx new=${newIdx} (${mNew.op.method} ${mNew.op.path}) ref=${refIdx} (${mRef.op.method} ${mRef.op.path})` });
    }
    if (mNew.serverBase !== mRef.serverBase) {
      recordDiff(diffs.matchServerBase, { provider: file.provider, method: op.method, path: op.path, url, detail: `new=${JSON.stringify(mNew.serverBase)} ref=${JSON.stringify(mRef.serverBase)}` });
    }
    if (mNew.hostMatched !== mRef.hostMatched) {
      recordDiff(diffs.matchHostMatched, { provider: file.provider, method: op.method, path: op.path, url, detail: `new=${mNew.hostMatched} ref=${mRef.hostMatched}` });
    }
    if (mNew.tie !== mRef.tie) {
      recordDiff(diffs.matchTie, { provider: file.provider, method: op.method, path: op.path, url, detail: `new=${mNew.tie} ref=${mRef.tie}` });
    }
    if (mNew.tieCount !== mRef.tieCount) {
      recordDiff(diffs.matchTieCount, { provider: file.provider, method: op.method, path: op.path, url, detail: `new=${mNew.tieCount} ref=${mRef.tieCount}` });
    }
  }
}

async function main() {
  const files = collectSpecFiles();
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    await measureOneSpec(f);
  }

  console.log(`Compared ${totalCompared} synthesized calls across ${files.length} spec files, ${SETS.length} sets.`);

  const totalDiffs = Object.values(diffs).reduce((n, d) => n + d.count, 0);
  for (const [name, entry] of Object.entries(diffs)) {
    console.log(`${name} differences: ${entry.count}`);
  }

  if (totalDiffs === 0) {
    console.log('All pins hold.');
    process.exit(0);
  }

  for (const [name, entry] of Object.entries(diffs)) {
    if (entry.count === 0) continue;
    const heading = entry.count > MAX_REPORT
      ? `first ${entry.sample.length} of ${entry.count} differences: ${name}`
      : `differences: ${name}`;
    console.log(`\n--- ${heading} ---`);
    for (const d of entry.sample) {
      console.log(`[${d.provider}] ${d.method} ${d.path}  (${d.url})  ${d.detail}`);
    }
  }
  process.exit(1);
}

await main();
