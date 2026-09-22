import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step2v2, DESTRUCTIVE_VERBS, MODIFY_VERBS, OTHER_PARTY } from './step2.mjs';

const row = (method, operationId, summary = '', path = '/things/{id}') => ({ method, path, operationId, summary });

test('DELETE -> x, method-delete floor, destructive', () => {
  assert.deepEqual(step2v2(row('DELETE', 'getThing')), {
    class: 'x', step: 2, rule: 'method-delete', source: 'floor', matched: [], destructive: true,
  });
});

test('PUT with a destructive lead verb -> x destructive-verb', () => {
  for (const [op, word] of [['revokeToken', 'revoke'], ['purge_cache', 'purge'], ['terminateSession', 'terminate']]) {
    const v = step2v2(row('PUT', op));
    assert.equal(v.class, 'x', op);
    assert.equal(v.rule, 'destructive-verb', op);
    assert.equal(v.source, 'list', op);
    assert.deepEqual(v.matched, [word], op);
    assert.equal(v.destructive, true, op);
  }
});

test('PUT deleteThing: `delete` is a METHOD_WORDS word, so the verb is read off the summary (frozen behaviour)', () => {
  // With a summary that says Delete, it fires by the summary route.
  const v = step2v2(row('PUT', 'deleteThing', 'Delete a thing'));
  assert.equal(v.rule, 'destructive-verb-summary');
  assert.deepEqual(v.matched, ['delete']);
  assert.equal(v.destructive, true);
  // With no summary there is no verb to read and the row falls to the floor.
  // This is the frozen reader's blind spot, kept on purpose: the readout
  // measures the same reader the frozen step 2 uses.
  assert.equal(step2v2(row('PUT', 'deleteThing')).rule, 'method-floor');
});

test('PUT plain update -> w method-floor', () => {
  assert.deepEqual(step2v2(row('PUT', 'updateThing')), {
    class: 'w', step: 2, rule: 'method-floor', source: 'floor', matched: [], destructive: false,
  });
});

test('PATCH -> w method-floor', () => {
  const v = step2v2(row('PATCH', 'patchThing'));
  assert.equal(v.class, 'w');
  assert.equal(v.rule, 'method-floor');
  assert.equal(v.destructive, false);
});

test('POST deleteWebhook / removeUserWebhook -> x even with `user` in the row (not gated)', () => {
  // deleteWebhook: lead `delete` is a METHOD_WORDS word, so the verb comes
  // from the summary — destructive-verb-summary.
  const v = step2v2(row('POST', 'deleteWebhook', 'Delete a user webhook', '/users/{id}/webhooks'));
  assert.equal(v.class, 'x');
  assert.equal(v.rule, 'destructive-verb-summary');
  assert.deepEqual(v.matched, ['delete']);
  assert.equal(v.destructive, true);
  // removeUserWebhook: `remove` is not a method word, so it fires at the
  // lead — destructive-verb — and the `user` word does not block it.
  const r = step2v2(row('POST', 'removeUserWebhook', 'Remove a webhook for a user', '/users/{id}/webhooks'));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'destructive-verb');
  assert.deepEqual(r.matched, ['remove']);
  assert.equal(r.destructive, true);
});

test('POST updateUser -> null (gated by OTHER_PARTY)', () => {
  assert.equal(step2v2(row('POST', 'updateUser')), null);
});

test('POST updateThing -> w modify-verb', () => {
  assert.deepEqual(step2v2(row('POST', 'updateThing')), {
    class: 'w', step: 2, rule: 'modify-verb', source: 'list', matched: ['update'], destructive: false,
  });
});

test('POST createThing -> null', () => {
  assert.equal(step2v2(row('POST', 'createThing')), null);
});

test('GET -> null', () => {
  assert.equal(step2v2(row('GET', 'deleteThing')), null);
});

test('summary verb: lead is a METHOD_WORDS word, summary says Delete -> x destructive-verb-summary', () => {
  const v = step2v2(row('POST', 'PostThingsThing', 'Delete a thing'));
  assert.equal(v.class, 'x');
  assert.equal(v.rule, 'destructive-verb-summary');
  assert.deepEqual(v.matched, ['delete']);
  assert.equal(v.destructive, true);
  // PUT with a bare method lead reads the summary the same way.
  const p = step2v2(row('PUT', 'PutThingsId', 'Revoke a thing'));
  assert.equal(p.rule, 'destructive-verb-summary');
  assert.deepEqual(p.matched, ['revoke']);
});

test('words override works for all three lists', () => {
  // Drop `delete` from the destructive list: PUT deleteThing falls to the floor.
  const noDelete = new Set([...DESTRUCTIVE_VERBS].filter((v) => v !== 'delete'));
  assert.equal(step2v2(row('PUT', 'deleteThing'), { destructiveVerbs: noDelete }).rule, 'method-floor');
  // Add `set` to the modify list: POST setThing becomes w modify-verb.
  const withSet = new Set([...MODIFY_VERBS, 'set']);
  assert.equal(step2v2(row('POST', 'setThing'), { modifyVerbs: withSet }).rule, 'modify-verb');
  // Empty the gate: POST updateUser is no longer blocked.
  assert.equal(step2v2(row('POST', 'updateUser'), { otherParty: new Set() }).rule, 'modify-verb');
  // Add `thing` to the gate: POST updateThing is now blocked.
  assert.equal(step2v2(row('POST', 'updateThing'), { otherParty: new Set([...OTHER_PARTY, 'thing']) }), null);
});

test('MODIFY_VERBS and DESTRUCTIVE_VERBS are disjoint; sizes as documented', () => {
  const overlap = [...MODIFY_VERBS].filter((v) => DESTRUCTIVE_VERBS.has(v));
  assert.deepEqual(overlap, []);
  assert.equal(DESTRUCTIVE_VERBS.size, 23);
  assert.equal(MODIFY_VERBS.size, 16);
  assert.equal(OTHER_PARTY.size, 21);
});
