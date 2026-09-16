import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nounsForRow } from './allowlist.mjs';

function row(overrides) {
  return { method: 'GET', operationId: '', summary: '', description: '', path: '', vendor: 'test', gt_class: 'r', ...overrides };
}

test('nounsForRow: includes both head nouns and buried tokens', () => {
  const r = row({ method: 'PUT', operationId: 'updateAccountBillingAddress', summary: 'Update the billing address' });
  const nouns = nounsForRow(r, new Set());
  // buried token 'account' must survive alongside the head noun 'address'
  assert.ok(nouns.has('account'));
  assert.ok(nouns.has('address'));
});

test('nounsForRow: excludes junkSet members and does not mutate junkSet', () => {
  const r = row({ method: 'PUT', operationId: 'updateAccountBillingAddress', summary: 'Update the billing address' });
  const junk = new Set(['account']);
  const before = new Set(junk);
  const nouns = nounsForRow(r, junk);
  assert.ok(!nouns.has('account'));
  assert.deepEqual(junk, before);
});

test('nounsForRow: excludes verb tokens (LIVE_VERBS and NON_NOUN_READ_VERBS)', () => {
  const r = row({ method: 'PUT', operationId: 'cancelSubscription', summary: 'Cancel the subscription' });
  const nouns = nounsForRow(r, new Set());
  assert.ok(!nouns.has('cancel'));
  assert.ok(nouns.has('subscription'));
});

test('nounsForRow: splits an operationId on "/" (the old splitter left it one token)', () => {
  const r = row({ method: 'PUT', operationId: 'gists/unstar', summary: 'Unstar a gist' });
  const nouns = nounsForRow(r, new Set());
  // naiveSingular only strips a trailing "s"/"es" — "gists" -> "gist".
  assert.ok(nouns.has('gist'));
  for (const n of nouns) assert.ok(!n.includes('/'));
});

test('nounsForRow: splits an operationId on whitespace', () => {
  const r = row({ method: 'PUT', operationId: 'delete team member', summary: 'Delete a team member' });
  const nouns = nounsForRow(r, new Set());
  for (const n of nouns) assert.ok(!/\s/.test(n));
  assert.ok(nouns.has('member'));
});

test('nounsForRow: drops version tags like v1 from a path-derived operationId', () => {
  const r = row({ method: 'PUT', operationId: 'delete_application_api_v1_app__app_id_', summary: 'Delete Application' });
  const nouns = nounsForRow(r, new Set());
  assert.ok(!nouns.has('v1'));
});

test('nounsForRow: drops path placeholder tokens like {id}', () => {
  const r = row({ method: 'DELETE', operationId: 'delete {id}', summary: 'Delete a person' });
  const nouns = nounsForRow(r, new Set());
  assert.ok(!nouns.has('{id}'));
});

test('nounsForRow: drops filler words like "from"', () => {
  const r = row({ method: 'DELETE', operationId: 'delete from', summary: 'Deletes a single image from a product' });
  const nouns = nounsForRow(r, new Set());
  assert.ok(!nouns.has('from'));
});
