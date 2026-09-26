import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { loadSpec } from './load.mjs';

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
    assert.match(err.message, /could not parse as JSON or YAML/);
    assert.ok(err.message.includes(p), `error message should name the source: ${err.message}`);
    return true;
  });
});

test('throws when the parsed document has no usable paths object', async () => {
  const p = writeFixture('no-paths.json', JSON.stringify({ openapi: '3.0.0', info: { title: 'x' } }));
  await assert.rejects(() => loadSpec(p), (err) => {
    assert.match(err.message, /no usable "paths" object/);
    assert.ok(err.message.includes(p));
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
