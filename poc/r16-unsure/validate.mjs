import fs from 'node:fs';
import { parseCsv } from './csv.mjs';
const die = m => { console.error('FAIL: ' + m); process.exit(1); };
const [outF, partF] = process.argv.slice(2);
if (!outF || !partF) die('usage: validate.mjs <out-file> <part-file>');
const out = parseCsv(fs.readFileSync(outF, 'utf8')).filter(r => r.length > 1 || r[0] !== '');
const part = parseCsv(fs.readFileSync(partF, 'utf8')).filter(r => r.length > 1 || r[0] !== '');
if (out[0].join(',') !== 'op_id,letter,confidence,reason') die('bad header: ' + out[0].join(','));
const o = out.slice(1), ids = part.slice(1).map(r => r[0]);
if (o.length !== ids.length) die(`row count ${o.length} vs part ${ids.length}`);
const cls = {}; let low = 0; const reasons = new Set();
o.forEach((r, i) => {
  if (r.length !== 4) die(`row ${i + 1} has ${r.length} fields`);
  if (r[0] !== ids[i]) die(`row ${i + 1} op_id ${r[0]} expected ${ids[i]} (missing, extra or out of order)`);
  if (!['r', 'w', 'x'].includes(r[1])) die(`row ${i + 1} invalid letter '${r[1]}'`);
  if (!['high', 'low'].includes(r[2])) die(`row ${i + 1} invalid confidence '${r[2]}'`);
  cls[r[1]] = (cls[r[1]] || 0) + 1; if (r[2] === 'low') low++; reasons.add(r[3]);
});
console.log(`OK ${o.length} rows; classes ${JSON.stringify(cls)}; low ${low}; distinct reasons ${reasons.size}`);
