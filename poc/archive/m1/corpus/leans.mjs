#!/usr/bin/env node
// M1-C3: build a verb/noun "lean" table (prior evidence, not truth) from
// CORPUS_DIR/ops.csv by method co-occurrence — for each token, which HTTP
// methods it travels with, counted both raw (per-operation) and per
// distinct provider. See docs/product/prd.md PRD §8, D7.
//
// Do not interpret this output into r/w/x classifications — that is a
// later pass; this is prior evidence only.
//
// Usage: node leans.mjs

import fs from 'node:fs';
import path from 'node:path';
import { parseCsv, toCsv } from '../../m0/csv.mjs';

const CORPUS_DIR = process.env.CORPUS_DIR
  || '/tmp/claude-1000/-home-hamr-PycharmProjects-rwxmap/5e1207e7-5a40-4424-afe1-4b1a53e86dc5/scratchpad/corpus/';
const OPS_PATH = path.join(CORPUS_DIR, 'ops.csv');
const OUT_PATH = path.join(CORPUS_DIR, 'leans.csv');

// Defensive re-application of the hold-out exclusion (extract.mjs already
// excludes these; this guards against a stale/unfiltered ops.csv).
const EXCLUDED_PROVIDERS = new Set([
  'twilio.com', 'stripe.com', 'github.com', 'box.com', 'pagerduty.com', 'adyen.com',
]);

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// ---- tokenization ----

// Split camelCase, snake_case, kebab-case, dots, and digit runs.
function splitToken(raw) {
  if (!raw) return [];
  let s = String(raw);
  // Insert a boundary before an uppercase letter that follows a lowercase
  // letter or digit (camelCase boundary).
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  // Split off digit runs from surrounding letters.
  s = s.replace(/([A-Za-z])([0-9])/g, '$1 $2').replace(/([0-9])([A-Za-z])/g, '$1 $2');
  // snake_case, kebab-case, dots, and remaining whitespace all become
  // separators.
  const parts = s.split(/[_\-.\s]+/).filter((p) => p.length > 0);
  return parts.map((p) => p.toLowerCase());
}

function tokenizeOperationId(operationId) {
  return splitToken(operationId);
}

function tokenizePathSegments(p) {
  const segments = p.split('/').filter((s) => s.length > 0);
  const out = [];
  for (const seg of segments) {
    if (/^\{.*\}$/.test(seg)) continue; // {param} placeholder
    if (/^v\d+$/i.test(seg)) continue; // pure version segment
    out.push(...splitToken(seg));
  }
  return out;
}

// First sub-token of the first whitespace-delimited word of summary,
// tokenized the same way as operationId/path segments.
function tokenizeSummaryLead(summary) {
  if (!summary) return null;
  const firstWord = summary.trim().split(/\s+/)[0];
  if (!firstWord) return null;
  const toks = splitToken(firstWord);
  return toks.length > 0 ? toks[0] : null;
}

function dedupe(arr) {
  return [...new Set(arr)];
}

function main() {
  const rawRows = parseCsv(fs.readFileSync(OPS_PATH, 'utf8'));
  const rows = rawRows.filter((r) => !EXCLUDED_PROVIDERS.has(r.provider));
  const excludedByGuard = rawRows.length - rows.length;
  if (excludedByGuard > 0) {
    console.log(`leans.mjs defensive guard removed ${excludedByGuard} rows still tagged with an excluded provider (ops.csv was not pre-filtered)`);
  }

  // ---- pass 1: collect raw token frequency set across the whole corpus ----
  // (from operationId tokens, path tokens, and summary-lead tokens) — used
  // for the light stemming rule.
  const rawTokenSet = new Set();
  const perOpTokens = []; // { provider, method, leadTok, opidToks, pathToks }

  for (const r of rows) {
    const opidToks = tokenizeOperationId(r.operationId);
    const pathToks = tokenizePathSegments(r.path);
    let leadTok = null;
    if (opidToks.length > 0) {
      leadTok = opidToks[0];
    } else {
      leadTok = tokenizeSummaryLead(r.summary);
    }
    for (const t of opidToks) rawTokenSet.add(t);
    for (const t of pathToks) rawTokenSet.add(t);
    if (leadTok) rawTokenSet.add(leadTok);
    perOpTokens.push({ provider: r.provider, method: r.method, leadTok, opidToks, pathToks });
  }

  // Light stemming: a token of length >= 3 (before trailing 's') ending in
  // 's' (regex /^.{3,}s$/, i.e. at least 4 chars total) gets replaced by its
  // singular IF that singular form is itself present somewhere in the raw
  // token set; otherwise kept as-is.
  const stemCache = new Map();
  function stem(tok) {
    if (stemCache.has(tok)) return stemCache.get(tok);
    let out = tok;
    if (/^.{3,}s$/.test(tok)) {
      const singular = tok.slice(0, -1);
      if (rawTokenSet.has(singular)) out = singular;
    }
    stemCache.set(tok, out);
    return out;
  }

  // ---- pass 2: apply stemming, then accumulate per (token, position, method) ----
  // cell[position][token] = { rawByMethod: Map<method,count>, providersByMethod: Map<method,Set<provider>>, providersAny: Set<provider> }
  const cells = { lead: new Map(), opid: new Map(), path: new Map() };

  function getCell(position, token) {
    const m = cells[position];
    let c = m.get(token);
    if (!c) {
      c = { rawByMethod: new Map(), providersByMethod: new Map(), providersAny: new Set() };
      m.set(token, c);
    }
    return c;
  }

  function bump(position, token, method, provider) {
    const c = getCell(position, token);
    c.rawByMethod.set(method, (c.rawByMethod.get(method) || 0) + 1);
    if (!c.providersByMethod.has(method)) c.providersByMethod.set(method, new Set());
    c.providersByMethod.get(method).add(provider);
    c.providersAny.add(provider);
  }

  for (const { provider, method, leadTok, opidToks, pathToks } of perOpTokens) {
    if (!METHODS.includes(method)) continue; // TRACE etc. out of scope

    if (leadTok) {
      bump('lead', stem(leadTok), method, provider);
    }
    for (const t of dedupe(opidToks.map(stem))) {
      bump('opid', t, method, provider);
    }
    for (const t of dedupe(pathToks.map(stem))) {
      bump('path', t, method, provider);
    }
  }

  // ---- build output rows ----
  const outRows = [];
  for (const position of ['lead', 'opid', 'path']) {
    for (const [token, c] of cells[position].entries()) {
      const providers = c.providersAny.size;
      let opsTotal = 0;
      for (const n of c.rawByMethod.values()) opsTotal += n;
      const row = { token, position, providers: String(providers), ops_total: String(opsTotal) };
      for (const method of METHODS) {
        row[`raw_${method.toLowerCase()}`] = String(c.rawByMethod.get(method) || 0);
      }
      for (const method of METHODS) {
        const set = c.providersByMethod.get(method);
        row[`perprov_${method.toLowerCase()}`] = String(set ? set.size : 0);
      }
      row._providersNum = providers;
      row._opsTotalNum = opsTotal;
      outRows.push(row);
    }
  }

  outRows.sort((a, b) => {
    if (b._providersNum !== a._providersNum) return b._providersNum - a._providersNum;
    if (b._opsTotalNum !== a._opsTotalNum) return b._opsTotalNum - a._opsTotalNum;
    return a.token.localeCompare(b.token);
  });

  const header = [
    'token', 'position', 'providers', 'ops_total',
    'raw_get', 'raw_post', 'raw_put', 'raw_patch', 'raw_delete', 'raw_head', 'raw_options',
    'perprov_get', 'perprov_post', 'perprov_put', 'perprov_patch', 'perprov_delete', 'perprov_head', 'perprov_options',
  ];
  fs.writeFileSync(OUT_PATH, toCsv(outRows, header));

  console.log(`Rows written: ${outRows.length} (lead=${cells.lead.size}, opid=${cells.opid.size}, path=${cells.path.size})`);
  console.log('Wrote', OUT_PATH);
}

main();
