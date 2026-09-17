// Equivalence proof: src/tokens.mjs vs. the frozen poc/step1/words.mjs.
// This is the point of the whole "shared plumbing" piece — src/tokens.mjs
// must behave IDENTICALLY to the frozen POC it was ported from, over every
// row of the real 4171-row corpus and over every (token, stem) pair drawn
// from every word list actually in the tree. Run with:
//   node tools/proof-tokens.mjs
// Prints "All pins hold." and exits 0 when every comparison is clean;
// otherwise prints the first 10 differing cases per comparison and exits 1.
import { loadRows } from './corpus.mjs';

import * as oldWords from '../poc/step1/words.mjs';
import * as newTokens from '../src/tokens.mjs';

import { READ_VERBS, SAFE_VERBS } from '../poc/step1/step1.mjs';
import { MODIFY_VERBS, OTHER_PARTY } from '../poc/step2/step2.mjs';
import { RAISE_WORDS } from '../poc/step3/step3.mjs';

const rows = loadRows();

const diffs = {
  tokensForRow_tokens: [],
  tokensForRow_stripped: [],
  leadVerbAfterModifiers: [],
  withSplitOperationId: [],
  stemMatches: [],
};

const MAX_REPORT = 10;

function recordDiff(list, rowIdOrPair, input, oldVal, newVal) {
  if (list.length < MAX_REPORT) {
    list.push({ id: rowIdOrPair, input, old: oldVal, new: newVal });
  }
}

// --- per-row comparisons ---------------------------------------------------

for (const row of rows) {
  const oldTok = oldWords.tokensForRow(row);
  const newTok = newTokens.tokensForRow(row);

  const tokensEqual =
    oldTok.tokens.length === newTok.tokens.length &&
    oldTok.tokens.every((t, i) => t === newTok.tokens[i]);
  if (!tokensEqual) {
    recordDiff(diffs.tokensForRow_tokens, row.rowId, row, oldTok.tokens, newTok.tokens);
  }
  if (oldTok.stripped !== newTok.stripped) {
    recordDiff(diffs.tokensForRow_stripped, row.rowId, row, oldTok.stripped, newTok.stripped);
  }

  const oldLead = oldWords.leadVerbAfterModifiers(row);
  const newLead = newTokens.leadVerbAfterModifiers(row);
  if (oldLead !== newLead) {
    recordDiff(diffs.leadVerbAfterModifiers, row.rowId, row, oldLead, newLead);
  }

  const oldSplit = oldWords.withSplitOperationId(row).operationId;
  const newSplit = newTokens.withSplitOperationId(row).operationId;
  if (oldSplit !== newSplit) {
    recordDiff(diffs.withSplitOperationId, row.rowId, row, oldSplit, newSplit);
  }
}

// --- token universe --------------------------------------------------------

const tokenSet = new Set();
for (const row of rows) {
  for (const field of [row.operationId, row.summary, row.path]) {
    for (const t of oldWords.splitTokens(field)) tokenSet.add(t);
  }
}

const stemSet = new Set([
  ...READ_VERBS,
  ...SAFE_VERBS,
  ...MODIFY_VERBS,
  ...OTHER_PARTY,
  ...RAISE_WORDS,
]);

let pairsCompared = 0;
for (const token of tokenSet) {
  for (const stem of stemSet) {
    pairsCompared += 1;
    const oldVal = oldWords.stemMatches(token, stem);
    const newVal = newTokens.stemMatches(token, stem);
    if (oldVal !== newVal) {
      recordDiff(diffs.stemMatches, `${token}/${stem}`, { token, stem }, oldVal, newVal);
    }
  }
}

// --- report ------------------------------------------------------------

console.log(`rows compared: ${rows.length}`);
console.log(`distinct tokens compared: ${tokenSet.size}`);
console.log(`(token, stem) pairs compared: ${pairsCompared}`);
console.log(`tokensForRow tokens differences: ${diffs.tokensForRow_tokens.length}`);
console.log(`tokensForRow stripped differences: ${diffs.tokensForRow_stripped.length}`);
console.log(`leadVerbAfterModifiers differences: ${diffs.leadVerbAfterModifiers.length}`);
console.log(`withSplitOperationId differences: ${diffs.withSplitOperationId.length}`);
console.log(`stemMatches differences: ${diffs.stemMatches.length}`);

const totalDiffs =
  diffs.tokensForRow_tokens.length +
  diffs.tokensForRow_stripped.length +
  diffs.leadVerbAfterModifiers.length +
  diffs.withSplitOperationId.length +
  diffs.stemMatches.length;

if (totalDiffs === 0) {
  console.log('All pins hold.');
  process.exit(0);
}

for (const [name, list] of Object.entries(diffs)) {
  if (list.length === 0) continue;
  console.log(`\n--- first ${Math.min(MAX_REPORT, list.length)} differences: ${name} ---`);
  for (const d of list) {
    console.log(`id=${JSON.stringify(d.id)} input=${JSON.stringify(d.input)} old=${JSON.stringify(d.old)} new=${JSON.stringify(d.new)}`);
  }
}

process.exit(1);
