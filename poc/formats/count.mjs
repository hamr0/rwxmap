// Item (c) — for each sampled public-apis entry, follow its docs link and
// work out what shape (if any) its API description is published in.
//
// This never touches src/load.js: that loader rejects any OpenAPI-shaped
// document without top-level `paths` (by design, per its own POC brief),
// and here the goal is to *classify* whatever a URL actually serves,
// including things that are not OpenAPI at all (Postman collections,
// RAML, GraphQL, ...). So step 3 below uses node fetch + the `yaml`
// package directly, exactly as CLAUDE.md instructs for this POC.
//
// Politeness (CLAUDE.md brief): one request in flight at a time across
// the whole run, each bounded by a 10s timeout, none retried, all
// carrying the same User-Agent as poc/discover/probe.mjs.
//
// Usage:
//   node poc/formats/count.mjs --dry-run=5   # first 5 sampled entries only
//   node poc/formats/count.mjs               # full 200-entry sample
//
// Output: data/formats-2026-09-27/results.json, plus a printed summary.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = `${HERE}/../../data/formats-2026-09-27`;

const USER_AGENT = 'rwxmap-discovery-poc/0.1 (+https://github.com/hamr0/rwxmap)';
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_CANDIDATES_PER_API = 3;

const GUESS_PATHS = [
  '/openapi.json',
  '/openapi.yaml',
  '/swagger.json',
  '/v3/api-docs',
  '/api-docs',
];

// ---------------------------------------------------------------------
// One-at-a-time request queue (same shape as poc/discover/probe.mjs).
// ---------------------------------------------------------------------
let queueTail = Promise.resolve();
let totalRequests = 0;

function enqueue(fn) {
  const run = queueTail.then(fn, fn);
  queueTail = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * @param {string} url
 * @param {{method?: string, capBytes?: number}} [opts]
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
      const cap = opts.capBytes || MAX_BYTES;
      const lenHeader = res.headers.get('content-length');
      let text = null;
      let truncated = false;
      if (opts.method !== 'HEAD') {
        if (lenHeader && Number(lenHeader) > cap) {
          truncated = true;
        } else {
          try {
            const buf = await res.arrayBuffer();
            if (buf.byteLength > cap) {
              text = Buffer.from(buf.slice(0, cap)).toString('utf8');
              truncated = true;
            } else {
              text = Buffer.from(buf).toString('utf8');
            }
          } catch {
            text = null;
          }
        }
      }
      return {
        ok: res.ok,
        status: res.status,
        finalUrl: res.url || url,
        headers: res.headers,
        text,
        truncated,
        error: null,
      };
    } catch (err) {
      return {
        ok: false,
        status: null,
        finalUrl: url,
        headers: null,
        text: null,
        truncated: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  });
}

// ---------------------------------------------------------------------
// Page-evidence detection (step 1)
// ---------------------------------------------------------------------

// Each shape: a set of regexes tested against the raw HTML/text. A hit
// records the matched snippet (capped length) as "where".
const EVIDENCE_RULES = {
  openapi: [
    /swagger-ui|SwaggerUIBundle/i,
    /\bredoc\b|spec-url\s*=/i,
    /stoplight/i,
    /scalar-api-reference|@scalar\//i,
    /<rapi-doc|rapidoc/i,
    /\bopenapi\b/i,
    /\bswagger\b/i,
  ],
  postman: [
    /run\.pstmn\.io/i,
    /postman\.com\//i,
    /documenter\.getpostman\.com/i,
    /run in postman/i,
    /\.postman_collection\.json/i,
  ],
  graphql: [
    /\/graphql\b/i,
    /graphiql/i,
    /apollo/i,
    /\bgraphql\b/i,
  ],
  raml: [/\.raml\b/i, /#%RAML/],
  apiBlueprint: [/\.apib\b/i, /apiary\.io/i],
  wadl: [/\.wadl\b/i],
  googleDiscovery: [/\$discovery\/rest/i, /discoveryVersion/i],
  asyncapi: [/asyncapi/i],
  grpc: [/\.proto\b/i, /\bgrpc\b/i],
};

function collectEvidence(html, sourceUrl) {
  const found = {};
  for (const [shape, patterns] of Object.entries(EVIDENCE_RULES)) {
    for (const re of patterns) {
      const m = re.exec(html);
      if (m) {
        found[shape] = found[shape] || [];
        if (found[shape].length < 3) {
          found[shape].push({ match: m[0].slice(0, 80), seenAt: sourceUrl });
        }
      }
    }
  }
  return found;
}

// URL-shape filter reused from poc/discover/probe.mjs's strategy E: a
// linked candidate is worth trying only if it names itself as a spec.
function looksLikeSpecUrl(url) {
  return /openapi|swagger|api-docs|apispec|discovery\/rest|\.postman_collection\.json/i.test(url)
    || /\.(json|yaml|yml|raml|apib|wadl|proto)(\?|#|$)/i.test(url);
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const attrRe = /(?:href|src|data-url|spec-url|url|apiDescriptionUrl)\s*[:=]\s*["']([^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(html))) {
    try {
      links.add(new URL(m[1], baseUrl).href);
    } catch {
      // ignore unresolvable
    }
  }
  return [...links];
}

function visibleTextLength(html) {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const text = noScript.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length;
}

function isJsRendered(html) {
  const textLen = visibleTextLength(html);
  const singleRoot = /<div\s+id=["'](root|app|__next|___gatsby)["']/i.test(html)
    && (html.match(/<div\s+id=/gi) || []).length <= 3;
  return textLen < 2000 || singleRoot;
}

// Extract candidate "API base" hosts mentioned on the page (distinct from
// the docs host), heuristically: any absolute URL whose host contains
// "api" as a label, or starts with "api.".
function extractApiHosts(html, docsHost) {
  const hosts = new Set();
  const urlRe = /https?:\/\/[^\s"'<>)]+/gi;
  let m;
  while ((m = urlRe.exec(html))) {
    try {
      const u = new URL(m[0]);
      if (u.host === docsHost) continue;
      if (/(^|\.)api(\.|$)|^api-/i.test(u.host)) hosts.add(u.host);
    } catch {
      // ignore
    }
  }
  return [...hosts].slice(0, 3);
}

// ---------------------------------------------------------------------
// Cheap discovery shapes (step 2)
// ---------------------------------------------------------------------
async function cheapDiscovery(host) {
  const base = `https://${host}`;
  const candidates = [];
  const requestsBefore = totalRequests;

  const catalog = await request(`${base}/.well-known/api-catalog`);
  if (catalog.ok && catalog.text) {
    candidates.push({ url: `${base}/.well-known/api-catalog`, via: 'well-known/api-catalog' });
  }

  const head = await request(`${base}/`, { method: 'HEAD' });
  const linkHeader = head.headers ? head.headers.get('link') : null;
  if (linkHeader && /rel=["']?service-desc["']?/i.test(linkHeader)) {
    const m = /<([^>]+)>\s*;\s*rel=["']?service-desc["']?/i.exec(linkHeader);
    if (m) {
      try {
        candidates.push({ url: new URL(m[1], base).href, via: 'Link rel=service-desc' });
      } catch {
        // ignore
      }
    }
  }

  for (const p of GUESS_PATHS) {
    const res = await request(`${base}${p}`, { method: 'HEAD' });
    if (res.ok) candidates.push({ url: `${base}${p}`, via: `guessed path ${p}` });
  }

  return { candidates, requests: totalRequests - requestsBefore };
}

// ---------------------------------------------------------------------
// Classify a candidate URL's actual content (step 3)
// ---------------------------------------------------------------------
function classifyContent(text) {
  if (!text) return null;
  const trimmed = text.trim();

  if (trimmed.startsWith('#%RAML')) return 'RAML';
  if (/^FORMAT:\s*1A/m.test(trimmed)) return 'API Blueprint';

  let obj = null;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    try {
      obj = parseYaml(trimmed);
    } catch {
      obj = null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;

  if (typeof obj.openapi === 'string' && obj.openapi.startsWith('3')) return 'OpenAPI 3';
  if (obj.swagger === '2.0') return 'Swagger 2';
  if (typeof obj.discoveryVersion === 'string') return 'Google Discovery';
  if (obj.info && (
    (typeof obj.info.schema === 'string' && obj.info.schema.includes('getpostman.com'))
    || typeof obj.info._postman_id === 'string'
  )) return 'Postman';
  if (typeof obj.asyncapi === 'string') return 'AsyncAPI';
  return null;
}

// ---------------------------------------------------------------------
// Per-API run
// ---------------------------------------------------------------------
async function runOne(entry) {
  const requestsBefore = totalRequests;
  const result = {
    name: entry.name,
    link: entry.link,
    docsStatus: null,
    docsFinalUrl: null,
    evidence: {},
    js_rendered: false,
    confirmed: [],
    mentioned: [],
    deadLink: false,
    requests: 0,
  };

  const page = await request(entry.link);
  result.docsStatus = page.status;
  result.docsFinalUrl = page.finalUrl;
  if (!page.ok || !page.text) {
    result.deadLink = true;
    result.requests = totalRequests - requestsBefore;
    return result;
  }

  const html = page.text;
  result.evidence = collectEvidence(html, page.finalUrl);
  result.js_rendered = isJsRendered(html);
  const mentionedShapes = new Set(Object.keys(result.evidence));

  const pageLinks = extractLinks(html, page.finalUrl).filter(looksLikeSpecUrl);
  let docsHost = null;
  try {
    docsHost = new URL(page.finalUrl).host;
  } catch {
    docsHost = null;
  }

  const hostsToCheck = new Set();
  if (docsHost) hostsToCheck.add(docsHost);
  for (const h of extractApiHosts(html, docsHost)) hostsToCheck.add(h);

  const cheapCandidates = [];
  for (const h of hostsToCheck) {
    const { candidates } = await cheapDiscovery(h);
    cheapCandidates.push(...candidates);
  }

  const allCandidates = [...pageLinks.map((url) => ({ url, via: 'page link' })), ...cheapCandidates];
  const seen = new Set();
  const tried = [];
  for (const c of allCandidates) {
    if (tried.length >= MAX_CANDIDATES_PER_API) break;
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    tried.push(c);
  }

  for (const c of tried) {
    const res = await request(c.url);
    if (!res.ok || !res.text) continue;
    const shape = classifyContent(res.text);
    if (shape) {
      result.confirmed.push({ shape, url: c.url, via: c.via });
    }
  }

  const confirmedShapes = new Set(result.confirmed.map((c) => c.shape));
  // An evidence key is worth reporting as "mentioned" only when nothing
  // in its family was actually confirmed (e.g. openapi evidence is
  // redundant once OpenAPI 3 or Swagger 2 loaded and classified).
  result.mentioned = [...mentionedShapes].filter((s) => {
    const family = FAMILIES.find((f) => f.evidenceKeys.includes(s));
    if (!family) return true;
    return !family.confirmedShapes.some((shape) => confirmedShapes.has(shape));
  });
  result.requests = totalRequests - requestsBefore;
  return result;
}

// Evidence keys (openapi/postman/graphql/...) and confirmed shape names
// (OpenAPI 3/Swagger 2/Postman/...) use different vocabularies because
// evidence can't always tell OpenAPI 3 from Swagger 2 apart (both trip
// the same page markers), so evidence groups into one family label per
// shape. FAMILIES also drives the cumulative-coverage ordering below, so
// both are defined from the same table.
const FAMILIES = [
  { label: 'OpenAPI/Swagger', evidenceKeys: ['openapi'], confirmedShapes: ['OpenAPI 3', 'Swagger 2'] },
  { label: 'Postman', evidenceKeys: ['postman'], confirmedShapes: ['Postman'] },
  { label: 'GraphQL', evidenceKeys: ['graphql'], confirmedShapes: [] },
  { label: 'RAML', evidenceKeys: ['raml'], confirmedShapes: ['RAML'] },
  { label: 'API Blueprint', evidenceKeys: ['apiBlueprint'], confirmedShapes: ['API Blueprint'] },
  { label: 'WADL', evidenceKeys: ['wadl'], confirmedShapes: [] },
  { label: 'Google Discovery', evidenceKeys: ['googleDiscovery'], confirmedShapes: ['Google Discovery'] },
  { label: 'AsyncAPI', evidenceKeys: ['asyncapi'], confirmedShapes: ['AsyncAPI'] },
  { label: 'gRPC/protobuf', evidenceKeys: ['grpc'], confirmedShapes: [] },
];

function familyHit(r, family) {
  const confirmedShapes = new Set(r.confirmed.map((c) => c.shape));
  const evidenceShapes = new Set(Object.keys(r.evidence || {}));
  return family.confirmedShapes.some((s) => confirmedShapes.has(s))
    || family.evidenceKeys.some((k) => evidenceShapes.has(k));
}

// ---------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------
function pct(n, d) {
  return d === 0 ? '0.0%' : `${((n / d) * 100).toFixed(1)}%`;
}

function printSummary(results) {
  const n = results.length;
  console.log(`\n=== Summary over ${n} sampled APIs ===\n`);

  const confirmedCounts = {};
  for (const r of results) {
    for (const shape of new Set(r.confirmed.map((c) => c.shape))) {
      confirmedCounts[shape] = (confirmedCounts[shape] || 0) + 1;
    }
  }
  console.log(`-- confirmed (loaded and classified), of ${n} --`);
  for (const [shape, count] of Object.entries(confirmedCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${shape}: ${count}/${n} (${pct(count, n)})`);
  }

  console.log(`\n-- confirmed OR mentioned (page evidence only), of ${n} --`);
  for (const family of FAMILIES) {
    const count = results.filter((r) => familyHit(r, family)).length;
    if (count === 0) continue;
    console.log(`  ${family.label}: ${count}/${n} (${pct(count, n)})`);
  }

  const noDescription = results.filter((r) => r.confirmed.length === 0 && Object.keys(r.evidence || {}).length === 0);
  console.log(`\n-- no description shape found at all, of ${n} --`);
  console.log(`  none found: ${noDescription.length}/${n} (${pct(noDescription.length, n)})`);
  const jsRenderedAmongNone = noDescription.filter((r) => r.js_rendered).length;
  const deadAmongNone = noDescription.filter((r) => r.deadLink).length;
  console.log(`  of those, js_rendered: ${jsRenderedAmongNone}/${noDescription.length} (${pct(jsRenderedAmongNone, noDescription.length)})`);
  console.log(`  of those, dead link (non-2xx or fetch failure): ${deadAmongNone}/${noDescription.length} (${pct(deadAmongNone, noDescription.length)})`);

  console.log(`\n-- cumulative coverage (confirmed OR mentioned), of ${n} --`);
  const steps = [
    { label: 'OpenAPI+Swagger', families: ['OpenAPI/Swagger'] },
    { label: '+Postman', families: ['Postman'] },
    { label: '+GraphQL', families: ['GraphQL'] },
    { label: '+the rest', families: ['RAML', 'API Blueprint', 'WADL', 'Google Discovery', 'AsyncAPI', 'gRPC/protobuf'] },
  ];
  let coveredCount = 0;
  const covered = new Set();
  for (const step of steps) {
    const stepFamilies = FAMILIES.filter((f) => step.families.includes(f.label));
    for (const r of results) {
      if (covered.has(r.name)) continue;
      if (stepFamilies.some((f) => familyHit(r, f))) {
        covered.add(r.name);
        coveredCount += 1;
      }
    }
    console.log(`  ${step.label}: ${coveredCount}/${n} (${pct(coveredCount, n)})`);
  }

  console.log(`\ntotal requests this run: ${totalRequests}`);
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------
async function main() {
  const dryRunArg = process.argv.find((a) => a.startsWith('--dry-run='));
  const limit = dryRunArg ? Number(dryRunArg.split('=')[1]) : null;

  const sampleFile = JSON.parse(readFileSync(`${DATA_DIR}/sample.json`, 'utf8'));
  const entries = limit ? sampleFile.sample.slice(0, limit) : sampleFile.sample;

  const results = [];
  for (const entry of entries) {
    console.log(`... ${entry.name} <${entry.link}>`);
    const r = await runOne(entry);
    results.push(r);
  }

  if (!limit) {
    writeFileSync(`${DATA_DIR}/results.json`, JSON.stringify(results, null, 2));
    console.log(`\nwrote ${DATA_DIR}/results.json`);
  } else {
    console.log(`\n(dry run of ${limit}; results.json NOT written)`);
    console.log(JSON.stringify(results, null, 2));
  }

  printSummary(results);
}

main();
