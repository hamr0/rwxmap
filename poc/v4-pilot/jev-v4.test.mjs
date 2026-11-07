import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LETTERS, METHODS, CANT_UNDO, CAN_SET_BACK, TRIPWIRES, isXQuestionV4, questionJson } from './jev-v4.mjs';

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const BRIEF_PATH = process.env.BRIEF_V4 || new URL('../../data/relabel-v4-2026-11-05/BRIEF-v4.md', import.meta.url).pathname;
const brief = norm(fs.readFileSync(BRIEF_PATH, 'utf8'));

const leaves = (v, path = '') =>
  typeof v === 'string' ? [[path, v]] : Array.isArray(v) ? v.flatMap((x, i) => leaves(x, `${path}[${i}]`)) : Object.entries(v).flatMap(([k, x]) => leaves(x, `${path}.${k}`));

test('every brief-derived field is verbatim in BRIEF-v4.md', () => {
  const groups = { LETTERS, METHODS, CANT_UNDO, CAN_SET_BACK, TRIPWIRES };
  let n = 0;
  for (const [g, v] of Object.entries(groups)) {
    for (const [p, s] of leaves(v, g)) {
      n++;
      assert.ok(brief.includes(norm(s)), `not verbatim in brief: ${p}: ${s.slice(0, 60)}`);
    }
  }
  assert.equal(n, 38);
});

test('the question carries those same fields', () => {
  const j = questionJson();
  for (const [, s] of leaves({ LETTERS, METHODS, CANT_UNDO, CAN_SET_BACK, TRIPWIRES })) {
    assert.ok(j.includes(JSON.stringify(s).slice(1, -1)), 'missing from question: ' + s.slice(0, 40));
  }
  const q = isXQuestionV4();
  assert.equal(q.isX.type, 'noul');
  assert.deepEqual(Object.keys(q.isX.criteria), ['true', 'false']);
});

test('no v3-only text remains', () => {
  const j = questionJson();
  for (const bad of ['It does not matter whose thing it is', 'webhook, key, token', 'changing a role, permission, membership, assignment, owner']) {
    assert.ok(!j.includes(bad), 'v3 text present: ' + bad);
    assert.ok(!brief.includes(bad), 'sanity: brief itself has it: ' + bad);
  }
});
