// Equivalence proof: src/step1.js vs. the frozen poc/step1/step1.mjs.
// Over all 4171 corpus rows, compares NEW step1 against OLD applyStep1 on
// four things: class, rule, source (via sourceForRule) and matched (via
// matchedWordsForRule). A null on either side must equal a null on the
// other side (a null/non-null mismatch counts as a class difference). Also
// pins that READ_VERBS and SAFE_VERBS were transcribed correctly.
//
// The `matched` comparison is the load-bearing one: it proves the new
// return-it-directly approach equals the old re-derivation
// (matchedWordsForRule) on every row — which is what lets that
// re-derivation be deleted once this piece lands.
//
// KNOWN LIMIT: this comparison cannot detect a change to the SORT ORDER of
// a multi-word `matched` result, because no row in this corpus fires more
// than one list member for any step-1 rule (checked directly: 0 of 4171
// rows produce a '+'-joined matchedWordsForRule result). Sort-order
// correctness is pinned only by the constructed multi-match test in
// src/step1.test.js, not by this proof.
//
// Run with: node tools/proof-step1.js
// Prints "All pins hold." and exits 0 when every comparison is clean;
// otherwise prints the TRUE total differing-row count per comparison (every
// row is counted, not just the ones kept for display) plus a sample of up
// to the first 10, and exits 1.
import { loadRows } from './corpus.js';

import { applyStep1, READ_VERBS as OLD_READ_VERBS, SAFE_VERBS as OLD_SAFE_VERBS } from '../poc/step1/step1.mjs';
import { sourceForRule, matchedWordsForRule } from '../poc/step3/step3.mjs';

import { step1, READ_VERBS as NEW_READ_VERBS, SAFE_VERBS as NEW_SAFE_VERBS } from '../src/step1.js';

const rows = loadRows();
const MAX_REPORT = 10;

// Each entry holds `sample` (at most MAX_REPORT rows, for display) and
// `count` (every differing row, uncapped) — the two must never be
// conflated. `count` is what gets printed as "<name> differences: N"; a
// reader judging how bad a regression is reads that number, not the sample
// size, so it must be the true total or it lies about severity (a 3-row
// regression and a 1960-row regression must not both print "10").
const diffs = {
  class: { sample: [], count: 0 },
  rule: { sample: [], count: 0 },
  source: { sample: [], count: 0 },
  matched: { sample: [], count: 0 },
};

function recordDiff(entry, row, oldVal, newVal) {
  entry.count += 1;
  if (entry.sample.length < MAX_REPORT) {
    entry.sample.push({ rowId: row.rowId, method: row.method, operationId: row.operationId, old: oldVal, new: newVal });
  }
}

for (const row of rows) {
  const oldV = applyStep1(row);
  const newV = step1(row);

  const oldIsNull = oldV === null;
  const newIsNull = newV === null;

  if (oldIsNull !== newIsNull) {
    recordDiff(diffs.class, row, oldIsNull ? null : oldV.class, newIsNull ? null : newV.class);
    // Nothing else to compare for this row once one side is null and the
    // other isn't — rule/source/matched have no meaning on the null side.
    continue;
  }
  if (oldIsNull && newIsNull) continue; // both agree: not claimed

  if (oldV.class !== newV.class) {
    recordDiff(diffs.class, row, oldV.class, newV.class);
  }
  if (oldV.rule !== newV.rule) {
    recordDiff(diffs.rule, row, oldV.rule, newV.rule);
  }

  const oldSource = sourceForRule(oldV.rule);
  if (oldSource !== newV.source) {
    recordDiff(diffs.source, row, oldSource, newV.source);
  }

  const oldMatched = matchedWordsForRule(row, oldV.rule);
  const newMatched = newV.matched.join('+');
  if (oldMatched !== newMatched) {
    recordDiff(diffs.matched, row, oldMatched, newMatched);
  }
}

// --- word-list transcription pins ------------------------------------------

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const m of a) if (!b.has(m)) return false;
  return true;
}

const readVerbsEqual = setsEqual(OLD_READ_VERBS, NEW_READ_VERBS);
const safeVerbsEqual = setsEqual(OLD_SAFE_VERBS, NEW_SAFE_VERBS);
const listsEqual = readVerbsEqual && safeVerbsEqual;

// --- report ------------------------------------------------------------

console.log(`rows compared: ${rows.length}`);
console.log(`class differences: ${diffs.class.count}`);
console.log(`rule differences: ${diffs.rule.count}`);
console.log(`source differences: ${diffs.source.count}`);
console.log(`matched differences: ${diffs.matched.count}`);
console.log(`READ_VERBS: old ${OLD_READ_VERBS.size}, new ${NEW_READ_VERBS.size}, equal: ${readVerbsEqual}`);
console.log(`SAFE_VERBS: old ${OLD_SAFE_VERBS.size}, new ${NEW_SAFE_VERBS.size}, equal: ${safeVerbsEqual}`);
console.log(`word list equality: ${listsEqual}`);

const totalDiffs =
  diffs.class.count + diffs.rule.count + diffs.source.count + diffs.matched.count;

if (totalDiffs === 0 && listsEqual) {
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
    console.log(`rowId=${d.rowId} method=${d.method} operationId=${JSON.stringify(d.operationId)} old=${JSON.stringify(d.old)} new=${JSON.stringify(d.new)}`);
  }
}
if (!listsEqual) {
  console.log('\nword list equality FAILED (see READ_VERBS/SAFE_VERBS lines above).');
}

process.exit(1);
