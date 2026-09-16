import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOT_YOURS, classifyC26Base, excludeNotYours } from './c26.mjs';
import { classify as classifyC15 } from './c15.mjs';
import { loadCombinedCorpus } from './c19.mjs';

function row(overrides) {
  return {
    set: 'camara',
    vendor: 'someVendor',
    repo: 'SomeRepo',
    path: '/x',
    method: 'GET',
    operationId: 'doThing',
    gt_class: 'r',
    summary: '',
    description: '',
    ...overrides,
  };
}

// --- excludeNotYours ---------------------------------------------------

test('excludeNotYours removes hand-list words, keeps others, does not mutate input', () => {
  const [handWord] = [...NOT_YOURS];
  const input = new Set([handWord, 'zzz_not_on_hand_list']);
  const before = new Set(input);
  const out = excludeNotYours(input);

  assert.equal(out.has(handWord), false);
  assert.equal(out.has('zzz_not_on_hand_list'), true);
  assert.deepEqual(input, before, 'excludeNotYours must not mutate its argument');
});

test('excludeNotYours on an allowlist with no hand-list words returns an equivalent set', () => {
  const input = new Set(['project', 'file', 'record']);
  for (const w of input) assert.equal(NOT_YOURS.has(w), false, `test fixture assumption broken: ${w} is on NOT_YOURS`);
  const out = excludeNotYours(input);
  assert.deepEqual([...out].sort(), [...input].sort());
});

// --- classifyC26Base: floors ---------------------------------------------

test('classifyC26Base: GET floors to r', () => {
  const r = classifyC26Base(row({ method: 'GET', operationId: 'doObscureThing' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'floor');
  assert.equal(r.floor, true);
});

test('classifyC26Base: HEAD floors to r', () => {
  const r = classifyC26Base(row({ method: 'HEAD', operationId: 'doObscureThing' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'floor');
});

test('classifyC26Base: OPTIONS floors to r', () => {
  const r = classifyC26Base(row({ method: 'OPTIONS', operationId: 'doObscureThing' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'floor');
});

// --- classifyC26Base: POST read-verb lower --------------------------------

test('classifyC26Base: POST with a read verb lowers to r', () => {
  const r = classifyC26Base(row({ method: 'POST', operationId: 'retrieveThing', summary: '' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'read-verb');
  assert.equal(r.floor, false);
});

test('classifyC26Base: POST with no read verb floors to x', () => {
  const r = classifyC26Base(row({ method: 'POST', operationId: 'doObscureThing', summary: '' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'floor');
  assert.equal(r.floor, true);
});

// --- classifyC26Base: PUT/DELETE/PATCH live-verb raise --------------------

test('classifyC26Base: PUT with a live verb in operationId raises to x', () => {
  const r = classifyC26Base(row({ method: 'PUT', operationId: 'revokeThing', summary: '' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'live-verb');
  assert.equal(r.floor, false);
});

test('classifyC26Base: PUT with no matching words floors to w', () => {
  const r = classifyC26Base(row({ method: 'PUT', operationId: 'doObscureThing', summary: '' }));
  assert.equal(r.class, 'w');
  assert.equal(r.rule, 'floor');
  assert.equal(r.floor, true);
});

// --- the key contrast: c26 does NOT raise on a hand-list noun, c15 DOES --

test('classifyC26Base does NOT raise a DELETE whose head noun is a hand-list word (member), c15.classify DOES', () => {
  assert.equal(NOT_YOURS.has('member'), true, 'test fixture assumption broken: "member" must be on the hand list for this contrast to mean anything');

  const r = row({
    method: 'DELETE',
    operationId: 'deleteMember',
    summary: 'Delete member',
    description: '',
  });

  const c15Result = classifyC15(r);
  assert.equal(c15Result.class, 'x');
  assert.equal(c15Result.rule, 'party-noun');

  const c26Result = classifyC26Base(r);
  assert.equal(c26Result.class, 'w');
  assert.equal(c26Result.rule, 'floor');
  assert.equal(c26Result.floor, true);
});

// --- classifyC26Base never fires rule 'party-noun' ------------------------

test('classifyC26Base never returns rule "party-noun" for any row in the combined corpus', () => {
  const { allRows } = loadCombinedCorpus();
  let partyNounHits = 0;
  for (const r of allRows) {
    const res = classifyC26Base(r);
    if (res.rule === 'party-noun') partyNounHits += 1;
  }
  assert.equal(partyNounHits, 0);
});
