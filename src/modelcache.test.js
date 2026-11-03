import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import { parseModelString, cacheDir, verifyModelFile, findModel } from './modelcache.js';

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-modelcache-'));
}

/** Write a model file named for the sha8 of its own bytes; returns {model, file}. */
function putModel(xdg, version, bytes, sha8) {
  const hex = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const model = `rwxlite-${version}+${sha8 ?? hex}`;
  const dir = path.join(xdg, 'rwxmap');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${model}.int8`);
  fs.writeFileSync(file, bytes);
  return { model, file };
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

test('verifyModelFile: true only when the first 8 hex of sha256(bytes) equal the sha8', () => {
  const xdg = scratch();
  const good = putModel(xdg, '1.0.0', Buffer.from('weights-a'));
  assert.equal(verifyModelFile(good.file, good.model), true);
  assert.equal(verifyModelFile(good.file, 'rwxlite-1.0.0+00000000'), false);
  assert.throws(() => verifyModelFile(good.file, 'nonsense'), /malformed/);
});

test('findModel: none for a missing or empty cache', () => {
  assert.deepEqual(findModel({ XDG_CACHE_HOME: path.join(scratch(), 'nope') }), { status: 'none' });
  const xdg = scratch();
  fs.mkdirSync(path.join(xdg, 'rwxmap'));
  fs.writeFileSync(path.join(xdg, 'rwxmap', 'notes.txt'), 'x');
  assert.deepEqual(findModel({ XDG_CACHE_HOME: xdg }), { status: 'none' });
});

test('findModel: a verified model is ok, and the newest semver wins', () => {
  const xdg = scratch();
  putModel(xdg, '1.9.0', Buffer.from('old'));
  const newest = putModel(xdg, '1.10.0', Buffer.from('new'));
  assert.deepEqual(findModel({ XDG_CACHE_HOME: xdg }), { status: 'ok', model: newest.model, file: newest.file });
});

test('findModel: a hash mismatch is bad and says so; a malformed name is bad too', () => {
  const xdg = scratch();
  const { file } = putModel(xdg, '2.0.0', Buffer.from('tampered'), 'deadbeef');
  const bad = findModel({ XDG_CACHE_HOME: xdg });
  assert.equal(bad.status, 'bad');
  assert.equal(bad.file, file);
  assert.match(bad.reason, /hash mismatch/);

  const xdg2 = scratch();
  fs.mkdirSync(path.join(xdg2, 'rwxmap'));
  fs.writeFileSync(path.join(xdg2, 'rwxmap', 'rwxlite-garbage.int8'), 'x');
  const bad2 = findModel({ XDG_CACHE_HOME: xdg2 });
  assert.equal(bad2.status, 'bad');
  assert.match(bad2.reason, /malformed/);
});
