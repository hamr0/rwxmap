import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floorFor } from './floor.mjs';

test('floorFor: GET/HEAD/OPTIONS -> r', () => {
  assert.equal(floorFor('GET'), 'r');
  assert.equal(floorFor('HEAD'), 'r');
  assert.equal(floorFor('OPTIONS'), 'r');
});

test('floorFor: POST -> x', () => {
  assert.equal(floorFor('POST'), 'x');
});

test('floorFor: PUT/DELETE/PATCH -> w', () => {
  assert.equal(floorFor('PUT'), 'w');
  assert.equal(floorFor('DELETE'), 'w');
  assert.equal(floorFor('PATCH'), 'w');
});

test('floorFor: unrecognised method throws', () => {
  assert.throws(() => floorFor('TRACE'));
});
