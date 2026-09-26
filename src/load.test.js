import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import http from 'node:http';
import { execFileSync } from 'node:child_process';

import { loadSpec } from './load.js';
import { operationsFrom } from './index.js';

// Fixtures are written under os.tmpdir(), never into the repo (CLAUDE.md:
// "never write a corpus or data extract to a scratchpad" / "keep originals"
// — this is throwaway test input, not a corpus, and it must not land in
// git either way).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-load-test-'));

function writeFixture(name, contents) {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, contents);
  return p;
}

/**
 * `assert.rejects`' validation callback receives its rejection reason typed
 * as `unknown`; every loadSpec error is a real `Error`, so this narrows it
 * once instead of repeating the check at each call site.
 *
 * @param {unknown} err
 * @returns {string}
 */
function errMessage(err) {
  assert.ok(err instanceof Error, `expected an Error, got ${String(err)}`);
  return /** @type {Error} */ (err).message;
}

const MINIMAL_DOC = {
  paths: {
    '/widgets': { get: { operationId: 'listWidgets', summary: 'List widgets' } },
  },
};

test('loads a JSON file from disk', async () => {
  const p = writeFixture('spec.json', JSON.stringify(MINIMAL_DOC));
  const result = await loadSpec(p);
  assert.equal(result.format, 'json');
  assert.deepEqual(result.doc, MINIMAL_DOC);
  assert.equal(result.source, p);
  assert.equal(result.bytes, fs.statSync(p).size);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
});

test('loads a YAML file from disk', async () => {
  const yamlText = 'paths:\n  /widgets:\n    get:\n      operationId: listWidgets\n      summary: List widgets\n';
  const p = writeFixture('spec.yaml', yamlText);
  const result = await loadSpec(p);
  assert.equal(result.format, 'yaml');
  assert.deepEqual(result.doc, MINIMAL_DOC);
});

test('gunzips a gzipped file transparently, sha256/bytes describe the compressed bytes as read', async () => {
  const jsonText = JSON.stringify(MINIMAL_DOC);
  const gz = zlib.gzipSync(Buffer.from(jsonText, 'utf8'));
  const p = writeFixture('spec.json.gz', gz);
  const result = await loadSpec(p);
  assert.equal(result.format, 'json');
  assert.deepEqual(result.doc, MINIMAL_DOC);
  // bytes/sha256 are of the bytes AS READ (the gzip file), before gunzip.
  assert.equal(result.bytes, gz.length);
  assert.equal(result.bytes, fs.statSync(p).size);
});

test('strips a UTF-8 BOM before parsing', async () => {
  const jsonText = '﻿' + JSON.stringify(MINIMAL_DOC);
  const p = writeFixture('spec-bom.json', Buffer.from(jsonText, 'utf8'));
  const result = await loadSpec(p);
  assert.equal(result.format, 'json');
  assert.deepEqual(result.doc, MINIMAL_DOC);
});

test('throws a clear error, naming the source, when neither JSON nor YAML parses', async () => {
  // A colon with no key and unbalanced brackets: invalid JSON, and YAML's
  // parser rejects it too (not just "parses to something odd").
  const p = writeFixture('garbage.txt', ': [ not json, not yaml : : {');
  await assert.rejects(() => loadSpec(p), (err) => {
    assert.match(errMessage(err), /could not parse as JSON or YAML/);
    assert.ok(errMessage(err).includes(p), `error message should name the source: ${errMessage(err)}`);
    return true;
  });
});

test('throws when the parsed document has no usable paths object', async () => {
  const p = writeFixture('no-paths.json', JSON.stringify({ openapi: '3.0.0', info: { title: 'x' } }));
  await assert.rejects(() => loadSpec(p), (err) => {
    assert.match(errMessage(err), /no usable "paths" object/);
    assert.ok(errMessage(err).includes(p));
    return true;
  });
});

test('throws when paths is present but not an object (e.g. a string)', async () => {
  const p = writeFixture('paths-not-object.json', JSON.stringify({ paths: 'nope' }));
  await assert.rejects(() => loadSpec(p), /no usable "paths" object/);
});

test('YAML 1.2 core schema: on/yes/no/01 stay strings, not booleans or numbers', async () => {
  // A path key "/on" and an operationId "no" are the two the brief calls
  // out; also cover a "yes" summary value and a "01" description value to
  // pin the whole on/off/yes/no/octal-looking family in one fixture.
  const yamlText = [
    'paths:',
    '  /on:',
    '    get:',
    '      operationId: no',
    '      summary: yes',
    '      description: "01"',
    '',
  ].join('\n');
  const p = writeFixture('yaml-1.2-words.yaml', yamlText);
  const result = await loadSpec(p);
  assert.equal(result.format, 'yaml');
  assert.ok(Object.prototype.hasOwnProperty.call(result.doc.paths, '/on'), 'path key "/on" must survive as a string, not become boolean true');
  const op = result.doc.paths['/on'].get;
  assert.equal(op.operationId, 'no');
  assert.equal(typeof op.operationId, 'string');
  assert.equal(op.summary, 'yes');
  assert.equal(typeof op.summary, 'string');
  assert.equal(op.description, '01');
  assert.equal(typeof op.description, 'string');
});

// --- Byte caps and binary refusal before YAML (D106) -------------------

function tarLikeBuffer() {
  // A minimal stand-in for a POSIX tar header: some leading bytes (with a
  // NUL, as any real tar header has via its zero-padded fields), then the
  // `ustar` magic at the fixed offset every tar reader/writer agrees on.
  const buf = Buffer.alloc(512);
  buf.write('some-file-name.txt', 0, 'utf8');
  buf.write('ustar', 257, 'utf8');
  return buf;
}

test('throws the binary error on tar-like content (NUL + ustar at offset 257), never reaching the YAML parser', async () => {
  const p = writeFixture('archive.tar', tarLikeBuffer());
  await assert.rejects(() => loadSpec(p), (err) => {
    assert.match(errMessage(err), /not an OpenAPI document \(binary content\)/);
    assert.ok(errMessage(err).includes(p), `error message should name the source: ${errMessage(err)}`);
    // If this reached the YAML parser instead, the error would name YAML
    // (as the "garbage.txt" test above does), not "binary content".
    assert.doesNotMatch(errMessage(err), /could not parse as JSON or YAML/);
    return true;
  });
});

test('throws when a gzip bomb\'s decompressed output exceeds maxBytes', async () => {
  const big = Buffer.alloc(1024 * 1024); // 1MB of zeros, gzips tiny
  const gz = zlib.gzipSync(big);
  const p = writeFixture('bomb.json.gz', gz);
  await assert.rejects(() => loadSpec(p, { maxBytes: 64 * 1024 }), (err) => {
    assert.match(errMessage(err), /exceeds maxBytes/);
    assert.ok(errMessage(err).includes(p));
    return true;
  });
});

test('throws a distinct "not a valid gzip stream" error on a truncated gzip, never "exceeds maxBytes"', async () => {
  const jsonText = JSON.stringify(MINIMAL_DOC);
  const gz = zlib.gzipSync(Buffer.from(jsonText, 'utf8'));
  const truncated = gz.subarray(0, gz.length - 8); // drop the gzip trailer (CRC32 + ISIZE)
  const p = writeFixture('truncated.json.gz', truncated);
  await assert.rejects(() => loadSpec(p), (err) => {
    assert.match(errMessage(err), /not a valid gzip stream/);
    assert.ok(errMessage(err).includes(p), `error message should name the source: ${errMessage(err)}`);
    assert.doesNotMatch(errMessage(err), /exceeds maxBytes/);
    return true;
  });
});

test('throws when a file on disk exceeds maxBytes, before it is read', async () => {
  const p = writeFixture('too-big.json', Buffer.alloc(200));
  await assert.rejects(() => loadSpec(p, { maxBytes: 100 }), (err) => {
    assert.match(errMessage(err), /exceeds maxBytes/);
    assert.ok(errMessage(err).includes(p));
    return true;
  });
});

// Starts a plain node:http server on an ephemeral 127.0.0.1 port, running
// `handler(req, res)`; returns { url, close }. Used for the two URL cap
// tests and the $ref-not-fetched proof below — no external network access.
async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'server.address() must be a net.AddressInfo once listening');
  const { port } = address;
  return {
    url: (p) => `http://127.0.0.1:${port}${p}`,
    // A test that throws before draining the response body leaves a
    // keep-alive socket open; a plain server.close() then waits out
    // Node's keepAliveTimeout (~5s) before its callback fires.
    // closeAllConnections forces those sockets shut so teardown is fast.
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    }),
  };
}

test('throws when a URL streams more than maxBytes with no content-length', async () => {
  const chunk = Buffer.alloc(64 * 1024, 0x61); // 64KB of 'a'
  const { url, close } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // No content-length header: the cap must be enforced on the actual
    // streamed total, not a header the server could omit or lie about.
    for (let i = 0; i < 4; i++) res.write(chunk); // 256KB total
    res.end();
  });
  try {
    await assert.rejects(
      () => loadSpec(url('/spec.json'), { maxBytes: 64 * 1024 }),
      (err) => {
        assert.match(errMessage(err), /exceeds maxBytes/);
        return true;
      },
    );
  } finally {
    await close();
  }
});

test('throws when a URL sends a too-large content-length header, before the body is read', async () => {
  const { url, close } = await startServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': String(200 * 1024 * 1024),
    });
    // Body deliberately never fully sent: a correct implementation throws
    // on the header alone and never waits for this.
    res.write(Buffer.alloc(1024));
  });
  try {
    await assert.rejects(
      () => loadSpec(url('/spec.json'), { maxBytes: 64 * 1024 }),
      (err) => {
        assert.match(errMessage(err), /content-length.*exceeds maxBytes/i);
        return true;
      },
    );
  } finally {
    await close();
  }
});

test('an external $ref operation loads as a method+path row with no operationId, and is never fetched', async () => {
  let otherYmlRequests = 0;
  const { url, close } = await startServer((req, res) => {
    if (req.url === '/other.yml') otherYmlRequests++;
    res.writeHead(200, { 'Content-Type': 'text/yaml' });
    res.end('operationId: shouldNotBeFetched\n');
  });
  try {
    const refUrl = url('/other.yml');
    const doc = {
      paths: {
        '/widgets/{id}': {
          get: { $ref: refUrl },
        },
      },
    };
    const p = writeFixture('ref-spec.json', JSON.stringify(doc));
    const result = await loadSpec(p);
    const operations = operationsFrom(result.doc);
    assert.equal(operations.length, 1);
    assert.equal(operations[0].method, 'GET');
    assert.equal(operations[0].path, '/widgets/{id}');
    assert.ok(!Object.prototype.hasOwnProperty.call(operations[0], 'operationId'), 'a $ref operation must not carry an operationId');
    assert.equal(otherYmlRequests, 0, 'the external $ref target must never be fetched');
  } finally {
    await close();
  }
});

// --- D107: the classifier root never loads yaml -------------------------
//
// `import 'rwxmap'` (src/index.js) must never pull in the `yaml` package —
// that is the whole reason the loader ships as a separate `rwxmap/load`
// subpath instead of being re-exported from the root. Proved with a real
// ESM resolve hook (node:module's register), not by grepping source: the
// hook fires in Node's dedicated module-hooks thread, which does NOT share
// memory with the main thread, so it records each "yaml"/"yaml/..." hit by
// appending a line to a counter file on disk (a shared filesystem, unlike
// globalThis, crosses that thread boundary reliably) while a child process
// imports the target module; the runner then reports the line count.
//
// The hook, runner and counter files are written to os.tmpdir() at test
// time, never committed — same reasoning as the fixtures above.

const repoRoot = path.resolve(import.meta.dirname, '..');

function writeYamlHookFiles(dir) {
  const hookPath = path.join(dir, 'yaml-hook.mjs');
  fs.writeFileSync(hookPath, `
    import { appendFileSync } from 'node:fs';
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'yaml' || specifier.startsWith('yaml/')) {
        appendFileSync(process.env.RWXMAP_YAML_HITS_FILE, 'hit\\n');
      }
      return nextResolve(specifier, context);
    }
  `);
  const runnerPath = path.join(dir, 'yaml-hook-runner.mjs');
  fs.writeFileSync(runnerPath, `
    import { register } from 'node:module';
    import { pathToFileURL } from 'node:url';

    const [, , targetPath] = process.argv;
    register(pathToFileURL(${JSON.stringify(hookPath)}).href, import.meta.url);
    await import(pathToFileURL(targetPath).href);
  `);
  return runnerPath;
}

function countYamlResolutions(runnerPath, targetPath, counterFile) {
  fs.writeFileSync(counterFile, '');
  execFileSync(process.execPath, [runnerPath, targetPath], {
    encoding: 'utf8',
    env: { ...process.env, RWXMAP_YAML_HITS_FILE: counterFile },
  });
  return fs.readFileSync(counterFile, 'utf8').split('\n').filter((l) => l.length > 0).length;
}

test('import("rwxmap") (src/index.js) never resolves yaml; src/load.js does', () => {
  const hookDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-yaml-hook-'));
  try {
    const runnerPath = writeYamlHookFiles(hookDir);
    const indexCounterFile = path.join(hookDir, 'hits-index.txt');
    const indexHits = countYamlResolutions(runnerPath, path.join(repoRoot, 'src', 'index.js'), indexCounterFile);
    assert.equal(indexHits, 0, 'src/index.js must never resolve the yaml package');
    const loadCounterFile = path.join(hookDir, 'hits-load.txt');
    const loadHits = countYamlResolutions(runnerPath, path.join(repoRoot, 'src', 'load.js'), loadCounterFile);
    assert.ok(loadHits > 0, 'src/load.js must resolve the yaml package (proves the hook itself can detect a hit)');
  } finally {
    fs.rmSync(hookDir, { recursive: true, force: true });
  }
});
