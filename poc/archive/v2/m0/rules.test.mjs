import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METHOD_DEFAULT,
  RANK,
  tighter,
  extractVerbs,
  lookupVerb,
  arbiter,
  EXPERIMENTS,
  SEED,
  SEED_V2,
} from './rules.mjs';

test('METHOD_DEFAULT for each method', () => {
  assert.equal(METHOD_DEFAULT.GET, 'r');
  assert.equal(METHOD_DEFAULT.HEAD, 'r');
  assert.equal(METHOD_DEFAULT.OPTIONS, 'r');
  assert.equal(METHOD_DEFAULT.TRACE, 'r');
  assert.equal(METHOD_DEFAULT.PUT, 'w');
  assert.equal(METHOD_DEFAULT.DELETE, 'w');
  assert.equal(METHOD_DEFAULT.POST, 'x');
  assert.equal(METHOD_DEFAULT.PATCH, 'x');
});

test('extractVerbs: retrieveLocation + /retrieve -> opVerb retrieve', () => {
  const { opVerb } = extractVerbs('/retrieve', 'retrieveLocation');
  assert.equal(opVerb, 'retrieve');
});

test('extractVerbs: KYC_Fill-in -> opVerb kyc', () => {
  const { opVerb } = extractVerbs('/kyc', 'KYC_Fill-in');
  assert.equal(opVerb, 'kyc');
});

test('extractVerbs: /sessions/{mediaSessionId}/status path tokens', () => {
  const { pathTokens } = extractVerbs('/sessions/{mediaSessionId}/status', 'updateSessionStatus');
  assert.deepEqual(pathTokens, ['sessions', 'status']);
});

test('lookupVerb: opVerb wins over path tokens', () => {
  const tokens = { opVerb: 'retrieve', pathTokens: ['create', 'thing'] };
  const found = lookupVerb(tokens, SEED);
  assert.deepEqual(found, { verb: 'retrieve', class: 'r' });
});

test('lookupVerb: falls back to path tokens in order when opVerb unknown', () => {
  const tokens = { opVerb: 'nope', pathTokens: ['unknown', 'create'] };
  const found = lookupVerb(tokens, SEED);
  assert.deepEqual(found, { verb: 'create', class: 'w' });
});

test('lookupVerb: returns null when nothing matches', () => {
  const tokens = { opVerb: 'nope', pathTokens: ['zzz'] };
  assert.equal(lookupVerb(tokens, SEED), null);
});

test('arbiter: POST + retrieve -> x, A3-keep-method, low (E2, tighten-only)', () => {
  const op = { method: 'POST', path: '/retrieve-location', operationId: 'retrieveLocation' };
  const result = EXPERIMENTS.E2.fn(op, EXPERIMENTS.E2.ruleset);
  assert.equal(result.class, 'x');
  assert.equal(result.rule_id, 'A3-keep-method');
  assert.equal(result.confidence, 'low');
});

test('arbiterLoosening: POST + retrieve -> r, A4-loosen, low (E3)', () => {
  const op = { method: 'POST', path: '/retrieve-location', operationId: 'retrieveLocation' };
  const result = EXPERIMENTS.E3.fn(op, EXPERIMENTS.E3.ruleset);
  assert.equal(result.class, 'r');
  assert.equal(result.rule_id, 'A4-loosen');
  assert.equal(result.confidence, 'low');
});

test('arbiter: DELETE + terminateCall -> x, A2-tighten under E2', () => {
  const op = { method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall' };
  const result = EXPERIMENTS.E2.fn(op, EXPERIMENTS.E2.ruleset);
  assert.equal(result.class, 'x');
  assert.equal(result.rule_id, 'A2-tighten');
});

test('arbiterLoosening: DELETE + terminateCall -> x, A2-tighten under E3', () => {
  const op = { method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall' };
  const result = EXPERIMENTS.E3.fn(op, EXPERIMENTS.E3.ruleset);
  assert.equal(result.class, 'x');
  assert.equal(result.rule_id, 'A2-tighten');
});

test('arbiter: GET + getX -> r, high confidence', () => {
  const op = { method: 'GET', path: '/x', operationId: 'getX' };
  const result = arbiter(op, { useVerb: true, table: SEED });
  assert.equal(result.class, 'r');
  assert.equal(result.confidence, 'high');
  assert.equal(result.rule_id, 'A1-agree');
});

test('arbiter: PUT + unknown verb -> w, method-only', () => {
  const op = { method: 'PUT', path: '/zzz-qqq', operationId: 'zzzQqq' };
  const result = arbiter(op, { useVerb: true, table: SEED });
  assert.equal(result.class, 'w');
  assert.equal(result.confidence, 'method-only');
  assert.equal(result.rule_id, 'M1');
});

test('SEED_V2: create -> x, update -> w', () => {
  assert.equal(SEED_V2.create, 'x');
  assert.equal(SEED_V2.update, 'w');
});

test('E4: POST + createSession -> x, A1-agree', () => {
  const op = { method: 'POST', path: '/sessions', operationId: 'createSession' };
  const result = EXPERIMENTS.E4.fn(op, EXPERIMENTS.E4.ruleset);
  assert.equal(result.class, 'x');
  assert.equal(result.rule_id, 'A1-agree');
});

test('E5: POST + retrieveLocation -> r, A4-loosen', () => {
  const op = { method: 'POST', path: '/retrieve-location', operationId: 'retrieveLocation' };
  const result = EXPERIMENTS.E5.fn(op, EXPERIMENTS.E5.ruleset);
  assert.equal(result.class, 'r');
  assert.equal(result.rule_id, 'A4-loosen');
});

test('E5: POST + cancelPayment -> x, A3-keep-method (cancel is w, not r)', () => {
  const op = { method: 'POST', path: '/payments/{paymentId}/cancel', operationId: 'cancelPayment' };
  const result = EXPERIMENTS.E5.fn(op, EXPERIMENTS.E5.ruleset);
  assert.equal(result.class, 'x');
  assert.equal(result.rule_id, 'A3-keep-method');
});

test('E5: DELETE + terminateCall -> x, A2-tighten', () => {
  const op = { method: 'DELETE', path: '/calls/{callId}', operationId: 'terminateCall' };
  const result = EXPERIMENTS.E5.fn(op, EXPERIMENTS.E5.ruleset);
  assert.equal(result.class, 'x');
  assert.equal(result.rule_id, 'A2-tighten');
});

test("tighter('r', 'x') === 'x'", () => {
  assert.equal(tighter('r', 'x'), 'x');
});

test('RANK ordering', () => {
  assert.ok(RANK.r < RANK.w);
  assert.ok(RANK.w < RANK.x);
});
