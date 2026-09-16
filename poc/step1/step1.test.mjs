import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStep1, READ_VERBS } from './step1.mjs';

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
