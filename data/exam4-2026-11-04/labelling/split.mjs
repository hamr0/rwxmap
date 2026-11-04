// Splits ops.csv into one blind part file per vendor. Run: node split.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, enc } from './csv.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const buf = readFileSync(join(root, 'ops.csv'));
const want = readFileSync(join(root, 'ops.csv.sha256'), 'utf8').trim().split(/\s+/)[0];
const got = createHash('sha256').update(buf).digest('hex');
if (got !== want) { console.error(`sha256 mismatch: got ${got} want ${want}`); process.exit(1); }

const rows = parseCsv(buf.toString('utf8'));
const hdr = rows.shift();
const OPS_HDR = 'id,provider,method,path,operationId,summary,description';
if (hdr.join(',') !== OPS_HDR) throw new Error('unexpected ops.csv header: ' + hdr.join(','));
const OUT_HDR = 'row_id,provider,method,path,operationId,summary,description';

const provider = { permit: 'permit.io', immich: 'immich.app', polar: 'polar.sh', harbor: 'goharbor.io', zulip: 'zulip.com', chatwoot: 'chatwoot.com', render: 'render.com' };
const byProv = Object.fromEntries(Object.entries(provider).map(([v, p]) => [p, v]));
const parts = Object.fromEntries(Object.keys(provider).map((v) => [v, []]));
for (const r of rows) {
  if (r.length === 1 && r[0] === '') continue;
  if (r.length !== 7) throw new Error(`bad column count ${r.length} at ${r[0]}`);
  const v = byProv[r[1]];
  if (!v) throw new Error(`unknown provider ${r[1]} at ${r[0]}`);
  parts[v].push(r);
}
mkdirSync(join(here, 'blind'), { recursive: true });
let total = 0;
for (const [v, rs] of Object.entries(parts)) {
  const out = [OUT_HDR, ...rs.map((r) => r.map(enc).join(','))].join('\n') + '\n';
  writeFileSync(join(here, 'blind', `part-${v}.csv`), out);
  console.log(`${v}: ${rs.length}`);
  total += rs.length;
}
console.log(`total: ${total}`);
if (total !== 1505) throw new Error(`total expected 1505 got ${total}`);
