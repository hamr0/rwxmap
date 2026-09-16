import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './c15.mjs';

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

// --- each method's floor, no matching words --------------------------------

test('GET with no matching words floors to r', () => {
  const r = classify(row({ method: 'GET', operationId: 'doObscureThing', summary: '' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'floor');
  assert.equal(r.floor, true);
});

test('HEAD floors to r', () => {
  const r = classify(row({ method: 'HEAD', operationId: 'doObscureThing' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'floor');
});

test('OPTIONS floors to r', () => {
  const r = classify(row({ method: 'OPTIONS', operationId: 'doObscureThing' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'floor');
});

test('POST with no matching words floors to x', () => {
  const r = classify(row({ method: 'POST', operationId: 'doObscureThing', summary: '' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'floor');
  assert.equal(r.floor, true);
});

test('PUT with no matching words floors to w', () => {
  const r = classify(row({ method: 'PUT', operationId: 'doObscureThing', summary: '' }));
  assert.equal(r.class, 'w');
  assert.equal(r.rule, 'floor');
  assert.equal(r.floor, true);
});

test('DELETE with no matching words floors to w', () => {
  const r = classify(row({ method: 'DELETE', operationId: 'doObscureThing', summary: '' }));
  assert.equal(r.class, 'w');
  assert.equal(r.rule, 'floor');
  assert.equal(r.floor, true);
});

test('PATCH with no matching words floors to w (the c11 change: c11 floors PATCH at x)', () => {
  const r = classify(row({ method: 'PATCH', operationId: 'doObscureThing', summary: '' }));
  assert.equal(r.class, 'w');
  assert.equal(r.rule, 'floor');
  assert.equal(r.floor, true);
});

// --- GET runs no word rules at all ------------------------------------------

test('GET whose operationId contains a LIVE_VERBS word is still r (no word rules run on locked methods)', () => {
  const r = classify(row({ method: 'GET', operationId: 'terminateEverything', summary: 'Terminate everything' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'floor');
  assert.equal(r.floor, true);
  assert.deepEqual(r.evidence, []);
});

// --- POST lowers on a read verb and never raises ----------------------------

test('POST getFoo is lowered to r by read-verb', () => {
  const r = classify(row({ method: 'POST', operationId: 'getFoo' }));
  assert.equal(r.class, 'r');
  assert.equal(r.rule, 'read-verb');
  assert.equal(r.floor, false);
  assert.equal(r.evidence[0], 'opid:get');
});

test('POST never raises even when the operationId contains a LIVE_VERBS word (no raise rules run on POST)', () => {
  const r = classify(row({ method: 'POST', operationId: 'terminateSubscription', summary: 'Terminate a subscription' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'floor');
  assert.notEqual(r.rule, 'live-verb');
});

// --- PUT/DELETE/PATCH raise on a live verb ----------------------------------

test('DELETE terminateCall raises to x via live-verb (negative control)', () => {
  const r = classify(row({ method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall' }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'live-verb');
  assert.equal(r.evidence[0], 'opid:terminate');
});

test('PUT updateSessionStatus raises to x via party-noun (negative control)', () => {
  const r = classify(row({
    method: 'PUT',
    path: '/sessions/{mediaSessionId}/status',
    operationId: 'updateSessionStatus',
    summary: 'Update the status of the media session',
  }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'party-noun');
});

test('PATCH with a live verb in the summary raises to x via live-verb, summary path', () => {
  const r = classify(row({
    method: 'PATCH',
    operationId: 'doThing',
    summary: 'Cancel the pending request',
  }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'live-verb');
  assert.equal(r.evidence[0], 'summary:cancel');
});

// --- PUT/DELETE/PATCH raise on a party noun ---------------------------------

test('DELETE with a PARTY_NOUNS summary head noun raises to x via party-noun', () => {
  const r = classify(row({
    method: 'DELETE',
    operationId: 'doThing',
    summary: 'Remove a team member',
  }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'party-noun');
  assert.equal(r.evidence[0], 'summary:member');
});

test('DELETE delete_channel with empty summary and a SHARED_NOUNS opid-token raises to x via party-noun', () => {
  const r = classify(row({
    method: 'DELETE',
    operationId: 'delete_channel',
    summary: '',
    description: 'Deletes a guild channel.',
  }));
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'party-noun');
  assert.equal(r.evidence[0], 'opid-token:channel');
});

// --- caller-phrase suppression ----------------------------------------------

test('DELETE for-the-authenticated-user caller phrase suppresses the party-noun raise, falls to w floor', () => {
  const r = classify(row({
    method: 'DELETE',
    path: '/user/emails',
    operationId: 'users/delete-email-for-authenticated-user',
    summary: 'Delete an email address for the authenticated user',
  }));
  assert.equal(r.class, 'w');
  assert.equal(r.rule, 'floor');
  assert.equal(r.evidence.includes('caller-phrase'), true);
});

test('DELETE caller-phrase suppresses a live-verb raise too', () => {
  const r = classify(row({
    method: 'DELETE',
    operationId: 'doThing',
    summary: 'Cancel your account for the authenticated user',
  }));
  assert.equal(r.class, 'w');
  assert.equal(r.rule, 'floor');
  assert.equal(r.evidence.includes('caller-phrase'), true);
});

// --- noTextRaise switch, off vs on ------------------------------------------

test('noTextRaise OFF (default): DELETE with no summary/description floors to w, not x', () => {
  const r = classify(row({ method: 'DELETE', operationId: '', summary: '', description: '' }));
  assert.equal(r.class, 'w');
  assert.equal(r.rule, 'floor');
});

test('noTextRaise ON: DELETE with no summary/description raises to x via no-text', () => {
  const r = classify(row({ method: 'DELETE', operationId: '', summary: '', description: '' }), { noTextRaise: true });
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'no-text');
  assert.equal(r.floor, true);
  assert.deepEqual(r.evidence, ['no-text']);
});

test('noTextRaise ON but a raise rule already fired: live-verb wins, no-text never checked', () => {
  const r = classify(row({ method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall', summary: '', description: '' }), { noTextRaise: true });
  assert.equal(r.class, 'x');
  assert.equal(r.rule, 'live-verb');
});

test('noTextRaise requires strict === true: a truthy but non-boolean value does not turn it on', () => {
  const r = classify(row({ method: 'DELETE', operationId: '', summary: '', description: '' }), { noTextRaise: 1 });
  assert.equal(r.class, 'w');
  assert.equal(r.rule, 'floor');
});

// --- negative controls -------------------------------------------------------

test('negative control: ClickToDial DELETE /calls/{callId} terminateCall is x', () => {
  const r = classify(row({ method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall', summary: 'Terminate an ongoing call' }));
  assert.equal(r.class, 'x');
});

test('negative control: WebRTC PUT /sessions/{mediaSessionId}/status updateSessionStatus is x', () => {
  const r = classify(row({
    method: 'PUT',
    path: '/sessions/{mediaSessionId}/status',
    operationId: 'updateSessionStatus',
    summary: 'Update the status of the media session',
  }));
  assert.equal(r.class, 'x');
});
