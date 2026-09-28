#!/usr/bin/env node
// Validate the SHIPPED src/discover.js (not the POC) against the live
// internet, and measure whether a wrong spec can give a call a LOOSER
// letter than either the truth (the right spec) or a per-request-only
// read.
//
// This is a validation script, not production code: it imports
// findSpec/classifyCall from ../../src/discover.js, classifyRow/
// operationsFrom from ../../src/index.js and loadSpec from
// ../../src/load.js - READ ONLY, nothing here edits src/. It reuses
// collectVendorRows from ./vendors.mjs for the 25-vendor list (vendor,
// derived API host, locked spec path) and does NOT touch probe.mjs.
//
// PART 1 - live discovery: call findSpec('https://' + apiHost) for each
// of the 25 vendors, one after another (findSpec already serializes its
// own requests via its internal politeness queue), against a FRESH temp
// cache dir so nothing is served from a pre-existing cache. Every real
// fetch is counted (globalThis.fetch is wrapped, pass-through, method +
// URL recorded) so requests-per-vendor and a full safety scan of the
// request log are both real measurements, not estimates. For every
// 'found' spec, overlap against the locked spec's (METHOD, path) keys is
// computed exactly as poc/discover/probe.mjs's validateCandidate does,
// labelled RIGHT (>= 0.5) or WRONG (< 0.5).
//
// PART 2 - wrong-spec looser check: for every vendor findSpec found
// something for (RIGHT or WRONG), take the LOCKED spec's own operations,
// synthesize a real-looking call URL against the vendor's live API base
// (the locked spec's own first resolved server, {param} segments filled
// with a fixed '12345', same shape as poc/match/measure.mjs), and compare
// three letters per call: L_truth (classifyRow on the locked op - the
// right answer), L_call (classifyCall against whatever findSpec actually
// found - what a live caller of src/discover.js would get), and L_req
// (classifyRow on method+pathname alone, no spec at all - the per-request
// fallback). The go/no-go number is: how many rows get an L_call STRICTLY
// LOOSER than L_truth because they matched into a (possibly wrong) spec -
// that must be 0.
//
// Politeness: run once. Findings and the full request log are saved to
// data/discover-live-2026-09-28/results.json.

import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findSpec, classifyCall } from '../../src/discover.js';
import { classifyRow, operationsFrom } from '../../src/index.js';
import { loadSpec } from '../../src/load.js';
import { collectVendorRows } from './vendors.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'data', 'discover-live-2026-09-28');
const OUT_FILE = path.join(OUT_DIR, 'results.json');

const OVERLAP_THRESHOLD = 0.5;
const TIGHTNESS = { r: 0, w: 1, x: 2 };

// ---------------------------------------------------------------------
// fetch wrapper - pass-through, records every real request made by
// anything under src/ during this run (loadSpec's own fetch included,
// since only globalThis.fetch is wrapped, not a per-module option).
// ---------------------------------------------------------------------
const realFetch = globalThis.fetch;
const requestLog = []; // { method, url, t: Date.now() }
globalThis.fetch = async (input, init) => {
  const method = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
  const url = typeof input === 'string' ? input : (input && input.url) ? input.url : String(input);
  requestLog.push({ method: String(method).toUpperCase(), url, t: Date.now() });
  return realFetch(input, init);
};

function restoreFetch() {
  globalThis.fetch = realFetch;
}

// ---------------------------------------------------------------------
// Safety-gate check, duplicated read-only from src/discover.js's
// unsafeReason (not exported) - used only to scan the request log after
// the fact, never to alter any request src/discover.js itself made.
// ---------------------------------------------------------------------
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
function isIpLiteral(hostname) {
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true;
  return IPV4_RE.test(hostname);
}
function unsafeReasonFor(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return 'does not parse as a URL';
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:') return 'not https';
  if (host === 'localhost') return 'localhost';
  if (isIpLiteral(host)) return 'IP-literal host';
  if (!host.includes('.')) return 'single-label host';
  return null;
}

// ---------------------------------------------------------------------
// Overlap - identical shape to poc/discover/probe.mjs's
// validateCandidate/opKeys, computed here against the ALREADY-LOADED
// found spec (no extra network call).
// ---------------------------------------------------------------------
function opKeys(ops) {
  return new Set(ops.map((o) => `${o.method} ${o.path}`));
}
function overlapOf(lockedKeys, foundOps) {
  const foundKeys = opKeys(foundOps);
  let hits = 0;
  for (const k of lockedKeys) if (foundKeys.has(k)) hits += 1;
  const overlap = lockedKeys.size > 0 ? hits / lockedKeys.size : 0;
  return { overlap, label: overlap >= OVERLAP_THRESHOLD ? 'RIGHT' : 'WRONG' };
}

// ---------------------------------------------------------------------
// Server resolution + template fill for Part 2 - duplicated read-only
// from poc/match/measure.mjs's resolvedServers/resolveServerVariables
// (src/discover.js's own copy of this logic is internal, not exported;
// this is the same "data, duplicated on purpose" rule every poc/ file in
// this area already follows).
// ---------------------------------------------------------------------
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
function fillTemplate(templatePath) {
  return String(templatePath || '').replace(/\{[^}]+\}/g, '12345');
}

// ---------------------------------------------------------------------
// PART 1 - live discovery
// ---------------------------------------------------------------------
async function runPart1(vendorRows, cacheDir) {
  const perVendor = [];
  for (const row of vendorRows) {
    const { vendor, host: apiHost, specPath } = row;
    const beforeIdx = requestLog.length;
    const t0 = Date.now();

    let found;
    let threw = null;
    try {
      found = await findSpec(`https://${apiHost}`, { cacheDir });
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
      found = null;
    }
    const seconds = (Date.now() - t0) / 1000;
    const requestsMade = requestLog.length - beforeIdx;

    let overlap = null;
    let opCount = 0;
    if (found && found.status === 'found') {
      opCount = found.ops.length;
      let lockedDoc;
      try {
        ({ doc: lockedDoc } = await loadSpec(path.join(REPO_ROOT, specPath)));
        const lockedKeys = opKeys(operationsFrom(lockedDoc));
        overlap = overlapOf(lockedKeys, found.ops);
      } catch (err) {
        overlap = { overlap: null, label: `error computing overlap: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    perVendor.push({
      vendor,
      apiHost,
      status: threw ? 'threw' : found.status,
      threw,
      reason: found ? found.reason || null : null,
      specUrl: found ? found.specUrl || null : null,
      opCount,
      overlap: overlap ? overlap.overlap : null,
      overlapLabel: overlap ? overlap.label : null,
      requestsMade,
      seconds,
      fromCache: found ? !!found.fromCache : null,
    });

    console.log(
      `${vendor}\tstatus=${threw ? 'threw' : found.status}`
      + `${found && found.reason ? ` reason=${found.reason}` : ''}`
      + `${found && found.specUrl ? ` specUrl=${found.specUrl}` : ''}`
      + ` ops=${opCount}`
      + `${overlap ? ` overlap=${overlap.overlap === null ? overlap.label : `${(overlap.overlap * 100).toFixed(0)}% (${overlap.label})`}` : ''}`
      + ` requests=${requestsMade} seconds=${seconds.toFixed(2)}`,
    );
  }
  return perVendor;
}

// ---------------------------------------------------------------------
// Cache re-check - 3 vendors, expect fromCache true and zero requests.
// ---------------------------------------------------------------------
async function runCacheRecheck(vendorRows, cacheDir, n = 3) {
  const picks = vendorRows.slice(0, n);
  const out = [];
  for (const row of picks) {
    const beforeIdx = requestLog.length;
    const found = await findSpec(`https://${row.host}`, { cacheDir });
    const requestsMade = requestLog.length - beforeIdx;
    out.push({ vendor: row.vendor, fromCache: !!found.fromCache, requestsMade, status: found.status });
  }
  return out;
}

// ---------------------------------------------------------------------
// PART 2 - wrong-spec looser check
// ---------------------------------------------------------------------
async function runPart2(vendorRows, part1Results, cacheDir) {
  const foundVendors = new Map(
    part1Results.filter((r) => r.status === 'found').map((r) => [r.vendor, r]),
  );

  const perVendorTotals = [];
  const looserRows = [];
  const totals = {
    calls: 0,
    matchedSpec: 0,
    matchedRequest: 0,
    looserThanTruth: 0,
    looserThanReq: 0,
    tighterThanTruth: 0,
  };

  for (const row of vendorRows) {
    if (!foundVendors.has(row.vendor)) continue;
    const { vendor, host: apiHost, specPath } = row;

    let found;
    try {
      // Re-discover under the SAME fresh cache dir Part 1 used - this is
      // a cache hit (fromCache true, 0 new requests), not a second live
      // probe.
      found = await findSpec(`https://${apiHost}`, { cacheDir });
    } catch {
      continue;
    }
    if (!found || found.status !== 'found') continue;

    let lockedDoc;
    try {
      ({ doc: lockedDoc } = await loadSpec(path.join(REPO_ROOT, specPath)));
    } catch (err) {
      perVendorTotals.push({ vendor, error: `locked spec reload failed: ${err instanceof Error ? err.message : String(err)}` });
      continue;
    }
    const lockedOps = operationsFrom(lockedDoc);
    const servers = resolvedServers(lockedDoc);
    if (servers.length === 0) {
      perVendorTotals.push({ vendor, error: 'locked spec declares no servers - cannot synthesize a call URL' });
      continue;
    }
    const base = stripTrailingSlash(servers[0]);

    const vTotals = {
      vendor, calls: 0, matchedSpec: 0, matchedRequest: 0,
      looserThanTruth: 0, looserThanReq: 0, tighterThanTruth: 0,
    };

    for (const op of lockedOps) {
      const filledPath = fillTemplate(op.path);
      let url;
      try {
        url = `${base}${filledPath}`;
        new URL(url); // validate it actually parses before classifying
      } catch {
        continue;
      }

      const lTruth = classifyRow(op).class;
      let call;
      try {
        call = classifyCall(found, op.method, url);
      } catch (err) {
        perVendorTotals.push({ vendor, op: { method: op.method, path: op.path }, error: `classifyCall threw: ${err instanceof Error ? err.message : String(err)}` });
        continue;
      }
      const lCall = call.letter;
      let pathname;
      try {
        pathname = new URL(url).pathname;
      } catch {
        continue;
      }
      const lReq = classifyRow({ method: op.method, path: pathname }).class;

      vTotals.calls += 1;
      totals.calls += 1;
      if (call.source === 'spec') { vTotals.matchedSpec += 1; totals.matchedSpec += 1; }
      else { vTotals.matchedRequest += 1; totals.matchedRequest += 1; }

      const looserThanTruth = TIGHTNESS[lCall] < TIGHTNESS[lTruth];
      const looserThanReq = TIGHTNESS[lCall] < TIGHTNESS[lReq];
      const tighterThanTruth = TIGHTNESS[lCall] > TIGHTNESS[lTruth];

      if (looserThanTruth) { vTotals.looserThanTruth += 1; totals.looserThanTruth += 1; }
      if (looserThanReq) { vTotals.looserThanReq += 1; totals.looserThanReq += 1; }
      if (tighterThanTruth) { vTotals.tighterThanTruth += 1; totals.tighterThanTruth += 1; }

      if (looserThanTruth || looserThanReq) {
        looserRows.push({
          vendor,
          method: op.method,
          lockedPath: op.path,
          operationId: op.operationId || null,
          matchedKey: call.key,
          source: call.source,
          url,
          lTruth,
          lCall,
          lReq,
          looserThanTruth,
          looserThanReq,
        });
      }
    }
    perVendorTotals.push(vTotals);
  }

  return { perVendorTotals, looserRows, totals };
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------
async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'rwxmap-live-discover-'));
  console.log(`fresh cache dir: ${cacheDir}`);

  const allVendorRows = await collectVendorRows();
  const vendorRows = allVendorRows.filter((r) => r.host); // all 25 should have a host
  if (vendorRows.length !== allVendorRows.length) {
    console.log(`WARNING: ${allVendorRows.length - vendorRows.length} vendor row(s) had no derivable host and were skipped`);
  }
  console.log(`${vendorRows.length} vendors loaded from collectVendorRows()`);
  console.log('');
  console.log('=== PART 1: live discovery ===');
  const part1 = await runPart1(vendorRows, cacheDir);

  console.log('');
  console.log('=== cache re-check (3 vendors, expect fromCache=true, requests=0) ===');
  const cacheRecheck = await runCacheRecheck(vendorRows, cacheDir, 3);
  for (const r of cacheRecheck) {
    console.log(`${r.vendor}\tfromCache=${r.fromCache}\trequests=${r.requestsMade}\tstatus=${r.status}`);
  }

  console.log('');
  console.log('=== request-log safety scan ===');
  const unsafeRequests = requestLog
    .map((r) => ({ ...r, reason: unsafeReasonFor(r.url) }))
    .filter((r) => r.reason);
  console.log(`total requests logged: ${requestLog.length}`);
  console.log(`unsafe requests (must be 0): ${unsafeRequests.length}`);
  for (const r of unsafeRequests) console.log(`  UNSAFE: ${r.method} ${r.url} (${r.reason})`);

  console.log('');
  console.log('=== PART 2: wrong-spec looser check ===');
  const part2 = await runPart2(vendorRows, part1, cacheDir);
  for (const v of part2.perVendorTotals) {
    if (v.error) {
      console.log(`${v.vendor}: ${v.error}`);
      continue;
    }
    console.log(
      `${v.vendor}\tcalls=${v.calls} matchedSpec=${v.matchedSpec} matchedRequest=${v.matchedRequest} `
      + `looserThanTruth=${v.looserThanTruth} looserThanReq=${v.looserThanReq} tighterThanTruth=${v.tighterThanTruth}`,
    );
  }
  console.log('');
  console.log('--- TOTALS ---');
  console.log(JSON.stringify(part2.totals, null, 2));

  restoreFetch();

  const results = {
    generatedAt: new Date().toISOString(),
    cacheDir,
    vendorCount: vendorRows.length,
    part1,
    cacheRecheck,
    requestLog,
    unsafeRequestCount: unsafeRequests.length,
    unsafeRequests,
    part2,
  };
  await writeFile(OUT_FILE, JSON.stringify(results, null, 2));
  console.log('');
  console.log(`wrote ${OUT_FILE}`);
  console.log(`cache dir kept at: ${cacheDir}`);
}

main().catch((err) => {
  restoreFetch();
  console.error(err);
  process.exitCode = 1;
});
