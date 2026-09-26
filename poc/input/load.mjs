// POC — rwxmap's input layer (PRD "What is next — NOT BUILT", item a).
//
// loadSpec turns a URL or a file path into a parsed OpenAPI document, the
// way an adopter would before calling operationsFrom (src/exporter.js, via
// src/index.js). This file does no classification and imports nothing from
// src/ except through src/index.js (it doesn't even need that import
// itself — operationsFrom is used by measure.mjs and load.test.mjs, not
// here — but the rule is stated so it's clear this loader stays scoped to
// I/O and parsing only, per item a of the PRD).
//
// Dependency rule (CLAUDE.md): vanilla Node 22 ESM, the `yaml` package
// (already a devDependency, promoted to the I/O layer's runtime dependency
// per the PRD), node:zlib/fs/crypto and global fetch. Nothing else.
//
// NEVER SHIP THE POC (CLAUDE.md) — this is a proof, not shipped code.

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';

const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);
const DEFAULT_TIMEOUT_MS = 30_000;

function isHttpUrl(source) {
  return /^https?:\/\//i.test(String(source));
}

function sha256Of(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function isGzip(buf) {
  return buf.length >= 2 && buf[0] === GZIP_MAGIC[0] && buf[1] === GZIP_MAGIC[1];
}

// Strip a UTF-8 byte-order-mark (U+FEFF), if present, from decoded text.
function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

async function readUrlBytes(url, timeoutMs) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`loadSpec: ${url}: http ${res.status}`);
  }
  // Content-type is not trusted: some vendors serve YAML as text/plain or
  // JSON as application/octet-stream. The bytes decide format, not the header.
  return Buffer.from(await res.arrayBuffer());
}

function readFileBytes(filePath) {
  return readFileSync(filePath);
}

/**
 * Load an OpenAPI/Swagger document from a URL or a file path.
 *
 * Reads the raw bytes (fetch for an http(s) URL, fs for anything else,
 * treated as a file path), transparently gunzips them if they start with
 * the gzip magic number, decodes as UTF-8 and strips a leading BOM, then
 * parses as JSON first and YAML (the `yaml` package's defaults: YAML 1.2
 * core schema, its default maxAliasCount) second.
 *
 * @param {string} source  An http(s) URL or a file path.
 * @param {{timeoutMs?: number}} [opts]  `timeoutMs` bounds a URL fetch
 *   (default 30000); ignored for a file path.
 * @returns {Promise<{doc: any, bytes: number, sha256: string, format: 'json'|'yaml', source: string}>}
 *   `bytes` and `sha256` describe the bytes AS READ — before gunzip, if any.
 */
export async function loadSpec(source, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const raw = isHttpUrl(source)
    ? await readUrlBytes(source, timeoutMs)
    : readFileBytes(source);

  const bytes = raw.length;
  const sha256 = sha256Of(raw);

  const decompressed = isGzip(raw) ? gunzipSync(raw) : raw;
  const text = stripBom(decompressed.toString('utf8'));

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
      throw new Error(`loadSpec: ${source}: could not parse as JSON or YAML (${yamlErr.message})`);
    }
  }

  if (!doc || typeof doc !== 'object' || !doc.paths || typeof doc.paths !== 'object') {
    throw new Error(`loadSpec: ${source}: parsed document has no usable "paths" object`);
  }

  return { doc, bytes, sha256, format, source };
}
