// Pass 2 of item b (spec discovery), step 3 — matching a live HTTP call
// to a spec operation.
//
// matchOperation(ops, servers, method, url):
//   `ops` is operationsFrom(doc) output (src/exporter.js, via
//   src/index.js) — flat, in document order.
//   `servers` is an array of ALREADY-RESOLVED absolute base URL strings
//   (this file does no variable substitution and no Swagger-2 assembly;
//   the caller — poc/match/measure.mjs — turns OpenAPI 3 `servers[].url`
//   template variables into their defaults, or a Swagger 2 doc's
//   `schemes`+`host`+`basePath` into one URL, before calling in).
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
//     (non-template) segments wins; on a tie, the earliest one in
//     document order wins. Every tie is reported (`tie`, `tieCount`), not
//     just resolved silently.
//   - Multiple servers: tried in the given order (duplicates, by exact
//     string, collapsed first — some specs list the same base URL more
//     than once, e.g. meta-whatsapp's four `servers` entries that are all
//     `https://graph.facebook.com`). The first server whose path is a
//     prefix of the target's decides which operations are even candidates
//     for a given operation index; once an operation index has matched
//     under one server it is not re-tried under a later one, so a
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
// contract as key.mjs's requestKey, since both read the same kind of
// input.

/**
 * Split a path into non-empty segments. This intentionally treats
 * repeated slashes and a trailing slash the same as no slash at all
 * (`"/a//b/"` and `"/a/b"` both become `["a", "b"]`) — matching cares
 * about segment CONTENT, not the exact slash bookkeeping requestKey's
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
 * @returns {number|null}  The literal-segment count on a match, or null
 *   when the templates and actual segments don't line up.
 */
function templateMatches(templateSegs, actualSegs) {
  if (templateSegs.length !== actualSegs.length) return null;
  let literalCount = 0;
  for (let i = 0; i < templateSegs.length; i++) {
    const t = templateSegs[i];
    if (isTemplateParam(t)) continue; // matches exactly one non-empty segment, already guaranteed by pathSegments filtering out ''
    if (t !== actualSegs[i]) return null;
    literalCount++;
  }
  return literalCount;
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
 * @param {import('../../src/types.js').Operation[]} ops
 * @param {string[]} servers
 * @param {string} method
 * @param {string} url
 * @returns {{op: import('../../src/types.js').Operation, serverBase: string, hostMatched: boolean, tie: boolean, tieCount: number} | null}
 */
export function matchOperation(ops, servers, method, url) {
  let target;
  try {
    target = new URL(url);
  } catch (err) {
    throw new Error(`matchOperation: ${url}: unparseable URL (${err instanceof Error ? err.message : String(err)})`);
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error(`matchOperation: ${url}: not an http(s) URL (protocol ${target.protocol})`);
  }

  const upperMethod = String(method).toUpperCase();
  const uniqueServers = [...new Set(servers || [])];

  /** @type {Map<number, {op: any, idx: number, literalCount: number, serverBase: string, hostMatched: boolean}>} */
  const byIdx = new Map();

  for (const serverBase of uniqueServers) {
    let serverUrl;
    try {
      serverUrl = new URL(serverBase);
    } catch {
      continue; // an unparseable server URL is skipped, not fatal to the whole match
    }
    const basePath = serverUrl.pathname === '' ? '/' : serverUrl.pathname;
    const remainder = stripBase(target.pathname, basePath);
    if (remainder === null) continue;
    const actualSegs = pathSegments(remainder);
    const hostMatched = target.hostname.toLowerCase() === serverUrl.hostname.toLowerCase();

    ops.forEach((op, idx) => {
      if (byIdx.has(idx)) return; // an earlier server already claimed this operation index
      if (String(op.method || '').toUpperCase() !== upperMethod) return;
      const templateSegs = pathSegments(op.path || '');
      const literalCount = templateMatches(templateSegs, actualSegs);
      if (literalCount !== null) {
        byIdx.set(idx, { op, idx, literalCount, serverBase, hostMatched });
      }
    });
  }

  if (byIdx.size === 0) return null;

  const candidates = [...byIdx.values()];
  candidates.sort((a, b) => b.literalCount - a.literalCount || a.idx - b.idx);
  const top = candidates[0];
  const tieCandidates = candidates.filter((c) => c.literalCount === top.literalCount);

  return {
    op: top.op,
    serverBase: top.serverBase,
    hostMatched: top.hostMatched,
    tie: tieCandidates.length > 1,
    tieCount: tieCandidates.length,
  };
}
