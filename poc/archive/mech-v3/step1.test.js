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

// --- D99 plural-noun guard -------------------------------------------------

test('D99 guard: github checks/rerequest-suite on POST is not claimed by read-verb', () => {
  // Corpus row b0127 (github, truth x). The lead token is the resource
  // noun "checks", which stemMatches accepts as the verb "check"; the real
  // action is "rerequest". The row must fall through step 1 untouched.
  const v = step1({
    method: 'POST',
    path: '/repos/{owner}/{repo}/check-suites/{check_suite_id}/rerequest',
    operationId: 'checks/rerequest-suite',
    summary: 'Rerequest a check suite',
  });
  assert.equal(v, null);
});

test('D99 guard: a bare lead verb still claims read-verb', () => {
  for (const [operationId, matched] of [
    ['listAccounts', 'list'],
    ['checkPermission', 'check'],
    ['queryUsage', 'query'],
  ]) {
    const v = step1({ method: 'POST', operationId });
    assert.deepEqual(v, {
      class: 'r', step: 1, rule: 'read-verb', source: 'list', matched: [matched],
    }, operationId);
  }
});

test('D99 guard: the -es and consonant+y -> -ies plural forms are guarded too', () => {
  // "queries" reaches "query" only through y -> ies; "matches" and
  // "searches" reach "match"/"search" only through -es.
  assert.equal(step1({ method: 'POST', operationId: 'queries.post' }), null);
  assert.equal(step1({ method: 'POST', operationId: 'matches/create' }), null);
  assert.equal(step1({ method: 'POST', operationId: 'searches/rerun' }), null);
});

test('D99 guard: a non-plural inflection still claims read-verb', () => {
  // No row in the tuning pool leads with a gerund or a past form — an
  // operationId names its action in the imperative — so this case is
  // constructed to pin the guard's boundary: only the plural/3sg
  // inflections are withheld, every other inflection stemMatches accepts
  // is still read as a real verb.
  const ing = step1({ method: 'POST', operationId: 'listingAccounts' });
  assert.ok(ing);
  assert.equal(ing.rule, 'read-verb');
  assert.deepEqual(ing.matched, ['list']);

  const ed = step1({ method: 'POST', operationId: 'checked_state' });
  assert.ok(ed);
  assert.equal(ed.rule, 'read-verb');
  assert.deepEqual(ed.matched, ['check']);
});

test('D99 guard: an exact match alongside a plural match still claims', () => {
  // Constructed via the words injection: when the lead token IS a member
  // outright it is a real verb, whatever else it also pluralises into.
  const v = step1(
    { method: 'POST', operationId: 'checks_rerequest_suite' },
    { readVerbs: new Set(['check', 'checks']) },
  );
  assert.ok(v);
  assert.equal(v.rule, 'read-verb');
  assert.deepEqual(v.matched, ['check', 'checks']);
});

test('D99 guard: does not touch the GET/HEAD/OPTIONS method floor', () => {
  const v = step1({ method: 'GET', operationId: 'checks/list-suites' });
  assert.deepEqual(v, { class: 'r', step: 1, rule: 'method', source: 'floor', matched: [] });
});

test('D99 guard: does not touch read-verb-anywhere', () => {
  // The lead token "checks" is guarded, so read-verb cannot claim; the
  // SAFE_VERBS word "validate" deeper in the name still can.
  const v = step1({ method: 'POST', operationId: 'checks/validate-suite' });
  assert.deepEqual(v, {
    class: 'r', step: 1, rule: 'read-verb-anywhere', source: 'list', matched: ['validate'],
  });
});
