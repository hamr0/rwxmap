// Getting the rwxlite model (D133): fetch the manifest from rwxlite's pinned
// GitHub release, download what it lists into the cache, verify, and only then
// put it in place. modelcache.js owns "what is on disk and is it the model its
// name claims"; this file owns the network and never skips that check.
//
// Which manifest: the default is rwxlite's fp32 "exact" model
// (manifest-exact.json), `small` is the int8 per-channel one (manifest.json).
// Pinned (D135): the download is tied to one release tag, never `latest`, so a
// newer rwxlite model cannot reach users before it has passed a fresh exam.
// Moving to a new model is a one-line change to RWXLITE_TAG. The manifest only
// gives file NAMES; the files come from the manifest URL's directory, the same
// tag. The offline fallback also accepts only the pinned version (see
// modelcache.findModel). It never uses unverified bytes.
//
// Safety: https only; redirects are walked by hand (never `redirect:
// 'follow'`) and EVERY hop, the first URL included, must be github.com or a
// *.githubusercontent.com host. The total body size is capped and every
// request has a timeout.
//
// Atomic: files are written into <cache>/.tmp-<pid>-<n>/<model>/, verified
// there with modelcache's own check, then that folder is renamed to
// <cache>/<model>/. A failure leaves no rwxlite-* folder behind.
//
// Never throws on a network or verify problem: it returns what to say.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';

import { cacheDir, findModel, parseModelString, verifyModelDir } from './modelcache.js';

/** The modelFile each variant's manifest names (rwxlite's release assets); how a cached folder is told apart by variant. */
export const VARIANT_MODEL_FILE = { exact: 'model-fp32.onnx', small: 'model-int8-pc.onnx' };

/** The one rwxlite release rwxmap ships with (D135). */
export const RWXLITE_TAG = 'v0.3.1';
/** The model version that tag carries, derived so there is one literal. */
export const RWXLITE_VERSION = RWXLITE_TAG.slice(1);
const RELEASE_BASE = `https://github.com/hamr0/rwxlite/releases/download/${RWXLITE_TAG}/`;
export const MANIFEST_URLS = {
  exact: `${RELEASE_BASE}manifest-exact.json`,
  small: `${RELEASE_BASE}manifest.json`,
};

export const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_REDIRECTS = 5;
const MANIFEST_TIMEOUT_MS = 15_000;
const FILE_TIMEOUT_MS = 10 * 60_000;

/** @param {unknown} e @returns {string} */
function msg(e) {
  if (!(e instanceof Error)) return String(e);
  const c = /** @type {any} */ (e).cause;
  return c && c.message ? `${e.message}: ${c.message}` : e.message; // fetch's own error is just "fetch failed"
}

/**
 * Only github.com and *.githubusercontent.com, only https. Returns the reason
 * the URL is refused, or null.
 * @param {string} u
 * @returns {string|null}
 */
function refusal(u) {
  let p;
  try { p = new URL(u); } catch { return `not a URL: ${u}`; }
  if (p.protocol !== 'https:') return `not https: ${u}`;
  const h = p.hostname.toLowerCase();
  if (h === 'github.com' || h.endsWith('.githubusercontent.com')) return null;
  return `host ${h} is not github.com or *.githubusercontent.com`;
}

/**
 * GET a URL, walking redirects by hand; every hop passes `refusal` before a
 * request is made. Returns the final 2xx Response (body unread). Throws an
 * Error whose message is the reason otherwise.
 * @param {string} url
 * @param {{fetchImpl: typeof fetch, timeoutMs: number}} o
 * @returns {Promise<Response>}
 */
async function guardedGet(url, { fetchImpl, timeoutMs }) {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = url;
  for (let hop = 0; ; hop++) {
    const bad = refusal(current);
    if (bad) throw new Error(`refused: ${bad}`);
    if (hop > MAX_REDIRECTS) throw new Error(`too many redirects (> ${MAX_REDIRECTS})`);
    const res = await fetchImpl(current, { redirect: 'manual', signal, headers: { 'User-Agent': 'rwxmap' } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      try { await res.body?.cancel(); } catch { /* nothing to cancel */ }
      if (!loc) throw new Error(`redirect with no Location header from ${current}`);
      try { current = new URL(loc, current).toString(); } catch { throw new Error(`redirect Location does not parse: ${loc}`); }
      continue;
    }
    if (!res.ok) {
      try { await res.body?.cancel(); } catch { /* nothing to cancel */ }
      throw new Error(`HTTP ${res.status} from ${current}`);
    }
    return res;
  }
}

/**
 * Stream a response body, counting every byte against `budget.left`; each
 * chunk goes to `sink`. Throws when the budget runs out.
 * @param {Response} res
 * @param {{left: number}} budget
 * @param {(chunk: Uint8Array) => void} sink
 * @returns {Promise<number>} bytes read
 */
async function drain(res, budget, sink) {
  if (!res.body) throw new Error('empty response body');
  const reader = res.body.getReader();
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      budget.left -= value.length;
      n += value.length;
      if (budget.left < 0) throw new Error(`download is larger than the ${Math.round(MAX_TOTAL_BYTES / 1048576)} MB cap`);
      sink(value);
    }
  } finally {
    try { await reader.cancel(); } catch { /* already finished */ }
  }
  return n;
}

/**
 * Parse and sanity-check a fetched manifest before anything is downloaded.
 * @param {string} text
 * @returns {{model: string, files: string[], raw: string}}
 */
function readManifest(text) {
  /** @type {any} */
  let m;
  try { m = JSON.parse(text); } catch { throw new Error('the manifest is not JSON'); }
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('the manifest is not an object');
  parseModelString(m.model);
  const files = m.files;
  if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length === 0) throw new Error('the manifest lists no files');
  for (const [name, sha] of Object.entries(files)) {
    if (name === '' || name.includes('/') || name.includes('\\') || name.includes('..') || name === 'manifest.json') throw new Error(`unsafe file name in the manifest: ${JSON.stringify(name)}`);
    if (typeof sha !== 'string' || !/^[0-9a-f]{64}$/.test(sha)) throw new Error(`the manifest has no sha256 for ${name}`);
  }
  return { model: m.model, files: Object.keys(files), raw: text };
}

const MB = (/** @type {number|null} */ n) => (n === null ? 'size unknown' : `${(n / 1048576).toFixed(1)} MB`);

/** @param {string} dir */
function rmrf(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } }

/**
 * @param {string} manifestUrl
 * @param {{environ: {XDG_CACHE_HOME?: string}, fetchImpl: typeof fetch, log: (line: string) => void, manifestTimeoutMs: number, fileTimeoutMs: number}} o
 * @returns {Promise<{model: string, dir: string}>} the verified model folder; throws with the reason.
 */
async function downloadModel(manifestUrl, o) {
  const budget = { left: MAX_TOTAL_BYTES };
  const mres = await guardedGet(manifestUrl, { fetchImpl: o.fetchImpl, timeoutMs: o.manifestTimeoutMs });
  /** @type {Uint8Array[]} */
  const parts = [];
  const mbudget = { left: MAX_MANIFEST_BYTES };
  await drain(mres, mbudget, (c) => parts.push(c));
  const manifest = readManifest(Buffer.concat(parts).toString('utf8'));

  const root = cacheDir(o.environ);
  const finalDir = path.join(root, manifest.model);
  // Already there and good: nothing to download.
  try { verifyModelDir(finalDir); return { model: manifest.model, dir: finalDir }; } catch { /* download it */ }

  const base = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
  const tmpRoot = path.join(root, `.tmp-${process.pid}-${randomBytes(4).toString('hex')}`);
  const stage = path.join(tmpRoot, manifest.model);
  try {
    fs.mkdirSync(stage, { recursive: true });
    for (const name of manifest.files) {
      const res = await guardedGet(base + encodeURIComponent(name), { fetchImpl: o.fetchImpl, timeoutMs: o.fileTimeoutMs });
      const len = Number(res.headers.get('content-length'));
      o.log(`rwxmap: downloading ${name} (${MB(Number.isFinite(len) && len > 0 ? len : null)})`);
      const fd = fs.openSync(path.join(stage, name), 'w');
      try { await drain(res, budget, (c) => fs.writeSync(fd, c)); } finally { fs.closeSync(fd); }
    }
    fs.writeFileSync(path.join(stage, 'manifest.json'), manifest.raw);
    verifyModelDir(stage); // every sha256 and the sha8, before it gets its real name
    try {
      fs.renameSync(stage, finalDir);
    } catch (err) {
      // Someone else finished the same model first: use theirs if it verifies.
      try { verifyModelDir(finalDir); } catch { throw err; }
    }
    return { model: manifest.model, dir: finalDir };
  } finally {
    rmrf(tmpRoot);
  }
}

/**
 * Get a verified rwxlite model folder for this run. Never throws.
 *   ready  {model, dir, notes}   notes are lines for stderr
 *   off    {reason, notes}       run mechanical alone and say the reason
 * @param {{variant?: 'exact'|'small', environ?: {XDG_CACHE_HOME?: string}, fetchImpl?: typeof fetch, log?: (line: string) => void, manifestTimeoutMs?: number, fileTimeoutMs?: number}} [opts]
 * @returns {Promise<{status: 'ready', model: string, dir: string, notes: string[]} | {status: 'off', reason: string, notes: string[]}>}
 */
export async function ensureModel(opts = {}) {
  const environ = opts.environ ?? process.env;
  const variant = opts.variant === 'small' ? 'small' : 'exact';
  const log = opts.log ?? (() => {});
  /** @type {string[]} */
  const notes = [];
  /** @type {string} */
  let why;
  try {
    const got = await downloadModel(MANIFEST_URLS[variant], {
      environ,
      fetchImpl: opts.fetchImpl ?? globalThis.fetch,
      log,
      manifestTimeoutMs: opts.manifestTimeoutMs ?? MANIFEST_TIMEOUT_MS,
      fileTimeoutMs: opts.fileTimeoutMs ?? FILE_TIMEOUT_MS,
    });
    return { status: 'ready', model: got.model, dir: got.dir, notes };
  } catch (err) {
    why = msg(err);
  }
  // Could not reach the release: a verified cached model of the pinned version, if any.
  const found = findModel(environ, VARIANT_MODEL_FILE[variant], RWXLITE_VERSION);
  if (found.status === 'ok') {
    for (const r of found.rejected) notes.push(`rwxmap: WARNING: rwxlite model rejected (${r.reason}); ${r.dir} was NOT used`);
    const other = found.otherVariant ? ` (no cached ${variant === 'small' ? 'small' : 'exact'} model, so the ${variant === 'small' ? 'exact' : 'small'} one)` : '';
    notes.push(`rwxmap: using cached ${found.model}${other}, could not reach the release (${why})`);
    return { status: 'ready', model: found.model, dir: path.dirname(found.file), notes };
  }
  if (found.status === 'bad') {
    notes.push(`rwxmap: WARNING: rwxlite model rejected (${found.reason}); ${found.dir} was NOT used`);
    return { status: 'off', reason: `could not get the model (${why}); the cached model was rejected (${found.reason})`, notes };
  }
  return { status: 'off', reason: `could not get the model (${why}); none in the cache`, notes };
}
