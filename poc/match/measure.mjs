#!/usr/bin/env node
// Pass 2 of item b (spec discovery), step 4 — measures matchOperation
// (poc/match/match.mjs) and requestKey (poc/match/key.mjs) against every
// locked, loadable spec in the four sets (the same four tools/proof-load.js
// and poc/input/measure.mjs use): data/provider-corpus-2026-09-16,
// data/exam-2026-09-17, data/exam-2026-09-20, data/exam-2026-09-22.
//
// SKIPPED, per the brief: digitalocean's 684 single-operation fragment
// files (only the one aggregator spec, DigitalOcean-public.v2.yaml.gz, is
// measured for that vendor) and hubspot (its one lock entry is a
// tar.gz collection, not a loadable OpenAPI document by itself).
//
// For every operation in a spec (doc order), this builds ONE concrete
// URL by filling each `{param}` template segment with a synthetic value,
// alternating deterministically through four candidates in this fixed
// rotation, advancing a per-run counter every time a param does NOT match
// the name/slug/key override below:
//   0: '12345'                          (all-digit)
//   1: '550e8400-e29b-41d4-a716-446655440000'  (UUID)
//   2: 'abcdef0123456789abcdef01'        (24-char hex)
//   3: 'cus_NffrFeUfNV2Hib'              (a prefixed id — SEE THE FLAG in
//      key.mjs's header: this is the brief's own example and is only 18
//      characters, one short of key.mjs's stated 20-char floor for the
//      mixed-id candidate rule, so it deliberately never triggers that
//      rule; that is used here for real, not glossed over — see (b)'s
//      per-variant counts)
// A param whose name (the `{...}` content) contains "name", "slug" or
// "key" (case-insensitive) gets 'acme-prod' instead, and does not consume
// a rotation slot.
//
// (a) matchOperation must return the SAME operation object for its own
//     synthesized URL. Counts exact / wrong-op / no-match per vendor,
//     up to 5 examples of each, and every tie (reported, not hidden).
// (b) requestKey on the same URLs: how many distinct operations collapse
//     onto one key, per vendor, for the 3-rule default and (separately,
//     never silently blended in) the 4-rule mixedIds:true variant.
// (c) The same URLs with the winning server's OWN base path removed (so
//     e.g. "/v1/customers/x" becomes "/customers/x") — does
//     matchOperation still match, and is it still the right operation?
//
// Exit 1 iff (a) has any wrong-op anywhere. No rule in key.mjs or
// match.mjs is tuned by this file to make its own numbers look better.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpec } from '../../src/load.js';
import { operationsFrom } from '../../src/index.js';
import { matchOperation } from './match.mjs';
import { requestKey } from './key.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SETS = [
  'data/provider-corpus-2026-09-16',
  'data/exam-2026-09-17',
  'data/exam-2026-09-20',
  'data/exam-2026-09-22',
];

const EXAMPLE_LIMIT = 5;

const ROTATION = [
  '12345',
  '550e8400-e29b-41d4-a716-446655440000',
  'abcdef0123456789abcdef01',
  'cus_NffrFeUfNV2Hib',
];
const NAME_OVERRIDE_RE = /name|slug|key/i;

/** @returns {{setDir: string, provider: string, filePath: string, lockPath: string}[]} */
function collectSpecFiles() {
  const files = [];
  for (const setDir of SETS) {
    const lockPath = path.join(REPO_ROOT, setDir, 'specs.lock.json');
    const entries = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    for (const entry of entries) {
      if (entry.provider === 'hubspot') continue; // tar.gz collection, not one loadable doc
      if (entry.provider === 'digitalocean' && entry.path.includes('/resources/')) continue; // fragments, skipped per the brief
      const filePath = path.join(REPO_ROOT, setDir, 'specs', entry.path);
      files.push({ setDir, provider: entry.provider, filePath, lockPath: entry.path });
    }
  }
  return files;
}

/**
 * Resolve an OpenAPI 3 `servers[].url` template's variables to their
 * defaults (falling back to the variable name itself, or the first enum
 * value, when a variable carries no `default` — non-conformant but seen
 * nowhere in this corpus; kept defensive rather than throwing).
 * @param {string} url
 * @param {Record<string, {default?: string, enum?: string[]}>} variables
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
 * @param {any} doc
 * @returns {string[]} resolved, absolute server base URLs, doc order,
 *   deduplicated by exact string.
 */
function resolvedServers(doc) {
  const urls = [];
  if (Array.isArray(doc.servers) && doc.servers.length > 0) {
    for (const s of doc.servers) {
      if (!s || typeof s.url !== 'string') continue;
      urls.push(resolveServerVariables(s.url, s.variables));
    }
  } else if (typeof doc.host === 'string' && doc.host) {
    // Swagger 2.
    const scheme = Array.isArray(doc.schemes) && doc.schemes.length > 0 ? doc.schemes[0] : 'https';
    const basePath = typeof doc.basePath === 'string' ? doc.basePath : '';
    urls.push(`${scheme}://${doc.host}${basePath}`);
  }
  return [...new Set(urls)];
}

/**
 * Fill every `{param}` segment in a path template with a synthetic value.
 * `counterRef` is a one-element array used as a mutable cursor so the
 * rotation advances across the WHOLE measurement run, not per-operation.
 * @param {string} templatePath
 * @param {[number]} counterRef
 * @returns {string}
 */
function fillTemplate(templatePath, counterRef) {
  return templatePath.replace(/\{([^}]+)\}/g, (whole, name) => {
    if (NAME_OVERRIDE_RE.test(name)) return 'acme-prod';
    const value = ROTATION[counterRef[0] % ROTATION.length];
    counterRef[0] += 1;
    return value;
  });
}

/** @param {string} base */
function stripTrailingSlash(base) {
  return base.endsWith('/') && base.length > 1 ? base.slice(0, -1) : base;
}

function collectCollisions(keyToIdxs, ops) {
  const collisions = [];
  for (const [key, idxs] of keyToIdxs) {
    if (idxs.size > 1) {
      collisions.push({
        key,
        ops: [...idxs].map((i) => ({ method: ops[i].method, path: ops[i].path })),
      });
    }
  }
  collisions.sort((a, b) => b.ops.length - a.ops.length);
  return collisions;
}

async function measureOneSpec(file) {
  const result = {
    provider: file.provider,
    lockPath: file.lockPath,
    loadError: null,
    opCount: 0,
    noServers: false,
    a: { exact: 0, wrongOp: 0, noMatch: 0, ties: 0, wrongOpExamples: [], noMatchExamples: [] },
    b3: { keyToIdxs: new Map(), ops: [] },
    b4: { keyToIdxs: new Map(), ops: [] },
    c: { stillMatches: 0, stillRightOp: 0, stillWrongOp: 0, total: 0, examples: [] },
  };

  let doc;
  try {
    ({ doc } = await loadSpec(file.filePath));
  } catch (err) {
    result.loadError = err instanceof Error ? err.message : String(err);
    return result;
  }

  const ops = operationsFrom(doc);
  result.opCount = ops.length;
  const servers = resolvedServers(doc);
  if (servers.length === 0) {
    result.noServers = true;
    return result;
  }
  const primaryServer = servers[0];
  const primaryBase = stripTrailingSlash(primaryServer);
  const origin = new URL(primaryServer).origin;

  const counterRef = [0];
  result.b3.ops = ops;
  result.b4.ops = ops;

  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx];
    const filledPath = fillTemplate(op.path || '', counterRef);
    const url = `${primaryBase}${filledPath}`;

    // (a)
    let matched;
    try {
      matched = matchOperation(ops, servers, op.method, url);
    } catch (err) {
      matched = null;
    }
    if (matched && matched.op === op) {
      result.a.exact++;
      if (matched.tie) result.a.ties++;
    } else if (matched && matched.op !== op) {
      result.a.wrongOp++;
      if (result.a.wrongOpExamples.length < EXAMPLE_LIMIT) {
        result.a.wrongOpExamples.push({
          expected: { method: op.method, path: op.path },
          got: { method: matched.op.method, path: matched.op.path },
          url,
        });
      }
    } else {
      result.a.noMatch++;
      if (result.a.noMatchExamples.length < EXAMPLE_LIMIT) {
        result.a.noMatchExamples.push({ expected: { method: op.method, path: op.path }, url });
      }
    }

    // (b) 3-rule and 4-rule request keys
    const key3 = requestKey(op.method, url);
    if (!result.b3.keyToIdxs.has(key3)) result.b3.keyToIdxs.set(key3, new Set());
    result.b3.keyToIdxs.get(key3).add(idx);

    const key4 = requestKey(op.method, url, { mixedIds: true });
    if (!result.b4.keyToIdxs.has(key4)) result.b4.keyToIdxs.set(key4, new Set());
    result.b4.keyToIdxs.get(key4).add(idx);

    // (c) wrong-base-path variant: same host, filled path, but WITHOUT
    // the winning server's own base path.
    const wrongBaseUrl = `${origin}${filledPath}`;
    result.c.total++;
    let matchedWrongBase;
    try {
      matchedWrongBase = matchOperation(ops, servers, op.method, wrongBaseUrl);
    } catch {
      matchedWrongBase = null;
    }
    if (matchedWrongBase) {
      result.c.stillMatches++;
      if (matchedWrongBase.op === op) {
        result.c.stillRightOp++;
      } else {
        result.c.stillWrongOp++;
        if (result.c.examples.length < EXAMPLE_LIMIT) {
          result.c.examples.push({
            expected: { method: op.method, path: op.path },
            got: { method: matchedWrongBase.op.method, path: matchedWrongBase.op.path },
            url: wrongBaseUrl,
          });
        }
      }
    }
  }

  return result;
}

function printVendorTable(setDir, results) {
  console.log(`\n=== ${setDir} ===`);
  const w = { provider: 14, ops: 6, exact: 7, wrong: 7, none: 7, ties: 6, k3: 10, k4: 10, cMatch: 8, cRight: 8, cWrong: 8 };
  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    pad('provider', w.provider) + pad('ops', w.ops) + pad('exact', w.exact) + pad('wrongOp', w.wrong)
    + pad('noMatch', w.none) + pad('ties', w.ties) + pad('coll@3', w.k3) + pad('coll@4', w.k4)
    + pad('c:match', w.cMatch) + pad('c:right', w.cRight) + pad('c:wrong', w.cWrong),
  );

  const totals = {
    opCount: 0, exact: 0, wrongOp: 0, noMatch: 0, ties: 0,
    coll3: 0, coll4: 0, cMatch: 0, cRight: 0, cWrong: 0,
  };

  for (const r of results) {
    if (r.loadError) {
      console.log(`${pad(r.provider, w.provider)}LOAD ERROR: ${r.loadError}`);
      continue;
    }
    if (r.noServers) {
      console.log(`${pad(r.provider, w.provider)}NO SERVERS FOUND (${r.opCount} ops, skipped)`);
      continue;
    }
    const coll3 = collectCollisions(r.b3.keyToIdxs, r.b3.ops);
    const coll4 = collectCollisions(r.b4.keyToIdxs, r.b4.ops);
    const coll3Rows = coll3.reduce((n, c) => n + c.ops.length, 0);
    const coll4Rows = coll4.reduce((n, c) => n + c.ops.length, 0);

    console.log(
      pad(r.provider, w.provider) + pad(r.opCount, w.ops) + pad(r.a.exact, w.exact) + pad(r.a.wrongOp, w.wrong)
      + pad(r.a.noMatch, w.none) + pad(r.a.ties, w.ties) + pad(coll3Rows, w.k3) + pad(coll4Rows, w.k4)
      + pad(r.c.stillMatches, w.cMatch) + pad(r.c.stillRightOp, w.cRight) + pad(r.c.stillWrongOp, w.cWrong),
    );

    totals.opCount += r.opCount;
    totals.exact += r.a.exact;
    totals.wrongOp += r.a.wrongOp;
    totals.noMatch += r.a.noMatch;
    totals.ties += r.a.ties;
    totals.coll3 += coll3Rows;
    totals.coll4 += coll4Rows;
    totals.cMatch += r.c.stillMatches;
    totals.cRight += r.c.stillRightOp;
    totals.cWrong += r.c.stillWrongOp;

    if (r.a.wrongOpExamples.length > 0) {
      console.log(`    (a) wrong-op examples:`);
      for (const ex of r.a.wrongOpExamples) {
        console.log(`      expected ${ex.expected.method} ${ex.expected.path} -> got ${ex.got.method} ${ex.got.path}  (${ex.url})`);
      }
    }
    if (r.a.noMatchExamples.length > 0) {
      console.log(`    (a) no-match examples:`);
      for (const ex of r.a.noMatchExamples) {
        console.log(`      ${ex.expected.method} ${ex.expected.path}  (${ex.url})`);
      }
    }
    if (coll3.length > 0) {
      console.log(`    (b) 3-rule key collisions (top ${Math.min(EXAMPLE_LIMIT, coll3.length)} of ${coll3.length}):`);
      for (const c of coll3.slice(0, EXAMPLE_LIMIT)) {
        console.log(`      ${c.key}  <-  ${c.ops.map((o) => `${o.method} ${o.path}`).join('  ;;  ')}`);
      }
    }
    if (coll4.length > 0) {
      console.log(`    (b) 4-rule (mixedIds) key collisions (top ${Math.min(EXAMPLE_LIMIT, coll4.length)} of ${coll4.length}):`);
      for (const c of coll4.slice(0, EXAMPLE_LIMIT)) {
        console.log(`      ${c.key}  <-  ${c.ops.map((o) => `${o.method} ${o.path}`).join('  ;;  ')}`);
      }
    }
    if (r.c.examples.length > 0) {
      console.log(`    (c) wrong-base-path wrong-op examples:`);
      for (const ex of r.c.examples) {
        console.log(`      expected ${ex.expected.method} ${ex.expected.path} -> got ${ex.got.method} ${ex.got.path}  (${ex.url})`);
      }
    }
  }

  console.log(`--- ${setDir} totals: ops ${totals.opCount}, exact ${totals.exact}, wrongOp ${totals.wrongOp}, noMatch ${totals.noMatch}, ties ${totals.ties}, coll@3 ${totals.coll3}, coll@4 ${totals.coll4}, c:match ${totals.cMatch} (right ${totals.cRight}, wrong ${totals.cWrong}) ---`);

  return totals;
}

async function main() {
  const files = collectSpecFiles();
  let anyWrongOp = false;

  const grand = {
    opCount: 0, exact: 0, wrongOp: 0, noMatch: 0, ties: 0,
    coll3: 0, coll4: 0, cMatch: 0, cRight: 0, cWrong: 0,
  };

  for (const setDir of SETS) {
    const setFiles = files.filter((f) => f.setDir === setDir);
    const results = [];
    for (const f of setFiles) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await measureOneSpec(f));
    }
    const totals = printVendorTable(setDir, results);
    for (const r of results) if (r.a.wrongOp > 0) anyWrongOp = true;
    for (const k of Object.keys(grand)) grand[k] += totals[k];
  }

  console.log(`\n=== grand totals across all four sets ===`);
  console.log(`ops ${grand.opCount}, exact ${grand.exact}, wrongOp ${grand.wrongOp}, noMatch ${grand.noMatch}, ties ${grand.ties}`);
  console.log(`3-rule key collisions: ${grand.coll3} rows involved; 4-rule (mixedIds) key collisions: ${grand.coll4} rows involved`);
  console.log(`wrong-base-path variant: ${grand.cMatch} of ${grand.opCount} still matched something (${grand.cRight} still right, ${grand.cWrong} wrong-op)`);

  process.exit(anyWrongOp ? 1 : 0);
}

main();
