import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import { parseModelString, cacheDir, findModel } from './modelcache.js';

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-modelcache-'));
}

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

/**
 * Write a model directory in the cache. opts.dirSha8 / opts.manifest override
 * parts to build broken ones. Returns {model, dir}.
 */
function putModel(xdg, version, opts = {}) {
  const weights = Buffer.from('weights-' + version);
  const vocab = Buffer.from('vocab-' + version);
  const model = `rwxlite-${version}+${opts.dirSha8 ?? sha256(weights).slice(0, 8)}`;
  const dir = path.join(xdg, 'rwxmap', model);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'model.bin'), weights);
  fs.writeFileSync(path.join(dir, 'vocab.txt'), vocab);
  const manifest = { version, modelFile: 'model.bin', model, files: { 'model.bin': sha256(weights), 'vocab.txt': sha256(vocab) }, ...opts.manifest };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return { model, dir };
}

test('parseModelString: accepts rwxlite-<semver>+<sha8> and fails loudly on anything else', () => {
  assert.deepEqual(parseModelString('rwxlite-1.20.3+0123abcd'), { version: [1, 20, 3], sha8: '0123abcd', model: 'rwxlite-1.20.3+0123abcd' });
  for (const bad of ['', 'rwxlite-1.2+0123abcd', 'rwxlite-1.2.3', 'rwxlite-1.2.3+0123ABCD', 'rwxlite-1.2.3+0123abc', 'rwxlite-1.2.3+0123abcde', 'jev-1.13.0', 'xrwxlite-1.2.3+0123abcd', undefined, null, 5]) {
    assert.throws(() => parseModelString(bad), /malformed rwxlite model string/, String(bad));
  }
});

test('cacheDir: XDG_CACHE_HOME/rwxmap when set, else ~/.cache/rwxmap, empty counts as unset', () => {
  assert.equal(cacheDir({ XDG_CACHE_HOME: '/x/y' }), path.join('/x/y', 'rwxmap'));
  assert.equal(cacheDir({}), path.join(os.homedir(), '.cache', 'rwxmap'));
  assert.equal(cacheDir({ XDG_CACHE_HOME: '' }), path.join(os.homedir(), '.cache', 'rwxmap'));
});

test('findModel: none for a missing cache, an empty cache, or one with no rwxlite-* directory', () => {
  assert.deepEqual(findModel({ XDG_CACHE_HOME: path.join(scratch(), 'nope') }), { status: 'none' });
  const xdg = scratch();
  fs.mkdirSync(path.join(xdg, 'rwxmap'));
  fs.writeFileSync(path.join(xdg, 'rwxmap', 'notes.txt'), 'x');
  fs.writeFileSync(path.join(xdg, 'rwxmap', 'rwxlite-1.0.0+00000000.int8'), 'old single-file layout is not looked at');
  assert.deepEqual(findModel({ XDG_CACHE_HOME: xdg }), { status: 'none' });
});

test('findModel: a valid directory is ok and names the model file the manifest gives', () => {
  const xdg = scratch();
  const m = putModel(xdg, '1.0.0');
  assert.deepEqual(findModel({ XDG_CACHE_HOME: xdg }), { status: 'ok', model: m.model, file: path.join(m.dir, 'model.bin'), rejected: [] });
});

test('findModel: a hash mismatch in any listed file (model file, vocab, wrong sha8) is bad and says so', () => {
  for (const name of ['model.bin', 'vocab.txt']) {
    const xdg = scratch();
    const m = putModel(xdg, '1.0.0');
    fs.appendFileSync(path.join(m.dir, name), 'tampered');
    const r = findModel({ XDG_CACHE_HOME: xdg });
    assert.equal(r.status, 'bad', name);
    assert.equal(r.dir, m.dir);
    assert.match(r.reason, /hash mismatch/, name);
  }
  // A manifest that agrees with the bytes but whose directory name carries the wrong sha8.
  const xdg = scratch();
  const m = putModel(xdg, '1.0.0', { dirSha8: 'deadbeef' });
  const r = findModel({ XDG_CACHE_HOME: xdg });
  assert.equal(r.status, 'bad');
  assert.match(r.reason, /does not start with the sha8/);
  assert.equal(r.dir, m.dir);
});

test('findModel: a listed file that is missing is bad', () => {
  const xdg = scratch();
  const m = putModel(xdg, '1.0.0');
  fs.rmSync(path.join(m.dir, 'vocab.txt'));
  const r = findModel({ XDG_CACHE_HOME: xdg });
  assert.equal(r.status, 'bad');
  assert.match(r.reason, /listed file is missing: vocab\.txt/);
});

test('findModel: a missing manifest or one that is not JSON is bad', () => {
  const xdg = scratch();
  const m = putModel(xdg, '1.0.0');
  fs.writeFileSync(path.join(m.dir, 'manifest.json'), '{not json');
  const r = findModel({ XDG_CACHE_HOME: xdg });
  assert.equal(r.status, 'bad');
  assert.match(r.reason, /manifest\.json unreadable or not JSON/);
  fs.rmSync(path.join(m.dir, 'manifest.json'));
  assert.match(/** @type {any} */ (findModel({ XDG_CACHE_HOME: xdg })).reason, /manifest\.json unreadable/);
});

test('findModel: manifest.model not equal to the directory name is bad; so is a malformed directory name', () => {
  const xdg = scratch();
  putModel(xdg, '1.0.0', { manifest: { model: 'rwxlite-1.0.1+00000000' } });
  const r = findModel({ XDG_CACHE_HOME: xdg });
  assert.equal(r.status, 'bad');
  assert.match(r.reason, /does not match the directory name/);

  const xdg2 = scratch();
  fs.mkdirSync(path.join(xdg2, 'rwxmap', 'rwxlite-garbage'), { recursive: true });
  const r2 = findModel({ XDG_CACHE_HOME: xdg2 });
  assert.equal(r2.status, 'bad');
  assert.match(r2.reason, /malformed rwxlite model string/);
});

test('findModel: modelFile that is not a key in files is bad', () => {
  const xdg = scratch();
  putModel(xdg, '1.0.0', { manifest: { modelFile: 'other.bin' } });
  const r = findModel({ XDG_CACHE_HOME: xdg });
  assert.equal(r.status, 'bad');
  assert.match(r.reason, /modelFile is not a key in files/);
});

test('findModel: a file name that escapes the directory is bad and nothing outside is read', () => {
  for (const evil of ['../escape.txt', 'sub/x', 'a\\b', '..']) {
    const xdg = scratch();
    const outside = path.join(xdg, 'rwxmap', 'escape.txt');
    fs.mkdirSync(path.join(xdg, 'rwxmap'), { recursive: true });
    fs.writeFileSync(outside, 'outside');
    const m = putModel(xdg, '1.0.0');
    const manifest = JSON.parse(fs.readFileSync(path.join(m.dir, 'manifest.json'), 'utf8'));
    manifest.files[evil] = sha256(Buffer.from('outside'));
    fs.writeFileSync(path.join(m.dir, 'manifest.json'), JSON.stringify(manifest));
    const r = findModel({ XDG_CACHE_HOME: xdg });
    assert.equal(r.status, 'bad', evil);
    assert.match(r.reason, /unsafe file name/, evil);
  }
});

test('findModel: two valid versions, the highest semver wins (0.10.0 beats 0.9.0)', () => {
  const xdg = scratch();
  putModel(xdg, '0.9.0');
  const newest = putModel(xdg, '0.10.0');
  assert.deepEqual(findModel({ XDG_CACHE_HOME: xdg }), { status: 'ok', model: newest.model, file: path.join(newest.dir, 'model.bin'), rejected: [] });
});

test('findModel: an invalid higher version does not hide a valid lower one, and is reported in rejected', () => {
  const xdg = scratch();
  const low = putModel(xdg, '1.0.0');
  const high = putModel(xdg, '2.0.0');
  fs.appendFileSync(path.join(high.dir, 'model.bin'), 'tampered');
  const r = findModel({ XDG_CACHE_HOME: xdg });
  assert.equal(r.status, 'ok');
  assert.equal(r.model, low.model);
  assert.equal(r.rejected.length, 1);
  assert.equal(r.rejected[0].dir, high.dir);
  assert.match(r.rejected[0].reason, /hash mismatch/);
});
