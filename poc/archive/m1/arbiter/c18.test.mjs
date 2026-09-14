import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify as classifyC15 } from './c15.mjs';
import { PARTY_NOUNS, SHARED_NOUNS } from './c11.mjs';
import {
  classifyWithNouns,
  loadCombinedCorpus,
  truthSplit,
  buildNounTable,
  qualifies,
  lovoCheck,
  MIN_N,
  MIN_X_SHARE,
} from './c18.mjs';

function row(overrides) {
  return {
    set: 'camara',
    vendor: 'camara',
    path: '/x',
    method: 'GET',
    operationId: 'doThing',
    gt_class: 'r',
    summary: '',
    description: '',
    confidence: 'high',
    ...overrides,
  };
}

// --- Part B: the combined corpus load ---------------------------------

test('loadCombinedCorpus loads the original 1478 rows plus exam2, dropping truth_class "?"', () => {
  const { allRows, originalRows, exam2Rows, exam2Dropped, exam2Total } = loadCombinedCorpus();
  assert.equal(originalRows.length, 1478);
  assert.equal(exam2Total, 1000);
  assert.equal(exam2Dropped, 6);
  assert.equal(exam2Rows.length, exam2Total - exam2Dropped);
  assert.equal(allRows.length, originalRows.length + exam2Rows.length);
});

test('every original row carries confidence "high"; exam2 rows carry the labeller\'s own value', () => {
  const { originalRows, exam2Rows } = loadCombinedCorpus();
  assert.ok(originalRows.every((r) => r.confidence === 'high'));
  assert.ok(exam2Rows.every((r) => r.confidence === 'high' || r.confidence === 'low'));
  assert.ok(exam2Rows.some((r) => r.confidence === 'low'), 'expected at least one low-confidence exam2 row');
});

test('no exam2 row has truth_class "?"', () => {
  const { exam2Rows } = loadCombinedCorpus();
  assert.ok(exam2Rows.every((r) => r.gt_class === 'r' || r.gt_class === 'w' || r.gt_class === 'x'));
});

test('camara rows all share vendor "camara"; other sets use their own repo/provider as vendor', () => {
  const { allRows } = loadCombinedCorpus();
  const camaraRows = allRows.filter((r) => r.set === 'camara');
  assert.ok(camaraRows.length > 0);
  assert.ok(camaraRows.every((r) => r.vendor === 'camara'));
  const exam2Rows = allRows.filter((r) => r.set === 'exam2');
  const exam2Vendors = new Set(exam2Rows.map((r) => r.vendor));
  // Up to 246 (the blind file's distinct providers) — fewer if dropping
  // truth_class '?' rows happened to remove a provider's only row.
  assert.ok(exam2Vendors.size > 0 && exam2Vendors.size <= 246, `expected 1-246 exam2 vendors, got ${exam2Vendors.size}`);
});

// --- self-check: classifyWithNouns must reproduce c15.classify exactly ----
// on the original 1478 rows, when given the same PARTY_NOUNS/SHARED_NOUNS
// union c15.mjs itself uses. This is the rail the whole file depends on —
// if this fails, no "after" number in c18-sweep.md can be trusted.

test('classifyWithNouns(row, PARTY_NOUNS union SHARED_NOUNS) reproduces c15.classify(row) exactly on all 1478 original rows', () => {
  const { originalRows } = loadCombinedCorpus();
  const baseNounSet = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);
  let mismatches = 0;
  for (const r of originalRows) {
    const a = classifyC15(r).class;
    const b = classifyWithNouns(r, baseNounSet).class;
    if (a !== b) mismatches += 1;
  }
  assert.equal(mismatches, 0);
});

test('classifyWithNouns matches c15.classify on the negative controls', () => {
  const baseNounSet = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);
  const terminateCall = row({
    method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall',
    summary: 'Terminate an ongoing call',
  });
  const updateSessionStatus = row({
    method: 'PUT', path: '/sessions/{mediaSessionId}/status', operationId: 'updateSessionStatus',
    summary: 'Update the status of the media session',
  });
  assert.equal(classifyWithNouns(terminateCall, baseNounSet).class, 'x');
  assert.equal(classifyWithNouns(updateSessionStatus, baseNounSet).class, 'x');
  assert.equal(classifyC15(terminateCall).class, 'x');
  assert.equal(classifyC15(updateSessionStatus).class, 'x');
});

// --- an extended noun set can only raise, never lower, a classification ---

test('adding a noun to the set never lowers a class it would otherwise assign (raise-only)', () => {
  const baseNounSet = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);
  const extended = new Set([...baseNounSet, 'widget']);
  const r = row({ method: 'DELETE', operationId: 'removeWidget', summary: 'Remove a widget' });
  const before = classifyWithNouns(r, baseNounSet);
  const after = classifyWithNouns(r, extended);
  assert.equal(before.class, 'w');
  assert.equal(after.class, 'x');
  assert.equal(after.rule, 'party-noun');
});

test('a noun not present on a row has no effect on its classification', () => {
  const baseNounSet = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);
  const extended = new Set([...baseNounSet, 'gizmo']);
  const r = row({ method: 'DELETE', operationId: 'doObscureThing', summary: '' });
  assert.equal(classifyWithNouns(r, baseNounSet).class, classifyWithNouns(r, extended).class);
});

// --- truthSplit ------------------------------------------------------------

test('truthSplit counts r/w/x and ignores nothing else', () => {
  const rows = [row({ gt_class: 'r' }), row({ gt_class: 'w' }), row({ gt_class: 'w' }), row({ gt_class: 'x' })];
  assert.deepEqual(truthSplit(rows), { r: 1, w: 2, x: 1 });
});

test('truthSplit on an empty array is all zero', () => {
  assert.deepEqual(truthSplit([]), { r: 0, w: 0, x: 0 });
});

// --- buildNounTable ----------------------------------------------------

test('buildNounTable only counts PUT/DELETE/PATCH rows toward pdpRows, but allCount over every method', () => {
  const rows = [
    row({ method: 'GET', operationId: 'getWidget', summary: 'Get a widget' }),
    row({ method: 'DELETE', operationId: 'deleteWidget', summary: 'Delete a widget', gt_class: 'w' }),
  ];
  const table = buildNounTable(rows);
  const entry = table.get('widget');
  assert.ok(entry, 'expected a "widget" entry');
  assert.equal(entry.allCount, 2);
  assert.equal(entry.pdpRows.length, 1);
});

test('buildNounTable dedupes a row that offers the same noun via both summary and operationId', () => {
  const rows = [row({ method: 'DELETE', operationId: 'deleteWidget', summary: 'Delete a widget', gt_class: 'w' })];
  const table = buildNounTable(rows);
  const entry = table.get('widget');
  assert.equal(entry.allCount, 1);
  assert.equal(entry.pdpRows.length, 1);
});

// --- qualifies ---------------------------------------------------------

test(`qualifies requires n >= ${MIN_N} PDP rows`, () => {
  const twoXRows = [row({ gt_class: 'x' }), row({ gt_class: 'x' })];
  assert.equal(qualifies(twoXRows), false);
});

test(`qualifies requires x-share >= ${MIN_X_SHARE}`, () => {
  const rows = [row({ gt_class: 'x' }), row({ gt_class: 'x' }), row({ gt_class: 'w' })];
  // 2/3 = 0.667, below the 0.75 bar.
  assert.equal(qualifies(rows), false);
  const qualifyingRows = [row({ gt_class: 'x' }), row({ gt_class: 'x' }), row({ gt_class: 'x' }), row({ gt_class: 'w' })];
  // 3/4 = 0.75, at the bar.
  assert.equal(qualifies(qualifyingRows), true);
});

// --- lovoCheck -----------------------------------------------------------

test('lovoCheck rejects a noun propped up by a single vendor', () => {
  // 3 x rows all from one vendor: qualifies overall, but removing that
  // vendor leaves 0 rows, which fails MIN_N -> does not survive LOVO.
  const rows = [
    row({ vendor: 'vendorA', gt_class: 'x' }),
    row({ vendor: 'vendorA', gt_class: 'x' }),
    row({ vendor: 'vendorA', gt_class: 'x' }),
  ];
  assert.equal(qualifies(rows), true);
  const lovo = lovoCheck(rows);
  assert.equal(lovo.survivesEveryHoldout, false);
});

test('lovoCheck admits a noun whose evidence spans enough vendors that removing any one still leaves it qualifying', () => {
  const rows = [
    row({ vendor: 'vendorA', gt_class: 'x' }),
    row({ vendor: 'vendorB', gt_class: 'x' }),
    row({ vendor: 'vendorC', gt_class: 'x' }),
    row({ vendor: 'vendorD', gt_class: 'x' }),
  ];
  const lovo = lovoCheck(rows);
  assert.equal(lovo.survivesEveryHoldout, true);
  assert.equal(lovo.vendors.length, 4);
});

test('lovoCheck on an empty row set never survives (no vendors)', () => {
  const lovo = lovoCheck([]);
  assert.equal(lovo.survivesEveryHoldout, false);
  assert.deepEqual(lovo.vendors, []);
});
