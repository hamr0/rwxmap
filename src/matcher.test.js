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

test('servers [] falls back to https://<vendor>', () => {
  const rows = [row('h.api.getThing', 'GET', '/thing', 'r')];
  const m = matcherFrom([{ vendor: 'api.h', servers: [], rows }]);
  assert.equal(m.match('GET', 'https://api.h/thing').source, 'spec');
  assert.equal(m.match('GET', 'https://other/thing').source, 'request');
});

test('a sidecar with NO servers key (written before 0.8.0) is refused, naming its index', () => {
  const rows = [row('stripe.deleteCustomer', 'DELETE', '/v1/customers/{id}', 'x')];
  const good = { vendor: 'h', servers: ['https://h'], rows: [row('h.a', 'GET', '/a', 'r')] };
  assert.throws(
    () => matcherFrom([good, { vendor: 'stripe', rows }]),
    /sidecar 1: no servers list.*regenerate it with rwxmap 0\.8\.0 or later/,
  );
});

// ---- tenant templates (suffix routes) and per-host base paths ----

const sentry = (extra = {}) => ({
  vendor: 'sentry.io',
  servers: ['https://us.sentry.io/'],
  serverTemplates: ['https://{region}.sentry.io/'],
  rows: [row('sentry.deleteIssue', 'DELETE', '/api/0/issues/{id}', 'x')],
  ...extra,
});

test('serverTemplates: any host under the fixed suffix routes, the bare suffix does not', () => {
  const m = matcherFrom([sentry()]);
  for (const host of ['us.sentry.io', 'de.sentry.io', 'a.b.sentry.io', 'DE.Sentry.IO']) {
    const got = m.match('DELETE', `https://${host}/api/0/issues/9`);
    assert.equal(got.source, 'spec', host);
    assert.equal(got.key, 'sentry.deleteIssue');
    assert.equal(got.tie, false, host); // one sidecar by two routes is one candidate
  }
  assert.equal(m.match('DELETE', 'https://sentry.io/api/0/issues/9').source, 'request');
  assert.equal(m.match('DELETE', 'https://de.notsentry.io/api/0/issues/9').source, 'request');
  assert.equal(m.match('DELETE', 'https://de.sentry.io.evil.test/api/0/issues/9').source, 'request');
});

test('serverTemplates: the port must match the template\'s port, default port if none', () => {
  const m = matcherFrom([sentry({ servers: [], serverTemplates: ['https://{r}.sentry.io:8443/'] })]);
  assert.equal(m.match('DELETE', 'https://de.sentry.io:8443/api/0/issues/9').source, 'spec');
  assert.equal(m.match('DELETE', 'https://de.sentry.io/api/0/issues/9').source, 'request');
  const plain = matcherFrom([sentry()]);
  assert.equal(plain.match('DELETE', 'https://de.sentry.io:443/api/0/issues/9').source, 'spec');
  assert.equal(plain.match('DELETE', 'https://de.sentry.io:8443/api/0/issues/9').source, 'request');
});

test('serverTemplates: a template\'s own base path is tried only for its tenant hosts', () => {
  const m = matcherFrom([{
    vendor: 'b.com',
    servers: ['https://a.com/v1'],
    serverTemplates: ['https://{t}.b.com/admin'],
    rows: [row('b.deleteUser', 'DELETE', '/users', 'x')],
  }]);
  assert.equal(m.match('DELETE', 'https://x.b.com/admin/users').source, 'spec');
  assert.equal(m.match('DELETE', 'https://a.com/v1/users').source, 'spec');
  assert.equal(m.match('DELETE', 'https://x.b.com/v1/users').source, 'request'); // a.com's base on a tenant host
  assert.equal(m.match('DELETE', 'https://a.com/admin/users').source, 'request'); // the template's base on a.com
});

test('a routed host tries only the base paths of the servers that route it', () => {
  const m = matcherFrom([{
    vendor: 'a.com',
    servers: ['https://a.com/v1', 'https://b.com/admin'],
    rows: [row('a.deleteUsers', 'DELETE', '/users', 'x')],
  }]);
  assert.equal(m.match('DELETE', 'https://a.com/v1/users').source, 'spec');
  assert.equal(m.match('DELETE', 'https://b.com/admin/users').source, 'spec');
  assert.equal(m.match('DELETE', 'https://a.com/admin/users').source, 'request');
  assert.equal(m.match('DELETE', 'https://b.com/v1/users').source, 'request');
});

test('serverTemplates across sidecars: sidecar order decides a tie, whichever route reached it', () => {
  const exact = { vendor: 'e', servers: ['https://de.sentry.io'], rows: [row('e.read', 'GET', '/t', 'w', 'loose')] };
  const tenant = { vendor: 't', servers: [], serverTemplates: ['https://{r}.sentry.io'], rows: [row('t.read', 'GET', '/t', 'w', 'loose')] };
  assert.equal(matcherFrom([tenant, exact]).match('GET', 'https://de.sentry.io/t').key, 't.read');
  assert.equal(matcherFrom([exact, tenant]).match('GET', 'https://de.sentry.io/t').key, 'e.read');
  assert.equal(matcherFrom([exact, tenant]).match('GET', 'https://de.sentry.io/t').tie, true);
  const tighter = { ...tenant, rows: [row('t.read', 'GET', '/t', 'x', 'settled')] };
  assert.equal(matcherFrom([exact, tighter]).match('GET', 'https://de.sentry.io/t').letter, 'x');
});

test('serverTemplates: entries that do not satisfy the suffix rule throw at matcherFrom', () => {
  const bad = [
    'https://{yourOktaDomain}', 'https://{subdomain}.{site}', 'https://{a}.{b}.com', 'https://{sub}.{domain}.com',
    'https://{a}.sentry.{tld}', 'https://api-{x}.foo.com', 'https://acme.sentry.io', 'https://your-domain.atlassian.net',
    '/v1', 'https://{a}.sentry.io?x=1',
  ];
  for (const t of bad) {
    assert.throws(() => matcherFrom([sentry({ serverTemplates: [t] })]), /sidecar 0: serverTemplates entry/, t);
  }
  assert.throws(() => matcherFrom([sentry({ serverTemplates: 'https://{a}.sentry.io' })]), /serverTemplates must be an array of strings/);
  assert.throws(() => matcherFrom([sentry({ serverTemplates: [1] })]), /serverTemplates must be an array of strings/);
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

// ---------------------------------------------------------------------
// Odd call URLs: a trailing host dot is dropped; a path with an escaped
// unreserved character or a ";" is malformed, not matched, x tight
// (GET/HEAD/OPTIONS keep their request-only label) with a reason.
// ---------------------------------------------------------------------

const ODD_SIDECAR = {
  vendor: 'acme',
  servers: ['https://api.acme.com/v1'],
  rows: [row('acme.putState', 'PUT', '/things/{id}/state', 'x')],
};
const oddMatcher = () => matcherFrom([ODD_SIDECAR]);
const BASE = 'https://api.acme.com/v1/things/1/state';

test('odd URL: the plain call is the spec x', () => {
  const got = oddMatcher().match('PUT', BASE);
  assert.deepEqual(got, { key: 'acme.putState', letter: 'x', marker: 'settled', source: 'spec', tie: false });
  assert.equal('malformed' in got, false);
});

test('odd URL: a trailing host dot is dropped, still the spec x, not flagged', () => {
  const got = oddMatcher().match('PUT', 'https://api.acme.com./v1/things/1/state');
  assert.equal(got.source, 'spec');
  assert.equal(got.letter, 'x');
  assert.equal('malformed' in got, false);
  const withPort = matcherFrom([{ ...ODD_SIDECAR, servers: ['https://api.acme.com:8443/v1'] }]);
  assert.equal(withPort.match('PUT', 'https://api.acme.com.:8443/v1/things/1/state').source, 'spec');
});

test('odd URL: a trailing-dot request-only call is keyed without the dot', () => {
  const got = oddMatcher().match('GET', 'https://other.example.com./a/b');
  assert.equal(got.key, requestKey('GET', 'https://other.example.com/a/b'));
  assert.equal('malformed' in got, false);
});

test('odd URL: an escaped unreserved character is malformed: x, request, tight', () => {
  const got = oddMatcher().match('PUT', 'https://api.acme.com/v1/%74hings/1/state');
  assert.equal(got.source, 'request');
  assert.equal(got.letter, 'x');
  assert.equal(got.marker, 'tight');
  assert.equal(got.tie, false);
  assert.equal(got.malformed, 'escaped unreserved character in path (%74)');
  assert.equal(got.key, requestKey('PUT', 'https://api.acme.com/v1/%74hings/1/state'));
});

test('odd URL: a ";" in the path is malformed: x for PUT, DELETE, POST, PATCH', () => {
  for (const method of ['PUT', 'DELETE', 'POST', 'PATCH']) {
    const got = oddMatcher().match(method, `${BASE};x=1`);
    assert.equal(got.source, 'request', method);
    assert.equal(got.letter, 'x', method);
    assert.equal(got.marker, 'tight', method);
    assert.equal(got.malformed, "';' in path", method);
  }
});

test('odd URL: GET, HEAD, OPTIONS keep their request-only label but carry malformed', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    const url = 'https://api.acme.com/v1/%74hings/1';
    const v = classifyRow({ method, path: new URL(url).pathname });
    const got = oddMatcher().match(method, url);
    assert.equal(got.letter, v.class, method);
    assert.equal(got.marker, v.review, method);
    assert.equal(got.source, 'request', method);
    assert.equal(got.malformed, 'escaped unreserved character in path (%74)', method);
  }
  assert.equal(oddMatcher().match('GET', 'https://api.acme.com/v1/things/1;x').letter, 'r');
});

test('odd URL: reserved escapes (%2F, %20, %3B) are not malformed', () => {
  for (const esc of ['%2F', '%20', '%3B', '%2f']) {
    const got = oddMatcher().match('PUT', `https://api.acme.com/v1/things/a${esc}b/state`);
    assert.equal('malformed' in got, false, esc);
  }
});

test('odd URL: unreserved escapes in either hex case are malformed', () => {
  for (const esc of ['%7E', '%7e', '%41', '%5f', '%2D', '%2e', '%30', '%7A']) {
    const got = oddMatcher().match('PUT', `https://api.acme.com/v1/things/a${esc}b/state`);
    assert.equal(typeof got.malformed, 'string', esc);
    assert.equal(got.letter, 'x', esc);
  }
});

test('odd URL: an escape in the query string only is not malformed (path only)', () => {
  const got = oddMatcher().match('PUT', `${BASE}?a=%74;b`);
  assert.equal(got.source, 'spec');
  assert.equal('malformed' in got, false);
});

test('odd URL: a dotted host with a malformed path is both fixed and flagged', () => {
  const got = oddMatcher().match('PUT', 'https://api.acme.com./v1/%74hings/1/state');
  assert.equal(got.malformed, 'escaped unreserved character in path (%74)');
  assert.equal(got.key, requestKey('PUT', 'https://api.acme.com/v1/%74hings/1/state'));
});
