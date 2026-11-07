import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRow } from '../../src/flow.js';
import { candidates, score } from './lib.mjs';

const mk = (method, path, operationId = 'x') => ({ set: 't', id: path + method, row: { provider: 'v', method, path, operationId, summary: '' }, v4: 'x' });

test('no-op override gives 0 changes', () => {
  const rows = [mk('GET', '/things'), mk('PUT', '/things/{id}'), mk('POST', '/things/{id}/role'), mk('DELETE', '/things/{id}')];
  const base = rows.map((s) => classifyRow(s.row));
  const noop = { name: 'noop', words: {} };
  assert.equal(score(noop, rows, base).cnt.changed, 0);
});

test('A1 teammate: PUT /teammates/{id} moves w -> x and is counted as a closed loose-1 leak', () => {
  const rows = [mk('PUT', '/teammates/{id}')];
  const base = rows.map((s) => classifyRow(s.row));
  assert.equal(base[0].class, 'w');
  const a1 = candidates().find((c) => c.name === 'A1');
  const r = score(a1, rows, base);
  assert.equal(r.cnt.changed, 1);
  assert.equal(r.cnt.closed1, 1);
  assert.equal(r.changed[0].v.class, 'x');
});

test('B6 key: keyspaces drops to w, api-keys stays x', () => {
  const rows = [mk('PUT', '/keyspaces/{id}'), mk('PUT', '/api-keys/{id}')];
  const base = rows.map((s) => classifyRow(s.row));
  const r = score(candidates().find((c) => c.name === 'B6'), rows, base);
  assert.deepEqual(r.changed.map((c) => c.s.row.path), ['/keyspaces/{id}']);
});

test('B7: PUT /things/{id}/enable on a path-x-word row drops to w', () => {
  const rows = [mk('PUT', '/tokens/{id}/enable')];
  const base = rows.map((s) => classifyRow(s.row));
  assert.equal(base[0].class, 'x');
  const r = score(candidates().find((c) => c.name === 'B7'), rows, base);
  assert.equal(r.changed[0].v.class, 'w');
});
