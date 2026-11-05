import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run } from './run-jev.mjs';

const SCRIPT = new URL('./run-jev.mjs', import.meta.url).pathname;
const REAL_SHA = new URL('../../data/pilot-v4-2026-11-05/jev-v4-question.json.sha256', import.meta.url).pathname;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'runjev-'));
const quiet = () => {};
const CSV = 'row_id,provider,method,path,operationId,summary,description\n'
  + 'a1,v,PATCH,/a,opA,Sum A,\n'
  + 'a2,v,POST,/b,opB,Sum B,"desc, with comma"\n'
  + 'a3,v,PUT,/c,opC,Sum C,\n';

function setup() {
  const d = tmp();
  const csv = path.join(d, 'in.csv');
  fs.writeFileSync(csv, CSV);
  return { csv, out: path.join(d, 'out.jsonl'), d };
}
const okRes = (p, model = 'jev-test-1') => ({ ok: true, status: 200, json: async () => ({ model, answers: { isX: { noul: p } }, usage: { input_tokens: 10, output_tokens: 2 } }) });
const lines = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('missing key exits 1 and sends nothing (real process, no key)', () => {
  const { csv, out, d } = setup();
  const env = { ...process.env }; delete env.RWXMAP_JEV_KEY;
  const r = spawnSync(process.execPath, [SCRIPT, csv, out], { env, cwd: d, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.ok(!fs.existsSync(out));
});

test('sha mismatch exits 1 before any request', async () => {
  const { csv, out, d } = setup();
  const bad = path.join(d, 'bad.sha256');
  fs.writeFileSync(bad, '0'.repeat(64) + '  x\n');
  let calls = 0;
  const code = await run({ csvPath: csv, outPath: out, env: { RWXMAP_JEV_KEY: 'k' }, shaPath: bad, log: quiet, fetchImpl: async () => { calls++; return okRes(0.5); } });
  assert.equal(code, 1);
  assert.equal(calls, 0);
  assert.ok(!fs.existsSync(out));
});

test('p 0.7 is x, p 0.3 is w, model recorded, request carries the v4 question', async () => {
  const { csv, out } = setup();
  const ps = { opA: 0.7, opB: 0.3, opC: 0.5 };
  let sentQuestions;
  const fetchImpl = async (url, init) => {
    const b = JSON.parse(init.body);
    sentQuestions = JSON.stringify(b.questions);
    return okRes(ps[b.state.operationId]);
  };
  const code = await run({ csvPath: csv, outPath: out, env: { RWXMAP_JEV_KEY: 'k' }, shaPath: REAL_SHA, log: quiet, fetchImpl });
  assert.equal(code, 0);
  const byId = Object.fromEntries(lines(out).map((r) => [r.row_id, r]));
  assert.equal(byId.a1.label, 'x'); assert.equal(byId.a1.p, 0.7);
  assert.equal(byId.a2.label, 'w'); assert.equal(byId.a2.p, 0.3);
  assert.equal(byId.a3.label, 'x'); // 0.5 is x
  assert.equal(byId.a1.model, 'jev-test-1');
  assert.equal(byId.a1.error, null);
  assert.equal(sentQuestions, fs.readFileSync(new URL('../../data/pilot-v4-2026-11-05/jev-v4-question.json', import.meta.url), 'utf8'));
});

test('an error or malformed answer gives x with error set', async () => {
  const { csv, out } = setup();
  const fetchImpl = async (url, init) => {
    const id = JSON.parse(init.body).state.operationId;
    if (id === 'opA') return { ok: false, status: 500, json: async () => ({}) };
    if (id === 'opB') return { ok: true, status: 200, json: async () => ({ model: 'm', answers: {} }) };
    return okRes(0.1);
  };
  await run({ csvPath: csv, outPath: out, env: { RWXMAP_JEV_KEY: 'k' }, shaPath: REAL_SHA, log: quiet, fetchImpl });
  const byId = Object.fromEntries(lines(out).map((r) => [r.row_id, r]));
  for (const id of ['a1', 'a2']) {
    assert.equal(byId[id].label, 'x');
    assert.equal(byId[id].p, null);
    assert.ok(byId[id].error);
  }
  assert.equal(byId.a3.label, 'w');
  assert.equal(byId.a3.error, null);
});

test('a restart skips rows already in out.jsonl', async () => {
  const { csv, out } = setup();
  fs.writeFileSync(out, JSON.stringify({ row_id: 'a1', p: 0.9, label: 'x', model: 'm', error: null }) + '\n');
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push(JSON.parse(init.body).state.operationId); return okRes(0.2); };
  await run({ csvPath: csv, outPath: out, env: { RWXMAP_JEV_KEY: 'k' }, shaPath: REAL_SHA, log: quiet, fetchImpl });
  assert.deepEqual(seen.sort(), ['opB', 'opC']);
  assert.deepEqual(lines(out).map((r) => r.row_id), ['a1', 'a2', 'a3']);
});
