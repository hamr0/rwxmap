import { test } from 'node:test';
import assert from 'node:assert/strict';
import { r1Match, r2Match, tally, ledger, outcome, isBanned } from './score.mjs';

const R = (method, path, operationId = '') => ({ method, path, operationId });
const noClaim = { class: 'w', rule: 'method-floor' };

test('R1 fires on literal credential last segment, PUT/PATCH', () => {
  assert.equal(r1Match(R('PUT', '/users/{id}/token'), noClaim), 'token');
  assert.equal(r1Match(R('PATCH', '/api-key'), noClaim), 'apikey');
  assert.equal(r1Match(R('PUT', '/orgs/{o}/client_credentials'), noClaim), 'clientcredentials');
  assert.equal(r1Match(R('PUT', '/x/Secret'), noClaim), 'secret');
});
test('R1 does not fire on params, plurals, other methods, nested, claimed rows', () => {
  assert.equal(r1Match(R('PUT', '/tokens/{id}'), noClaim), null);
  assert.equal(r1Match(R('PUT', '/tokens'), noClaim), null);
  assert.equal(r1Match(R('PUT', '/token/{token}'), noClaim), null);
  assert.equal(r1Match(R('PUT', '/users/{token}'), noClaim), null);
  assert.equal(r1Match(R('POST', '/token'), noClaim), null);
  assert.equal(r1Match(R('GET', '/token'), noClaim), null);
  assert.equal(r1Match(R('PUT', '/token/refresh'), noClaim), null);
  assert.equal(r1Match(R('PUT', '/token'), { class: 'x', rule: 'cant-undo-verb' }), null);
  assert.equal(r1Match(R('PUT', '/token'), { class: 'x', rule: 'credential-set' }), null);
});
test('R2 fires on path segment, any method', () => {
  assert.ok(r2Match(R('GET', '/logout')));
  assert.ok(r2Match(R('GET', '/oauth2/v1/logout')).b);
  assert.ok(r2Match(R('POST', '/auth/sign-out')).b);
  assert.ok(r2Match(R('POST', '/end_session')).b);
  assert.equal(r2Match(R('POST', '/a/{logout}')), null);
  assert.equal(r2Match(R('GET', '/logouts')), null);
  assert.equal(r2Match(R('GET', '/logout/url')).b, 'logout');
});
test('R2 operationId lead tokens', () => {
  assert.ok(r2Match(R('POST', '/a', 'signOut')).a);
  assert.ok(r2Match(R('POST', '/a', 'logOut')).a);
  assert.ok(r2Match(R('POST', '/a', 'end_session')).a);
  assert.ok(r2Match(R('POST', '/a', 'post_logout')).a);
  assert.ok(r2Match(R('GET', '/a', 'Logout')).a);
});
test('R2 operationId not at lead position does not fire via (a)', () => {
  assert.equal(r2Match(R('GET', '/a', 'getLogoutUrl')), null);
  assert.equal(r2Match(R('GET', '/a', 'userLogout')), null);
  assert.equal(r2Match(R('POST', '/a', 'logging')), null);
});
test('tally and ledger', () => {
  const t = tally([{ mech: 'x', truth: 'x' }, { mech: 'w', truth: 'x' }, { mech: 'w', truth: 'w' }, { mech: 'r', truth: 'r' }]);
  assert.deepEqual([t.fires, t.alreadyX, t.moved, t.right, t.wrongW, t.wrongR], [4, 1, 3, 1, 1, 1]);
  assert.deepEqual(ledger([['r', 'x'], ['x', 'w'], ['w', 'w']]), { n: 3, exact: 1, leak: 1, over: 1 });
  assert.equal(outcome('r', 'w'), 'leak');
  assert.throws(() => outcome('q', 'w'));
});
test('banned vendors by whole domain label', () => {
  assert.ok(isBanned('clerk.dev'));
  assert.ok(!isBanned('boxclerk.com'));
  assert.ok(!isBanned('workos.com'));
});
