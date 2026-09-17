import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from './rules-lex.mjs';
import { refine } from './rules-pass2.mjs';

const lexicon = loadLexicon();

function op(overrides) {
  return {
    method: 'DELETE',
    path: '/x',
    operationId: 'x',
    summary: '',
    description: '',
    ...overrides,
  };
}

test('(i) L5-floor row untouched by pass 2', () => {
  const result = { class: 'w', confidence: 'method-only', rule_id: 'L5-floor', evidence: 'verb=delete' };
  const r = refine(op({ method: 'DELETE', summary: 'Delete a draft invoice' }), result, lexicon);
  assert.deepEqual(r, result);
});

test('(ii) DELETE "Delete a Call record from your account" L3 nouns=call -> un-raised to w by P2-own', () => {
  const theOp = op({
    method: 'DELETE',
    path: '/calls/{callId}',
    operationId: 'deleteCall',
    summary: 'Delete a Call record from your account',
    description: 'Delete a Call record from your account.',
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L3-live-noun', evidence: 'nouns=call verb=delete' };
  const r = refine(theOp, result, lexicon);
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'L3-live-noun>P2-own');
  assert.match(r.evidence, /^own=/);
});

test('(iii) DELETE "Kick a participant from a given conference" L2 verbs=kick -> unchanged x (OTHER matches)', () => {
  const theOp = op({
    method: 'DELETE',
    path: '/conferences/{id}/participants/{pid}',
    operationId: 'deleteParticipant',
    summary: 'Kick a participant from a given conference',
    description: 'Kick a participant from a given conference.',
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L2-danger-verb', evidence: 'verbs=kick' };
  const r = refine(theOp, result, lexicon);
  assert.deepEqual(r, result);
});

test('(iv) DELETE "Terminate an active call" L2 -> unchanged x (Click to Dial call session)', () => {
  const theOp = op({
    method: 'DELETE',
    path: '/calls/{callId}',
    operationId: 'terminateCall',
    summary: 'Terminate an active call',
    description: 'Terminates an active Click to Dial call session.',
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L2-danger-verb', evidence: 'verbs=terminat' };
  const r = refine(theOp, result, lexicon);
  assert.deepEqual(r, result);
});

test('(v) DELETE "Delete a person" description "... an executive of the account" L2 verbs=execut -> un-raised by P2-collision', () => {
  const theOp = op({
    method: 'DELETE',
    path: '/people/{id}',
    operationId: 'deletePerson',
    summary: 'Delete a person',
    description: 'Removes an executive of the account from the organization.',
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L2-danger-verb', evidence: 'verbs=execut' };
  const r = refine(theOp, result, lexicon);
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'L2-danger-verb>P2-collision');
  assert.equal(r.evidence, 'collision=execut');
});

test('(vi) DELETE "Delete an apple pay domain" L2 verbs=pay -> P2-collision', () => {
  const theOp = op({
    method: 'DELETE',
    path: '/domains/{id}',
    operationId: 'deleteApplePayDomain',
    summary: 'Delete an apple pay domain',
    description: 'Delete an apple pay domain.',
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L2-danger-verb', evidence: 'verbs=pay' };
  const r = refine(theOp, result, lexicon);
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'L2-danger-verb>P2-collision');
  assert.equal(r.evidence, 'collision=pay');
});

test('(vii) PUT "Set GitHub Actions permissions for an organization" L3 nouns=access -> P2-place, class stays x, confidence low', () => {
  const theOp = op({
    method: 'PUT',
    path: '/orgs/{org}/actions/permissions',
    operationId: 'setGithubActionsPermissionsOrganization',
    summary: 'Set GitHub Actions permissions for an organization',
    description:
      'Sets the GitHub Actions permissions policy for enabling GitHub Actions and allowed actions and reusable workflows for an organization. ' +
      'OAuth app tokens and personal access tokens (classic) need the admin:org scope to use this endpoint.',
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L3-live-noun', evidence: 'nouns=access verb=set' };
  const r = refine(theOp, result, lexicon);
  assert.equal(r.class, 'x');
  assert.equal(r.confidence, 'low');
  assert.equal(r.rule_id, 'L3-live-noun>P2-place');
  assert.equal(r.evidence, 'place=later-sentence');
});

test('(viii) DELETE "Delete device record" L3 nouns=access,network -> unchanged x (OTHER matches "device")', () => {
  const theOp = op({
    method: 'DELETE',
    path: '/devices/{id}',
    operationId: 'deleteDeviceRecord',
    summary: 'Delete device record',
    description:
      'Any active access control rules and network access for this device are removed immediately and cannot be recovered.',
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L3-live-noun', evidence: 'nouns=access,network verb=delete' };
  const r = refine(theOp, result, lexicon);
  assert.deepEqual(r, result);
});

test('(ix) DELETE "Cancel a subscription" description "Cancels a customer\'s subscription immediately" L2 verbs=cancel -> unchanged x', () => {
  const theOp = op({
    method: 'DELETE',
    path: '/subscriptions/{id}',
    operationId: 'cancelSubscription',
    summary: 'Cancel a subscription',
    description: "Cancels a customer's subscription immediately.",
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L2-danger-verb', evidence: 'verbs=cancel' };
  const r = refine(theOp, result, lexicon);
  assert.deepEqual(r, result);
});

test('(x) POST "Stop a Stream using either the SID of the Stream resource or the name used when creating the resource" L2 verbs=stop -> unchanged x (Twilio regression: "resource" is not an artefact word)', () => {
  const theOp = op({
    method: 'POST',
    path: '/Streams/{Sid}',
    operationId: 'stopStream',
    summary: 'Stop a Stream',
    description: 'Stop a Stream using either the SID of the Stream resource or the name used when creating the resource.',
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L2-danger-verb', evidence: 'verbs=stop' };
  const r = refine(theOp, result, lexicon);
  assert.deepEqual(r, result);
});

test('(xi) DELETE "Delete a Call record from your account" L3 nouns=call -> still un-raised to w by P2-own via "record"', () => {
  const theOp = op({
    method: 'DELETE',
    path: '/calls/{callId}',
    operationId: 'deleteCall',
    summary: 'Delete a Call record from your account',
    description: 'Delete a Call record from your account.',
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L3-live-noun', evidence: 'nouns=call verb=delete' };
  const r = refine(theOp, result, lexicon);
  assert.equal(r.class, 'w');
  assert.equal(r.rule_id, 'L3-live-noun>P2-own');
  assert.match(r.evidence, /^own=/);
});

test('(xii) POST "Create an Application Profile" L3 nouns=network -> unchanged x ("profile" is no longer an artefact word)', () => {
  const theOp = op({
    method: 'POST',
    path: '/applications/{id}/profile',
    operationId: 'createApplicationProfile',
    summary: 'Create an Application Profile',
    description: 'Creates a network profile for the application.',
  });
  const result = { class: 'x', confidence: 'high', rule_id: 'L3-live-noun', evidence: 'nouns=network verb=create' };
  const r = refine(theOp, result, lexicon);
  assert.deepEqual(r, result);
});
