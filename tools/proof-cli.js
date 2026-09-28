// Equivalence proof for the CLI (PRD "Go/no-go for item d", bars 1, 2, 5).
//
// For every spec file the same four sets use (data/provider-corpus-
// 2026-09-16, data/exam-2026-09-17, data/exam-2026-09-20,
// data/exam-2026-09-22 — the same 722 files tools/proof-load.js and
// tools/proof-match.js cover), this builds the CLI's combined object
// through src/cli.js's OWN buildOutput function — never a re-derived
// copy of it — and checks, per file:
//
//   1. combined.bareguard.tools deep-equals exportGate(ops, { vendor
//      }).tools called directly (0 differences) — bar 1.
//   2. Object.keys(combined.mcp).length === ops.length (no duplicate
//      "METHOD path" key arose) — bar 2.
//   3. EVERY operation's mcp entry (mcp is keyed "METHOD path", so it is
//      always one entry per operation, collision or not) has a class
//      equal to classifyRow(op).class, called directly — bar 2 + bar 5.
//      No operation is skipped for this check.
//   4. EVERY gate key's bareguard letter equals the TIGHTEST
//      classifyRow letter among ALL operations that map to that key —
//      for an uncontested key that is trivially its one operation's own
//      letter; for a collided key (several operations sharing one
//      gateKey, exporter.js's own documented D103/D91 behaviour) it is
//      the tightest of the group, which is exporter.js's own contract
//      for a collision, restated here independently rather than
//      re-imported, so a bug in exporter.js's collision resolution would
//      also be caught. No key is skipped for this check either — a
//      previous version of this proof silently excluded collided keys
//      from the per-operation comparison (measured: 521 of 11,505
//      operations, 2026-09-28); that skip is gone, and this file no
//      longer has one anywhere.
//
// No file is ever written — buildOutput takes operations in memory and
// returns the two JSON-able objects; this proof never calls run() or
// touches fs.writeFileSync.
//
// Vendor: the corpus's own `provider` field from each set's
// specs.lock.json, one classification pass per file (same vendor for
// every operation in that file, as the CLI itself would use for a local
// file loaded with --vendor <provider>).
//
// Run with: node tools/proof-cli.js
// Prints the total compared (operations checked, collided operations,
// collided keys), then the TRUE differences count per comparison (never
// capped by the printed sample), then up to 10 examples of each kind.
// Exits 0 and prints "All pins hold." only when every comparison is
// clean; exits 1 otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

import { loadSpec } from '../src/load.js';
import { operationsFrom, exportGate, gateKey } from '../src/exporter.js';
import { classifyRow } from '../src/flow.js';
import { buildOutput } from '../src/cli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MAX_REPORT = 10;

const SETS = [
  'data/provider-corpus-2026-09-16',
  'data/exam-2026-09-17',
  'data/exam-2026-09-20',
  'data/exam-2026-09-22',
];

// The project's one invariant, r < w < x, as a number so two letters can
// be compared — mirrors exporter.js's own (unexported) TIGHTNESS. This
// proof restates it independently ON PURPOSE: it is checking exporter.js's
// collision resolution against classifyRow's own truth, not re-trusting
// exporter.js's own idea of "tighter". A 3-entry ordering, not the
// classification logic itself.
const TIGHTNESS = { r: 0, w: 1, x: 2 };

/**
 * @param {Array<'r'|'w'|'x'>} letters  Non-empty.
 * @returns {'r'|'w'|'x'}
 */
function tightestOf(letters) {
  let best = letters[0];
  for (const l of letters) {
    if (TIGHTNESS[l] > TIGHTNESS[best]) best = l;
  }
  return best;
}

/**
 * @returns {{ filePath: string, provider: string }[]}
 */
function collectFiles() {
  const files = [];
  for (const setDir of SETS) {
    const lockPath = path.join(REPO_ROOT, setDir, 'specs.lock.json');
    const entries = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    for (const entry of entries) {
      const filePath = path.join(REPO_ROOT, setDir, 'specs', entry.path);
      if (!fs.existsSync(filePath)) {
        throw new Error(`proof-cli: ${filePath}: named in ${lockPath} but not found on disk`);
      }
      files.push({ filePath, provider: entry.provider });
    }
  }
  return files;
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

  let filesChecked = 0;
  let opsChecked = 0;
  let collidedOps = 0;
  let collidedKeys = 0;

  /** @type {{filePath: string, detail: string}[]} */
  const toolsDiffs = [];
  /** @type {{filePath: string, detail: string}[]} */
  const mcpCountDiffs = [];
  /** @type {{filePath: string, detail: string}[]} */
  const mcpMissingDiffs = [];
  /** @type {{filePath: string, detail: string}[]} */
  const mcpTruthDiffs = [];
  /** @type {{filePath: string, detail: string}[]} */
  const bareguardMissingDiffs = [];
  /** @type {{filePath: string, detail: string}[]} */
  const bareguardTightestDiffs = [];
  /** @type {{filePath: string, detail: string}[]} */
  const loadErrors = [];

  for (const { filePath, provider } of files) {
    let doc;
    try {
      ({ doc } = await loadSpec(filePath));
    } catch (err) {
      loadErrors.push({ filePath, detail: err instanceof Error ? err.message : String(err) });
      continue;
    }
    const ops = operationsFrom(doc);
    if (ops.length === 0) continue;
    filesChecked += 1;
    opsChecked += ops.length;

    const vendor = provider;

    // Bar 1: bareguard.tools deep-equals a direct exportGate call.
    const direct = exportGate(ops, { vendor });
    const { combined } = buildOutput(ops, vendor, filePath);
    if (!deepEqual(combined.bareguard.tools, direct.tools)) {
      toolsDiffs.push({ filePath, detail: 'combined.bareguard.tools !== exportGate(ops, {vendor}).tools' });
    }

    // Bar 2: one mcp entry per operation.
    const mcpKeys = Object.keys(combined.mcp);
    if (mcpKeys.length !== ops.length) {
      mcpCountDiffs.push({ filePath, detail: `mcp has ${mcpKeys.length} entries for ${ops.length} operations` });
    }

    // Check 3 (bar 2 + bar 5): EVERY operation, no skip. mcp is keyed
    // "METHOD path", which is unique per operation by construction (a
    // `paths` object can't repeat a path string, a path item can't
    // repeat a method), so this check never has a "which operation does
    // this key mean" ambiguity the way a collided gate key does.
    for (const op of ops) {
      const mcpEntry = combined.mcp[`${op.method} ${op.path}`];
      const truth = classifyRow(op).class;
      if (!mcpEntry) {
        mcpMissingDiffs.push({ filePath, detail: `${op.method} ${op.path}: no mcp entry for this operation` });
        continue;
      }
      const mcpLetter = mcpEntry._meta['io.github.hamr0.rwxmap/class'];
      if (mcpLetter !== truth) {
        mcpTruthDiffs.push({
          filePath,
          detail: `${op.method} ${op.path}: mcp class "${mcpLetter}" !== classifyRow "${truth}"`,
        });
      }
    }

    // Check 4 (bar 1 + bar 5): EVERY gate key, no skip. Group operations
    // by the SAME key gateKey(vendor, op) computes, then require the
    // bareguard entry's letter to equal the tightest classifyRow letter
    // across the whole group — for a group of one, that's just its own
    // letter; for a collided group, that's exporter.js's own documented
    // "tighter wins" contract, checked independently against classifyRow
    // rather than trusted from exportGate's own output.
    /** @type {Map<string, import('../src/types.js').Operation[]>} */
    const opsByKey = new Map();
    for (const op of ops) {
      const key = gateKey(vendor, op);
      const group = opsByKey.get(key);
      if (group) group.push(op);
      else opsByKey.set(key, [op]);
    }
    for (const [key, group] of opsByKey) {
      if (group.length > 1) {
        collidedKeys += 1;
        collidedOps += group.length;
      }
      const bareguardEntry = combined.bareguard.tools[key];
      if (!bareguardEntry) {
        bareguardMissingDiffs.push({ filePath, detail: `${key}: no bareguard entry (${group.length} operation(s) map here)` });
        continue;
      }
      const tightest = tightestOf(group.map((op) => classifyRow(op).class));
      if (bareguardEntry.letter !== tightest) {
        bareguardTightestDiffs.push({
          filePath,
          detail: `${key}: bareguard letter "${bareguardEntry.letter}" !== tightest-of-group "${tightest}" (${group.length} operation(s))`,
        });
      }
    }
  }

  console.log(`Checked ${filesChecked} spec files (${opsChecked} operations) across ${SETS.length} sets.`);
  console.log(`Collided operations: ${collidedOps} (across ${collidedKeys} collided gate keys).`);
  if (loadErrors.length > 0) {
    console.log(`Load errors (excluded from the counts above): ${loadErrors.length}`);
    for (const d of loadErrors.slice(0, MAX_REPORT)) console.log(`  [${d.filePath}] ${d.detail}`);
  }

  const totalDiffs = toolsDiffs.length + mcpCountDiffs.length + mcpMissingDiffs.length
    + mcpTruthDiffs.length + bareguardMissingDiffs.length + bareguardTightestDiffs.length;
  if (totalDiffs === 0) {
    console.log('All pins hold.');
    process.exit(0);
  }

  const report = (name, diffs) => {
    console.log(`${name}: ${diffs.length}`);
    for (const d of diffs.slice(0, MAX_REPORT)) console.log(`  [${d.filePath}] ${d.detail}`);
    if (diffs.length > MAX_REPORT) console.log(`  ...and ${diffs.length - MAX_REPORT} more`);
  };
  console.log(`Differences: ${totalDiffs}`);
  report('bareguard.tools mismatches (bar 1)', toolsDiffs);
  report('mcp entry-count mismatches (bar 2)', mcpCountDiffs);
  report('mcp entries missing for an operation (bar 2)', mcpMissingDiffs);
  report('mcp class !== classifyRow (bar 2 + bar 5)', mcpTruthDiffs);
  report('bareguard entries missing for a gate key (bar 1)', bareguardMissingDiffs);
  report('bareguard letter !== tightest-of-group classifyRow (bar 1 + bar 5)', bareguardTightestDiffs);
  process.exit(1);
}

await main();
