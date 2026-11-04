import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import { ensureModel, MANIFEST_URLS, MAX_TOTAL_BYTES } from './modeldownload.js';
import { findModel } from './modelcache.js';

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-modeldl-'));
const BASE = 'https://github.com/hamr0/rwxlite/releases/latest/download/';

/**
 * A fake release: the small and exact manifests plus their files, served by an
 * injected fetch. `seen` records every URL asked for, in order.
 * opts.version, opts.weights, opts.tamper (file name -> wrong bytes served),
 * opts.redirect ({name: url}: that file answers 302 to url), opts.hostile.
 */
function release(opts = {}) {
  const version = opts.version ?? '0.1.0';
  const weights = opts.weights ?? Buffer.from('fp32-weights-' + version);
  const vocab = Buffer.from('vocab-' + version);
  const model = `rwxlite-${version}+${sha256(weights).slice(0, 8)}`;
  const manifest = { version, modelFile: 'model-fp32.onnx', model, files: { 'model-fp32.onnx': sha256(weights), 'vocab.txt': sha256(vocab) }, ...opts.manifest };
  const served = new Map([
    [BASE + 'manifest-exact.json', Buffer.from(JSON.stringify(manifest))],
    [BASE + 'model-fp32.onnx', weights],
    [BASE + 'vocab.txt', vocab],
  ]);
  for (const [name, bytes] of Object.entries(opts.tamper ?? {})) served.set(BASE + name, bytes);
  const seen = [];
  const fetchImpl = async (url) => {
    const u = String(url);
    seen.push(u);
    if (opts.offline) throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND github.com') });
    const name = u.slice(u.lastIndexOf('/') + 1);
    if (opts.redirect && opts.redirect[name] && u.startsWith(BASE)) return new Response(null, { status: 302, headers: { location: opts.redirect[name] } });
    if (u.startsWith('https://objects.githubusercontent.com/')) return new Response(served.get(BASE + name), { status: 200 });
    if (!served.has(u)) return new Response('nope', { status: 404 });
    return new Response(served.get(u), { status: 200, headers: { 'content-length': String(served.get(u).length) } });
  };
  return { fetchImpl, seen, model, manifest, weights, vocab };
}

const cacheFolders = (xdg) => (fs.existsSync(path.join(xdg, 'rwxmap')) ? fs.readdirSync(path.join(xdg, 'rwxmap')) : []);

test('ensureModel: downloads every listed file, verifies, installs rwxlite-<semver>+<sha8>/ with manifest.json, prints one line per file', async () => {
  const xdg = scratch();
  const rel = release();
  const lines = [];
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel.fetchImpl, log: (l) => lines.push(l) });
  assert.ok(got.status === 'ready');
  assert.equal(got.model, rel.model);
  assert.equal(got.dir, path.join(xdg, 'rwxmap', rel.model));
  assert.deepEqual(rel.seen, [MANIFEST_URLS.exact, BASE + 'model-fp32.onnx', BASE + 'vocab.txt']);
  assert.deepEqual(cacheFolders(xdg), [rel.model]); // no temp folder left
  assert.deepEqual(fs.readdirSync(got.dir).sort(), ['manifest.json', 'model-fp32.onnx', 'vocab.txt']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(got.dir, 'manifest.json'), 'utf8')), rel.manifest);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /downloading model-fp32\.onnx \(/);
  assert.match(lines[1], /downloading vocab\.txt \(/);
  assert.equal(findModel({ XDG_CACHE_HOME: xdg }).status, 'ok');
});

test('ensureModel: variant small asks for manifest.json', async () => {
  const rel = release();
  await ensureModel({ variant: 'small', environ: { XDG_CACHE_HOME: scratch() }, fetchImpl: rel.fetchImpl });
  assert.equal(rel.seen[0], BASE + 'manifest.json');
});

test('ensureModel: a second run re-reads only the manifest, never the model files', async () => {
  const xdg = scratch();
  const rel = release();
  await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel.fetchImpl });
  rel.seen.length = 0;
  const lines = [];
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel.fetchImpl, log: (l) => lines.push(l) });
  assert.equal(got.status, 'ready');
  assert.deepEqual(rel.seen, [MANIFEST_URLS.exact]);
  assert.deepEqual(lines, []);
});

test('ensureModel: a newer release downloads beside the old model and wins', async () => {
  const xdg = scratch();
  await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: release().fetchImpl });
  const rel2 = release({ version: '0.2.0' });
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel2.fetchImpl });
  assert.ok(got.status === 'ready');
  assert.equal(got.model, rel2.model);
  assert.equal(cacheFolders(xdg).length, 2);
});

test('ensureModel: tampered bytes fail the sha256 check; nothing is installed (no rwxlite-* folder, no temp folder)', async () => {
  const xdg = scratch();
  const rel = release({ tamper: { 'vocab.txt': Buffer.from('evil') } });
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel.fetchImpl });
  assert.equal(got.status, 'off');
  assert.match(got.reason, /hash mismatch.*vocab\.txt/);
  assert.deepEqual(cacheFolders(xdg), []);
});

test('ensureModel: a model file that does not match the sha8 in its model string is not installed', async () => {
  const xdg = scratch();
  const rel = release({ manifest: { model: 'rwxlite-0.1.0+deadbeef' } });
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel.fetchImpl });
  assert.equal(got.status, 'off');
  assert.match(got.reason, /hash mismatch|sha8/);
  assert.deepEqual(cacheFolders(xdg), []);
});

test('ensureModel: hostile manifests (path in a file name, missing sha, malformed model) download nothing', async () => {
  for (const bad of [
    { files: { '../x': 'a'.repeat(64), 'model-fp32.onnx': 'a'.repeat(64) } },
    { files: { 'model-fp32.onnx': 'short' } },
    { model: 'not-a-model' },
  ]) {
    const xdg = scratch();
    const rel = release({ manifest: bad });
    const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel.fetchImpl });
    assert.equal(got.status, 'off', JSON.stringify(bad));
    assert.deepEqual(rel.seen, [MANIFEST_URLS.exact]);
    assert.deepEqual(cacheFolders(xdg), []);
  }
});

test('ensureModel: a redirect to an allowed host (*.githubusercontent.com) is followed, and every hop is checked', async () => {
  const xdg = scratch();
  const rel2 = release({ redirect: { 'model-fp32.onnx': 'https://objects.githubusercontent.com/x/model-fp32.onnx' } });
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel2.fetchImpl });
  assert.equal(got.status, 'ready');
  assert.ok(rel2.seen.includes('https://objects.githubusercontent.com/x/model-fp32.onnx'));
});

test('ensureModel: a redirect to any other host, to http, or to a lookalike is refused; nothing is requested there or installed', async () => {
  for (const target of ['https://evil.example/model-fp32.onnx', 'http://github.com/model-fp32.onnx', 'https://githubusercontent.com.evil.example/m', 'https://notgithub.com/m', 'https://127.0.0.1/m']) {
    const xdg = scratch();
    const rel = release({ redirect: { 'model-fp32.onnx': target } });
    const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel.fetchImpl });
    assert.equal(got.status, 'off', target);
    assert.match(got.reason, /refused/, target);
    assert.ok(!rel.seen.includes(target), `${target} must never be requested`);
    assert.deepEqual(cacheFolders(xdg), []);
  }
});

test('ensureModel: a redirect loop stops at the hop limit', async () => {
  let n = 0;
  const fetchImpl = async () => { n += 1; return new Response(null, { status: 302, headers: { location: BASE + 'manifest-exact.json' } }); };
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: scratch() }, fetchImpl });
  assert.equal(got.status, 'off');
  assert.match(got.reason, /too many redirects/);
  assert.ok(n <= 7);
});

test('ensureModel: a body over the total byte cap is refused, no folder installed', async () => {
  const xdg = scratch();
  const rel = release();
  const real = rel.fetchImpl;
  const big = new Uint8Array(1024 * 1024);
  const fetchImpl = async (url) => {
    if (String(url).endsWith('model-fp32.onnx')) {
      let sent = 0;
      return new Response(new ReadableStream({
        pull(c) { if (sent > MAX_TOTAL_BYTES) c.close(); else { sent += big.length; c.enqueue(big); } },
      }), { status: 200 });
    }
    return real(url);
  };
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl });
  assert.equal(got.status, 'off');
  assert.match(got.reason, /larger than the 200 MB cap/);
  assert.deepEqual(cacheFolders(xdg), []);
});

test('ensureModel: a request that never answers times out and the run is not stopped', async () => {
  // AbortSignal.timeout's timer is unref'd (a real socket keeps the loop alive); a ref'd timer stands in for it.
  const fetchImpl = (url, init) => new Promise((_, reject) => {
    const keep = setTimeout(() => {}, 5000);
    init.signal.addEventListener('abort', () => { clearTimeout(keep); reject(init.signal.reason); });
  });
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: scratch() }, fetchImpl, manifestTimeoutMs: 30 });
  assert.equal(got.status, 'off');
  assert.match(got.reason, /could not get the model/);
});

test('ensureModel: HTTP 404 (not published) or offline with no cache -> off with the reason', async () => {
  const xdg = scratch();
  const a = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: async () => new Response('nope', { status: 404 }) });
  assert.equal(a.status, 'off');
  assert.match(a.reason, /HTTP 404.*none in the cache/);
  const b = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: release({ offline: true }).fetchImpl });
  assert.equal(b.status, 'off');
  assert.match(b.reason, /fetch failed: getaddrinfo ENOTFOUND github\.com.*none in the cache/);
  assert.deepEqual(cacheFolders(xdg), []);
});

test('ensureModel: offline or failing with a verified cached model -> uses the highest one and says so', async () => {
  const xdg = scratch();
  await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: release({ version: '0.1.0' }).fetchImpl });
  const newer = release({ version: '0.3.0' });
  await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: newer.fetchImpl });
  for (const fetchImpl of [release({ offline: true }).fetchImpl, release({ tamper: { 'vocab.txt': Buffer.from('evil') }, version: '0.9.0' }).fetchImpl]) {
    const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl });
    assert.equal(got.status, 'ready');
    assert.equal(got.model, newer.model);
    assert.match(got.notes.join('\n'), new RegExp(`using cached ${newer.model.replace(/[+.]/g, '\\$&')}, could not check for a newer one`));
  }
  assert.equal(cacheFolders(xdg).length, 2); // the failed 0.9.0 left nothing
});

test('ensureModel: offline with only a corrupt cached model -> off, loud warning', async () => {
  const xdg = scratch();
  const rel = release();
  await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel.fetchImpl });
  fs.writeFileSync(path.join(xdg, 'rwxmap', rel.model, 'vocab.txt'), 'corrupted');
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: release({ offline: true }).fetchImpl });
  assert.equal(got.status, 'off');
  assert.match(got.reason, /cached model was rejected/);
  assert.match(got.notes.join('\n'), /WARNING: rwxlite model rejected \(hash mismatch/);
});

test('ensureModel: a cached model that is corrupt is re-downloaded when the network works', async () => {
  const xdg = scratch();
  const rel = release();
  await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: rel.fetchImpl });
  fs.writeFileSync(path.join(xdg, 'rwxmap', rel.model, 'vocab.txt'), 'corrupted');
  fs.rmSync(path.join(xdg, 'rwxmap', rel.model), { recursive: true });
  const got = await ensureModel({ environ: { XDG_CACHE_HOME: xdg }, fetchImpl: release().fetchImpl });
  assert.equal(got.status, 'ready');
  assert.equal(fs.readFileSync(path.join(got.dir, 'vocab.txt'), 'utf8'), 'vocab-0.1.0');
});
