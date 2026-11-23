// Tiny synthetic checks for score.mjs. Run: node --test poc/d141-mech/score.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSet } from './score.mjs';

const row = (id, vendor, method, p, truth) => ({ id, set: 'T', vendor, method, path: p, operationId: '', summary: '', description: '', truth, families: '' });

test('getAction fires on reads only; pathXWords on PUT/PATCH/POST only', () => {
  const rows = [
    row('g1', 'v1', 'GET', '/things/frobnicate', 'x'),    // read, last segment names the word
    row('p1', 'v1', 'PUT', '/things/frobnicate', 'x'),    // write: getAction must not fire
    row('g2', 'v1', 'GET', '/things/zorbwidget', 'r'),    // read: pathXWords must not fire
    row('p2', 'v1', 'PATCH', '/things/zorbwidget', 'x'),
    { ...row('p3', 'v1', 'POST', '/things/zorbwidget', 'x'), operationId: 'updateThing' }, // POST that step 3 lowers to w; a path word raises it
    row('p4', 'v1', 'PUT', '/things/zorbwidget', 'w'),
    row('d1', 'v1', 'DELETE', '/things/zorbwidget', 'x'),
  ];
  const ga = scoreSet(rows, { getAction: ['frobnicate'], pathXWords: [] }).words[0];
  assert.deepEqual(ga.fires.map((f) => rows[f.i].id), ['g1']);
  const px = scoreSet(rows, { getAction: [], pathXWords: ['zorbwidget'] }).words[0];
  assert.deepEqual(px.fires.map((f) => rows[f.i].id).sort(), ['p2', 'p3', 'p4']);
  assert.equal(px.right, 2); assert.equal(px.wrong, 1);
  assert.equal(px.kinds.tightFromW, 1);
});

test('LOVO drops a word whose right fires all come from one vendor, keeps one backed by two', () => {
  const rows = [
    row('a1', 'A', 'PUT', '/x/solo', 'x'), row('a2', 'A', 'PUT', '/y/solo', 'x'),
    row('a3', 'A', 'PUT', '/x/duo', 'x'),
    row('b1', 'B', 'PUT', '/x/duo', 'x'),
    row('c1', 'C', 'PUT', '/x/other', 'w'),
  ];
  const res = scoreSet(rows, { getAction: [], pathXWords: ['solo', 'duo'] });
  const [solo, duo] = res.words;
  assert.equal(solo.right, 2); assert.equal(solo.rightVendors, 1);
  assert.equal(solo.lovo.right, 0);
  assert.equal(duo.right, 2); assert.equal(duo.rightVendors, 2);
  assert.equal(duo.lovo.right, 2);
  assert.equal(res.lovo.right, 2);
  assert.equal(res.joint.right, 4);
});

test('counts are not capped by the example sample', () => {
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push(row('r' + i, 'V' + (i % 4), 'PUT', '/a/bigword', 'x'));
  for (let i = 0; i < 30; i++) rows.push(row('w' + i, 'V' + (i % 4), 'PUT', '/b/bigword', 'w'));
  const w = scoreSet(rows, { getAction: [], pathXWords: ['bigword'] }).words[0];
  assert.equal(w.fires.length, 70); assert.equal(w.right, 40); assert.equal(w.wrong, 30);
  assert.equal(w.kinds.loose1Closed, 40); assert.equal(w.kinds.tightFromW, 30);
});

test('a word already in the shipped list is a no-op', () => {
  const rows = [row('p', 'A', 'PUT', '/x/webhook', 'x')];
  const w = scoreSet(rows, { getAction: [], pathXWords: ['webhook'] }).words[0];
  assert.equal(w.inList, true); assert.equal(w.fires.length, 0);
});
