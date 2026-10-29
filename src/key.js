// The per-request key (Pass 2 of item b, spec discovery, step 2 — D105,
// and bareguard's literal-match contract: the tools-map match is
// byte-for-byte, so this key must be deterministic run to run and byte
// for byte identical across every way of writing the same logical URL).
// Graduated from poc/match/key.mjs, ADOPTED RULES ONLY (2026-09-27): the
// mixedIds candidate documented in the POC's header was never adopted and
// is not ported here — this file offers no options argument at all.
//
// requestKey(method, url) returns `<host>.<METHOD> <normalized path>`,
// e.g. `api.example.com.POST /v1/orders/{id}`.
//
// NORMALIZATION RULES (this is the one writer of them; nothing else in
// src/ re-derives a key by hand):
//
// HOST — `new URL(url).hostname`, which the WHATWG URL parser already
// lowercases (including IDN, which the parser punycodes), plus
// `:<port>` when `.port` is non-empty. The default port for the scheme
// (443 for https, 80 for http) is dropped automatically by the same
// parser, so no extra case is needed for it; any OTHER port is kept
// verbatim.
//
// METHOD — `String(method).toUpperCase()`.
//
// PATH — built from `new URL(url).pathname`, which already excludes the
// query string and fragment:
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
//   3. hex, case-insensitive, 16 or more characters (`^[0-9a-f]{16,}$`);
//   4. a prefixed id, `^([a-z]{2,5})_([A-Za-z0-9]{10,})$`, where the part
//      after "_" contains at least one digit OR both an uppercase and a
//      lowercase letter (that clause exists so a lowercase word like
//      `user_preferences` never folds).
//
// Throws on a non-http(s) URL (checked via `.protocol`) or one `new URL`
// itself cannot parse.

import { classifyRow } from './flow.js';

const UNRESERVED_CODE = new Set();
for (let c = 0x30; c <= 0x39; c++) UNRESERVED_CODE.add(c); // 0-9
for (let c = 0x41; c <= 0x5a; c++) UNRESERVED_CODE.add(c); // A-Z
for (let c = 0x61; c <= 0x7a; c++) UNRESERVED_CODE.add(c); // a-z
UNRESERVED_CODE.add(0x2d); // -
UNRESERVED_CODE.add(0x2e); // .
UNRESERVED_CODE.add(0x5f); // _
UNRESERVED_CODE.add(0x7e); // ~

const HEX_RE = /^[0-9a-f]$/i;

/**
 * @param {string} ch
 * @returns {boolean}
 */
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
const PREFIXED_ID_RE = /^([a-z]{2,5})_([A-Za-z0-9]{10,})$/;

/**
 * The digit-or-mixed-case clause on the part of a prefixed id after "_"
 * (rule 4, see the header comment). Not exported: internal to
 * isIdSegment, the one caller.
 *
 * @param {string} rest  The captured part after "_" (already known to
 *   match PREFIXED_ID_RE).
 * @returns {boolean}
 */
function prefixedRestQualifies(rest) {
  if (/[0-9]/.test(rest)) return true;
  return /[a-z]/.test(rest) && /[A-Z]/.test(rest);
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
function isIdSegment(segment) {
  if (ALL_DIGIT_RE.test(segment)) return true;
  if (UUID_RE.test(segment)) return true;
  if (HEX16_RE.test(segment)) return true;
  const prefixed = PREFIXED_ID_RE.exec(segment);
  if (prefixed && prefixedRestQualifies(prefixed[2])) return true;
  return false;
}

/**
 * @param {string} path  Already normalized by normalizePath.
 * @returns {string}
 */
function replaceIdSegments(path) {
  if (path === '/') return path;
  const segments = path.split('/');
  const replaced = segments.map((seg) => (seg !== '' && isIdSegment(seg) ? '{id}' : seg));
  return replaced.join('/');
}

/**
 * @param {string} method
 * @param {string} url
 * @returns {string}
 */
export function requestKey(method, url) {
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
  const path = replaceIdSegments(normalizePath(parsed.pathname));

  return `${host}.${upperMethod} ${path}`;
}

// ---------------------------------------------------------------------
// Odd call URLs (the one writer of both rules, and of the result a call
// with one gets). An oddly written URL must not reach the spec's
// operations: it could slip past the route that carries the spec's
// evidence and land on a looser label. Two rules:
//   1. A trailing "." on the host (`api.acme.com.`) is the same host:
//      one dot is dropped before routing, matching and keying.
//   2. A path with an escaped UNRESERVED byte (`%74` for "t") or a ";"
//      is "malformed": it is never matched against the spec, and gets
//      the tightest request-only answer (see requestOnly).
// A reserved escape (%2F, %20, %3B) is an ordinary escaped byte, not odd.
// ---------------------------------------------------------------------

// An escape of an unreserved byte: 0-9 A-Z a-z - . _ ~ (hex either case).
const UNRESERVED_ESCAPE_RE = /%(?:3\d|4[1-9a-f]|5[\daf]|6[1-9a-f]|7[\dae]|2[de])/i;

/**
 * @typedef {Object} CallUrlFix
 * @property {URL} target  The call URL, the trailing host dot dropped.
 * @property {string} url  The same, as a string (for requestKey).
 * @property {string|null} malformed  Why the path is malformed, or null.
 */

/**
 * @param {URL} target  The parsed call URL.
 * @param {string} url  The call URL as the caller wrote it.
 * @returns {CallUrlFix|null}  null for the ordinary call (no allocation,
 *   no URL rebuilt): nothing to drop and nothing malformed.
 */
export function callUrlProblem(target, url) {
  const host = target.hostname;
  const dotted = host.length > 1 && host.charCodeAt(host.length - 1) === 0x2e;
  const path = target.pathname;
  /** @type {string|null} */
  let malformed = null;
  if (path.indexOf('%') >= 0 || path.indexOf(';') >= 0) {
    const esc = UNRESERVED_ESCAPE_RE.exec(path);
    if (esc) malformed = `escaped unreserved character in path (${esc[0]})`;
    else if (path.indexOf(';') >= 0) malformed = "';' in path";
  }
  if (!dotted && malformed === null) return null;
  if (!dotted) return { target, url, malformed };
  const fixed = new URL(target);
  fixed.hostname = host.slice(0, -1);
  return { target: fixed, url: fixed.href, malformed };
}

/**
 * The request-only answer for a call no spec operation owns: the
 * method/path ladder for an ordinary call; for a malformed one the
 * tightest class (x) with a "tight" marker, except GET, HEAD and OPTIONS,
 * which keep their ladder label. The result carries `malformed: <reason>`
 * only when the call is malformed.
 *
 * @param {string} method
 * @param {string} url  The call URL string (trailing host dot already dropped).
 * @param {URL} target  The same URL, parsed.
 * @param {string|null} malformed
 * @returns {{key: string, letter: 'r'|'w'|'x', marker: 'tight'|'loose'|'settled', source: 'request', malformed?: string, tie?: boolean}}
 *   No `tie` field: matcher.js adds its own, classifyCall has none.
 */
export function requestOnly(method, url, target, malformed) {
  const key = requestKey(method, url);
  const m = String(method).toUpperCase();
  if (malformed !== null && m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
    return { key, letter: 'x', marker: 'tight', source: 'request', malformed };
  }
  const verdict = classifyRow({ method, path: target.pathname });
  const out = { key, letter: verdict.class, marker: verdict.review, source: /** @type {'request'} */ ('request') };
  return malformed === null ? out : { ...out, malformed };
}
