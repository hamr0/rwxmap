// Pass 1 of item b (spec discovery), step 3 — probe.mjs (pass 3 adds E, F).
//
// For each vendor derived by vendors.mjs, run independent discovery
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
// E. Docs page links: GET the HTML root of `docs./developer./developers.
//    <domain>` and the API host (if it answers with HTML), scan the text
//    with a small regex/attribute scanner (CLAUDE.md: no HTML-parser
//    dependency for a POC) for href/src attributes, Swagger UI's inline
//    `url:` config, Redoc's `spec-url=`/`Redoc.init(...)`, and Stoplight/
//    Scalar/RapiDoc's `apiDescriptionUrl=`/`data-url=`. A hit is kept only
//    if its URL contains openapi/swagger/api-docs/apispec or ends in
//    .json/.yaml/.yml; kept hits are followed one level deep, capped at 10
//    per vendor, in page order.
// F. Sitemap: GET `/sitemap.xml` on the same hosts as E; a sitemap index
//    is expanded into at most 3 child sitemaps; `<loc>` entries pass
//    through the same URL-shape filter as E, capped at 10 per vendor.
//
// A candidate is FOUND only when it loads (loadSpec) AND its operations
// overlap the locked spec's (METHOD, path) keys at >= 0.5 share. Below
// that, but still loadable, it is WRONG_SPEC. Anything that never loads
// is NOT_FOUND for that strategy. Every found/wrong_spec candidate, in
// every strategy, also gets a `hostCheck`: does any host the candidate
// spec itself declares (servers[].url resolved, or Swagger 2 `host`)
// equal the vendor's API host or share its registrable domain? This is
// the check production could run without ever consulting a locked spec.
//
// `--only=E,F` on the CLI runs only the named strategies (skipping their
// network calls entirely, not just hiding them from the summary); any
// other bare argument is still a vendor-name filter, as before.

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
 * @returns {Promise<{verdict: 'found'|'wrong_spec'|'not_found', overlap: number, error: string|null, doc: any}>}
 */
async function validateCandidate(candidateUrl, lockedKeys) {
  let loaded;
  try {
    loaded = await enqueue(() => loadSpec(candidateUrl, { timeoutMs: TIMEOUT_MS }));
    totalRequests += 1; // loadSpec makes its own fetch
  } catch (err) {
    return { verdict: 'not_found', overlap: 0, error: err instanceof Error ? err.message : String(err), doc: null };
  }
  const ops = operationsFrom(loaded.doc);
  const candidateKeys = opKeys(ops);
  let hits = 0;
  for (const k of lockedKeys) {
    if (candidateKeys.has(k)) hits += 1;
  }
  const overlap = lockedKeys.size > 0 ? hits / lockedKeys.size : 0;
  return { verdict: overlap >= OVERLAP_THRESHOLD ? 'found' : 'wrong_spec', overlap, error: null, doc: loaded.doc };
}

// ---------------------------------------------------------------------
// hostCheck — the production-shaped check: does any host the candidate
// spec itself declares (OpenAPI 3 `servers[].url`, variables resolved to
// their defaults; or Swagger 2 `host`) equal the vendor's API host, or
// share its registrable domain? Reported next to overlap for every
// found/wrong_spec candidate in every strategy, so the orchestrator can
// see whether hostCheck alone would have separated found from wrong_spec
// without ever consulting the locked spec (which production doesn't have).
// ---------------------------------------------------------------------
function specHosts(doc) {
  const hosts = [];
  if (Array.isArray(doc?.servers)) {
    for (const server of doc.servers) {
      if (!server || typeof server.url !== 'string') continue;
      let url = server.url;
      const vars = server.variables || {};
      for (const [name, v] of Object.entries(vars)) {
        if (v && typeof v.default === 'string') url = url.split(`{${name}}`).join(v.default);
      }
      const withScheme = /^https?:\/\//i.test(url)
        ? url
        : url.startsWith('//')
          ? `https:${url}`
          : `https://${url.replace(/^\/+/, '')}`;
      try {
        hosts.push(new URL(withScheme).host.toLowerCase());
      } catch {
        // unresolvable server URL template; skip it, don't guess.
      }
    }
  } else if (typeof doc?.host === 'string' && doc.host) {
    hosts.push(doc.host.toLowerCase());
  }
  return hosts;
}

function hostCheckFor(doc, apiHost, registrable) {
  const hosts = specHosts(doc);
  if (hosts.length === 0) return false;
  const apiHostLower = apiHost.toLowerCase();
  for (const h of hosts) {
    const hostNoPort = h.split(':')[0];
    if (hostNoPort === apiHostLower) return true;
    if (registrableDomain(hostNoPort) === registrable) return true;
  }
  return false;
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
      const hostCheck = v.doc ? hostCheckFor(v.doc, apiHost, registrable) : false;
      tried.push({ url: href, method: 'GET (followed service-desc)', status: v.error ? `load error: ${v.error}` : 'loaded', overlap: v.overlap, hostCheck });
      if (v.verdict === 'found') {
        return { result: 'found', winningUrl: href, overlap: v.overlap, hostCheck, tried, requestCount: tried.length };
      }
      if (v.verdict === 'wrong_spec') {
        return { result: 'wrong_spec', winningUrl: href, overlap: v.overlap, hostCheck, tried, requestCount: tried.length };
      }
    }
  }
  return { result: 'not_found', winningUrl: null, overlap: 0, hostCheck: null, tried, requestCount: tried.length };
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
      const hostCheck = v.doc ? hostCheckFor(v.doc, apiHost, registrable) : false;
      tried.push({ url: href, method: 'GET (followed service-desc)', status: v.error ? `load error: ${v.error}` : 'loaded', overlap: v.overlap, hostCheck });
      if (v.verdict === 'found') {
        return { result: 'found', winningUrl: href, overlap: v.overlap, hostCheck, tried, requestCount: tried.length };
      }
      if (v.verdict === 'wrong_spec') {
        return { result: 'wrong_spec', winningUrl: href, overlap: v.overlap, hostCheck, tried, requestCount: tried.length };
      }
    }
  }
  return { result: 'not_found', winningUrl: null, overlap: 0, hostCheck: null, tried, requestCount: tried.length };
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
        const hostCheck = v.doc ? hostCheckFor(v.doc, apiHost, registrable) : false;
        tried.push({ url, method: 'GET (validate)', status: v.error ? `load error: ${v.error}` : 'loaded', overlap: v.overlap, hostCheck });
        if (v.verdict === 'found') return { result: 'found', winningUrl: url, overlap: v.overlap, hostCheck, tried, requestCount: tried.length };
        if (v.verdict === 'wrong_spec' && !tried.wrongSpecSeen) {
          tried.wrongSpecSeen = { url, overlap: v.overlap, hostCheck };
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
          const hostCheck = v.doc ? hostCheckFor(v.doc, apiHost, registrable) : false;
          tried.push({ url, method: 'GET (validate)', status: v.error ? `load error: ${v.error}` : 'loaded', overlap: v.overlap, hostCheck });
          if (v.verdict === 'found') return { result: 'found', winningUrl: url, overlap: v.overlap, hostCheck, tried, requestCount: tried.length };
          if (v.verdict === 'wrong_spec' && !tried.wrongSpecSeen) {
            tried.wrongSpecSeen = { url, overlap: v.overlap, hostCheck };
          }
        }
      }
    }
  }
  if (tried.wrongSpecSeen) {
    return { result: 'wrong_spec', winningUrl: tried.wrongSpecSeen.url, overlap: tried.wrongSpecSeen.overlap, hostCheck: tried.wrongSpecSeen.hostCheck, tried, requestCount: tried.length };
  }
  return { result: 'not_found', winningUrl: null, overlap: 0, hostCheck: null, tried, requestCount: tried.length };
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

async function strategyD(apiHost, registrable, lockedKeys, sharedListPromise) {
  const tried = [];
  let list;
  try {
    list = await sharedListPromise;
  } catch (err) {
    tried.push({ url: 'https://api.apis.guru/v2/list.json', method: 'GET', status: `error: ${err.message}` });
    return { result: 'not_found', winningUrl: null, overlap: 0, hostCheck: null, tried, requestCount: tried.length };
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
    const hostCheck = v.doc ? hostCheckFor(v.doc, apiHost, registrable) : false;
    tried.push({ url: specUrl, method: 'GET (validate)', status: v.error ? `load error: ${v.error}` : 'loaded', overlap: v.overlap, hostCheck });
    if (v.verdict === 'found') return { result: 'found', winningUrl: specUrl, overlap: v.overlap, hostCheck, tried, requestCount: tried.length };
    if (v.verdict === 'wrong_spec') return { result: 'wrong_spec', winningUrl: specUrl, overlap: v.overlap, hostCheck, tried, requestCount: tried.length };
  }
  return { result: 'not_found', winningUrl: null, overlap: 0, hostCheck: null, tried, requestCount: tried.length };
}

// ---------------------------------------------------------------------
// Strategy E — docs page links
// ---------------------------------------------------------------------
// Regexes over the raw HTML text, run independently and then merged in
// order of first match position, so "in page order" means what it says
// without needing a full HTML parser (CLAUDE.md: no HTML-parser
// dependency for this POC, a documented regex/attribute scanner is fine).
//
//   1. any href="..."/src="..." attribute (covers <a>, <link>, <script src>,
//      including <link rel="service-desc">, whose rel we don't need to
//      check separately because the URL-shape filter below does the work).
//   2. Swagger UI's inline config: `url: "..."` (also matches `urls: [{
//      url: "..." }]` and `SwaggerUIBundle({ url: ... })`, since all three
//      contain a bare `url: "<string>"` token).
//   3. Redoc's `spec-url="..."` attribute.
//   4. Redoc's `Redoc.init('...')` call.
//   5. Stoplight/Scalar/RapiDoc's `apiDescriptionUrl="..."` / `data-url="..."`.
const DOCS_PAGE_PATTERNS = [
  /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi,
  /\burl\s*:\s*["']([^"']+)["']/gi,
  /spec-url\s*=\s*["']([^"']+)["']/gi,
  /Redoc\.init\(\s*["']([^"']+)["']/gi,
  /(?:apiDescriptionUrl|data-url)\s*=\s*["']([^"']+)["']/gi,
];

function extractPageCandidates(html, pageUrl) {
  const found = [];
  for (const re of DOCS_PAGE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html))) {
      found.push({ index: m.index, raw: m[1] });
    }
  }
  found.sort((a, b) => a.index - b.index);
  const seen = new Set();
  const out = [];
  for (const { raw } of found) {
    let resolved;
    try {
      resolved = new URL(raw.trim(), pageUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

// The candidate URL-shape filter shared by strategies E and F: kept only
// if it looks like it names a spec, never followed just because it's a
// link on the page.
function isCandidateSpecUrl(url) {
  const lower = url.toLowerCase();
  if (/(openapi|swagger|api-docs|apispec)/.test(lower)) return true;
  if (/\.(json|ya?ml)(?:[?#]|$)/.test(lower)) return true;
  return false;
}

function looksHtml(res) {
  const ct = res.headers ? res.headers.get('content-type') : null;
  if (ct) return /html/i.test(ct);
  return !!(res.text && /<html[\s>]/i.test(res.text));
}

async function strategyE(apiHost, registrable, lockedKeys) {
  const tried = [];
  const hosts = [`docs.${registrable}`, `developer.${registrable}`, `developers.${registrable}`, apiHost];
  const pages = [];
  for (const host of hosts) {
    const url = `https://${host}/`;
    const res = await request(url);
    tried.push({ url, method: 'GET', status: res.status ?? `error: ${res.error}` });
    if (res.ok && res.text && looksHtml(res)) pages.push({ url, text: res.text });
  }

  const candidates = [];
  for (const page of pages) {
    for (const u of extractPageCandidates(page.text, page.url)) {
      if (isCandidateSpecUrl(u)) candidates.push(u);
    }
  }
  const capped = candidates.slice(0, 10); // per vendor, in page order

  let wrongSpecSeen = null;
  for (const url of capped) {
    const v = await validateCandidate(url, lockedKeys);
    const hostCheck = v.doc ? hostCheckFor(v.doc, apiHost, registrable) : false;
    tried.push({ url, method: 'GET (validate, docs-page candidate)', status: v.error ? `load error: ${v.error}` : 'loaded', overlap: v.overlap, hostCheck });
    if (v.verdict === 'found') return { result: 'found', winningUrl: url, overlap: v.overlap, hostCheck, tried, requestCount: tried.length };
    if (v.verdict === 'wrong_spec' && !wrongSpecSeen) wrongSpecSeen = { url, overlap: v.overlap, hostCheck };
  }
  if (wrongSpecSeen) {
    return { result: 'wrong_spec', winningUrl: wrongSpecSeen.url, overlap: wrongSpecSeen.overlap, hostCheck: wrongSpecSeen.hostCheck, tried, requestCount: tried.length };
  }
  return { result: 'not_found', winningUrl: null, overlap: 0, hostCheck: null, tried, requestCount: tried.length };
}

// ---------------------------------------------------------------------
// Strategy F — sitemap
// ---------------------------------------------------------------------
function extractLocs(xmlText) {
  const out = [];
  for (const m of xmlText.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    out.push(m[1].trim());
  }
  return out;
}

async function strategyF(apiHost, registrable, lockedKeys) {
  const tried = [];
  const hosts = [apiHost, `docs.${registrable}`, `developer.${registrable}`, `developers.${registrable}`];
  const candidateUrls = [];

  for (const host of hosts) {
    const url = `https://${host}/sitemap.xml`;
    const res = await request(url);
    tried.push({ url, method: 'GET', status: res.status ?? `error: ${res.error}` });
    if (!res.ok || !res.text) continue;
    const isIndex = /<sitemapindex[\s>]/i.test(res.text);
    if (isIndex) {
      const childUrls = extractLocs(res.text).slice(0, 3); // at most 3 child sitemaps
      for (const childUrl of childUrls) {
        const childRes = await request(childUrl);
        tried.push({ url: childUrl, method: 'GET (child sitemap)', status: childRes.status ?? `error: ${childRes.error}` });
        if (childRes.ok && childRes.text) candidateUrls.push(...extractLocs(childRes.text));
      }
    } else {
      candidateUrls.push(...extractLocs(res.text));
    }
  }

  const capped = candidateUrls.filter(isCandidateSpecUrl).slice(0, 10); // per vendor

  let wrongSpecSeen = null;
  for (const url of capped) {
    const v = await validateCandidate(url, lockedKeys);
    const hostCheck = v.doc ? hostCheckFor(v.doc, apiHost, registrable) : false;
    tried.push({ url, method: 'GET (validate, sitemap candidate)', status: v.error ? `load error: ${v.error}` : 'loaded', overlap: v.overlap, hostCheck });
    if (v.verdict === 'found') return { result: 'found', winningUrl: url, overlap: v.overlap, hostCheck, tried, requestCount: tried.length };
    if (v.verdict === 'wrong_spec' && !wrongSpecSeen) wrongSpecSeen = { url, overlap: v.overlap, hostCheck };
  }
  if (wrongSpecSeen) {
    return { result: 'wrong_spec', winningUrl: wrongSpecSeen.url, overlap: wrongSpecSeen.overlap, hostCheck: wrongSpecSeen.hostCheck, tried, requestCount: tried.length };
  }
  return { result: 'not_found', winningUrl: null, overlap: 0, hostCheck: null, tried, requestCount: tried.length };
}

// ---------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------
export async function probeVendor(vendorRow, sharedListPromise, strategyFilter = null) {
  const { vendor, host, raw } = vendorRow;
  if (!host) {
    return { vendor, skipped: true, reason: 'no derivable host' };
  }
  const registrable = registrableDomain(host);
  const { doc } = await enqueue(() => loadSpec(vendorRow.specPath, { timeoutMs: TIMEOUT_MS }));
  const lockedKeys = opKeys(operationsFrom(doc));

  const want = (letter) => !strategyFilter || strategyFilter.includes(letter);
  const strategies = {};
  if (want('A')) strategies.A = await strategyA(host, registrable, lockedKeys);
  if (want('B')) strategies.B = await strategyB(host, registrable, lockedKeys);
  if (want('C')) strategies.C = await strategyC(host, registrable, raw, lockedKeys);
  if (want('D')) strategies.D = await strategyD(host, registrable, lockedKeys, sharedListPromise);
  if (want('E')) strategies.E = await strategyE(host, registrable, lockedKeys);
  if (want('F')) strategies.F = await strategyF(host, registrable, lockedKeys);

  return {
    vendor,
    host,
    registrable,
    lockedOpCount: lockedKeys.size,
    strategies,
  };
}

export async function probeVendors(vendors, strategyFilter = null) {
  // Only pay for apis.guru's list.json when strategy D is actually wanted
  // (e.g. a --only=E,F dry run shouldn't fetch it at all).
  const needsD = !strategyFilter || strategyFilter.includes('D');
  const sharedListPromise = needsD ? loadApisGuruList() : Promise.resolve({});
  const out = [];
  for (const v of vendors) {
    out.push(await probeVendor(v, sharedListPromise, strategyFilter));
  }
  return out;
}

function summarize(report) {
  const lines = [];
  lines.push(`${report.vendor}  host=${report.host}  registrable=${report.registrable}  locked-ops=${report.lockedOpCount}`);
  for (const [name, s] of Object.entries(report.strategies)) {
    lines.push(`  ${name}: ${s.result}${s.winningUrl ? ` -> ${s.winningUrl} (overlap ${(s.overlap * 100).toFixed(0)}%, hostCheck=${s.hostCheck})` : ''} [${s.requestCount} requests]`);
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rawArgs = process.argv.slice(2);
  const onlyArg = rawArgs.find((a) => a.startsWith('--only='));
  const strategyFilter = onlyArg
    ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;
  const vendorArgs = rawArgs.filter((a) => !a.startsWith('--only='));
  const all = await collectVendorRows();
  const vendors = vendorArgs.length > 0 ? all.filter((v) => vendorArgs.includes(v.vendor)) : all;
  const reports = await probeVendors(vendors, strategyFilter);
  for (const r of reports) {
    console.log(summarize(r));
    console.log('');
  }
  console.log(`total requests: ${totalRequests}`);
}
