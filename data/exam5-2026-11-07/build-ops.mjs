// Builds ops.csv (frozen ops for shared clean exam #5) from specs/. Loads with src/load.js.
// Does no classification. Deterministic. Exits non-zero if any check fails.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadSpec } from '../../src/load.js';

const dir = dirname(fileURLToPath(import.meta.url));
const VENDORS = [
  ['front', 'frontapp.com', 246], ['planetscale', 'planetscale.com', 291], ['paddle', 'paddle.com', 126], ['hookdeck', 'hookdeck.com', 135],
  ['fusionauth', 'fusionauth.io', 364], ['semaphore', 'semaphoreui.com', 155], ['weaviate', 'weaviate.io', 126],
];
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const HEADER = 'id,provider,method,path,operationId,summary,description';
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
const str = (v) => (typeof v === 'string' ? v : '');
const q = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const sources = JSON.parse(readFileSync(join(dir, 'sources.json'), 'utf8'));
const rows = [];
for (const [vendor, domain, want] of VENDORS) {
  const src = sources.find((s) => s.vendor === vendor);
  const { doc, sha256 } = await loadSpec(join(dir, src.file));
  // loadSpec hashes the bytes on disk; for a gzipped spec that is the .gz, so compare to sha256_gz (src.sha256 is the uncompressed original).
  check(sha256 === (src.sha256_gz || src.sha256), `${vendor} sha256 matches sources.json`);
  const hosts = (doc.servers || []).map((s) => str(s.url));
  console.log(`  ${vendor} servers: ${hosts.join(' | ') || '(none)'}`);
  let n = 0;
  for (const [path, item] of Object.entries(doc.paths)) {
    if (!item || typeof item !== 'object') continue;
    for (const m of METHODS) {
      const op = item[m];
      if (!op || typeof op !== 'object') continue;
      rows.push({ provider: domain, method: m.toUpperCase(), path, operationId: str(op.operationId), summary: str(op.summary), description: str(op.description) });
      n++;
    }
  }
  check(n === want, `${vendor} rows ${n} == ${want}`);
}
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
rows.sort((a, b) => cmp(a.provider, b.provider) || cmp(a.path, b.path) || cmp(a.method, b.method));
const lines = [HEADER];
rows.forEach((r, i) => {
  r.id = `ex5-${String(i + 1).padStart(4, '0')}`;
  lines.push([r.id, r.provider, r.method, r.path, r.operationId, r.summary, r.description].map(q).join(','));
});
const out = Buffer.from(lines.join('\n') + '\n', 'utf8');
writeFileSync(join(dir, 'ops.csv'), out);
const sha = createHash('sha256').update(out).digest('hex');
writeFileSync(join(dir, 'ops.csv.sha256'), `${sha}  ops.csv\n`);

check(rows.length === 1443, `total rows ${rows.length} == 1443`);
check(new Set(rows.map((r) => r.id)).size === rows.length, '0 duplicate ids');
check(new Set(rows.map((r) => `${r.provider}\0${r.method}\0${r.path}`)).size === rows.length, '0 duplicate (provider, method, path)');
check(!(out[0] === 0xef && out[1] === 0xbb && out[2] === 0xbf), 'no BOM');
check(out.toString('utf8').split('\n')[0] === HEADER, 'header exact');
console.log(`ops.csv sha256 ${sha}`);
process.exit(fails.length ? 1 : 0);
