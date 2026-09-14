import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASELINES } from './baselines.mjs';

function findBaseline(name) {
  const b = BASELINES.find((x) => x.name === name);
  assert.ok(b, `baseline "${name}" not found in BASELINES`);
  return b;
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

test('all-x classifies every method as x', () => {
  const { classify } = findBaseline('all-x');
  for (const method of METHODS) {
    assert.equal(classify({ method }).class, 'x', method);
  }
});

test('get-else-x: GET is r, everything else is x', () => {
  const { classify } = findBaseline('get-else-x');
  assert.equal(classify({ method: 'GET' }).class, 'r');
  assert.equal(classify({ method: 'POST' }).class, 'x');
  assert.equal(classify({ method: 'PUT' }).class, 'x');
  assert.equal(classify({ method: 'DELETE' }).class, 'x');
  assert.equal(classify({ method: 'PATCH' }).class, 'x');
});

test('method-prior: GET r, PUT/DELETE w, POST/PATCH x', () => {
  const { classify } = findBaseline('method-prior');
  assert.equal(classify({ method: 'GET' }).class, 'r');
  assert.equal(classify({ method: 'POST' }).class, 'x');
  assert.equal(classify({ method: 'PUT' }).class, 'w');
  assert.equal(classify({ method: 'DELETE' }).class, 'w');
  assert.equal(classify({ method: 'PATCH' }).class, 'x');
});

test('BASELINES is an ordered list of the three expected names', () => {
  assert.deepEqual(BASELINES.map((b) => b.name), ['all-x', 'get-else-x', 'method-prior']);
});
