// Splits ops.csv into one blind part file per vendor. Run: node split.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const buf = readFileSync(join(root, 'ops.csv'));
const want = readFileSync(join(root, 'ops.csv.sha256'), 'utf8').trim().split(/\s+/)[0];
const got = createHash('sha256').update(buf).digest('hex');
if (got !== want) { console.error(`sha256 mismatch: got ${got} want ${want}`); process.exit(1); }

function parse(text) {
  const rows = []; let row = [], f = '', q = false, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
      f += c; i++; continue;
    }
    if (c === '"') { q = true; i++; }
    else if (c === ',') { row.push(f); f = ''; i++; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      i++; row.push(f); f = ''; rows.push(row); row = [];
    } else { f += c; i++; }
  }
  if (q) throw new Error('unterminated quote');
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const enc = (s) => /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;

let text = buf.toString('utf8');
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
const rows = parse(text);
const hdr = rows.shift();
const OPS_HDR = 'id,provider,method,path,operationId,summary,description';
if (hdr.join(',') !== OPS_HDR) throw new Error('unexpected ops.csv header: ' + hdr.join(','));
const OUT_HDR = 'row_id,provider,method,path,operationId,summary,description';

const expect = { clerk: 263, neon: 193, supabase: 170, mux: 192, netbird: 231, ory: 179, novu: 149 };
const parts = Object.fromEntries(Object.keys(expect).map((v) => [v, []]));
for (const r of rows) {
  if (r.length !== 7) throw new Error(`bad column count ${r.length} at ${r[0]}`);
  const v = r[1].split('.')[0];
  if (!parts[v]) throw new Error(`unknown vendor ${v} at ${r[0]}`);
  parts[v].push(r);
}
mkdirSync(join(here, 'blind'), { recursive: true });
let total = 0;
for (const [v, rs] of Object.entries(parts)) {
  const out = [OUT_HDR, ...rs.map((r) => r.map(enc).join(','))].join('\n') + '\n';
  writeFileSync(join(here, 'blind', `part-${v}.csv`), out);
  console.log(`${v}: ${rs.length}`);
  if (rs.length !== expect[v]) throw new Error(`${v}: expected ${expect[v]} got ${rs.length}`);
  total += rs.length;
}
console.log(`total: ${total}`);
if (total !== 1377) throw new Error(`total expected 1377 got ${total}`);
