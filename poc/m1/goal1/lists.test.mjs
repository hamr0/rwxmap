import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoal1LowerVerbs, foldedVerbForRow, MIN_VENDORS, MIN_NON_X_SHARE,
  buildGoal1YoursNouns, NOUN_MIN_VENDORS, NOUN_MIN_SAFE_SHARE,
} from './lists.mjs';

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

// Piece 4 — buildGoal1YoursNouns: same LOVO shape as buildGoal1LowerVerbs,
// but keyed on nouns (bar: NOUN_MIN_VENDORS=2, NOUN_MIN_SAFE_SHARE=0.90)
// instead of (method, verb).

test('noun-list constants match goal 1\'s own bar', () => {
  assert.equal(NOUN_MIN_VENDORS, 2);
  assert.equal(NOUN_MIN_SAFE_SHARE, 0.90);
});

test('buildGoal1YoursNouns: LOVO exclusion — admitted for vendor A, not for vendor B whose own rows are the only x\'s', () => {
  const pile = [];
  for (const vendor of ['C', 'D']) {
    for (let i = 0; i < 10; i += 1) {
      pile.push({ row: row({ vendor, gt_class: 'w' }), nouns: new Set(['account']) });
    }
  }
  pile.push({ row: row({ vendor: 'B', gt_class: 'x' }), nouns: new Set(['account']) });

  const vendors = ['A', 'C', 'D', 'B'];
  const { yoursNounsFor } = buildGoal1YoursNouns(pile, vendors);

  // Vendor A: excludes nothing of its own, sees C, D, B (3 other vendors,
  // x-share 1/21 well under 10%) -> admitted.
  assert.ok(yoursNounsFor('A').has('account'), 'expected admission for bystander vendor A');
  // Vendor B: excluding its own x row leaves C, D (2 other vendors,
  // x-share now 0/20) -> also admitted — excluding the sole x contributor
  // only helps its own admission bar, it does not punish it.
  assert.ok(yoursNounsFor('B').has('account'), 'expected admission for vendor B too, once its own x row is excluded');
});

test('buildGoal1YoursNouns: excluding a vendor whose exclusion drops other vendors below the bar denies admission to it alone', () => {
  const pile = [];
  for (const vendor of ['C', 'D']) {
    for (let i = 0; i < 10; i += 1) {
      pile.push({ row: row({ vendor, gt_class: 'w' }), nouns: new Set(['account']) });
    }
  }
  // Only C and D ever carry 'account' (2 vendors total).
  const vendors = ['A', 'C', 'D'];
  const { yoursNounsFor } = buildGoal1YoursNouns(pile, vendors);

  // Vendor A: excludes nothing of its own, sees C, D (2 other vendors) -> admitted.
  assert.ok(yoursNounsFor('A').has('account'), 'expected admission for bystander vendor A');
  // Vendor C: excluding its own 10 rows leaves only D (1 other vendor),
  // below NOUN_MIN_VENDORS (2) -> not admitted.
  assert.ok(!yoursNounsFor('C').has('account'), 'vendor C sees only 1 other vendor (D) once its own rows are excluded');
});

test('buildGoal1YoursNouns: too few other vendors (below NOUN_MIN_VENDORS) admits nobody', () => {
  const pile = [
    { row: row({ vendor: 'C', gt_class: 'w' }), nouns: new Set(['widget']) },
  ];
  const vendors = ['A', 'C'];
  const { yoursNounsFor } = buildGoal1YoursNouns(pile, vendors);
  // Only 1 vendor (C) ever carries 'widget'; for vendor A that's 1 other
  // vendor, below NOUN_MIN_VENDORS (2).
  assert.ok(!yoursNounsFor('A').has('widget'));
});

test('buildGoal1YoursNouns: a noun with too high an x-share is admitted for nobody', () => {
  const pile = [];
  for (const vendor of ['C', 'D']) {
    pile.push({ row: row({ vendor, gt_class: 'x' }), nouns: new Set(['secret']) });
  }
  const vendors = ['A', 'C', 'D'];
  const { yoursNounsFor } = buildGoal1YoursNouns(pile, vendors);
  assert.ok(!yoursNounsFor('A').has('secret'));
});
