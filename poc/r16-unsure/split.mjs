import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseCsv, toObjects, enc, fmtRow } from './csv.mjs';
const IN = '/home/hamr/PycharmProjects/rwxlite/data/r16/labels/sonnet-recheck/unsure-for-rwxmap.csv';
const SHA = '5605d483af259d87d240e4fc401057d78ec3ae641b015fdf1c4d2a6f66f25973';
const die = m => { console.error('FAIL: ' + m); process.exit(1); };
const buf = fs.readFileSync(IN);
if (crypto.createHash('sha256').update(buf).digest('hex') !== SHA) die('input sha256 mismatch');
const rows = toObjects(parseCsv(buf.toString('utf8')));
const train = rows.filter(r => r.part === 'train'), dev = rows.filter(r => r.part === 'dev');
if (rows.length !== 3853 || train.length !== 3791 || dev.length !== 62) die(`counts ${rows.length}/${train.length}/${dev.length}`);
if (new Set(rows.map(r => r.op_id)).size !== rows.length) die('op_ids not unique');
const here = new URL('.', import.meta.url).pathname;
const w = (f, s) => fs.writeFileSync(here + f, s);
w('dev-rows-numbered.txt', dev.map((r, i) => fmtRow(i + 1, r, `sonnet: ${r.sonnet_letter} — ${r.sonnet_reason}`)).join('\n'));
console.log('dev-rows-numbered.txt: 62 rows');
const H = ['op_id', 'method', 'path', 'operationId', 'summary', 'description'];
const N = 8, base = Math.floor(train.length / N), extra = train.length % N;
let pos = 0;
for (let p = 0; p < N; p++) {
  const n = base + (p < extra ? 1 : 0), part = train.slice(pos, pos + n); pos += n;
  const name = `blind/part-${String(p + 1).padStart(2, '0')}.csv`;
  w(name, [H, ...part.map(r => H.map(h => r[h]))].map(r => r.map(enc).join(',')).join('\n') + '\n');
  console.log(`${name}: ${n} rows`);
}
w('train-sonnet.csv', [['op_id', 'sonnet_letter', 'sonnet_reason'], ...train.map(r => [r.op_id, r.sonnet_letter, r.sonnet_reason])].map(r => r.map(enc).join(',')).join('\n') + '\n');
console.log(`train-sonnet.csv: ${train.length} rows`);
