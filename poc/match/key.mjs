// Pass 2 of item b (spec discovery), step 2 — the per-request key
// (D105, and bareguard's literal-match contract: the tools-map match is
// byte-for-byte, so this key must be deterministic run to run and byte
// for byte identical across every way of writing the same logical URL).
//
// requestKey(method, url) returns `<host>.<METHOD> <normalized path>`,
// e.g. `api.example.com.POST /v1/orders/{id}`.
//
// NORMALIZATION RULES (this is the one writer of them; nothing else in
// this POC re-derives a key by hand):
//
// HOST — `new URL(url).hostname`, which the WHATWG URL parser already
// lowercases, plus `:<port>` when `.port` is non-empty. The default port
// for the scheme (443 for https, 80 for http) is dropped automatically by
// the same parser (confirmed: `new URL('https://x:443/a').port === ''`),
// so no extra case is needed for it; any OTHER port is kept verbatim.
//
// METHOD — `String(method).toUpperCase()`.
//
// PATH — built from `new URL(url).pathname`, which already excludes the
// query string and fragment (the URL parser splits those into `.search`
// and `.hash`, never `.pathname`):
//   1. Percent-decode ONLY unreserved bytes (RFC 3986: ALPHA / DIGIT /
//      "-" / "." / "_" / "~"). Every other percent-encoded byte is kept
//      encoded, with its two hex digits UPPERCASED, so the same escaped
//      byte written `%2f` or `%2F` normalizes to one spelling.
//   2. Collapse runs of two or more "/" into one.
//   3. Drop a trailing "/", except when the whole path is exactly "/".
//   4. An empty path (no leading "/" at all) becomes "/".
// Path case is otherwise untouched — paths are case-sensitive, so
// `/Users` and `/users` stay different keys.
//
// ID SEGMENTS — each "/"-delimited segment (checked in this order, first
// match wins; all forms end at the same result, `{id}`) is replaced when
// it is:
//   1. all-digit (`^[0-9]+$`);
//   2. a UUID, any version, case-insensitive
//      (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`);
//   3. hex, case-insensitive, 16 or more characters (`^[0-9a-f]{16,}$`,
//      D105's "best guess").
// A fourth candidate — mixed letters+digits, 20 or more characters,
// containing at least one letter AND one digit — is NOT applied by
// default. Pass `{ mixedIds: true }` to turn it on; poc/match/measure.mjs
// reports its effect on the corpus separately, per the brief ("do not
// adopt it silently").
// FLAGGED, not silently fixed: the brief's own illustrative example,
// stripe's `cus_NffrFeUfNV2Hib`, is 18 characters — it does not itself
// clear the stated 20-char floor. The rule below keeps the brief's
// literal 20-char number rather than quietly lowering it to fit the
// example; see key.test.mjs and the report for the counterexample this
// produces.
//
// Throws on a non-http(s) URL (checked via `.protocol`) or one `new URL`
// itself cannot parse.

const UNRESERVED_CODE = new Set();
for (let c = 0x30; c <= 0x39; c++) UNRESERVED_CODE.add(c); // 0-9
for (let c = 0x41; c <= 0x5a; c++) UNRESERVED_CODE.add(c); // A-Z
for (let c = 0x61; c <= 0x7a; c++) UNRESERVED_CODE.add(c); // a-z
UNRESERVED_CODE.add(0x2d); // -
UNRESERVED_CODE.add(0x2e); // .
UNRESERVED_CODE.add(0x5f); // _
UNRESERVED_CODE.add(0x7e); // ~

const HEX_RE = /^[0-9a-f]$/i;

function isHexDigit(ch) {
  return HEX_RE.test(ch);
}

/**
 * Percent-decode unreserved bytes, uppercase every other escape's hex
 * digits. Leaves a malformed "%" (not followed by two hex digits) as-is.
 *
 * @param {string} pathname
 * @returns {string}
 */
function normalizeEscapes(pathname) {
  let out = '';
  for (let i = 0; i < pathname.length; i++) {
    const ch = pathname[i];
    if (ch === '%' && i + 2 < pathname.length && isHexDigit(pathname[i + 1]) && isHexDigit(pathname[i + 2])) {
      const hex = pathname.slice(i + 1, i + 3);
      const code = parseInt(hex, 16);
      if (UNRESERVED_CODE.has(code)) {
        out += String.fromCharCode(code);
      } else {
        out += `%${hex.toUpperCase()}`;
      }
      i += 2;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * @param {string} pathname  A URL object's `.pathname` (query/fragment
 *   already stripped by the parser).
 * @returns {string}
 */
function normalizePath(pathname) {
  let out = normalizeEscapes(pathname);
  out = out.replace(/\/{2,}/g, '/');
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  if (out === '') out = '/';
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALL_DIGIT_RE = /^[0-9]+$/;
const HEX16_RE = /^[0-9a-f]{16,}$/i;
const MIXED20_RE = /^[0-9a-zA-Z_-]{20,}$/;

/**
 * @param {string} segment
 * @param {boolean} mixedIds
 * @returns {boolean}
 */
function isIdSegment(segment, mixedIds) {
  if (ALL_DIGIT_RE.test(segment)) return true;
  if (UUID_RE.test(segment)) return true;
  if (HEX16_RE.test(segment)) return true;
  if (mixedIds && MIXED20_RE.test(segment) && /[0-9]/.test(segment) && /[a-zA-Z]/.test(segment)) return true;
  return false;
}

/**
 * @param {string} path  Already normalized by normalizePath.
 * @param {boolean} mixedIds
 * @returns {string}
 */
function replaceIdSegments(path, mixedIds) {
  if (path === '/') return path;
  const segments = path.split('/');
  const replaced = segments.map((seg) => (seg !== '' && isIdSegment(seg, mixedIds) ? '{id}' : seg));
  return replaced.join('/');
}

/**
 * @param {string} method
 * @param {string} url
 * @param {{mixedIds?: boolean}} [options]
 * @returns {string}
 */
export function requestKey(method, url, options = {}) {
  const mixedIds = options.mixedIds === true;

  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw new Error(`requestKey: ${url}: unparseable URL (${err instanceof Error ? err.message : String(err)})`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`requestKey: ${url}: not an http(s) URL (protocol ${parsed.protocol})`);
  }

  const host = parsed.hostname.toLowerCase() + (parsed.port ? `:${parsed.port}` : '');
  const upperMethod = String(method).toUpperCase();
  const path = replaceIdSegments(normalizePath(parsed.pathname), mixedIds);

  return `${host}.${upperMethod} ${path}`;
}
