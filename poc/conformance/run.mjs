// One-off conformance check (PRD "Go/no-go for item e", bar 10): each
// standard's own published definition accepts what rwxmap emits.
//
//   1. openapi   — every input AND its .openapi.rwx copy validated against
//                  the official OAI JSON Schema for its version; pass = the
//                  copy's error set equals the input's (an input that is
//                  already invalid is the vendor's problem, listed).
//   2. mcp       — every `mcp` entry built into a full Tool, validated
//                  against MCP schema.json 2026-07-28 ($defs/Tool).
//      metakey   — every `_meta` key against that schema's own prose rule
//                  for MetaObject keys (the JSON Schema does not encode it).
//      roundtrip — intercom's live tools registered on a real
//                  @modelcontextprotocol/sdk server, listed by a real client
//                  over the SDK's in-memory transport; annotations and
//                  _meta must come back deep-equal.
//      readme    — the README's MCP snippet ("Who reads what") run as
//                  written against the SDK's real McpServer.registerTool.
//   3. webmcp    — every `webmcp` entry against the WebMCP WebIDL
//                  (ModelContextTool / ToolAnnotations, parsed from the
//                  pinned spec page): only known members, IDL types.
//      browser   — only when CHROME=<path> is set: one r, one w and one x
//                  tool registered in a real page via
//                  document.modelContext.registerTool, read back with
//                  getTools(); every member we sent must come back equal.
//
// Input is rwxmap's own output, never a copy: buildOutput from src/cli.js
// over the same 37 spec files tools/proof-cli.js covers (its file list
// logic restated here, not imported), plus one live CLI run against
// https://api.intercom.io (no Jev key, fresh cache, run from a temp dir so
// no .env is read).
//
// --break=<name> corrupts rwxmap's output IN MEMORY before one check, to
// see that check fail: openapi | mcp | metakey | roundtrip | readme |
// webmcp | browser. src/ is never touched.
//
// Run: node run.mjs            (exits 1 on any failure)
//      CHROME=/path/to/chrome node run.mjs   (adds the browser check)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Ajv04 from 'ajv-draft-04';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

import { loadSpec } from '../../src/load.js';
import { operationsFrom } from '../../src/exporter.js';
import { buildOutput } from '../../src/cli.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SCHEMAS = path.join(HERE, 'schemas');
const SETS = [
  'data/provider-corpus-2026-09-16',
  'data/exam-2026-09-17',
  'data/exam-2026-09-20',
  'data/exam-2026-09-22',
];
const BREAKS = ['openapi', 'mcp', 'metakey', 'roundtrip', 'readme', 'webmcp', 'browser'];
const MAX_SHOWN = 5;

const breakArg = process.argv.find((a) => a.startsWith('--break='));
const BREAK = breakArg ? breakArg.slice('--break='.length) : null;
if (BREAK && !BREAKS.includes(BREAK)) {
  console.error(`unknown --break=${BREAK}; one of ${BREAKS.join(', ')}`);
  process.exit(2);
}
if (BREAK) console.log(`*** --break=${BREAK}: rwxmap output corrupted in memory for this run ***\n`);

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const deepEqual = (a, b) => {
  try { assert.deepStrictEqual(a, b); return true; } catch { return false; }
};
/** @type {{name: string, ok: boolean, line: string}[]} */
const results = [];
function record(name, failures, line) {
  const ok = failures.length === 0;
  results.push({ name, ok, line });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${line}`);
  for (const f of failures.slice(0, MAX_SHOWN)) console.log(`     - ${f}`);
  if (failures.length > MAX_SHOWN) console.log(`     ... ${failures.length - MAX_SHOWN} more (${failures.length} total)`);
}

// ---------------------------------------------------------------- inputs

/** @returns {Promise<{label: string, doc: any, copy: any, combined: any}[]>} */
async function corpusInputs() {
  const out = [];
  let skippedNoOps = 0;
  let loadErrors = 0;
  for (const set of SETS) {
    for (const entry of readJson(path.join(REPO, set, 'specs.lock.json'))) {
      const filePath = path.join(REPO, set, 'specs', entry.path);
      let doc;
      try {
        ({ doc } = await loadSpec(filePath));
      } catch {
        loadErrors += 1;
        continue;
      }
      const ops = operationsFrom(doc);
      if (ops.length === 0) {
        skippedNoOps += 1;
        continue;
      }
      const built = buildOutput(ops, entry.provider, filePath, { doc });
      out.push({ label: path.relative(REPO, filePath), doc, copy: built.openapiCopy, combined: built.combined });
    }
  }
  console.log(`inputs: ${out.length} corpus spec files with operations (${loadErrors} lock entries not loadable as a spec, ${skippedNoOps} with 0 operations — the same filter proof-cli applies)`);
  return out;
}

async function liveInput() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-conformance-'));
  const outDir = path.join(tmp, 'out');
  const env = { ...process.env, XDG_CACHE_HOME: path.join(tmp, 'cache') };
  delete env.RWXMAP_JEV_KEY;
  const r = spawnSync(process.execPath, [path.join(REPO, 'src', 'cli.js'), 'https://api.intercom.io', '-o', outDir], {
    cwd: tmp, env, encoding: 'utf8', timeout: 180_000,
  });
  process.stdout.write(r.stdout.split('\n').map((l) => (l ? `  live| ${l}` : l)).join('\n'));
  if (r.status !== 0) throw new Error(`live rwxmap run exited ${r.status}: ${r.stderr}`);
  if (!/Jev: off/.test(r.stdout)) throw new Error('live run did not report "Jev: off"');
  const combined = readJson(path.join(outDir, 'api.intercom.io.rwxmap.json'));
  const copy = readJson(path.join(outDir, 'api.intercom.io.openapi.rwx.json'));
  const { doc } = await loadSpec(combined.source);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`  live input: ${combined.source}`);
  return { label: 'LIVE api.intercom.io', doc, copy, combined };
}

// ---------------------------------------------------------------- breaks (in memory only)

const firstOperation = (doc) => {
  for (const item of Object.values(doc.paths || {})) {
    for (const [m, op] of Object.entries(item || {})) {
      if (['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'].includes(m)) return op;
    }
  }
  return null;
};
function applyBreak(inputs) {
  for (const inp of inputs) {
    const firstKey = Object.keys(inp.combined.mcp)[0];
    if (BREAK === 'openapi') firstOperation(inp.copy).responses = 'broken';
    if (BREAK === 'mcp') inp.combined.mcp[firstKey].annotations.readOnlyHint = 'true';
    if (BREAK === 'metakey') {
      const meta = inp.combined.mcp[firstKey]._meta;
      meta['io.modelcontextprotocol/class'] = meta['io.github.hamr0.rwxmap/class'];
    }
    if (BREAK === 'webmcp') inp.combined.webmcp[Object.keys(inp.combined.webmcp)[0]].annotations.destructiveHint = true;
  }
}

// ---------------------------------------------------------------- 1. OpenAPI

const OAS = {
  '2.0': { file: 'oas-2.0-2017-08-27.json', draft: '04' },
  '3.0': { file: 'oas-3.0-2024-10-18.json', draft: '04' },
  '3.1': { file: 'oas-3.1-2026-08-03.json', draft: '2020-12' },
};
function oasVersion(doc) {
  if (doc.swagger === '2.0') return '2.0';
  const m = /^(3\.\d+)\./.exec(String(doc.openapi || ''));
  return m ? m[1] : `unknown(${doc.swagger ?? doc.openapi})`;
}
function makeAjv(draft) {
  const ajv = draft === '04'
    ? new Ajv04({ allErrors: true, strict: false })
    : new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}
const errorSet = (errors) => (errors || []).map((e) => `${e.instancePath} ${e.keyword} ${e.message}`).sort();

// Ajv 8.20 resolves the 3.1 schema's `$dynamicRef: "#meta"` wrongly: it
// applies the enclosing object's rules to the Schema Object, so a trivially
// valid 3.1 doc fails (measured 2026-09-29, see README). The pinned schema
// has exactly ONE `$dynamicAnchor: "meta"` (at $defs/schema) and nothing
// else in scope can override it, so per JSON Schema 2020-12 every
// `$dynamicRef: "#meta"` resolves to $defs/schema — the same as a static
// `$ref`. That substitution is made here, in memory, and refused if the
// one-anchor premise ever stops holding.
function resolveDynamicMeta(schema) {
  const text = JSON.stringify(schema);
  const anchors = text.match(/"\$dynamicAnchor":"meta"/g) || [];
  if (!/"\$dynamicRef"/.test(text)) return schema;
  if (anchors.length !== 1 || schema.$defs?.schema?.$dynamicAnchor !== 'meta') {
    throw new Error('3.1 schema: $dynamicRef present but not exactly one $dynamicAnchor "meta" at $defs/schema — static resolution not valid');
  }
  return JSON.parse(text.replaceAll('"$dynamicRef":"#meta"', '"$ref":"#/$defs/schema"'));
}

// Validator sanity: a trivially valid doc per version must pass, or the
// validator (not the input) is broken and every comparison is noise.
const MINIMAL = {
  '2.0': { swagger: '2.0', info: { title: 't', version: '1' }, paths: { '/a': { get: { parameters: [{ name: 'q', in: 'query', type: 'string' }], responses: { 200: { description: 'ok' } } } } } },
  '3.0': { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: { '/a': { get: { parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'ok' } } } } } },
  '3.1': { openapi: '3.1.0', info: { title: 't', version: '1' }, paths: { '/a': { get: { parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'ok' } } } } } },
};

function checkOpenApi(inputs) {
  const validators = {};
  const failures = [];
  for (const [v, { file, draft }] of Object.entries(OAS)) {
    validators[v] = makeAjv(draft).compile(resolveDynamicMeta(readJson(path.join(SCHEMAS, file))));
    if (!validators[v](MINIMAL[v])) failures.push(`validator sanity: a minimal valid ${v} doc is rejected: ${errorSet(validators[v].errors).slice(0, 3).join('; ')}`);
  }
  const perVersion = {};
  const alreadyInvalid = [];
  for (const { label, doc, copy } of inputs) {
    const v = oasVersion(doc);
    const tally = (perVersion[v] ??= { files: 0, inputValid: 0, inputInvalid: 0, copyMatches: 0 });
    tally.files += 1;
    const validate = validators[v];
    if (!validate) {
      failures.push(`${label}: no official schema pinned for OpenAPI ${v}`);
      continue;
    }
    validate(doc);
    const inErr = errorSet(validate.errors);
    validate(copy);
    const cpErr = errorSet(validate.errors);
    if (inErr.length === 0) tally.inputValid += 1;
    else {
      tally.inputInvalid += 1;
      alreadyInvalid.push(`${label} (${v}): ${inErr.length} schema error(s) in the vendor's input, e.g. ${inErr[0]}`);
    }
    if (deepEqual(inErr, cpErr)) tally.copyMatches += 1;
    else {
      const added = cpErr.filter((e) => !inErr.includes(e));
      const gone = inErr.filter((e) => !cpErr.includes(e));
      failures.push(`${label} (${v}): copy errors differ from input — new in copy: ${JSON.stringify(added.slice(0, 3))} (${added.length}); gone: ${gone.length}`);
    }
  }
  const versions = Object.entries(perVersion)
    .map(([v, t]) => `${v}: ${t.files} files, copy==input ${t.copyMatches}/${t.files}, input valid ${t.inputValid}, input already invalid ${t.inputInvalid}`)
    .join(' | ');
  record('openapi (input vs copy, official OAI schema)', failures, versions);
  if (alreadyInvalid.length) {
    console.log(`     inputs already invalid against the official schema (vendor's problem, identical in the copy unless listed above): ${alreadyInvalid.length}`);
    for (const a of alreadyInvalid) console.log(`       · ${a}`);
  }
}

// ---------------------------------------------------------------- 2. MCP

const toolName = (key, entry) => {
  const raw = entry.operationId || key.replace(' ', '-');
  return raw.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 128);
};
/** A full Tool per mcp entry; names made unique within one file. */
function buildTools(combined) {
  const seen = new Map();
  return Object.entries(combined.mcp).map(([key, entry]) => {
    let name = toolName(key, entry);
    const n = (seen.get(name) || 0) + 1;
    seen.set(name, n);
    if (n > 1) name = `${name}_${n}`;
    return { key, tool: { name, description: key, inputSchema: { type: 'object' }, annotations: entry.annotations, _meta: entry._meta } };
  });
}

function checkMcpSchema(inputs) {
  const ajv = makeAjv('2020-12');
  ajv.addSchema(readJson(path.join(SCHEMAS, 'mcp-2026-07-28.schema.json')), 'mcp');
  const validate = ajv.getSchema('mcp#/$defs/Tool');
  const failures = [];
  let tools = 0;
  for (const { label, combined } of inputs) {
    for (const { key, tool } of buildTools(combined)) {
      tools += 1;
      if (!validate(tool)) failures.push(`${label} ${key}: ${ajv.errorsText(validate.errors)}`);
    }
  }
  record('mcp (Tool vs schema.json 2026-07-28 $defs/Tool)', failures, `${tools - failures.length}/${tools} tools valid across ${inputs.length} files`);
}

// MetaObject's key rule, from schema.json 2026-07-28's own description
// (prose there, not JSON Schema): optional prefix of dot-separated labels
// (start with a letter, end letter/digit, interior letters/digits/hyphens)
// followed by "/"; a name that, unless empty, starts and ends alphanumeric
// with interior alphanumerics, "-", "_", "."; a prefix whose second label
// is "modelcontextprotocol" or "mcp" is reserved for MCP.
const LABEL = '[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
const META_KEY = new RegExp(`^(?:(${LABEL}(?:\\.${LABEL})*)/)?(?:[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)?$`);
function checkMetaKeys(inputs) {
  const failures = [];
  let keys = 0;
  for (const { label, combined } of inputs) {
    for (const [k, entry] of Object.entries(combined.mcp)) {
      for (const mk of Object.keys(entry._meta || {})) {
        keys += 1;
        const m = META_KEY.exec(mk);
        if (!m) failures.push(`${label} ${k}: _meta key "${mk}" breaks the MetaObject key syntax`);
        else if (m[1] && ['modelcontextprotocol', 'mcp'].includes(m[1].split('.')[1])) failures.push(`${label} ${k}: _meta key "${mk}" uses a prefix reserved for MCP`);
      }
    }
  }
  record('metakey (_meta keys vs MetaObject key rule)', failures, `${keys - failures.length}/${keys} _meta keys conform`);
}

/** Connect a fresh McpServer and Client over the SDK's in-memory pair. */
async function connectPair(register) {
  const server = new McpServer({ name: 'rwxmap-conformance', version: '0.0.0' });
  register(server);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  let negotiated = null;
  const send = serverT.send.bind(serverT);
  serverT.send = (msg, opts) => {
    if (msg && msg.result && msg.result.protocolVersion) negotiated = msg.result.protocolVersion;
    return send(msg, opts);
  };
  const client = new Client({ name: 'rwxmap-conformance-client', version: '0.0.0' });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  const listed = [];
  let cursor;
  do {
    const page = await client.listTools(cursor ? { cursor } : {});
    listed.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  await client.close();
  return { listed, negotiated };
}

async function checkRoundTrip(live) {
  const failures = [];
  const built = buildTools(live.combined);
  let listed = [];
  let negotiated = null;
  try {
    ({ listed, negotiated } = await connectPair((server) => {
      for (const [i, { tool }] of built.entries()) {
        let meta = tool._meta;
        if (BREAK === 'roundtrip' && i === 0) meta = { ...meta, 'io.github.hamr0.rwxmap/evidence': 'tampered' };
        server.registerTool(tool.name, { description: tool.description, inputSchema: {}, annotations: tool.annotations, _meta: meta }, async () => ({ content: [] }));
      }
    }));
  } catch (err) {
    failures.push(`SDK round trip threw: ${String(err && err.message).slice(0, 400)}`);
  }
  const byName = new Map(listed.map((t) => [t.name, t]));
  let equal = 0;
  if (listed.length) {
    for (const { key, tool } of built) {
      const got = byName.get(tool.name);
      if (!got) failures.push(`${key}: not in tools/list`);
      else if (!deepEqual(got.annotations, tool.annotations)) failures.push(`${key}: annotations ${JSON.stringify(got.annotations)} !== ${JSON.stringify(tool.annotations)}`);
      else if (!deepEqual(got._meta, tool._meta)) failures.push(`${key}: _meta ${JSON.stringify(got._meta)} !== ${JSON.stringify(tool._meta)}`);
      else equal += 1;
    }
  }
  record('roundtrip (@modelcontextprotocol/sdk server -> client tools/list)', failures,
    `${equal}/${built.length} intercom tools came back with annotations and _meta deep-equal; ${listed.length} listed; negotiated protocol ${negotiated}`);
}

async function checkReadme() {
  const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
  const section = readme.slice(readme.indexOf('**Who reads what.**'));
  const m = /- \*\*MCP\*\*[\s\S]*?```js\n([\s\S]*?)```/.exec(section);
  const failures = [];
  if (!m) {
    record('readme (MCP snippet vs SDK registerTool)', ['MCP snippet not found under "Who reads what"'], 'not run');
    return;
  }
  const placeholder = '{ /* yours */ }';
  const stand = BREAK === 'readme' ? "{ type: 'object' }" : '{}';
  const code = m[1].replace(placeholder, stand);
  if (!m[1].includes(placeholder)) failures.push(`placeholder ${placeholder} not found; snippet changed`);
  let recorded;
  let listed = [];
  try {
    ({ listed } = await connectPair((server) => {
      const spy = {
        registerTool: (name, config, cb) => {
          recorded = { name, config };
          return server.registerTool(name, config, cb);
        },
      };
      new Function('server', 'handler', m[1].includes('await ') ? `return (async () => {${code}})()` : code)(spy, async () => ({ content: [] }));
    }));
  } catch (err) {
    failures.push(`snippet with inputSchema ${stand} threw: ${String(err && err.message).slice(0, 300)}`);
  }
  const got = recorded && listed.find((t) => t.name === recorded.name);
  if (recorded && !got) failures.push(`tool ${recorded.name} not in tools/list`);
  if (got && !deepEqual({ a: got.annotations, m: got._meta }, { a: recorded.config.annotations, m: recorded.config._meta })) {
    failures.push(`${recorded.name}: listed annotations/_meta differ from the snippet's`);
  }
  record('readme (MCP snippet vs SDK registerTool)', failures,
    got ? `snippet ran as written (inputSchema placeholder -> ${stand}); ${got.name} listed with its annotations and _meta` : 'snippet did not complete');
}

// ---------------------------------------------------------------- 3. WebMCP

/** Parse `dictionary <name> { ... }` members from the pinned spec's IDL blocks. */
function idlDictionary(html, name) {
  const decode = (s) => s.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  for (const b of html.matchAll(/<pre[^>]*class="[^"]*idl[^"]*"[^>]*>([\s\S]*?)<\/pre>/g)) {
    const text = decode(b[1]);
    const d = new RegExp(`dictionary ${name}\\s*\\{([\\s\\S]*?)\\};`).exec(text);
    if (!d) continue;
    const members = {};
    for (const line of d[1].split('\n')) {
      const mm = /^\s*(?:required\s+)?([A-Za-z<>]+)\s+(\w+)\s*(?:=[^;]*)?;/.exec(line.replace(/\/\/.*$/, ''));
      if (mm) members[mm[2]] = mm[1];
    }
    return members;
  }
  throw new Error(`dictionary ${name} not found in the pinned WebMCP spec`);
}

function checkWebmcp(inputs, idl) {
  const failures = [];
  let entries = 0;
  let bad = 0;
  for (const { label, combined } of inputs) {
    for (const [k, entry] of Object.entries(combined.webmcp)) {
      entries += 1;
      const before = failures.length;
      for (const f of Object.keys(entry)) if (!(f in idl.tool)) failures.push(`${label} ${k}: "${f}" is not a ModelContextTool member`);
      for (const [a, v] of Object.entries(entry.annotations || {})) {
        if (!(a in idl.annotations)) failures.push(`${label} ${k}: annotations.${a} is not a ToolAnnotations member`);
        else if (idl.annotations[a] !== 'boolean' || typeof v !== 'boolean') failures.push(`${label} ${k}: annotations.${a} = ${JSON.stringify(v)}, IDL type ${idl.annotations[a]}`);
      }
      if (failures.length > before) bad += 1;
    }
  }
  record('webmcp (entries vs WebMCP IDL)', failures,
    `${entries - bad}/${entries} entries conform across ${inputs.length} files; ToolAnnotations members ${JSON.stringify(idl.annotations)}`);
}

async function checkBrowser(live) {
  const chrome = process.env.CHROME;
  if (!chrome) {
    console.log('SKIP browser: CHROME not set — WebMCP is checked against the IDL only');
    return;
  }
  const version = spawnSync(chrome, ['--version'], { encoding: 'utf8' }).stdout.trim();
  const picks = {};
  for (const [key, entry] of Object.entries(live.combined.mcp)) {
    const letter = entry._meta['io.github.hamr0.rwxmap/class'];
    if (!picks[letter]) picks[letter] = { key, name: toolName(key, entry), annotations: structuredClone(live.combined.webmcp[key].annotations) };
  }
  const sent = ['r', 'w', 'x'].map((l) => ({ letter: l, ...picks[l] }));
  const registered = structuredClone(sent);
  if (BREAK === 'browser') delete registered[2].annotations.consequentialHint;
  // The page POSTs its result back to this server; Chrome is killed once
  // it arrives. (--dump-dom with a virtual-time budget left Chrome 156
  // stuck mid-registerTool in 2 of 7 runs, measured 2026-09-29.)
  const page = `<!doctype html><body><script>
(async () => { let out; try {
  if (!document.modelContext) out = { error: 'document.modelContext missing' };
  else {
    for (const t of ${JSON.stringify(registered)}) await document.modelContext.registerTool({ name: t.name, description: t.key, inputSchema: { type: 'object' }, annotations: t.annotations, execute: async () => 'ok' });
    const tools = await document.modelContext.getTools();
    out = { tools: tools.map((t) => ({ name: t.name, annotations: t.annotations })) };
  }
} catch (e) { out = { error: String(e) }; }
  await fetch('/result', { method: 'POST', body: JSON.stringify(out) });
})();
</script>`;
  let onResult;
  const result = new Promise((res) => { onResult = res; });
  const srv = http.createServer((q, r) => {
    if (q.method === 'POST' && q.url === '/result') {
      let body = '';
      q.on('data', (d) => { body += d; });
      q.on('end', () => { r.end('ok'); onResult(body); });
      return;
    }
    r.writeHead(200, { 'content-type': 'text/html' });
    r.end(page);
  });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const url = `http://localhost:${srv.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rwxmap-conformance-chrome-'));
  const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`,
    '--enable-features=WebMCPTesting', url], { stdio: 'ignore', detached: true });
  const exited = new Promise((res) => proc.on('close', res));
  const body = await Promise.race([result, new Promise((res) => setTimeout(() => res(''), 60_000))]);
  process.kill(-proc.pid, 'SIGKILL'); // the whole group: Chrome's child processes keep writing to the profile
  await exited;
  srv.close();
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  const failures = [];
  let back = {};
  try { back = JSON.parse(body); } catch { failures.push(`no result posted by the page within 60 s: ${body.slice(0, 200) || '(nothing)'}`); }
  if (back.error) failures.push(back.error);
  const got = new Map((back.tools || []).map((t) => [t.name, t.annotations]));
  for (const t of sent) {
    const a = got.get(t.name);
    if (!a) { if (back.tools) failures.push(`${t.letter} ${t.key}: not returned by getTools()`); continue; }
    for (const [member, v] of Object.entries(t.annotations)) {
      if (a[member] !== v) failures.push(`${t.letter} ${t.key}: sent ${member}=${v}, getTools() returned ${JSON.stringify(a[member])} (all returned: ${JSON.stringify(a)})`);
    }
  }
  record(`browser (${version}, --enable-features=WebMCPTesting)`, failures,
    `r/w/x tools registered and read back: ${sent.map((t) => `${t.letter}=${JSON.stringify(got.get(t.name) ?? null)}`).join(' ')}`);
}

// ---------------------------------------------------------------- main

const sdkVersion = readJson(path.join(HERE, 'node_modules/@modelcontextprotocol/sdk/package.json')).version;
console.log(`node ${process.version}; @modelcontextprotocol/sdk ${sdkVersion} (LATEST_PROTOCOL_VERSION ${LATEST_PROTOCOL_VERSION}); ajv ${readJson(path.join(HERE, 'node_modules/ajv/package.json')).version}`);
const corpus = await corpusInputs();
const live = await liveInput();
const inputs = [...corpus, live];
const ops = inputs.reduce((n, i) => n + Object.keys(i.combined.mcp).length, 0);
console.log(`checking ${inputs.length} files (${corpus.length} corpus + 1 live), ${ops} operations\n`);
applyBreak(inputs);

const html = fs.readFileSync(path.join(SCHEMAS, 'webmcp-spec.html'), 'utf8');
const idl = { tool: idlDictionary(html, 'ModelContextTool'), annotations: idlDictionary(html, 'ToolAnnotations') };

checkOpenApi(inputs);
checkMcpSchema(inputs);
checkMetaKeys(inputs);
await checkRoundTrip(live);
await checkReadme();
checkWebmcp(inputs, idl);
await checkBrowser(live);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `; FAILED: ${failed.map((r) => r.name.split(' ')[0]).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
