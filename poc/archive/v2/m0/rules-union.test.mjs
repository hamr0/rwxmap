import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { arbiterUnion } from './rules-union.mjs';
import { loadLexicon, arbiterLex } from './rules-lex.mjs';
import { loadTables, arbiterVerb } from './rules-verb.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEXICON_V2_PATH = path.join(HERE, 'lexicon-v2.json');

const lexicon = loadLexicon(LEXICON_V2_PATH);
const tables = loadTables();
const model = { verbMap: {} }; // arbiterUnion always calls arbiterLex with readVerbs:'hand', so verbMap is never consulted.
const ctx = { model, lexicon, tables };

function op(overrides) {
  return {
    method: 'GET',
    path: '/x',
    operationId: 'x',
    summary: '',
    description: '',
    infoDescription: '',
    opBlockText: '',
    fileText: '',
    hasCallbacks: false,
    has409: false,
    hasSink: false,
    ...overrides,
  };
}

test('GET stays r with confidence high whatever the text', () => {
  const o = op({ method: 'GET', summary: 'Terminate the call for a user', operationId: 'terminateCall', path: '/calls/{id}/terminate' });
  const r = arbiterUnion(o, ctx);
  assert.equal(r.class, 'r');
  assert.equal(r.confidence, 'high');
  assert.equal(r.agree, true);
});

test('a row both arbiters call x is x, confidence high, raisedBy both', () => {
  const o = op({
    method: 'DELETE',
    summary: 'Terminate the call',
    operationId: 'terminateCall',
    path: '/calls/{callId}',
  });
  const r = arbiterUnion(o, ctx);
  assert.equal(r.class, 'x');
  assert.equal(r.confidence, 'high');
  assert.equal(r.agree, true);
  assert.equal(r.raisedBy, 'both');
});

test('a row only the word list calls x is x, low, raisedBy wordlist (DELETE Revocation of Sponsorship)', () => {
  const o = op({
    method: 'DELETE',
    summary: 'Revocation of Sponsorship',
    operationId: 'revokeSponsorship',
    path: '/sponsorships/{sponsorshipId}',
  });
  const r = arbiterUnion(o, ctx);
  assert.equal(r.class, 'x');
  assert.equal(r.confidence, 'low');
  assert.equal(r.agree, false);
  assert.equal(r.raisedBy, 'wordlist');
});

test('a row only the verb-led model calls x is x, low, raisedBy verb (DELETE Remove a user)', () => {
  const o = op({
    method: 'DELETE',
    summary: 'Remove a user',
    operationId: 'removeUser',
    path: '/users/{userId}',
  });
  const r = arbiterUnion(o, ctx);
  assert.equal(r.class, 'x');
  assert.equal(r.confidence, 'low');
  assert.equal(r.agree, false);
  assert.equal(r.raisedBy, 'verb');
});

test('a plain DELETE "Delete a coupon" neither raises: w, raisedBy neither', () => {
  const o = op({
    method: 'DELETE',
    summary: 'Delete a coupon',
    operationId: 'deleteCoupon',
    path: '/coupons/{couponId}',
  });
  const r = arbiterUnion(o, ctx);
  assert.equal(r.class, 'w');
  assert.equal(r.raisedBy, 'neither');
});

test('the combined class never goes below w for PUT/DELETE', () => {
  // PUT floor is w; neither arbiter can loosen a PUT below w, so the
  // union can't either.
  const o = op({
    method: 'PUT',
    summary: 'Get the current status',
    operationId: 'getStatus',
    path: '/status',
  });
  const r = arbiterUnion(o, ctx);
  assert.equal(r.class, 'w');
});

test('DELETE never comes out below w even with a read-verb lead word', () => {
  const o = op({
    method: 'DELETE',
    summary: 'Check the device status',
    operationId: 'checkDeviceStatus',
    path: '/devices/{deviceId}/status',
  });
  const r = arbiterUnion(o, ctx);
  assert.equal(r.class, 'w');
});

// Regression for the defect found on review: a first version clamped the
// union's class up to methodDefault(method), which is 'x' for POST/PATCH —
// forcing every POST back to x regardless of what either arbiter found, and
// silently destroying every correct lowering both arbiters agreed on.
// methodDefault's x for POST/PATCH is a policy default (PRD §4.5 / D17),
// not an RFC 9110 floor like PUT/DELETE's w — a POST both arbiters lower to
// r must come out r from the union.
test('a POST both arbiters lower to r comes out r from the union (not clamped up to x)', () => {
  const o = op({
    method: 'POST',
    summary: 'Retrieve the current status',
    operationId: 'retrieveStatus',
    path: '/retrieve-status',
    has409: false,
  });
  const resultA = arbiterLex(o, model, lexicon, 'op', { readVerbs: 'hand' });
  const resultB = arbiterVerb(o, tables);
  assert.equal(resultA.class, 'r', 'test setup: expected arbiterLex to lower this POST to r');
  assert.equal(resultB.class, 'r', 'test setup: expected arbiterVerb to lower this POST to r');
  const r = arbiterUnion(o, ctx);
  assert.equal(r.class, 'r');
  assert.equal(r.agree, true);
});

test('pass2:true keeps class and only drops confidence on weak evidence (P2-collision)', () => {
  // "apple pay" is a COLLISIONS entry for the "pay" stem in rules-pass2.mjs:
  // resultA's L2-danger-verb hit is entirely inside that non-danger
  // compound, so refine(op, resultA, lexicon) would un-raise it back to
  // the floor. The union's own class must NOT change — only confidence.
  const o = op({
    method: 'DELETE',
    summary: 'Remove a saved Apple Pay card for a user',
    operationId: 'removeApplePayCard',
    path: '/users/{userId}/cards/{cardId}',
  });
  const withoutPass2 = arbiterUnion(o, ctx, { pass2: false });
  const withPass2 = arbiterUnion(o, ctx, { pass2: true });
  assert.equal(withPass2.class, withoutPass2.class);
  assert.equal(withPass2.confidence, 'low');
  assert.match(withPass2.rule_id, />P2-weak$/);
});

test('pass2:true leaves a strong-evidence row unchanged', () => {
  // "Terminate the call" is a direct, first-sentence hit with no collision
  // and no OWN/ARTEFACT-without-OTHER pattern: refine() returns resultA
  // unchanged, so pass2 must not touch the combined result at all.
  const o = op({
    method: 'DELETE',
    summary: 'Terminate the call',
    operationId: 'terminateCall',
    path: '/calls/{callId}',
  });
  const withoutPass2 = arbiterUnion(o, ctx, { pass2: false });
  const withPass2 = arbiterUnion(o, ctx, { pass2: true });
  assert.deepEqual(withPass2, withoutPass2);
});
