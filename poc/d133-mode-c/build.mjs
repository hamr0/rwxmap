// Build one OpenAPI file per provider from rwxlite's 949 fresh rows. Usage: node build.mjs <outdir>
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
const D = new URL('../../data/rwxlite-fresh-2026-11-03/', import.meta.url).pathname;
const out = process.argv[2];
fs.mkdirSync(out + '/specs', { recursive: true });
const lines = (b) => b.toString('utf8').split(/\r?\n/).filter(Boolean);
const rows = lines(gunzipSync(fs.readFileSync(D + 'decision.jsonl.gz'))).map((l) => JSON.parse(l));
const prov = new Map(lines(gunzipSync(fs.readFileSync(D + 'ops.csv.gz'))).slice(1).map((l) => l.split(',').slice(0, 2)));
const specs = {}, map = {}; let dup = 0;
for (const r of rows) {
  const p = prov.get(r.id), s = r.state;
  const sp = specs[p] ??= { openapi: '3.0.3', info: { title: p, version: '1' }, paths: {} };
  const m = s.method.toLowerCase(); const pa = sp.paths[s.path] ??= {};
  if (pa[m]) { dup++; console.error('DUP', p, s.method, s.path, r.id); continue; }
  const op = { responses: { 200: { description: 'ok' } } };
  for (const f of ['operationId', 'summary', 'description']) if (s[f]) op[f] = s[f];
  pa[m] = op; map[r.id] = { vendor: p, method: s.method, path: s.path };
}
const names = Object.keys(specs);
names.forEach((p, i) => fs.writeFileSync(`${out}/specs/v${String(i).padStart(3, '0')}.json`, JSON.stringify(specs[p])));
fs.writeFileSync(out + '/vendors.json', JSON.stringify(names));
fs.writeFileSync(out + '/idmap.json', JSON.stringify(map));
console.log('rows', rows.length, 'providers', names.length, 'dups', dup, 'mapped', Object.keys(map).length);
