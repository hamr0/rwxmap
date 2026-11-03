// The rwxlite model cache (D133): where a downloaded model lives and whether
// the file on disk is the one its name claims. There is no download code
// here; this file only looks.
//
// Model string: `rwxlite-<semver>+<sha8>`, e.g. rwxlite-1.2.0+0123abcd.
// ASSUMPTION (rwxlite must confirm): sha8 = the first 8 hex characters of the
// sha256 of the int8 weights file's bytes.
// ASSUMPTION (layout, not yet agreed with rwxlite): a cached model is the file
// `<cache dir>/<model string>.int8`.
//
// Cache dir: $XDG_CACHE_HOME/rwxmap when set (and non-empty), else
// ~/.cache/rwxmap/.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

const MODEL_RE = /^rwxlite-(\d+)\.(\d+)\.(\d+)\+([0-9a-f]{8})$/;
const FILE_RE = /^(rwxlite-.*)\.int8$/;

/**
 * Parse a model string strictly. Throws on anything malformed.
 * @param {unknown} s
 * @returns {{version: [number, number, number], sha8: string, model: string}}
 */
export function parseModelString(s) {
  const m = typeof s === 'string' ? MODEL_RE.exec(s) : null;
  if (!m) throw new Error(`malformed rwxlite model string: ${JSON.stringify(s)} (want rwxlite-<semver>+<sha8>)`);
  return { version: [Number(m[1]), Number(m[2]), Number(m[3])], sha8: m[4], model: /** @type {string} */ (s) };
}

/**
 * @param {{XDG_CACHE_HOME?: string}} [environ] defaults to process.env
 * @returns {string}
 */
export function cacheDir(environ = process.env) {
  const xdg = environ.XDG_CACHE_HOME;
  return path.join(typeof xdg === 'string' && xdg !== '' ? xdg : path.join(os.homedir(), '.cache'), 'rwxmap');
}

/**
 * Does the file's sha256 start with the model string's sha8?
 * @param {string} file
 * @param {string} model
 * @returns {boolean}
 */
export function verifyModelFile(file, model) {
  const { sha8 } = parseModelString(model);
  const hex = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return hex.slice(0, 8) === sha8;
}

/**
 * Look in the cache for a model. The newest semver wins. Never throws: every
 * outcome is a status the caller prints.
 *   none     no cache dir or no model file in it
 *   ok       a model file whose hash matches its name
 *   bad      a model file that is malformed-named or fails its hash check;
 *            it is NOT used
 * @param {{XDG_CACHE_HOME?: string}} [environ]
 * @returns {{status: 'none'} | {status: 'ok', model: string, file: string} | {status: 'bad', file: string, reason: string}}
 */
export function findModel(environ = process.env) {
  const dir = cacheDir(environ);
  let names;
  try { names = fs.readdirSync(dir); } catch { return { status: 'none' }; }
  /** @type {Array<{model: string, file: string, version: number[]}>} */
  const found = [];
  for (const name of names) {
    const m = FILE_RE.exec(name);
    if (!m) continue;
    const file = path.join(dir, name);
    try {
      found.push({ model: m[1], file, version: parseModelString(m[1]).version });
    } catch (err) {
      return { status: 'bad', file, reason: err instanceof Error ? err.message : String(err) };
    }
  }
  if (found.length === 0) return { status: 'none' };
  found.sort((a, b) => a.version[0] - b.version[0] || a.version[1] - b.version[1] || a.version[2] - b.version[2]);
  const best = found[found.length - 1];
  let ok;
  try { ok = verifyModelFile(best.file, best.model); } catch (err) {
    return { status: 'bad', file: best.file, reason: err instanceof Error ? err.message : String(err) };
  }
  if (!ok) return { status: 'bad', file: best.file, reason: `hash mismatch: sha256 of the file does not start with the sha8 in ${best.model}` };
  return { status: 'ok', model: best.model, file: best.file };
}
