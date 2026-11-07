// The rwxlite model cache (D133): where a downloaded model lives and whether
// what is on disk is the model its name claims. There is no download code
// here; this file only looks.
//
// Layout (rwxlite's real format): one directory per model,
//   <cache dir>/rwxlite-<semver>+<sha8>/
//     manifest.json   {version, modelFile, model, files: {<name>: <sha256 hex>}}
//     <modelFile>     the model; its name is whatever the manifest says
//     vocab.txt       listed in `files` like any other file
// sha8 = the first 8 hex characters of the sha256 of the model file's bytes.
//
// Cache dir: $XDG_CACHE_HOME/rwxmap when set (and non-empty), else
// ~/.cache/rwxmap/.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

const MODEL_RE = /^rwxlite-(\d+)\.(\d+)\.(\d+)\+([0-9a-f]{8})$/;

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
 * @param {unknown} e
 * @returns {string}
 */
function msg(e) { return e instanceof Error ? e.message : String(e); }

/**
 * Check one model directory; throws an Error whose message is the reason on
 * ANY problem (fail closed). Returns the model string, the model file path and
 * the manifest's modelFile name.
 * @param {string} dir
 * @returns {{model: string, file: string, modelFile: string}}
 */
export function verifyModelDir(dir) {
  const name = path.basename(dir);
  const { sha8 } = parseModelString(name);
  /** @type {any} */
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch (err) {
    throw new Error(`manifest.json unreadable or not JSON: ${msg(err)}`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('manifest.json is not an object');
  if (manifest.model !== name) throw new Error(`manifest model ${JSON.stringify(manifest.model)} does not match the directory name ${name}`);
  const files = manifest.files;
  if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length === 0) throw new Error('manifest has no files');
  if (typeof manifest.modelFile !== 'string' || !Object.hasOwn(files, manifest.modelFile)) throw new Error('manifest modelFile is not a key in files');
  for (const [file, want] of Object.entries(files)) {
    if (file === '' || file.includes('/') || file.includes('\\') || file.includes('..')) throw new Error(`unsafe file name in manifest: ${JSON.stringify(file)}`);
    let bytes;
    try { bytes = fs.readFileSync(path.join(dir, file)); } catch { throw new Error(`listed file is missing: ${file}`); }
    const hex = createHash('sha256').update(bytes).digest('hex');
    if (hex !== want) throw new Error(`hash mismatch: sha256 of ${file} is not the one in manifest.json`);
    if (file === manifest.modelFile && hex.slice(0, 8) !== sha8) throw new Error(`hash mismatch: sha256 of ${file} does not start with the sha8 in ${name}`);
  }
  return { model: name, file: path.join(dir, manifest.modelFile), modelFile: manifest.modelFile };
}

/**
 * Look in the cache for a model. Every directory named rwxlite-* is checked;
 * the highest VALID semver wins, so an invalid higher one does not hide a valid
 * lower one (it is listed in `rejected` so the caller can warn). Never throws:
 * every outcome is a status the caller prints.
 *   none     no cache dir or no rwxlite-* directory in it
 *   ok       a verified model; `file` is its model file. With `preferModelFile`
 *            (the manifest's modelFile of the variant the run chose, for
 *            example model-fp32.onnx), the highest valid model with THAT
 *            modelFile wins even over a higher one of the other variant; only
 *            when none exists is the highest valid one of any kind returned,
 *            with `otherVariant: true`
 *   bad      directories exist but none verifies; `dir` is the highest one,
 *            NOT used
 * @param {{XDG_CACHE_HOME?: string}} [environ]
 * @param {string} [preferModelFile]
 * @param {string} [onlyVersion] e.g. "0.3.1": folders of any other version are ignored (D135)
 * @returns {{status: 'none'} | {status: 'ok', model: string, file: string, otherVariant?: true, rejected: Array<{dir: string, reason: string}>} | {status: 'bad', dir: string, reason: string}}
 */
export function findModel(environ = process.env, preferModelFile, onlyVersion) {
  const root = cacheDir(environ);
  let names;
  try { names = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith('rwxlite-')).map((e) => e.name); } catch { return { status: 'none' }; }
  if (onlyVersion !== undefined) names = names.filter((n) => { const m = MODEL_RE.exec(n); return m !== null && `${m[1]}.${m[2]}.${m[3]}` === onlyVersion; });
  if (names.length === 0) return { status: 'none' };
  /** @type {Array<{dir: string, version: number[]}>} */
  const all = names.map((name) => {
    const m = MODEL_RE.exec(name);
    return { dir: path.join(root, name), version: m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [-1, -1, -1] };
  });
  // Highest semver first (numeric, so 0.10.0 beats 0.9.0); ties by name.
  all.sort((a, b) => b.version[0] - a.version[0] || b.version[1] - a.version[1] || b.version[2] - a.version[2] || (a.dir < b.dir ? -1 : 1));
  /** @type {Array<{dir: string, reason: string}>} */
  const rejected = [];
  /** @type {{ok: {model: string, file: string, modelFile: string}, rejectedBefore: number}|null} */
  let firstValid = null;
  for (const c of all) {
    try {
      const ok = verifyModelDir(c.dir);
      if (preferModelFile === undefined || ok.modelFile === preferModelFile) {
        return { status: 'ok', model: ok.model, file: ok.file, rejected };
      }
      if (!firstValid) firstValid = { ok, rejectedBefore: rejected.length };
    } catch (err) {
      rejected.push({ dir: c.dir, reason: msg(err) });
    }
  }
  if (firstValid) {
    const { ok, rejectedBefore } = firstValid;
    return { status: 'ok', model: ok.model, file: ok.file, otherVariant: true, rejected: rejected.slice(0, rejectedBefore) };
  }
  return { status: 'bad', dir: rejected[0].dir, reason: rejected[0].reason };
}
