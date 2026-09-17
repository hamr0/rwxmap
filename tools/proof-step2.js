// Equivalence proof: src/step2.js vs. the frozen poc/step2/step2.mjs.
// Over all 4171 corpus rows, compares NEW step2 against OLD applyStep2 on
// four things: class, rule, source (via sourceForRule) and matched (via
// matchedWordsForRule). A null on either side must equal a null on the
// other side (a null/non-null mismatch counts as a class difference). Also
// pins that MODIFY_VERBS and OTHER_PARTY were transcribed correctly.
//
// The `matched` comparison is the load-bearing one: it proves the new
// return-it-directly approach equals the old re-derivation
// (matchedWordsForRule) on every row.
//
// KNOWN LIMIT: this comparison cannot detect a change to the SORT ORDER of
// a multi-word `matched` result, because no row in this corpus fires more
// than one list member for any step-2 rule (checked directly below: 0 of
// 4171 rows produce a '+'-joined matchedWordsForRule result for a step-2
// rule). Sort-order correctness is pinned only by the constructed
// multi-match-shaped tests in src/step2.test.js's words-injection cases,
// not by this proof.
//
// KNOWN LIMIT: the OTHER_PARTY gate's summary-word contribution (wordsForRow
// including summaryWords, not just the operationId/path tokens) is thinly
// covered by this corpus — dropping summaryWords from wordsForRow only
// changes the class of 2 of the 4171 rows (verified directly). This proof
// still catches that break (2 class differences, both list-equality pins
// staying green since no list changed, only the logic), so the coverage
// gap is in the corpus, not in this proof's sensitivity.
//
// Run with: node tools/proof-step2.js
// Prints "All pins hold." and exits 0 when every comparison is clean;
// otherwise prints the TRUE total differing-row count per comparison (every
// row is counted, not just the ones kept for display) plus a sample of up
// to the first 10, and exits 1.
import { loadRows } from './corpus.js';

import { applyStep2, MODIFY_VERBS as OLD_MODIFY_VERBS, OTHER_PARTY as OLD_OTHER_PARTY } from '../poc/step2/step2.mjs';
import { sourceForRule, matchedWordsForRule } from '../poc/step3/step3.mjs';

import { step2, MODIFY_VERBS as NEW_MODIFY_VERBS, OTHER_PARTY as NEW_OTHER_PARTY } from '../src/step2.js';

const rows = loadRows();
const MAX_REPORT = 10;

// Each entry holds `sample` (at most MAX_REPORT rows, for display) and
// `count` (every differing row, uncapped) — the two must never be
// conflated. `count` is what gets printed as "<name> differences: N"; a
// reader judging how bad a regression is reads that number, not the sample
// size, so it must be the true total or it lies about severity.
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

let multiMatchRows = 0;

for (const row of rows) {
  const oldV = applyStep2(row);
  const newV = step2(row);

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
  if (oldMatched.includes('+')) multiMatchRows += 1;
}

// --- word-list transcription pins ------------------------------------------

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const m of a) if (!b.has(m)) return false;
  return true;
}

const modifyVerbsEqual = setsEqual(OLD_MODIFY_VERBS, NEW_MODIFY_VERBS);
const otherPartyEqual = setsEqual(OLD_OTHER_PARTY, NEW_OTHER_PARTY);
const listsEqual = modifyVerbsEqual && otherPartyEqual;

// --- report ------------------------------------------------------------

console.log(`rows compared: ${rows.length}`);
console.log(`class differences: ${diffs.class.count}`);
console.log(`rule differences: ${diffs.rule.count}`);
console.log(`source differences: ${diffs.source.count}`);
console.log(`matched differences: ${diffs.matched.count}`);
console.log(`rows firing more than one matched member (old, '+'-joined): ${multiMatchRows}`);
console.log(`MODIFY_VERBS: old ${OLD_MODIFY_VERBS.size}, new ${NEW_MODIFY_VERBS.size}, equal: ${modifyVerbsEqual}`);
console.log(`OTHER_PARTY: old ${OLD_OTHER_PARTY.size}, new ${NEW_OTHER_PARTY.size}, equal: ${otherPartyEqual}`);
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
  console.log('\nword list equality FAILED (see MODIFY_VERBS/OTHER_PARTY lines above).');
}

process.exit(1);
