#!/usr/bin/env node
// Measurement-only pass (2026-09-28): three questions about the shipped
// rwxmap/discover algorithm (src/discover.js), read-only against data
// already in the repo. No network. Nothing here edits src/.
//
// M1 - WHERE SPECS ARE FOUND: combines (a) the live 25-vendor discover
//      run (data/discover-live-2026-09-28/results.json), (b) the
//      200-public-API probe (data/formats-2026-09-27/results.json), and
//      (c) the earlier probe's text findings (docs/logs/learnings.md,
//      "Spec discovery pass 1" and "pass 3", hand-transcribed here, not
//      re-run) into one place->count table, then asks what a top-2/top-3
//      place list would still find and cost in requests.
// M2 - OPERATION-COUNT BAR FOR A WRONG SPEC: real-spec op counts (the 37
//      locked spec files) vs known-wrong-spec op counts, at bars
//      N=5,10,20,30.
// M3 - CROSS-VENDOR WRONG-SPEC RISK: every ordered pair of the 37 locked
//      specs, A's calls run against B's matchOperation, comparing
//      truth/wrong-spec/per-request classes, plus the cost of a
//      "spec match may only tighten" rule on RIGHT specs.
//
// This file imports only from ../../src/*.js (read only) and
// ./vendors.mjs is NOT used (M1/M2/M3 need the 37-spec four-set walk,
// not the 25-vendor discover list). Output: JSON to
// data/discover-limits-2026-09-28/results.json, plus a printed summary.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpec } from '../../src/load.js';
import { operationsFrom } from '../../src/exporter.js';
import { classifyRow } from '../../src/flow.js';
import { matchOperation } from '../../src/match.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'data', 'discover-limits-2026-09-28');
const OUT_FILE = path.join(OUT_DIR, 'results.json');

const TIGHTNESS = { r: 0, w: 1, x: 2 };
// The TIGHTER of two classes is the one with the HIGHER tightness value
// (x=2 is tightest). BUG FIXED 2026-09-28 (orchestrator caught it): this
// previously used `<=`, which returned the LOOSER letter, inverting
// every "spec match may only tighten" number below.
const tighterOf = (a, b) => (TIGHTNESS[a] >= TIGHTNESS[b] ? a : b);

// =======================================================================
// Shared: the 37 locked spec files across the four sets, same walk as
// poc/match/measure.mjs's collectSpecFiles (duplicated read-only, on
// purpose - src/ never imports poc/, and this poc/ file does not import
// poc/match/measure.mjs since that file is a script, not a module of
// reusable exports).
// =======================================================================
const SETS = [
  'data/provider-corpus-2026-09-16',
  'data/exam-2026-09-17',
  'data/exam-2026-09-20',
  'data/exam-2026-09-22',
];

function collectSpecFiles() {
  const files = [];
  for (const setDir of SETS) {
    const lockPath = path.join(REPO_ROOT, setDir, 'specs.lock.json');
    const entries = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    for (const entry of entries) {
      if (entry.provider === 'hubspot') continue; // tar.gz collection, not loadable
      if (entry.provider === 'digitalocean' && entry.path.includes('/resources/')) continue; // fragments
      const filePath = path.join(REPO_ROOT, setDir, 'specs', entry.path);
      files.push({ setDir, provider: entry.provider, lockPath: entry.path, filePath });
    }
  }
  return files;
}

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

function resolvedServers(doc) {
  const urls = [];
  if (Array.isArray(doc.servers) && doc.servers.length > 0) {
    for (const s of doc.servers) {
      if (!s || typeof s.url !== 'string') continue;
      urls.push(resolveServerVariables(s.url, s.variables));
    }
  } else if (typeof doc.host === 'string' && doc.host) {
    const scheme = Array.isArray(doc.schemes) && doc.schemes.length > 0 ? doc.schemes[0] : 'https';
    const basePath = typeof doc.basePath === 'string' ? doc.basePath : '';
    urls.push(`${scheme}://${doc.host}${basePath}`);
  }
  return [...new Set(urls)];
}

function stripTrailingSlash(base) {
  return base.endsWith('/') && base.length > 1 ? base.slice(0, -1) : base;
}

const ROTATION = [
  '12345',
  '550e8400-e29b-41d4-a716-446655440000',
  'abcdef0123456789abcdef01',
  'cus_NffrFeUfNV2Hib',
];
const NAME_OVERRIDE_RE = /name|slug|key/i;

function fillTemplate(templatePath, counterRef) {
  return templatePath.replace(/\{([^}]+)\}/g, (whole, name) => {
    if (NAME_OVERRIDE_RE.test(name)) return 'acme-prod';
    const value = ROTATION[counterRef[0] % ROTATION.length];
    counterRef[0] += 1;
    return value;
  });
}

async function loadAllSpecs() {
  const files = collectSpecFiles();
  const specs = [];
  for (const f of files) {
    const { doc } = await loadSpec(f.filePath);
    const ops = operationsFrom(doc);
    const servers = resolvedServers(doc);
    const label = `${f.provider}:${path.basename(f.lockPath)}`;
    specs.push({ ...f, label, doc, ops, servers });
  }
  return specs;
}

// =======================================================================
// M1 - WHERE SPECS ARE FOUND
// =======================================================================

// GUESS_PATHS copied verbatim from src/discover.js (same duplication
// rule the shipped file itself documents for poc/discover/probe.mjs).
const GUESS_PATHS = [
  '/openapi.json', '/openapi.yaml', '/openapi.yml',
  '/swagger.json', '/swagger.yaml',
  '/v3/api-docs', '/v2/api-docs', '/api-docs', '/api-docs.json',
  '/swagger/v1/swagger.json',
  '/.well-known/openapi.json', '/.well-known/openapi.yaml',
  '/spec/openapi.json', '/openapi/v3.json',
];
const GUESS_PATHS_SET = new Set(GUESS_PATHS);

function hostCandidates(host) {
  const labels = host.split('.');
  const out = [];
  for (let n = labels.length; n >= 2; n--) out.push(labels.slice(labels.length - n).join('.'));
  return out;
}

/** host-kind classifier, shared by (a)/(b)/(c) rows. */
function hostKindOf(specHost, apiHost) {
  const candidates = hostCandidates(apiHost); // [apiHost, ..., twoLabelParent]
  if (specHost === apiHost) return 'api host';
  if (candidates.slice(1).includes(specHost)) return 'parent';
  const m = specHost.match(/^(docs|developer|developers)\.(.+)$/);
  if (m && candidates.includes(m[2])) return 'docs./developer./developers. of parent';
  return 'other';
}

function hostnameOf(u) {
  try { return new URL(u).hostname.toLowerCase(); } catch { return null; }
}

/**
 * Given one vendor's slice of the live requestLog and its winning
 * specUrl, tag which shipped step (api-catalog | link-header |
 * guessed-path) it came from. Deterministic anchors, verified by hand
 * against the two real finds in this run (cloudflare -> link-header,
 * intercom -> api-catalog) before being written as a general rule:
 *   - stepLinkHeader's FIRST request is always HEAD https://{apiHost}/
 *   - stepGuessPaths' FIRST request is always
 *     https://{apiHost}/openapi.json (GUESS_PATHS[0], first host)
 *   - stepCatalog always runs first.
 * A request's phase is whichever of these anchor URLs was most recently
 * seen (or 'catalog', the initial phase, if neither has appeared yet).
 * Every request also gets a bucket: 'catalog' (path under
 * .well-known/api-catalog), 'link' (path === '/', the root probe),
 * 'guess-path' (phase is guess AND path is an exact GUESS_PATHS member),
 * else 'candidate-load' (a catalog/link href fetch - arbitrary path).
 */
function tagRequests(slice, apiHost) {
  const linkEntryUrl = `https://${apiHost}/`;
  const guessEntryUrl = `https://${apiHost}${GUESS_PATHS[0]}`;
  let phase = 'catalog';
  return slice.map((r) => {
    if (phase !== 'link' && phase !== 'guess' && r.url === linkEntryUrl) phase = 'link';
    if (phase !== 'guess' && r.url === guessEntryUrl) phase = 'guess';
    let pathname = null;
    try { pathname = new URL(r.url).pathname; } catch { /* leave null */ }
    let bucket;
    if (pathname && pathname.startsWith('/.well-known/api-catalog')) bucket = 'catalog';
    else if (phase === 'guess' && pathname && GUESS_PATHS_SET.has(pathname)) bucket = 'guess-path';
    else if (pathname === '/') bucket = 'link';
    else bucket = 'candidate-load';
    return { ...r, phase, bucket };
  });
}

/** Find which step produced the winning specUrl, using the tagged slice. */
function stepForFind(taggedSlice, specUrl) {
  const i = taggedSlice.findIndex((r) => r.url === specUrl);
  if (i < 0) return { step: 'unknown', evidence: 'specUrl never appears in its own request slice' };
  const tag = taggedSlice[i];
  if (tag.bucket === 'guess-path') return { step: 'guessed-path' };
  // candidate-load (or, in principle, 'link'/'catalog' bucket itself,
  // which cannot happen for a winning specUrl - a catalog/root probe URL
  // never IS the spec) - use the phase at that point.
  if (tag.phase === 'link') return { step: 'link-header' };
  return { step: 'api-catalog' };
}

function runM1(liveData, formatsData) {
  const finds = []; // { source, vendor, step, hostKind, path, url, overlapLabel }

  // ---- (a) live discover-live-2026-09-28 ----
  const part1 = liveData.part1;
  const reqLog = liveData.requestLog;
  let offset = 0;
  const perVendorRequestTags = {}; // vendor -> tagged slice
  for (const row of part1) {
    const slice = reqLog.slice(offset, offset + row.requestsMade);
    const tagged = tagRequests(slice, row.apiHost);
    perVendorRequestTags[row.vendor] = { apiHost: row.apiHost, tagged, totalRequests: row.requestsMade };
    if (row.status === 'found') {
      const { step } = stepForFind(tagged, row.specUrl);
      const specHost = hostnameOf(row.specUrl);
      const hostKind = specHost ? hostKindOf(specHost, row.apiHost) : 'unknown';
      const guessPath = step === 'guessed-path' ? (new URL(row.specUrl).pathname) : null;
      finds.push({
        source: 'a-live-2026-09-28', vendor: row.vendor, step, hostKind, path: guessPath,
        url: row.specUrl, overlapLabel: row.overlapLabel, opCount: row.opCount,
      });
    }
    offset += row.requestsMade;
  }

  // ---- (b) formats-2026-09-27, 200-API probe ----
  const bFindsRaw = [];
  for (const e of formatsData) {
    for (const c of (e.confirmed || [])) bFindsRaw.push({ entry: e, confirmed: c });
  }
  const bFinds = [];
  for (const { entry, confirmed: c } of bFindsRaw) {
    const isSportmonksFalsePositive = entry.name === 'Sportmonks Cricket' && hostnameOf(c.url) === 'api.gitbook.com';
    let step;
    let guessPath = null;
    if (/^guessed path /.test(c.via)) { step = 'guessed-path'; guessPath = c.via.replace(/^guessed path /, ''); } else if (c.via === 'Link rel=service-desc') step = 'link-header';
    else if (c.via === 'page link') step = 'page-link'; // NOT part of src/discover.js's shipped algorithm
    else step = `unknown (${c.via})`;
    const apiHost = hostnameOf(entry.docsFinalUrl || entry.link);
    const specHost = hostnameOf(c.url);
    const hostKind = (apiHost && specHost) ? hostKindOf(specHost, apiHost) : 'unknown';
    bFinds.push({
      source: 'b-formats-2026-09-27', vendor: entry.name, step, hostKind, path: guessPath,
      url: c.url, shape: c.shape, knownFalsePositive: isSportmonksFalsePositive,
    });
  }

  // ---- (c) docs/logs/learnings.md text, "Spec discovery pass 1" / "pass 3" ----
  // Hand-transcribed from the learnings.md prose (not re-run):
  //   pass 1: "A: intercom (70%). B: intercom (same file). C: cloudflare,
  //   via docs.cloudflare.com/openapi.json (99%)... D asana 66%, docusign
  //   94%, spotify 92%, square 54%, stripe 74%, zoom 92%. Wrong spec from
  //   D: xero (identity API, 0%), openai (5%), digitalocean (42%); from
  //   B: cloudflare www.cloudflare.com/openapi.json (0%)."
  //   pass 3 confirms E (docs-page links) and F (sitemaps) found 0 new
  //   specs - nothing to add to the place table from pass 3 beyond that
  //   null result, which is reported separately (M1 text, not a find row).
  const cFinds = [
    { source: 'c-learnings-pass1', vendor: 'intercom', step: 'api-catalog', hostKind: 'other', path: null, url: '(same file as B)', overlapLabel: 'RIGHT (70%)' },
    { source: 'c-learnings-pass1', vendor: 'intercom', step: 'link-header', hostKind: 'other', path: null, url: '(same file as A)', overlapLabel: 'RIGHT (same file)' },
    { source: 'c-learnings-pass1', vendor: 'cloudflare', step: 'guessed-path', hostKind: 'docs./developer./developers. of parent', path: '/openapi.json', url: 'https://docs.cloudflare.com/openapi.json', overlapLabel: 'RIGHT (99%)' },
    { source: 'c-learnings-pass1', vendor: 'cloudflare', step: 'link-header', hostKind: 'other', path: null, url: 'https://www.cloudflare.com/openapi.json', overlapLabel: 'WRONG (0%)' },
  ];
  const cApisGuruFinds = [ // dropped strategy (D108 ruling) - NOT one of the three shipped steps
    { source: 'c-learnings-pass1', vendor: 'asana', step: 'apis-guru (dropped strategy)', hostKind: 'n/a', path: null, url: null, overlapLabel: 'RIGHT (66%)' },
    { source: 'c-learnings-pass1', vendor: 'docusign', step: 'apis-guru (dropped strategy)', hostKind: 'n/a', path: null, url: null, overlapLabel: 'RIGHT (94%)' },
    { source: 'c-learnings-pass1', vendor: 'spotify', step: 'apis-guru (dropped strategy)', hostKind: 'n/a', path: null, url: null, overlapLabel: 'RIGHT (92%)' },
    { source: 'c-learnings-pass1', vendor: 'square', step: 'apis-guru (dropped strategy)', hostKind: 'n/a', path: null, url: null, overlapLabel: 'RIGHT (54%)' },
    { source: 'c-learnings-pass1', vendor: 'stripe', step: 'apis-guru (dropped strategy)', hostKind: 'n/a', path: null, url: null, overlapLabel: 'RIGHT (74%)' },
    { source: 'c-learnings-pass1', vendor: 'zoom', step: 'apis-guru (dropped strategy)', hostKind: 'n/a', path: null, url: null, overlapLabel: 'RIGHT (92%)' },
    { source: 'c-learnings-pass1', vendor: 'xero', step: 'apis-guru (dropped strategy)', hostKind: 'n/a', path: null, url: null, overlapLabel: 'WRONG (identity API, 0%)' },
    { source: 'c-learnings-pass1', vendor: 'openai', step: 'apis-guru (dropped strategy)', hostKind: 'n/a', path: null, url: null, overlapLabel: 'WRONG (5%)' },
    { source: 'c-learnings-pass1', vendor: 'digitalocean', step: 'apis-guru (dropped strategy)', hostKind: 'n/a', path: null, url: null, overlapLabel: 'WRONG (42%)' },
  ];

  const sportmonksExcluded = bFinds.filter((f) => f.knownFalsePositive);
  const bFindsCounted = bFinds.filter((f) => !f.knownFalsePositive);

  // shipped-algorithm finds only (excludes page-link, apis-guru,
  // sportmonks false positive) - what M1's top-2/top-3 question is about
  const shippedFinds = [
    ...finds,
    ...bFindsCounted.filter((f) => f.step === 'guessed-path' || f.step === 'link-header' || f.step === 'api-catalog'),
    ...cFinds,
  ];

  const placeCounts = {};
  for (const f of shippedFinds) placeCounts[f.step] = (placeCounts[f.step] || 0) + 1;

  // per-vendor per-bucket request totals from (a), for the "requests
  // spent per step" table and the top-2/top-3 request estimate.
  const perVendorStepRequests = {};
  for (const [vendor, { apiHost, tagged, totalRequests }] of Object.entries(perVendorRequestTags)) {
    const counts = { catalog: 0, link: 0, 'guess-path': 0, 'candidate-load': 0 };
    for (const r of tagged) counts[r.bucket] += 1;
    perVendorStepRequests[vendor] = { apiHost, totalRequests, ...counts };
  }

  // zoom breakdown, called out specifically (464 requests, an outlier)
  const zoomTagged = perVendorRequestTags['zoom'];
  const zoomCandidateLoads = zoomTagged ? zoomTagged.tagged.filter((r) => r.bucket === 'candidate-load') : [];
  const zoomServiceDescTries = zoomCandidateLoads.length;

  // ---- top-2 / top-3 simulation ----
  // rank shipped steps by find count desc, ties broken by fewer total
  // requests spent on that step across (a)'s live run (fewer = better).
  const stepRequestTotals = { 'api-catalog': 0, 'link-header': 0, 'guessed-path': 0 };
  for (const v of Object.values(perVendorStepRequests)) {
    stepRequestTotals['api-catalog'] += v.catalog;
    stepRequestTotals['link-header'] += v.link;
    stepRequestTotals['guessed-path'] += v['guess-path'];
    // candidate-load requests are split across whichever step triggered
    // them; (a)'s own bucket doesn't know which without re-deriving per
    // request, so candidate-load requests are reported separately below
    // and NOT pre-assigned to a step total here (see candidateLoadTotal).
  }
  const candidateLoadTotal = Object.values(perVendorStepRequests).reduce((s, v) => s + v['candidate-load'], 0);

  const stepsByRank = Object.entries(placeCounts)
    .filter(([step]) => step === 'api-catalog' || step === 'link-header' || step === 'guessed-path')
    .sort((a, b) => (b[1] - a[1]) || (stepRequestTotals[a[0]] - stepRequestTotals[b[0]]))
    .map(([step, count]) => ({ step, count, requestTotal: stepRequestTotals[step] }));

  function simulateKeep(n) {
    const kept = new Set(stepsByRank.slice(0, n).map((s) => s.step));
    const totalShipped = shippedFinds.filter((f) => f.step === 'api-catalog' || f.step === 'link-header' || f.step === 'guessed-path').length;
    const stillFound = shippedFinds.filter((f) => kept.has(f.step)).length;
    // per-vendor request estimate for the live run (a): drop every
    // tagged request whose bucket corresponds to a REMOVED step. A
    // candidate-load request is dropped when the phase that produced it
    // (recorded per-request in `tagged`) is a removed step.
    const perVendorEstimate = {};
    for (const [vendor, { apiHost, tagged, totalRequests }] of Object.entries(perVendorRequestTags)) {
      let dropped = 0;
      for (const r of tagged) {
        const stepOfRequest = r.bucket === 'catalog' ? 'api-catalog'
          : r.bucket === 'link' ? 'link-header'
            : r.bucket === 'guess-path' ? 'guessed-path'
              : (r.phase === 'catalog' ? 'api-catalog' : r.phase === 'link' ? 'link-header' : 'guessed-path');
        if (!kept.has(stepOfRequest)) dropped += 1;
      }
      perVendorEstimate[vendor] = { before: totalRequests, after: totalRequests - dropped, dropped };
    }
    return { keptSteps: [...kept], totalShipped, stillFound, perVendorEstimate };
  }

  const top2 = simulateKeep(2);
  const top3 = simulateKeep(3);

  return {
    liveFinds: finds,
    formatsFindsAll: bFinds,
    formatsFindsCounted: bFindsCounted,
    formatsSportmonksExcluded: sportmonksExcluded,
    learningsFinds: cFinds,
    learningsApisGuruFinds: cApisGuruFinds,
    placeCounts,
    shippedFindsTotal: shippedFinds.length,
    perVendorStepRequests,
    zoom: { totalRequests: zoomTagged ? zoomTagged.totalRequests : null, serviceDescCandidateLoadTries: zoomServiceDescTries },
    stepsByRank,
    candidateLoadTotal,
    top2,
    top3,
  };
}

// =======================================================================
// M2 - OPERATION-COUNT BAR FOR A WRONG SPEC
// =======================================================================

async function runM2(specs, liveData) {
  const realSpecs = specs.map((s) => ({ provider: s.provider, file: s.lockPath, setDir: s.setDir, opCount: s.ops.length }));
  const sorted = [...realSpecs].sort((a, b) => a.opCount - b.opCount);
  const n = sorted.length;
  const min = sorted[0].opCount;
  const p5idx = Math.max(0, Math.ceil(0.05 * n) - 1);
  const p5 = sorted[p5idx].opCount;
  const medianIdx = Math.floor((n - 1) / 2);
  const median = n % 2 === 1 ? sorted[medianIdx].opCount : (sorted[medianIdx].opCount + sorted[medianIdx + 1].opCount) / 2;
  const smallest10 = sorted.slice(0, 10);

  // (b) formats-2026-09-27 finds: no local copies of any confirmed spec
  // exist in the repo (they were fetched live by that probe and never
  // saved) - checked below programmatically, not assumed.
  const formatsLocalCopyDir = path.join(REPO_ROOT, 'data', 'formats-2026-09-27');
  const formatsFiles = fs.readdirSync(formatsLocalCopyDir);
  const formatsHasSpecCopies = formatsFiles.some((f) => /openapi|swagger/i.test(f));

  // known wrong specs
  const cloudflareLive = liveData.part1.find((r) => r.vendor === 'cloudflare');
  const wrongSpecs = [
    { name: 'cloudflare www.cloudflare.com/openapi.json', opCount: cloudflareLive ? cloudflareLive.opCount : null, sourceNote: 'from live results data/discover-live-2026-09-28/results.json (part1)' },
  ];

  // pass-1 wrong-spec candidates (xero identity, openai, digitalocean via
  // APIs.guru) - op counts not recorded anywhere in the repo as numbers,
  // but the actual spec files ARE present locally
  // (data/corpus/apis-guru-specs/); computed directly here from those
  // real files, not guessed, and labelled as such.
  const apisGuruDir = path.join(REPO_ROOT, 'data', 'corpus', 'apis-guru-specs');
  const pass1Candidates = [
    { name: 'xero identity API (APIs.guru)', file: 'xero.com__xero-identity.json' },
    { name: 'openai (APIs.guru mirror)', file: 'openai.com.json' },
    { name: 'digitalocean (APIs.guru mirror)', file: 'digitalocean.com.json' },
  ];
  for (const cand of pass1Candidates) {
    const fp = path.join(apisGuruDir, cand.file);
    if (!fs.existsSync(fp)) { wrongSpecs.push({ name: cand.name, opCount: null, sourceNote: 'file not found in repo - unavailable' }); continue; }
    try {
      const { doc } = await loadSpec(fp);
      const ops = operationsFrom(doc);
      wrongSpecs.push({ name: cand.name, opCount: ops.length, sourceNote: `computed directly from data/corpus/apis-guru-specs/${cand.file} in this pass - not previously recorded as a number anywhere in the repo` });
    } catch (err) {
      wrongSpecs.push({ name: cand.name, opCount: null, sourceNote: `load error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  const bars = [5, 10, 20, 30].map((N) => {
    const realRejected = realSpecs.filter((s) => s.opCount < N);
    const wrongCaught = wrongSpecs.filter((s) => s.opCount !== null && s.opCount < N);
    return { N, realRejectedCount: realRejected.length, realRejected: realRejected.map((s) => `${s.provider}/${s.file} (${s.opCount})`), wrongCaughtCount: wrongCaught.length, wrongCaught: wrongCaught.map((s) => `${s.name} (${s.opCount})`) };
  });

  return {
    realSpecCount: n, min, p5, median,
    smallest10: smallest10.map((s) => `${s.provider}/${s.file} — ${s.opCount} ops`),
    formatsHasLocalSpecCopies: formatsHasSpecCopies,
    wrongSpecs,
    bars,
  };
}

// =======================================================================
// M3 - CROSS-VENDOR WRONG-SPEC RISK
// =======================================================================

// keepABasePath=true: url = B_base + A_basePath + A_op.path (the FULL
// real absolute path a caller of A's actual API would use, e.g.
// "/api/1.0/users/12345" for asana, forwarded onto B's base) - this is
// "B's base + A's path" read as A's real request path.
// keepABasePath=false: url = B_base + A_op.path only (A's own base-path
// segment DROPPED, i.e. only A's template path) - the M3 note's variant.
function runM3Variant(specs, variantName, keepABasePath) {
  const totals = { calls: 0, matches: 0, looserThanTruth: 0, looserThanReq: 0, looserThanBoth: 0, finalStillLooser: 0 };
  const rightSpecCost = { calls: 0, matches: 0, changed: 0, tighter: 0, looser: 0, equal: 0, specMismatch: 0 };
  const rightSpecCostRows = []; // every changed row, self-match (A=B)
  const pairRows = []; // { A, B, calls, matches, looserThanTruth, looserThanReq, looserThanBoth }
  const worstRowsAll = []; // per matched-and-looserThanBoth row, for top pairs listing

  for (let ai = 0; ai < specs.length; ai++) {
    const A = specs[ai];
    if (A.servers.length === 0) continue;
    const aBase = stripTrailingSlash(A.servers[0]);
    let aBasePath = '/';
    try { aBasePath = new URL(aBase).pathname || '/'; } catch { aBasePath = '/'; }

    for (let bi = 0; bi < specs.length; bi++) {
      const B = specs[bi];
      if (B.servers.length === 0) continue;
      const isSelf = ai === bi;
      const bBase = stripTrailingSlash(B.servers[0]);

      const pairTotals = { calls: 0, matches: 0, looserThanTruth: 0, looserThanReq: 0, looserThanBoth: 0, finalStillLooser: 0 };
      const counterRef = [0];

      for (const op of A.ops) {
        const filledPath = fillTemplate(op.path, counterRef);
        let usePath = filledPath;
        if (keepABasePath && aBasePath !== '/') {
          const bp = aBasePath.endsWith('/') ? aBasePath.slice(0, -1) : aBasePath;
          usePath = filledPath.startsWith('/') ? `${bp}${filledPath}` : `${bp}/${filledPath}`;
        }
        const url = `${bBase}${usePath}`;
        let parsed;
        try { parsed = new URL(url); } catch { continue; }

        if (!isSelf) { totals.calls += 1; pairTotals.calls += 1; }
        else { rightSpecCost.calls += 1; }

        let matched = null;
        try { matched = matchOperation(B.ops, B.servers, op.method, url); } catch { matched = null; }
        if (!matched) continue;

        if (!isSelf) { totals.matches += 1; pairTotals.matches += 1; }
        else { rightSpecCost.matches += 1; }

        const lTruth = classifyRow(op).class;
        const lWrong = classifyRow(matched.op).class;
        const lReq = classifyRow({ method: op.method, path: parsed.pathname }).class;
        const lFinal = tighterOf(lWrong, lReq);

        if (!isSelf) {
          const looserThanTruth = TIGHTNESS[lWrong] < TIGHTNESS[lTruth];
          const looserThanReq = TIGHTNESS[lWrong] < TIGHTNESS[lReq];
          const looserThanBoth = looserThanTruth && looserThanReq;
          const finalStillLooser = TIGHTNESS[lFinal] < TIGHTNESS[lTruth];
          if (looserThanTruth) { totals.looserThanTruth += 1; pairTotals.looserThanTruth += 1; }
          if (looserThanReq) { totals.looserThanReq += 1; pairTotals.looserThanReq += 1; }
          if (looserThanBoth) {
            totals.looserThanBoth += 1; pairTotals.looserThanBoth += 1;
            worstRowsAll.push({
              A: A.label, B: B.label, method: op.method,
              aPath: op.path, aOpId: op.operationId || null,
              bPath: matched.op.path, bOpId: matched.op.operationId || null,
              lTruth, lWrong, lReq,
            });
          }
          if (finalStillLooser) { totals.finalStillLooser += 1; pairTotals.finalStillLooser += 1; }
        } else {
          // A right spec's OWN match can land on a different operation of
          // its own doc than the one that generated the URL (a template
          // tie or a structurally-identical sibling path) - lWrong here
          // IS that self-matched op's class (called lSpec in the report),
          // and it can differ from lTruth even before lFinal/tighterOf
          // enters the picture at all. Counted separately from
          // changed/tighter/looser, which are about lFinal vs lTruth.
          if (lWrong !== lTruth) rightSpecCost.specMismatch += 1;
          // Three-way split, explicit rather than assumed: TIGHTNESS maps
          // each of the three letters to a distinct number (r=0,w=1,x=2),
          // so lFinal!==lTruth (a string compare) and an equal-tightness
          // "changed" row are mutually exclusive - equal is tracked
          // anyway so that invariant is verified, not just assumed.
          if (TIGHTNESS[lFinal] > TIGHTNESS[lTruth]) {
            rightSpecCost.changed += 1;
            rightSpecCost.tighter += 1;
            rightSpecCostRows.push({ vendor: A.label, method: op.method, path: op.path, opId: op.operationId || null, lTruth, lSpec: lWrong, lReq, lFinal, direction: 'tighter' });
          } else if (TIGHTNESS[lFinal] < TIGHTNESS[lTruth]) {
            rightSpecCost.changed += 1;
            rightSpecCost.looser += 1;
            rightSpecCostRows.push({ vendor: A.label, method: op.method, path: op.path, opId: op.operationId || null, lTruth, lSpec: lWrong, lReq, lFinal, direction: 'looser' });
          } else {
            rightSpecCost.equal += 1;
          }
        }
      }

      if (!isSelf && pairTotals.calls > 0) pairRows.push({ A: A.label, B: B.label, ...pairTotals });
    }
  }

  const worstPairs = [...pairRows].sort((a, b) => b.looserThanBoth - a.looserThanBoth).slice(0, 20);
  const top5PairKeys = new Set(worstPairs.slice(0, 5).map((p) => `${p.A}|${p.B}`));
  const top5Rows = worstRowsAll.filter((r) => top5PairKeys.has(`${r.A}|${r.B}`));

  return { variant: variantName, totals, rightSpecCost, rightSpecCostRows, worstPairs, top5Rows, pairCount: pairRows.length };
}

async function runM3(specs) {
  console.log('M3: running variant 1 (A real absolute path, base-path kept, onto B base)...');
  const v1 = runM3Variant(specs, 'a-basepath-kept', true);
  console.log('M3: variant 1 done.', JSON.stringify(v1.totals));
  console.log('M3: variant 1 rightSpecCost.', JSON.stringify(v1.rightSpecCost));
  for (const r of v1.rightSpecCostRows) console.log('  v1 rightSpecCost row:', JSON.stringify(r));
  console.log('M3: running variant 2 (A base-path segment dropped, template path only)...');
  const v2 = runM3Variant(specs, 'a-basepath-dropped', false);
  console.log('M3: variant 2 done.', JSON.stringify(v2.totals));
  console.log('M3: variant 2 rightSpecCost.', JSON.stringify(v2.rightSpecCost));
  for (const r of v2.rightSpecCostRows) console.log('  v2 rightSpecCost row:', JSON.stringify(r));
  return { variant1: v1, variant2: v2 };
}

// =======================================================================
// Main
// =======================================================================

async function main() {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });

  const liveData = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'discover-live-2026-09-28', 'results.json'), 'utf8'));
  const formatsData = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'formats-2026-09-27', 'results.json'), 'utf8'));

  console.log('=== loading 37 locked specs ===');
  const specs = await loadAllSpecs();
  console.log(`loaded ${specs.length} specs, ${specs.reduce((s, x) => s + x.ops.length, 0)} total operations`);

  console.log('');
  console.log('=== M1: where specs are found ===');
  const m1 = runM1(liveData, formatsData);
  console.log('place counts (shipped-algorithm finds only):', JSON.stringify(m1.placeCounts));
  console.log('shipped finds total:', m1.shippedFindsTotal);
  console.log('steps by rank:', JSON.stringify(m1.stepsByRank));
  console.log('top2:', JSON.stringify({ keptSteps: m1.top2.keptSteps, totalShipped: m1.top2.totalShipped, stillFound: m1.top2.stillFound }));
  console.log('top3:', JSON.stringify({ keptSteps: m1.top3.keptSteps, totalShipped: m1.top3.totalShipped, stillFound: m1.top3.stillFound }));
  console.log('zoom:', JSON.stringify(m1.zoom));
  console.log('per-vendor step requests:');
  for (const [v, c] of Object.entries(m1.perVendorStepRequests)) console.log(`  ${v}\t${JSON.stringify(c)}`);

  console.log('');
  console.log('=== M2: operation-count bar for a wrong spec ===');
  const m2 = await runM2(specs, liveData);
  console.log(`real specs: n=${m2.realSpecCount} min=${m2.min} p5=${m2.p5} median=${m2.median}`);
  console.log('smallest 10:', JSON.stringify(m2.smallest10, null, 2));
  console.log('formats-2026-09-27 has local spec copies:', m2.formatsHasLocalSpecCopies);
  console.log('wrong specs:', JSON.stringify(m2.wrongSpecs, null, 2));
  console.log('bars:', JSON.stringify(m2.bars, null, 2));

  console.log('');
  console.log('=== M3: cross-vendor wrong-spec risk ===');
  const m3 = await runM3(specs);

  const out = {
    generatedAt: new Date().toISOString(),
    m1,
    m2,
    m3,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log('');
  console.log(`wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
