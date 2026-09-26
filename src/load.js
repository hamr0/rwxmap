// rwxmap's I/O layer — turns a URL or a file path into a parsed OpenAPI
// document, ready for operationsFrom (exporter.js, via index.js). This file
// does no classification.
//
// D106 — EXTERNAL `$ref`s ARE NOT FOLLOWED. An operation whose text lives in
// another file (a `$ref` pointing outside this document) is handed to
// operationsFrom exactly as parsed — method+path only, no operationId — and
// this loader never fetches or reads it. Following one would make rwxmap a
// general-purpose fetcher of whatever URL or path a third party's spec
// names, which is the same boundary D105 draws around who is allowed to
// fetch. D106 also fixes this loader's shape: a download is capped at 64 MB
// (compressed as read, and again as decoded — a gzip bomb throws rather
// than expanding past the cap) and any binary content (a NUL byte, or a
// POSIX tar header's `ustar` magic) is refused before it ever reaches the
// YAML parser.
//
// D107 — SHIPPED AS THE SUBPATH EXPORT `rwxmap/load`, NOT re-exported from
// the package root. `import 'rwxmap'` must never load the YAML parser, so
// the classifier stays dependency-free per the PRD's "Input" item; `yaml`
// is a runtime dependency of this file alone.
//
// Dependency rule (CLAUDE.md): vanilla Node 22 ESM, the `yaml` package,
// node:fs/zlib/crypto and global fetch. Nothing else — no import from poc/
// or tools/, and this file is never imported by src/index.js.

import { readFileSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';

/**
 * The parsed result of {@link loadSpec}. `doc` is UNTRUSTED — it is
 * whatever JSON or YAML the source contained, with only a `paths` object
 * checked to be present; every field inside it is read defensively by the
 * classifier (see `Operation` in types.js).
 *
 * @typedef {Object} LoadResult
 * @property {any} doc          The parsed document (untrusted input).
 * @property {number} bytes     The byte length of the bytes AS READ, before
 *   gunzip, if the source was gzipped.
 * @property {string} sha256    The hex sha256 of those same as-read bytes.
 * @property {'json'|'yaml'} format  Which parser succeeded.
 * @property {string} source    The original `source` argument, echoed back
 *   for logging.
 */

/**
 * Options for {@link loadSpec}.
 *
 * @typedef {Object} LoadOptions
 * @property {number} [timeoutMs] Bounds a URL fetch (default 30000).
 *   Ignored for a file path.
 * @property {number} [maxBytes]  Bounds the bytes read — a URL's
 *   content-length and its actual streamed body, or a file's stat size —
 *   AND the decompressed gunzip output (default 64 MiB, i.e. 64 * 1024 *
 *   1024).
 */

const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
// The tar `ustar` magic sits at a fixed offset in every POSIX tar header,
// whether or not the archive carries a version suffix after it (D106: a
// tarball must be refused before it ever reaches the YAML parser).
const TAR_USTAR_OFFSET = 257;
const TAR_USTAR_MAGIC = Buffer.from('ustar');

/**
 * @param {string} source
 * @returns {boolean}
 */
function isHttpUrl(source) {
  return /^https?:\/\//i.test(String(source));
}

/**
 * @param {Buffer} buf
 * @returns {string}
 */
function sha256Of(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * @param {Buffer} buf
 * @returns {boolean}
 */
function isGzip(buf) {
  return buf.length >= 2 && buf[0] === GZIP_MAGIC[0] && buf[1] === GZIP_MAGIC[1];
}

/**
 * Strip a UTF-8 byte-order-mark (U+FEFF), if present, from decoded text.
 *
 * @param {string} text
 * @returns {string}
 */
function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * @param {string} url
 * @param {number} timeoutMs
 * @param {number} maxBytes
 * @returns {Promise<Buffer>}
 */
async function readUrlBytes(url, timeoutMs, maxBytes) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`loadSpec: ${url}: http ${res.status}`);
  }
  // Content-length is an early, cheap check but is never trusted alone: a
  // server can omit it or lie, so the running total below is what actually
  // enforces the cap while the body streams in.
  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error(`loadSpec: ${url}: content-length ${contentLength} exceeds maxBytes ${maxBytes}`);
  }
  // Content-type is not trusted: some vendors serve YAML as text/plain or
  // JSON as application/octet-stream. The bytes decide format, not the header.
  if (!res.body) {
    return Buffer.from(await res.arrayBuffer());
  }
  const chunks = [];
  let total = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        throw new Error(`loadSpec: ${url}: response body exceeds maxBytes ${maxBytes}`);
      }
      chunks.push(value);
    }
  } finally {
    try { reader.cancel(); } catch { /* already done or errored */ }
  }
  return Buffer.concat(chunks, total);
}

/**
 * @param {string} filePath
 * @param {number} maxBytes
 * @returns {Buffer}
 */
function readFileBytes(filePath, maxBytes) {
  const { size } = statSync(filePath);
  if (size > maxBytes) {
    throw new Error(`loadSpec: ${filePath}: file size ${size} exceeds maxBytes ${maxBytes}`);
  }
  return readFileSync(filePath);
}

// A NUL byte never appears in valid JSON or YAML text, and the `ustar`
// marker at offset 257 is how POSIX tar headers self-identify. Both are
// checked BEFORE the YAML parser ever sees the bytes (D106): a gunzipped
// tarball has run the YAML parser out of heap trying to parse it as text.
/**
 * @param {string} text
 * @param {Buffer} decompressed
 * @param {string} source
 * @returns {void}
 */
function assertNotBinary(text, decompressed, source) {
  if (text.includes('\u0000')) {
    throw new Error(`loadSpec: ${source}: not an OpenAPI document (binary content)`);
  }
  if (
    decompressed.length >= TAR_USTAR_OFFSET + TAR_USTAR_MAGIC.length
    && decompressed.subarray(TAR_USTAR_OFFSET, TAR_USTAR_OFFSET + TAR_USTAR_MAGIC.length).equals(TAR_USTAR_MAGIC)
  ) {
    throw new Error(`loadSpec: ${source}: not an OpenAPI document (binary content)`);
  }
}

/**
 * Load an OpenAPI/Swagger document from a URL or a file path.
 *
 * Reads the raw bytes (fetch for an http(s) URL, fs for anything else,
 * treated as a file path), transparently gunzips them if they start with
 * the gzip magic number, decodes as UTF-8 and strips a leading BOM, then
 * parses as JSON first and YAML (the `yaml` package's defaults: YAML 1.2
 * core schema, its default maxAliasCount) second. Every thrown Error names
 * the source and the reason.
 *
 * @param {string} source  An http(s) URL or a file path.
 * @param {LoadOptions} [opts]
 * @returns {Promise<LoadResult>}
 */
export async function loadSpec(source, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  const raw = isHttpUrl(source)
    ? await readUrlBytes(source, timeoutMs, maxBytes)
    : readFileBytes(source, maxBytes);

  const bytes = raw.length;
  const sha256 = sha256Of(raw);

  let decompressed;
  if (isGzip(raw)) {
    try {
      decompressed = gunzipSync(raw, { maxOutputLength: maxBytes });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`loadSpec: ${source}: gunzip output exceeds maxBytes ${maxBytes} (${reason})`);
    }
  } else {
    decompressed = raw;
  }
  const text = stripBom(decompressed.toString('utf8'));

  assertNotBinary(text, decompressed, source);

  let doc;
  let format;
  try {
    doc = JSON.parse(text);
    format = 'json';
  } catch {
    try {
      doc = parseYaml(text);
      format = 'yaml';
    } catch (yamlErr) {
      const reason = yamlErr instanceof Error ? yamlErr.message : String(yamlErr);
      throw new Error(`loadSpec: ${source}: could not parse as JSON or YAML (${reason})`);
    }
  }

  if (!doc || typeof doc !== 'object' || !doc.paths || typeof doc.paths !== 'object') {
    throw new Error(`loadSpec: ${source}: parsed document has no usable "paths" object`);
  }

  return { doc, bytes, sha256, format, source };
}
