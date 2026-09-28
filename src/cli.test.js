import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { run } from './cli.js';

// ---------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------

// One operation of each class, by method-floor evidence alone (no word
// list needs to fire): GET -> r, PUT -> w (floor, review "loose"), DELETE
// -> x (floor, review "settled"). Matches the D104 hint table's three
// rows.
const SPEC_DOC = {
  openapi: '3.0.0',
  servers: [{ url: 'https://api.example.com' }],
  paths: {
    '/things': { get: { operationId: 'listThings' } },
    '/things/{id}': { put: { operationId: 'updateThing' } },
    '/things/{id}/permission': { delete: { operationId: 'deleteThingPermission' } },
  },
};

const SPEC_NO_SERVERS_DOC = {
  openapi: '3.0.0',
  paths: {
    '/things': { get: { operationId: 'listThings' } },
  },
};

const SPEC_OPENAPI3_SERVERS_DOC = {
  openapi: '3.0.0',
  servers: [{ url: 'https://api.acme.example' }],
  paths: {
    '/things': { get: { operationId: 'listThings' } },
  },
};

const SPEC_SWAGGER2_HOST_DOC = {
  swagger: '2.0',
  host: 'api.legacy.example',
  basePath: '/v1',
  paths: {
    '/things': { get: { operationId: 'listThings' } },
  },
};

function mkScratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-cli-test-'));
}

function writeSpecFile(dir, name, doc) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(doc));
  return p;
}

function captureStream() {
  const chunks = [];
  return { write: (s) => chunks.push(s), text: () => chunks.join('') };
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ---------------------------------------------------------------------
// D104 hint mapping (go/no-go bar 3) — one assertion per class.
// ---------------------------------------------------------------------

test('run: emits the D104 hint mapping for r, w and x', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });
  assert.equal(code, 0, stderr.text());

  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  const r = combined.mcp['GET /things'];
  const w = combined.mcp['PUT /things/{id}'];
  const x = combined.mcp['DELETE /things/{id}/permission'];

  assert.deepEqual(r.annotations, { readOnlyHint: true });
  assert.equal(r._meta['io.github.hamr0.rwxmap/class'], 'r');

  assert.deepEqual(w.annotations, { readOnlyHint: false, destructiveHint: false });
  assert.equal(w._meta['io.github.hamr0.rwxmap/class'], 'w');

  assert.deepEqual(x.annotations, { readOnlyHint: false, destructiveHint: true });
  assert.equal(x._meta['io.github.hamr0.rwxmap/class'], 'x');

  // idempotentHint/openWorldHint are closed — never emitted, on any class.
  for (const entry of [r, w, x]) {
    assert.equal('idempotentHint' in entry.annotations, false);
    assert.equal('openWorldHint' in entry.annotations, false);
  }

  // bareguard.tools and mcp agree, since both come from the one
  // exportGate/exportSidecar call.
  const bareguardLetters = Object.values(combined.bareguard.tools).map((e) => e.letter).sort();
  const mcpLetters = Object.values(combined.mcp).map((e) => e._meta['io.github.hamr0.rwxmap/class']).sort();
  assert.deepEqual(bareguardLetters, mcpLetters);
});

// ---------------------------------------------------------------------
// go/no-go bar 4 — no spec found; load failures; existing file; no vendor.
// ---------------------------------------------------------------------

test('run: a bare address with no findable spec exits 1 and writes no file', async (t) => {
  const originalFetch = globalThis.fetch;
  // Every discovery probe (guess paths, catalog, link header) and the
  // "try it as a spec" load both see a plain 404 — nothing is ever found.
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (async () => ({
    ok: false,
    status: 404,
    headers: { get: () => null },
    body: null,
    text: async () => '',
    arrayBuffer: async () => new ArrayBuffer(0),
  })));
  t.after(() => { globalThis.fetch = originalFetch; });

  const outDir = mkScratch();
  const cacheDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run(['https://nospec.example.test', '-o', outDir], {
    cwd: outDir, stdout, stderr, cacheDir,
  });

  assert.equal(code, 1);
  assert.match(stderr.text(), /no spec found/);
  assert.deepEqual(fs.readdirSync(outDir), []);
});

test('run: a missing local file exits 1 and writes no file', async () => {
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([path.join(outDir, 'does-not-exist.json'), '-o', outDir, '--vendor', 'x'], {
    cwd: outDir, stdout, stderr,
  });

  assert.equal(code, 1);
  assert.notEqual(stderr.text(), '');
  assert.deepEqual(fs.readdirSync(outDir), []);
});

test('run: binary content exits 1 and writes no file', async () => {
  const dir = mkScratch();
  const outDir = mkScratch();
  const binPath = path.join(dir, 'spec.json');
  fs.writeFileSync(binPath, Buffer.from([0x00, 0x01, 0x02, 0x03]));
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([binPath, '-o', outDir, '--vendor', 'x'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(stderr.text(), /binary content/);
  assert.deepEqual(fs.readdirSync(outDir), []);
});

test('run: an existing output file without --force exits 1 and leaves it untouched', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  const mapPath = path.join(outDir, 'example.rwxmap.json');
  fs.writeFileSync(mapPath, 'SENTINEL');

  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.equal(fs.readFileSync(mapPath, 'utf8'), 'SENTINEL');
  assert.equal(fs.existsSync(path.join(outDir, 'example.rwxmap.review.json')), false);
});

test('run: --force overwrites an existing pair', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  fs.writeFileSync(path.join(outDir, 'example.rwxmap.json'), 'SENTINEL');
  fs.writeFileSync(path.join(outDir, 'example.rwxmap.review.json'), 'SENTINEL');

  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--force'], { cwd: dir, stdout, stderr });

  assert.equal(code, 0, stderr.text());
  assert.notEqual(fs.readFileSync(path.join(outDir, 'example.rwxmap.json'), 'utf8'), 'SENTINEL');
});

test('run: a local file with no servers and no --vendor exits 1', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_NO_SERVERS_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(stderr.text(), /vendor/);
  assert.deepEqual(fs.readdirSync(outDir), []);
});

test('run: a local file with an OpenAPI 3 servers entry defaults vendor to its host', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_OPENAPI3_SERVERS_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir], { cwd: dir, stdout, stderr });

  assert.equal(code, 0, stderr.text());
  assert.equal(fs.existsSync(path.join(outDir, 'api.acme.example.rwxmap.json')), true);
  const combined = readJson(path.join(outDir, 'api.acme.example.rwxmap.json'));
  assert.equal(combined.vendor, 'api.acme.example');
});

test('run: a local file with a Swagger 2 host defaults vendor to that host', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_SWAGGER2_HOST_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir], { cwd: dir, stdout, stderr });

  assert.equal(code, 0, stderr.text());
  assert.equal(fs.existsSync(path.join(outDir, 'api.legacy.example.rwxmap.json')), true);
  const combined = readJson(path.join(outDir, 'api.legacy.example.rwxmap.json'));
  assert.equal(combined.vendor, 'api.legacy.example');
});

// ---------------------------------------------------------------------
// Atomic write path.
// ---------------------------------------------------------------------

test('run: writes both files via tmp+rename, leaving no tmp files behind', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });

  assert.equal(code, 0, stderr.text());
  const entries = fs.readdirSync(outDir).sort();
  assert.deepEqual(entries, ['example.rwxmap.json', 'example.rwxmap.review.json']);
  // both parse as JSON — a partially-written file would fail this.
  readJson(path.join(outDir, 'example.rwxmap.json'));
  readJson(path.join(outDir, 'example.rwxmap.review.json'));
});

test('run: a write failure (target path is not a directory) exits 1 and writes no file', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const notADir = path.join(mkScratch(), 'blocking-file');
  fs.writeFileSync(notADir, 'x');
  // outDir/example.rwxmap.json's parent path is a FILE, not a directory —
  // mkdirSync(outDir) and the subsequent writes must both fail cleanly.
  const outDir = path.join(notADir, 'nested');

  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(stderr.text(), /could not write output/);
  assert.equal(fs.existsSync(outDir), false);
});

// ---------------------------------------------------------------------
// Stdout summary always names the mode.
// ---------------------------------------------------------------------

test('run: stdout always says Jev is off (mechanical)', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });

  assert.equal(code, 0, stderr.text());
  assert.match(stdout.text(), /Jev: off \(mechanical\)/);
});
