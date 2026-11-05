import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { factsQuestions, questionJson } from './jev-facts.mjs';
import { ruleLabel } from './rule.mjs';
import { run } from './run-jev.mjs';

const FRAMING = 'Each row is one HTTP operation. Decide what happens when a caller who holds a normal API key for this provider calls it. Answer only what the text of the row says or makes plain.';
const EXPECTED = {
  accessChange: {
    question: 'Does this call change who can do what to which resource?',
    definition: 'Access means rights: roles, permissions, policies that control access (IAM, resource, bucket, key policies), ACLs, allow lists, sharing settings, memberships of a team, org, project or group, scopes of a key or token, and who may sign up or join.',
    focus: 'Yes if the call adds, sets, replaces, edits or removes any of these. A policy that does not control access (autoscaling, lifecycle, retention, routing, rate limit) is not access.',
    true: 'It adds, sets, replaces, edits or removes a right, role, permission, access policy, ACL, allow list, sharing setting, membership, key or token scope, or a signup or join rule.',
    false: 'It changes nothing about who can do what: plain data, content, settings, configuration, or a non-access policy.',
  },
  narrowOnly: {
    question: 'Does the text say this access change only takes access away or reduces it?',
    definition: 'Only reduces: removes a right, lowers a role, narrows a scope, shrinks an allow list, removes a member. It gives nobody anything new.',
    focus: 'Yes only when the text plainly says the change can only reduce access. If it sets, replaces or edits access without saying which way, or can add, answer no. If the call changes no access, answer no.',
    true: 'The text plainly says the call only removes or reduces access.',
    false: 'It adds or may add access, sets or replaces access without saying which way, or changes no access.',
  },
  handsOver: {
    question: 'Does this call create or hand out something that lets someone act?',
    definition: 'Something that lets someone act: an API key, token, secret, password, signed or recovery link, session credential, a user or account that can log in, or a new member added to a team, org, project or group.',
    focus: 'Yes if the call creates, issues, returns for use, or sets any of these, or adds a member. Setting or changing a password counts. A key or token that is only computed and shown but cannot be used to act does not count.',
    true: 'It creates, issues or sets a key, token, secret, password, signed or recovery link, session credential, login user or account, or adds a member.',
    false: 'It hands out nothing that lets anyone act.',
  },
  outside: {
    question: 'Does this call set up something that sends data or events to an outside URL or service?',
    definition: 'Outside means a URL or service that is not this API: a webhook, callback, extension, integration, forwarding rule, export target, or event subscription.',
    focus: 'Yes if the call creates or turns on such a sender, or changes where it sends. Reading or listing one is no.',
    true: 'It creates, enables or redirects a sender of data or events to an outside URL or service.',
    false: 'It sets up nothing that sends data or events outside.',
  },
  otherX: {
    question: 'Does this call do something that a later call cannot take back?',
    definition: 'Cannot take back: deletes, removes, purges, clears or overwrites data with no trash or restore named; revokes, expires, rotates or resets a credential, key, token, secret, certificate or session; sends, delivers, notifies or publishes something to a person or the public, or exposes something publicly; moves money or commits to an outside party (charge, refund, pay, order); runs, triggers, executes, imports from outside, syncs, rebuilds or starts a job; cancels or stops something whose work or state is lost.',
    focus: 'Answer only from what the text says or makes plain. Posting a comment or reaction the same API can delete is no. Pausing or stopping something that can be started again is no. Restarting a server is no. A plain create, edit or setting change is no.',
    true: 'The text says or makes plain one of the things that cannot be taken back.',
    false: 'Everything it changes can be set back by a later call, or it only reads.',
  },
};

test('the five questions match the brief exactly', () => {
  const qs = factsQuestions();
  assert.deepEqual(Object.keys(qs), Object.keys(EXPECTED));
  for (const [k, e] of Object.entries(EXPECTED)) {
    assert.deepEqual(qs[k], {
      type: 'noul',
      instructions: { framing: FRAMING, question: e.question, definition: e.definition, inspect: ['description', 'summary', 'operationId', 'path', 'method'], focus: e.focus },
      criteria: { true: e.true, false: e.false },
    }, k);
  }
});

test('no ignore content anywhere', () => {
  assert.ok(!questionJson().includes('"ignore"'));
  for (const q of Object.values(factsQuestions())) assert.equal(q.instructions.ignore, undefined);
});

test('the rule table', () => {
  const no = { accessChange: 0, narrowOnly: 0, handsOver: 0, outside: 0, otherX: 0 };
  const L = (o) => ruleLabel({ ...no, ...o });
  assert.equal(L({ accessChange: 0.9 }), 'x');
  assert.equal(L({ accessChange: 0.9, narrowOnly: 0.9 }), 'w');
  assert.equal(L({ handsOver: 0.9 }), 'x');
  assert.equal(L({ outside: 0.9 }), 'x');
  assert.equal(L({ otherX: 0.9 }), 'x');
  assert.equal(L({}), 'w');
  assert.equal(L({ accessChange: 0.5 }), 'x'); // cut-off p >= 0.5
  assert.equal(L({ accessChange: 0.49 }), 'w');
  assert.equal(L({ narrowOnly: 0.9 }), 'w');
  assert.equal(L({ accessChange: 0.9, narrowOnly: 0.9, otherX: 0.9 }), 'x');
  const { otherX, ...missing } = no;
  assert.equal(ruleLabel(missing), 'x');
  assert.equal(ruleLabel({ ...no, handsOver: 'a' }), 'x');
  assert.equal(ruleLabel(null), 'x');
});

// ---- runner, stubbed fetch
const SCRIPT = new URL('./run-jev.mjs', import.meta.url).pathname;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'runjev2-'));
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
const REAL_SHA = new URL('../../data/pilot2-v4-2026-11-06/jev-facts-question.json.sha256', import.meta.url).pathname;
const lines = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const reply = (k, p) => ({ ok: true, status: 200, json: async () => ({ model: 'jev-test-1', answers: { [k]: { noul: p } }, usage: { input_tokens: 10, output_tokens: 2 } }) });

test('the committed question file and sha match the code', () => {
  const s = fs.readFileSync(new URL('../../data/pilot2-v4-2026-11-06/jev-facts-question.json', import.meta.url), 'utf8');
  assert.equal(s, questionJson());
  assert.equal(fs.readFileSync(REAL_SHA, 'utf8').split(/\s+/)[0], crypto.createHash('sha256').update(s).digest('hex'));
});

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
  const code = await run({ csvPath: csv, outPath: out, env: { RWXMAP_JEV_KEY: 'k' }, shaPath: bad, log: quiet, fetchImpl: async () => { calls++; return reply('accessChange', 0.5); } });
  assert.equal(code, 1);
  assert.equal(calls, 0);
  assert.ok(!fs.existsSync(out));
});

test('five requests per row, each one question; labels come from the rule', async () => {
  const { csv, out } = setup();
  // opA: otherX yes -> x. opB: access yes + narrowOnly yes -> w. opC: all no -> w.
  const table = {
    opA: { otherX: 0.9 },
    opB: { accessChange: 0.8, narrowOnly: 0.8 },
    opC: {},
  };
  const sent = [];
  const fetchImpl = async (url, init) => {
    const b = JSON.parse(init.body);
    const ks = Object.keys(b.questions);
    assert.equal(ks.length, 1);
    sent.push(b.state.operationId + ':' + ks[0]);
    assert.deepEqual(b.questions[ks[0]], factsQuestions()[ks[0]]);
    return reply(ks[0], table[b.state.operationId][ks[0]] ?? 0.1);
  };
  const code = await run({ csvPath: csv, outPath: out, env: { RWXMAP_JEV_KEY: 'k' }, shaPath: REAL_SHA, log: quiet, fetchImpl });
  assert.equal(code, 0);
  assert.equal(sent.length, 15);
  const byId = Object.fromEntries(lines(out).map((r) => [r.row_id, r]));
  assert.equal(byId.a1.label, 'x'); assert.equal(byId.a1.p.otherX, 0.9);
  assert.equal(byId.a2.label, 'w');
  assert.equal(byId.a3.label, 'w');
  assert.equal(byId.a1.model, 'jev-test-1');
  assert.equal(byId.a1.error, null);
  assert.equal(byId.a1.input, 50);
  assert.equal(byId.a1.output, 10);
});

test('an error or a missing answer on any of the five gives x with error set', async () => {
  const { csv, out } = setup();
  const fetchImpl = async (url, init) => {
    const b = JSON.parse(init.body);
    const k = Object.keys(b.questions)[0];
    if (b.state.operationId === 'opA' && k === 'outside') return { ok: false, status: 500, json: async () => ({}) };
    if (b.state.operationId === 'opB' && k === 'narrowOnly') return { ok: true, status: 200, json: async () => ({ model: 'm', answers: {} }) };
    return reply(k, 0.1);
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
  fs.writeFileSync(out, JSON.stringify({ row_id: 'a1', p: null, label: 'x', model: 'm', error: null }) + '\n');
  const seen = new Set();
  const fetchImpl = async (url, init) => { const b = JSON.parse(init.body); seen.add(b.state.operationId); return reply(Object.keys(b.questions)[0], 0.2); };
  await run({ csvPath: csv, outPath: out, env: { RWXMAP_JEV_KEY: 'k' }, shaPath: REAL_SHA, log: quiet, fetchImpl });
  assert.deepEqual([...seen].sort(), ['opB', 'opC']);
  assert.deepEqual(lines(out).map((r) => r.row_id), ['a1', 'a2', 'a3']);
});
