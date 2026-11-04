import { test } from 'node:test';
import assert from 'node:assert/strict';

import { secondPass, LOWER_MIN_P } from './secondpass.js';
import { classifyRow } from './flow.js';

const MODEL = 'rwxlite-1.0.0+0123abcd';

// idx0 DELETE x settled | idx1 GET r settled | idx2 POST w(list) loose
// idx3 PUT w(floor) loose | idx4 POST x(floor) tight | idx5 POST r(list) loose
const OPS = [
  { method: 'DELETE', path: '/things/{id}', operationId: 'deleteThing' },
  { method: 'GET', path: '/things', operationId: 'listThings' },
  { method: 'POST', path: '/things/{id}/archive', operationId: 'updateThingArchive' },
  { method: 'PUT', path: '/things/{id}', operationId: 'putThing' },
  { method: 'POST', path: '/mystery', operationId: 'doMystery' },
  { method: 'POST', path: '/things/search', operationId: 'searchThings' },
];
const mech = () => OPS.map((o) => classifyRow(o));

/** An answer whose letter is `letter` with share `p`. */
function ans(letter, p, model = MODEL) {
  if (letter === 'x') return { pIsX: p, pChanges: p + (1 - p) / 2, model };
  if (letter === 'w') return { pIsX: (1 - p) / 2, pChanges: (1 - p) / 2 + p, model };
  return { pIsX: (1 - p) / 2, pChanges: 1 - p, model };
}

/** An engine that answers by the item's index, recording what it was sent. */
function engineOf(byIndex) {
  const sent = [];
  const engine = async (items) => {
    sent.push(items.map((i) => i.index));
    return items.map((i) => byIndex[i.index]);
  };
  return { engine, sent };
}

test('mechanical baseline of the fixture is what the other tests assume', () => {
  assert.deepEqual(mech().map((v) => [v.class, v.review]), [
    ['x', 'settled'], ['r', 'settled'], ['w', 'loose'], ['w', 'loose'], ['x', 'tight'], ['r', 'loose'],
  ]);
});

test('scope: only loose and tight rows are sent; settled rows never change', async () => {
  const { engine, sent } = engineOf({});
  const before = mech();
  const { verdicts, summary } = await secondPass(OPS, before, engine, { model: MODEL });
  assert.deepEqual(sent, [[2, 3, 4, 5]]);
  assert.equal(summary.sent, 4);
  assert.deepEqual(verdicts[0], before[0]);
  assert.deepEqual(verdicts[1], before[1]);
});

test('no row is sent when none is loose or tight', async () => {
  const { engine, sent } = engineOf({});
  const ops = [OPS[0], OPS[1]];
  const { summary } = await secondPass(ops, ops.map((o) => classifyRow(o)), engine, { model: MODEL });
  assert.deepEqual(sent, []);
  assert.equal(summary.sent, 0);
});

test('error, timeout, missing and every malformed answer -> x, undecided, review tight', async () => {
  const bads = [
    undefined, null, { error: 'timeout' }, 'nope',
    { pIsX: NaN, pChanges: 0.5, model: MODEL },
    { pIsX: 0.2, pChanges: Infinity, model: MODEL },
    { pIsX: -0.1, pChanges: 0.5, model: MODEL },
    { pIsX: 0.2, pChanges: 1.1, model: MODEL },
    { pIsX: 0.6, pChanges: 0.5, model: MODEL },
    { pIsX: 0.1, pChanges: 0.2 },
    { pIsX: 0.1, pChanges: 0.2, model: '' },
    { pIsX: 0.1, pChanges: 0.2, model: 'rwxlite-1.0.1+0123abcd' },
    { pIsX: '0.1', pChanges: 0.2, model: MODEL },
  ];
  for (const bad of bads) {
    const { engine } = engineOf({ 2: bad, 3: bad, 4: bad, 5: bad });
    const { verdicts, summary } = await secondPass(OPS, mech(), engine, { model: MODEL });
    for (const i of [2, 3, 4, 5]) {
      assert.equal(verdicts[i].class, 'x', `${JSON.stringify(bad)} row ${i}`);
      assert.equal(verdicts[i].review, 'tight');
    }
    assert.equal(summary.undecided, 4);
  }
});

test('an engine that throws, or returns a non-array, leaves every sent row undecided and does not throw', async () => {
  for (const engine of [async () => { throw new Error('boom'); }, /** @type {any} */ (async () => 'nope')]) {
    const { verdicts, summary } = await secondPass(OPS, mech(), engine, { model: MODEL });
    assert.deepEqual(verdicts.map((v) => v.class), ['x', 'r', 'x', 'x', 'x', 'x']);
    assert.deepEqual(verdicts.map((v) => v.review), ['settled', 'settled', 'tight', 'tight', 'tight', 'tight']);
    assert.equal(summary.undecided, 4);
  }
});

test('raise: accepted at any p; x is tight, w is loose; evidence rwxlite; no destructive', async () => {
  const { engine } = engineOf({
    2: ans('x', 0.34), // POST w(list) -> x
    3: ans('x', 0.9), // PUT w(floor) -> x
    5: ans('w', 0.5), // POST r(list) -> w
  });
  const { verdicts, summary } = await secondPass(OPS, mech(), engine, { model: MODEL });
  assert.equal(verdicts[2].class, 'x');
  assert.equal(verdicts[2].review, 'tight');
  assert.equal(verdicts[2].source, 'rwxlite');
  assert.equal(verdicts[3].class, 'x');
  assert.equal(verdicts[3].review, 'tight');
  assert.equal(verdicts[3].source, 'rwxlite');
  assert.equal(verdicts[5].class, 'w');
  assert.equal(verdicts[5].source, 'rwxlite');
  assert.equal(verdicts[5].review, 'loose');
  assert.equal('destructive' in verdicts[3], false);
  assert.equal(summary.raised, 3);
});

test('keep: L == M leaves the verdict exactly as mechanical had it', async () => {
  const before = mech();
  const { engine } = engineOf({ 2: ans('w', 0.6), 3: ans('w', 0.6), 4: ans('x', 0.99), 5: ans('r', 0.6) });
  const { verdicts, summary } = await secondPass(OPS, before, engine, { model: MODEL });
  assert.deepEqual(verdicts, before);
  assert.equal(summary.kept, 4);
});

test('lower: accepted only at p >= 0.97; below it the row is x, undecided, tight', async () => {
  assert.equal(LOWER_MIN_P, 0.97);
  const { engine } = engineOf({ 2: ans('w', 0.9), 3: ans('w', 0.6), 4: ans('w', 0.97), 5: ans('r', 0.96) });
  const { verdicts, summary } = await secondPass(OPS, mech(), engine, { model: MODEL });
  // idx4 POST x -> w at p 0.97: accepted, loose.
  assert.equal(verdicts[4].class, 'w');
  assert.equal(verdicts[4].review, 'loose');
  assert.equal(verdicts[4].source, 'rwxlite');
  // idx2 POST w, engine says w: keep (L == M).
  assert.equal(verdicts[2].class, 'w');
  // idx3 PUT w, engine says w: keep.
  assert.equal(verdicts[3].class, 'w');
  // idx5 POST r(list), engine says r: keep.
  assert.equal(verdicts[5].class, 'r');
  assert.equal(summary.lowered, 1);
});

test('lower below the cut-off: a w row the engine thinks is r at 0.96 goes to x tight; at 0.97 it goes to r loose', async () => {
  const { engine: weak } = engineOf({ 2: ans('r', 0.96), 3: ans('r', 0.97) });
  const { verdicts } = await secondPass(OPS, mech(), weak, { model: MODEL });
  assert.equal(verdicts[2].class, 'x');
  assert.equal(verdicts[2].review, 'tight');
  assert.equal(verdicts[3].class, 'r');
  assert.equal(verdicts[3].review, 'loose');
});

test('a lowered DELETE-style destructive x drops destructive; an undecided x keeps what mechanical gave it', async () => {
  const ops = [{ method: 'POST', path: '/tokens/{id}/revoke', operationId: 'revokeToken' }];
  const before = ops.map((o) => classifyRow(o));
  assert.equal(before[0].class, 'x');
  assert.equal(before[0].destructive, true);
  assert.equal(before[0].review, 'tight');

  const { verdicts: kept } = await secondPass(ops, before, async () => [undefined], { model: MODEL });
  assert.equal(kept[0].destructive, true);
  assert.equal(kept[0].class, 'x');

  const { verdicts: lowered } = await secondPass(ops, before, async () => [ans('r', 0.99)], { model: MODEL });
  assert.equal(lowered[0].class, 'r');
  assert.equal('destructive' in lowered[0], false);
});

test('ties go to the tighter class', async () => {
  // p(x)=0.5, p(w)=0.5, p(r)=0 -> x.
  const { engine } = engineOf({ 2: { pIsX: 0.5, pChanges: 1, model: MODEL } });
  const { verdicts } = await secondPass(OPS, mech(), engine, { model: MODEL });
  assert.equal(verdicts[2].class, 'x');
});

test('the input verdicts are not mutated, and review is only ever one of the three values', async () => {
  const before = mech();
  const snapshot = JSON.stringify(before);
  const { engine } = engineOf({ 2: ans('x', 0.9), 3: ans('r', 0.99), 4: ans('w', 0.5), 5: ans('x', 0.4) });
  const { verdicts } = await secondPass(OPS, before, engine, { model: MODEL });
  assert.equal(JSON.stringify(before), snapshot);
  for (const v of verdicts) assert.ok(['tight', 'loose', 'settled'].includes(v.review));
});

test('a bad call fails loudly: malformed model string, non-function engine, length mismatch', async () => {
  await assert.rejects(() => secondPass(OPS, mech(), async () => [], { model: 'jev-1' }), /malformed rwxlite model string/);
  await assert.rejects(() => secondPass(OPS, mech(), /** @type {any} */ ('x'), { model: MODEL }), /engine must be a function/);
  await assert.rejects(() => secondPass(OPS, mech().slice(1), async () => [], { model: MODEL }), /same length/);
});

test('evidence: a moved row publishes rwxlite (raise, lower, undecided-moved); kept and x-left-undecided rows keep mechanical\'s', async () => {
  const before = mech();
  const { engine } = engineOf({
    2: ans('x', 0.9), // POST w(list) -> x: raised
    3: undefined, // PUT w(floor): undecided, moved w -> x
    4: undefined, // POST x(floor): undecided, left at x
    5: ans('r', 0.6), // POST r(list): kept
  });
  const { verdicts } = await secondPass(OPS, before, engine, { model: MODEL });
  assert.equal(verdicts[2].source, 'rwxlite');
  assert.equal(verdicts[3].source, 'rwxlite');
  assert.equal(verdicts[3].class, 'x');
  assert.equal(verdicts[4].source, before[4].source); // 'floor', left undecided at x
  assert.equal(verdicts[4].source, 'floor');
  assert.equal(verdicts[5].source, 'list'); // kept
  assert.equal(verdicts[0].source, before[0].source); // settled, never sent
  assert.equal(before[2].source, 'list'); // input not mutated
});
