import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questions, stateFor } from './criteria.mjs';
import { floorPostRows } from './make-rows.mjs';

test('stateFor carries exactly the five fields', () => {
  const row = {
    row_id: 'x1',
    provider: 'acme',
    method: 'POST',
    path: '/things',
    operationId: 'postThing',
    summary: 'Do a thing',
    description: 'Does a thing.',
    truth: 'x',
    confidence: 'high',
  };
  const state = stateFor(row);
  assert.deepEqual(Object.keys(state).sort(), ['description', 'method', 'operationId', 'path', 'summary'].sort());
  assert.equal(state.method, 'POST');
  assert.equal(state.path, '/things');
  assert.equal(state.operationId, 'postThing');
  assert.equal(state.summary, 'Do a thing');
  assert.equal(state.description, 'Does a thing.');
});

test('stateFor falls back to null for missing summary/description', () => {
  const state = stateFor({ method: 'POST', path: '/x', operationId: 'postX' });
  assert.equal(state.summary, null);
  assert.equal(state.description, null);
});

test('questions() has exactly one key isX of type noul', () => {
  const q = questions();
  assert.deepEqual(Object.keys(q), ['isX']);
  assert.equal(q.isX.type, 'noul');
  assert.ok(q.isX.instructions);
  assert.ok(q.isX.criteria.true);
  assert.ok(q.isX.criteria.false);
});

test('floorPostRows keeps only rows the D87 flow floors at floor-post', () => {
  const rows = [
    // GET -> step1 claims r (rule 'method'), never reaches the floor.
    { row_id: 'g1', provider: 'acme', method: 'GET', path: '/things', operationId: 'getThing', summary: 'Get a thing' },
    // DELETE -> step2 claims x (rule 'method-delete'), never reaches the floor.
    { row_id: 'd1', provider: 'acme', method: 'DELETE', path: '/things/{id}', operationId: 'deleteThing', summary: 'Delete a thing' },
    // PUT -> step3 claims w (rule 'method-floor'), never reaches the floor.
    { row_id: 'p1', provider: 'acme', method: 'PUT', path: '/things/{id}', operationId: 'putThing', summary: 'Replace a thing' },
    // POST with no read-verb, no CANT_UNDO verb, no KEEP_W verb -> floor-post.
    { row_id: 'f1', provider: 'acme', method: 'POST', path: '/things/frobnicate', operationId: 'frobnicateThing', summary: 'Frobnicate a thing' },
  ];
  const kept = floorPostRows(rows);
  assert.deepEqual(kept.map((r) => r.row_id), ['f1']);
});
