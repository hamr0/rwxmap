// Builds truth.csv from ops.csv, labeller files A/B per vendor, and rulings.csv.
// Run: node build-truth.mjs            builds truth.csv, truth.csv.sha256, out.sha256
//      node build-truth.mjs --disputes lists every row where A and B differ or either says ?
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCsv } from './csv.mjs';

const VENDORS = ['grafana', 'nocodb', 'radarr', 'cloudsmith', 'invoiceninja'];
const PROVIDER = { grafana: 'grafana.com', nocodb: 'nocodb.com', radarr: 'radarr.video', cloudsmith: 'cloudsmith.io', invoiceninja: 'invoiceninja.com' };
const sha = (b) => createHash('sha256').update(b).digest('hex');

// a, b: { cls, conf, reason } or undefined. A row is disputed when the
// classes differ or either labeller says ?.
export function isDisputed(a, b) {
  return a.cls !== b.cls || a.cls === '?' || b.cls === '?';
}

// ops: array of op rows (arrays); A, B: Map id -> { cls, conf, reason }.
// Returns the disputed rows in ops order as { op, a, b }.
export function findDisputes(ops, A, B) {
  const out = [];
  for (const op of ops) {
    const a = A.get(op[0]), b = B.get(op[0]);
    if (!a || !b) throw new Error('missing label ' + op[0]);
    if (isDisputed(a, b)) out.push({ op, a, b });
  }
  return out;
}

export function loadLabels(text) {
  const m = new Map();
  for (const r of parseCsv(text).slice(1).filter((r) => r.length > 1)) m.set(r[0], { cls: r[1], conf: r[2], reason: r[3] });
  return m;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  const die = (m) => { console.error('FAIL: ' + m); process.exit(1); };
  const disputesMode = process.argv.includes('--disputes');

  const opsBuf = readFileSync(join(root, 'ops.csv'));
  const want = readFileSync(join(root, 'ops.csv.sha256'), 'utf8').trim().split(/\s+/)[0];
  if (sha(opsBuf) !== want) die('ops.csv sha256 mismatch');
  const all = parseCsv(opsBuf.toString('utf8'));
  const hdr = all[0];
  const ops = all.slice(1).filter((r) => r.length > 1);
  if (ops.length !== 1588) die('ops rows ' + ops.length);
  const iProv = hdr.indexOf('provider');

  const A = new Map(), B = new Map();
  for (const v of VENDORS) {
    const ids = ops.filter((r) => r[iProv] === PROVIDER[v]).map((r) => r[0]);
    for (const [side, map] of [['A', A], ['B', B]]) {
      const rows = parseCsv(readFileSync(join(here, 'out', `${side}-${v}.csv`), 'utf8')).slice(1).filter((r) => r.length > 1);
      if (rows.length !== ids.length) die(`${side}-${v} rows ${rows.length} != ${ids.length}`);
      rows.forEach((r, i) => {
        if (r[0] !== ids[i]) die(`${side}-${v} row ${i} id ${r[0]} != ${ids[i]}`);
        if (!/^[rwx?]$/.test(r[1])) die(`${side}-${v} ${r[0]} label '${r[1]}'`);
        map.set(r[0], { cls: r[1], conf: r[2], reason: r[3] });
      });
    }
  }

  const disputes = findDisputes(ops, A, B);
  if (disputesMode) {
    const iM = hdr.indexOf('method'), iP = hdr.indexOf('path'), iS = hdr.indexOf('summary'), iD = hdr.indexOf('description');
    for (const { op, a, b } of disputes) {
      console.log(`=== ${op[0]} | ${op[iProv]} | ${op[iM]} ${op[iP]}`);
      console.log(`summary: ${op[iS]}`);
      console.log(`description: ${op[iD]}`);
      console.log(`A: ${a.cls} / ${a.conf} / ${a.reason}`);
      console.log(`B: ${b.cls} / ${b.conf} / ${b.reason}`);
      console.log('');
    }
    console.log(`disputes: ${disputes.length} of ${ops.length}`);
    return;
  }

  const rulings = new Map();
  for (const r of parseCsv(readFileSync(join(here, 'rulings.csv'), 'utf8')).slice(1).filter((r) => r.length > 1)) {
    if (!/^[rwx]$/.test(r[1])) die('bad ruling ' + r[0]);
    if (rulings.has(r[0])) die('duplicate ruling ' + r[0]);
    rulings.set(r[0], { ruling: r[1], a: r[2], b: r[3] });
  }

  let agreed = 0, ruled = 0;
  const seen = new Set();
  const out = ['id,label'];
  for (const r of ops) {
    const id = r[0], a = A.get(id), b = B.get(id);
    let label;
    if (!isDisputed(a, b)) {
      if (rulings.has(id)) die('ruling on an agreement ' + id);
      label = a.cls; agreed++;
    } else {
      const ru = rulings.get(id);
      if (!ru) die('disputed row without ruling ' + id);
      if (ru.a !== a.cls || ru.b !== b.cls) die(`ruling a/b mismatch ${id}: files ${a.cls}/${b.cls}, ruling ${ru.a}/${ru.b}`);
      label = ru.ruling; ruled++; seen.add(id);
    }
    out.push(`${id},${label}`);
  }
  for (const id of rulings.keys()) if (!seen.has(id)) die('unused ruling ' + id);

  const body = out.join('\n') + '\n';
  writeFileSync(join(root, 'truth.csv'), body);
  writeFileSync(join(root, 'truth.csv.sha256'), `${sha(Buffer.from(body))}  truth.csv\n`);
  const lines = [];
  for (const f of readdirSync(join(here, 'out')).filter((f) => f.endsWith('.csv')).sort()) lines.push(`${sha(readFileSync(join(here, 'out', f)))}  out/${f}`);
  lines.push(`${sha(readFileSync(join(here, 'rulings.csv')))}  rulings.csv`);
  writeFileSync(join(here, 'out.sha256'), lines.join('\n') + '\n');
  console.log(`rows ${ops.length}, agreed ${agreed}, ruled ${ruled}`);
  console.log('truth sha256 ' + sha(Buffer.from(body)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
