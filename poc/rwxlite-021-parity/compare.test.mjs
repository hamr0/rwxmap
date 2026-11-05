import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffRows, parseRows } from './compare.mjs';

const r = (id, letter, review = 'settled') => ({ id, provider: 'p', method: 'GET', path: '/x', truth: 'r', letter, review, evidence: 'e' });

test('identical rows: no diff', () => {
  const d = diffRows([r('1', 'r'), r('2', 'x')], [r('1', 'r'), r('2', 'x')]);
  assert.equal(d.diff.length, 0);
  assert.equal(d.same, 2);
});

test('letter change and marker-only change are both differences', () => {
  const d = diffRows([r('1', 'r'), r('2', 'x', 'tight'), r('3', 'w')], [r('1', 'w'), r('2', 'x', 'settled'), r('3', 'w')]);
  assert.deepEqual(d.diff.map((x) => x.a.id), ['1', '2']);
  assert.equal(d.same, 1);
});

test('ids on one side only are excluded and counted, never silently equal', () => {
  const d = diffRows([r('1', 'r'), r('2', 'r')], [r('1', 'r'), r('3', 'r')]);
  assert.deepEqual(d.onlyA, ['2']);
  assert.deepEqual(d.onlyB, ['3']);
  assert.equal(d.diff.length, 0);
});

test('parseRows reads the scorer format and refuses a bad header', () => {
  const ok = 'id,provider,method,path,truth,letter,review,evidence\n1,p,GET,/a,r,r,settled,"a,b"\n';
  assert.equal(parseRows(ok)[0].evidence, 'a,b');
  assert.throws(() => parseRows('id,x\n1,2\n'), /header/);
});
