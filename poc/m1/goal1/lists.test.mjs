import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGoal1LowerVerbs, foldedVerbForRow, MIN_VENDORS, MIN_NON_X_SHARE } from './lists.mjs';

function row(overrides) {
  return { method: 'PUT', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'w', ...overrides };
}

test('constants match the reference bar', () => {
  assert.equal(MIN_VENDORS, 5);
  assert.equal(MIN_NON_X_SHARE, 0.95);
});

test('foldedVerbForRow: folds a trailing "s" ("Enables ..." -> "enable")', () => {
  assert.equal(foldedVerbForRow(row({ summary: 'Enables the widget' })), 'enable');
  assert.equal(foldedVerbForRow(row({ summary: 'Enable the widget' })), 'enable');
});

test('foldedVerbForRow: does not fold a double-s ("Process ..." stays "process")', () => {
  assert.equal(foldedVerbForRow(row({ summary: 'Process the widget' })), 'process');
});

// LOVO exclusion: "PUT enable" has exactly 5 distinct vendors in the pile
// (C, D, E, F all w, and B the sole x contributor). Excluding B's own row
// leaves only 4 OTHER vendors — below MIN_VENDORS (5) — so the verb is
// NOT admitted for vendor B, even though B's own rows are the only x's
// and its exclusion would otherwise zero out the x-share. Vendor A has NO
// rows at all for this key, so nothing of its own is excluded: it sees
// all 5 vendors (C, D, E, F, B) intact, clearing MIN_VENDORS, and the lone
// x from B is diluted well under the 5% bar by the 40 w rows — so the
// verb IS admitted for vendor A.
test('buildGoal1LowerVerbs: LOVO exclusion — admitted for vendor A, not for vendor B whose own rows are the only x\'s', () => {
  const pile = [];
  for (const vendor of ['C', 'D', 'E', 'F']) {
    for (let i = 0; i < 10; i += 1) {
      pile.push({ row: row({ vendor, summary: 'Enable the widget', gt_class: 'w' }) });
    }
  }
  pile.push({ row: row({ vendor: 'B', summary: 'Enable the widget', gt_class: 'x' }) });

  const vendors = ['A', 'C', 'D', 'E', 'F', 'B'];
  const { lowerVerbsFor } = buildGoal1LowerVerbs(pile, vendors);

  assert.ok(lowerVerbsFor('A').has('PUT enable'), 'expected admission for bystander vendor A');
  assert.ok(!lowerVerbsFor('B').has('PUT enable'), 'expected no admission for vendor B, whose exclusion drops other vendors below the bar');
});

test('buildGoal1LowerVerbs: a verb with too high an x-share is admitted for nobody', () => {
  const pile = [];
  for (const vendor of ['C', 'D', 'E', 'F', 'G']) {
    pile.push({ row: row({ vendor, method: 'DELETE', summary: 'Terminate the call', gt_class: 'x' }) });
  }
  const vendors = ['A', 'C', 'D', 'E', 'F', 'G'];
  const { lowerVerbsFor } = buildGoal1LowerVerbs(pile, vendors);
  assert.ok(!lowerVerbsFor('A').has('DELETE terminate'));
});
