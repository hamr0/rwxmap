import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './c11.mjs';

function row(overrides) {
  return {
    set: 'camara',
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

test('GET is locked r regardless of text', () => {
  const r = classify(row({ method: 'GET', operationId: 'terminateEverything' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'locked');
  assert.equal(r.floor, true);
});

test('POST with no list hit floors to x', () => {
  const r = classify(row({ method: 'POST', operationId: 'doSomethingObscure', summary: '' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'floor');
  assert.equal(r.floor, true);
});

test('POST getFoo is lowered to r by read-verb', () => {
  const r = classify(row({ method: 'POST', operationId: 'getFoo' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'read-verb');
});

test('POST validateFoo floors to x (not a read verb, not a live verb)', () => {
  const r = classify(row({ method: 'POST', operationId: 'validateFoo' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'floor');
});

test('DELETE terminateCall raises to x via live-verb', () => {
  const r = classify(row({ method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'live-verb');
});

test('PUT updateSessionStatus raises to x via party-noun', () => {
  const r = classify(row({
    method: 'PUT',
    path: '/sessions/{mediaSessionId}/status',
    operationId: 'updateSessionStatus',
    summary: 'Update the status of the media session',
  }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'party-noun');
});

test('DELETE for-the-authenticated-user caller phrase suppresses party-noun raise, falls to w floor', () => {
  const r = classify(row({
    method: 'DELETE',
    path: '/user/emails',
    operationId: 'users/delete-email-for-authenticated-user',
    summary: 'Delete an email address for the authenticated user',
  }));
  assert.equal(r.class, 'w');
  assert.equal(r.rule, 'floor');
  // caller-phrase is recorded as evidence but must not raise the class.
  assert.equal(r.evidence.includes('caller-phrase'), true);
});

test('DELETE with empty summary and empty description floors to x via no-text (Rule A)', () => {
  const r = classify(row({ method: 'DELETE', operationId: '', summary: '', description: '' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'no-text');
  assert.equal(r.floor, true);
  assert.deepEqual(r.evidence, ['no-text']);
});

test('DELETE with empty summary but non-empty description and no list hit falls to w floor', () => {
  const r = classify(row({
    method: 'DELETE',
    operationId: 'doThing',
    summary: '',
    description: 'Removes a resource owned by the caller.',
  }));
  assert.equal(r.class, 'w');
  assert.equal(r.rule, 'floor');
});

test('PATCH with no text floors to x via no-text (Rule A)', () => {
  const r = classify(row({ method: 'PATCH', operationId: '', summary: '', description: '' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'no-text');
});

test('POST with no text still floors to x via the ordinary POST prior, never no-text (Rule A never touches POST)', () => {
  const r = classify(row({ method: 'POST', operationId: '', summary: '', description: '' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'floor');
  assert.notEqual(r.rule, 'no-text');
});

test('DELETE delete_channel with empty summary and a non-empty description raises to x via shared-noun opid-token', () => {
  const r = classify(row({
    method: 'DELETE',
    operationId: 'delete_channel',
    summary: '',
    description: 'Deletes a guild channel.',
  }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'party-noun');
  assert.equal(r.evidence.includes('opid-token:channel'), true);
});

test('DELETE deleteBroadcastChatMessage with a shared-noun summary raises to x via party-noun', () => {
  const r = classify(row({
    method: 'DELETE',
    operationId: 'deleteBroadcastChatMessage',
    summary: 'Remove a chat message from a live broadcast',
  }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'party-noun');
});

// --- M1-C13 fix C (adopted 2026-09-08): stem matching is now the default
// for LIVE_VERBS/READ_VERBS matching on both the opid and summary paths ---

test('POST cancelsSubscription (inflected LIVE_VERBS entry "cancel" + "s") raises to x via live-verb, opid path', () => {
  const r = classify(row({ method: 'POST', operationId: 'cancelsSubscription', summary: '' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'live-verb');
  assert.equal(r.evidence[0], 'opid:cancels');
});

test('DELETE with an inflected LIVE_VERBS hit ("canceled") only in the summary raises to x via live-verb, summary path', () => {
  const r = classify(row({
    method: 'DELETE',
    operationId: 'doThing',
    summary: 'Canceled the pending request',
  }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'live-verb');
  assert.equal(r.evidence[0], 'summary:canceled');
});

test('POST fetchingAccountBalance (inflected READ_VERBS entry "fetch" + "ing") is lowered to r via read-verb', () => {
  const r = classify(row({ method: 'POST', operationId: 'fetchingAccountBalance', summary: '' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'read-verb');
  assert.equal(r.evidence[0], 'opid:fetching');
});

test('POST retrievingAccountBalance (inflected READ_VERBS entry "retrieve" + silent-e "-ing") is lowered to r via read-verb (M1-C13 fix D closes the silent-e gap noted here previously)', () => {
  const r = classify(row({ method: 'POST', operationId: 'retrievingAccountBalance', summary: '' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'read-verb');
  assert.equal(r.evidence[0], 'opid:retrieving');
});

test('POST invokeSomething does not raise via live-verb: "invoke" is a real-list near-miss of LIVE_VERBS\'s "revoke", not the same word', () => {
  const r = classify(row({ method: 'POST', operationId: 'invokeSomething', summary: '' }));
  assert.notEqual(r.rule, 'live-verb');
});

test('DELETE spendCredits does not raise via live-verb: "spend" is a real-list near-miss of LIVE_VERBS\'s "send", not the same word', () => {
  const r = classify(row({ method: 'DELETE', operationId: 'spendCredits', summary: 'Spend a credit balance' }));
  assert.notEqual(r.rule, 'live-verb');
});

test('POST with "message" in the operationId still floors to x (step 3 does not run on POST)', () => {
  const r = classify(row({
    method: 'POST',
    operationId: 'sendChannelMessage',
    summary: 'Send a message to a channel',
  }));
  assert.equal(r.class, 'x');
});
