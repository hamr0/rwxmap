import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step1, READ_VERBS, SAFE_VERBS } from './step1.js';

test('method rule: GET floors to r with an empty matched list', () => {
  const v = step1({ method: 'GET', operationId: 'listUsers' });
  assert.deepEqual(v, { class: 'r', step: 1, rule: 'method', source: 'floor', matched: [] });
});

test('method rule: HEAD and OPTIONS also floor to r', () => {
  const head = step1({ method: 'HEAD', operationId: 'x' });
  const options = step1({ method: 'OPTIONS', operationId: 'x' });
  assert.ok(head);
  assert.ok(options);
  assert.equal(head.rule, 'method');
  assert.equal(options.rule, 'method');
});

test('read-verb rule: POST with a READ_VERBS lead verb', () => {
  const v = step1({ method: 'POST', operationId: 'retrieveAccountBalance' });
  assert.deepEqual(v, {
    class: 'r', step: 1, rule: 'read-verb', source: 'list', matched: ['retrieve'],
  });
});

test('read-verb-anywhere rule: POST with a SAFE_VERBS word not at lead position', () => {
  const v = step1({ method: 'POST', operationId: 'appsValidateAppSpec' });
  assert.deepEqual(v, {
    class: 'r', step: 1, rule: 'read-verb-anywhere', source: 'list', matched: ['validate'],
  });
});

test('rule order: a lead verb in both READ_VERBS and SAFE_VERBS reports read-verb, not read-verb-anywhere', () => {
  // "validate" is a member of both lists (SAFE_VERBS subset of READ_VERBS).
  // At lead position, read-verb must win because it is checked first.
  const v = step1({ method: 'POST', operationId: 'validatePaymentMethod' });
  assert.ok(v);
  assert.equal(v.rule, 'read-verb');
  assert.equal(v.source, 'list');
  assert.deepEqual(v.matched, ['validate']);
});

test('null for a row step 1 does not claim (POST with no matching verb anywhere)', () => {
  const v = step1({ method: 'POST', operationId: 'createWidget' });
  assert.equal(v, null);
});

test('null for PUT/DELETE/PATCH (step 1 never assigns w or x)', () => {
  assert.equal(step1({ method: 'PUT', operationId: 'updateWidget' }), null);
  assert.equal(step1({ method: 'DELETE', operationId: 'deleteWidget' }), null);
  assert.equal(step1({ method: 'PATCH', operationId: 'patchWidget' }), null);
});

test('lead modifier is skipped: BulkRetrieveCustomers still matches read-verb via the lead', () => {
  const v = step1({ method: 'POST', operationId: 'BulkRetrieveCustomers' });
  assert.deepEqual(v, {
    class: 'r', step: 1, rule: 'read-verb', source: 'list', matched: ['retrieve'],
  });
});

test('lead modifier deprecated/beta/async are skipped the same way', () => {
  const deprecated = step1({ method: 'POST', operationId: 'DeprecatedBatchRetrieveInventoryCounts' });
  const beta = step1({ method: 'POST', operationId: 'beta_GetStatus' });
  const async_ = step1({ method: 'POST', operationId: 'asyncCheckStatus' });
  assert.ok(deprecated);
  assert.ok(beta);
  assert.ok(async_);
  assert.equal(deprecated.rule, 'read-verb');
  assert.equal(beta.rule, 'read-verb');
  assert.equal(async_.rule, 'read-verb');
});

test('words injection overrides the default lists', () => {
  // "banana" is not a real verb in either default list; inject it as the
  // only member of a custom readVerbs set and confirm it is what fires.
  const custom = { readVerbs: new Set(['banana']), safeVerbs: new Set() };
  const v = step1({ method: 'POST', operationId: 'bananaSomething' }, custom);
  assert.deepEqual(v, { class: 'r', step: 1, rule: 'read-verb', source: 'list', matched: ['banana'] });

  // With the defaults, the same operationId is not claimed (no matching verb).
  assert.equal(step1({ method: 'POST', operationId: 'bananaSomething' }), null);
});

test('words injection: an emptied safeVerbs set stops read-verb-anywhere from firing', () => {
  const v = step1({ method: 'POST', operationId: 'appsValidateAppSpec' }, { safeVerbs: new Set() });
  assert.equal(v, null);
});

test('matched is sorted ascending when more than one list member fires', () => {
  // No real corpus row fires more than one matched word (verified against
  // the 4171-row corpus while writing this test), so this case is
  // constructed: two SAFE_VERBS members both appear as tokens, in an order
  // that would come out unsorted if the code did not sort.
  const v = step1(
    { method: 'POST', operationId: 'somethingSuggestThenValidate' },
    { readVerbs: new Set(), safeVerbs: new Set(['suggest', 'validate']) },
  );
  assert.ok(v);
  assert.equal(v.rule, 'read-verb-anywhere');
  assert.deepEqual(v.matched, ['suggest', 'validate']);
});

test('READ_VERBS has 23 members and SAFE_VERBS has 10, SAFE_VERBS a strict subset of READ_VERBS', () => {
  assert.equal(READ_VERBS.size, 23);
  assert.equal(SAFE_VERBS.size, 10);
  for (const v of SAFE_VERBS) assert.ok(READ_VERBS.has(v));
});
