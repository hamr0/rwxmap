import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStep1, READ_VERBS, SAFE_VERBS } from './step1.mjs';

test('applyStep1: GET, HEAD and OPTIONS are claimed by the method rule', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.deepEqual(
      applyStep1({ method, operationId: 'doWhatever', path: '/things' }),
      { class: 'r', step: 1, rule: 'method' },
    );
  }
});

test('applyStep1: PUT, DELETE and PATCH are never claimed', () => {
  for (const method of ['PUT', 'DELETE', 'PATCH']) {
    assert.equal(applyStep1({ method, operationId: 'searchThings', path: '/things' }), null);
  }
});

test('applyStep1: POST SearchThings is claimed by the read-verb rule', () => {
  assert.deepEqual(
    applyStep1({ method: 'POST', operationId: 'SearchThings', path: '/things/search' }),
    { class: 'r', step: 1, rule: 'read-verb' },
  );
});

test('applyStep1: POST BulkRetrieveCustomers is claimed (lead modifier skipped)', () => {
  assert.deepEqual(
    applyStep1({ method: 'POST', operationId: 'BulkRetrieveCustomers', path: '/customers/bulk' }),
    { class: 'r', step: 1, rule: 'read-verb' },
  );
});

test('applyStep1: POST CreateThing is not claimed', () => {
  assert.equal(applyStep1({ method: 'POST', operationId: 'CreateThing', path: '/things' }), null);
});

test('applyStep1: POST verifyDomain is NOT claimed (verify is off the list on purpose)', () => {
  assert.equal(READ_VERBS.has('verify'), false);
  assert.equal(applyStep1({ method: 'POST', operationId: 'verifyDomain', path: '/domains/verify' }), null);
});

test('applyStep1: POST apps_validate_rollback is claimed by the read-verb-anywhere rule', () => {
  assert.deepEqual(
    applyStep1({ method: 'POST', operationId: 'apps_validate_rollback', path: '/v2/apps/{app_id}/rollback/validate' }),
    { class: 'r', step: 1, rule: 'read-verb-anywhere' },
  );
});

test('applyStep1: POST SearchThings is still claimed as read-verb (the lead rule wins)', () => {
  assert.deepEqual(
    applyStep1({ method: 'POST', operationId: 'SearchThings', path: '/things/search' }),
    { class: 'r', step: 1, rule: 'read-verb' },
  );
});

test('applyStep1: POST postListsIdMembers is NOT claimed (SAFE_VERBS is not READ_VERBS)', () => {
  assert.equal(SAFE_VERBS.has('list'), false);
  assert.equal(
    applyStep1({ method: 'POST', operationId: 'postListsIdMembers', path: '/lists/{list_id}/members' }),
    null,
  );
});

test('applyStep1: POST CreateThing is still not claimed by either POST rule', () => {
  assert.equal(applyStep1({ method: 'POST', operationId: 'CreateThing', path: '/things' }), null);
});
