import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchOperation } from './match.js';

const SERVERS = ['https://api.example.com/v1'];

test('matches method + literal path exactly', () => {
  const ops = [
    { method: 'GET', path: '/customers' },
    { method: 'GET', path: '/customers/{id}' },
  ];
  const result = matchOperation(ops, SERVERS, 'GET', 'https://api.example.com/v1/customers');
  assert.ok(result);
  assert.equal(result.op.path, '/customers');
  assert.equal(result.serverBase, 'https://api.example.com/v1');
  assert.equal(result.hostMatched, true);
  assert.equal(result.tie, false);
});

test('{param} matches exactly one non-empty segment', () => {
  const ops = [
    { method: 'GET', path: '/customers/{id}' },
  ];
  const result = matchOperation(ops, SERVERS, 'GET', 'https://api.example.com/v1/customers/cus_123');
  assert.ok(result);
  assert.equal(result.op.path, '/customers/{id}');
});

test('{param} does not match a missing (empty) segment', () => {
  const ops = [
    { method: 'GET', path: '/customers/{id}' },
  ];
  // trailing slash with nothing after it collapses to zero segments after
  // "customers", so it must not match a template expecting one more segment
  const result = matchOperation(ops, SERVERS, 'GET', 'https://api.example.com/v1/customers/');
  assert.equal(result, null);
});

test('{param} does not match across a segment boundary (extra segment fails)', () => {
  const ops = [
    { method: 'GET', path: '/customers/{id}' },
  ];
  const result = matchOperation(ops, SERVERS, 'GET', 'https://api.example.com/v1/customers/123/extra');
  assert.equal(result, null);
});

test('method must match', () => {
  const ops = [
    { method: 'GET', path: '/customers/{id}' },
  ];
  const result = matchOperation(ops, SERVERS, 'DELETE', 'https://api.example.com/v1/customers/123');
  assert.equal(result, null);
});

test('literal segments must match exactly, case-sensitive', () => {
  const ops = [
    { method: 'GET', path: '/Customers/{id}' },
  ];
  const result = matchOperation(ops, SERVERS, 'GET', 'https://api.example.com/v1/customers/123');
  assert.equal(result, null);
});

test('most-literal-segments wins over a template alternative', () => {
  const ops = [
    { method: 'GET', path: '/customers/{id}' },      // 1 literal segment ("customers")
    { method: 'GET', path: '/customers/pending' },    // 2 literal segments
  ];
  // /customers/{id} has 1 literal ("customers"), /customers/pending has 2
  // ("customers","pending") — for the literal URL .../customers/pending
  // both templates match structurally; the more-literal one wins.
  const result = matchOperation(ops, SERVERS, 'GET', 'https://api.example.com/v1/customers/pending');
  assert.ok(result);
  assert.equal(result.op.path, '/customers/pending');
  assert.equal(result.tie, false);
});

test('a tie is reported: same literal-segment count, earliest doc order wins', () => {
  const ops = [
    { method: 'GET', path: '/customers/{id}' },
    { method: 'GET', path: '/customers/{slug}' },
  ];
  const result = matchOperation(ops, SERVERS, 'GET', 'https://api.example.com/v1/customers/abc');
  assert.ok(result);
  assert.equal(result.op.path, '/customers/{id}'); // earliest in document order
  assert.equal(result.tie, true);
  assert.equal(result.tieCount, 2);
});

test('tied on literal count, different classes: the TIGHTER class wins even when it is later in document order', () => {
  const ops = [
    { method: 'POST', path: '/orders/{id}/{action}', operationId: 'updateOrder' }, // w (KEEP_W 'update'), earlier
    { method: 'POST', path: '/orders/{oid}/{verb}', operationId: 'cancelOrder' }, // x (CANT_UNDO 'cancel'), later
  ];
  const result = matchOperation(ops, SERVERS, 'POST', 'https://api.example.com/v1/orders/123/whatever');
  assert.ok(result);
  assert.equal(result.op.operationId, 'cancelOrder');
  assert.equal(result.tie, true);
  assert.equal(result.tieCount, 2);
});

test('tied on literal count, same class: earliest in document order still wins', () => {
  const ops = [
    { method: 'GET', path: '/customers/{id}' },
    { method: 'GET', path: '/customers/{slug}' },
  ];
  const result = matchOperation(ops, SERVERS, 'GET', 'https://api.example.com/v1/customers/abc');
  assert.ok(result);
  assert.equal(result.op.path, '/customers/{id}'); // earliest in document order (both are class r)
  assert.equal(result.tie, true);
  assert.equal(result.tieCount, 2);
});

test('a more-literal op still beats a tighter-class less-literal op: literal count comes first', () => {
  const ops = [
    { method: 'POST', path: '/orders/{id}/update', operationId: 'updateOrder' }, // 2 literal segments, class w
    { method: 'POST', path: '/orders/{id}/{action}', operationId: 'cancelOrder' }, // 1 literal segment, class x
  ];
  const result = matchOperation(ops, SERVERS, 'POST', 'https://api.example.com/v1/orders/123/update');
  assert.ok(result);
  assert.equal(result.op.operationId, 'updateOrder');
  assert.equal(result.tie, false);
});

test('server base path is stripped before matching', () => {
  const ops = [{ method: 'GET', path: '/customers/{id}' }];
  const result = matchOperation(ops, ['https://api.example.com/v1'], 'GET', 'https://api.example.com/v1/customers/123');
  assert.ok(result);
  assert.equal(result.serverBase, 'https://api.example.com/v1');
});

test('no match when the URL path does not carry any server base as a prefix', () => {
  const ops = [{ method: 'GET', path: '/customers/{id}' }];
  const result = matchOperation(ops, ['https://api.example.com/v1'], 'GET', 'https://api.example.com/customers/123');
  assert.equal(result, null);
});

test('root server base ("/") strips nothing', () => {
  const ops = [{ method: 'GET', path: '/customers/{id}' }];
  const result = matchOperation(ops, ['https://api.example.com'], 'GET', 'https://api.example.com/customers/123');
  assert.ok(result);
  assert.equal(result.op.path, '/customers/{id}');
});

test('hostMatched is true when the URL host equals the server host', () => {
  const ops = [{ method: 'GET', path: '/customers/{id}' }];
  const result = matchOperation(ops, ['https://api.example.com/v1'], 'GET', 'https://api.example.com/v1/customers/123');
  assert.ok(result);
  assert.equal(result.hostMatched, true);
});

test('hostMatched is false, but the match still happens, for a per-customer host', () => {
  const ops = [{ method: 'GET', path: '/customers/{id}' }];
  const result = matchOperation(ops, ['https://{tenant}.okta.com'.replace('{tenant}', 'acme')], 'GET', 'https://acme-admin.okta.com/customers/123');
  assert.ok(result);
  assert.equal(result.hostMatched, false);
});

test('duplicate server entries do not inflate the tie count', () => {
  const ops = [{ method: 'GET', path: '/customers/{id}' }];
  const servers = ['https://graph.example.com', 'https://graph.example.com', 'https://graph.example.com'];
  const result = matchOperation(ops, servers, 'GET', 'https://graph.example.com/customers/123');
  assert.ok(result);
  assert.equal(result.tie, false);
  assert.equal(result.tieCount, 1);
});

test('once an operation index matches under an earlier server, a later overlapping server does not re-claim it', () => {
  const ops = [{ method: 'GET', path: '/customers/{id}' }];
  // Two different server strings, both a prefix of the same target URL.
  const servers = ['https://api.example.com', 'https://api.example.com/'];
  const result = matchOperation(ops, servers, 'GET', 'https://api.example.com/customers/123');
  assert.ok(result);
  assert.equal(result.tie, false);
  assert.equal(result.tieCount, 1);
});

test('an unparseable server URL is skipped, not fatal', () => {
  const ops = [{ method: 'GET', path: '/customers/{id}' }];
  const servers = ['not a url', 'https://api.example.com/v1'];
  const result = matchOperation(ops, servers, 'GET', 'https://api.example.com/v1/customers/123');
  assert.ok(result);
  assert.equal(result.serverBase, 'https://api.example.com/v1');
});

test('returns null when no operation matches at all', () => {
  const ops = [{ method: 'GET', path: '/orders/{id}' }];
  const result = matchOperation(ops, SERVERS, 'GET', 'https://api.example.com/v1/customers/123');
  assert.equal(result, null);
});

test('throws on a non-http(s) URL', () => {
  const ops = [{ method: 'GET', path: '/x' }];
  assert.throws(() => matchOperation(ops, SERVERS, 'GET', 'ftp://api.example.com/v1/x'), /not an http\(s\) URL/);
});

test('throws on an unparseable URL', () => {
  const ops = [{ method: 'GET', path: '/x' }];
  assert.throws(() => matchOperation(ops, SERVERS, 'GET', 'not a url'), /unparseable URL/);
});
