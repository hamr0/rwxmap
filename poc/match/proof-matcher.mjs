#!/usr/bin/env node
// Proof for `rwxmap/match` (src/matcher.js): for every loadable spec in the
// four data sets, matcherFrom([sidecar]).match(m, u) must give the same
// key, letter, marker and source as classifyCall(found, m, u) — the spec
// path it replaces — on (1) every operation's own synthesized URL and
// (2) one undocumented URL per spec, GET and POST. `tie` has no
// classifyCall counterpart, so it is not compared.
//
// `found` is built the way discover.js's buildFoundResult builds it
// (which is not exported, and findSpec on a local file path cannot resolve
// a relative server URL): exportGate's tools as entries, gateKey per op,
// servers through serversOrVendorHost. The sidecar is exportSidecar with
// servers from resolvedServers, exactly as the CLI writes it. Both use the
// same https base for relative server URLs, as a URL input would. URL synthesis and the
// skip list (hubspot, digitalocean fragments, specs with no servers) are
// measure.mjs's. Nothing here is tuned; exit 1 on any difference. The
// difference count is a true count — only the printed examples are capped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpec } from '../../src/load.js';
import { operationsFrom, exportGate, exportSidecar, gateKey } from '../../src/exporter.js';
import { resolvedServers, serversOrVendorHost } from '../../src/servers.js';
import { classifyCall } from '../../src/discover.js';
import { matcherFrom } from '../../src/matcher.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETS = [
  'data/provider-corpus-2026-09-16',
  'data/exam-2026-09-17',
  'data/exam-2026-09-20',
  'data/exam-2026-09-22',
];
const ROTATION = ['12345', '550e8400-e29b-41d4-a716-446655440000', 'abcdef0123456789abcdef01', 'cus_NffrFeUfNV2Hib'];
const NAME_OVERRIDE_RE = /name|slug|key/i;
const EXAMPLE_LIMIT = 10;
const FIELDS = ['key', 'letter', 'marker', 'source'];

function fillTemplate(templatePath, counterRef) {
  return templatePath.replace(/\{([^}]+)\}/g, (whole, name) => {
    if (NAME_OVERRIDE_RE.test(name)) return 'acme-prod';
    const value = ROTATION[counterRef[0] % ROTATION.length];
    counterRef[0] += 1;
    return value;
  });
}

function collectSpecFiles() {
  const files = [];
  for (const setDir of SETS) {
    const entries = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, setDir, 'specs.lock.json'), 'utf8'));
    for (const entry of entries) {
      if (entry.provider === 'hubspot') continue;
      if (entry.provider === 'digitalocean' && entry.path.includes('/resources/')) continue;
      files.push({ provider: entry.provider, filePath: path.join(REPO_ROOT, setDir, 'specs', entry.path), lockPath: entry.path });
    }
  }
  return files;
}

let specs = 0;
let skipped = 0;
let calls = 0;
let specHits = 0;
let differences = 0;
const examples = [];

for (const file of collectSpecFiles()) {
  let doc;
  try {
    ({ doc } = await loadSpec(file.filePath));
  } catch {
    skipped += 1;
    continue;
  }
  const ops = operationsFrom(doc);
  const servers = resolvedServers(doc);
  if (ops.length === 0 || servers.length === 0) { skipped += 1; continue; }
  const base = servers[0].replace(/\/+$/, '');
  const vendor = new URL(servers[0]).hostname.toLowerCase();
  const specUrl = `https://${vendor}/openapi.json`;

  const resolved = resolvedServers(doc, specUrl);
  const found = {
    status: 'found',
    host: vendor,
    servers: serversOrVendorHost(resolved, vendor),
    entries: exportGate(ops, { vendor, form: 'object' }).tools,
    ops,
    opKeys: ops.map((op) => gateKey(vendor, op)),
  };
  const sidecar = exportSidecar(ops, { vendor, servers: resolved });
  const matcher = matcherFrom([sidecar]);
  specs += 1;

  const counterRef = [0];
  const probes = ops.map((op) => [op.method, `${base}${fillTemplate(op.path || '', counterRef)}`]);
  for (const m of ['GET', 'POST']) probes.push([m, `${base}/__rwxmap_no_such_path__/1`]);

  for (const [method, url] of probes) {
    calls += 1;
    const want = classifyCall(found, method, url);
    const got = matcher.match(method, url);
    if (want.source === 'spec') specHits += 1;
    const bad = FIELDS.filter((f) => want[f] !== got[f]);
    if (bad.length > 0) {
      differences += 1;
      if (examples.length < EXAMPLE_LIMIT) examples.push({ provider: file.provider, method, url, differ: bad, classifyCall: want, matcher: got });
    }
  }
}

console.log(`specs compared: ${specs} (skipped ${skipped})`);
console.log(`total calls: ${calls} (of which classifyCall matched a spec: ${specHits})`);
console.log(`differences: ${differences}`);
for (const e of examples) console.log(JSON.stringify(e));
process.exit(differences > 0 ? 1 : 0);
