import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestKey } from './key.js';

test('determinism: ten spellings of the same logical URL give one byte-identical key', () => {
  // 12345 is all-digit, so the id rule replaces it with {id} — this is
  // the expected, correct normalization, not a literal echo of the input.
  const expected = 'api.example.com.GET /v1/orders/{id}';
  const variants = [
    'https://api.example.com/v1/orders/12345',
    'https://API.EXAMPLE.COM/v1/orders/12345',
    'https://api.example.com:443/v1/orders/12345',
    'https://api.example.com/v1/orders/12345/',
    'https://api.example.com/v1/orders/12345?foo=bar',
    'https://api.example.com/v1/orders/12345#frag',
    'https://api.example.com//v1//orders/12345',
    'https://api.example.com/v1/orders/%31%32%33%34%35',
    'https://api.example.com/v1/orders/12345?foo=bar#frag',
    'https://api.example.com/v1/%6Frders/12345', // %6F decodes to the unreserved byte 'o'
  ];
  for (const url of variants) {
    assert.equal(requestKey('get', url), expected, url);
  }
});

test('determinism: percent-encoded reserved bytes normalize case but stay encoded', () => {
  const a = requestKey('GET', 'https://api.example.com/v1/a%2fb');
  const b = requestKey('GET', 'https://api.example.com/v1/a%2Fb');
  assert.equal(a, b);
  assert.equal(a, 'api.example.com.GET /v1/a%2Fb');
});

test('host: default https port dropped, non-default port kept', () => {
  assert.equal(
    requestKey('GET', 'https://api.example.com:443/x'),
    requestKey('GET', 'https://api.example.com/x'),
  );
  assert.equal(
    requestKey('GET', 'https://api.example.com:8443/x'),
    'api.example.com:8443.GET /x',
  );
});

test('host: default http port dropped', () => {
  assert.equal(
    requestKey('GET', 'http://api.example.com:80/x'),
    'api.example.com.GET /x',
  );
});

test('host: IDN host is lowercased and punycoded', () => {
  assert.equal(
    requestKey('GET', 'https://API.Exämple.com/x'),
    requestKey('GET', 'https://api.xn--exmple-cua.com/x'),
  );
});

test('path: empty path becomes root', () => {
  assert.equal(requestKey('GET', 'https://api.example.com'), 'api.example.com.GET /');
  assert.equal(requestKey('GET', 'https://api.example.com/'), 'api.example.com.GET /');
});

test('path: root itself never loses its slash', () => {
  assert.equal(requestKey('GET', 'https://api.example.com/'), 'api.example.com.GET /');
});

test('throws on a non-http(s) URL', () => {
  assert.throws(() => requestKey('GET', 'ftp://example.com/x'), /not an http\(s\) URL/);
});

test('throws on an unparseable URL', () => {
  assert.throws(() => requestKey('GET', 'not a url at all'), /unparseable URL/);
});

// --- id rule: all-digit ---
test('id rule: all-digit segment becomes {id}', () => {
  assert.equal(requestKey('GET', 'https://api.example.com/orders/98765'), 'api.example.com.GET /orders/{id}');
});
test('id rule: all-digit counterexample /v1/2fa stays literal', () => {
  assert.equal(requestKey('GET', 'https://api.example.com/v1/2fa'), 'api.example.com.GET /v1/2fa');
});

// --- id rule: UUID ---
test('id rule: UUID segment becomes {id}, any version, case-insensitive', () => {
  assert.equal(
    requestKey('GET', 'https://api.example.com/users/550e8400-e29b-41d4-a716-446655440000'),
    'api.example.com.GET /users/{id}',
  );
  assert.equal(
    requestKey('GET', 'https://api.example.com/users/550E8400-E29B-41D4-A716-446655440000'),
    'api.example.com.GET /users/{id}',
  );
});
test('id rule: UUID counterexample /api/v2 stays literal', () => {
  assert.equal(requestKey('GET', 'https://api.example.com/api/v2'), 'api.example.com.GET /api/v2');
});

// --- id rule: hex 16+ ---
test('id rule: 16+ char hex segment becomes {id}', () => {
  assert.equal(
    requestKey('GET', 'https://api.example.com/objects/1234567890abcdef1234'),
    'api.example.com.GET /objects/{id}',
  );
});
test('id rule: hex counterexample /files/report2024 stays literal (letters outside a-f, too short)', () => {
  assert.equal(
    requestKey('GET', 'https://api.example.com/files/report2024'),
    'api.example.com.GET /files/report2024',
  );
});
test('id rule: hex counterexample below the 16-char floor stays literal', () => {
  assert.equal(
    requestKey('GET', 'https://api.example.com/objects/1234567890abcd'), // 15 hex chars
    'api.example.com.GET /objects/1234567890abcd',
  );
});

// --- id rule: stripe-style prefixed id (adopted 2026-09-27, default and
// only form — the POC's mixedIds candidate is a separate, unadopted
// option not ported here) ---
test('prefixed-id rule: cus_ and acct_ ids fold by default', () => {
  assert.equal(
    requestKey('GET', 'https://api.stripe.com/v1/customers/cus_NffrFeUfNV2Hib'),
    'api.stripe.com.GET /v1/customers/{id}',
  );
  assert.equal(
    requestKey('GET', 'https://api.stripe.com/v1/accounts/acct_1032D82eZvKYlo2C'),
    'api.stripe.com.GET /v1/accounts/{id}',
  );
});
test('prefixed-id rule counterexample: user_preferences stays literal (rest is a lowercase-only word, no digit)', () => {
  assert.equal(
    requestKey('GET', 'https://api.example.com/settings/user_preferences'),
    'api.example.com.GET /settings/user_preferences',
  );
});
test('prefixed-id rule counterexample: api_v2 stays literal (rest below the 10-char floor)', () => {
  assert.equal(
    requestKey('GET', 'https://api.example.com/api_v2'),
    'api.example.com.GET /api_v2',
  );
});
test('prefixed-id rule counterexample: oauth_token stays literal (rest below the 10-char floor)', () => {
  assert.equal(
    requestKey('GET', 'https://api.example.com/oauth_token'),
    'api.example.com.GET /oauth_token',
  );
});
test('prefixed-id rule counterexample: SK_abcdefghijk1 stays literal (prefix is uppercase)', () => {
  assert.equal(
    requestKey('GET', 'https://api.example.com/keys/SK_abcdefghijk1'),
    'api.example.com.GET /keys/SK_abcdefghijk1',
  );
});

// --- mixedIds candidate is NOT ported: requestKey takes no options ---
test('mixedIds candidate not ported: a 20+ char mixed id stays literal, an options argument is ignored', () => {
  assert.equal(
    requestKey('GET', 'https://api.stripe.com/v1/customers/NffrFeUfNV2HibABCDEF'),
    'api.stripe.com.GET /v1/customers/NffrFeUfNV2HibABCDEF',
  );
  // @ts-expect-error — requestKey takes no options; passed here only to
  // prove it is silently ignored (an extra arg is not a TypeError in JS),
  // never activates any behaviour.
  const ignoredOptionResult = requestKey('GET', 'https://api.stripe.com/v1/customers/NffrFeUfNV2HibABCDEF', { mixedIds: true });
  assert.equal(ignoredOptionResult, 'api.stripe.com.GET /v1/customers/NffrFeUfNV2HibABCDEF');
});
