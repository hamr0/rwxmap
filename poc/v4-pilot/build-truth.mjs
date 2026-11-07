// Builds truth-v4.csv for the D137 pilot: labellers' agreed label, else the ruling.
//   node poc/v4-pilot/build-truth.mjs   (exits 1 if any row is neither agreed nor ruled)
import fs from 'node:fs';
import crypto from 'node:crypto';

const dir = new URL('../../data/pilot-v4-2026-11-05/', import.meta.url).pathname;
const rows = (f) => fs.readFileSync(dir + f, 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
const A = new Map(rows('labels-A.csv').map((r) => [r[0], r[1]]));
const B = new Map(rows('labels-B.csv').map((r) => [r[0], r[1]]));
const R = new Map(rows('rulings.csv').map((r) => [r[0], r[1]]));
const key = [...A.keys()]; // pilot-key.csv has multiline fields; labels-A fixes the row order
if (key.length !== 200 || key.length !== B.size || key.some((k) => !B.has(k))) { console.error("A and B row sets differ or not 200"); process.exit(1); }

const out = ['pilot_id,label,source'];
const n = { agreed: 0, ruled: 0 };
const cls = { x: 0, w: 0 };
let bad = 0;
for (const id of key) {
  const a = A.get(id), b = B.get(id), r = R.get(id);
  let label, src;
  if (a && a === b && (a === 'x' || a === 'w')) { label = a; src = 'agreed'; }
  else if (r === 'x' || r === 'w') { label = r; src = 'ruled'; }
  else { console.error(`unresolved ${id}: A=${a} B=${b} ruling=${r}`); bad++; continue; }
  n[src]++; cls[label]++;
  out.push(`${id},${label},${src}`);
}
if (bad) process.exit(1);
const body = out.join('\n') + '\n';
fs.writeFileSync(dir + 'truth-v4.csv', body);
fs.writeFileSync(dir + 'truth-v4.csv.sha256', `${crypto.createHash('sha256').update(body).digest('hex')}  truth-v4.csv\n`);
console.log(`rows ${key.length}; agreed ${n.agreed}; ruled ${n.ruled}; x ${cls.x}; w ${cls.w}`);
