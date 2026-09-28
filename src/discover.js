// Spec discovery (D105/D108) — turns an API's base URL into a loaded
// OpenAPI/Swagger document (if one can be found) and a way to classify a
// live HTTP call against it, with a 30-day on-disk cache so the same host
// is not re-probed every run.
//
// SHIPPED AS THE SUBPATH EXPORT `rwxmap/discover` (D107's pattern), NOT
// re-exported from src/index.js: `import 'rwxmap'` must stay
// dependency-free and offline (no fetch, no yaml), and this file both
// fetches (global fetch) and loads yaml (via load.js). See load.js's own
// header for the same rule applied to `rwxmap/load`.
//
// D108's discovery order:
//   (1) opts.spec (a URL or file path) — load only that, nothing else
//       tried, cached under its own address (see CACHE below).
//   (2) the 30-day cache, keyed by host (or by opts.spec's address),
//       including a cached "none".
//   (3) RFC 9727 `/.well-known/api-catalog` on each HOST CANDIDATE.
//   (4) RFC 8631 `Link: rel="service-desc"` on `/` of each HOST
//       CANDIDATE (HEAD, falling back to GET when HEAD is refused).
//   (5) the fixed GUESS_PATHS (copied from poc/discover/probe.mjs's
//       strategy C — src/ never imports from poc/, so this list is data,
//       duplicated on purpose, not shared code) on the API host and on
//       docs./developer./developers. of the two-label parent.
//   (6) none found → status 'none', cached.
// Steps 3-5 stop at the first candidate that both loads (loadSpec) AND
// yields at least one operation (operationsFrom).
//
// HOST CANDIDATES (steps 3-4 only): the API host, then walk up one label
// at a time, stopping at two labels — e.g.
// api-m.sandbox.paypal.com -> sandbox.paypal.com -> paypal.com. No public
// suffix list (user ruling, 2026-09-27): a probe of this walk-up against
// the 25 discovery-POC vendor hosts passed through the right parent on 25
// of 25, where dropping only the first label (what a suffix list would
// approximate without one) was wrong for 2 of them (mailchimp, paypal).
//
// SAFETY (orchestrator's call, flagged for review): steps 3-5 never run
// for a non-https apiUrl, an IP-literal host (v4 or v6), `localhost`, or a
// single-label host — those return status 'none' with a reason,
// UNCACHED. opts.spec is exempt (the caller chose that address
// explicitly). An apiUrl that doesn't even parse as a URL is treated the
// same way (status 'none', reason, uncached) rather than thrown, since
// this is a discovery *attempt* the caller can retry with better input,
// not a hard programming error.
//
// POLITENESS: every discovery-related request (the catalog/Link-header
// probes AND the final loadSpec call that reads the winning candidate)
// goes one at a time, 10s timeout, no retry, User-Agent
// `rwxmap/<package version>`. Only global fetch is used; tests stub
// globalThis.fetch and restore it — there is deliberately no `fetch`
// option here to stub around.
//
// LIMITS (user ruling 2026-09-28, from data/discover-live-2026-09-28 and
// data/discover-limits-2026-09-28): discovery cost a median of 97
// requests/site; zoom alone cost 464 requests / 489s chasing every one of
// the ~50 doc-page links its own api-catalog listed. Across 21 real
// finds, GUESS_PATHS (step 5) only ever found /openapi.json, /openapi.yaml
// or /swagger.json; api-catalog/Link (steps 3-4) found 6 (incl.
// intercom). Three limits follow, each a module constant near its use:
// GUESS_PATHS shrunk to those 3 paths, MAX_SERVICE_DESC_HREFS caps how
// many service-desc hrefs one catalog/Link response can offer, and
// DISCOVERY_BUDGET_MS caps steps 3-5's wall-clock time so a zoom-shaped
// site is not retried every run — it's cached as a "none" like any other.
//
// CACHE (D105 item 2): one JSON file per cache key under
// `opts.cacheDir ?? $XDG_CACHE_HOME/rwxmap ?? ~/.cache/rwxmap`, named by
// the sha256 of the key (the API host, or opts.spec's address when
// given). Valid for 30 days AND the same rwxmap package version;
// otherwise a miss, same as an unreadable/corrupt file. Writes are
// atomic (temp file + rename) and a write failure never fails the call —
// the result is still returned, with `cached: false`. KNOWN
// SIMPLIFICATION (D105 item 2, noted here since this pass does not build
// it): there is no hash-based reuse across an expired entry — a miss just
// rediscovers and reclassifies from scratch, which is cheap because
// mechanical classification is cheap; only the network round trips are
// what the cache is saving.
//
// Dependency rule (CLAUDE.md): vanilla Node 22 ESM + global fetch +
// node:fs/path/os/crypto. Imports from ./load.js, ./index.js (exporter
// exports) and ./key.js/./match.js/./flow.js — all already in src/, none
// of them poc/ or tools/. classifyRow (flow.js) and the other D87-ladder
// files are read here but never modified by this file.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { loadSpec } from './load.js';
import { operationsFrom, exportGate, gateKey } from './exporter.js';
import { requestKey } from './key.js';
import { matchOperation } from './match.js';
import { classifyRow } from './flow.js';

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./exporter.js').GateEntry} GateEntry */

export { requestKey };

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 1 * 1024 * 1024;

// LIMIT 1 (user ruling 2026-09-28): of 21 real finds, guessed paths only
// ever found these 3 — shrunk from the poc's 14-path list.
const GUESS_PATHS = [
  '/openapi.json',
  '/openapi.yaml',
  '/swagger.json',
];

// LIMIT 2 (user ruling 2026-09-28): zoom's own api-catalog listed ~50
// doc-page hrefs, all tried (464 requests); cap at the first 3, in
// document order, from any one catalog/Link response.
const MAX_SERVICE_DESC_HREFS = 3;

// LIMIT 3 (user ruling 2026-09-28): median site costs 97 requests but
// zoom cost 464/489s — a 60s wall-clock budget for findSpec's steps 3-5
// bounds that tail; a run that hits it is cached as 'none' like any other.
const DISCOVERY_BUDGET_MS = 60_000;

/**
 * @param {number|undefined} deadline  `Date.now()`-comparable epoch ms, or
 *   undefined for "no budget" (never set outside steps 3-5's call chain —
 *   opts.spec's own load never threads a deadline through).
 * @returns {boolean}
 */
function budgetExceeded(deadline) {
  return deadline !== undefined && Date.now() >= deadline;
}

let cachedVersion;
/**
 * @returns {string}
 */
function packageVersion() {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgUrl, 'utf8'));
    cachedVersion = typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

// ---------------------------------------------------------------------
// One-at-a-time politeness queue — every fetch in this file passes
// through here, host-independent, so discovery never has two requests in
// flight at once (same shape as poc/discover/probe.mjs's queue).
// ---------------------------------------------------------------------

let queueTail = Promise.resolve();
/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
function enqueue(fn) {
  const run = queueTail.then(fn, fn);
  queueTail = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * Read a response body capped at MAX_BODY_BYTES. Streams and counts when
 * the runtime hands back a real body reader (the normal case); falls back
 * to `res.text()` plus a post-hoc length check when it doesn't (some
 * test stubs, mirroring load.js's own `!res.body` fallback) — a slightly
 * weaker cap in that one fallback path, since the whole body is already
 * in memory by the time it's measured, but it is never returned past the
 * cap either way.
 *
 * @param {Response} res
 * @returns {Promise<string|null>}  null means "over the cap — treat as
 *   no result", per the orchestrator's fix #2.
 */
async function readBodyCapped(res) {
  if (!res.body) {
    let text;
    try {
      text = await res.text();
    } catch {
      return null;
    }
    return Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES ? null : text;
  }
  const reader = res.body.getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BODY_BYTES) return null;
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    try { reader.cancel(); } catch { /* already done or errored */ }
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

/**
 * A single hop's raw request — `redirect: 'manual'` always, so a 3xx
 * response comes back as a real, inspectable response (Node's fetch does
 * not apply the browser's CORS opaqueredirect restriction to a same-
 * process fetch) rather than being silently followed. Callers walk the
 * chain themselves via politeFetch, checking `unsafeReason` before every
 * hop, including this first one.
 *
 * @param {string} url
 * @param {{method?: string, userAgent: string}} opts
 * @returns {Promise<{status: number|null, headers: Headers|null, error: string|null, response: Response|null}>}
 */
async function rawHop(url, opts) {
  try {
    const response = await fetch(url, {
      method: opts.method || 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': opts.userAgent },
    });
    return { status: response.status, headers: response.headers, error: null, response };
  } catch (err) {
    return { status: null, headers: null, error: err instanceof Error ? err.message : String(err), response: null };
  }
}

/**
 * Politely fetch a URL, walking any redirect chain ITSELF (never
 * `redirect: 'follow'`) so every hop — including the first URL — passes
 * `unsafeReason` before a request is ever made to it. Capped at
 * MAX_REDIRECTS hops and, for a body-bearing response, MAX_BODY_BYTES
 * (orchestrator fixes #1/#2).
 *
 * @param {string} url
 * @param {{method?: string, userAgent: string, deadline?: number}} opts
 * @returns {Promise<{ok: boolean, status: number|null, headers: Headers|null, text: string|null, error: string|null}>}
 */
function politeFetch(url, opts) {
  return enqueue(async () => {
    let current = url;
    for (let hop = 0; ; hop++) {
      if (budgetExceeded(opts.deadline)) return { ok: false, status: null, headers: null, text: null, error: 'time budget exhausted' };
      const { reason } = unsafeReason(current);
      if (reason) return { ok: false, status: null, headers: null, text: null, error: `unsafe URL (${reason}): ${current}` };
      if (hop > MAX_REDIRECTS) return { ok: false, status: null, headers: null, text: null, error: `too many redirects (> ${MAX_REDIRECTS})` };

      const hopResult = await rawHop(current, opts);
      if (hopResult.error || !hopResult.response) {
        return { ok: false, status: hopResult.status, headers: hopResult.headers, text: null, error: hopResult.error };
      }
      const { response } = hopResult;
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return { ok: false, status: response.status, headers: response.headers, text: null, error: 'redirect with no Location header' };
        try {
          current = new URL(location, current).toString();
        } catch {
          return { ok: false, status: response.status, headers: response.headers, text: null, error: `redirect Location does not parse: ${location}` };
        }
        continue; // loop: the new `current` is safety-checked at the top before it is ever requested
      }

      /** @type {string|null} */
      let text = null;
      if (opts.method !== 'HEAD' && response.status >= 200 && response.status < 300) {
        text = await readBodyCapped(response);
      }
      return { ok: response.ok, status: response.status, headers: response.headers, text, error: null };
    }
  });
}

/**
 * Resolve a candidate spec URL to a final, safety-checked URL by walking
 * any redirect chain with a cheap HEAD (falling back to GET, same
 * fallback rule as step 4) — WITHOUT reading the body, so this works
 * regardless of how large the eventual spec is (unlike politeFetch's own
 * MAX_BODY_BYTES cap, which is for metadata probes, not spec bodies).
 * Returns null when any hop is unsafe, errors, too many hops, or the
 * final response isn't a plain 2xx.
 *
 * @param {string} url
 * @param {string} userAgent
 * @param {number} [deadline]
 * @returns {Promise<string|null>}
 */
async function resolveSafeCandidateUrl(url, userAgent, deadline) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (budgetExceeded(deadline)) return null;
    const { reason } = unsafeReason(current);
    if (reason) return null;

    let hopResult = await enqueue(() => rawHop(current, { method: 'HEAD', userAgent }));
    const headRefused = hopResult.error || hopResult.status === null || hopResult.status === 405 || (hopResult.status !== null && hopResult.status >= 500);
    if (headRefused) {
      if (budgetExceeded(deadline)) return null;
      hopResult = await enqueue(() => rawHop(current, { method: 'GET', userAgent }));
      // Discard the body deliberately: this pass only resolves the URL,
      // it never reads or caps a spec body — loadSpec does that, once,
      // against the final URL this function returns.
      if (hopResult.response && hopResult.response.body) {
        try { await hopResult.response.body.cancel(); } catch { /* best effort */ }
      }
    }
    if (hopResult.error || !hopResult.response) return null;
    const { response } = hopResult;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      try {
        current = new URL(location, current).toString();
      } catch {
        return null;
      }
      continue;
    }
    if (response.status >= 200 && response.status < 300) return current;
    return null;
  }
  return null; // too many hops
}

/**
 * Load a candidate spec URL through the same politeness queue, and reject
 * it (return null) unless it both parses AND yields at least one
 * operation. Every hop between here and the winning bytes — the redirect
 * chain AND the final fetch — is safety-checked (orchestrator fix #1):
 * resolveSafeCandidateUrl walks and approves the chain first, and the
 * final loadSpec call is itself given `redirect: 'manual'` so a
 * still-redirecting response (a TOCTOU race, not the common case) throws
 * rather than being silently followed.
 *
 * @param {string} url
 * @param {string} userAgent
 * @param {number} [deadline]
 * @returns {Promise<{specUrl: string, loaded: import('./load.js').LoadResult, ops: Operation[]} | null>}
 */
async function tryLoadCandidate(url, userAgent, deadline) {
  if (budgetExceeded(deadline)) return null;
  const safeUrl = await resolveSafeCandidateUrl(url, userAgent, deadline);
  if (!safeUrl) return null;
  if (budgetExceeded(deadline)) return null;

  let loaded;
  try {
    loaded = await enqueue(() => loadSpec(safeUrl, { timeoutMs: TIMEOUT_MS, headers: { 'User-Agent': userAgent }, redirect: 'manual' }));
  } catch {
    return null;
  }
  const ops = operationsFrom(loaded.doc);
  if (ops.length === 0) return null;
  return { specUrl: safeUrl, loaded, ops };
}

// ---------------------------------------------------------------------
// Host candidates — walk up one label at a time, stopping at two labels.
// No public suffix list (see header comment / user ruling 2026-09-27).
// ---------------------------------------------------------------------

/**
 * @param {string} host
 * @returns {string[]}  Full host first, then each parent, down to (and
 *   including) the two-label parent. A 2-label host returns itself only.
 */
function hostCandidates(host) {
  const labels = host.split('.');
  /** @type {string[]} */
  const out = [];
  for (let n = labels.length; n >= 2; n--) {
    out.push(labels.slice(labels.length - n).join('.'));
  }
  return out;
}

// ---------------------------------------------------------------------
// Safety gate
// ---------------------------------------------------------------------

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * @param {string} hostname  `URL#hostname` — an IPv6 literal keeps its
 *   brackets there (e.g. "[::1]").
 * @returns {boolean}
 */
function isIpLiteral(hostname) {
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true;
  return IPV4_RE.test(hostname);
}

/**
 * THE ONE CHECK, used both for the top-level apiUrl (via checkSafety
 * below) and for EVERY hop of EVERY discovery-related request: a
 * redirect Location header (politeFetch's own manual redirect loop) and
 * a service-desc href pulled from a catalog/Link response
 * (resolveSafeCandidateUrl, before tryLoadCandidate ever fetches it).
 * Orchestrator-flagged fix: a candidate that starts safe can still
 * redirect to `http://`, an IP literal, or localhost, and a
 * catalog/Link response can point anywhere at all — both are requests
 * this file is about to make, so both go through this same gate, not
 * just the URL the caller supplied.
 *
 * @param {string} urlString
 * @returns {{host: string|null, reason: string|null}}
 */
function unsafeReason(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return { host: null, reason: 'does not parse as a URL' };
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:') return { host, reason: 'not https' };
  if (host === 'localhost') return { host, reason: 'localhost' };
  if (isIpLiteral(host)) return { host, reason: 'IP-literal host' };
  if (!host.includes('.')) return { host, reason: 'single-label host' };
  return { host, reason: null };
}

/**
 * @param {string} apiUrl
 * @returns {{host: string|null, reason: string|null}}  `reason` non-null
 *   means steps 3-5 must not run for this apiUrl.
 */
function checkSafety(apiUrl) {
  return unsafeReason(apiUrl);
}

// ---------------------------------------------------------------------
// Step 3 — RFC 9727 .well-known/api-catalog
// ---------------------------------------------------------------------

/**
 * @param {string} text
 * @param {string} baseUrl
 * @returns {string[]}
 */
function parseCatalogServiceDesc(text, baseUrl) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  /** @type {string[]} */
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
  if (json && Array.isArray(json['service-desc'])) {
    for (const link of json['service-desc']) {
      if (link && typeof link.href === 'string') hrefs.push(new URL(link.href, baseUrl).toString());
    }
  }
  return hrefs;
}

/**
 * @param {string[]} candidates
 * @param {string} userAgent
 * @param {number} [deadline]
 * @returns {Promise<{specUrl: string, loaded: import('./load.js').LoadResult, ops: Operation[]} | null>}
 */
async function stepCatalog(candidates, userAgent, deadline) {
  for (const h of candidates) {
    if (budgetExceeded(deadline)) return null;
    const url = `https://${h}/.well-known/api-catalog`;
    const res = await politeFetch(url, { userAgent, deadline });
    if (!res.ok || !res.text) continue;
    // LIMIT 2: at most MAX_SERVICE_DESC_HREFS hrefs, in document order.
    const hrefs = parseCatalogServiceDesc(res.text, url).slice(0, MAX_SERVICE_DESC_HREFS);
    for (const href of hrefs) {
      if (budgetExceeded(deadline)) return null;
      const found = await tryLoadCandidate(href, userAgent, deadline);
      if (found) return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// Step 4 — RFC 8631 Link: rel="service-desc"
// ---------------------------------------------------------------------

/**
 * @param {string|null} linkHeader
 * @param {string} baseUrl
 * @returns {string[]}
 */
function parseLinkHeaderServiceDesc(linkHeader, baseUrl) {
  if (!linkHeader) return [];
  /** @type {string[]} */
  const hrefs = [];
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

/**
 * @param {string[]} candidates
 * @param {string} userAgent
 * @param {number} [deadline]
 * @returns {Promise<{specUrl: string, loaded: import('./load.js').LoadResult, ops: Operation[]} | null>}
 */
async function stepLinkHeader(candidates, userAgent, deadline) {
  for (const h of candidates) {
    if (budgetExceeded(deadline)) return null;
    const url = `https://${h}/`;
    let res = await politeFetch(url, { method: 'HEAD', userAgent, deadline });
    if (res.status === null || res.status === 405 || (res.status !== null && res.status >= 400)) {
      if (budgetExceeded(deadline)) return null;
      res = await politeFetch(url, { method: 'GET', userAgent, deadline });
    }
    const linkHeader = res.headers ? res.headers.get('link') : null;
    // LIMIT 2: at most MAX_SERVICE_DESC_HREFS hrefs, in document order.
    const hrefs = parseLinkHeaderServiceDesc(linkHeader, url).slice(0, MAX_SERVICE_DESC_HREFS);
    for (const href of hrefs) {
      if (budgetExceeded(deadline)) return null;
      const found = await tryLoadCandidate(href, userAgent, deadline);
      if (found) return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// Step 5 — fixed guess paths
// ---------------------------------------------------------------------

/**
 * @param {string} host  The API host (full, not walked up).
 * @param {string} twoLabelParent  The last host candidate (two labels).
 * @param {string} userAgent
 * @param {number} [deadline]
 * @returns {Promise<{specUrl: string, loaded: import('./load.js').LoadResult, ops: Operation[]} | null>}
 */
async function stepGuessPaths(host, twoLabelParent, userAgent, deadline) {
  const hosts = [host, `docs.${twoLabelParent}`, `developer.${twoLabelParent}`, `developers.${twoLabelParent}`];
  for (const h of hosts) {
    for (const p of GUESS_PATHS) {
      if (budgetExceeded(deadline)) return null;
      const found = await tryLoadCandidate(`https://${h}${p}`, userAgent, deadline);
      if (found) return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// Server resolution (OpenAPI 3 servers[] with variable defaults resolved,
// relative server URLs resolved against specUrl; Swagger 2
// schemes+host+basePath; none declared -> https://<host>). Duplicated
// from poc/match/measure.mjs's resolvedServers/resolveServerVariables on
// purpose (src/ never imports poc/); this is the production-shaped version
// of that logic, now the one writer of it inside src/.
// ---------------------------------------------------------------------


/**
 * @param {string} url
 * @param {any} variables
 * @returns {string}
 */
function resolveServerVariables(url, variables) {
  if (!variables || typeof variables !== 'object') return url;
  return url.replace(/\{([^}]+)\}/g, (whole, name) => {
    const v = variables[name];
    if (!v) return whole;
    if (typeof v.default === 'string') return v.default;
    if (Array.isArray(v.enum) && v.enum.length > 0) return String(v.enum[0]);
    return name;
  });
}

/**
 * The doc's OWN declared servers, resolved to absolute URLs — no
 * fallback host baked in here (that decision moved to buildFoundResult,
 * once a vendor is actually known; determineVendor below also reads this
 * raw list, before a vendor exists at all).
 *
 * @param {any} doc
 * @param {string} [specUrl]  Base for a relative server URL; omitted
 *   (rather than a non-URL like a local file path) when there is no
 *   usable base — a relative server URL then fails to resolve and is
 *   skipped, same as any other unresolvable one.
 * @returns {string[]}
 */
function resolvedServers(doc, specUrl) {
  /** @type {string[]} */
  const urls = [];
  if (doc && Array.isArray(doc.servers) && doc.servers.length > 0) {
    for (const s of doc.servers) {
      if (!s || typeof s.url !== 'string') continue;
      const resolved = resolveServerVariables(s.url, s.variables);
      try {
        urls.push(new URL(resolved, specUrl).toString());
      } catch {
        // an unresolvable server URL template is skipped, not fatal.
      }
    }
  } else if (doc && typeof doc.host === 'string' && doc.host) {
    const scheme = Array.isArray(doc.schemes) && doc.schemes.length > 0 ? doc.schemes[0] : 'https';
    const basePath = typeof doc.basePath === 'string' ? doc.basePath : '';
    urls.push(`${scheme}://${doc.host}${basePath}`);
  }
  return [...new Set(urls)];
}

// ---------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------

/**
 * @param {string|undefined} explicit
 * @returns {string}
 */
function resolveCacheDir(explicit) {
  if (explicit) return explicit;
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg) return path.join(xdg, 'rwxmap');
  return path.join(os.homedir(), '.cache', 'rwxmap');
}

/**
 * @param {string} cacheDir
 * @param {string} key
 * @returns {string}
 */
function cacheFilePath(cacheDir, key) {
  const hash = createHash('sha256').update(key).digest('hex');
  return path.join(cacheDir, `${hash}.json`);
}

/**
 * @param {string} cacheDir
 * @param {string} key
 * @param {string} version
 * @returns {any|null}  The stored result, or null on any kind of miss
 *   (absent, unreadable, corrupt, expired, or a different rwxmap version).
 */
function readCache(cacheDir, key, version) {
  try {
    const raw = fs.readFileSync(cacheFilePath(cacheDir, key), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.rwxmapVersion !== version) return null;
    if (typeof parsed.fetchedAt !== 'number') return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.result;
  } catch {
    return null;
  }
}

/**
 * @param {string} cacheDir
 * @param {string} key
 * @param {string} version
 * @param {any} result
 * @returns {boolean}  Whether the write succeeded.
 */
function writeCache(cacheDir, key, version, result) {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    const file = cacheFilePath(cacheDir, key);
    const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    const payload = {
      fetchedAt: Date.now(),
      rwxmapVersion: version,
      jevModel: null,
      key,
      result,
    };
    fs.writeFileSync(tmp, JSON.stringify(payload));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Result building
// ---------------------------------------------------------------------

/**
 * @param {string} vendor
 * @param {string} specUrl
 * @param {import('./load.js').LoadResult} loaded
 * @param {Operation[]} ops
 * @returns {any}
 */
function buildFoundResult(vendor, specUrl, loaded, ops) {
  // `entries` is exportGate's own `tools` map (D105 item 3: "the tools
  // map with letter and marker") — the same GateEntry shape D103 defined,
  // looked up here, never rebuilt.
  const { tools: entries } = exportGate(ops, { vendor, form: 'object' });
  const opKeys = ops.map((op) => gateKey(vendor, op));
  let servers = resolvedServers(loaded.doc, specUrl);
  if (servers.length === 0) servers = [`https://${vendor}`];
  return {
    status: 'found',
    host: vendor,
    specUrl,
    sha256: loaded.sha256,
    servers,
    entries,
    ops,
    opKeys,
    mode: 'mechanical',
  };
}

/**
 * @param {string} u
 * @returns {string|null}  The lowercased hostname when `u` parses as an
 *   http(s) URL, else null (never throws).
 */
function tryParseHostname(u) {
  try {
    const parsed = new URL(String(u));
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.hostname.toLowerCase();
  } catch {
    // not a URL at all — fine, the caller has other fallbacks.
  }
  return null;
}

/**
 * The vendor rule for opts.spec (orchestrator fix #3 — the previous
 * file-basename fallback was wrong, e.g. "openapi.yaml" for a gzipped
 * corpus fixture, and a raw spec-URL host is ALSO wrong when the spec is
 * hosted somewhere other than the API itself, e.g.
 * raw.githubusercontent.com is not the API): (1) apiUrl's own hostname,
 * when apiUrl is a real http(s) URL; (2) else the hostname of the spec's
 * own first resolved server; (3) else throw — there is no vendor to key
 * gate entries on, and guessing one would be worse than telling the
 * caller what to pass.
 *
 * @param {string} apiUrl
 * @param {any} doc
 * @param {string} specAddr  opts.spec's own address, used only to resolve
 *   a relative server URL against (when it happens to be a URL itself);
 *   an already-absolute server URL, the common case, needs no base at
 *   all.
 * @returns {string}
 * @throws {Error}  When neither apiUrl nor the spec's own servers name a
 *   usable host.
 */
function determineVendor(apiUrl, doc, specAddr) {
  const fromApiUrl = tryParseHostname(apiUrl);
  if (fromApiUrl) return fromApiUrl;
  const base = tryParseHostname(specAddr) ? specAddr : undefined;
  for (const server of resolvedServers(doc, base)) {
    const fromServer = tryParseHostname(server);
    if (fromServer) return fromServer;
  }
  throw new Error(
    'findSpec: opts.spec was given, but apiUrl does not identify a host (pass e.g. "https://api.example.com") '
    + 'and the spec declares no servers of its own — there is no vendor to key gate entries on',
  );
}

// ---------------------------------------------------------------------
// findSpec
// ---------------------------------------------------------------------

/**
 * @typedef {Object} FindSpecOptions
 * @property {string} [spec]      A URL or file path — when given, ONLY
 *   this address is loaded; no cache-independent discovery is tried.
 * @property {string} [cacheDir]  Overrides the default cache directory.
 */

/**
 * @param {string} apiUrl
 * @param {FindSpecOptions} [opts]
 * @returns {Promise<any>}
 */
export async function findSpec(apiUrl, opts = {}) {
  const version = packageVersion();
  const cacheDir = resolveCacheDir(opts.cacheDir);
  const userAgent = `rwxmap/${version}`;

  if (opts.spec) {
    // DESIGN CHOICE: the cache IS still consulted here, keyed by the
    // address itself — "nothing else tried" (D108 item 1) means no
    // catalog/Link-header/guess-path fallback, not that a repeat call
    // with the identical opts.spec must always refetch. A load failure
    // for an explicit address is not turned into "none": the caller
    // named this spec on purpose, so the error propagates.
    const key = String(opts.spec);
    const cached = readCache(cacheDir, key, version);
    if (cached) return { ...cached, fromCache: true, cached: true };

    // Note: opts.spec is loaded with fetch's ordinary 'follow' (the
    // default) — the caller named this exact address on purpose (same
    // exemption as D108 item 1's "nothing else tried"), so it is not run
    // through the per-hop safety walk steps 3-5 use.
    const loaded = await loadSpec(opts.spec, { timeoutMs: TIMEOUT_MS, headers: { 'User-Agent': userAgent } });
    const vendor = determineVendor(apiUrl, loaded.doc, String(opts.spec));
    const ops = operationsFrom(loaded.doc);
    const result = ops.length > 0
      ? buildFoundResult(vendor, String(opts.spec), loaded, ops)
      : { status: 'none', host: vendor, reason: 'spec has no operations', mode: 'mechanical' };
    const wrote = writeCache(cacheDir, key, version, result);
    return { ...result, fromCache: false, cached: wrote };
  }

  const { host, reason: unsafeApiUrlReason } = checkSafety(apiUrl);
  if (unsafeApiUrlReason) {
    return { status: 'none', host, reason: unsafeApiUrlReason, fromCache: false, cached: false, mode: 'mechanical' };
  }

  const cacheKey = /** @type {string} */ (host);
  const cached = readCache(cacheDir, cacheKey, version);
  if (cached) return { ...cached, fromCache: true, cached: true };

  const candidates = hostCandidates(cacheKey);
  const twoLabelParent = candidates[candidates.length - 1];
  // LIMIT 3: a 60s wall-clock budget for steps 3-5 combined, so no new
  // request starts once it runs out (an in-flight request keeps its own
  // TIMEOUT_MS bound regardless). Does not apply to opts.spec above.
  const deadline = Date.now() + DISCOVERY_BUDGET_MS;

  let found = await stepCatalog(candidates, userAgent, deadline);
  if (!found) found = await stepLinkHeader(candidates, userAgent, deadline);
  if (!found) found = await stepGuessPaths(cacheKey, twoLabelParent, userAgent, deadline);

  const result = found
    ? buildFoundResult(cacheKey, found.specUrl, found.loaded, found.ops)
    : budgetExceeded(deadline)
      ? { status: 'none', host: cacheKey, reason: 'time budget (60 s) exhausted', mode: 'mechanical' }
      : { status: 'none', host: cacheKey, reason: 'no spec found', mode: 'mechanical' };

  const wrote = writeCache(cacheDir, cacheKey, version, result);
  return { ...result, fromCache: false, cached: wrote };
}

// ---------------------------------------------------------------------
// classifyCall
// ---------------------------------------------------------------------

/**
 * @param {any} found  A findSpec() result.
 * @param {string} method
 * @param {string} url
 * @returns {{key: string, letter: 'r'|'w'|'x', marker: 'tight'|'loose'|'settled', source: 'spec'|'request'}}
 */
export function classifyCall(found, method, url) {
  if (found && found.status === 'found') {
    /** @type {ReturnType<typeof matchOperation>} */
    let matched = null;
    try {
      matched = matchOperation(found.ops, found.servers, method, url);
    } catch {
      matched = null;
    }
    if (matched) {
      // matched.op is always an element of found.ops (matchOperation only
      // ever returns one of the array it was given), and buildFoundResult
      // built opKeys/entries from that exact same ops array/pass, so both
      // lookups below are guaranteed to hit — an orchestrator review
      // found the old idx<0/!entry branches unreachable and asked for a
      // loud failure instead of a silent, never-taken fallback if that
      // invariant is ever broken.
      const idx = found.ops.indexOf(matched.op);
      if (idx < 0) throw new Error('classifyCall: matched operation is not a member of found.ops — invariant broken');
      const key = found.opKeys[idx];
      const entry = found.entries[key];
      if (!entry) throw new Error(`classifyCall: no gate entry for key "${key}" — invariant broken`);
      return { key, letter: entry.letter, marker: entry.marker, source: 'spec' };
    }
  }

  const key = requestKey(method, url);
  const pathname = new URL(url).pathname;
  const verdict = classifyRow({ method, path: pathname });
  return { key, letter: verdict.class, marker: verdict.review, source: 'request' };
}
