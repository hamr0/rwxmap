import fs from 'node:fs';
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
      f += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(f); f = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
    f += c; i++;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const hdr = rows.shift();
  return rows.filter(r => r.length > 1 || r[0] !== '').map(r => Object.fromEntries(hdr.map((h, k) => [h, r[k] ?? ''])));
}
const esc = v => /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
const die = m => { console.error('FAIL: ' + m); process.exit(1); };
const tally = (arr, fn) => { const o = {}; for (const a of arr) { const k = fn(a); o[k] = (o[k] || 0) + 1; } return o; };
const B = '/home/hamr/PycharmProjects/rwxlite/data/r16/labels/sonnet-recheck/';
const D = parseCsv(fs.readFileSync(B + 'd143-dev-candidates-for-rwxmap.csv', 'utf8'));
if (D.length !== 9) die('D rows ' + D.length);
if (new Set(D.map(r => r.op_id)).size !== 9) die('duplicate op_ids');
const have = new Set(D.map(r => r.op_id));
const bk = 'creating a booking or reservation is x (D143)';
const dh = 'could be either; tighter class (doubt rule): published review';
const ov = new Map([
  ['r16-ae3120462bd3aa55', ['x', 'sure', bk]],
  ['r16-c39e26b424140bae', ['x', 'sure', bk]],
  ['r16-cccde52f00e43097', ['x', 'sure', bk]],
  ['r16-21e3c0cd62cf0dfc', ['x', 'doubt', dh]],
  ['r16-c8b62ef10bb34d6e', ['x', 'doubt', dh]],
  ['r16-3c17075f0c0cab2b', ['x', 'doubt', 'could be either; tighter class (doubt rule): money hold (pending payment record)']],
  ['r16-87159d6bbb34c937', ['x', 'doubt', 'reserved version is never reusable, even after deletion: cannot be put back']],
  ['r16-c076e7d08e1fa7a5', ['w', 'lean', 'package identity reservation is an internal hold (D143 scope)']],
]);
for (const [id, [l]] of ov) {
  if (!have.has(id)) die('override op_id missing: ' + id);
  const r = D.find(x => x.op_id === id);
  if (l === 'x' && r.label === 'x') die(id + ' x override equals label');
}
const out = [['op_id', 'label', 'rwxmap_letter', 'changed', 'basis', 'certainty']]; const recs = [];
for (const r of D) {
  let letter = r.label, basis = 'not a booking or reservation create (D143 scope); label stands under BRIEF-v4', cert = 'sure';
  const o = ov.get(r.op_id);
  if (o) { [letter, cert, basis] = o; }
  recs.push({ label: r.label, letter, cert });
  out.push([r.op_id, r.label, letter, letter !== r.label ? 'yes' : 'no', basis, cert]);
}
fs.writeFileSync('answers-d143-dev.csv', out.map(r => r.map(esc).join(',')).join('\n') + '\n');
console.log('changed by pair:', tally(recs.filter(r => r.label !== r.letter), r => r.label + '->' + r.letter));
console.log('certainty:', tally(recs, r => r.cert));
console.log('total:', recs.length);
