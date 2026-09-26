// Pass 1 of item b (spec discovery), step 3 — probe.mjs.
//
// For each vendor derived by vendors.mjs, run four independent discovery
// strategies against the live vendor server and report what each finds,
// without ever assuming one strategy's failure implies another's. This is
// a POC: it never writes into src/ and imports from it read-only
// (loadSpec from src/load.js, operationsFrom from src/index.js).
//
// Politeness (CLAUDE.md brief): every HTTP request in this file goes
// through one shared queue so requests to vendor/docs/aggregator servers
// never run more than one at a time, each bounded by a 10s timeout, none
// retried, all carrying the same User-Agent.
//
// A. RFC 9727 `.well-known/api-catalog` (a linkset or JSON with
//    `service-desc` links, on the API host and the registrable domain).
// B. RFC 8631 `Link: rel="service-desc"` on `/` (HEAD, falling back to
//    GET when HEAD is refused), same two hosts.
// C. Guessed common OpenAPI/Swagger paths, on the API host, on
//    `docs./developer./developers.<domain>`, and under the server URL's
//    first path segment when it has one.
// D. APIs.guru's `list.json` (cached), matched by key or
//    `x-providerName` against the vendor's registrable domain.
//
// A candidate is FOUND only when it loads (loadSpec) AND its operations
// overlap the locked spec's (METHOD, path) keys at >= 0.5 share. Below
// that, but still loadable, it is WRONG_SPEC. Anything that never loads
// is NOT_FOUND for that strategy.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpec } from '../../src/load.js';
import { operationsFrom } from '../../src/index.js';
import { collectVendorRows } from './vendors.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = `${HERE}/.cache`;
const APIS_GURU_CACHE = `${CACHE_DIR}/apisguru-list.json`;

const USER_AGENT = 'rwxmap-discovery-poc/0.1 (+https://github.com/hamr0/rwxmap)';
const TIMEOUT_MS = 10_000;
const OVERLAP_THRESHOLD = 0.5;

// Known two-level (or three-label) public suffixes this simple heuristic
// treats specially, so e.g. "developer.mailchimp.com" doesn't register
// its docs subdomain's parent as "developer.mailchimp.com" while a real
// two-level-suffix domain like "example.co.uk" doesn't get truncated to
// "co.uk". Kept short and explicit per the brief ("keep this simple and
// say what you did") rather than pulling in the public-suffix-list
// dependency.
const TWO_LEVEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk',
  'co.jp', 'co.nz', 'co.in', 'co.za', 'com.au', 'com.br', 'com.cn',
]);

const GUESS_PATHS = [
  '/openapi.json',
  '/openapi.yaml',
  '/openapi.yml',
  '/swagger.json',
  '/swagger.yaml',
  '/v3/api-docs',
  '/v2/api-docs',
  '/api-docs',
  '/api-docs.json',
  '/swagger/v1/swagger.json',
  '/.well-known/openapi.json',
  '/.well-known/openapi.yaml',
  '/spec/openapi.json',
  '/openapi/v3.json',
];

// ---------------------------------------------------------------------
// One-at-a-time request queue. Every fetch in this file — regardless of
// vendor, strategy, or host — passes through here, so the whole probe run
// never has two requests in flight at once.
// ---------------------------------------------------------------------
let queueTail = Promise.resolve();
let totalRequests = 0;

function enqueue(fn) {
  const run = queueTail.then(fn, fn);
  // Swallow rejections in the chain itself; callers still see their own
  // promise's rejection via `run`.
  queueTail = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * @param {string} url
 * @param {{method?: string}} [opts]
 * @returns {Promise<{ok: boolean, status: number|null, headers: Headers|null, text: string|null, error: string|null}>}
 */
function request(url, opts = {}) {
  return enqueue(async () => {
    totalRequests += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: opts.method || 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
      let text = null;
      if (opts.method !== 'HEAD') {
        try {
          text = await res.text();
        } catch {
          text = null;
        }
      }
      return { ok: res.ok, status: res.status, headers: res.headers, text, error: null };
    } catch (err) {
      return { ok: false, status: null, headers: null, text: null, error: err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timer);
    }
  });
}

// ---------------------------------------------------------------------
// Registrable domain (simple heuristic, per the brief)
// ---------------------------------------------------------------------
/**
 * Last two labels of the host, or three when the last two form one of the
 * known 2-level public suffixes above. Does not consult a public suffix
 * list — a vendor host on an unlisted 2-level suffix will register as
 * that suffix plus one label short, which is reported as what happened,
 * not hidden.
 * @param {string} host
 * @returns {string}
 */
function registrableDomain(host) {
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join('.');
  if (TWO_LEVEL_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}

// ---------------------------------------------------------------------
// Candidate validation
// ---------------------------------------------------------------------
function opKeys(ops) {
  return new Set(ops.map((o) => `${o.method} ${o.path}`));
}

/**
 * @param {string} candidateUrl
 * @param {Set<string>} lockedKeys
 * @returns {Promise<{verdict: 'found'|'wrong_spec'|'not_found', overlap: number, error: string|null}>}
 */
async function validateCandidate(candidateUrl, lockedKeys) {
  let loaded;
  try {
    loaded = await enqueue(() => loadSpec(candidateUrl, { timeoutMs: TIMEOUT_MS }));
    totalRequests += 1; // loadSpec makes its own fetch
  } catch (err) {
    return { verdict: 'not_found', overlap: 0, error: err instanceof Error ? err.message : String(err) };
  }
  const ops = operationsFrom(loaded.doc);
  const candidateKeys = opKeys(ops);
  let hits = 0;
  for (const k of lockedKeys) {
    if (candidateKeys.has(k)) hits += 1;
  }
  const overlap = lockedKeys.size > 0 ? hits / lockedKeys.size : 0;
  return { verdict: overlap >= OVERLAP_THRESHOLD ? 'found' : 'wrong_spec', overlap, error: null };
}

// ---------------------------------------------------------------------
// Strategy A — RFC 9727 .well-known/api-catalog
// ---------------------------------------------------------------------
function parseLinksetServiceDesc(text, baseUrl) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  const hrefs = [];
  const linkset = Array.isArray(json.linkset) ? json.linkset : (Array.isArray(json) ? json : null);
  if (linkset) {
    for (const entry of linkset) {
      const sd = entry && entry['service-desc'];
      if (Array.isArray(sd)) {
        for (const link of sd) {
          if (link && typeof link.href === 'string') hrefs.push(new URL(link.href, baseUrl).toString());
        }
      }
    }
  }
  // Also accept a bare { "service-desc": [...] } (not linkset-wrapped).
  if (Array.isArray(json['service-desc'])) {
    for (const link of json['service-desc']) {
      if (link && typeof link.href === 'string') hrefs.push(new URL(link.href, baseUrl).toString());
    }
  }
  return hrefs;
}

async function strategyA(apiHost, registrable, lockedKeys) {
  const tried = [];
  const bases = [`https://${apiHost}`, `https://${registrable}`];
  for (const base of bases) {
    const url = `${base}/.well-known/api-catalog`;
    const res = await request(url);
    tried.push({ url, method: 'GET', status: res.status ?? `error: ${res.error}` });
    if (!res.ok || !res.text) continue;
    const hrefs = parseLinksetServiceDesc(res.text, url);
    for (const href of hrefs) {
      const v = await validateCandidate(href, lockedKeys);
      tried.push({ url: href, method: 'GET (followed service-desc)', status: v.error ? `load error: ${v.error}` : 'loaded' });
      if (v.verdict === 'found') {
        return { result: 'found', winningUrl: href, overlap: v.overlap, tried, requestCount: tried.length };
      }
      if (v.verdict === 'wrong_spec') {
        return { result: 'wrong_spec', winningUrl: href, overlap: v.overlap, tried, requestCount: tried.length };
      }
    }
  }
  return { result: 'not_found', winningUrl: null, overlap: 0, tried, requestCount: tried.length };
}

// ---------------------------------------------------------------------
// Strategy B — RFC 8631 Link: rel="service-desc"
// ---------------------------------------------------------------------
function parseLinkHeaderServiceDesc(linkHeader, baseUrl) {
  if (!linkHeader) return [];
  const hrefs = [];
  // A Link header is a comma-separated list of "<url>; rel=...; ...".
  // Split conservatively on "," that precede a "<" (a rel value or title
  // could itself contain a comma inside quotes, but none of the vendors
  // probed here are expected to do that).
  const parts = linkHeader.split(/,(?=\s*<)/);
  for (const part of parts) {
    const m = part.match(/<([^>]+)>((?:\s*;\s*[a-zA-Z-]+="?[^;"]*"?)*)/);
    if (!m) continue;
    const [, href, params] = m;
    if (/rel="?service-desc"?/i.test(params)) {
      hrefs.push(new URL(href, baseUrl).toString());
    }
  }
  return hrefs;
}

async function strategyB(apiHost, registrable, lockedKeys) {
  const tried = [];
  const bases = [`https://${apiHost}/`, `https://${registrable}/`];
  for (const url of bases) {
    let res = await request(url, { method: 'HEAD' });
    tried.push({ url, method: 'HEAD', status: res.status ?? `error: ${res.error}` });
    // "fall back to GET if HEAD is refused" — HEAD not ok/reachable.
    if (res.status === null || res.status === 405 || res.status >= 400) {
      res = await request(url, { method: 'GET' });
      tried.push({ url, method: 'GET (HEAD refused)', status: res.status ?? `error: ${res.error}` });
    }
    const linkHeader = res.headers ? res.headers.get('link') : null;
    const hrefs = parseLinkHeaderServiceDesc(linkHeader, url);
    for (const href of hrefs) {
      const v = await validateCandidate(href, lockedKeys);
      tried.push({ url: href, method: 'GET (followed service-desc)', status: v.error ? `load error: ${v.error}` : 'loaded' });
      if (v.verdict === 'found') {
        return { result: 'found', winningUrl: href, overlap: v.overlap, tried, requestCount: tried.length };
      }
      if (v.verdict === 'wrong_spec') {
        return { result: 'wrong_spec', winningUrl: href, overlap: v.overlap, tried, requestCount: tried.length };
      }
    }
  }
  return { result: 'not_found', winningUrl: null, overlap: 0, tried, requestCount: tried.length };
}

// ---------------------------------------------------------------------
// Strategy C — guessed common paths
// ---------------------------------------------------------------------
function firstPathSegment(serverUrlRaw) {
  try {
    const u = new URL(serverUrlRaw.replace(/\{[^}]+\}/g, 'x'));
    const seg = u.pathname.split('/').filter(Boolean)[0];
    return seg || null;
  } catch {
    return null;
  }
}

async function strategyC(apiHost, registrable, serverUrlRaw, lockedKeys) {
  const tried = [];
  const hosts = [apiHost, `docs.${registrable}`, `developer.${registrable}`, `developers.${registrable}`];
  const seg = firstPathSegment(serverUrlRaw);

  for (const host of hosts) {
    for (const p of GUESS_PATHS) {
      const url = `https://${host}${p}`;
      const res = await request(url);
      tried.push({ url, method: 'GET', status: res.status ?? `error: ${res.error}` });
      if (res.ok) {
        const v = await validateCandidate(url, lockedKeys);
        tried.push({ url, method: 'GET (validate)', status: v.error ? `load error: ${v.error}` : 'loaded' });
        if (v.verdict === 'found') return { result: 'found', winningUrl: url, overlap: v.overlap, tried, requestCount: tried.length };
        if (v.verdict === 'wrong_spec' && !tried.wrongSpecSeen) {
          tried.wrongSpecSeen = { url, overlap: v.overlap };
        }
      }
    }
    if (seg) {
      for (const p of GUESS_PATHS) {
        const url = `https://${host}/${seg}${p}`;
        const res = await request(url);
        tried.push({ url, method: 'GET', status: res.status ?? `error: ${res.error}` });
        if (res.ok) {
          const v = await validateCandidate(url, lockedKeys);
          tried.push({ url, method: 'GET (validate)', status: v.error ? `load error: ${v.error}` : 'loaded' });
          if (v.verdict === 'found') return { result: 'found', winningUrl: url, overlap: v.overlap, tried, requestCount: tried.length };
          if (v.verdict === 'wrong_spec' && !tried.wrongSpecSeen) {
            tried.wrongSpecSeen = { url, overlap: v.overlap };
          }
        }
      }
    }
  }
  if (tried.wrongSpecSeen) {
    return { result: 'wrong_spec', winningUrl: tried.wrongSpecSeen.url, overlap: tried.wrongSpecSeen.overlap, tried, requestCount: tried.length };
  }
  return { result: 'not_found', winningUrl: null, overlap: 0, tried, requestCount: tried.length };
}

// ---------------------------------------------------------------------
// Strategy D — APIs.guru
// ---------------------------------------------------------------------
async function loadApisGuruList() {
  if (existsSync(APIS_GURU_CACHE)) {
    return JSON.parse(readFileSync(APIS_GURU_CACHE, 'utf8'));
  }
  const res = await request('https://api.apis.guru/v2/list.json');
  if (!res.ok || !res.text) {
    throw new Error(`could not fetch apis.guru list.json: status ${res.status}, error ${res.error}`);
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(APIS_GURU_CACHE, res.text);
  return JSON.parse(res.text);
}

async function strategyD(registrable, lockedKeys, sharedListPromise) {
  const tried = [];
  let list;
  try {
    list = await sharedListPromise;
  } catch (err) {
    tried.push({ url: 'https://api.apis.guru/v2/list.json', method: 'GET', status: `error: ${err.message}` });
    return { result: 'not_found', winningUrl: null, overlap: 0, tried, requestCount: tried.length };
  }
  tried.push({ url: 'https://api.apis.guru/v2/list.json', method: 'GET (cached/shared)', status: 'ok' });

  const matches = [];
  for (const [key, entry] of Object.entries(list)) {
    const providerName = entry.versions && entry.preferred
      ? entry.versions[entry.preferred]?.info?.['x-providerName']
      : undefined;
    if (key.toLowerCase().includes(registrable.toLowerCase()) || (providerName && providerName.toLowerCase() === registrable.toLowerCase())) {
      matches.push(entry);
    }
  }
  for (const entry of matches) {
    const preferred = entry.versions?.[entry.preferred];
    const specUrl = preferred?.swaggerUrl || preferred?.swaggerYamlUrl;
    if (!specUrl) continue;
    const v = await validateCandidate(specUrl, lockedKeys);
    tried.push({ url: specUrl, method: 'GET (validate)', status: v.error ? `load error: ${v.error}` : 'loaded' });
    if (v.verdict === 'found') return { result: 'found', winningUrl: specUrl, overlap: v.overlap, tried, requestCount: tried.length };
    if (v.verdict === 'wrong_spec') return { result: 'wrong_spec', winningUrl: specUrl, overlap: v.overlap, tried, requestCount: tried.length };
  }
  return { result: 'not_found', winningUrl: null, overlap: 0, tried, requestCount: tried.length };
}

// ---------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------
export async function probeVendor(vendorRow, sharedListPromise) {
  const { vendor, host, raw } = vendorRow;
  if (!host) {
    return { vendor, skipped: true, reason: 'no derivable host' };
  }
  const registrable = registrableDomain(host);
  const { doc } = await enqueue(() => loadSpec(vendorRow.specPath, { timeoutMs: TIMEOUT_MS }));
  const lockedKeys = opKeys(operationsFrom(doc));

  const [a, b, c, d] = [
    await strategyA(host, registrable, lockedKeys),
    await strategyB(host, registrable, lockedKeys),
    await strategyC(host, registrable, raw, lockedKeys),
    await strategyD(registrable, lockedKeys, sharedListPromise),
  ];

  return {
    vendor,
    host,
    registrable,
    lockedOpCount: lockedKeys.size,
    strategies: { A: a, B: b, C: c, D: d },
  };
}

export async function probeVendors(vendors) {
  const sharedListPromise = loadApisGuruList();
  const out = [];
  for (const v of vendors) {
    out.push(await probeVendor(v, sharedListPromise));
  }
  return out;
}

function summarize(report) {
  const lines = [];
  lines.push(`${report.vendor}  host=${report.host}  registrable=${report.registrable}  locked-ops=${report.lockedOpCount}`);
  for (const [name, s] of Object.entries(report.strategies)) {
    lines.push(`  ${name}: ${s.result}${s.winningUrl ? ` -> ${s.winningUrl} (overlap ${(s.overlap * 100).toFixed(0)}%)` : ''} [${s.requestCount} requests]`);
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2);
  const all = await collectVendorRows();
  const vendors = only.length > 0 ? all.filter((v) => only.includes(v.vendor)) : all;
  const reports = await probeVendors(vendors);
  for (const r of reports) {
    console.log(summarize(r));
    console.log('');
  }
  console.log(`total requests: ${totalRequests}`);
}
