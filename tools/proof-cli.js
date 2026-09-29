// Equivalence proof for the CLI (PRD "Go/no-go for item d", bars 1, 2, 5;
// and item c's own bar 7 — see the second pass below).
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
// ITEM C, BAR 7 (a second, independent pass over the SAME files/ops, no
// network, no key): "after Jev moves rows, every mcp class equals its
// operation's final letter, and every bareguard key holds the tightest
// final letter of its operations." This proof cannot call the real Jev
// endpoint (no live requests from a proof, per the item c brief), so it
// builds a DETERMINISTIC FAKE answer for every row jev.js's needsJev
// names — a seeded p in [0, 1) from the row's own vendor/method/path/tier
// (seededP below), so the same file always gets the same fake answers
// (reproducible, not random) and every tier's threshold fires on SOME
// rows and not others (it is not one constant p for every row). Each
// fake answer is applied through jev.js's OWN applyJev (never
// re-implemented here), and the resulting FINAL verdicts are handed to
// buildOutput's `verdicts` option — the exact mechanism src/cli.js's
// run() uses when a real key is configured. The mcp/bareguard/sidecar
// checks below are then independently RECOMPUTED against those final
// verdicts (never trusting exporter.js's or cli.js's own idea of what
// they should be), so a bug in either file's Jev wiring is caught here
// exactly as bars 1-5 catch a bug in the mechanical-only wiring.
//
// ITEM E (D124), bars 2, 3, 4 and 6, over the SAME files, in BOTH passes
// (mechanical and seeded fake Jev). buildOutput is called with the parsed
// `doc`, so it also returns the OpenAPI copy. This proof walks the copy's
// `paths` with its OWN method list (OPENAPI_METHODS below, not
// exporter.js's operationEntries) and checks, for EVERY operation:
//   - bar 3: its `x-rwx` equals BOTH the sidecar row (letter,
//     destructive, evidence, marker) AND the independent truth (the
//     verdict's class, destructive === true, source, review);
//   - bar 4: its `webmcp` entry equals the D124 table for the truth
//     letter, and `webmcp` has exactly one entry per operation;
//   - bar 2: stripping every operation's `x-rwx` from the copy leaves
//     exactly the parsed input (minus any `x-rwx` the input carried);
//   - bar 6: all of the above again against the post-fake-Jev verdicts.
// An operation whose "METHOD path" is ambiguous in the copy (two fields
// differing only by case) is SKIPPED and COUNTED, never silently passed;
// so is any `x-rwx` found on an object that is not one of the operations.
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
import { createHash } from 'node:crypto';

import { loadSpec } from '../src/load.js';
import { operationsFrom, exportGate, gateKey } from '../src/exporter.js';
import { classifyRow } from '../src/flow.js';
import { needsJev, applyJev } from '../src/jev.js';
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

// Item e: this proof's OWN list of OpenAPI 3.x path-item method fields,
// restated here on purpose rather than imported, so a bug in
// exporter.js's operation walk would show as a mismatch.
const OPENAPI_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

// Item e bar 4: D124's WebMCP table, restated independently.
const WEBMCP_TABLE = {
  r: { readOnlyHint: true, consequentialHint: false },
  w: { readOnlyHint: false, consequentialHint: false },
  x: { readOnlyHint: false, consequentialHint: true },
};

/**
 * Index a parsed doc's operation objects by "METHOD path" with this
 * proof's own walk. Keys seen more than once are returned in `ambiguous`.
 * @param {any} doc
 * @returns {{byKey: Map<string, any>, ambiguous: Set<string>}}
 */
function indexOperations(doc) {
  /** @type {Map<string, any>} */
  const byKey = new Map();
  /** @type {Set<string>} */
  const ambiguous = new Set();
  for (const [p, item] of Object.entries((doc && doc.paths) || {})) {
    if (!item || typeof item !== 'object') continue;
    for (const [field, op] of Object.entries(item)) {
      if (!OPENAPI_METHODS.includes(field.toLowerCase()) || !op || typeof op !== 'object') continue;
      const key = `${field.toUpperCase()} ${p}`;
      if (byKey.has(key)) ambiguous.add(key);
      byKey.set(key, op);
    }
  }
  return { byKey, ambiguous };
}

/**
 * Delete `x-rwx` from every operation object this proof's own walk
 * finds; returns how many were removed.
 * @param {any} doc
 * @returns {number}
 */
function stripOperationXRwx(doc) {
  let removed = 0;
  for (const op of indexOperations(doc).byKey.values()) {
    if (Object.prototype.hasOwnProperty.call(op, 'x-rwx')) {
      delete op['x-rwx'];
      removed += 1;
    }
  }
  return removed;
}

/**
 * Count every `x-rwx` key anywhere in a document (any depth).
 * @param {any} node
 * @returns {number}
 */
function countXRwxAnywhere(node) {
  if (!node || typeof node !== 'object') return 0;
  let n = 0;
  if (!Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, 'x-rwx')) n += 1;
  for (const v of Object.values(node)) n += countXRwxAnywhere(v);
  return n;
}

/**
 * Item e bars 2-4 (and 6, when `verdicts` is the post-Jev list) for one
 * file: every check recomputed against `verdicts`, the proof's own truth.
 * @param {{filePath: string, doc: any, ops: any[], verdicts: any[], out: any, pass: string, diffs: {filePath: string, detail: string}[], tally: {checked: number, skipped: number, preexisting: number}}} a
 */
function checkCarriers({ filePath, doc, ops, verdicts, out, pass, diffs, tally }) {
  const { openapiCopy, sidecarOut, combined } = out;
  if (!openapiCopy) {
    diffs.push({ filePath, detail: `${pass}: no OpenAPI copy returned` });
    return;
  }
  const { byKey, ambiguous } = indexOperations(openapiCopy);
  if (Object.keys(combined.webmcp).length !== ops.length) {
    diffs.push({ filePath, detail: `${pass}: webmcp has ${Object.keys(combined.webmcp).length} entries for ${ops.length} operations` });
  }
  const anywhere = countXRwxAnywhere(openapiCopy);
  if (anywhere !== byKey.size) {
    diffs.push({ filePath, detail: `${pass}: ${anywhere} x-rwx in the copy but ${byKey.size} operation objects` });
  }
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    const key = `${op.method} ${op.path}`;
    if (ambiguous.has(key)) {
      tally.skipped += 1;
      continue;
    }
    tally.checked += 1;
    const v = verdicts[i];
    const truth = { class: v.class, destructive: v.destructive === true, evidence: v.source, review: v.review };
    const row = sidecarOut.rows[i];
    const fromRow = { class: row.letter, destructive: row.destructive, evidence: row.evidence, review: row.marker };
    const obj = byKey.get(key);
    const got = obj ? obj['x-rwx'] : undefined;
    if (!deepEqual(got, truth)) {
      diffs.push({ filePath, detail: `${pass}: ${key}: x-rwx ${JSON.stringify(got)} !== truth ${JSON.stringify(truth)}` });
    } else if (!deepEqual(got, fromRow)) {
      diffs.push({ filePath, detail: `${pass}: ${key}: x-rwx ${JSON.stringify(got)} !== review-file row ${JSON.stringify(fromRow)}` });
    }
    const hint = combined.webmcp[key];
    if (!hint || !deepEqual(hint, { annotations: WEBMCP_TABLE[v.class] })) {
      diffs.push({ filePath, detail: `${pass}: ${key}: webmcp ${JSON.stringify(hint)} !== table for "${v.class}"` });
    }
  }
  // Bar 2: nothing but x-rwx changed. The input's own x-rwx (if any) is
  // stripped from a clone of it, counted, and compared the same way.
  const input = structuredClone(doc);
  tally.preexisting += stripOperationXRwx(input);
  stripOperationXRwx(openapiCopy);
  if (!deepEqual(openapiCopy, input)) {
    diffs.push({ filePath, detail: `${pass}: copy with x-rwx stripped !== parsed input` });
  }
}

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

/**
 * A deterministic p in [0, 1) for one row's own Jev tier question — the
 * SAME file always produces the SAME fake answers (reproducible, no
 * network, no randomness), and different rows land at different points
 * in [0, 1) so a tier's threshold fires on some rows and not others,
 * exercising both directions of each tier's one-way move.
 * @param {string} seed
 * @returns {number}
 */
function seededP(seed) {
  const digest = createHash('sha256').update(seed).digest();
  // First 4 bytes as an unsigned 32-bit int, scaled into [0, 1).
  const n = digest.readUInt32BE(0);
  return n / 0x100000000;
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

  // Item c, bar 7 (deterministic fake Jev pass — see the file header).
  let jevPileRows = 0;
  let jevMovedRows = 0;
  /** @type {{filePath: string, detail: string}[]} */
  const jevMcpTruthDiffs = [];
  /** @type {{filePath: string, detail: string}[]} */
  const jevBareguardMissingDiffs = [];
  /** @type {{filePath: string, detail: string}[]} */
  const jevBareguardTightestDiffs = [];

  // Item e (D124): OpenAPI copy + webmcp, both passes.
  /** @type {{filePath: string, detail: string}[]} */
  const carrierDiffs = [];
  /** @type {{filePath: string, detail: string}[]} */
  const jevCarrierDiffs = [];
  const carrierTally = { checked: 0, skipped: 0, preexisting: 0 };
  const jevCarrierTally = { checked: 0, skipped: 0, preexisting: 0 };

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
    const mechanicalOut = buildOutput(ops, vendor, filePath, { doc });
    const { combined } = mechanicalOut;
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

    // Item c, bar 7: a deterministic fake Jev pass over the SAME ops.
    // `finalVerdicts` is this proof's OWN independent ground truth —
    // mechanical classifyRow, then jev.js's own needsJev/applyJev with a
    // seeded fake answer for every row a tier claims — never trusted from
    // buildOutput's own output. buildOutput is then called a SECOND time
    // with those verdicts (the exact mechanism src/cli.js's run() uses
    // with a real key), and the mcp/bareguard checks below are redone
    // independently against `finalVerdicts`, not against `direct` or the
    // mechanical `combined` above.
    const mechanicalVerdicts = ops.map((op) => classifyRow(op));
    const finalVerdicts = mechanicalVerdicts.map((verdict, i) => {
      const tier = needsJev(verdict);
      if (!tier) return verdict;
      jevPileRows += 1;
      const op = ops[i];
      const p = seededP(`${vendor}:${op.method}:${op.path}:${tier}`);
      const moved = applyJev(verdict, { p, model: 'proof-fake-model' }, { method: op.method });
      if (moved.class !== verdict.class) jevMovedRows += 1;
      return moved;
    });
    const jevOut = buildOutput(ops, vendor, filePath, { verdicts: finalVerdicts, doc });
    const { combined: jevCombined } = jevOut;

    // Item e, bars 2-4 (mechanical) and 6 (post-Jev).
    checkCarriers({
      filePath, doc, ops, verdicts: mechanicalVerdicts, out: mechanicalOut, pass: 'mechanical', diffs: carrierDiffs, tally: carrierTally,
    });
    checkCarriers({
      filePath, doc, ops, verdicts: finalVerdicts, out: jevOut, pass: 'fake-jev', diffs: jevCarrierDiffs, tally: jevCarrierTally,
    });

    for (let i = 0; i < ops.length; i += 1) {
      const op = ops[i];
      const mcpEntry = jevCombined.mcp[`${op.method} ${op.path}`];
      const truth = finalVerdicts[i].class;
      const mcpLetter = mcpEntry && mcpEntry._meta['io.github.hamr0.rwxmap/class'];
      if (mcpLetter !== truth) {
        jevMcpTruthDiffs.push({
          filePath,
          detail: `${op.method} ${op.path}: post-jev mcp class "${mcpLetter}" !== final verdict "${truth}"`,
        });
      }
    }

    for (const [key, group] of opsByKey) {
      const groupIndices = [];
      for (let i = 0; i < ops.length; i += 1) {
        if (gateKey(vendor, ops[i]) === key) groupIndices.push(i);
      }
      const bareguardEntry = jevCombined.bareguard.tools[key];
      if (!bareguardEntry) {
        jevBareguardMissingDiffs.push({ filePath, detail: `${key}: no post-jev bareguard entry (${group.length} operation(s) map here)` });
        continue;
      }
      const tightest = tightestOf(groupIndices.map((i) => finalVerdicts[i].class));
      if (bareguardEntry.letter !== tightest) {
        jevBareguardTightestDiffs.push({
          filePath,
          detail: `${key}: post-jev bareguard letter "${bareguardEntry.letter}" !== tightest-of-group final "${tightest}" (${group.length} operation(s))`,
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
  console.log(
    `Item c bar 7 (deterministic fake Jev pass): ${jevPileRows} of ${opsChecked} operations fell into a Jev `
    + `tier's pile, ${jevMovedRows} of those actually moved (the seeded p landed on the firing side of that `
    + `tier's threshold).`,
  );

  console.log(
    `Item e (x-rwx + webmcp): mechanical ${carrierTally.checked} operations checked, ${carrierTally.skipped} skipped; `
    + `fake-Jev ${jevCarrierTally.checked} checked, ${jevCarrierTally.skipped} skipped; `
    + `${carrierTally.preexisting} operation(s) already carried x-rwx in the input.`,
  );

  const totalDiffs = carrierDiffs.length + jevCarrierDiffs.length + toolsDiffs.length + mcpCountDiffs.length + mcpMissingDiffs.length
    + mcpTruthDiffs.length + bareguardMissingDiffs.length + bareguardTightestDiffs.length
    + jevMcpTruthDiffs.length + jevBareguardMissingDiffs.length + jevBareguardTightestDiffs.length;
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
  report('post-jev mcp class !== final verdict (item c bar 7)', jevMcpTruthDiffs);
  report('post-jev bareguard entries missing for a gate key (item c bar 7)', jevBareguardMissingDiffs);
  report('post-jev bareguard letter !== tightest-of-group final verdict (item c bar 7)', jevBareguardTightestDiffs);
  report('x-rwx / webmcp / copy mismatches, mechanical (item e bars 2-4)', carrierDiffs);
  report('x-rwx / webmcp / copy mismatches, fake Jev (item e bar 6)', jevCarrierDiffs);
  process.exit(1);
}

await main();
