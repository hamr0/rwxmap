import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step2, floorPost, CANT_UNDO, REMOVES } from './step2.js';
import { KEEP_W } from './step3.js';
import { stemMatches } from './tokens.js';

test('method-delete rule: DELETE always floors to x, destructive true, empty matched', () => {
  const v = step2({ method: 'DELETE', operationId: 'deleteWidget' });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true,
  });
});

test('method-delete rule: DELETE is x even with a KEEP_W verb in the operationId', () => {
  // DELETE beats every word (D87): it never even reaches a KEEP_W check.
  const v = step2({ method: 'DELETE', operationId: 'updateThing' });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true,
  });
});

test('cant-undo-verb rule: POST with a CANT_UNDO lead verb', () => {
  const v = step2({ method: 'POST', operationId: 'cancelSubscription' });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['cancel'],
  });
});

test('cant-undo-verb rule: PUT and PATCH are also eligible', () => {
  // Both "revoke" and "void" are REMOVES members, so both come back
  // destructive too.
  const put = step2({ method: 'PUT', operationId: 'revokeToken' });
  const patch = step2({ method: 'PATCH', operationId: 'voidInvoice' });
  assert.deepEqual(put, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['revoke'], destructive: true,
  });
  assert.deepEqual(patch, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['void'], destructive: true,
  });
});

test('cant-undo-verb rule: destructive true only when a REMOVES member matched', () => {
  const removeVerb = step2({ method: 'POST', operationId: 'purgeRecords' });
  const nonRemoveVerb = step2({ method: 'POST', operationId: 'cancelSubscription' });
  assert.ok(removeVerb);
  assert.ok(nonRemoveVerb);
  assert.equal(removeVerb.destructive, true);
  assert.equal(nonRemoveVerb.destructive, undefined);
});

test('cant-undo-verb-summary rule: bare-method lead falls back to the summary verb', () => {
  const v = step2({
    method: 'POST',
    operationId: 'PostTaxCalculations',
    summary: 'Cancel a tax calculation',
  });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'cant-undo-verb-summary', source: 'list', matched: ['cancel'],
  });
});

test('cant-undo-verb-summary fires only when the lead token is a bare method word', () => {
  const v = step2({
    method: 'POST',
    operationId: 'cancelWidget',
    summary: 'Delete a widget',
  });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['cancel'],
  });
});

test('D87 reader fix in action: POST deleteThing reads "delete" as its lead verb, x destructive', () => {
  const v = step2({ method: 'POST', operationId: 'deleteThing' });
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['delete'], destructive: true,
  });
});

test('null for a GET row (step 2 never assigns r)', () => {
  assert.equal(step2({ method: 'GET', operationId: 'listWidgets' }), null);
});

test('null for a POST with no CANT_UNDO verb', () => {
  assert.equal(step2({ method: 'POST', operationId: 'createWidget' }), null);
});

test('no "whose" gate: a CANT_UNDO verb claims x regardless of who the row reaches (D87 drops OTHER_PARTY)', () => {
  const v = step2({ method: 'POST', operationId: 'removeUserFromTeam' });
  // "remove" is not a CANT_UNDO member (it moved to KEEP_W under D87), so
  // this specific row is unclaimed — but nothing about the OTHER_PARTY
  // gate blocks it; a CANT_UNDO verb below proves the point directly.
  assert.equal(v, null);
  const claimed = step2({ method: 'POST', operationId: 'cancelUserSubscription' });
  assert.deepEqual(claimed, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['cancel'],
  });
});

test('words injection overrides CANT_UNDO and REMOVES', () => {
  const custom = { cantUndo: new Set(['banana']), removes: new Set(['banana']) };
  const v = step2({ method: 'POST', operationId: 'bananaWidget' }, custom);
  assert.deepEqual(v, {
    class: 'x', step: 2, rule: 'cant-undo-verb', source: 'list', matched: ['banana'], destructive: true,
  });

  // With the defaults, the same operationId is not claimed.
  assert.equal(step2({ method: 'POST', operationId: 'bananaWidget' }), null);
});

test('floorPost: the floor verdict always carries an empty matched list, class x, step 2', () => {
  assert.deepEqual(floorPost(), { class: 'x', step: 2, rule: 'floor-post', source: 'floor', matched: [] });
});

test('CANT_UNDO has 29 members, REMOVES has 6 and is a subset of CANT_UNDO', () => {
  assert.equal(CANT_UNDO.size, 29);
  assert.equal(REMOVES.size, 6);
  for (const m of REMOVES) assert.ok(CANT_UNDO.has(m));
});

test('CANT_UNDO and KEEP_W are disjoint under stem matching (no row can match both)', () => {
  for (const a of CANT_UNDO) {
    for (const b of KEEP_W) {
      assert.ok(!stemMatches(a, b) && !stemMatches(b, a), `${a} vs ${b} unexpectedly stem-match`);
    }
  }
});
