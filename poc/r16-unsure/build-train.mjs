// Builds answers-train.csv: rwxmap letters for the train rows of the r16 unsure set.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv, toObjects, enc } from './csv.mjs';

const die = (m) => { console.error('FATAL: ' + m); process.exit(1); };
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const EXC_OP = 'r16-8b5a7819e2fd7158';
const EXC_BASIS = 'rwxmap: generic proxy PUT is w (PATCH/PUT default), as other proxy rows';

const son = toObjects(parseCsv(rd('./train-sonnet.csv')));
const opus = new Map();
for (let i = 1; i <= 8; i++) {
  for (const r of toObjects(parseCsv(rd(`./out/O-0${i}.csv`)))) {
    if (opus.has(r.op_id)) die(`duplicate opus op ${r.op_id}`);
    opus.set(r.op_id, r);
  }
}
if (son.length !== 3791) die(`train rows ${son.length} != 3791`);
for (const s of son) if (!opus.has(s.op_id)) die(`no opus letter for ${s.op_id}`);

// N -> op_id
const nmap = new Map();
for (const line of rd('./disagree-numbered.txt').split('\n')) {
  const m = /^#(\d+) (\S+) \S+ /.exec(line);
  if (m) { if (nmap.has(+m[1])) die(`dup N ${m[1]}`); nmap.set(+m[1], m[2]); }
}
if (nmap.size !== 974) die(`disagree map has ${nmap.size} entries`);
const dis = new Set(son.filter((s) => opus.get(s.op_id).letter !== s.sonnet_letter).map((s) => s.op_id));
const mapped = new Set(nmap.values());
if (mapped.size !== 974 || dis.size !== 974 || [...dis].some((o) => !mapped.has(o))) die('disagreement set mismatch');

// rulings: last line wins
const rul = new Map();
for (const line of rd('./rulings-train.txt').split('\n')) {
  if (line.trim() === '' || line.startsWith('#')) continue;
  const m = /^(\d+) ([SDrwx])$/.exec(line.trim());
  if (!m) die(`malformed ruling line: ${line}`);
  const n = +m[1];
  if (n < 1 || n > 974) die(`N out of range: ${n}`);
  rul.set(n, m[2]);
}
const rulByOp = new Map([...rul].map(([n, v]) => [nmap.get(n), v]));

const out = ['op_id,sonnet_letter,rwxmap_letter,changed,basis,certainty'];
const letters = {}, pairs = {}, certs = {};
let toOpus = 0, toSonnet = 0, toLetter = 0, doubt = 0, excDone = false;
for (const s of son) {
  const o = opus.get(s.op_id);
  let L, cert = 'lean', basis;
  if (dis.has(s.op_id)) {
    const v = rulByOp.get(s.op_id);
    if (v === undefined) { L = o.letter; basis = `agrees with Opus: ${o.reason}`; toOpus++; }
    else if (v === 'D') { L = o.letter; cert = 'doubt'; basis = `agrees with Opus (doubt rule): ${o.reason}`; toOpus++; doubt++; }
    else if (v === 'S') { L = s.sonnet_letter; basis = `agrees with Sonnet: ${s.sonnet_reason}`; toSonnet++; }
    else { L = v; basis = `rwxmap ruling: ${v}; opus ${o.letter} (${o.reason}) sonnet ${s.sonnet_letter} (${s.sonnet_reason})`; toLetter++; }
  } else if (s.op_id === EXC_OP) {
    L = 'w'; basis = EXC_BASIS; excDone = true;
  } else { L = s.sonnet_letter; basis = `Opus and Sonnet agree: ${o.reason}`; }
  if (!['r', 'w', 'x'].includes(L)) die(`bad letter ${L} for ${s.op_id}`);
  const changed = L === s.sonnet_letter ? 'no' : 'yes';
  if (changed === 'yes') { const k = `${s.sonnet_letter}->${L}`; pairs[k] = (pairs[k] || 0) + 1; }
  letters[L] = (letters[L] || 0) + 1; certs[cert] = (certs[cert] || 0) + 1;
  out.push([s.op_id, s.sonnet_letter, L, changed, basis, cert].map(enc).join(','));
}
if (!excDone) die(`${EXC_OP} is not an agreeing row`);
writeFileSync(new URL('./answers-train.csv', import.meta.url), out.join('\n') + '\n');
console.log(`rows: ${son.length}`);
console.log('letters:', JSON.stringify(letters));
console.log('changes by pair:', JSON.stringify(pairs));
console.log('certainty:', JSON.stringify(certs));
console.log(`disagreement rows -> opus ${toOpus}, sonnet ${toSonnet}, explicit letter ${toLetter}`);
console.log(`doubt: ${doubt}`);
