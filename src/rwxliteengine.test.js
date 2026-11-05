import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { checkRwxlitePackage, loadRwxliteEngine, readRwxliteVersion, versionInRange } from './rwxliteengine.js';

/**
 * The two steps the CLI runs: the package check, then the model load on the lib it returned.
 * @param {{dir: string, model: string, importer?: (name: string) => Promise<any>, versionReader?: () => string, threads?: number}} o
 */
const load = async ({ importer, versionReader = () => '0.2.0', ...o }) => {
  const pkg = await checkRwxlitePackage({ importer, versionReader });
  return pkg.status === 'off' ? pkg : loadRwxliteEngine({ ...o, lib: pkg.lib });
};
const MODEL = 'rwxlite-0.1.0+0123abcd';
/** @returns {import('./secondpass.js').EngineItem} */
const item = (i) => ({ index: i, method: 'POST', path: `/p${i}`, operationId: `op${i}`, summary: `s${i}`, description: `d${i}`, lean: { class: /** @type {'x'} */ ('x'), rule: 'floor' } });
const ok = (isX, changes, model = MODEL) => ({ model, answers: { isX: { noul: isX }, changes: { noul: changes } } });

/** An importer for a fake `rwxlite` whose answerer is `answerer`; records loadAnswerer's options. */
function fake(answerer, seen = []) {
  return async (name) => {
    assert.equal(name, 'rwxlite');
    return { loadAnswerer: async (opts) => { seen.push(opts); return answerer; } };
  };
}

test('loadRwxliteEngine: maps requests to rwxlite\'s shape and successes to {pIsX, pChanges, model}', async () => {
  const requests = [];
  const seen = [];
  const answerer = { model: MODEL, answerMany: async (reqs) => { requests.push(...reqs); return reqs.map((_, i) => ok(0.1 * (i + 1), 0.1 * (i + 1) + 0.5)); } };
  const r = await load({ dir: '/m/dir', model: MODEL, importer: fake(answerer, seen), threads: 2 });
  assert.ok(r.status === 'on');
  assert.equal(r.engine.model, MODEL);
  assert.deepEqual(seen, [{ dir: '/m/dir', threads: 2 }]);
  const out = /** @type {any[]} */ (await r.engine.run([item(0), item(1)]));
  assert.deepEqual(requests[0], {
    state: { method: 'POST', path: '/p0', operationId: 'op0', summary: 's0', description: 'd0' },
    questions: { isX: 1, changes: 1 },
    lean: { class: 'x', rule: 'floor' },
  });
  assert.deepEqual(out, [{ pIsX: 0.1, pChanges: 0.6, model: MODEL }, { pIsX: 0.2, pChanges: 0.7, model: MODEL }]);
});

test('loadRwxliteEngine: {model, error} slots, malformed answers and non-objects become {error} (undecided downstream)', async () => {
  const answerer = {
    model: MODEL,
    answerMany: async () => [
      { model: MODEL, error: 'rwxlite: state needs string method and path' },
      { model: MODEL, answers: { isX: { noul: 0.5 } } }, // changes missing
      { model: MODEL, answers: { isX: { noul: '0.5' }, changes: { noul: 0.9 } } },
      { answers: { isX: { noul: 0.5 }, changes: { noul: 0.9 } } }, // no model
      null,
      ok(0.5, 0.9),
    ],
  };
  const r = await load({ dir: '/d', model: MODEL, importer: fake(answerer) });
  assert.ok(r.status === 'on');
  const out = /** @type {any[]} */ (await r.engine.run([0, 1, 2, 3, 4, 5].map(item)));
  assert.deepEqual(out.map((o) => ('error' in o ? 'error' : 'ok')), ['error', 'error', 'error', 'error', 'error', 'ok']);
  assert.equal(out[0].error, 'rwxlite: state needs string method and path');
});

test('loadRwxliteEngine: a thrown answerMany, or the wrong number of answers, fails those slots and nothing else', async () => {
  let calls = 0;
  const answerer = { model: MODEL, answerMany: async (reqs) => { calls += 1; if (calls === 1) throw new Error('onnx blew up'); return reqs.length > 1 ? [] : reqs.map(() => ok(0.5, 0.9)); } };
  const r = await load({ dir: '/d', model: MODEL, importer: fake(answerer) });
  assert.ok(r.status === 'on');
  const many = Array.from({ length: 70 }, (_, i) => item(i)); // 64 + 6: two answerMany calls
  const out = /** @type {any[]} */ (await r.engine.run(many));
  assert.equal(out.length, 70);
  assert.ok(out.slice(0, 64).every((o) => o.error === 'onnx blew up'));
  assert.ok(out.slice(64).every((o) => /wrong number/.test(o.error)));
  const again = await r.engine.run([item(0)]);
  assert.deepEqual(again, [{ pIsX: 0.5, pChanges: 0.9, model: MODEL }]);
});

test('loadRwxliteEngine: rows are sent in chunks of 64', async () => {
  const sizes = [];
  const answerer = { model: MODEL, answerMany: async (reqs) => { sizes.push(reqs.length); return reqs.map(() => ok(0.5, 0.9)); } };
  const r = await load({ dir: '/d', model: MODEL, importer: fake(answerer) });
  assert.ok(r.status === 'on');
  const out = /** @type {any[]} */ (await r.engine.run(Array.from({ length: 130 }, (_, i) => item(i))));
  assert.deepEqual(sizes, [64, 64, 2]);
  assert.equal(out.length, 130);
});

test('loadRwxliteEngine: package not installed -> off with the install hint; other import errors are named', async () => {
  const missing = async () => { throw Object.assign(new Error("Cannot find package 'rwxlite' imported from /x/rwxliteengine.js"), { code: 'ERR_MODULE_NOT_FOUND' }); };
  assert.deepEqual(await load({ dir: '/d', model: MODEL, importer: missing }), { status: 'off', reason: 'the rwxlite package is not installed (npm install rwxlite@0.2)' });
  const otherMissing = async () => { throw Object.assign(new Error("Cannot find package 'zzz' imported from /x/rwxlite/index.js"), { code: 'ERR_MODULE_NOT_FOUND' }); };
  const o = await load({ dir: '/d', model: MODEL, importer: otherMissing });
  assert.equal(o.status, 'off');
  assert.match(o.reason, /could not be loaded \(Cannot find package 'zzz'/);
});

test('loadRwxliteEngine: loadAnswerer throwing -> off; the ONNXRUNTIME_NODE_INSTALL hint only when it is about onnxruntime-node', async () => {
  const ort = await load({ dir: '/d', model: MODEL, importer: async () => ({ loadAnswerer: async () => { throw new Error('rwxlite: onnxruntime-node is not installed (it is an optional dependency)'); } }) });
  assert.equal(ort.status, 'off');
  assert.match(ort.reason, /onnxruntime-node is not installed.*ONNXRUNTIME_NODE_INSTALL=skip npm install onnxruntime-node/);
  const hash = await load({ dir: '/d', model: MODEL, importer: async () => ({ loadAnswerer: async () => { throw new Error('rwxlite: vocab.txt sha256 does not match manifest.json'); } }) });
  assert.equal(hash.status, 'off');
  assert.match(hash.reason, /sha256 does not match/);
  assert.doesNotMatch(hash.reason, /ONNXRUNTIME_NODE_INSTALL/);
});

test('loadRwxliteEngine: an answerer whose model string differs from the verified folder is refused', async () => {
  const r = await load({ dir: '/d', model: MODEL, importer: fake({ model: 'rwxlite-0.1.0+ffffffff', answerMany: async () => [] }) });
  assert.equal(r.status, 'off');
  assert.match(r.reason, /rwxlite-0\.1\.0\+ffffffff.*verified folder is rwxlite-0\.1\.0\+0123abcd/);
});

test('loadRwxliteEngine (D135): package 0.2.0 and 0.2.1 are on; 0.3.0, 0.1.9, 1.2.0 are off with the reason', async () => {
  const answerer = { model: MODEL, answerMany: async (reqs) => reqs.map(() => ok(0.1, 0.2)) };
  for (const v of ['0.2.0', '0.2.1', '0.2.17']) {
    const r = await load({ dir: '/d', model: MODEL, importer: fake(answerer), versionReader: () => v });
    assert.equal(r.status, 'on', v);
  }
  for (const v of ['0.3.0', '0.1.9', '1.2.0']) {
    const r = await load({ dir: '/d', model: MODEL, importer: fake(answerer), versionReader: () => v });
    assert.deepEqual(r, { status: 'off', reason: `the rwxlite package is ${v}; this rwxmap accepts 0.2.x (D135); npm install rwxlite@0.2` }, v);
  }
});

test('loadRwxliteEngine (D135): pre-release, garbage, non-string and unreadable versions are off (fail closed)', async () => {
  const answerer = { model: MODEL, answerMany: async () => [] };
  for (const v of ['0.2.1-beta', '0.2', 'x.y.z', '', undefined, 2, null]) {
    const r = await load({ dir: '/d', model: MODEL, importer: fake(answerer), versionReader: () => /** @type {any} */ (v) });
    assert.equal(r.status, 'off', String(v));
    assert.match(/** @type {any} */ (r).reason, /^the rwxlite package is .*this rwxmap accepts 0\.2\.x \(D135\); npm install rwxlite@0\.2$/, String(v));
  }
  const r = await load({ dir: '/d', model: MODEL, importer: fake(answerer), versionReader: () => { throw new Error('boom'); } });
  assert.deepEqual(r, { status: 'off', reason: 'the rwxlite package version could not be read (boom); this rwxmap accepts 0.2.x (D135); npm install rwxlite@0.2' });
  assert.equal(versionInRange('0.2.0+build'), false);
});

test('readRwxliteVersion: walks up from the resolved entry to the package.json named rwxlite', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxlite-ver-'));
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'rwxlite', version: '0.2.1' }));
    fs.writeFileSync(path.join(root, 'src', 'package.json'), JSON.stringify({ name: 'other', version: '9.9.9' }));
    const resolve = () => pathToFileURL(path.join(root, 'src', 'index.js')).href;
    assert.equal(readRwxliteVersion(resolve), '0.2.1');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'not-rwxlite', version: '0.2.1' }));
    assert.throws(() => readRwxliteVersion(resolve));
    assert.throws(() => readRwxliteVersion(() => { throw new Error('not installed'); }), /not installed/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
