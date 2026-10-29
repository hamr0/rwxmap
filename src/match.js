// Matching a live HTTP call to a spec operation, graduated from
// poc/match/match.mjs — current rules as they stand (no candidate left
// unadopted here, unlike key.js).
//
// matchOperation(ops, servers, method, url):
//   `ops` is operationsFrom(doc) output (exporter.js) — flat, in document
//   order.
//   `servers` is an array of ALREADY-RESOLVED absolute base URL strings
//   (this file does no variable substitution and no Swagger-2 assembly;
//   the caller turns OpenAPI 3 `servers[].url` template variables into
//   their defaults, or a Swagger 2 doc's `schemes`+`host`+`basePath` into
//   one URL, before calling in).
//
// MATCH RULES:
//   - The method must match exactly (case-insensitive compare, both
//     uppercased).
//   - For each server base URL, the target URL's path must have that
//     server's own path (its `.pathname`) as a prefix; what remains after
//     stripping it is matched, segment by segment, against each
//     candidate operation's path template.
//   - A `{param}` template segment matches exactly one non-empty path
//     segment of the remainder — never zero, never more than one.
//   - A literal template segment must equal the remainder's segment at
//     that position exactly (paths are case-sensitive).
//   - Segment counts must match exactly; no wildcard tail matching.
//   - When several operations match, the one with the MOST LITERAL
//     (non-template) segments wins; among those tied on literal-segment
//     count, the TIGHTEST class wins (x > w > r, from classifyRow in
//     flow.js, computed only on the tied candidates) — when the tool
//     cannot tell which operation a call is, it takes the tighter answer,
//     the project's one invariant; still tied on class, the earliest one
//     in document order wins. Every tie is reported (`tie`, `tieCount`),
//     not just resolved silently — `tie`/`tieCount` are keyed on the
//     literal-segment-count group; the class tie-break only decides WHICH
//     of that group wins, it never narrows the count.
//   - Multiple servers: tried in the given order (duplicates, by exact
//     string, collapsed first — some specs list the same base URL more
//     than once). The first server whose path is a prefix of the
//     target's decides which operations are even candidates for a given
//     operation index; once an operation index has matched under one
//     server it is not re-tried under a later one, so a
//     duplicate/overlapping server can never inflate the tie count for
//     the same operation.
//   - HOST MATCHING IS REPORTED, NOT REQUIRED. Many real specs template a
//     per-customer host (`{tenant}.okta.com`, `your-domain.atlassian.net`)
//     that a live call's URL will never equal literally, so path-prefix
//     stripping is tried regardless of host; `hostMatched` says whether
//     the URL's host equalled the winning server's host, for the caller
//     to weigh however it wants.
//
// Returns `{ op, serverBase, hostMatched, tie, tieCount }` for the
// winning operation, or `null` when no server's base path is a prefix of
// the URL, or no operation's method+template matches what remains.
//
// Throws on a non-http(s) `url` or one `new URL` cannot parse — the same
// contract as key.js's requestKey, since both read the same kind of
// input.
//
// classifyRow is imported from './flow.js', not './index.js', so this
// file has no dependency on the package entry point (avoids a future
// import cycle if index.js ever re-exports something from here).
import { classifyRow } from './flow.js';

/** @typedef {import('./types.js').Operation} Operation */

// Class order r < w < x, the project's one invariant — used only to break
// a literal-segment-count tie among candidates, never to reclassify or
// filter anything outside the tied group.
const CLASS_TIGHTNESS = { r: 0, w: 1, x: 2 };

/**
 * Split a path into non-empty segments. This intentionally treats
 * repeated slashes and a trailing slash the same as no slash at all
 * (`"/a//b/"` and `"/a/b"` both become `["a", "b"]`) — matching cares
 * about segment CONTENT, not the exact slash bookkeeping key.js's
 * published key preserves.
 *
 * @param {string} path
 * @returns {string[]}
 */
function pathSegments(path) {
  return String(path || '').split('/').filter((s) => s !== '');
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
function isTemplateParam(segment) {
  return segment.length >= 2 && segment[0] === '{' && segment[segment.length - 1] === '}';
}

/**
 * @param {string[]} templateSegs
 * @param {string[]} actualSegs
 * @returns {boolean}  Whether the template lines up with the actual
 *   segments (same count, every literal equal).
 */
function templateMatches(templateSegs, actualSegs) {
  if (templateSegs.length !== actualSegs.length) return false;
  for (let i = 0; i < templateSegs.length; i++) {
    const t = templateSegs[i];
    if (isTemplateParam(t)) continue; // matches exactly one non-empty segment, already guaranteed by pathSegments filtering out ''
    if (t !== actualSegs[i]) return false;
  }
  return true;
}

/**
 * @param {string} targetPathname  The URL's raw `.pathname`.
 * @param {string} basePath        A server's `.pathname` ('/' when none).
 * @returns {string|null}  The remainder after stripping, or null when
 *   `basePath` is not a prefix of `targetPathname`.
 */
function stripBase(targetPathname, basePath) {
  if (basePath === '' || basePath === '/') return targetPathname;
  const bp = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  if (targetPathname === bp) return '/';
  if (targetPathname.startsWith(`${bp}/`)) return targetPathname.slice(bp.length);
  return null;
}

/**
 * The letter that ranks a tied candidate. A row that already carries its
 * own `letter` (a sidecar row, as rwxmap/match passes) is ranked by it —
 * it was classified with the full operation text, which the row no longer
 * has. Ops from operationsFrom carry no `letter`, so classifyCall is
 * unchanged: those are classified here as before.
 *
 * @param {Operation} op
 * @returns {string}
 */
function tieLetter(op) {
  const letter = /** @type {any} */ (op).letter;
  return letter === 'r' || letter === 'w' || letter === 'x' ? letter : classifyRow(op).class;
}

/**
 * @typedef {Object} CompiledOps
 * @property {{serverBase: string, host: string, basePath: string}[]} servers
 *   Each distinct, parseable server once, in the caller's order.
 * @property {Map<string, {op: Operation, idx: number, segs: string[], literalCount: number}[]>} byMethod
 *   Operations bucketed by upper-cased method, document order kept.
 */

/**
 * The compile step: everything matchCompiled would otherwise redo on every
 * call — parsing each server URL, splitting each template, counting its
 * literal segments. Pure; compile once per spec and reuse.
 *
 * @param {Operation[]} ops
 * @param {string[]} servers
 * @returns {CompiledOps}
 */
export function compileOps(ops, servers) {
  /** @type {CompiledOps['servers']} */
  const compiledServers = [];
  for (const serverBase of new Set(servers || [])) {
    let serverUrl;
    try {
      serverUrl = new URL(serverBase);
    } catch {
      continue; // an unparseable server URL is skipped, not fatal to the whole match
    }
    compiledServers.push({
      serverBase,
      host: serverUrl.hostname.toLowerCase(),
      basePath: serverUrl.pathname === '' ? '/' : serverUrl.pathname,
    });
  }

  /** @type {CompiledOps['byMethod']} */
  const byMethod = new Map();
  ops.forEach((op, idx) => {
    const segs = pathSegments(op.path || '');
    const literalCount = segs.reduce((n, seg) => (isTemplateParam(seg) ? n : n + 1), 0);
    const method = String(op.method || '').toUpperCase();
    const bucket = byMethod.get(method);
    if (bucket) bucket.push({ op, idx, segs, literalCount });
    else byMethod.set(method, [{ op, idx, segs, literalCount }]);
  });
  return { servers: compiledServers, byMethod };
}

/**
 * The run step: the one implementation of the matching rules (see the
 * header). `url` may be a string or an already-parsed URL (a caller that
 * parsed it for its own routing passes it on rather than parsing twice).
 *
 * @param {CompiledOps} compiled
 * @param {string} method
 * @param {string|URL} url
 * @param {Set<number>} [only]  Indexes into `compiled.servers` that may be
 *   tried; every other server's base path is ignored. rwxmap/match passes the
 *   servers that route the call's host; matchOperation passes nothing, so
 *   every server is tried whatever the host (see HOST MATCHING above).
 * @returns {{op: Operation, serverBase: string, hostMatched: boolean, tie: boolean, tieCount: number} | null}
 */
export function matchCompiled(compiled, method, url, only) {
  let target;
  try {
    target = typeof url === 'string' ? new URL(url) : url;
  } catch (err) {
    throw new Error(`matchOperation: ${url}: unparseable URL (${err instanceof Error ? err.message : String(err)})`);
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error(`matchOperation: ${url}: not an http(s) URL (protocol ${target.protocol})`);
  }

  const bucket = compiled.byMethod.get(String(method).toUpperCase());
  if (!bucket) return null;

  // Per server, the target's remainder after the server's base path,
  // split once for this call (null: the base is not a prefix).
  const host = target.hostname.toLowerCase();
  const remainders = compiled.servers.map((server, i) => {
    if (only && !only.has(i)) return null;
    const remainder = stripBase(target.pathname, server.basePath);
    return remainder === null ? null : pathSegments(remainder);
  });

  // The candidates with the most literal segments so far. An operation is
  // claimed by the FIRST server (in the caller's order) it matches.
  /** @type {{op: Operation, idx: number, serverIdx: number}[]} */
  let tied = [];
  let maxLiteralCount = -1;
  for (const entry of bucket) {
    if (entry.literalCount < maxLiteralCount) continue; // cannot tie or win
    for (let s = 0; s < remainders.length; s++) {
      const actualSegs = remainders[s];
      if (actualSegs === null || !templateMatches(entry.segs, actualSegs)) continue;
      if (entry.literalCount > maxLiteralCount) {
        maxLiteralCount = entry.literalCount;
        tied = [];
      }
      tied.push({ op: entry.op, idx: entry.idx, serverIdx: s });
      break;
    }
  }
  if (tied.length === 0) return null;

  // tie/tieCount are keyed on this group — the most-literal-segments
  // candidates; the class tie-break only decides which one of them wins,
  // it never narrows the count. Tied candidates (never every op) are
  // ranked once each: tightest class wins, then earliest document order.
  // An unknown class counts as x, the project's invariant. A lone
  // candidate needs no ranking.
  let top = tied[0];
  if (tied.length > 1) {
    let topTightness = -1;
    for (const c of tied) {
      const tightness = CLASS_TIGHTNESS[tieLetter(c.op)] ?? CLASS_TIGHTNESS.x;
      if (tightness > topTightness || (tightness === topTightness && c.idx < top.idx)) {
        top = c;
        topTightness = tightness;
      }
    }
  }
  const server = compiled.servers[top.serverIdx];
  return {
    op: top.op,
    serverBase: server.serverBase,
    hostMatched: host === server.host,
    tie: tied.length > 1,
    tieCount: tied.length,
  };
}

/**
 * @param {Operation[]} ops
 * @param {string[]} servers
 * @param {string} method
 * @param {string} url
 * @returns {{op: Operation, serverBase: string, hostMatched: boolean, tie: boolean, tieCount: number} | null}
 */
export function matchOperation(ops, servers, method, url) {
  return matchCompiled(compileOps(ops, servers), method, url);
}
