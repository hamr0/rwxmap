// poc/d87/proof-src.mjs — standalone equivalence proof, not a test.
//
// The src/ verdict is NO LONGER byte-identical to the frozen POC's: since
// D101 src carries a fourth field, `review`, which poc/d87/flow.mjs does not
// have and never will (the POC is the frozen reference and is not edited).
// So the old single claim — "src equals the frozen POC" — is not the whole
// truth any more, and this file no longer makes it. It makes two claims
// instead, and asserts both:
//
//   1a. CLASSIFICATION UNCHANGED. For every row of
//       data/combined-2026-09-21/rows.json.gz, the src verdict with its
//       `review` field removed is deep-equal to the frozen POC verdict.
//       This is the old claim at its old strength, over the old fields.
//   1b. REVIEW HINT CORRECT. For every one of those rows, the src verdict's
//       `review` equals the hint an INDEPENDENT restatement of the rule
//       (expectedHint, written out below from the specification, not copied
//       from src/flow.js and NOT imported from it) produces from
//       row.method, verdict.class and verdict.source. It also asserts that
//       every `review` seen is one of the three legal strings, so a row
//       carrying undefined or a typo fails instead of passing silently.
//       The frozen POC cannot make this comparison, so the claim is
//       asserted against the restated rule instead.
//
// The two are counted and printed separately, never collapsed into one
// number: "rows compared N, classification differences D, hint mismatches H".
// D and H are TRUE totals, never capped by the samples printed below them.
// Exits 1 if EITHER D > 0 or H > 0.
//
// Check 2 is unchanged:
//   2. Over data/jev-2026-09-22/rows-floor.json.gz joined with
//      out-floor.jsonl.gz (gzipped JSONL; answers.isX.noul = p, model
//      field), apply src applyJev to src classifyRow and print how many
//      rows were lowered (expect 804) and the model versions seen. Exits 1
//      if the lowered count is not 804.
//
// Run: node poc/d87/proof-src.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { classifyRow as srcClassifyRow } from '../../src/flow.js';
import { applyJev } from '../../src/jev.js';
import { classifyRow as pocClassifyRow } from './flow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

function readGzJson(p) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(p)));
}

// The review-hint rule, RESTATED HERE ON PURPOSE.
//
// This used to import reviewHint from src/flow.js and compare the verdict's
// `review` against it. That was tautological and proved nothing: classifyRow
// sets `review` by calling that same reviewHint, so both sides of the
// comparison came from one function and always agreed. It was caught by
// deliberately breaking src/flow.js — making reviewHint return 'BROKEN'
// instead of 'settled' — and watching the proof still print "hint mismatches
// 0" and exit 0. A real regression in the hint rule would have sailed
// straight through.
//
// So the rule is written out again below, from the specification rather than
// by copying src/flow.js. Duplicating it is the whole point: a proof that
// reuses the implementation it is checking is not a proof. If the two ever
// disagree, one of them changed and a human has to say which.
//
// Specification:
//   class 'x' AND method POST                            -> 'tight'
//   class 'w' AND method PUT|PATCH AND source 'floor'     -> 'loose'
//   otherwise                                             -> 'settled'
// Method is compared case-insensitively.
const LEGAL_HINTS = new Set(['tight', 'loose', 'settled']);

function expectedHint(method, cls, source) {
  const m = String(method ?? '').toUpperCase();
  if (cls === 'x' && m === 'POST') return 'tight';
  if (cls === 'w' && (m === 'PUT' || m === 'PATCH') && source === 'floor') return 'loose';
  return 'settled';
}

function deepEqual(a, b) {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

let exitCode = 0;

// --- check 1: src vs poc/d87, every row of the tuning corpus -------------
// Two claims, both asserted, both counted on their own ledger:
//   1a src-without-`review` == frozen POC verdict
//   1b src `review` == expectedHint(method, class, source), restated above

function checkSrcVsPoc() {
  const rowsPath = path.join(ROOT, 'data', 'combined-2026-09-21', 'rows.json.gz');
  const rows = readGzJson(rowsPath);

  let differences = 0;
  let hintMismatches = 0;
  let illegalHints = 0;
  const samples = [];
  const hintSamples = [];
  const illegalSamples = [];

  for (const row of rows) {
    const srcVerdict = srcClassifyRow(row);
    const pocVerdict = pocClassifyRow(row);

    // 1a: compare the classification only. `review` is lifted out by
    // destructuring — the verdict object src returned is never mutated.
    const { review, ...srcClassification } = srcVerdict;
    if (!deepEqual(srcClassification, pocVerdict)) {
      differences += 1;
      if (samples.length < 5) {
        samples.push({ row_id: row.row_id, provider: row.provider, srcClassification, pocVerdict });
      }
    }

    // 1b: the POC cannot answer this, so assert it against the restated rule.
    if (!LEGAL_HINTS.has(review)) {
      illegalHints += 1;
      if (illegalSamples.length < 5) {
        illegalSamples.push({ row_id: row.row_id, provider: row.provider, review });
      }
    }
    const wantHint = expectedHint(row.method, srcVerdict.class, srcVerdict.source);
    if (review !== wantHint) {
      hintMismatches += 1;
      if (hintSamples.length < 5) {
        hintSamples.push({
          row_id: row.row_id,
          provider: row.provider,
          method: row.method,
          class: srcVerdict.class,
          source: srcVerdict.source,
          review,
          expected: wantHint,
        });
      }
    }
  }

  console.log('claim 1a: src verdict minus `review` == frozen poc/d87 verdict (classification unchanged)');
  console.log('claim 1b: src `review` == expectedHint(method, class, source), the rule restated in this file (never imported)');
  console.log(
    `rows compared ${rows.length}, classification differences ${differences}, hint mismatches ${hintMismatches}, illegal hint values ${illegalHints}`,
  );

  if (differences > 0) {
    console.log('claim 1a FAILED — sample of differing rows (up to 5):');
    for (const s of samples) {
      console.log(`  ${s.row_id} (${s.provider})`);
      console.log(`    src (minus review): ${JSON.stringify(s.srcClassification)}`);
      console.log(`    poc:                ${JSON.stringify(s.pocVerdict)}`);
    }
    exitCode = 1;
  }

  if (illegalHints > 0) {
    console.log('claim 1b FAILED — `review` values outside {tight, loose, settled} (up to 5):');
    for (const s of illegalSamples) {
      console.log(`  ${s.row_id} (${s.provider}) src review: ${JSON.stringify(s.review)}`);
    }
    exitCode = 1;
  }

  if (hintMismatches > 0) {
    console.log('claim 1b FAILED — sample of wrong-hint rows (up to 5):');
    for (const s of hintSamples) {
      console.log(`  ${s.row_id} (${s.provider}) method=${s.method} class=${s.class} source=${s.source}`);
      console.log(`    src review: ${JSON.stringify(s.review)}`);
      console.log(`    expected:   ${JSON.stringify(s.expected)}`);
    }
    exitCode = 1;
  }
}

// --- check 2: src applyJev reproduces the 804-row lowering ---------------

function readOutJsonl(p) {
  const map = new Map();
  const text = zlib.gunzipSync(fs.readFileSync(p)).toString('utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const o = JSON.parse(line);
    map.set(o.row_id, o);
  }
  return map;
}

function checkJevLowering() {
  const floorRowsPath = path.join(ROOT, 'data', 'jev-2026-09-22', 'rows-floor.json.gz');
  const outPath = path.join(ROOT, 'data', 'jev-2026-09-22', 'out-floor.jsonl.gz');

  const floorRows = readGzJson(floorRowsPath);
  const outById = readOutJsonl(outPath);

  let lowered = 0;
  const models = new Set();

  for (const row of floorRows) {
    const out = outById.get(row.row_id);
    const p = out && !out.error && out.answers && out.answers.isX && typeof out.answers.isX.noul === 'number'
      ? out.answers.isX.noul
      : null;
    if (p === null) continue;

    const verdict = srcClassifyRow(row);
    const lower = applyJev(verdict, { p, model: out.model });
    if (lower.rule === 'jev-lower') {
      lowered += 1;
      models.add(lower.jev.model);
    }
  }

  console.log(`jev: ${floorRows.length} floor-post rows, lowered ${lowered}`);
  console.log(`jev: model versions seen: ${[...models].sort().join(', ')}`);
  if (lowered !== 804) {
    console.log(`jev: expected 804 lowered, got ${lowered}`);
    exitCode = 1;
  }
}

checkSrcVsPoc();
checkJevLowering();
process.exit(exitCode);
