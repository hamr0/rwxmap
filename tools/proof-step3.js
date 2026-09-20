// Equivalence proof: src/step3.js vs. the frozen poc/step3/step3.mjs.
// Over all 4171 corpus rows, compares NEW step3 against OLD applyStep3 on
// four things: class, rule, source (via sourceForRule) and matched (via
// matchedWordsForRule). A null on either side must equal a null on the
// other side (a null/non-null mismatch counts as a class difference). Also
// pins that RAISE_WORDS was transcribed correctly.
//
// The `matched` comparison is the load-bearing one: it proves the new
// return-it-directly approach equals the old re-derivation
// (matchedWordsForRule) on every row — which is what lets that
// re-derivation die with the POC.
//
// Note on scope: applyStep3 and step3 are both plain word tests that never
// look at the HTTP method — the ladder, not the rule, decides which rows
// the raise-word rule is offered. So this proof runs both sides over ALL
// 4171 rows, not just step 2's method-floor pile, which is a strictly
// wider comparison than the flow makes.
//
// NOT A KNOWN LIMIT HERE — checked, not assumed, and it came out the other
// way from steps 1 and 2. Those two proofs carry a KNOWN LIMIT saying the
// corpus cannot see `matched`'s SORT ORDER, because 0 of their rows fire
// more than one list member. Step 3 is different: 17 of the 4171 rows fire
// more than one RAISE_WORDS member (the count is printed below), across 5
// distinct pairs — panelist+panelists (2), watcher+watchers (2),
// membership+memberships (8), invitation+invitations (2) and
// grant+permission (3). The first four are singular/plural pairs that are
// adjacent and already in that order in RAISE_WORDS's own declaration, so
// they cannot tell a sorted result from an insertion-ordered one. The
// fifth can: `permission` is declared 1st and `grant` 15th, so declaration
// order would give "permission+grant" where a sort gives "grant+permission".
// Those 3 rows make this proof genuinely sensitive to the sort.
//
// It is still not the only pin on it: src/step3.test.js carries constructed
// multi-match tests, which additionally cover the injected-list (LOVO) path
// that no corpus row exercises.
//
// Run with: node tools/proof-step3.js
// Prints "All pins hold." and exits 0 when every comparison is clean;
// otherwise prints the TRUE total differing-row count per comparison (every
// row is counted, not just the ones kept for display) plus a sample of up
// to the first 10, and exits 1.
import { loadRows } from './corpus.js';

import { applyStep3, RAISE_WORDS as OLD_RAISE_WORDS, sourceForRule, matchedWordsForRule } from '../poc/step3/step3.mjs';

import { step3, RAISE_WORDS as NEW_RAISE_WORDS } from '../src/step3.js';

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
  const oldV = applyStep3(row);
  const newV = step3(row);

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

// --- word-list transcription pin -------------------------------------------

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const m of a) if (!b.has(m)) return false;
  return true;
}

const raiseWordsEqual = setsEqual(OLD_RAISE_WORDS, NEW_RAISE_WORDS);

// --- report ------------------------------------------------------------

console.log(`rows compared: ${rows.length}`);
console.log(`class differences: ${diffs.class.count}`);
console.log(`rule differences: ${diffs.rule.count}`);
console.log(`source differences: ${diffs.source.count}`);
console.log(`matched differences: ${diffs.matched.count}`);
console.log(`rows firing more than one matched member (old, '+'-joined): ${multiMatchRows}`);
console.log(`RAISE_WORDS: old ${OLD_RAISE_WORDS.size}, new ${NEW_RAISE_WORDS.size}, equal: ${raiseWordsEqual}`);

const totalDiffs =
  diffs.class.count + diffs.rule.count + diffs.source.count + diffs.matched.count;

if (totalDiffs === 0 && raiseWordsEqual) {
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
if (!raiseWordsEqual) {
  console.log('\nword list equality FAILED (see RAISE_WORDS line above).');
}

process.exit(1);
