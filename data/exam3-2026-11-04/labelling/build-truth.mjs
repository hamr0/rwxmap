// Builds truth.csv from ops.csv, labeller files A/B per vendor, and rulings.csv.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const VENDORS = ['clerk', 'neon', 'supabase', 'mux', 'netbird', 'ory', 'novu'];
const sha = (b) => createHash('sha256').update(b).digest('hex');
const die = (m) => { console.error('FAIL: ' + m); process.exit(1); };

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = ''; rows.push(row); row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const opsBuf = readFileSync(join(root, 'ops.csv'));
const want = readFileSync(join(root, 'ops.csv.sha256'), 'utf8').trim().split(/\s+/)[0];
if (sha(opsBuf) !== want) die('ops.csv sha256 mismatch');
const ops = parseCsv(opsBuf.toString('utf8')).slice(1).filter((r) => r.length > 1);
const hdr = parseCsv(opsBuf.toString('utf8'))[0];
const iId = hdr.indexOf('id'), iProv = hdr.indexOf('provider');
if (ops.length !== 1377) die('ops rows ' + ops.length);

const rulings = new Map();
for (const r of parseCsv(readFileSync(join(here, 'rulings.csv'), 'utf8')).slice(1).filter((r) => r.length > 1)) {
  if (!/^[rwx]$/.test(r[1]) || !/^[rwx]$/.test(r[2]) || !/^[rwx]$/.test(r[3])) die('bad ruling ' + r[0]);
  if (rulings.has(r[0])) die('duplicate ruling ' + r[0]);
  rulings.set(r[0], { ruling: r[1], a: r[2], b: r[3] });
}

const A = new Map(), B = new Map();
for (const v of VENDORS) {
  const ids = ops.filter((r) => r[iProv].split('.')[0] === v).map((r) => r[iId]);
  for (const [side, map] of [['A', A], ['B', B]]) {
    const rows = parseCsv(readFileSync(join(here, 'out', `${side}-${v}.csv`), 'utf8')).slice(1).filter((r) => r.length > 1);
    if (rows.length !== ids.length) die(`${side}-${v} rows ${rows.length} != ${ids.length}`);
    rows.forEach((r, i) => {
      if (r[0] !== ids[i]) die(`${side}-${v} row ${i} id ${r[0]} != ${ids[i]}`);
      if (!/^[rwx]$/.test(r[1])) die(`${side}-${v} ${r[0]} label '${r[1]}'`);
      map.set(r[0], r[1]);
    });
  }
}

let agreed = 0, ruled = 0;
const seen = new Set();
const out = ['id,label'];
for (const r of ops) {
  const id = r[iId], a = A.get(id), b = B.get(id);
  if (a === undefined || b === undefined) die('missing label ' + id);
  let label;
  if (a === b) {
    if (rulings.has(id)) die('ruling on an agreement ' + id);
    label = a; agreed++;
  } else {
    const ru = rulings.get(id);
    if (!ru) die('disagreement without ruling ' + id);
    if (ru.a !== a || ru.b !== b) die(`ruling a/b mismatch ${id}: files ${a}/${b}, ruling ${ru.a}/${ru.b}`);
    label = ru.ruling; ruled++; seen.add(id);
  }
  out.push(`${id},${label}`);
}
for (const id of rulings.keys()) if (!seen.has(id)) die('unused ruling ' + id);

const body = out.join('\n') + '\n';
writeFileSync(join(root, 'truth.csv'), body);
writeFileSync(join(root, 'truth.csv.sha256'), `${sha(Buffer.from(body))}  truth.csv\n`);
console.log(`rows ${ops.length}, agreed ${agreed}, ruled ${ruled}`);
console.log('label totals written to truth.csv');
console.log('truth sha256 ' + sha(Buffer.from(body)));
