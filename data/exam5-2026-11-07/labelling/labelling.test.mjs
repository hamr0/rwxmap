import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './validate.mjs';
import { findDisputes, loadLabels } from './build-truth.mjs';

const PART = 'row_id,provider,method,path,operationId,summary,description\ne-1,p,GET,/a,a,s,d\ne-2,p,POST,/b,b,s,"d, with ""q"""\n';
const H = 'row_id,truth_class,confidence,reason\n';

test('valid file passes with counts', () => {
  const r = validate(H + 'e-1,r,high,reads\ne-2,?,low,unclear\n', PART);
  assert.deepEqual(r.errors, []);
  assert.equal(r.counts.r, 1); assert.equal(r.unsure, 1); assert.equal(r.low, 1); assert.equal(r.distinct, 2);
});
test('bad header fails', () => assert.ok(validate('id,c,conf,why\ne-1,r,high,x\ne-2,w,high,y\n', PART).errors.length));
test('wrong order fails', () => assert.ok(validate(H + 'e-2,w,high,y\ne-1,r,high,x\n', PART).errors.length));
test('missing row fails', () => assert.ok(validate(H + 'e-1,r,high,x\n', PART).errors.length));
test('bad class fails', () => assert.ok(validate(H + 'e-1,q,high,x\ne-2,w,high,y\n', PART).errors.length));
test('confidence must be high or low', () => assert.ok(validate(H + 'e-1,r,medium,x\ne-2,w,high,y\n', PART).errors.length));
test('empty reason fails', () => assert.ok(validate(H + 'e-1,r,high,\ne-2,w,high,y\n', PART).errors.length));
test('distinct reasons counts unique text', () => assert.equal(validate(H + 'e-1,r,high,same\ne-2,w,high,same\n', PART).distinct, 1));

test('disputes: differ or ? on either side', () => {
  const ops = [['e-1'], ['e-2'], ['e-3'], ['e-4']];
  const A = loadLabels(H + 'e-1,r,high,a\ne-2,w,high,a\ne-3,?,low,a\ne-4,x,high,a\n');
  const B = loadLabels(H + 'e-1,r,high,b\ne-2,x,high,b\ne-3,w,high,b\ne-4,?,low,b\n');
  assert.deepEqual(findDisputes(ops, A, B).map((d) => d.op[0]), ['e-2', 'e-3', 'e-4']);
});
test('disputes: both ? is disputed', () => {
  const L = loadLabels(H + 'e-1,?,low,a\n');
  assert.equal(findDisputes([['e-1']], L, L).length, 1);
});
test('disputes: missing label throws', () => {
  assert.throws(() => findDisputes([['e-9']], new Map(), new Map()));
});
