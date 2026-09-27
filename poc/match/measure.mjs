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
//   3: 'cus_NffrFeUfNV2Hib'              (a prefixed id — ADOPTED 2026-09-27
//      as key.mjs's default rule 4, so this rotation slot now folds too;
//      it stays in the rotation as the prefixed-id representative, not as
//      a deliberate non-fold anymore — see (b)'s per-variant counts, which
//      compare the now-default key against the pre-adoption 3-rule
//      baseline and variant B)
// A param whose name (the `{...}` content) contains "name", "slug" or
// "key" (case-insensitive) gets 'acme-prod' instead, and does not consume
// a rotation slot.
//
// (a) matchOperation must return the SAME operation object for its own
//     synthesized URL. Counts exact / wrong-op / no-match per vendor,
//     up to 5 examples of each, and every tie (reported, not hidden).
// (b) requestKey on the same URLs: how many distinct operations collapse
//     onto one key, per vendor, for the default rules (digit, UUID,
//     hex16, prefixed) and (separately, never silently blended in) the
//     default+mixedIds:true variant.
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
import { operationsFrom, classifyRow } from '../../src/index.js';
import { matchOperation } from './match.mjs';
import { requestKey } from './key.mjs';

// Class order r < w < x, same invariant as src/exporter.js's TIGHTNESS —
// used here only to bucket wrongOp rows by direction, never to reclassify
// anything.
const CLASS_TIGHTNESS = { r: 0, w: 1, x: 2 };

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

// --- prefixed-id rule (rule A, ADOPTED 2026-09-27 as key.mjs's default
// rule 4) and its looser comparison (variant B) ---
// key.mjs's requestKey (no options) now folds prefixed ids by default —
// rule A is no longer a switch, so this file calls plain `requestKey` for
// it. What this file keeps LOCAL, never in key.mjs, is (a) the pure
// pre-adoption 3-rule baseline (`requestKeyBase3`, digit/UUID/hex16 only —
// kept only for this comparison, never used to build a key elsewhere) and
// (b) variant B, the same prefixed-id regex minus the digit-or-mixed-case
// clause — never adopted, priced here only so the two can be compared.
const PREFIXED_ID_RE = /^([a-z]{2,5})_([A-Za-z0-9]{10,})$/;
const ALL_DIGIT_RE = /^[0-9]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX16_RE = /^[0-9a-f]{16,}$/i;

/** Variant B: prefixed-id shape, no digit-or-mixed-case clause. */
function isPrefixedIdVariantB(segment) {
  return PREFIXED_ID_RE.test(segment);
}

/** Rule A's own clause, duplicated read-only for measurement 2/3 (segment
 * strings, not full URLs) — key.mjs's `isIdSegment` is not exported. */
function isPrefixedIdRuleA(segment) {
  const m = PREFIXED_ID_RE.exec(segment);
  if (!m) return false;
  const rest = m[2];
  if (/[0-9]/.test(rest)) return true;
  return /[a-z]/.test(rest) && /[A-Z]/.test(rest);
}

/** The 3 default (adopted) id rules, applied to one segment string. */
function isIdSegmentBase3(segment) {
  return ALL_DIGIT_RE.test(segment) || UUID_RE.test(segment) || HEX16_RE.test(segment);
}

// --- variant B key builder (measurement 1) ---
// Duplicates key.mjs's normalizeEscapes/normalizePath byte-for-byte (small
// and stable, documented there) because variant B is deliberately NOT a
// key.mjs option and key.mjs exports only requestKey. Any drift here would
// only affect this comparison measurement, never production behaviour.
const UNRESERVED_CODE = new Set();
for (let c = 0x30; c <= 0x39; c++) UNRESERVED_CODE.add(c);
for (let c = 0x41; c <= 0x5a; c++) UNRESERVED_CODE.add(c);
for (let c = 0x61; c <= 0x7a; c++) UNRESERVED_CODE.add(c);
UNRESERVED_CODE.add(0x2d);
UNRESERVED_CODE.add(0x2e);
UNRESERVED_CODE.add(0x5f);
UNRESERVED_CODE.add(0x7e);
function isHexDigitChar(ch) { return /^[0-9a-f]$/i.test(ch); }
function normalizeEscapesLocal(pathname) {
  let out = '';
  for (let i = 0; i < pathname.length; i++) {
    const ch = pathname[i];
    if (ch === '%' && i + 2 < pathname.length && isHexDigitChar(pathname[i + 1]) && isHexDigitChar(pathname[i + 2])) {
      const hex = pathname.slice(i + 1, i + 3);
      const code = parseInt(hex, 16);
      out += UNRESERVED_CODE.has(code) ? String.fromCharCode(code) : `%${hex.toUpperCase()}`;
      i += 2;
    } else {
      out += ch;
    }
  }
  return out;
}
function normalizePathLocal(pathname) {
  let out = normalizeEscapesLocal(pathname);
  out = out.replace(/\/{2,}/g, '/');
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  if (out === '') out = '/';
  return out;
}
/** Same key shape as requestKey, but 3 base rules + variant B instead of
 * key.mjs's rule set. Used only for the (1) collision comparison. */
function requestKeyVariantB(method, url) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase() + (parsed.port ? `:${parsed.port}` : '');
  const upperMethod = String(method).toUpperCase();
  const path = normalizePathLocal(parsed.pathname);
  const segments = path === '/' ? ['/'] : path.split('/');
  const replaced = path === '/' ? path : segments.map((seg) => (
    seg !== '' && (isIdSegmentBase3(seg) || isPrefixedIdVariantB(seg)) ? '{id}' : seg
  )).join('/');
  return `${host}.${upperMethod} ${replaced}`;
}

/** Same key shape as requestKey, but the pure PRE-ADOPTION 3-rule baseline
 * (digit/UUID/hex16 only, no prefixed id, no mixedIds) — kept only so the
 * now-default key can be measured against what it replaced. Never used to
 * build a real key anywhere else in this file. */
function requestKeyBase3(method, url) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase() + (parsed.port ? `:${parsed.port}` : '');
  const upperMethod = String(method).toUpperCase();
  const path = normalizePathLocal(parsed.pathname);
  const segments = path === '/' ? ['/'] : path.split('/');
  const replaced = path === '/' ? path : segments.map((seg) => (
    seg !== '' && isIdSegmentBase3(seg) ? '{id}' : seg
  )).join('/');
  return `${host}.${upperMethod} ${replaced}`;
}

/**
 * Collisions present in `candidateMap` that were NOT already collisions
 * under `baseMap` (same key, size>1) — i.e. newly introduced by the
 * candidate rule, never a group the 3-rule baseline already collapsed.
 */
function collectNewCollisions(baseMap, candidateMap, ops) {
  const news = [];
  for (const [key, idxs] of candidateMap) {
    if (idxs.size <= 1) continue;
    const baseIdxs = baseMap.get(key);
    if (baseIdxs && baseIdxs.size > 1) continue; // already a baseline collision
    news.push({ key, ops: [...idxs].map((i) => ({ method: ops[i].method, path: ops[i].path })) });
  }
  news.sort((a, b) => b.ops.length - a.ops.length);
  return news;
}

/** Local $ref resolver — `#/components/parameters/X` (OpenAPI 3) or
 * `#/parameters/X` (Swagger 2) only; anything else (external) is left
 * unresolved and returns null. */
function resolveLocalParamRef(doc, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = doc;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[part];
  }
  return cur && typeof cur === 'object' ? cur : null;
}

/** First example value off a resolved OpenAPI/Swagger parameter object, or
 * undefined when it carries none. Checks `.example`, `.schema.example`,
 * then the first entry of `.examples` (OpenAPI 3 Example Objects). */
function firstExampleValue(param) {
  if (!param || typeof param !== 'object') return undefined;
  if ('example' in param) return param.example;
  if (param.schema && typeof param.schema === 'object' && 'example' in param.schema) return param.schema.example;
  if (param.examples && typeof param.examples === 'object') {
    const firstKey = Object.keys(param.examples)[0];
    if (firstKey !== undefined) {
      const ex = param.examples[firstKey];
      if (ex && typeof ex === 'object' && 'value' in ex) return ex.value;
    }
  }
  return undefined;
}

/** Resolve a parameter (possibly a local `$ref`) and, if it is an `in:
 * 'path'` parameter, return { name, param }; else null. External refs
 * return null (never followed, per D106's boundary this POC also holds
 * to). */
function resolvePathParam(doc, rawParam) {
  let param = rawParam;
  if (param && typeof param === 'object' && typeof param.$ref === 'string') {
    param = resolveLocalParamRef(doc, param.$ref);
    if (!param) return null; // external or unresolvable ref — skipped
  }
  if (!param || typeof param !== 'object') return null;
  if (param.in !== 'path') return null;
  if (typeof param.name !== 'string' || !param.name) return null;
  return param;
}

/**
 * Walk one doc's `paths` for every literal (non-`{param}`) path segment,
 * and every path parameter's example value (path-level + operation-level
 * parameters, local $refs resolved).
 * @returns {{literalSegments: Set<string>, examples: {name: string, value: any, hadExample: boolean}[]}}
 */
function walkPathsForIdsAndExamples(doc) {
  const literalSegments = new Set();
  const examples = [];
  const paths = doc && typeof doc === 'object' ? doc.paths : undefined;
  if (!paths || typeof paths !== 'object') return { literalSegments, examples };

  for (const [pathTemplate, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const seg of pathTemplate.split('/')) {
      if (seg === '' || seg.startsWith('{')) continue;
      literalSegments.add(seg);
    }

    const pathLevelParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
    const seenNames = new Set();
    const collectFrom = (list) => {
      for (const raw of list) {
        const param = resolvePathParam(doc, raw);
        if (!param) continue;
        if (seenNames.has(param.name)) continue; // op-level overrides path-level per OpenAPI; first wins here
        seenNames.add(param.name);
        const hadExample = ('example' in param)
          || (param.schema && typeof param.schema === 'object' && 'example' in param.schema)
          || (param.examples && typeof param.examples === 'object' && Object.keys(param.examples).length > 0);
        const value = firstExampleValue(param);
        examples.push({ name: param.name, value, hadExample: Boolean(hadExample) });
      }
    };

    for (const [field, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS_LOCAL.has(field.toLowerCase())) continue;
      if (!operation || typeof operation !== 'object') continue;
      const opLevelParams = Array.isArray(operation.parameters) ? operation.parameters : [];
      seenNames.clear();
      collectFrom(opLevelParams);
      collectFrom(pathLevelParams);
    }
    // A path with no operations at all but path-level parameters (rare) —
    // still worth counting those params once.
    const hasAnyOp = Object.keys(pathItem).some((f) => HTTP_METHODS_LOCAL.has(f.toLowerCase()));
    if (!hasAnyOp && pathLevelParams.length > 0) {
      seenNames.clear();
      collectFrom(pathLevelParams);
    }
  }
  return { literalSegments, examples };
}
const HTTP_METHODS_LOCAL = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

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
    a: {
      exact: 0, wrongOp: 0, noMatch: 0, ties: 0, wrongOpExamples: [], noMatchExamples: [],
      classSame: 0, classTighter: 0, classLooser: 0, markerDiff: 0, looserRows: [],
    },
    b3: { keyToIdxs: new Map(), ops: [] }, // default rules (digit, UUID, hex16, prefixed) — requestKey(), no options
    b4: { keyToIdxs: new Map(), ops: [] }, // default + mixedIds:true
    bBase3: { keyToIdxs: new Map(), ops: [] }, // PRE-ADOPTION baseline: digit/UUID/hex16 only, local-only
    bB: { keyToIdxs: new Map(), ops: [] }, // default's 3 base rules + variant B (local-only, never adopted)
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
  result.bBase3.ops = ops;
  result.bB.ops = ops;

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

      // Class-direction bucketing: classifyRow takes exactly the same
      // {method, path, operationId?, summary?, description?} shape
      // operationsFrom(doc) already produced these ops in (src/exporter.js
      // passes the same shape straight through to classifyRow) — no
      // reshaping needed.
      const expectedVerdict = classifyRow(op);
      const gotVerdict = classifyRow(matched.op);
      const expectedTightness = CLASS_TIGHTNESS[expectedVerdict.class];
      const gotTightness = CLASS_TIGHTNESS[gotVerdict.class];
      if (gotTightness === expectedTightness) {
        result.a.classSame++;
        if (expectedVerdict.review !== gotVerdict.review) result.a.markerDiff++;
      } else if (gotTightness > expectedTightness) {
        result.a.classTighter++;
      } else {
        result.a.classLooser++;
        result.a.looserRows.push({
          provider: file.provider,
          method: op.method,
          expected: { path: op.path, operationId: op.operationId, class: expectedVerdict.class },
          got: { path: matched.op.path, operationId: matched.op.operationId, class: gotVerdict.class },
          url,
        });
      }
    } else {
      result.a.noMatch++;
      if (result.a.noMatchExamples.length < EXAMPLE_LIMIT) {
        result.a.noMatchExamples.push({ expected: { method: op.method, path: op.path }, url });
      }
    }

    // (b) default (digit, UUID, hex16, prefixed) and default+mixedIds
    // request keys — requestKey() with no options already includes rule 4
    // (prefixed ids), adopted 2026-09-27.
    const key3 = requestKey(op.method, url);
    if (!result.b3.keyToIdxs.has(key3)) result.b3.keyToIdxs.set(key3, new Set());
    result.b3.keyToIdxs.get(key3).add(idx);

    const key4 = requestKey(op.method, url, { mixedIds: true });
    if (!result.b4.keyToIdxs.has(key4)) result.b4.keyToIdxs.set(key4, new Set());
    result.b4.keyToIdxs.get(key4).add(idx);

    // (1) pre-adoption 3-rule baseline (local-only, digit/UUID/hex16, no
    // prefixed id) and variant B (this file's own local, looser predicate)
    // — both compared against the now-default key3 above.
    const keyBase3 = requestKeyBase3(op.method, url);
    if (!result.bBase3.keyToIdxs.has(keyBase3)) result.bBase3.keyToIdxs.set(keyBase3, new Set());
    result.bBase3.keyToIdxs.get(keyBase3).add(idx);

    const keyB = requestKeyVariantB(op.method, url);
    if (!result.bB.keyToIdxs.has(keyB)) result.bB.keyToIdxs.set(keyB, new Set());
    result.bB.keyToIdxs.get(keyB).add(idx);

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
    + pad('noMatch', w.none) + pad('ties', w.ties) + pad('coll@def', w.k3) + pad('coll@dmix', w.k4)
    + pad('c:match', w.cMatch) + pad('c:right', w.cRight) + pad('c:wrong', w.cWrong),
  );

  const totals = {
    opCount: 0, exact: 0, wrongOp: 0, noMatch: 0, ties: 0,
    coll3: 0, coll4: 0, cMatch: 0, cRight: 0, cWrong: 0,
    classSame: 0, classTighter: 0, classLooser: 0, markerDiff: 0,
  };
  // Every looser wrongOp row across the whole set, printed in full below —
  // never capped by EXAMPLE_LIMIT, unlike the (a) wrong-op examples above.
  const setLooserRows = [];

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
    totals.classSame += r.a.classSame;
    totals.classTighter += r.a.classTighter;
    totals.classLooser += r.a.classLooser;
    totals.markerDiff += r.a.markerDiff;
    setLooserRows.push(...r.a.looserRows);

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
      console.log(`    (b) default-rule (digit, UUID, hex16, prefixed) key collisions (top ${Math.min(EXAMPLE_LIMIT, coll3.length)} of ${coll3.length}):`);
      for (const c of coll3.slice(0, EXAMPLE_LIMIT)) {
        console.log(`      ${c.key}  <-  ${c.ops.map((o) => `${o.method} ${o.path}`).join('  ;;  ')}`);
      }
    }
    if (coll4.length > 0) {
      console.log(`    (b) default+mixedIds key collisions (top ${Math.min(EXAMPLE_LIMIT, coll4.length)} of ${coll4.length}):`);
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

  console.log(`--- ${setDir} totals: ops ${totals.opCount}, exact ${totals.exact}, wrongOp ${totals.wrongOp}, noMatch ${totals.noMatch}, ties ${totals.ties}, coll@def ${totals.coll3}, coll@dmix ${totals.coll4}, c:match ${totals.cMatch} (right ${totals.cRight}, wrong ${totals.cWrong}) ---`);
  console.log(`wrongOp by class: same ${totals.classSame}, tighter ${totals.classTighter}, looser ${totals.classLooser} (markerDiff ${totals.markerDiff})`);

  if (setLooserRows.length > 0) {
    console.log(`    (a) looser wrongOp rows, ALL ${setLooserRows.length} (not capped by EXAMPLE_LIMIT):`);
    for (const lr of setLooserRows) {
      console.log(
        `      [${lr.provider}] ${lr.method} `
        + `expected ${lr.expected.path} (opId=${lr.expected.operationId ?? ''}, class=${lr.expected.class}) -> `
        + `got ${lr.got.path} (opId=${lr.got.operationId ?? ''}, class=${lr.got.class})  (${lr.url})`,
      );
    }
  }

  return totals;
}

/**
 * MEASUREMENT (1): the now-default key (rule A adopted) and variant B,
 * both measured against the pre-adoption 3-rule baseline (local-only,
 * `bBase3`). Same shape as the existing coll@def/coll@dmix report, but
 * printed as new, separate blocks — the existing lines above are
 * untouched.
 * @param {{provider: string, setDir: string, b3: any, bBase3: any, bB: any}[]} allResults
 */
function printPrefixedIdCollisions(allResults) {
  console.log(`\n=== (1) default key (with rule A) vs pre-adoption 3-rule baseline vs variant B, across all four sets ===`);
  let collDefault = 0;
  let collBase3 = 0;
  let collB = 0;
  const newDefaultCollisions = [];
  const newBCollisions = [];
  for (const r of allResults) {
    if (r.loadError || r.noServers) continue;
    const collDefaultForSpec = collectCollisions(r.b3.keyToIdxs, r.b3.ops);
    const collBase3ForSpec = collectCollisions(r.bBase3.keyToIdxs, r.bBase3.ops);
    const collBforSpec = collectCollisions(r.bB.keyToIdxs, r.bB.ops);
    collDefault += collDefaultForSpec.reduce((n, c) => n + c.ops.length, 0);
    collBase3 += collBase3ForSpec.reduce((n, c) => n + c.ops.length, 0);
    collB += collBforSpec.reduce((n, c) => n + c.ops.length, 0);
    for (const g of collectNewCollisions(r.bBase3.keyToIdxs, r.b3.keyToIdxs, r.b3.ops)) {
      newDefaultCollisions.push({ provider: r.provider, setDir: r.setDir, ...g });
    }
    for (const g of collectNewCollisions(r.bBase3.keyToIdxs, r.bB.keyToIdxs, r.bB.ops)) {
      newBCollisions.push({ provider: r.provider, setDir: r.setDir, ...g });
    }
  }
  console.log(`pre-adoption 3-rule baseline (digit, UUID, hex16 only, local-only): ${collBase3} rows involved in a collision`);
  console.log(`default rules (digit, UUID, hex16, prefixed — ADOPTED): ${collDefault} rows involved in a collision`);
  console.log(`3 rules + variant B (no digit-or-mixed-case clause, never adopted): ${collB} rows involved in a collision`);

  console.log(`\n  NEW colliding key groups under the default rules (not colliding under the pre-adoption baseline), ALL ${newDefaultCollisions.length}:`);
  for (const g of newDefaultCollisions) {
    console.log(`    [${g.provider} ${g.setDir}] ${g.key}  <-  ${g.ops.map((o) => `${o.method} ${o.path}`).join('  ;;  ')}`);
  }
  console.log(`\n  NEW colliding key groups under variant B (not colliding under the pre-adoption baseline), ALL ${newBCollisions.length}:`);
  for (const g of newBCollisions) {
    console.log(`    [${g.provider} ${g.setDir}] ${g.key}  <-  ${g.ops.map((o) => `${o.method} ${o.path}`).join('  ;;  ')}`);
  }
}

/**
 * MEASUREMENT (2): false folds over every LITERAL path segment in every
 * spec (deduped per vendor+segment, across the whole run).
 * @param {{setDir: string, provider: string, filePath: string}[]} files
 */
async function printFalseFolds(files) {
  console.log(`\n=== (2) false folds: literal path segments rule A / variant B would fold ===`);
  const byVendor = new Map(); // vendor -> Set(segment)
  for (const f of files) {
    let doc;
    try {
      ({ doc } = await loadSpec(f.filePath)); // eslint-disable-line no-await-in-loop
    } catch {
      continue;
    }
    const { literalSegments } = walkPathsForIdsAndExamples(doc);
    if (!byVendor.has(f.provider)) byVendor.set(f.provider, new Set());
    const set = byVendor.get(f.provider);
    for (const seg of literalSegments) set.add(seg);
  }

  const foldedByA = [];
  const foldedByB = [];
  for (const [vendor, segments] of byVendor) {
    for (const seg of segments) {
      if (isPrefixedIdRuleA(seg)) foldedByA.push({ vendor, seg });
      if (isPrefixedIdVariantB(seg)) foldedByB.push({ vendor, seg });
    }
  }
  console.log(`literal segments checked: ${[...byVendor.values()].reduce((n, s) => n + s.size, 0)} (deduped per vendor+segment)`);
  console.log(`rule A false-folds: ${foldedByA.length}`);
  console.log(`variant B false-folds: ${foldedByB.length}`);
  console.log(`  rule A false-fold segments, ALL ${foldedByA.length}:`);
  for (const f of foldedByA) console.log(`    [${f.vendor}] ${f.seg}`);
  console.log(`  variant B false-fold segments, ALL ${foldedByB.length}:`);
  for (const f of foldedByB) console.log(`    [${f.vendor}] ${f.seg}`);
}

/**
 * MEASUREMENT (3): real ids off every path parameter's example value.
 * @param {{setDir: string, provider: string, filePath: string}[]} files
 */
async function printRealIdExamples(files) {
  console.log(`\n=== (3) real ids: path parameter example values ===`);
  let totalParams = 0;
  let noExample = 0;
  let nonString = 0;
  let foldedBase3 = 0;
  let foldedBase3PlusA = 0;
  let foldedBase3PlusB = 0;
  let notFoldedByAny = 0;
  const newlyFoldedByA = [];
  const notFoldedByAExamples = [];

  for (const f of files) {
    let doc;
    try {
      ({ doc } = await loadSpec(f.filePath)); // eslint-disable-line no-await-in-loop
    } catch {
      continue;
    }
    const { examples } = walkPathsForIdsAndExamples(doc);
    for (const ex of examples) {
      totalParams++;
      if (!ex.hadExample) {
        noExample++;
        continue;
      }
      if (typeof ex.value !== 'string') {
        nonString++;
        continue;
      }
      const b3 = isIdSegmentBase3(ex.value);
      const a = isPrefixedIdRuleA(ex.value);
      const b = isPrefixedIdVariantB(ex.value);
      if (b3) foldedBase3++;
      if (b3 || a) foldedBase3PlusA++;
      if (b3 || b) foldedBase3PlusB++;
      if (!b3 && !a && !b) notFoldedByAny++;
      if (!b3 && a) newlyFoldedByA.push({ vendor: f.provider, name: ex.name, value: ex.value });
      if (!b3 && !a) notFoldedByAExamples.push({ vendor: f.provider, name: ex.name, value: ex.value });
    }
  }

  console.log(`total path parameters found: ${totalParams} (no example at all: ${noExample}; example present but non-string: ${nonString})`);
  const stringExamples = totalParams - noExample - nonString;
  console.log(`of ${stringExamples} string examples: folded by pre-adoption 3 rules ${foldedBase3}, by default (3+prefixed) ${foldedBase3PlusA}, by 3+variant B ${foldedBase3PlusB}, not folded by any ${notFoldedByAny}`);
  console.log(`  examples the default rules newly fold (not already folded by the pre-adoption 3-rule baseline), ALL ${newlyFoldedByA.length}:`);
  for (const e of newlyFoldedByA) console.log(`    [${e.vendor}] ${e.name} = ${JSON.stringify(e.value)}`);
  console.log(`  examples NOT folded by the default rules, up to 40 of ${notFoldedByAExamples.length}:`);
  for (const e of notFoldedByAExamples.slice(0, 40)) console.log(`    [${e.vendor}] ${e.name} = ${JSON.stringify(e.value)}`);
}

async function main() {
  const files = collectSpecFiles();
  let anyWrongOp = false;

  const grand = {
    opCount: 0, exact: 0, wrongOp: 0, noMatch: 0, ties: 0,
    coll3: 0, coll4: 0, cMatch: 0, cRight: 0, cWrong: 0,
    classSame: 0, classTighter: 0, classLooser: 0, markerDiff: 0,
  };
  const allResults = [];

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
    for (const r of results) allResults.push({ ...r, setDir });
  }

  console.log(`\n=== grand totals across all four sets ===`);
  console.log(`ops ${grand.opCount}, exact ${grand.exact}, wrongOp ${grand.wrongOp}, noMatch ${grand.noMatch}, ties ${grand.ties}`);
  console.log(`default (digit, UUID, hex16, prefixed) key collisions: ${grand.coll3} rows involved; default+mixedIds key collisions: ${grand.coll4} rows involved`);
  console.log(`wrong-base-path variant: ${grand.cMatch} of ${grand.opCount} still matched something (${grand.cRight} still right, ${grand.cWrong} wrong-op)`);
  console.log(`wrongOp by class: same ${grand.classSame}, tighter ${grand.classTighter}, looser ${grand.classLooser} (markerDiff ${grand.markerDiff})`);

  printPrefixedIdCollisions(allResults);
  await printFalseFolds(files);
  await printRealIdExamples(files);

  process.exit(anyWrongOp ? 1 : 0);
}

main();
