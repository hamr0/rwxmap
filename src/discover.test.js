import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { findSpec, classifyCall, requestKey as discoverRequestKey } from './discover.js';
import { requestKey } from './key.js';
import { gateKey } from './exporter.js';

// ---------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------

const SPEC_DOC = {
  openapi: '3.0.0',
  servers: [{ url: 'https://api.example.com' }],
  paths: {
    '/widgets': { get: { operationId: 'listWidgets' } },
    '/widgets/{id}': { delete: { operationId: 'deleteWidget' } },
  },
};
const SPEC_TEXT = JSON.stringify(SPEC_DOC);

const EMPTY_DOC = { openapi: '3.0.0', servers: [{ url: 'https://api.example.com' }], paths: {} };
const EMPTY_TEXT = JSON.stringify(EMPTY_DOC);

/**
 * A fetch Response stand-in that satisfies BOTH callers in discover.js:
 * politeFetch (ok/status/headers.get/text()) and load.js's readUrlBytes
 * (status/headers.get('content-length')/no .body -> arrayBuffer()
 * fallback).
 */
function mockResponse({ status = 200, headers = {}, text = '' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (Object.prototype.hasOwnProperty.call(headers, name.toLowerCase()) ? headers[name.toLowerCase()] : null) },
    text: async () => text,
    // `Buffer.from(text).buffer` is the pooled ArrayBuffer, which can be
    // padded past the string's own byte length — TextEncoder gives an
    // exact-sized one, which is what a real fetch Response would too.
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
    body: undefined,
  };
}

/**
 * Installs a routed globalThis.fetch stub and returns { calls, restore }.
 * `routes` maps "METHOD url" -> a mockResponse() options object (or a
 * function returning one, for dynamic per-call bodies). Unmatched
 * requests get a bare 404.
 */
function stubFetch(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (async (url, init) => {
    const method = (init && init.method) || 'GET';
    const key = `${method} ${url}`;
    calls.push({ url: String(url), method });
    // A HEAD request with no explicit route mirrors the GET route's
    // status (realistic default: most servers answer HEAD the same as
    // GET for a given path) — resolveSafeCandidateUrl's HEAD-first
    // resolution pass relies on this unless a test defines its own HEAD
    // route to exercise the HEAD-refused fallback explicitly.
    const route = routes[key] || (method === 'HEAD' ? routes[`GET ${url}`] : undefined);
    if (!route) return mockResponse({ status: 404 });
    const opts = typeof route === 'function' ? route() : route;
    return mockResponse(opts);
  }));
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function mkTmpCacheDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-discover-test-'));
}

function cacheFilePathFor(cacheDir, key) {
  const hash = createHash('sha256').update(key).digest('hex');
  return path.join(cacheDir, `${hash}.json`);
}

// ---------------------------------------------------------------------
// Discovery order — each step finds and stops there
// ---------------------------------------------------------------------

test('step 3 (well-known/api-catalog) finds a spec and stops there', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': {
      status: 200,
      text: JSON.stringify({ 'service-desc': [{ href: 'https://example.com/openapi.json' }] }),
    },
    'GET https://example.com/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'found');
    assert.equal(result.specUrl, 'https://example.com/openapi.json');
    // catalog probe + a HEAD to resolve the candidate safely (fix #1) +
    // the spec fetch itself, nothing else.
    assert.equal(calls.length, 3, 'only the catalog probe + the safety-resolution HEAD + the spec fetch');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('step 4 (Link: rel=service-desc) finds a spec and stops there, after step 3 fails', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': { status: 404 },
    'HEAD https://example.com/': { status: 200, headers: { link: '<https://example.com/openapi.json>; rel="service-desc"' } },
    'GET https://example.com/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'found');
    assert.equal(result.specUrl, 'https://example.com/openapi.json');
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
      'GET https://example.com/.well-known/api-catalog',
      'HEAD https://example.com/',
      'HEAD https://example.com/openapi.json', // candidate safety-resolution (fix #1)
      'GET https://example.com/openapi.json',
    ]);
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('step 4 falls back to GET when HEAD is refused', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': { status: 404 },
    'HEAD https://example.com/': { status: 405 },
    'GET https://example.com/': { status: 200, headers: { link: '<https://example.com/openapi.json>; rel="service-desc"' } },
    'GET https://example.com/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'found');
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
      'GET https://example.com/.well-known/api-catalog',
      'HEAD https://example.com/',
      'GET https://example.com/',
      'HEAD https://example.com/openapi.json', // candidate safety-resolution (fix #1)
      'GET https://example.com/openapi.json',
    ]);
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('step 5 (guess paths) finds a spec and stops there, after steps 3-4 fail', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': { status: 404 },
    'HEAD https://example.com/': { status: 200, headers: {} },
    'GET https://example.com/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'found');
    assert.equal(result.specUrl, 'https://example.com/openapi.json');
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
      'GET https://example.com/.well-known/api-catalog',
      'HEAD https://example.com/',
      'HEAD https://example.com/openapi.json', // candidate safety-resolution (fix #1)
      'GET https://example.com/openapi.json',
    ]);
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('a candidate that loads but has 0 operations is skipped, discovery continues', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': { status: 404 },
    'HEAD https://example.com/': { status: 200, headers: {} },
    'GET https://example.com/openapi.json': { status: 200, text: EMPTY_TEXT },
    'GET https://example.com/openapi.yaml': { status: 200, text: SPEC_TEXT },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'found');
    assert.equal(result.specUrl, 'https://example.com/openapi.yaml', 'the 0-op candidate must be skipped, not adopted');
    const urls = calls.map((c) => c.url);
    assert.ok(urls.includes('https://example.com/openapi.json'));
    assert.ok(urls.includes('https://example.com/openapi.yaml'));
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------
// Redirect safety (orchestrator fix #1) and body cap (fix #2)
// ---------------------------------------------------------------------

test('a redirect to an IP-literal / http / localhost target is never requested', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': {
      status: 200,
      text: JSON.stringify({ 'service-desc': [{ href: 'https://example.com/openapi.json' }] }),
    },
    // The candidate itself is safe, but redirects to an unsafe target —
    // the whole point of fix #1: a candidate that starts safe can still
    // redirect somewhere that isn't.
    'HEAD https://example.com/openapi.json': { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'none', 'the unsafe redirect target must sink this candidate, not be followed');
    const urls = calls.map((c) => c.url);
    assert.ok(!urls.some((u) => u.includes('169.254.169.254')), 'the IP-literal redirect target must never be requested');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('a service-desc href pointing at an IP literal is never requested', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': {
      status: 200,
      // The catalog itself names an unsafe href directly — no redirect
      // needed to reach it.
      text: JSON.stringify({ 'service-desc': [{ href: 'https://169.254.169.254/openapi.json' }] }),
    },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'none');
    const urls = calls.map((c) => c.url);
    assert.ok(!urls.some((u) => u.includes('169.254.169.254')), 'a service-desc href to an IP literal must never be requested');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('a safe https redirect (candidate moved to another https host) is followed', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': {
      status: 200,
      text: JSON.stringify({ 'service-desc': [{ href: 'https://example.com/openapi.json' }] }),
    },
    'HEAD https://example.com/openapi.json': { status: 302, headers: { location: 'https://cdn.example.com/openapi.json' } },
    'HEAD https://cdn.example.com/openapi.json': { status: 200 },
    'GET https://cdn.example.com/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'found');
    assert.equal(result.specUrl, 'https://cdn.example.com/openapi.json', 'the safe redirect target must be the one actually loaded');
    const urls = calls.map((c) => c.url);
    assert.ok(urls.includes('https://cdn.example.com/openapi.json'));
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('api-catalog probe itself redirected to an unsafe target: never requested (politeFetch\'s own redirect loop)', async () => {
  // Distinct from the earlier two redirect tests: those exercise
  // resolveSafeCandidateUrl (the spec-candidate resolution path). This
  // one exercises politeFetch's OWN redirect walk, used by step 3's
  // catalog probe and step 4's Link-header probe — a separate code
  // path that must enforce the same per-hop check.
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': { status: 302, headers: { location: 'http://169.254.169.254/evil' } },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'none');
    const urls = calls.map((c) => c.url);
    assert.ok(!urls.some((u) => u.includes('169.254.169.254')), 'the api-catalog probe\'s own unsafe redirect target must never be requested');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('Link-header HEAD probe redirected to an unsafe target: never requested', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': { status: 404 },
    'HEAD https://example.com/': { status: 302, headers: { location: 'https://localhost/evil' } },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'none');
    const urls = calls.map((c) => c.url);
    assert.ok(!urls.some((u) => u.includes('localhost')), 'the Link-header HEAD probe\'s own unsafe redirect target must never be requested');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('Link-header GET fallback (HEAD refused) redirected to an unsafe target: never requested', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': { status: 404 },
    'HEAD https://example.com/': { status: 405 }, // refused -> GET fallback
    'GET https://example.com/': { status: 302, headers: { location: 'http://169.254.169.254/evil' } },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'none');
    const urls = calls.map((c) => c.url);
    assert.ok(!urls.some((u) => u.includes('169.254.169.254')), 'the Link-header GET fallback\'s own unsafe redirect target must never be requested');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('api-catalog body over 1 MB is treated as no result (fix #2)', async () => {
  const cacheDir = mkTmpCacheDir();
  const oversized = JSON.stringify({ padding: 'x'.repeat(1024 * 1024 + 1) });
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': { status: 200, text: oversized },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'none', 'an over-cap catalog body must be treated as no result, not parsed');
    // Discovery must have moved on past the catalog step (tried step 4
    // and step 5 too) rather than getting stuck on the oversized body.
    assert.ok(calls.some((c) => c.url === 'https://example.com/'), 'step 4 must still have been tried');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------
// LIMIT 1 — GUESS_PATHS shrunk to exactly 3 (user ruling 2026-09-28)
// ---------------------------------------------------------------------

test('LIMIT 1: only /openapi.json, /openapi.yaml, /swagger.json are ever guessed, for a spec-less 3-label host', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({}); // everything 404s -> spec-less
  try {
    const result = await findSpec('https://api.example.com', { cacheDir });
    assert.equal(result.status, 'none');
    // Exact ordered request list: step 3 (2 catalog probes: api.example.com,
    // example.com) + step 4 (HEAD+GET "/" on each of those 2 hosts) +
    // step 5 (3 guess paths x 4 hosts: api.example.com, docs./developer./
    // developers.example.com), nothing else.
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
      'GET https://api.example.com/.well-known/api-catalog',
      'GET https://example.com/.well-known/api-catalog',
      'HEAD https://api.example.com/',
      'GET https://api.example.com/',
      'HEAD https://example.com/',
      'GET https://example.com/',
      'HEAD https://api.example.com/openapi.json',
      'HEAD https://api.example.com/openapi.yaml',
      'HEAD https://api.example.com/swagger.json',
      'HEAD https://docs.example.com/openapi.json',
      'HEAD https://docs.example.com/openapi.yaml',
      'HEAD https://docs.example.com/swagger.json',
      'HEAD https://developer.example.com/openapi.json',
      'HEAD https://developer.example.com/openapi.yaml',
      'HEAD https://developer.example.com/swagger.json',
      'HEAD https://developers.example.com/openapi.json',
      'HEAD https://developers.example.com/openapi.yaml',
      'HEAD https://developers.example.com/swagger.json',
    ], `total request count for a spec-less 3-label host: ${calls.length} (expected 18)`);
    assert.equal(calls.length, 18, `spec-less 3-label host: ${calls.length} total requests (2 catalog + 4 link-header + 12 guess-path)`);
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------
// LIMIT 2 — at most 3 service-desc hrefs tried per catalog/Link response
// ---------------------------------------------------------------------

test('LIMIT 2: an api-catalog response with 5 service-desc hrefs tries only the first 3, in document order', async () => {
  const cacheDir = mkTmpCacheDir();
  const hrefs = [1, 2, 3, 4, 5].map((i) => `https://example.com/spec${i}.json`);
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': {
      status: 200,
      text: JSON.stringify({ 'service-desc': hrefs.map((href) => ({ href })) }),
    },
    // every candidate 404s by default -> catalog step exhausts its capped
    // list and discovery falls through to steps 4-5, irrelevant here.
  });
  try {
    await findSpec('https://example.com', { cacheDir });
    const requestedUrls = calls.map((c) => c.url);
    assert.ok(requestedUrls.includes('https://example.com/spec1.json'));
    assert.ok(requestedUrls.includes('https://example.com/spec2.json'));
    assert.ok(requestedUrls.includes('https://example.com/spec3.json'));
    assert.ok(!requestedUrls.includes('https://example.com/spec4.json'), 'the 4th href must never be tried');
    assert.ok(!requestedUrls.includes('https://example.com/spec5.json'), 'the 5th href must never be tried');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('LIMIT 2: a Link header with 5 service-desc hrefs tries only the first 3, in document order', async () => {
  const cacheDir = mkTmpCacheDir();
  const hrefs = [1, 2, 3, 4, 5].map((i) => `https://example.com/spec${i}.json`);
  const linkHeader = hrefs.map((href) => `<${href}>; rel="service-desc"`).join(', ');
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': { status: 404 },
    'HEAD https://example.com/': { status: 200, headers: { link: linkHeader } },
  });
  try {
    await findSpec('https://example.com', { cacheDir });
    const requestedUrls = calls.map((c) => c.url);
    assert.ok(requestedUrls.includes('https://example.com/spec1.json'));
    assert.ok(requestedUrls.includes('https://example.com/spec2.json'));
    assert.ok(requestedUrls.includes('https://example.com/spec3.json'));
    assert.ok(!requestedUrls.includes('https://example.com/spec4.json'), 'the 4th href must never be tried');
    assert.ok(!requestedUrls.includes('https://example.com/spec5.json'), 'the 5th href must never be tried');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------
// LIMIT 3 — 60s wall-clock budget for steps 3-5. No clock option is added
// to findSpec's public API; the mocked wall clock is advanced by Node's
// own node:test timer mock (a seam the test runner already provides, not
// a test-only export from discover.js), ticking it forward from inside
// the stubbed fetch responses themselves.
// ---------------------------------------------------------------------

test('LIMIT 3: the 60s discovery budget stops new requests once exhausted; cached as a time-budget "none"', async (t) => {
  const cacheDir = mkTmpCacheDir();
  t.mock.timers.enable({ apis: ['Date'] });
  const tick = () => t.mock.timers.tick(25_000);
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': () => { tick(); return { status: 404 }; },
    'HEAD https://example.com/': () => { tick(); return { status: 404 }; },
    'GET https://example.com/': () => { tick(); return { status: 404 }; },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'none');
    assert.equal(result.reason, 'time budget (60 s) exhausted');
    // 3 x 25s ticks = 75s elapsed, past the 60s budget, so step 5 (guess
    // paths) must never even start.
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
      'GET https://example.com/.well-known/api-catalog',
      'HEAD https://example.com/',
      'GET https://example.com/',
    ], `budget-exhausted request count: ${calls.length} (expected 3, step 5 never starts)`);

    calls.length = 0;
    const second = await findSpec('https://example.com', { cacheDir });
    assert.equal(second.fromCache, true);
    assert.equal(second.reason, 'time budget (60 s) exhausted');
    assert.equal(calls.length, 0, 'a budget-exhausted "none" must be cached like any other none');
  } finally {
    restore();
    t.mock.timers.reset();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------
// Walk-up order
// ---------------------------------------------------------------------

test('walk-up host candidate order for a 4-label host: full, then each parent, down to 2 labels', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://api-m.sandbox.acme.example/.well-known/api-catalog': { status: 404 },
    'GET https://sandbox.acme.example/.well-known/api-catalog': { status: 404 },
    'GET https://acme.example/.well-known/api-catalog': {
      status: 200,
      text: JSON.stringify({ 'service-desc': [{ href: 'https://acme.example/openapi.json' }] }),
    },
    'GET https://acme.example/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const result = await findSpec('https://api-m.sandbox.acme.example', { cacheDir });
    assert.equal(result.status, 'found');
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
      'GET https://api-m.sandbox.acme.example/.well-known/api-catalog',
      'GET https://sandbox.acme.example/.well-known/api-catalog',
      'GET https://acme.example/.well-known/api-catalog',
      'HEAD https://acme.example/openapi.json', // candidate safety-resolution (fix #1)
      'GET https://acme.example/openapi.json',
    ], 'walk-up must go full host -> drop one label at a time -> stop at 2 labels, never a suffix-list guess');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------

test('none is cached; a second call makes zero requests', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({}); // every discovery request 404s
  try {
    const first = await findSpec('https://example.com', { cacheDir });
    assert.equal(first.status, 'none');
    assert.equal(first.fromCache, false);
    assert.ok(calls.length > 0, 'the first call must actually probe');

    calls.length = 0;
    const second = await findSpec('https://example.com', { cacheDir });
    assert.equal(second.status, 'none');
    assert.equal(second.fromCache, true);
    assert.equal(calls.length, 0, 'a cached "none" must make zero requests');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('a found result is cached; a second call makes zero requests', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': {
      status: 200,
      text: JSON.stringify({ 'service-desc': [{ href: 'https://example.com/openapi.json' }] }),
    },
    'GET https://example.com/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const first = await findSpec('https://example.com', { cacheDir });
    assert.equal(first.status, 'found');
    assert.equal(first.fromCache, false);

    calls.length = 0;
    const second = await findSpec('https://example.com', { cacheDir });
    assert.equal(second.status, 'found');
    assert.equal(second.fromCache, true);
    assert.equal(second.specUrl, first.specUrl);
    assert.equal(calls.length, 0);
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('an expired cache entry (fetchedAt > 30 days old) is a miss', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({}); // none, every call 404s
  try {
    await findSpec('https://example.com', { cacheDir });
    const file = cacheFilePathFor(cacheDir, 'example.com');
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    stored.fetchedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;
    fs.writeFileSync(file, JSON.stringify(stored));

    calls.length = 0;
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.fromCache, false);
    assert.ok(calls.length > 0, 'an expired entry must re-probe, not reuse');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('a cache entry from a different rwxmap version is a miss', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({});
  try {
    await findSpec('https://example.com', { cacheDir });
    const file = cacheFilePathFor(cacheDir, 'example.com');
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    stored.rwxmapVersion = '0.0.0-not-the-real-version';
    fs.writeFileSync(file, JSON.stringify(stored));

    calls.length = 0;
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.fromCache, false);
    assert.ok(calls.length > 0, 'a different package version must re-probe, not reuse');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('a corrupt cache file is a miss', async () => {
  const cacheDir = mkTmpCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });
  const file = cacheFilePathFor(cacheDir, 'example.com');
  fs.writeFileSync(file, '{not valid json');
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': {
      status: 200,
      text: JSON.stringify({ 'service-desc': [{ href: 'https://example.com/openapi.json' }] }),
    },
    'GET https://example.com/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'found');
    assert.equal(result.fromCache, false);
    assert.ok(calls.length > 0, 'a corrupt cache file must be treated as a miss, not thrown');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('an unwritable cacheDir still returns a result (cached: false)', async () => {
  const parent = mkTmpCacheDir();
  const blockerFile = path.join(parent, 'blocker');
  fs.writeFileSync(blockerFile, 'not a directory');
  const cacheDir = path.join(blockerFile, 'sub'); // mkdir under a file -> ENOTDIR
  const { calls, restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': {
      status: 200,
      text: JSON.stringify({ 'service-desc': [{ href: 'https://example.com/openapi.json' }] }),
    },
    'GET https://example.com/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const result = await findSpec('https://example.com', { cacheDir });
    assert.equal(result.status, 'found');
    assert.equal(result.cached, false, 'the write must fail quietly, not throw');
    assert.ok(calls.length > 0);
  } finally {
    restore();
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------
// Safety refusals
// ---------------------------------------------------------------------

test('SAFETY: a non-https apiUrl is refused, zero requests, uncached', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({});
  try {
    const result = await findSpec('http://example.com', { cacheDir });
    assert.equal(result.status, 'none');
    assert.ok(result.reason);
    assert.equal(result.fromCache, false);
    assert.equal(calls.length, 0);
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('SAFETY: an IPv4-literal host is refused, zero requests', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({});
  try {
    const result = await findSpec('https://192.168.0.1/', { cacheDir });
    assert.equal(result.status, 'none');
    assert.equal(calls.length, 0);
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('SAFETY: an IPv6-literal host is refused, zero requests', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({});
  try {
    const result = await findSpec('https://[::1]/', { cacheDir });
    assert.equal(result.status, 'none');
    assert.equal(calls.length, 0);
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('SAFETY: localhost is refused, zero requests', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({});
  try {
    const result = await findSpec('https://localhost/', { cacheDir });
    assert.equal(result.status, 'none');
    assert.equal(calls.length, 0);
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('SAFETY: a single-label host is refused, zero requests', async () => {
  const cacheDir = mkTmpCacheDir();
  const { calls, restore } = stubFetch({});
  try {
    const result = await findSpec('https://internalhost/', { cacheDir });
    assert.equal(result.status, 'none');
    assert.equal(calls.length, 0);
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------
// opts.spec — tries nothing else
// ---------------------------------------------------------------------

test('opts.spec tries no OTHER discovery: zero requests, even though apiUrl is still read for vendor naming', async () => {
  const cacheDir = mkTmpCacheDir();
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-discover-fixture-'));
  const specPath = path.join(fixtureDir, 'spec.json');
  fs.writeFileSync(specPath, SPEC_TEXT);
  const { calls, restore } = stubFetch({});
  try {
    // apiUrl doesn't parse as a URL here, so determineVendor falls
    // through to the spec's own first server (api.example.com) —
    // "tries nothing else" is about NETWORK discovery (catalog/Link/
    // guess-paths), never attempted for opts.spec, not about whether
    // apiUrl is read at all.
    const result = await findSpec('not-a-url-at-all', { spec: specPath, cacheDir });
    assert.equal(result.status, 'found');
    assert.equal(result.host, 'api.example.com');
    assert.equal(calls.length, 0, 'a local opts.spec must never touch fetch');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------
// vendor rule for opts.spec (orchestrator fix #3)
// ---------------------------------------------------------------------

test('vendor for opts.spec: apiUrl\'s own hostname wins when apiUrl is a real URL', async () => {
  const cacheDir = mkTmpCacheDir();
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-discover-fixture-'));
  const specPath = path.join(fixtureDir, 'spec.json');
  fs.writeFileSync(specPath, SPEC_TEXT); // SPEC_DOC's own server is api.example.com — must NOT win here
  try {
    const result = await findSpec('https://api.figma.com', { spec: specPath, cacheDir });
    assert.equal(result.status, 'found');
    assert.equal(result.host, 'api.figma.com');
    assert.equal(result.specUrl, specPath);
    // gate keys must be prefixed with the SAME vendor, not the spec's own server host.
    assert.ok(Object.keys(result.entries).every((k) => k.startsWith('api.figma.com.')));
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('vendor for opts.spec: falls back to the spec\'s own first resolved server when apiUrl does not identify a host', async () => {
  const cacheDir = mkTmpCacheDir();
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-discover-fixture-'));
  const specPath = path.join(fixtureDir, 'spec.json');
  fs.writeFileSync(specPath, SPEC_TEXT); // servers: [{ url: 'https://api.example.com' }]
  try {
    const result = await findSpec('', { spec: specPath, cacheDir });
    assert.equal(result.status, 'found');
    assert.equal(result.host, 'api.example.com');
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('vendor for opts.spec: throws a clear error when apiUrl is unusable AND the spec declares no servers', async () => {
  const cacheDir = mkTmpCacheDir();
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-discover-fixture-'));
  const specPath = path.join(fixtureDir, 'spec.json');
  const noServersDoc = { paths: { '/widgets': { get: { operationId: 'listWidgets' } } } };
  fs.writeFileSync(specPath, JSON.stringify(noServersDoc));
  try {
    await assert.rejects(
      () => findSpec('', { spec: specPath, cacheDir }),
      /findSpec: opts.spec was given, but apiUrl does not identify a host/,
    );
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------
// classifyCall
// ---------------------------------------------------------------------

test('classifyCall: a matching call on a found spec is classified from the spec (source "spec")', async () => {
  const cacheDir = mkTmpCacheDir();
  const { restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': {
      status: 200,
      text: JSON.stringify({ 'service-desc': [{ href: 'https://example.com/openapi.json' }] }),
    },
    'GET https://example.com/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const found = await findSpec('https://example.com', { cacheDir });
    assert.equal(found.status, 'found');
    const result = classifyCall(found, 'DELETE', 'https://api.example.com/widgets/123');
    assert.equal(result.source, 'spec');
    assert.equal(result.key, gateKey('example.com', { method: 'DELETE', path: '/widgets/{id}', operationId: 'deleteWidget' }));
    assert.equal(result.letter, 'x');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('classifyCall: an undocumented endpoint on a found spec falls back to per-request classification', async () => {
  const cacheDir = mkTmpCacheDir();
  const { restore } = stubFetch({
    'GET https://example.com/.well-known/api-catalog': {
      status: 200,
      text: JSON.stringify({ 'service-desc': [{ href: 'https://example.com/openapi.json' }] }),
    },
    'GET https://example.com/openapi.json': { status: 200, text: SPEC_TEXT },
  });
  try {
    const found = await findSpec('https://example.com', { cacheDir });
    assert.equal(found.status, 'found');
    const url = 'https://api.example.com/reports/export';
    const result = classifyCall(found, 'POST', url);
    assert.equal(result.source, 'request');
    assert.equal(result.key, requestKey('POST', url));
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('classifyCall: no spec (status "none") always falls back to per-request classification', async () => {
  const cacheDir = mkTmpCacheDir();
  const { restore } = stubFetch({});
  try {
    const found = await findSpec('https://example.com', { cacheDir });
    assert.equal(found.status, 'none');
    const url = 'https://api.example.com/widgets';
    const result = classifyCall(found, 'GET', url);
    assert.equal(result.source, 'request');
    assert.equal(result.key, requestKey('GET', url));
    assert.equal(result.letter, 'r');
  } finally {
    restore();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('discover.js re-exports requestKey verbatim from key.js', () => {
  assert.equal(discoverRequestKey, requestKey);
});
