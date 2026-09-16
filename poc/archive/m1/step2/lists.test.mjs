import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_VERBS, buildStep2OtherNouns, OTHER_MIN_VENDORS, OTHER_MIN_DANGER_SHARE } from './lists.mjs';
import { LIVE_VERBS as STEP3_LIVE_VERBS } from '../step3/lists.mjs';

function row(overrides) {
  return { method: 'PUT', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'w', ...overrides };
}

test('LIVE_VERBS is a literal copy of step 3\'s LIVE_VERBS (D57: copy, never import)', () => {
  assert.deepEqual([...LIVE_VERBS].sort(), [...STEP3_LIVE_VERBS].sort());
});

test('constants match the reference bar (g1block.mjs, V>=2 danger>=30%)', () => {
  assert.equal(OTHER_MIN_VENDORS, 2);
  assert.equal(OTHER_MIN_DANGER_SHARE, 0.30);
});

test('buildStep2OtherNouns: a noun with a high danger share across enough vendors is admitted', () => {
  const rows = [];
  for (const vendor of ['C', 'D']) {
    rows.push(row({ vendor, operationId: 'deleteWidgetSecret', gt_class: 'x' }));
  }
  const vendors = ['A', 'C', 'D'];
  const { otherNounsFor } = buildStep2OtherNouns(rows, vendors, new Set());
  assert.ok(otherNounsFor('A').has('secret'), 'expected admission for bystander vendor A');
});

test('buildStep2OtherNouns: LOVO exclusion — excluding a vendor whose own rows are the only x\'s denies it, not bystanders', () => {
  const rows = [];
  for (const vendor of ['C', 'D']) {
    for (let i = 0; i < 10; i += 1) {
      rows.push(row({ vendor, operationId: 'updateWidgetAccount', gt_class: 'w' }));
    }
  }
  rows.push(row({ vendor: 'B', operationId: 'updateWidgetAccount', gt_class: 'x' }));

  const vendors = ['A', 'C', 'D', 'B'];
  const { otherNounsFor } = buildStep2OtherNouns(rows, vendors, new Set());

  // Vendor A: sees C, D, B intact (3 other vendors), danger share 1/21 ~ 4.8% < 30% -> not admitted.
  assert.ok(!otherNounsFor('A').has('account'), 'expected no admission — danger share below the 30% bar');
});

test('buildStep2OtherNouns: too few other vendors admits nobody', () => {
  const rows = [row({ vendor: 'C', operationId: 'deleteWidgetSecret', gt_class: 'x' })];
  const vendors = ['A', 'C'];
  const { otherNounsFor } = buildStep2OtherNouns(rows, vendors, new Set());
  assert.ok(!otherNounsFor('A').has('secret'), 'only 1 vendor ever carries this noun, below OTHER_MIN_VENDORS (2)');
});

test('buildStep2OtherNouns: excluding vendor B (the sole x contributor) can drop other vendors below the bar and deny B alone', () => {
  const rows = [];
  for (const vendor of ['C']) {
    for (let i = 0; i < 10; i += 1) {
      rows.push(row({ vendor, operationId: 'updateWidgetAccount', gt_class: 'w' }));
    }
  }
  rows.push(row({ vendor: 'B', operationId: 'updateWidgetAccount', gt_class: 'x' }));
  const vendors = ['A', 'C', 'B'];
  const { otherNounsFor } = buildStep2OtherNouns(rows, vendors, new Set());
  // Vendor B excludes its own row, leaving only C (1 other vendor) -> below bar.
  assert.ok(!otherNounsFor('B').has('account'));
});

test('buildStep2OtherNouns: only PUT/DELETE/PATCH rows are counted', () => {
  const rows = [
    row({ method: 'GET', vendor: 'C', operationId: 'getWidgetSecret', gt_class: 'r' }),
    row({ method: 'POST', vendor: 'D', operationId: 'createWidgetSecret', gt_class: 'x' }),
  ];
  const vendors = ['A', 'C', 'D'];
  const { otherNounsFor } = buildStep2OtherNouns(rows, vendors, new Set());
  assert.ok(!otherNounsFor('A').has('secret'), 'GET/POST rows must not feed the PUT/DELETE/PATCH-only noun list');
});
