import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDescYours, resolvePile, nounsFromRow, rowForSource } from './mine.mjs';
import { buildStep2Context } from '../flow/step2.mjs';
import { loadRows } from '../flow/corpus.mjs';

function mkRow(vendor, method, operationId, gt_class, summary = '', description = '') {
  return { vendor, method, operationId, path: `/${operationId}`, gt_class, summary, description };
}

// --- (a) load-bearing: 'summary' source at the step2 defaults must
// reproduce poc/flow's own ctx.yoursFor EXACTLY, both directions, for
// several real vendors. A mismatch here means the copy of
// countNounsByVendor or the noun wiring is wrong -- that is the finding,
// not something to paper over by loosening this test.
test('buildDescYours summary source reproduces poc/flow ctx.yoursFor exactly', () => {
  const { rows, vendors } = loadRows();
  const flowCtx = buildStep2Context(rows, vendors);
  const descCtx = buildDescYours(rows, vendors, { minN: 2, minWShare: 0.80, source: 'summary' });

  // Sample 5 vendors that actually carry a non-empty yours list under the
  // real flow, so the comparison is not vacuously true on empty sets.
  const withList = vendors.filter((v) => flowCtx.yoursFor(v).size > 0);
  assert.ok(withList.length >= 5, 'expected at least 5 vendors with a non-empty yours list to sample from');
  const sample = withList.slice(0, 5);

  for (const vendor of sample) {
    const expected = flowCtx.yoursFor(vendor);
    const actual = descCtx.yoursFor(vendor);
    assert.deepEqual(
      [...actual].sort(),
      [...expected].sort(),
      `vendor ${vendor}: descYours summary list must equal step2's yoursFor exactly`,
    );
  }
});

// --- (b) leave-one-vendor-out: a noun only one vendor ever uses must never
// be admitted to that vendor's own list.
test('buildDescYours is leave-one-vendor-out', () => {
  const rows = [
    mkRow('A', 'PUT', 'updateOnlyAMineNoun', 'w', 'Update the onlyamine'),
    mkRow('A', 'PUT', 'updateOnlyAMineNoun', 'w', 'Update the onlyamine'),
    mkRow('A', 'PUT', 'updateOnlyAMineNoun', 'w', 'Update the onlyamine'),
    // filler so B has some write rows too (irrelevant noun)
    mkRow('B', 'PUT', 'updateWidget', 'w', 'Update the widget'),
    mkRow('B', 'PUT', 'updateWidget', 'w', 'Update the widget'),
  ];
  const vendors = ['A', 'B'];
  const ctx = buildDescYours(rows, vendors, { minN: 2, minWShare: 0.80, source: 'summary' });
  assert.ok(!ctx.yoursFor('A').has('onlyamine'), 'a noun only vendor A ever used must not be on A\'s own list');
});

// --- (c) resolution: every noun on the list resolves; one unknown noun
// does not.
test('resolvePile-style check: all-nouns-on-list resolves, one unknown does not', () => {
  const rows = [
    // Build up "profile" as a strong yours noun across B, C, D (so it
    // clears the bar for A when A is excluded).
    mkRow('A', 'PUT', 'updateProfile', 'w', 'Update the profile'),
    mkRow('B', 'PUT', 'updateProfile', 'w', 'Update the profile'),
    mkRow('C', 'PUT', 'updateProfile', 'w', 'Update the profile'),
    mkRow('D', 'PUT', 'updateProfile', 'w', 'Update the profile'),
  ];
  const vendors = ['A', 'B', 'C', 'D'];
  const ctx = buildDescYours(rows, vendors, { minN: 2, minWShare: 0.80, source: 'summary' });
  assert.ok(ctx.yoursFor('A').has('profile'));

  const resolvedRow = mkRow('A', 'PUT', 'updateProfile', 'w', 'Update the profile');
  const nouns = nounsFromRow(resolvedRow, ctx, 'summary');
  assert.ok(nouns.size > 0);
  assert.ok([...nouns].every((n) => ctx.yoursFor('A').has(n)), 'row whose nouns are all on the list should resolve');

  const unknownRow = mkRow('A', 'PUT', 'updateWidget', 'w', 'Update the widget');
  const unknownNouns = nounsFromRow(unknownRow, ctx, 'summary');
  assert.ok(unknownNouns.size > 0);
  assert.ok(
    ![...unknownNouns].every((n) => ctx.yoursFor('A').has(n)),
    'row with an unknown noun should not resolve',
  );
});

// --- (d) raising minWShare never grows a list (monotonic).
test('raising minWShare never grows a yours list', () => {
  const { rows, vendors } = loadRows();
  const shares = [0.80, 0.85, 0.90, 0.95];
  const ctxs = shares.map((minWShare) => buildDescYours(rows, vendors, { minN: 2, minWShare, source: 'both' }));

  for (const vendor of vendors.slice(0, 20)) {
    let prevSize = Infinity;
    for (const ctx of ctxs) {
      const size = ctx.yoursFor(vendor).size;
      assert.ok(size <= prevSize, `vendor ${vendor}: list size must not grow as minWShare rises`);
      prevSize = size;
    }
  }
});

// --- rowForSource sanity: operationId is always left untouched; only the
// summary slot carries the swapped-in text.
test('rowForSource swaps only the summary slot, never operationId', () => {
  const row = { operationId: 'updateDevice', summary: 'Update a device', description: 'Full device text here' };
  assert.equal(rowForSource(row, 'summary').operationId, 'updateDevice');
  assert.equal(rowForSource(row, 'summary').summary, 'Update a device');
  const d = rowForSource(row, 'description');
  assert.equal(d.operationId, 'updateDevice');
  assert.equal(d.summary, 'Full device text here');
  const b = rowForSource(row, 'both');
  assert.equal(b.operationId, 'updateDevice');
  assert.equal(b.summary, 'Update a device Full device text here');
});

// --- resolvePile sanity: real corpus, real x-pile size (1972), sources run
// without throwing and every record carries a valid outcome.
test('resolvePile runs against the real x-pile and returns valid outcomes', () => {
  const { rows, vendors } = loadRows();
  const records = resolvePile(rows, vendors, { minN: 2, minWShare: 0.80, source: 'both' });
  assert.equal(records.length, 1972);
  for (const rec of records) {
    assert.ok(['resolved', 'stays', 'no noun'].includes(rec.outcome));
  }
});
