import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matcherFrom } from './matcher.js';
import { requestKey } from './key.js';
import { classifyRow } from './flow.js';
import { operationsFrom, exportSidecar } from './exporter.js';

const SPEC = {
  openapi: '3.0.0',
  paths: {
    '/orders': {
      get: { operationId: 'listOrders' },
      post: { operationId: 'createOrder' },
    },
    '/orders/{id}': {
      get: { operationId: 'getOrder' },
      delete: { operationId: 'deleteOrder' },
    },
  },
};

function sidecarFor(vendor, servers, spec = SPEC) {
  return exportSidecar(operationsFrom(spec), { vendor, servers });
}

const row = (key, method, path, letter, marker = 'settled') => ({ key, method, path, letter, marker });

test('spec hit: gate key, gate letter and marker, source spec', () => {
  const m = matcherFrom([sidecarFor('api.example.com', ['https://api.example.com'])]);
  const got = m.match('DELETE', 'https://api.example.com/orders/123');
  assert.equal(got.key, 'api.example.com.deleteOrder');
  assert.equal(got.letter, 'x');
  assert.equal(got.source, 'spec');
  assert.equal(got.tie, false);
});

test('base-path server: https://h/v1 + /orders/{id} matches /v1/orders/9', () => {
  const m = matcherFrom([sidecarFor('h', ['https://h/v1'])]);
  const got = m.match('GET', 'https://h/v1/orders/9');
  assert.equal(got.key, 'h.getOrder');
  assert.equal(got.source, 'spec');
  // outside the base path -> not documented
  assert.equal(m.match('GET', 'https://h/orders/9').source, 'request');
});

test('undocumented path on a known host gets the request-only label', () => {
  const m = matcherFrom([sidecarFor('api.example.com', ['https://api.example.com'])]);
  const url = 'https://api.example.com/nope/12345';
  const verdict = classifyRow({ method: 'POST', path: '/nope/12345' });
  assert.deepEqual(m.match('POST', url), {
    key: requestKey('POST', url), letter: verdict.class, marker: verdict.review, source: 'request', tie: false,
  });
});

test('unknown host gets the request-only label, never null', () => {
  const m = matcherFrom([sidecarFor('api.example.com', ['https://api.example.com'])]);
  const got = m.match('GET', 'https://other.example.org/orders');
  assert.equal(got.source, 'request');
  assert.equal(got.key, requestKey('GET', 'https://other.example.org/orders'));
});

test('an empty matcher still answers every call', () => {
  assert.equal(matcherFrom([]).match('GET', 'https://a.test/x').source, 'request');
});

test('two vendors in one matcher each hit their own spec (host match is case-insensitive)', () => {
  const m = matcherFrom([
    sidecarFor('a.test', ['https://a.test']),
    sidecarFor('b.test', ['https://b.test']),
  ]);
  assert.equal(m.match('GET', 'https://a.test/orders').key, 'a.test.listOrders');
  assert.equal(m.match('GET', 'https://B.TEST/orders').key, 'b.test.listOrders');
});

test('a colliding key returns the tightest letter, as exportGate does', () => {
  const sidecar = {
    vendor: 'h',
    servers: ['https://h'],
    rows: [row('h.thing', 'GET', '/a', 'r'), row('h.thing', 'POST', '/b', 'x', 'tight'), row('h.thing', 'PUT', '/c', 'w')],
  };
  const m = matcherFrom([sidecar]);
  for (const [method, p] of [['GET', '/a'], ['POST', '/b'], ['PUT', '/c']]) {
    const got = m.match(method, `https://h${p}`);
    assert.equal(got.key, 'h.thing');
    assert.equal(got.letter, 'x');
    assert.equal(got.marker, 'tight');
  }
});

test('tie: matchOperation\'s tie flag, and two sidecars on one host', () => {
  const one = matcherFrom([{ vendor: 'h', servers: ['https://h'], rows: [row('h.a', 'GET', '/t/{x}', 'r'), row('h.b', 'GET', '/t/{y}', 'r')] }]);
  assert.equal(one.match('GET', 'https://h/t/1').tie, true);

  const two = matcherFrom([
    { vendor: 'v1', servers: ['https://h'], rows: [row('v1.read', 'GET', '/t', 'r')] },
    { vendor: 'v2', servers: ['https://h'], rows: [row('v2.read', 'GET', '/t', 'w', 'loose')] },
  ]);
  assert.deepEqual(two.match('GET', 'https://h/t'), { key: 'v2.read', letter: 'w', marker: 'loose', source: 'spec', tie: true });
});

test('two sidecars on one host with equal letters: the FIRST sidecar\'s key wins, and tie is true', () => {
  const m = matcherFrom([
    { vendor: 'v1', servers: ['https://h'], rows: [row('v1.read', 'GET', '/t', 'w', 'loose')] },
    { vendor: 'v2', servers: ['https://h'], rows: [row('v2.read', 'GET', '/t', 'w', 'loose')] },
  ]);
  assert.deepEqual(m.match('GET', 'https://h/t'), { key: 'v1.read', letter: 'w', marker: 'loose', source: 'spec', tie: true });
});

test('servers [] (or absent) falls back to https://<vendor>', () => {
  const rows = [row('h.api.getThing', 'GET', '/thing', 'r')];
  for (const servers of [[], undefined]) {
    const m = matcherFrom([{ vendor: 'api.h', ...(servers ? { servers } : {}), rows }]);
    assert.equal(m.match('GET', 'https://api.h/thing').source, 'spec');
    assert.equal(m.match('GET', 'https://other/thing').source, 'request');
  }
});

test('input errors throw at matcherFrom time', () => {
  const ok = row('h.a', 'GET', '/a', 'r');
  assert.throws(() => matcherFrom(/** @type {any} */ ('nope')), /array/);
  assert.throws(() => matcherFrom([null]), /rows array/);
  assert.throws(() => matcherFrom([{ vendor: 'h' }]), /rows array/);
  for (const bad of [
    { ...ok, key: undefined }, { ...ok, method: 1 }, { ...ok, path: undefined },
    { ...ok, letter: 'z' }, { ...ok, marker: 'maybe' },
  ]) {
    assert.throws(() => matcherFrom([{ vendor: 'h', rows: [bad] }]), /row 0/);
  }
  assert.throws(() => matcherFrom([{ vendor: 'h', rows: [ok], servers: 'https://h' }]), /servers must be an array of strings/);
  assert.throws(() => matcherFrom([{ vendor: 'h', rows: [ok], servers: [1] }]), /servers must be an array of strings/);
});

test('match throws on a URL that is not parseable http(s)', () => {
  const m = matcherFrom([]);
  assert.throws(() => m.match('GET', 'not a url'), /unparseable URL/);
  assert.throws(() => m.match('GET', 'ftp://h/x'), /not an http\(s\) URL/);
});

test('equal-literal candidates in rows without operationId: the tighter row letter wins', () => {
  const m = matcherFrom([{
    vendor: 'h',
    servers: ['https://h'],
    rows: [row('h.update', 'POST', '/{a}/{b}', 'w'), row('h.edit', 'POST', '/{c}/{d}', 'x', 'tight')],
  }]);
  const got = m.match('POST', 'https://h/1/2');
  assert.deepEqual(got, { key: 'h.edit', letter: 'x', marker: 'tight', source: 'spec', tie: true });
});

test('host AND port: a localhost:3000 server claims only that port', () => {
  const m = matcherFrom([sidecarFor('api.ibanforge.com', ['http://localhost:3000'])]);
  assert.equal(m.match('GET', 'http://localhost:3000/orders').source, 'spec');
  assert.equal(m.match('GET', 'http://localhost:11434/orders').source, 'request');
  assert.equal(m.match('GET', 'http://localhost/orders').source, 'request');
});

test('a default port is the same host as none', () => {
  const m = matcherFrom([sidecarFor('h', ['https://h'])]);
  assert.equal(m.match('GET', 'https://h:443/orders').source, 'spec');
  assert.equal(m.match('GET', 'https://h/orders').source, 'spec');
  const explicit = matcherFrom([sidecarFor('h', ['https://h:443'])]);
  assert.equal(explicit.match('GET', 'https://h/orders').source, 'spec');
});
