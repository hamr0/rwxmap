// Synthetic fixtures only. Never touches the real exam rows or truth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseOps, parseTruth, joinRows, classify, tally, groupTally, tooLoose, modeABar, renderBar, checkRun, MODEL, sha256Buf } from './score.mjs';

const ops = parseOps([
  'id,provider,method,path,operationId,summary,description',
  't-1,acme.test,GET,/a,,,',
  't-2,acme.test,DELETE,/a,,,',
  't-3,acme.test,POST,/b/{id},,,',
].join('\n') + '\n');
const vendors = { acme: 'acme.test' };
const side = [
  { method: 'get', path: '/a', letter: 'r', marker: 'settled', evidence: 'floor' },
  { method: 'DELETE', path: '/a', letter: 'x', marker: 'settled', evidence: 'floor' },
  { method: 'POST', path: '/b/{id}', letter: 'w', marker: 'loose', evidence: 'list' },
];

test('join 1:1 succeeds, uppercases method, counts', () => {
  const { joined, counts } = joinRows(ops, { acme: side }, vendors);
  assert.deepEqual(counts, { matched: 3, unmatchedOps: 0, unmatchedOutput: 0, duplicates: 0, skipped: 0 });
  assert.deepEqual(joined.map((r) => [r.id, r.predicted, r.marker]), [['t-1', 'r', 'settled'], ['t-2', 'x', 'settled'], ['t-3', 'w', 'loose']]);
});
test('unmatched ops row fails', () => {
  assert.throws(() => joinRows(ops, { acme: side.slice(0, 2) }, vendors), /ops row with no output op: t-3/);
});
test('unmatched output op fails', () => {
  assert.throws(() => joinRows(ops, { acme: [...side, { method: 'PUT', path: '/zzz', letter: 'w', marker: 'loose' }] }, vendors), /output op with no ops row/);
});
test('duplicate key fails', () => {
  assert.throws(() => joinRows(ops, { acme: [...side, side[0]] }, vendors), /duplicate key: t-1/);
  assert.throws(() => joinRows([...ops, { ...ops[0], id: 't-9' }], { acme: side }, vendors), /ops has two rows/);
});

test('every outcome category', () => {
  assert.equal(classify('r', 'r'), 'exact');
  assert.equal(classify('x', 'w'), 'loose-1');
  assert.equal(classify('w', 'r'), 'loose-1');
  assert.equal(classify('x', 'r'), 'loose-2');
  assert.equal(classify('r', 'w'), 'tight');
  assert.equal(classify('r', 'x'), 'tight');
  assert.equal(classify('w', 'x'), 'tight');
  assert.throws(() => classify('r', 'z'), /bad class/);
});

const mk = (truth, predicted, extra = {}) => ({ id: 'i', provider: 'p', method: 'GET', path: '/', truth, predicted, marker: 'settled', ...extra });
test('tally splits loose-1, loose-2 and tight; too loose is their sum, tight separate', () => {
  const t = tally([mk('r', 'r'), mk('x', 'w'), mk('w', 'r'), mk('x', 'r'), mk('x', 'r'), mk('r', 'x'), mk('w', 'x'), mk('r', 'w')]);
  assert.deepEqual(t, { n: 8, exact: 1, loose1: 2, loose2: 2, loose: 4, tight: 3 });
});
test('groupTally and tooLoose', () => {
  const rows = [mk('x', 'r', { provider: 'b' }), mk('r', 'r', { provider: 'a' }), mk('r', 'x', { provider: 'a' })];
  const g = groupTally(rows, (r) => r.provider);
  assert.deepEqual(g.map(([k, t]) => [k, t.exact, t.loose2, t.tight]), [['a', 1, 0, 1], ['b', 0, 1, 0]]);
  assert.equal(tooLoose(rows).length, 1);
});

test('bar arithmetic: ceil(5% of 1588) = 80, exact boundary', () => {
  const mech = { n: 1588, exact: 1000, loose: 10 };
  assert.equal(modeABar(mech, { n: 1588, exact: 1080, loose: 10 }).needRows, 80);
  assert.equal(modeABar(mech, { n: 1588, exact: 1080, loose: 10 }).pass, true);
  assert.equal(modeABar(mech, { n: 1588, exact: 1079, loose: 10 }).exactOk, false);
  assert.equal(modeABar(mech, { n: 1588, exact: 1200, loose: 11 }).looseOk, false);
  assert.equal(modeABar(mech, { n: 1588, exact: 1200, loose: 9 }).looseOk, true);
  assert.equal(modeABar({ n: 100, exact: 50, loose: 0 }, { n: 100, exact: 55, loose: 0 }).exactOk, true);
  assert.equal(modeABar({ n: 101, exact: 50, loose: 0 }, { n: 101, exact: 55, loose: 0 }).needRows, 6); // ceil(5.05)
  assert.throws(() => modeABar({ n: 1, exact: 0, loose: 0 }, { n: 2, exact: 0, loose: 0 }), /denominators/);
  assert.match(renderBar(mech, { n: 1588, exact: 1079, loose: 10 }), /exact:.*FAIL/);
});

test('truth sha mismatch is refused; match accepted', () => {
  const buf = Buffer.from('id,label\nt-1,r\nt-2,x\nt-3,w\n');
  const sha = sha256Buf(buf);
  assert.equal(sha, createHash('sha256').update(buf).digest('hex'));
  const ids = ops.map((o) => o.id);
  assert.equal(parseTruth(buf, sha, ids).get('t-2'), 'x');
  assert.throws(() => parseTruth(buf, 'a'.repeat(64), ids), /refusing: truth sha256/);
  assert.throws(() => parseTruth(buf, '', ids), /refusing/);
  const bad = Buffer.from('id,label\nt-1,r\nt-2,q\nt-3,w\n');
  assert.throws(() => parseTruth(bad, sha256Buf(bad), ids), /not r\|w\|x/);
  const short = Buffer.from('id,label\nt-1,r\n');
  assert.throws(() => parseTruth(short, sha256Buf(short), ids), /id mismatch/);
});

test('checkRun refusals', () => {
  const on = { rwxmapVersion: '0.11.0', rwxlite: { mode: 'on', model: MODEL } };
  const cfgA = { rwxlite: true }, cfgM = { rwxlite: false };
  checkRun('a', cfgA, `rwxmap: rwxlite: on (${MODEL}) — 1 sent`, on);
  assert.throws(() => checkRun('a', cfgA, 'rwxmap: rwxlite: off (mechanical)', on), /engine line/);
  assert.throws(() => checkRun('a', cfgA, `rwxlite: on (${MODEL})`, { ...on, rwxmapVersion: '0.10.0' }), /rwxmapVersion/);
  assert.throws(() => checkRun('a', cfgA, `rwxlite: on (${MODEL})`, { ...on, rwxlite: { mode: 'on', model: 'x' } }), /combined rwxlite/);
  checkRun('m', cfgM, 'rwxmap: rwxlite: off (mechanical)', { rwxmapVersion: '0.11.0' });
  assert.throws(() => checkRun('m', cfgM, `rwxlite: on (${MODEL})`, { rwxmapVersion: '0.11.0' }), /mechanical/);
});
