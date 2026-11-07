import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseRows } from './lean.mjs';
import { classifyRow } from './flow.js';

const LEAN = fileURLToPath(new URL('./lean.mjs', import.meta.url));
const H = 'id,provider,method,path,operationId,summary,description\n';
const run = (csv) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-'));
  const f = path.join(d, 'ops.csv');
  fs.writeFileSync(f, csv);
  const r = spawnSync('node', [LEAN, f, path.join(d, 'out')], { encoding: 'utf8' });
  return { r, d };
};

test('parser handles quoted comma, newline and doubled quote', () => {
  const rows = parseRows('a,b\n"x,y","line1\nline2 ""q"""\n');
  assert.deepEqual(rows, [['a', 'b'], ['x,y', 'line1\nline2 "q"']]);
});

test('output matches classifyRow directly', () => {
  const ops = [
    ['1', 'p', 'GET', '/users', 'listUsers', 'List, users', 'd'],
    ['2', 'p', 'DELETE', '/users/{id}', 'deleteUser', 'say "hi"', 'a\nb'],
    ['3', 'p', 'POST', '/users', 'createUser', '', ''],
    ['4', 'p', 'PUT', '/users/{id}', 'updateUser', '', ''],
  ];
  const qq = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  const { r, d } = run(H + ops.map((o) => o.map(qq).join(',')).join('\n') + '\n');
  assert.equal(r.status, 0, r.stderr);
  const lines = fs.readFileSync(path.join(d, 'out/lean.csv'), 'utf8').trim().split('\n');
  assert.equal(lines[0], 'id,class,rule,marker');
  const want = ops.map((o) => {
    const v = classifyRow({ method: o[2], path: o[3], operationId: o[4], summary: o[5], description: o[6] });
    return [o[0], v.class, v.rule, v.review].join(',');
  });
  assert.deepEqual(lines.slice(1), want);
  assert.match(fs.readFileSync(path.join(d, 'out/lean.csv.sha256'), 'utf8'), /^[0-9a-f]{64} {2}lean\.csv\n$/);
  assert.match(fs.readFileSync(path.join(d, 'out/lean-counts.txt'), 'utf8'), /total rows\t4/);
});

test('bad header exits 1', () => {
  const { r } = run('id,provider,method\n1,p,GET\n');
  assert.equal(r.status, 1);
});

test('duplicate id exits 1', () => {
  const { r } = run(H + '1,p,GET,/a,a,,\n1,p,GET,/b,b,,\n');
  assert.equal(r.status, 1);
});

test('wrong field count exits 1', () => {
  const { r } = run(H + '1,p,GET\n');
  assert.equal(r.status, 1);
});
