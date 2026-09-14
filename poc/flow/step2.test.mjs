import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyStep2, buildStep2Context, LIVE_VERBS } from './step2.mjs';

test('classifyStep2: null for GET/POST', () => {
  assert.equal(classifyStep2({ method: 'GET' }, {}), null);
  assert.equal(classifyStep2({ method: 'POST' }, {}), null);
});

test('classifyStep2: live verb in operationId -> x', () => {
  const ctx = { nounsOf: () => new Set(), otherNounsFor: () => new Set(), yoursFor: () => new Set() };
  const row = { method: 'PUT', operationId: 'terminateCall', path: '/calls/{id}', summary: 'Terminate a call' };
  const res = classifyStep2(row, ctx);
  assert.deepEqual(res, { class: 'x', step: 3, rule: 'live-verb', flag: '' });
});

test('classifyStep2: live verb vetoed by a caller phrase in the summary', () => {
  const ctx = { nounsOf: () => new Set(), otherNounsFor: () => new Set(), yoursFor: () => new Set() };
  // operationId itself carries no live verb, so the hit only comes from
  // the summary fallback verb ("Cancel") -- caller phrase vetoes it.
  const row = {
    method: 'DELETE', operationId: 'thingDelete', path: '/things/{id}',
    summary: 'Cancel your account subscription',
  };
  const res = classifyStep2(row, ctx);
  assert.notEqual(res.rule, 'live-verb');
});

test('classifyStep2: live verb via summary fallback (no operationId hit)', () => {
  const ctx = { nounsOf: () => new Set(), otherNounsFor: () => new Set(), yoursFor: () => new Set() };
  const row = { method: 'PATCH', operationId: 'thingUpdate', path: '/things/{id}', summary: 'Cancel the thing' };
  const res = classifyStep2(row, ctx);
  assert.deepEqual(res, { class: 'x', step: 3, rule: 'live-verb', flag: '' });
});

test('classifyStep2: other-party noun -> x', () => {
  const ctx = {
    nounsOf: () => new Set(['ticket']),
    otherNounsFor: () => new Set(['ticket']),
    yoursFor: () => new Set(),
  };
  const row = { method: 'PUT', operationId: 'updateTicket', path: '/tickets/{id}', summary: 'Update a ticket' };
  const res = classifyStep2(row, ctx);
  assert.deepEqual(res, { class: 'x', step: 3, rule: 'other-noun', flag: '' });
});

test('classifyStep2: every noun is yours -> w, evidence', () => {
  const ctx = {
    nounsOf: () => new Set(['device']),
    otherNounsFor: () => new Set(),
    yoursFor: () => new Set(['device']),
  };
  const row = { method: 'PUT', operationId: 'updateDevice', path: '/devices/{id}', summary: 'Update a device' };
  const res = classifyStep2(row, ctx);
  assert.deepEqual(res, { class: 'w', step: 2, rule: 'yours-noun', flag: 'evidence' });
});

test('classifyStep2: nothing fires -> w, x-pile', () => {
  const ctx = { nounsOf: () => new Set(), otherNounsFor: () => new Set(), yoursFor: () => new Set() };
  const row = { method: 'PATCH', operationId: 'updateThing', path: '/things/{id}', summary: 'Update the thing' };
  const res = classifyStep2(row, ctx);
  assert.deepEqual(res, { class: 'w', step: 2, rule: 'floor', flag: 'x-pile' });
});

test('classifyStep2: nouns present but not every one is yours -> w, x-pile', () => {
  const ctx = {
    nounsOf: () => new Set(['device', 'widget']),
    otherNounsFor: () => new Set(),
    yoursFor: () => new Set(['device']),
  };
  const row = { method: 'PUT', operationId: 'updateDevice', path: '/devices/{id}', summary: 'Update a device' };
  const res = classifyStep2(row, ctx);
  assert.deepEqual(res, { class: 'w', step: 2, rule: 'floor', flag: 'x-pile' });
});

test('LIVE_VERBS: 26 words', () => {
  assert.equal(LIVE_VERBS.size, 26);
});

// --- mining bars on a small synthetic corpus --------------------------------

// Synthetic rows: vendors A, B, C, D. Noun "widget" appears on
// PUT/DELETE/PATCH rows for vendors A, B, C -- x-heavy (2 of 3 x) so it
// should be admitted as "other" for vendor A (excluding A: B+C = 2 other
// vendors, x-share 1/2 = 0.5 >= 0.30). Noun "gadget" only ever appears on
// vendor A's own rows, so excluding A it has 0 rows and must not be
// admitted as "other" for A. Noun "profile" appears w-heavy across
// vendors A, B, C, D (mostly w) so it should be admitted as "yours" for
// vendor A (excluding A: n=3, w=3, share=1.0 >= 0.80).
function mkRow(vendor, method, operationId, gt_class, summary = '') {
  return { vendor, method, operationId, path: `/${operationId}`, gt_class, summary };
}

const SYN_ROWS = [
  mkRow('A', 'PUT', 'updateWidget', 'w'),
  mkRow('B', 'PUT', 'updateWidget', 'x'),
  mkRow('C', 'PUT', 'updateWidget', 'x'),
  mkRow('A', 'PUT', 'updateGadget', 'w'),
  mkRow('A', 'PUT', 'updateProfile', 'w'),
  mkRow('B', 'PUT', 'updateProfile', 'w'),
  mkRow('C', 'PUT', 'updateProfile', 'w'),
  mkRow('D', 'PUT', 'updateProfile', 'w'),
  // GET rows should not feed the "other" mining (PUT/DELETE/PATCH only).
  mkRow('B', 'GET', 'listWidget', 'r'),
  // Noun "gizmo": write rows are all w for B, C. A GET row for B (class r)
  // must NOT count toward the yours mining (2026-09-14 decision) -- if it
  // did, excluding A the share would be 2/3 (0.666, below the 0.80 bar);
  // excluding the GET row, excluding A it's B+C = 2/2 (1.0), admitted.
  mkRow('A', 'PUT', 'updateGizmo', 'w'),
  mkRow('B', 'PUT', 'updateGizmo', 'w'),
  mkRow('C', 'PUT', 'updateGizmo', 'w'),
  mkRow('B', 'GET', 'listGizmo', 'r'),
];
const SYN_VENDORS = ['A', 'B', 'C', 'D'];

test('buildStep2Context: other-noun mining bar (n>0, >=2 other vendors, x-share>=0.30)', () => {
  const ctx = buildStep2Context(SYN_ROWS, SYN_VENDORS);
  assert.ok(ctx.otherNounsFor('A').has('widget'), 'widget should be admitted as other for A');
  assert.ok(!ctx.otherNounsFor('A').has('gadget'), 'gadget has no other-vendor rows for A, must not be admitted');
});

test('buildStep2Context: yours-noun mining bar (n>=2, w-share>=0.80)', () => {
  const ctx = buildStep2Context(SYN_ROWS, SYN_VENDORS);
  assert.ok(ctx.yoursFor('A').has('profile'), 'profile should be admitted as yours for A');
  assert.ok(!ctx.yoursFor('A').has('widget'), 'widget is x-heavy excluding A, must not be admitted as yours');
});

test('buildStep2Context: yours mining excludes GET/HEAD/OPTIONS rows', () => {
  const ctx = buildStep2Context(SYN_ROWS, SYN_VENDORS);
  assert.ok(ctx.yoursFor('A').has('gizmo'), 'gizmo should be admitted as yours for A once the B GET row is excluded');
});
