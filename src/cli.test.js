import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import fsDefault from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { run as runCli } from './cli.js';
import { matcherFrom } from './matcher.js';
import { JEV_LOWER_THRESHOLD, JEV_LOWER_R_THRESHOLD, JEV_RAISE_WX_THRESHOLD, JEV_RAISE_GET_THRESHOLD, jevQuestions } from './jev.js';

// ---------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------

// Every test goes through this `run`: the model download sees an offline
// network and an empty scratch cache unless a test passes its own, so no test
// reaches the real network or the real ~/.cache.
const offlineFetch = async () => { throw new Error('offline (test)'); };
function run(argv, env) {
  return runCli(argv, { modelFetch: offlineFetch, xdgCacheHome: mkScratch(), ...env });
}

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

// One operation in each of the three Jev piles, plus two controls that
// must NEVER be sent to Jev: a DELETE (method-delete, step 2's own floor,
// not step 2's floor-post pile) and a POST whose lead verb a word list
// already claims (list evidence, not a floor at all).
// Pile rows are DELIBERATELY interleaved with the two non-pile controls
// (indices 1, 3, 4 are pile rows; 0 and 2 are not) rather than grouped at
// the front — a wiring bug that zips a Jev answer back onto the WRONG
// operation (e.g. by pile-relative position instead of the operation's
// own index in `ops`) would go undetected if every pile row happened to
// sit at the same position in both orderings.
const SPEC_JEV_DOC = {
  openapi: '3.0.0',
  servers: [{ url: 'https://api.example.com' }],
  paths: {
    '/things/{id}/permission': { delete: { operationId: 'deleteThingPermission' } }, // idx0: x, rule "method-delete", NOT a pile
    '/things': { get: { operationId: 'listThings' } }, // idx1: r, rule "method" -> jev-raise-get pile
    '/things/{id}/archive': { post: { operationId: 'updateThingArchive' } }, // idx2: w, rule "modify-verb" (list evidence), NOT a pile
    '/things/{id}': { put: { operationId: 'updateThing' } }, // idx3: w, rule "method-floor" -> jev-raise-wx pile
    '/mystery': { post: { operationId: 'doMystery' } }, // idx4: x, rule "floor-post" -> jev-lower pile
  },
};

/**
 * A fetch stub keyed by operationId. `routes[operationId]` is one of:
 *   { p, model?, pChanges? } -- a usable answer at that probability;
 *                         `pChanges`, when set, answers the changes
 *                         question instead of `p` (a jev-lower row's
 *                         second question, D129)
 *   { fail: true }        -- a non-ok HTTP status (never retried, 400)
 *   { malformed: true }   -- 200 OK but no usable answer for the question
 * Any operationId not named in `routes` is a bug in the test (throws),
 * so a stray/unexpected send is never silently answered.
 *
 * @param {Record<string, {p?: number, pChanges?: number, model?: string, fail?: boolean, malformed?: boolean, usage?: any}>} routes
 *   `usage` (optional) is sent back verbatim as the response's `usage`.
 * @returns {{fetchImpl: (url: string, init: any) => Promise<any>, calls: Array<{operationId: string, body: any}>}}
 */
function routedJevFetch(routes) {
  /** @type {Array<{operationId: string, body: any}>} */
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    const opId = body.state.operationId;
    calls.push({ operationId: opId, body });
    const route = routes[opId];
    if (!route) throw new Error(`routedJevFetch: unexpected request for operationId ${opId}`);
    if (route.fail) return { ok: false, status: 400, json: async () => ({}) };
    if (route.malformed) return { ok: true, status: 200, json: async () => ({ model: route.model || 'jev-1.0.0', answers: {}, usage: route.usage }) };
    const qKey = Object.keys(body.questions)[0];
    const p = qKey === 'changes' && route.pChanges !== undefined ? route.pChanges : route.p;
    return {
      ok: true,
      status: 200,
      json: async () => ({ model: route.model || 'jev-1.0.0', answers: { [qKey]: { noul: p } }, usage: route.usage }),
    };
  };
  return { fetchImpl, calls };
}

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

test('run: a missing local file says so plainly', async () => {
  const dir = mkScratch();
  const stderr = captureStream();
  const code = await run(['./nope.json', '--vendor', 'x'], { cwd: dir, stdout: captureStream(), stderr });
  assert.equal(code, 1);
  assert.equal(stderr.text(), 'rwxmap: no such file: ./nope.json\n');
});

/** Every fetch answers `status` with `text` — discovery and the spec load alike. */
function fetchAll(status, text = '') {
  return /** @type {typeof fetch} */ (/** @type {unknown} */ (async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    body: null,
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  })));
}

test('run: no spec found does not repeat itself when the address loaded fine', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchAll(200, JSON.stringify({ openapi: '3.0.0', paths: {} }));
  t.after(() => { globalThis.fetch = originalFetch; });
  const dir = mkScratch();
  const stderr = captureStream();
  const code = await run(['https://nospec.example.test'], { cwd: dir, stdout: captureStream(), stderr, cacheDir: mkScratch() });
  assert.equal(code, 1);
  assert.equal(stderr.text(), 'rwxmap: no spec found for https://nospec.example.test\n');
});

test('run: no spec found keeps the load error of the address itself', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchAll(503);
  t.after(() => { globalThis.fetch = originalFetch; });
  const dir = mkScratch();
  const stderr = captureStream();
  const code = await run(['https://down.example.test'], { cwd: dir, stdout: captureStream(), stderr, cacheDir: mkScratch() });
  assert.equal(code, 1);
  assert.equal(stderr.text(), 'rwxmap: no spec found for https://down.example.test (as a spec: http 503)\n');
});

/** Run the CLI on one input in a scratch dir; returns the exit code, both streams and the dir. */
async function runIn(argv, dir = mkScratch()) {
  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run(argv, { cwd: dir, stdout, stderr });
  return { code, stdout: stdout.text(), stderr: stderr.text(), dir };
}

test('run: a --vendor with a path separator, or blank, or all dots, is refused before any I/O', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  for (const vendor of ['a/b', 'a\\b', '.', '..', '', ' ', '\t', '...', '....']) {
    const r = await runIn([specPath, '--vendor', vendor], dir);
    assert.equal(r.code, 1);
    assert.equal(r.stderr, `rwxmap: --vendor must be a plain name (no / or \\): ${vendor}\n`);
  }
  assert.deepEqual(fs.readdirSync(dir), ['spec.json']);
});

test('run: a --vendor with dots inside is accepted', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const r = await runIn([specPath, '--vendor', 'a.b'], dir);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'a.b.rwxmap.json')));
});

test('run: a --vendor with edge whitespace or a control/format character is refused, ordinary Unicode and internal spaces are not', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  for (const vendor of ['\u200b', ' a ', 'a ', ' a', 'a\u0000b', 'a\u200bb', '\ufeffa']) {
    const r = await runIn([specPath, '--vendor', vendor], dir);
    assert.equal(r.code, 1);
    assert.equal(r.stderr, `rwxmap: --vendor must be a plain name (no / or \\): ${vendor}\n`);
  }
  assert.deepEqual(fs.readdirSync(dir), ['spec.json']);
  for (const vendor of ['café', 'acme-prod']) {
    const r = await runIn([specPath, '--vendor', vendor], dir);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(fs.existsSync(path.join(dir, `${vendor}.rwxmap.json`)));
  }
});

test('run: an empty -o is refused and nothing is written; a missing -o still means the current folder', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const r = await runIn([specPath, '--vendor', 'x', '-o', ''], dir);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, 'rwxmap: -o needs a directory: -o <dir>\n');
  assert.deepEqual(fs.readdirSync(dir), ['spec.json']);
  const ok = await runIn([specPath, '--vendor', 'x'], dir);
  assert.equal(ok.code, 0, ok.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'x.rwxmap.json')));
});

test('run: bad arguments are reported in a fixed order: address count, then --vendor, then -o', async () => {
  /** @type {[string[], string][]} */
  const cases = [
    [['a.json', 'b.json', '--vendor', '/', '-o', '=x'], 'rwxmap: expected exactly one address, got 2\n'],
    [['a.json', '--vendor', '/', '-o', '=x'], 'rwxmap: --vendor must be a plain name (no / or \\): /\n'],
    [['a.json', '--vendor', 'ok', '-o', '=x'], 'rwxmap: -o takes a space, not "=": -o <dir>\n'],
    [['a.json', '--vendor', 'ok', '-o', ''], 'rwxmap: -o needs a directory: -o <dir>\n'],
  ];
  for (const [argv, message] of cases) {
    const r = await runIn(argv);
    assert.equal(r.code, 1);
    assert.ok(r.stderr.startsWith(message), r.stderr);
  }
});

test('run: -o=<dir> is refused, it takes a space, and nothing is written', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  for (const arg of ['-o=', '-o=foo']) {
    const r = await runIn([specPath, '--vendor', 'x', arg], dir);
    assert.equal(r.code, 1);
    assert.equal(r.stderr, 'rwxmap: -o takes a space, not "=": -o <dir>\n');
  }
  assert.deepEqual(fs.readdirSync(dir), ['spec.json']);
});

test('run: an openapi or swagger key with a value that is not 3.x or 2.x is not a spec', async () => {
  const paths = { '/things': { get: { operationId: 'listThings' } } };
  for (const version of [{ openapi: 'banana' }, { openapi: '4.0.0' }, { openapi: true }, { swagger: '1.2' }]) {
    const dir = mkScratch();
    const specPath = writeSpecFile(dir, 'bad.json', { ...version, paths });
    const r = await runIn([specPath, '--vendor', 'x'], dir);
    assert.equal(r.code, 1, JSON.stringify(version));
    assert.equal(r.stderr, `rwxmap: not an OpenAPI or Swagger document: ${specPath}\n`);
    assert.deepEqual(fs.readdirSync(dir), ['bad.json']);
  }
});

test('run: a version written as a bare number (swagger: 2, openapi: 3.1) is still a spec', async () => {
  const { openapi, ...rest } = SPEC_DOC;
  for (const version of [{ swagger: 2 }, { openapi: 3.1 }]) {
    const dir = mkScratch();
    const specPath = writeSpecFile(dir, 'num.json', { ...rest, ...version });
    const r = await runIn([specPath, '--vendor', 'x'], dir);
    assert.equal(r.code, 0, r.stderr);
  }
});

test('run: JSON with paths but no openapi or swagger key is not a spec', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'notspec.json', { paths: { '/things': { get: { operationId: 'listThings' } } } });
  const r = await runIn([specPath, '--vendor', 'x'], dir);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, `rwxmap: not an OpenAPI or Swagger document: ${specPath}\n`);
  assert.deepEqual(fs.readdirSync(dir), ['notspec.json']);
});

test('run: OpenAPI 3.1 webhook operations are counted as not labelled', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', {
    ...SPEC_DOC,
    openapi: '3.1.0',
    webhooks: { newThing: { post: { operationId: 'onNewThing' } }, gone: { post: {}, delete: {} } },
  });
  const r = await runIn([specPath, '--vendor', 'x'], dir);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /\nrwxmap: 3 webhook operation\(s\) are not labelled \(they are calls the API makes, not calls to it\)\n/);
  const review = readJson(path.join(dir, 'x.rwxmap.review.json'));
  assert.equal(review.counts.rows, 3);
});

test('run: a local file that is not JSON or YAML says so without the loader prefix', async () => {
  const dir = mkScratch();
  const p = path.join(dir, 'bad.json');
  fs.writeFileSync(p, '{ not: [valid');
  const r = await runIn([p, '--vendor', 'x'], dir);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /^rwxmap: could not parse as JSON or YAML \(/);
  assert.doesNotMatch(r.stderr, /loadSpec:/);
});

test('run: a directory is not a file', async () => {
  const dir = mkScratch();
  const r = await runIn([dir, '--vendor', 'x'], dir);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, `rwxmap: not a file: ${dir}\n`);
});

test('run: an option with no value, and an unknown option, are named as the user typed them', async () => {
  const usage = 'usage: rwxmap <spec URL | local file | bare API address> [-o <dir>] [--vendor <name>] [--engine rwxlite|jev|mechanical] [--confidence <0-99>] [--model small] [--force]';
  const cases = [
    [['spec.json', '-o'], 'rwxmap: -o needs a value'],
    [['spec.json', '--vendor'], 'rwxmap: --vendor needs a value'],
    [['spec.json', '--bogus'], 'rwxmap: unknown option: --bogus'],
  ];
  for (const [argv, message] of cases) {
    const r = await runIn(argv);
    assert.equal(r.code, 1);
    assert.equal(r.stderr, `${message}\n${usage}\n`);
  }
});

test('run: a bare address whose own page loaded but is not a spec drops the "(as a spec:" note', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchAll(200, '<html><body>welcome</body></html>');
  t.after(() => { globalThis.fetch = originalFetch; });
  const stderr = captureStream();
  const code = await run(['https://home.example.test'], { cwd: mkScratch(), stdout: captureStream(), stderr, cacheDir: mkScratch() });
  assert.equal(code, 1);
  assert.equal(stderr.text(), 'rwxmap: no spec found for https://home.example.test\n');
});

test('run: the help lists -h and -v on their own lines', async () => {
  const r = await runIn(['--help']);
  assert.match(r.stdout, /^ {2}-h, --help {5}this help$/m);
  assert.match(r.stdout, /^ {2}-v, --version {2}the version$/m);
});

test('run: the help says what Jev sends and where', async () => {
  const r = await runIn(['--help']);
  assert.match(r.stdout, /sends method, path, operationId, summary and description/);
  assert.match(r.stdout, /api\.typesafe\.ai/);
});

test('run: --help and -h print the usage to stdout and exit 0', async () => {
  for (const flag of ['--help', '-h']) {
    const stdout = captureStream();
    const stderr = captureStream();
    const code = await run([flag], { cwd: mkScratch(), stdout, stderr });
    assert.equal(code, 0);
    assert.match(stdout.text(), /^usage: rwxmap <spec URL \| local file \| bare API address>/);
    assert.equal(stderr.text(), '');
  }
});

test('run: --version and -v print the package version and exit 0', async () => {
  const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const flag of ['--version', '-v']) {
    const stdout = captureStream();
    const code = await run([flag], { cwd: mkScratch(), stdout, stderr: captureStream() });
    assert.equal(code, 0);
    assert.equal(stdout.text(), `${version}\n`);
  }
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

test('run: --force overwrites existing output files', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  fs.writeFileSync(path.join(outDir, 'example.rwxmap.json'), 'SENTINEL');
  fs.writeFileSync(path.join(outDir, 'example.rwxmap.review.json'), 'SENTINEL');
  fs.writeFileSync(path.join(outDir, 'example.openapi.rwx.json'), 'SENTINEL');

  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--force'], { cwd: dir, stdout, stderr });

  assert.equal(code, 0, stderr.text());
  assert.notEqual(fs.readFileSync(path.join(outDir, 'example.rwxmap.json'), 'utf8'), 'SENTINEL');
  assert.notEqual(fs.readFileSync(path.join(outDir, 'example.openapi.rwx.json'), 'utf8'), 'SENTINEL');
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

test('run: writes all three files via tmp+rename, leaving no tmp files behind', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });

  assert.equal(code, 0, stderr.text());
  const entries = fs.readdirSync(outDir).sort();
  assert.deepEqual(entries, ['example.openapi.rwx.json', 'example.rwxmap.json', 'example.rwxmap.review.json']);
  // all parse as JSON — a partially-written file would fail this.
  readJson(path.join(outDir, 'example.rwxmap.json'));
  readJson(path.join(outDir, 'example.rwxmap.review.json'));
  readJson(path.join(outDir, 'example.openapi.rwx.json'));
  assert.match(stdout.text(), /rwxmap: wrote example\.rwxmap\.json \+ example\.rwxmap\.review\.json \+ example\.openapi\.rwx\.json\n/);
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

test('run: stdout always says rwxlite is off (mechanical) when no model can be got', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr, xdgCacheHome: mkScratch() });

  assert.equal(code, 0, stderr.text());
  assert.match(stdout.text(), /^rwxmap: rwxlite: off \(mechanical\) — could not get the model \(offline \(test\)\); none in the cache$/m);
  assert.doesNotMatch(stdout.text(), /Jev: on/);
  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.deepEqual(combined.jev, {
    mode: 'off', model: null, sent: 0, answered: 0, failed: 0, changed: 0, tokens: { input: 0, output: 0 },
  });
});

// ---------------------------------------------------------------------
// Jev wiring (PRD item c, D118-120) — go/no-go bars 2-7. Every test here
// uses env.jevKey (a fake key, never real process.env) and env.fetchImpl
// (a stub, never real network) — see run()'s own JSDoc for why those two
// overrides exist and why the real entry point never passes either.
// ---------------------------------------------------------------------

// bar 4: only rows in a tier are sent — request count == needsJev count.
test('run: with a key, only the rows in a Jev tier are sent (bar 4)', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const outDir = mkScratch();
  const { fetchImpl, calls } = routedJevFetch({
    listThings: { p: 0.1 },
    updateThing: { p: 0.1 },
    doMystery: { p: 0.1 },
  });

  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout: captureStream(), stderr: captureStream(), jevKey: 'sk-fake', fetchImpl,
  });

  assert.equal(code, 0);
  // Exactly the 3 pile rows, never the DELETE (method-delete) or the
  // list-claimed POST (archiveThing). doMystery is asked twice: its isX
  // answer (0.1) fired, so jev-lower asks the changes question too (D129).
  assert.deepEqual(calls.map((c) => c.operationId).sort(), ['doMystery', 'doMystery', 'listThings', 'updateThing']);

  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.equal(combined.jev.sent, 4);
});

// bar 2: each tier moves only its own way at its threshold.
test('run: jev-lower moves x -> w at p <= threshold, not above it (bar 2)', async () => {
  const dir = mkScratch();
  const outDir1 = mkScratch();
  const outDir2 = mkScratch();
  const specPath1 = writeSpecFile(dir, 'spec1.json', SPEC_JEV_DOC);
  const specPath2 = writeSpecFile(dir, 'spec2.json', SPEC_JEV_DOC);

  const atThreshold = routedJevFetch({
    listThings: { p: 0 }, updateThing: { p: 0 }, doMystery: { p: JEV_LOWER_THRESHOLD, pChanges: JEV_LOWER_R_THRESHOLD + 0.01 },
  });
  const codeAt = await run([specPath1, '-o', outDir1, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout: captureStream(), stderr: captureStream(), jevKey: 'sk-fake', fetchImpl: atThreshold.fetchImpl,
  });
  assert.equal(codeAt, 0);
  const atCombined = readJson(path.join(outDir1, 'example.rwxmap.json'));
  assert.equal(atCombined.mcp['POST /mystery']._meta['io.github.hamr0.rwxmap/class'], 'w');

  const aboveThreshold = routedJevFetch({
    listThings: { p: 0 }, updateThing: { p: 0 }, doMystery: { p: JEV_LOWER_THRESHOLD + 0.01 },
  });
  const codeAbove = await run([specPath2, '-o', outDir2, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout: captureStream(), stderr: captureStream(), jevKey: 'sk-fake', fetchImpl: aboveThreshold.fetchImpl,
  });
  assert.equal(codeAbove, 0);
  const aboveCombined = readJson(path.join(outDir2, 'example.rwxmap.json'));
  assert.equal(aboveCombined.mcp['POST /mystery']._meta['io.github.hamr0.rwxmap/class'], 'x');
});

test('run: jev-raise-wx moves w -> x at p >= threshold, not below it (bar 2)', async () => {
  const dir = mkScratch();
  const outDir1 = mkScratch();
  const outDir2 = mkScratch();
  const specPath1 = writeSpecFile(dir, 'spec1.json', SPEC_JEV_DOC);
  const specPath2 = writeSpecFile(dir, 'spec2.json', SPEC_JEV_DOC);

  const atThreshold = routedJevFetch({
    listThings: { p: 0 }, updateThing: { p: JEV_RAISE_WX_THRESHOLD }, doMystery: { p: 1 },
  });
  const codeAt = await run([specPath1, '-o', outDir1, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout: captureStream(), stderr: captureStream(), jevKey: 'sk-fake', fetchImpl: atThreshold.fetchImpl,
  });
  assert.equal(codeAt, 0);
  const atCombined = readJson(path.join(outDir1, 'example.rwxmap.json'));
  assert.equal(atCombined.mcp['PUT /things/{id}']._meta['io.github.hamr0.rwxmap/class'], 'x');

  const belowThreshold = routedJevFetch({
    listThings: { p: 0 }, updateThing: { p: JEV_RAISE_WX_THRESHOLD - 0.01 }, doMystery: { p: 1 },
  });
  const codeBelow = await run([specPath2, '-o', outDir2, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout: captureStream(), stderr: captureStream(), jevKey: 'sk-fake', fetchImpl: belowThreshold.fetchImpl,
  });
  assert.equal(codeBelow, 0);
  const belowCombined = readJson(path.join(outDir2, 'example.rwxmap.json'));
  assert.equal(belowCombined.mcp['PUT /things/{id}']._meta['io.github.hamr0.rwxmap/class'], 'w');
});

test('run: jev-raise-get moves r -> w at p >= threshold, not below it (bar 2)', async () => {
  const dir = mkScratch();
  const outDir1 = mkScratch();
  const outDir2 = mkScratch();
  const specPath1 = writeSpecFile(dir, 'spec1.json', SPEC_JEV_DOC);
  const specPath2 = writeSpecFile(dir, 'spec2.json', SPEC_JEV_DOC);

  const atThreshold = routedJevFetch({
    listThings: { p: JEV_RAISE_GET_THRESHOLD }, updateThing: { p: 0 }, doMystery: { p: 1 },
  });
  const codeAt = await run([specPath1, '-o', outDir1, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout: captureStream(), stderr: captureStream(), jevKey: 'sk-fake', fetchImpl: atThreshold.fetchImpl,
  });
  assert.equal(codeAt, 0);
  const atCombined = readJson(path.join(outDir1, 'example.rwxmap.json'));
  assert.equal(atCombined.mcp['GET /things']._meta['io.github.hamr0.rwxmap/class'], 'w');

  const belowThreshold = routedJevFetch({
    listThings: { p: JEV_RAISE_GET_THRESHOLD - 0.01 }, updateThing: { p: 0 }, doMystery: { p: 1 },
  });
  const codeBelow = await run([specPath2, '-o', outDir2, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout: captureStream(), stderr: captureStream(), jevKey: 'sk-fake', fetchImpl: belowThreshold.fetchImpl,
  });
  assert.equal(codeBelow, 0);
  const belowCombined = readJson(path.join(outDir2, 'example.rwxmap.json'));
  assert.equal(belowCombined.mcp['GET /things']._meta['io.github.hamr0.rwxmap/class'], 'r');
});

// bar 3: a bad answer never moves a letter — one case each.
test('run: a bad answer (NaN, out-of-range, missing model, HTTP error, timeout-like failure, malformed JSON) is undecided: x, review tight (bar 3, D133)', async () => {
  const dir = mkScratch();

  /** @type {Array<[string, any]>} */
  const cases = [
    ['NaN p', { ok: true, status: 200, json: async () => ({ model: 'm', answers: { isX: { noul: NaN } } }) }],
    ['p out of range', { ok: true, status: 200, json: async () => ({ model: 'm', answers: { isX: { noul: 1.5 } } }) }],
    ['missing model', { ok: true, status: 200, json: async () => ({ answers: { isX: { noul: 0.01 } } }) }],
    ['HTTP error', { ok: false, status: 400, json: async () => ({}) }],
    ['network failure (stand-in for a timeout)', null],
    ['malformed JSON', { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } }],
  ];

  for (const [label, response] of cases) {
    const outDir = mkScratch();
    const specPath = writeSpecFile(dir, `spec-${label.replace(/[^a-z0-9]/gi, '')}.json`, SPEC_JEV_DOC);
    const fetchImpl = response === null
      ? async () => { throw new Error('simulated network failure'); }
      : async () => response;

    const stdout = captureStream();
    const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--engine', 'jev'], {
      cwd: dir, stdout, stderr: captureStream(), jevKey: 'sk-fake', fetchImpl,
    });
    assert.equal(code, 0, `[${label}] expected exit 0`);

    const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
    // Every pile row is undecided (D133): x, whatever its mechanical letter was.
    assert.equal(combined.mcp['GET /things']._meta['io.github.hamr0.rwxmap/class'], 'x', label);
    assert.equal(combined.mcp['PUT /things/{id}']._meta['io.github.hamr0.rwxmap/class'], 'x', label);
    assert.equal(combined.mcp['POST /mystery']._meta['io.github.hamr0.rwxmap/class'], 'x', label);
    const sc = readJson(path.join(outDir, 'example.rwxmap.review.json'));
    for (const k of ['GET /things', 'PUT /things/{id}', 'POST /mystery']) {
      const r = sc.rows.find((row) => `${row.method} ${row.path}` === k);
      assert.equal(r.marker, 'tight', `${label} ${k}`);
    }
    assert.equal(combined.jev.changed, 2, label);
    assert.equal(combined.jev.failed, 3, label);
  }
});

// bar 6: never stops — every call fails, exit 0, every asked row is undecided (x).
test('run: never stops when every Jev call fails (bar 6)', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const outDir = mkScratch();
  const fetchImpl = async () => { throw new Error('offline'); };
  const stdout = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout, stderr: captureStream(), jevKey: 'sk-fake', fetchImpl,
  });

  assert.equal(code, 0);
  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.equal(combined.jev.sent, 3);
  assert.equal(combined.jev.answered, 0);
  assert.equal(combined.jev.failed, 3);
  assert.equal(combined.jev.changed, 2);
  assert.equal(combined.mcp['GET /things']._meta['io.github.hamr0.rwxmap/class'], 'x');
  assert.equal(combined.mcp['PUT /things/{id}']._meta['io.github.hamr0.rwxmap/class'], 'x');
  assert.equal(combined.mcp['POST /mystery']._meta['io.github.hamr0.rwxmap/class'], 'x');
  assert.match(stdout.text(), /3 failed/);
});

// bar 5: only the five state fields (plus the tier question/model) leave
// the machine, and the key never appears anywhere observable.
test('run: sends only method/path/operationId/summary/description, and the key never leaks (bar 5)', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const outDir = mkScratch();
  const SECRET = 'sk-do-not-leak-this-fake-key';
  const { fetchImpl, calls } = routedJevFetch({
    listThings: { p: 0.9 }, updateThing: { p: 0.9 }, doMystery: { p: 0.01 },
  });
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout, stderr, jevKey: SECRET, fetchImpl,
  });
  assert.equal(code, 0);

  for (const call of calls) {
    assert.deepEqual(Object.keys(call.body).sort(), ['model', 'questions', 'state']);
    assert.deepEqual(Object.keys(call.body.state).sort(), ['description', 'method', 'operationId', 'path', 'summary']);
    assert.equal(JSON.stringify(call.body).includes(SECRET), false);
  }

  const combinedText = fs.readFileSync(path.join(outDir, 'example.rwxmap.json'), 'utf8');
  const sidecarText = fs.readFileSync(path.join(outDir, 'example.rwxmap.review.json'), 'utf8');
  assert.equal(combinedText.includes(SECRET), false);
  assert.equal(sidecarText.includes(SECRET), false);
  assert.equal(stdout.text().includes(SECRET), false);
  assert.equal(stderr.text().includes(SECRET), false);
});

// bar 7: after Jev moves rows, mcp/bareguard/sidecar all agree with the
// FINAL (post-Jev) letter, and the sidecar carries p/model for a moved row.
test('run: after Jev moves rows, mcp, bareguard and the sidecar all carry the final letter (bar 7)', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const outDir = mkScratch();
  const { fetchImpl } = routedJevFetch({
    listThings: { p: JEV_RAISE_GET_THRESHOLD, model: 'jev-2.0.0' }, // r -> w
    updateThing: { p: JEV_RAISE_WX_THRESHOLD, model: 'jev-2.0.0' }, // w -> x
    doMystery: { p: JEV_LOWER_THRESHOLD, pChanges: JEV_LOWER_R_THRESHOLD + 0.01, model: 'jev-2.0.0' }, // x -> w (changes too high for r)
  });

  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout: captureStream(), stderr: captureStream(), jevKey: 'sk-fake', fetchImpl,
  });
  assert.equal(code, 0);

  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  const sidecar = readJson(path.join(outDir, 'example.rwxmap.review.json'));

  assert.equal(combined.jev.mode, 'on');
  assert.equal(combined.jev.model, 'jev-2.0.0');
  // 3 pile rows + doMystery's second (changes) request, D129.
  assert.equal(combined.jev.sent, 4);
  assert.equal(combined.jev.answered, 4);
  assert.equal(combined.jev.failed, 0);
  assert.equal(combined.jev.changed, 3);

  // Every mcp entry's class equals its bareguard.tools entry's letter, and
  // both equal the FINAL (moved) class — never the mechanical one. Each
  // moved row's sidecar entry carries the model's own p and model (the
  // design point's "each moved row's p and model go into the sidecar").
  const expected = {
    'GET /things': { cls: 'w', p: JEV_RAISE_GET_THRESHOLD },
    'PUT /things/{id}': { cls: 'x', p: JEV_RAISE_WX_THRESHOLD },
    'POST /mystery': { cls: 'w', p: JEV_LOWER_THRESHOLD },
  };
  for (const [key, { cls, p }] of Object.entries(expected)) {
    assert.equal(combined.mcp[key]._meta['io.github.hamr0.rwxmap/class'], cls, key);
    const [method, opPath] = key.split(' ');
    const sidecarRow = sidecar.rows.find((r) => r.method === method && r.path === opPath);
    assert.ok(sidecarRow, key);
    assert.equal(sidecarRow.letter, cls, key);
    assert.deepEqual(sidecarRow.jev, { p, model: 'jev-2.0.0' }, key);
  }

  // bareguard.tools's own letters agree too (same source, D122).
  const toolsLetters = Object.values(combined.bareguard.tools).map((e) => e.letter).sort();
  const mcpLetters = Object.values(combined.mcp).map((e) => e._meta['io.github.hamr0.rwxmap/class']).sort();
  assert.deepEqual(toolsLetters, mcpLetters);
});

// The disclosure banner (design point step 0) and the on-mode summary line.
test('run: with a key, stdout prints the disclosure banner and the on-mode summary line', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const outDir = mkScratch();
  const { fetchImpl } = routedJevFetch({
    listThings: { p: 0 }, updateThing: { p: 0 }, doMystery: { p: 1 },
  });
  const stdout = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout, stderr: captureStream(), jevKey: 'sk-fake', fetchImpl,
  });
  assert.equal(code, 0);

  const text = stdout.text();
  assert.match(text, /Jev: on — sends method, path, operationId, summary, description of 3 operation/);
  assert.match(text, /api\.typesafe\.ai/);
  assert.match(text, /Your key, your cost\./);
  assert.match(text, /Jev: on — 3 sent · 3 answered · 0 failed \(x, review tight\) · 0 letters changed/);
});

// Bar 8 cost figure: the `jev` summary sums answered rows' token usage;
// a failed row adds nothing, and usage never reaches a sidecar row.
test('run: jev.tokens sums answered rows usage, skips failed rows, and stays out of the sidecar', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const outDir = mkScratch();
  const { fetchImpl } = routedJevFetch({
    listThings: { p: JEV_RAISE_GET_THRESHOLD, usage: { input_tokens: 700, output_tokens: 30 } }, // r -> w, answered
    updateThing: { p: 0, usage: { input_tokens: 500, output_tokens: 20 } }, // answered, stays w
    doMystery: { malformed: true, usage: { input_tokens: 9999, output_tokens: 9999 } }, // failed: adds nothing
  });
  const stdout = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout, stderr: captureStream(), jevKey: 'sk-fake', fetchImpl,
  });
  assert.equal(code, 0);

  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.equal(combined.jev.answered, 2);
  assert.equal(combined.jev.failed, 1);
  assert.deepEqual(combined.jev.tokens, { input: 1200, output: 50 });
  assert.match(stdout.text(), /Jev: on — 3 sent · 2 answered · 1 failed \(x, review tight\) · 1 letters changed · 1200 in \/ 50 out tokens\n/);

  // The moved row carries exactly {p, model}; no row carries usage.
  const sidecarText = fs.readFileSync(path.join(outDir, 'example.rwxmap.review.json'), 'utf8');
  const sidecar = JSON.parse(sidecarText);
  const moved = sidecar.rows.find((r) => r.method === 'GET' && r.path === '/things');
  assert.deepEqual(moved.jev, { p: JEV_RAISE_GET_THRESHOLD, model: 'jev-1.0.0' });
  assert.equal(/usage|input_tokens|tokens/.test(sidecarText), false);
  const { jev, ...rest } = combined;
  assert.equal(/usage|input_tokens|tokens/.test(JSON.stringify(rest)), false);
});

// ---------------------------------------------------------------------
// D129 (F1): jev-lower asks the changes question only of rows its isX
// answer moved, as a separate request, and may take them on to r.
// ---------------------------------------------------------------------

/**
 * A fetch stub answering by (operationId, question key). `answers[opId]`
 * is `{ isX?, changes? }`, each a response builder `(body) => response`.
 * Records every call with its question key.
 * @param {Record<string, Record<string, (body: any) => any>>} answers
 */
function questionJevFetch(answers) {
  /** @type {Array<{operationId: string, qKey: string, body: any}>} */
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    const opId = body.state.operationId;
    const qKey = Object.keys(body.questions)[0];
    calls.push({ operationId: opId, qKey, body });
    const make = answers[opId] && answers[opId][qKey];
    if (!make) throw new Error(`questionJevFetch: unexpected ${qKey} request for ${opId}`);
    return make(body);
  };
  return { fetchImpl, calls };
}

/** A usable answer to whichever question was asked. */
/** @param {number} p @param {string} [model] @param {any} [usage] */
const ok = (p, model = 'jev-1.0.0', usage = undefined) => (body) => ({
  ok: true, status: 200, json: async () => ({ model, answers: { [Object.keys(body.questions)[0]]: { noul: p } }, usage }),
});

async function runJevSpec(fetchImpl) {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--engine', 'jev'], {
    cwd: dir, stdout, stderr: captureStream(), jevKey: 'sk-fake', fetchImpl,
  });
  assert.equal(code, 0);
  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  const sidecar = readJson(path.join(outDir, 'example.rwxmap.review.json'));
  const mystery = sidecar.rows.find((r) => r.method === 'POST' && r.path === '/mystery');
  return { combined, mystery, stdout: stdout.text() };
}

test('run (D129): a jev-lower row whose isX does not fire makes no second call', async () => {
  const { fetchImpl, calls } = questionJevFetch({
    listThings: { changes: ok(0) }, updateThing: { isX: ok(0) }, doMystery: { isX: ok(JEV_LOWER_THRESHOLD + 0.01) },
  });
  const { combined, mystery } = await runJevSpec(fetchImpl);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.filter((c) => c.operationId === 'doMystery').map((c) => c.qKey), ['isX']);
  assert.equal(combined.jev.sent, 3);
  assert.equal(mystery.letter, 'x');
});

test('run (D129): a fired jev-lower row gets one second call, the changes question byte-equal, and goes to r', async () => {
  const { fetchImpl, calls } = questionJevFetch({
    listThings: { changes: ok(0) },
    updateThing: { isX: ok(0) },
    doMystery: {
      isX: ok(JEV_LOWER_THRESHOLD, 'jev-1.0.0', { input_tokens: 100, output_tokens: 1 }),
      changes: ok(JEV_LOWER_R_THRESHOLD, 'jev-1.0.0', { input_tokens: 40, output_tokens: 2 }),
    },
  });
  const { combined, mystery, stdout } = await runJevSpec(fetchImpl);
  const mysteryCalls = calls.filter((c) => c.operationId === 'doMystery');
  assert.deepEqual(mysteryCalls.map((c) => c.qKey), ['isX', 'changes']);
  // the second request is its own request, carrying the changes question alone
  assert.equal(JSON.stringify(mysteryCalls[1].body.questions), JSON.stringify(jevQuestions('jev-raise-get')));
  assert.deepEqual(mysteryCalls[1].body.state, mysteryCalls[0].body.state);
  assert.equal(calls.length, 4);
  assert.equal(combined.jev.sent, 4);
  assert.equal(combined.jev.answered, 4);
  assert.equal(combined.jev.failed, 0);
  assert.equal(combined.jev.changed, 1);
  assert.deepEqual(combined.jev.tokens, { input: 140, output: 3 });
  assert.equal(mystery.letter, 'r');
  assert.equal(mystery.marker, 'loose');
  assert.equal(mystery.evidence, 'jev');
  assert.deepEqual(mystery.jev, { p: JEV_LOWER_THRESHOLD, model: 'jev-1.0.0', pChanges: JEV_LOWER_R_THRESHOLD });
  assert.equal(combined.mcp['POST /mystery']._meta['io.github.hamr0.rwxmap/class'], 'r');
  assert.match(stdout, /Jev: on — 4 sent · 4 answered · 0 failed \(x, review tight\) · 1 letters changed · 140 in \/ 3 out tokens\n/);
});

test('run (D129): changes above 0.50 leaves a fired jev-lower row at w', async () => {
  const { fetchImpl } = questionJevFetch({
    listThings: { changes: ok(0) }, updateThing: { isX: ok(0) },
    doMystery: { isX: ok(0.01), changes: ok(JEV_LOWER_R_THRESHOLD + 0.01) },
  });
  const { mystery } = await runJevSpec(fetchImpl);
  assert.equal(mystery.letter, 'w');
  assert.deepEqual(mystery.jev, { p: 0.01, model: 'jev-1.0.0' });
});

test('run (D129): a failed or malformed second answer makes the row undecided (x, review tight), and so does an other-model one (D129, D133)', async () => {
  /** @type {Array<[string, (body: any) => any, number]>} label, response, failed count */
  const cases = [
    ['HTTP error', () => ({ ok: false, status: 400, json: async () => ({}) }), 1],
    ['network failure', () => { throw new Error('offline'); }, 1],
    ['NaN p', () => ({ ok: true, status: 200, json: async () => ({ model: 'jev-1.0.0', answers: { changes: { noul: NaN } } }) }), 1],
    ['missing model', () => ({ ok: true, status: 200, json: async () => ({ answers: { changes: { noul: 0 } } }) }), 1],
    ['other model', ok(0, 'jev-9.9.9'), 1],
    ['p above 1', ok(1.5), 1],
    ['p negative', ok(-0.1), 1],
    ['p Infinity', () => ({ ok: true, status: 200, json: async () => ({ model: 'jev-1.0.0', answers: { changes: { noul: Infinity } } }) }), 1],
    ['p string', () => ({ ok: true, status: 200, json: async () => ({ model: 'jev-1.0.0', answers: { changes: { noul: '0.1' } } }) }), 1],
    ['p missing', () => ({ ok: true, status: 200, json: async () => ({ model: 'jev-1.0.0', answers: { changes: {} } }) }), 1],
  ];
  for (const [label, changes, failedCount] of cases) {
    const { fetchImpl, calls } = questionJevFetch({
      listThings: { changes: ok(0) }, updateThing: { isX: ok(0) }, doMystery: { isX: ok(0.01), changes },
    });
    const { combined, mystery } = await runJevSpec(fetchImpl);
    assert.equal(calls.length, 4, label);
    if (failedCount === 1) {
      assert.equal(mystery.letter, 'x', label);
      assert.equal(mystery.marker, 'tight', label);
      assert.equal(mystery.evidence, 'floor', label);
      assert.equal(mystery.jev, undefined, label);
    } else {
      assert.equal(mystery.letter, 'w', label);
      assert.deepEqual(mystery.jev, { p: 0.01, model: 'jev-1.0.0' }, label);
    }
    assert.equal(combined.jev.sent, 4, label);
    assert.equal(combined.jev.failed, failedCount, label);
    assert.equal(combined.jev.answered, 4 - failedCount, label);
    assert.equal(combined.jev.changed, failedCount === 1 ? 0 : 1, label);
  }
});

// ---------------------------------------------------------------------
// Item e (D124): the WebMCP dict and the OpenAPI copy.
// ---------------------------------------------------------------------

/**
 * Strip `x-rwx` from every operation object in a parsed doc, walking
 * `paths` with this test's OWN method list (not exporter.js's), and
 * return how many were removed.
 * @param {any} doc
 * @returns {number}
 */
function stripOperationXRwx(doc) {
  const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
  let removed = 0;
  for (const item of Object.values(doc.paths || {})) {
    if (!item || typeof item !== 'object') continue;
    for (const [field, op] of Object.entries(item)) {
      if (!methods.includes(field.toLowerCase()) || !op || typeof op !== 'object') continue;
      if (Object.prototype.hasOwnProperty.call(op, 'x-rwx')) {
        delete op['x-rwx'];
        removed += 1;
      }
    }
  }
  return removed;
}

const SPEC_YAML = `openapi: 3.0.0
servers:
  - url: https://api.example.com
paths:
  /things:
    get:
      operationId: listThings
      summary: List things
  /things/{id}:
    put:
      operationId: updateThing
  /things/{id}/permission:
    delete:
      operationId: deleteThingPermission
`;

test('run: the webmcp dict follows r/w/x -> readOnlyHint/consequentialHint on every operation (item e bar 4)', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });
  assert.equal(code, 0, stderr.text());

  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.deepEqual(Object.keys(combined.webmcp).sort(), Object.keys(combined.mcp).sort());
  assert.deepEqual(combined.webmcp['GET /things'], { annotations: { readOnlyHint: true, consequentialHint: false } });
  assert.deepEqual(combined.webmcp['PUT /things/{id}'], { annotations: { readOnlyHint: false, consequentialHint: false } });
  assert.deepEqual(combined.webmcp['DELETE /things/{id}/permission'], { annotations: { readOnlyHint: false, consequentialHint: true } });
});

test('run: the input file is byte-identical after a run, and stripping x-rwx from the copy gives the parsed input (item e bars 1, 2)', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const before = fs.readFileSync(specPath);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });
  assert.equal(code, 0, stderr.text());
  assert.ok(fs.readFileSync(specPath).equals(before), 'input spec changed');

  const copyText = fs.readFileSync(path.join(outDir, 'example.openapi.rwx.json'), 'utf8');
  assert.equal(copyText, `${JSON.stringify(JSON.parse(copyText), null, 2)}\n`, 'copy is 2-space JSON');
  const copy = JSON.parse(copyText);
  const review = readJson(path.join(outDir, 'example.rwxmap.review.json'));
  // Every operation's x-rwx equals its sidecar row.
  for (const row of review.rows) {
    const op = copy.paths[row.path][row.method.toLowerCase()];
    assert.deepEqual(op['x-rwx'], { class: row.letter, destructive: row.destructive, evidence: row.evidence, review: row.marker });
  }
  assert.equal(stripOperationXRwx(copy), 3);
  assert.deepEqual(copy, SPEC_DOC);
  assert.doesNotMatch(stdout.text(), /existing x-rwx/);
});

test('run: a YAML input gets a JSON copy whose x-rwx-stripped form equals the parsed YAML (item e bars 1, 2)', async () => {
  const dir = mkScratch();
  const specPath = path.join(dir, 'spec.yaml');
  fs.writeFileSync(specPath, SPEC_YAML);
  const before = fs.readFileSync(specPath);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });
  assert.equal(code, 0, stderr.text());
  assert.ok(fs.readFileSync(specPath).equals(before), 'input spec changed');

  const copy = JSON.parse(fs.readFileSync(path.join(outDir, 'example.openapi.rwx.json'), 'utf8'));
  assert.equal(copy.paths['/things'].get['x-rwx'].class, 'r');
  assert.equal(copy.paths['/things/{id}'].put['x-rwx'].class, 'w');
  assert.equal(copy.paths['/things/{id}/permission'].delete['x-rwx'].class, 'x');
  assert.equal(stripOperationXRwx(copy), 3);
  const { parse } = await import('yaml');
  assert.deepEqual(copy, parse(SPEC_YAML));
});

test('run: YAML-aliased operations each get their own x-rwx in the copy', async () => {
  // Two path items share ONE operation object through a YAML alias; the
  // yaml parser hands back the same JS object for both. The copy must
  // still label each operation from its own row (a shared object would
  // leave the first with the second's x-rwx).
  const dir = mkScratch();
  const specPath = path.join(dir, 'spec.yaml');
  fs.writeFileSync(specPath, `openapi: 3.0.0
paths:
  /things:
    get: &op
      summary: shared
  /things/{id}:
    delete: *op
`);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });
  assert.equal(code, 0, stderr.text());
  const copy = JSON.parse(fs.readFileSync(path.join(outDir, 'example.openapi.rwx.json'), 'utf8'));
  assert.equal(copy.paths['/things'].get['x-rwx'].class, 'r');
  assert.equal(copy.paths['/things/{id}'].delete['x-rwx'].class, 'x');
});

test('run: an x-rwx already in the input is overwritten in the copy, counted and reported (item e bar 7)', async () => {
  const doc = {
    openapi: '3.0.0',
    paths: {
      '/things': { get: { operationId: 'listThings', 'x-rwx': { class: 'x', note: 'stale' } } },
      '/things/{id}': { put: { operationId: 'updateThing', 'x-rwx': 'w' } },
      '/things/{id}/permission': { delete: { operationId: 'deleteThingPermission' } },
    },
  };
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', doc);
  const before = fs.readFileSync(specPath);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });
  assert.equal(code, 0, stderr.text());
  assert.ok(fs.readFileSync(specPath).equals(before), 'input spec changed');
  assert.match(stdout.text(), /^rwxmap: 2 existing x-rwx overwritten in the copy$/m);

  const copy = JSON.parse(fs.readFileSync(path.join(outDir, 'example.openapi.rwx.json'), 'utf8'));
  assert.deepEqual(copy.paths['/things'].get['x-rwx'], { class: 'r', destructive: false, evidence: 'floor', review: copy.paths['/things'].get['x-rwx'].review });
  assert.equal(copy.paths['/things/{id}'].put['x-rwx'].class, 'w');
  assert.equal(typeof copy.paths['/things/{id}'].put['x-rwx'], 'object');
  // Stripping gives the input minus its own x-rwx, and nothing else changed.
  stripOperationXRwx(copy);
  const expected = JSON.parse(JSON.stringify(doc));
  stripOperationXRwx(expected);
  assert.deepEqual(copy, expected);
});

test('run: an existing .openapi.rwx.json without --force exits 1 and writes nothing (item e bar 1)', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  const copyPath = path.join(outDir, 'example.openapi.rwx.json');
  fs.writeFileSync(copyPath, 'SENTINEL');
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });
  assert.equal(code, 1);
  assert.equal(fs.readFileSync(copyPath, 'utf8'), 'SENTINEL');
  assert.deepEqual(fs.readdirSync(outDir), ['example.openapi.rwx.json']);
});

test('run: with Jev on, x-rwx and webmcp carry the final (post-Jev) letters (item e bar 6)', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();
  // raise-get moves r -> w, raise-wx moves w -> x, lower moves x -> w.
  const { fetchImpl } = routedJevFetch({
    listThings: { p: 0.99 },
    updateThing: { p: 0.99 },
    doMystery: { p: 0.01, pChanges: 0.99 },
  });

  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--engine', 'jev'], { cwd: dir, stdout, stderr, jevKey: 'k', fetchImpl });
  assert.equal(code, 0, stderr.text());
  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  const copy = readJson(path.join(outDir, 'example.openapi.rwx.json'));
  const expected = { 'GET /things': 'w', 'PUT /things/{id}': 'x', 'POST /mystery': 'w' };
  const hints = { w: { readOnlyHint: false, consequentialHint: false }, x: { readOnlyHint: false, consequentialHint: true } };
  for (const [key, letter] of Object.entries(expected)) {
    const [method, p] = key.split(' ');
    assert.equal(copy.paths[p][method.toLowerCase()]['x-rwx'].class, letter, key);
    assert.equal(copy.paths[p][method.toLowerCase()]['x-rwx'].evidence, 'jev', key);
    assert.deepEqual(combined.webmcp[key].annotations, hints[letter], key);
  }
});

// ---------------------------------------------------------------------
// Item e (D124): the discovered path reloads the spec once.
// ---------------------------------------------------------------------

/**
 * A routed globalThis.fetch stub for discovery: the api-catalog names
 * https://api.example.test/openapi.json, whose GET answers come from
 * `specGets` in order (one per GET; the last repeats). Everything else
 * is a 404, so no test here can reach a real network.
 * @param {Array<{status: number, text?: string, location?: string}>} specGets
 */
function stubDiscoveryFetch(specGets) {
  const specUrl = 'https://api.example.test/openapi.json';
  let n = 0;
  const calls = [];
  const res = (status, text = '', headers = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    body: undefined,
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  });
  const fetchImpl = async (url, init) => {
    const method = (init && init.method) || 'GET';
    calls.push({ method, url: String(url), redirect: init && init.redirect });
    if (String(url) === 'https://api.example.test/.well-known/api-catalog') {
      return res(200, JSON.stringify({ 'service-desc': [{ href: specUrl }] }));
    }
    if (String(url) === specUrl) {
      if (method === 'HEAD') return res(200);
      const g = specGets[Math.min(n, specGets.length - 1)];
      n += 1;
      return res(g.status, g.text || '', g.location ? { location: g.location } : {});
    }
    return res(404);
  };
  return { fetchImpl, calls, specUrl };
}

test('run: a discovered spec that changed since discovery uses the fresh copy and says so', async (t) => {
  const original = { ...SPEC_DOC, paths: { '/things': { get: { operationId: 'listThings' } } } };
  const fresh = SPEC_DOC; // 3 operations, different bytes
  const { fetchImpl, calls, specUrl } = stubDiscoveryFetch([
    { status: 200, text: JSON.stringify(original) },
    { status: 200, text: JSON.stringify(fresh) },
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchImpl));
  t.after(() => { globalThis.fetch = originalFetch; });

  const outDir = mkScratch();
  const cacheDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run(['https://api.example.test', '-o', outDir], { cwd: outDir, stdout, stderr, cacheDir });

  assert.equal(code, 0, stderr.text());
  assert.match(stdout.text(), /^rwxmap: spec changed since discovery cached it \(sha256 differs\); used the fresh copy$/m);
  // The reload asked for no redirect-following.
  const specGets = calls.filter((c) => c.method === 'GET' && c.url === specUrl);
  assert.equal(specGets.length, 2);
  assert.equal(specGets[1].redirect, 'manual');
  // Ops, letters and copy all come from the fresh document — never mixed.
  const combined = readJson(path.join(outDir, 'api.example.test.rwxmap.json'));
  const copy = readJson(path.join(outDir, 'api.example.test.openapi.rwx.json'));
  assert.equal(Object.keys(combined.mcp).length, 3);
  assert.equal(Object.keys(combined.webmcp).length, 3);
  stripOperationXRwx(copy);
  assert.deepEqual(copy, fresh);
});

test('run: a discovered spec that reloads without an openapi or swagger key exits 1 and writes no file', async (t) => {
  const { fetchImpl, specUrl } = stubDiscoveryFetch([
    { status: 200, text: JSON.stringify(SPEC_DOC) },
    { status: 200, text: JSON.stringify({ paths: SPEC_DOC.paths }) },
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchImpl));
  t.after(() => { globalThis.fetch = originalFetch; });

  const outDir = mkScratch();
  const stderr = captureStream();
  const code = await run(['https://api.example.test', '-o', outDir], { cwd: outDir, stdout: captureStream(), stderr, cacheDir: mkScratch() });

  assert.equal(code, 1);
  assert.equal(stderr.text(), `rwxmap: not an OpenAPI or Swagger document: ${specUrl}\n`);
  assert.deepEqual(fs.readdirSync(outDir), []);
});

test('run: an unchanged discovered spec prints no spec-changed line', async (t) => {
  const { fetchImpl } = stubDiscoveryFetch([{ status: 200, text: JSON.stringify(SPEC_DOC) }]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchImpl));
  t.after(() => { globalThis.fetch = originalFetch; });

  const outDir = mkScratch();
  const cacheDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run(['https://api.example.test', '-o', outDir], { cwd: outDir, stdout, stderr, cacheDir });

  assert.equal(code, 0, stderr.text());
  assert.doesNotMatch(stdout.text(), /spec changed/);
  const copy = readJson(path.join(outDir, 'api.example.test.openapi.rwx.json'));
  stripOperationXRwx(copy);
  assert.deepEqual(copy, SPEC_DOC);
});

test('run: a redirect when reloading a discovered spec exits 1 and writes no file', async (t) => {
  const { fetchImpl } = stubDiscoveryFetch([
    { status: 200, text: JSON.stringify(SPEC_DOC) },
    { status: 302, location: 'https://elsewhere.example.test/openapi.json' },
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchImpl));
  t.after(() => { globalThis.fetch = originalFetch; });

  const outDir = mkScratch();
  const cacheDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run(['https://api.example.test', '-o', outDir], { cwd: outDir, stdout, stderr, cacheDir });

  assert.equal(code, 1);
  assert.match(stderr.text(), /could not reload the discovered spec https:\/\/api\.example\.test\/openapi\.json \(a redirect on reload is refused, never followed\): .*http 302/);
  assert.deepEqual(fs.readdirSync(outDir), []);
});

// ---------------------------------------------------------------------
// Debrief fixes (2026-09-29): lossy JSON copy, all-or-nothing --force,
// unlabelled OpenAPI 3.2 operations, .env isolation, zero operations.
// ---------------------------------------------------------------------

test('run: non-finite values (.inf, -.inf, .nan) and integers past 2^53 are counted and reported separately', async () => {
  const dir = mkScratch();
  const specPath = path.join(dir, 'spec.yaml');
  fs.writeFileSync(specPath, `openapi: 3.0.0
paths:
  /things:
    get:
      operationId: listThings
      x-pos: .inf
      x-neg: -.inf
      x-nan: .nan
      x-big: 9007199254740993
      x-safe: 9007199254740991
      x-float: 1.5
      x-exact-big: 1e21
`);
  const before = fs.readFileSync(specPath);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });
  assert.equal(code, 0, stderr.text());
  assert.match(stdout.text(), /\nrwxmap: 3 value\(s\) can't be written as JSON \(\.inf\/\.nan\); the copy holds null there; your original is unchanged\n/);
  assert.match(stdout.text(), /\nrwxmap: 2 integer\(s\) past 2\^53 in the spec may already be rounded \(JavaScript numbers\); check them in the copy\n/);
  const counts = readJson(path.join(outDir, 'example.rwxmap.review.json')).counts;
  assert.equal(counts.openapiNonFinite, 3);
  assert.equal(counts.openapiBigIntegers, 2);
  assert.equal('openapiInexact' in counts, false);
  const op = readJson(path.join(outDir, 'example.openapi.rwx.json')).paths['/things'].get;
  assert.equal(op['x-pos'], null);
  assert.equal(op['x-neg'], null);
  assert.equal(op['x-nan'], null);
  assert.equal(op['x-big'], 9007199254740992);
  assert.equal(op['x-safe'], 9007199254740991);
  assert.equal(op['x-exact-big'], 1e21);
  assert.ok(fs.readFileSync(specPath).equals(before), 'input spec changed');
});

test('run: a clean spec prints neither number line and has no openapiNonFinite/openapiBigIntegers count', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr: captureStream() });
  assert.equal(code, 0);
  assert.doesNotMatch(stdout.text(), /written as JSON|past 2\^53/);
  const counts = readJson(path.join(outDir, 'example.rwxmap.review.json')).counts;
  assert.equal('openapiNonFinite' in counts, false);
  assert.equal('openapiBigIntegers' in counts, false);
});

test('run: a failed --force leaves every old output byte-identical and no tmp or backup file behind', async () => {
  const dir = mkScratch();
  const outDir = mkScratch();
  const firstSpec = writeSpecFile(dir, 'first.json', SPEC_DOC);
  const code1 = await run([firstSpec, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout: captureStream(), stderr: captureStream() });
  assert.equal(code1, 0);

  // The last target becomes a directory, so the first two renames succeed
  // before the third fails: the rollback must restore both old files.
  const blocked = path.join(outDir, 'example.openapi.rwx.json');
  fs.unlinkSync(blocked);
  fs.mkdirSync(blocked);
  fs.writeFileSync(path.join(blocked, 'keep.txt'), 'KEEP');
  const oldMap = fs.readFileSync(path.join(outDir, 'example.rwxmap.json'));
  const oldReview = fs.readFileSync(path.join(outDir, 'example.rwxmap.review.json'));

  // A different spec, so a new file left in place would not match the old bytes.
  const secondSpec = writeSpecFile(dir, 'second.json', {
    openapi: '3.0.0',
    paths: { '/other': { post: { operationId: 'createOther' } } },
  });
  const stderr = captureStream();
  const code2 = await run([secondSpec, '-o', outDir, '--vendor', 'example', '--force'], { cwd: dir, stdout: captureStream(), stderr });

  assert.equal(code2, 1);
  assert.match(stderr.text(), /could not write output/);
  assert.ok(fs.readFileSync(path.join(outDir, 'example.rwxmap.json')).equals(oldMap), 'old map changed');
  assert.ok(fs.readFileSync(path.join(outDir, 'example.rwxmap.review.json')).equals(oldReview), 'old review changed');
  assert.equal(fs.readFileSync(path.join(blocked, 'keep.txt'), 'utf8'), 'KEEP');
  assert.deepEqual(fs.readdirSync(outDir).sort(), ['example.openapi.rwx.json', 'example.rwxmap.json', 'example.rwxmap.review.json']);
});

test('run: a successful --force leaves no backup file behind', async () => {
  const dir = mkScratch();
  const outDir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  for (const name of ['example.rwxmap.json', 'example.rwxmap.review.json', 'example.openapi.rwx.json']) {
    fs.writeFileSync(path.join(outDir, name), 'OLD');
  }
  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--force'], { cwd: dir, stdout: captureStream(), stderr: captureStream() });
  assert.equal(code, 0);
  assert.deepEqual(fs.readdirSync(outDir).sort(), ['example.openapi.rwx.json', 'example.rwxmap.json', 'example.rwxmap.review.json']);
  readJson(path.join(outDir, 'example.openapi.rwx.json'));
});

test('run: OpenAPI 3.2 query is labelled (D134); other additionalOperations are counted as not labelled and stay unlabelled', async () => {
  const doc = {
    openapi: '3.2.0',
    paths: {
      '/things': {
        get: { operationId: 'listThings' },
        query: { operationId: 'queryThings' },
        additionalOperations: { COPY: { operationId: 'copyThings' }, PURGE: { operationId: 'purgeThings' } },
      },
      '/plain': { delete: { operationId: 'deletePlain' } },
    },
  };
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', doc);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });
  assert.equal(code, 0, stderr.text());
  assert.match(stdout.text(), /\nrwxmap: 2 operation\(s\) under OpenAPI 3\.2 additionalOperations \(other than QUERY\) are not labelled yet \(no letter, no key, no x-rwx\)\n/);
  const review = readJson(path.join(outDir, 'example.rwxmap.review.json'));
  assert.equal(review.counts.rows, 3);
  const copy = readJson(path.join(outDir, 'example.openapi.rwx.json'));
  assert.equal(copy.paths['/things'].query['x-rwx'].class, 'r');
  assert.equal('x-rwx' in copy.paths['/things'].additionalOperations.COPY, false);
});

test('run: a spec with no 3.2-only operations prints no not-labelled line', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const stdout = captureStream();
  const code = await run([specPath, '-o', mkScratch(), '--vendor', 'example'], { cwd: dir, stdout, stderr: captureStream() });
  assert.equal(code, 0);
  assert.doesNotMatch(stdout.text(), /not labelled yet/);
});

test('run: a .env supplies only RWXMAP_JEV_KEY (CRLF), and no .env variable reaches process.env', async (t) => {
  const names = ['RWXMAP_JEV_KEY', 'HTTPS_PROXY', 'FOO_LEAK'];
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  for (const n of names) delete process.env[n];
  t.after(() => {
    for (const n of names) {
      if (saved[n] === undefined) delete process.env[n];
      else process.env[n] = saved[n];
    }
  });

  const dir = mkScratch();
  fs.writeFileSync(path.join(dir, '.env'), 'RWXMAP_JEV_KEY=sk-from-dotenv\r\nHTTPS_PROXY=http://proxy.invalid:1\r\nFOO_LEAK=leaked\r\n');
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const auth = [];
  const { fetchImpl: routed } = routedJevFetch({ listThings: { p: 0 }, updateThing: { p: 0 }, doMystery: { p: 1 } });
  const fetchImpl = async (url, init) => {
    auth.push(init.headers.Authorization);
    return routed(url, init);
  };
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', mkScratch(), '--vendor', 'example', '--engine', 'jev'], { cwd: dir, stdout, stderr, fetchImpl });
  assert.equal(code, 0, stderr.text());
  assert.match(stdout.text(), /Jev: on — 3 sent/);
  assert.deepEqual(auth, ['Bearer sk-from-dotenv', 'Bearer sk-from-dotenv', 'Bearer sk-from-dotenv']);
  for (const n of names) assert.equal(process.env[n], undefined, `${n} leaked into process.env`);
});

test('run: a local file with no operations exits 1, says so, and writes no file', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', { openapi: '3.0.0', servers: [{ url: 'https://api.example.com' }], paths: {} });
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir], { cwd: dir, stdout, stderr });
  assert.equal(code, 1);
  assert.equal(stderr.text(), `rwxmap: no operations found in ${specPath}\n`);
  assert.deepEqual(fs.readdirSync(outDir), []);
});

test('run: a discovered spec with no operations on reload exits 1 with the same message', async (t) => {
  const { fetchImpl } = stubDiscoveryFetch([
    { status: 200, text: JSON.stringify(SPEC_DOC) },
    { status: 200, text: JSON.stringify({ openapi: '3.0.0', paths: {} }) },
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchImpl));
  t.after(() => { globalThis.fetch = originalFetch; });

  const outDir = mkScratch();
  const stderr = captureStream();
  const code = await run(['https://api.example.test', '-o', outDir], { cwd: outDir, stdout: captureStream(), stderr, cacheDir: mkScratch() });

  assert.equal(code, 1);
  assert.equal(stderr.text(), 'rwxmap: no operations found in https://api.example.test/openapi.json\n');
  assert.deepEqual(fs.readdirSync(outDir), []);
});

// ---------------------------------------------------------------------
// Debrief round 2 fixes (2026-09-29).
// ---------------------------------------------------------------------

test('run: --force never leaves a target absent — between backup and rename the old file is still there', async () => {
  const dir = mkScratch();
  const outDir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const names = ['example.rwxmap.json', 'example.rwxmap.review.json', 'example.openapi.rwx.json'];
  for (const name of names) fs.writeFileSync(path.join(outDir, name), `OLD ${name}`);

  // The hook runs after each file's backup and before its replacing
  // rename; it only records (a throw here would roll the run back).
  /** @type {Array<{target: string, content: string|null, backups: number}>} */
  const seen = [];
  const beforeReplace = (targetPath) => {
    const name = path.basename(targetPath);
    seen.push({
      target: name,
      content: fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null,
      backups: fs.readdirSync(outDir).filter((e) => e.startsWith(`${name}.`) && e.endsWith('.bak')).length,
    });
  };
  const stderr = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example', '--force'], { cwd: dir, stdout: captureStream(), stderr, beforeReplace });

  assert.equal(code, 0, stderr.text());
  assert.deepEqual(seen, names.map((name) => ({ target: name, content: `OLD ${name}`, backups: 1 })));
  assert.deepEqual(fs.readdirSync(outDir).sort(), [...names].sort());
  for (const name of names) readJson(path.join(outDir, name));
});

test('run: a spec whose only operations are OpenAPI 3.2 additionalOperations other than QUERY exits 1, says so, and writes no file', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', {
    openapi: '3.2.0',
    paths: {
      '/things': {
        additionalOperations: { COPY: { operationId: 'copyThings' } },
      },
    },
  });
  const outDir = mkScratch();
  const stderr = captureStream();

  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout: captureStream(), stderr });
  assert.equal(code, 1);
  assert.equal(
    stderr.text(),
    `rwxmap: no labelled operations in ${specPath} — 1 operation(s) under OpenAPI 3.2 additionalOperations (other than QUERY) are not read yet (item g)\n`,
  );
  assert.deepEqual(fs.readdirSync(outDir), []);
});

test('run: an empty RWXMAP_JEV_KEY counts as unset, so a .env key is still used', async (t) => {
  const saved = process.env.RWXMAP_JEV_KEY;
  process.env.RWXMAP_JEV_KEY = '';
  t.after(() => {
    if (saved === undefined) delete process.env.RWXMAP_JEV_KEY;
    else process.env.RWXMAP_JEV_KEY = saved;
  });

  const dir = mkScratch();
  fs.writeFileSync(path.join(dir, '.env'), 'RWXMAP_JEV_KEY=sk-from-dotenv\n');
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const auth = [];
  const { fetchImpl: routed } = routedJevFetch({ listThings: { p: 0 }, updateThing: { p: 0 }, doMystery: { p: 1 } });
  const fetchImpl = async (url, init) => {
    auth.push(init.headers.Authorization);
    return routed(url, init);
  };
  const stdout = captureStream();
  const stderr = captureStream();

  const code = await run([specPath, '-o', mkScratch(), '--vendor', 'example', '--engine', 'jev'], { cwd: dir, stdout, stderr, fetchImpl });
  assert.equal(code, 0, stderr.text());
  assert.match(stdout.text(), /Jev: on — 3 sent/);
  assert.deepEqual(auth, ['Bearer sk-from-dotenv', 'Bearer sk-from-dotenv', 'Bearer sk-from-dotenv']);
});

// Forces atomicWriteFiles' no-hard-link fallback: patch the CommonJS fs
// object and sync it into the ESM namespace cli.js imports (`import * as
// fs`), then restore both. Returns how many times linkSync was refused.
async function withoutHardLinks(fn) {
  const realLink = fsDefault.linkSync;
  let refused = 0;
  fsDefault.linkSync = () => {
    refused += 1;
    throw Object.assign(new Error('EPERM: operation not permitted, link (test)'), { code: 'EPERM' });
  };
  syncBuiltinESMExports();
  try {
    await fn();
  } finally {
    fsDefault.linkSync = realLink;
    syncBuiltinESMExports();
  }
  return refused;
}

test('run: with no hard links, a successful --force still replaces a plain file and leaves no backup', async () => {
  const dir = mkScratch();
  const outDir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const names = ['example.rwxmap.json', 'example.rwxmap.review.json', 'example.openapi.rwx.json'];
  for (const name of names) fs.writeFileSync(path.join(outDir, name), `OLD ${name}`);

  let code;
  const stderr = captureStream();
  const refused = await withoutHardLinks(async () => {
    code = await run([specPath, '-o', outDir, '--vendor', 'example', '--force'], { cwd: dir, stdout: captureStream(), stderr });
  });

  assert.equal(code, 0, stderr.text());
  assert.equal(refused, 3, 'the copy fallback was not exercised for every file');
  for (const name of names) {
    const text = fs.readFileSync(path.join(outDir, name), 'utf8');
    assert.ok(!text.includes('OLD'), `${name} still holds the old content`);
    readJson(path.join(outDir, name));
  }
  assert.deepEqual(fs.readdirSync(outDir).sort(), [...names].sort());
});

test('run: with no hard links, a failed --force restores a symlink target as the same symlink', async () => {
  const dir = mkScratch();
  const outDir = mkScratch();
  const refDir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);

  // The map target is a symlink to a file elsewhere; the openapi target is
  // a directory, so the third rename fails after the symlink was replaced.
  const referent = path.join(refDir, 'real-map.json');
  fs.writeFileSync(referent, 'REFERENT');
  const mapPath = path.join(outDir, 'example.rwxmap.json');
  fs.symlinkSync(referent, mapPath);
  fs.writeFileSync(path.join(outDir, 'example.rwxmap.review.json'), 'OLD REVIEW');
  const blocked = path.join(outDir, 'example.openapi.rwx.json');
  fs.mkdirSync(blocked);

  let code;
  const stderr = captureStream();
  const refused = await withoutHardLinks(async () => {
    code = await run([specPath, '-o', outDir, '--vendor', 'example', '--force'], { cwd: dir, stdout: captureStream(), stderr });
  });

  assert.equal(code, 1);
  assert.match(stderr.text(), /could not write output/);
  assert.equal(refused, 2, 'the fallback was not exercised for the two non-directory targets');
  assert.ok(fs.lstatSync(mapPath).isSymbolicLink(), 'the symlink became a plain file');
  assert.equal(fs.readlinkSync(mapPath), referent);
  assert.equal(fs.readFileSync(referent, 'utf8'), 'REFERENT');
  assert.deepEqual(fs.readdirSync(refDir), ['real-map.json']);
  assert.equal(fs.readFileSync(path.join(outDir, 'example.rwxmap.review.json'), 'utf8'), 'OLD REVIEW');
  assert.deepEqual(fs.readdirSync(blocked), []);
  assert.deepEqual(fs.readdirSync(outDir).sort(), ['example.openapi.rwx.json', 'example.rwxmap.json', 'example.rwxmap.review.json']);
});

test('run: possible leftover .bak/.tmp files are reported and never touched', async () => {
  const dir = mkScratch();
  const outDir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  const bak = path.join(outDir, 'example.rwxmap.json.4242.1759100000000.k3j9x2a.bak');
  const tmp = path.join(outDir, 'example.openapi.rwx.json.4242.1759100000000.p0q1r2.tmp');
  const unrelated = path.join(outDir, 'foo.bak');
  const emptySegment = path.join(outDir, 'example.rwxmap.json.1.2..bak');
  fs.writeFileSync(bak, 'PREVIOUS');
  fs.writeFileSync(tmp, 'PARTIAL');
  fs.writeFileSync(unrelated, 'NOT OURS');
  fs.writeFileSync(emptySegment, 'NOT OURS EITHER');

  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });

  assert.equal(code, 0, stderr.text());
  const lines = stdout.text().split('\n').filter((l) => l.includes('leftover'));
  assert.deepEqual(lines, [
    `rwxmap: 2 possible leftover .bak/.tmp file(s) in ${outDir} (from an interrupted run, or another rwxmap run still writing; a .bak holds the previous version of that file); not touched, remove them when done`,
  ]);
  assert.equal(fs.readFileSync(bak, 'utf8'), 'PREVIOUS');
  assert.equal(fs.readFileSync(tmp, 'utf8'), 'PARTIAL');
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'NOT OURS');
  assert.equal(fs.readFileSync(emptySegment, 'utf8'), 'NOT OURS EITHER');
});

test('run: no leftover files means no leftover line', async () => {
  const dir = mkScratch();
  const outDir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_DOC);
  fs.writeFileSync(path.join(outDir, 'foo.bak'), 'NOT OURS');
  const stdout = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr: captureStream() });
  assert.equal(code, 0);
  assert.doesNotMatch(stdout.text(), /leftover/);
});

// ---------------------------------------------------------------------
// Process entry point — the real CLI spawned as a child process. npm's bin
// entry and npx run src/cli.js through a symlink; Node resolves the main
// module through it but leaves argv[1] unresolved, so a plain path compare
// made the installed `rwxmap` exit 0 doing nothing. Each spawn: a temp cwd
// with no .env, RWXMAP_JEV_KEY removed, XDG_CACHE_HOME in a temp dir, and a
// local spec file with --engine mechanical (no network).
// ---------------------------------------------------------------------

const CLI_PATH = path.join(import.meta.dirname, 'cli.js');

function childEnv(cacheDir) {
  /** @type {NodeJS.ProcessEnv} */
  const env = { ...process.env, XDG_CACHE_HOME: cacheDir };
  delete env.RWXMAP_JEV_KEY;
  return env;
}

function spawnCli(command, args) {
  const cwd = mkScratch();
  assert.equal(fs.existsSync(path.join(cwd, '.env')), false);
  const outDir = mkScratch();
  const specPath = writeSpecFile(mkScratch(), 'spec.json', SPEC_DOC);
  const res = spawnSync(command, [...args, '--engine', 'mechanical', specPath, '-o', outDir, '--vendor', 'example'], {
    cwd, env: childEnv(mkScratch()), encoding: 'utf8', timeout: 30_000,
  });
  return { res, outDir };
}

function assertFullRun({ res, outDir }) {
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /^rwxmap: example — 3 operations \(r 1 · w 1 · x 1\)$/m);
  assert.match(res.stdout, /rwxmap: wrote example\.rwxmap\.json \+ example\.rwxmap\.review\.json \+ example\.openapi\.rwx\.json\n/);
  for (const f of ['example.rwxmap.json', 'example.rwxmap.review.json', 'example.openapi.rwx.json']) {
    assert.ok(fs.existsSync(path.join(outDir, f)), `${f} missing`);
    readJson(path.join(outDir, f));
  }
}

test('process: run through a symlink the way npm installs the bin, the CLI runs', () => {
  assert.match(fs.readFileSync(CLI_PATH, 'utf8'), /^#!\/usr\/bin\/env node\n/);
  fs.accessSync(CLI_PATH, fs.constants.X_OK);
  const binDir = mkScratch();
  const link = path.join(binDir, 'rwxmap');
  fs.symlinkSync(CLI_PATH, link);
  assertFullRun(spawnCli(link, []));
});

test('process: `node src/cli.js` runs the CLI', () => {
  assertFullRun(spawnCli(process.execPath, [CLI_PATH]));
});

test('process: importing src/cli.js from another module does not run the CLI', () => {
  const dir = mkScratch();
  const importer = path.join(dir, 'importer.mjs');
  fs.writeFileSync(importer, `const m = await import(${JSON.stringify(pathToFileURL(CLI_PATH).href)});\nprocess.stdout.write('imported ' + typeof m.run + '\\n');\n`);
  // CLI-shaped args are passed on purpose: a misfiring entry point would
  // read them and write files.
  const { res, outDir } = spawnCli(process.execPath, [importer]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, 'imported function\n');
  assert.equal(res.stderr, '');
  assert.deepEqual(fs.readdirSync(outDir), []);
});

test('run: the sidecar carries the spec\'s resolved servers (a relative one from a local file resolves against https://<vendor>)', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', { ...SPEC_OPENAPI3_SERVERS_DOC, servers: [{ url: 'https://api.acme.example/v1' }, { url: '/relative' }] });
  const outDir = mkScratch();

  const code = await run([specPath, '-o', outDir], { cwd: dir, stdout: captureStream(), stderr: captureStream() });

  assert.equal(code, 0);
  const sidecar = readJson(path.join(outDir, 'api.acme.example.rwxmap.review.json'));
  assert.deepEqual(sidecar.servers, ['https://api.acme.example/v1', 'https://api.acme.example/relative']);
});

test('run: a local spec with a relative server and --vendor writes https://<vendor><path>, and the matcher routes its base path', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', {
    openapi: '3.0.0',
    servers: [{ url: '/v1' }],
    paths: { '/orders/{id}': { get: { operationId: 'getOrder' } } },
  });
  const outDir = mkScratch();

  const code = await run([specPath, '--vendor', 'acme.example', '-o', outDir], { cwd: dir, stdout: captureStream(), stderr: captureStream() });

  assert.equal(code, 0);
  const sidecar = readJson(path.join(outDir, 'acme.example.rwxmap.review.json'));
  assert.deepEqual(sidecar.servers, ['https://acme.example/v1']);
  const m = matcherFrom([sidecar]);
  assert.equal(m.match('GET', 'https://acme.example/v1/orders/7').source, 'spec');
  assert.equal(m.match('GET', 'https://acme.example/orders/7').source, 'request');
});

test('run: tenant-templated servers land in serverTemplates (and only those); other sidecars have no such field', async () => {
  const dir = mkScratch();
  const paths = { '/things/{id}': { delete: { operationId: 'deleteThing' } } };
  const tenant = writeSpecFile(dir, 'tenant.json', {
    openapi: '3.0.0',
    servers: [{ url: 'https://{region}.sentry.io/api/{v}', variables: { region: { default: 'us' }, v: { default: '0' } } }, { url: 'https://{sub}.{domain}.com', variables: { sub: { default: 'a' }, domain: { default: 'b' } } }],
    paths,
  });
  const fixed = writeSpecFile(dir, 'fixed.json', { openapi: '3.0.0', servers: [{ url: 'https://api.fixed.example' }], paths });
  const outDir = mkScratch();
  for (const [spec, vendor] of [[tenant, 'sentry.io'], [fixed, 'fixed.example']]) {
    const code = await run([spec, '--vendor', vendor, '-o', outDir], { cwd: dir, stdout: captureStream(), stderr: captureStream() });
    assert.equal(code, 0);
  }
  const sc = readJson(path.join(outDir, 'sentry.io.rwxmap.review.json'));
  assert.deepEqual(sc.servers, ['https://us.sentry.io/api/0', 'https://a.b.com/']);
  assert.deepEqual(sc.serverTemplates, ['https://{region}.sentry.io/api/0']);
  assert.equal('serverTemplates' in readJson(path.join(outDir, 'fixed.example.rwxmap.review.json')), false);
  const m = matcherFrom([sc]);
  assert.equal(m.match('DELETE', 'https://de.sentry.io/api/0/things/9').source, 'spec');
  assert.equal(m.match('DELETE', 'https://x.b.com/things/9').source, 'request'); // 1-label suffix: no route
});

// ---------------------------------------------------------------------
// D133 pass 1: engines, --confidence, Jev only with --engine jev, the
// rwxlite second pass (injected engine) and the model cache check.
// ---------------------------------------------------------------------

const D133_MODEL = 'rwxlite-1.0.0+0123abcd';

/** Run the CLI on SPEC_JEV_DOC; returns {code, stdout, stderr, outDir}. */
async function runD133(extraArgs, extraEnv = {}) {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', SPEC_JEV_DOC);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example', ...extraArgs], {
    cwd: dir, stdout, stderr, jevKey: '', xdgCacheHome: mkScratch(), ...extraEnv,
  });
  return { code, stdout: stdout.text(), stderr: stderr.text(), outDir };
}

/** marker and letter by operation, off the sidecar. */
function d133Rows(outDir) {
  const rows = readJson(path.join(outDir, 'example.rwxmap.review.json')).rows;
  return Object.fromEntries(rows.map((r) => [`${r.method} ${r.path}`, `${r.letter}/${r.marker}`]));
}

test('run (D133): no model can be got -> "rwxlite: off (mechanical)", exit 0, mechanical letters, widened markers', async () => {
  const { code, stdout, stderr, outDir } = await runD133([]);
  assert.equal(code, 0, stderr);
  assert.match(stdout, /^rwxmap: rwxlite: off \(mechanical\) — could not get the model \(offline \(test\)\); none in the cache$/m);
  assert.deepEqual(d133Rows(outDir), {
    'DELETE /things/{id}/permission': 'x/settled',
    'GET /things': 'r/settled',
    'POST /things/{id}/archive': 'w/loose', // a word list lowered a POST: loose since D133
    'PUT /things/{id}': 'w/loose',
    'POST /mystery': 'x/tight',
  });
  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.deepEqual(combined.rwxlite, {
    mode: 'off', model: null, reason: 'could not get the model (offline (test)); none in the cache', sent: 0, raised: 0, lowered: 0, kept: 0, undecided: 0,
  });
});

test('run (D133): --engine mechanical prints the off line, and never looks for a model or calls an engine', async () => {
  let called = 0;
  const { code, stdout, stderr, outDir } = await runD133(['--engine', 'mechanical'], {
    rwxliteEngine: { model: D133_MODEL, run: async () => { called += 1; return []; } },
  });
  assert.equal(code, 0, stderr);
  assert.match(stdout, /^rwxmap: rwxlite: off \(mechanical\)$/m);
  assert.equal(called, 0);
  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.equal(combined.rwxlite.mode, 'off');
  assert.equal(combined.rwxlite.model, null);
  assert.equal(combined.rwxlite.reason, 'engine mechanical');
});

test('run (D133): default mode a with an engine sends only loose and tight rows and applies the second pass', async () => {
  const sent = [];
  const engine = async (items) => {
    sent.push(items.map((i) => i.operationId).sort());
    return items.map((i) => {
      if (i.operationId === 'updateThing') return { pIsX: 0.9, pChanges: 0.95, model: D133_MODEL }; // PUT w -> x
      if (i.operationId === 'doMystery') return { pIsX: 0.01, pChanges: 0.02, model: D133_MODEL }; // POST x -> r at 0.98
      return undefined; // updateThingArchive: error -> undecided
    });
  };
  const { code, stdout, stderr, outDir } = await runD133([], { rwxliteEngine: { model: D133_MODEL, run: engine } });
  assert.equal(code, 0, stderr);
  assert.deepEqual(sent, [['doMystery', 'updateThing', 'updateThingArchive']]);
  assert.deepEqual(d133Rows(outDir), {
    'DELETE /things/{id}/permission': 'x/settled',
    'GET /things': 'r/settled',
    'POST /things/{id}/archive': 'x/tight',
    'PUT /things/{id}': 'x/tight',
    'POST /mystery': 'r/loose',
  });
  assert.match(stdout, new RegExp(`^rwxmap: rwxlite: on \\(${D133_MODEL.replace(/[+.]/g, '\\$&')}\\) — 3 sent · 1 raised · 1 lowered · 0 kept · 1 undecided`, 'm'));
  assert.doesNotMatch(stdout, /rwxlite: off/);
  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.deepEqual(combined.rwxlite, { mode: 'on', model: D133_MODEL, pass: 'a', confidence: null, sent: 3, raised: 1, lowered: 1, kept: 0, undecided: 1 });
  assert.equal(combined.jev.mode, 'off');
  // Every moved row publishes evidence rwxlite, in the sidecar, the MCP _meta and the OpenAPI copy.
  const rows = readJson(path.join(outDir, 'example.rwxmap.review.json')).rows;
  assert.deepEqual(rows.map((r) => r.evidence).sort(), ['floor', 'floor', 'rwxlite', 'rwxlite', 'rwxlite']);
  assert.equal(readJson(path.join(outDir, 'example.rwxmap.review.json')).counts.byEvidence.rwxlite, 3);
  assert.equal(combined.mcp['POST /mystery']._meta['io.github.hamr0.rwxmap/evidence'], 'rwxlite');
});

/** An answer whose letter is `letter` with share `p` (the same shares secondpass.test.js uses). */
function d133Ans(letter, p, model = D133_MODEL) {
  if (letter === 'x') return { pIsX: p, pChanges: p + (1 - p) / 2, model };
  if (letter === 'w') return { pIsX: (1 - p) / 2, pChanges: (1 - p) / 2 + p, model };
  return { pIsX: (1 - p) / 2, pChanges: 1 - p, model };
}

/** Mode b engine: answers by operationId, records what was sent. */
function modeBEngine(byOp, sent = []) {
  return async (items) => {
    sent.push(items.map((i) => i.operationId).sort());
    return items.map((i) => byOp[i.operationId]);
  };
}

test('run (D133): --engine rwxlite (mode b) judges every row at the default confidence 95', async () => {
  const sent = [];
  const engine = modeBEngine({
    deleteThingPermission: d133Ans('w', 0.96), // x -> w at 0.96 >= 0.95: lowered
    listThings: d133Ans('r', 0.98), // kept
    updateThingArchive: d133Ans('x', 0.99), // w -> x: raised
    updateThing: d133Ans('w', 0.90), // under 0.95: undecided
    // doMystery: no answer: undecided
  }, sent);
  const { code, stdout, stderr, outDir } = await runD133(['--engine', 'rwxlite'], { rwxliteEngine: { model: D133_MODEL, run: engine } });
  assert.equal(code, 0, stderr);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].length, 5, 'settled rows are sent too');
  assert.deepEqual(d133Rows(outDir), {
    'DELETE /things/{id}/permission': 'w/loose',
    'GET /things': 'r/settled',
    'POST /things/{id}/archive': 'x/tight',
    'PUT /things/{id}': 'x/tight',
    'POST /mystery': 'x/tight',
  });
  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.deepEqual(combined.rwxlite, { mode: 'on', model: D133_MODEL, pass: 'b', confidence: 95, sent: 5, raised: 1, lowered: 1, kept: 1, undecided: 2 });
  assert.match(stdout, /^rwxmap: rwxlite: on \(.*\) — mode b, confidence 95 — 5 sent · 1 raised · 1 lowered · 1 kept · 2 undecided/m);
  const byKey = Object.fromEntries(readJson(path.join(outDir, 'example.rwxmap.review.json')).rows.map((r) => [`${r.method} ${r.path}`, r.evidence]));
  assert.equal(byKey['DELETE /things/{id}/permission'], 'rwxlite');
  assert.equal(byKey['GET /things'], 'floor');
  assert.equal(byKey['POST /mystery'], 'floor', 'an x row left undecided at x keeps its evidence');
  assert.equal(byKey['PUT /things/{id}'], 'rwxlite');
});

test('run (D133): --confidence changes what mode b accepts (50 accepts a 0.90 answer, 99 asks about it)', async () => {
  const answers = { deleteThingPermission: d133Ans('x', 0.995), listThings: d133Ans('r', 0.9), updateThingArchive: d133Ans('w', 0.9), updateThing: d133Ans('w', 0.9), doMystery: d133Ans('w', 0.9) };
  for (const [c, expected] of [
    ['50', { 'DELETE /things/{id}/permission': 'x/settled', 'GET /things': 'r/settled', 'POST /things/{id}/archive': 'w/loose', 'PUT /things/{id}': 'w/loose', 'POST /mystery': 'w/loose' }],
    ['99', { 'DELETE /things/{id}/permission': 'x/settled', 'GET /things': 'x/tight', 'POST /things/{id}/archive': 'x/tight', 'PUT /things/{id}': 'x/tight', 'POST /mystery': 'x/tight' }],
  ]) {
    const r = await runD133(['--engine', 'rwxlite', '--confidence', c], { rwxliteEngine: { model: D133_MODEL, run: modeBEngine(answers) } });
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(d133Rows(r.outDir), expected, `confidence ${c}`);
    assert.equal(readJson(path.join(r.outDir, 'example.rwxmap.json')).rwxlite.confidence, Number(c));
  }
});

test('run (D133): mode b with no model is mechanical and says so; with --model small it is accepted', async () => {
  const noModel = await runD133(['--engine', 'rwxlite', '--confidence', '70']);
  assert.equal(noModel.code, 0, noModel.stderr);
  assert.match(noModel.stdout, /rwxlite: off \(mechanical\) — could not get the model/);
  assert.equal(d133Rows(noModel.outDir)['POST /mystery'], 'x/tight');
  const small = await runD133(['--engine', 'rwxlite', '--confidence', '50', '--model', 'small']);
  assert.equal(small.code, 0, small.stderr);
  assert.match(small.stdout, /rwxlite: off \(mechanical\)/);
});

test('run (D133): mode a with no loose or tight row fetches no model and says "nothing to check"', async () => {
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', { openapi: '3.0.0', paths: { '/things': { get: { operationId: 'listThings' } }, '/things/{id}': { delete: { operationId: 'deleteThing' } } } });
  const outDir = mkScratch();
  const stdout = captureStream();
  let calls = 0;
  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], {
    cwd: dir, stdout, stderr: captureStream(), jevKey: '', xdgCacheHome: mkScratch(), modelFetch: async () => { calls += 1; throw new Error('must not be called'); },
  });
  assert.equal(code, 0);
  assert.equal(calls, 0);
  assert.match(stdout.text(), /^rwxmap: rwxlite: nothing to check \(no row is marked loose or tight\); no model was fetched$/m);
  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.equal(combined.rwxlite.mode, 'off');
  assert.equal(combined.rwxlite.reason, 'nothing to check');
});

test('run (D133): --confidence is valid only with --engine rwxlite, and only as a whole number 0-99', async () => {
  /** @type {Array<[string[], RegExp]>} */
  const cases = [
    [['--confidence', '50'], /--confidence is valid only with --engine rwxlite/],
    [['--engine', 'jev', '--confidence', '50'], /--confidence is valid only with --engine rwxlite/],
    [['--engine', 'mechanical', '--confidence', '50'], /--confidence is valid only with --engine rwxlite/],
    [['--engine', 'rwxlite', '--confidence', '100'], /whole number from 0 to 99/],
    [['--engine', 'rwxlite', '--confidence=-1'], /whole number from 0 to 99/],
    [['--engine', 'rwxlite', '--confidence', '7.5'], /whole number from 0 to 99/],
    [['--engine', 'rwxlite', '--confidence', 'abc'], /whole number from 0 to 99/],
    [['--engine', 'rwxlite', '--confidence', ''], /whole number from 0 to 99/],
  ];
  for (const [args, message] of cases) {
    const r = await runD133(args);
    assert.equal(r.code, 1, args.join(' '));
    assert.match(r.stderr, message, args.join(' '));
    assert.deepEqual(fs.readdirSync(r.outDir), [], 'nothing written');
  }
  for (const ok of ['0', '70', '99']) {
    const r = await runD133(['--engine', 'rwxlite', '--confidence', ok]);
    assert.equal(r.code, 0, `${ok}: ${r.stderr}`);
  }
});

test('run (D133): an unknown --engine value fails loudly', async () => {
  const r = await runD133(['--engine', 'gpt']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /unknown --engine: gpt \(want rwxlite, jev or mechanical\)/);
  assert.deepEqual(fs.readdirSync(r.outDir), []);
});

test('run (D133): --engine jev without a key fails loudly, sends nothing, writes nothing', async () => {
  let calls = 0;
  const r = await runD133(['--engine', 'jev'], { fetchImpl: async () => { calls += 1; throw new Error('must not be called'); } });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /--engine jev needs a key/);
  assert.equal(calls, 0);
  assert.deepEqual(fs.readdirSync(r.outDir), []);
});

test('run (D133): a Jev key WITHOUT --engine jev leaves Jev off, says so, and sends no request', async () => {
  for (const args of [[], ['--engine', 'mechanical'], ['--engine', 'rwxlite']]) {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; throw new Error('must not be called'); };
    const r = await runD133(args, { jevKey: 'sk-fake', fetchImpl });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(calls, 0, args.join(' '));
    assert.match(r.stdout, /^rwxmap: Jev: off — a Jev key is set, but Jev runs only with --engine jev; nothing was sent$/m);
    assert.doesNotMatch(r.stdout, /Jev: on/);
    assert.equal(readJson(path.join(r.outDir, 'example.rwxmap.json')).jev.mode, 'off');
  }
});

test('run (D133): --engine jev with a key behaves as before and prints no rwxlite line', async () => {
  const { fetchImpl, calls } = routedJevFetch({ listThings: { p: 0.1 }, updateThing: { p: 0.1 }, doMystery: { p: 0.1 } });
  const r = await runD133(['--engine', 'jev'], { jevKey: 'sk-fake', fetchImpl });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(calls.length > 0);
  assert.match(r.stdout, /Jev: on — /);
  assert.doesNotMatch(r.stdout, /rwxlite/);
});

/** A cached model directory in rwxlite's layout; `dirSha8` overrides the sha8 in the directory name. */
function writeModelDir(xdg, bytes, dirSha8) {
  const sha = (b) => createHash('sha256').update(b).digest('hex');
  const model = `rwxlite-1.0.0+${dirSha8 ?? sha(bytes).slice(0, 8)}`;
  const dir = path.join(xdg, 'rwxmap', model);
  fs.mkdirSync(dir, { recursive: true });
  const vocab = Buffer.from('vocab');
  fs.writeFileSync(path.join(dir, 'model.bin'), bytes);
  fs.writeFileSync(path.join(dir, 'vocab.txt'), vocab);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: '1.0.0', modelFile: 'model.bin', model, files: { 'model.bin': sha(bytes), 'vocab.txt': sha(vocab) } }));
  return dir;
}

test('run (D133): a cached model whose hash does not match its name is NOT used: loud warning, mechanical, exit 0', async () => {
  const xdg = mkScratch();
  writeModelDir(xdg, Buffer.from('weights'), 'deadbeef');
  const r = await runD133([], { xdgCacheHome: xdg });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stderr, /WARNING: rwxlite model rejected \(hash mismatch.*rwxlite-1\.0\.0\+deadbeef was NOT used/);
  assert.match(r.stdout, /rwxlite: off \(mechanical\) — could not get the model \(offline \(test\)\); the cached model was rejected/);
  assert.equal(d133Rows(r.outDir)['POST /mystery'], 'x/tight');
});

/** A fake `rwxlite` package: its answerer reports `model`, and answers every request with the given p. */
function fakeRwxlite(model, p, seen = []) {
  return async (name) => {
    assert.equal(name, 'rwxlite');
    return {
      loadAnswerer: async (opts) => {
        seen.push(opts);
        return { model, answerMany: async (reqs) => reqs.map(() => ({ model, answers: { isX: { noul: p.isX }, changes: { noul: p.changes } } })) };
      },
    };
  };
}

test('run (D133): offline with a verified cached model -> "using cached ...", the second pass runs on it', async () => {
  const xdg = mkScratch();
  const bytes = Buffer.from('weights');
  const sha8 = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const dir = writeModelDir(xdg, bytes);
  const model = `rwxlite-1.0.0+${sha8}`;
  const seen = [];
  const r = await runD133([], { xdgCacheHome: xdg, rwxliteImporter: fakeRwxlite(model, { isX: 0.99, changes: 0.99 }, seen) });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stderr, new RegExp(`^rwxmap: using cached ${model.replace(/[+.]/g, '\\$&')}( \\(no cached exact model, so the small one\\))?, could not check for a newer one`, 'm'));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].dir, dir);
  assert.match(r.stdout, /rwxlite: on \(/);
  assert.equal(readJson(path.join(r.outDir, 'example.rwxmap.json')).rwxlite.model, model);
});

test('run (D133): a verified model but no rwxlite package -> mechanical alone, says how to install it', async () => {
  const xdg = mkScratch();
  writeModelDir(xdg, Buffer.from('weights'));
  const importer = async () => { throw Object.assign(new Error("Cannot find package 'rwxlite' imported from /x/src/rwxliteengine.js"), { code: 'ERR_MODULE_NOT_FOUND' }); };
  const r = await runD133([], { xdgCacheHome: xdg, rwxliteImporter: importer });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /^rwxmap: rwxlite: off \(mechanical\) — the rwxlite package is not installed \(npm install rwxlite\)$/m);
  assert.equal(readJson(path.join(r.outDir, 'example.rwxmap.json')).rwxlite.mode, 'off');
});

test('run (D133): --model small is accepted in the default run and --engine rwxlite, and fetches the small manifest', async () => {
  for (const args of [['--model', 'small'], ['--engine', 'rwxlite', '--model', 'small']]) {
    const urls = [];
    const r = await runD133(args, { modelFetch: async (u) => { urls.push(String(u)); throw new Error('offline (test)'); } });
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(urls, ['https://github.com/hamr0/rwxlite/releases/latest/download/manifest.json'], args.join(' '));
  }
  const urls = [];
  const r = await runD133([], { modelFetch: async (u) => { urls.push(String(u)); throw new Error('offline (test)'); } });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(urls, ['https://github.com/hamr0/rwxlite/releases/latest/download/manifest-exact.json']);
});

test('run (D133): --model fails loudly with any other value, and with --engine jev or mechanical; nothing is fetched or written', async () => {
  /** @type {Array<[string[], RegExp]>} */
  const cases = [
    [['--model', 'exact'], /--model takes only "small"/],
    [['--model', ''], /--model takes only "small"/],
    [['--engine', 'rwxlite', '--model', 'big'], /--model takes only "small"/],
    [['--engine', 'mechanical', '--model', 'small'], /--model is valid only in the default run and with --engine rwxlite/],
    [['--engine', 'jev', '--model', 'small'], /--model is valid only in the default run and with --engine rwxlite/],
  ];
  for (const [args, re] of cases) {
    let calls = 0;
    const r = await runD133(args, { modelFetch: async () => { calls += 1; throw new Error('must not be called'); } });
    assert.equal(r.code, 1, args.join(' '));
    assert.match(r.stderr, re, args.join(' '));
    assert.equal(calls, 0);
    assert.deepEqual(fs.readdirSync(r.outDir), []);
  }
});

test('run (D133): --engine mechanical and --engine jev never touch the network for the model', async () => {
  let calls = 0;
  const modelFetch = async () => { calls += 1; throw new Error('must not be called'); };
  const m = await runD133(['--engine', 'mechanical'], { modelFetch });
  assert.equal(m.code, 0, m.stderr);
  const { fetchImpl } = routedJevFetch({ listThings: { p: 0.1 }, updateThing: { p: 0.1 }, doMystery: { p: 0.1 } });
  const j = await runD133(['--engine', 'jev'], { jevKey: 'sk-fake', fetchImpl, modelFetch });
  assert.equal(j.code, 0, j.stderr);
  assert.equal(calls, 0);
});

test('run (D133): --help names the engines, --confidence, and that a key alone does not turn Jev on', async () => {
  const stdout = captureStream();
  const code = await run(['--help'], { cwd: mkScratch(), stdout, stderr: captureStream() });
  assert.equal(code, 0);
  assert.match(stdout.text(), /--engine <e>/);
  assert.match(stdout.text(), /--confidence <0-99>/);
  assert.match(stdout.text(), /A key alone does not turn Jev on/);
});

test('D134: a 3.2 query op and an additionalOperations QUERY op get r, a key, x-rwx and readOnlyHint; COPY stays unread', async () => {
  const doc = {
    openapi: '3.2.0',
    servers: [{ url: 'https://api.example.com' }],
    paths: {
      '/things': {
        get: { operationId: 'listThings' },
        post: { operationId: 'createThing' },
        query: { operationId: 'purgeThingsQuery' },
      },
      '/reports': { additionalOperations: { QUERY: { operationId: 'runReport' }, COPY: { operationId: 'copyReport' } } },
    },
  };
  const dir = mkScratch();
  const specPath = writeSpecFile(dir, 'spec.json', doc);
  const outDir = mkScratch();
  const stdout = captureStream();
  const stderr = captureStream();
  const code = await run([specPath, '-o', outDir, '--vendor', 'example'], { cwd: dir, stdout, stderr });
  assert.equal(code, 0, stderr.text());
  const combined = readJson(path.join(outDir, 'example.rwxmap.json'));
  assert.deepEqual(combined.mcp['QUERY /things'].annotations, { readOnlyHint: true });
  assert.deepEqual(combined.mcp['QUERY /reports'].annotations, { readOnlyHint: true });
  assert.equal(combined.mcp['QUERY /things']._meta['io.github.hamr0.rwxmap/class'], 'r');
  assert.ok(combined.webmcp['QUERY /things']);
  const copy = readJson(path.join(outDir, 'example.openapi.rwx.json'));
  assert.equal(copy.paths['/things'].query['x-rwx'].class, 'r');
  assert.equal(copy.paths['/reports'].additionalOperations.QUERY['x-rwx'].class, 'r');
  assert.equal('x-rwx' in copy.paths['/reports'].additionalOperations.COPY, false);
  assert.equal(copy.paths['/things'].post['x-rwx'].class, 'x');
  assert.match(stdout.text(), /\nrwxmap: 1 operation\(s\) under OpenAPI 3\.2 additionalOperations \(other than QUERY\) are not labelled yet/);
});
