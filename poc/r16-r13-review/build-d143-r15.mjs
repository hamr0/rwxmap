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
const D = parseCsv(fs.readFileSync(B + 'd143-r15-candidates-for-rwxmap.csv', 'utf8'));
const NL = fs.readFileSync('d143r15-rows-numbered.txt', 'utf8').split('\n').filter(l => l !== '');
if (D.length !== 237) die('D rows ' + D.length);
if (NL.length !== 237) die('M lines ' + NL.length);
if (new Set(D.map(r => r.op_id)).size !== 237) die('duplicate op_ids in D');
const dset = new Set(D.map(r => r.op_id));
const n2id = new Map();
for (const l of NL) { const p = l.split('|'); const n = +p[0]; if (!dset.has(p[1])) die('N ' + n + ' maps to id not in D: ' + p[1]); if (n2id.has(n)) die('dup N ' + n); n2id.set(n, p[1]); }
const A = [47, 66, 68, 70, 73, 74, 76, 77, 78, 79, 82, 84, 85, 88, 89, 92, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 107, 109, 112, 113, 115, 119, 120, 121, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 140, 145, 147, 148, 149, 150, 151, 153, 157, 159, 161, 165, 166, 169, 170, 172, 173, 174, 175, 176, 180, 181, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 194, 196, 197, 198, 199, 200, 203, 205, 206, 208, 214, 218, 219, 220, 221, 225, 227, 231, 236, 237];
const groups = [
  { name: 'A', l: 'x', c: 'sure', b: 'creating a booking or reservation is x (D143)', n: A },
  { name: 'A-lean', l: 'x', c: 'lean', b: 'reads as a customer booking or reservation create (D143)', n: [83, 87, 94, 110, 138, 210, 232] },
  { name: 'B-sure', l: 'x', c: 'sure', b: 'hands out a presigned URL, or commits money or ad spend (BRIEF-v4 d/g)', n: [56, 144, 154, 155, 228] },
  { name: 'B-doubt', l: 'x', c: 'doubt', b: 'could be either; tighter class (doubt rule): confirms a booking or commits money', n: [3, 59, 118, 152, 211, 217] },
  { name: 'C', l: 'w', c: 'sure', b: 'check-in is a w edit (BRIEF-v4 iii)', n: [48] },
  { name: 'D', l: 'r', c: 'sure', b: 'reads a booking; nothing changes (BRIEF-v4 i)', n: [71, 116] },
];
const ov = new Map();
for (const g of groups) for (const n of g.n) {
  if (!n2id.has(n)) die('N ' + n + ' not in M map');
  if (ov.has(n)) die('N ' + n + ' in two groups (' + ov.get(n).name + ', ' + g.name + ')');
  ov.set(n, g);
}
const id2n = new Map([...n2id].map(([n, id]) => [id, n]));
const out = [['op_id', 'label', 'rwxmap_letter', 'changed', 'basis', 'certainty']]; const recs = [];
for (const r of D) {
  const n = id2n.get(r.op_id); const g = ov.get(n);
  let letter = r.label, basis = 'not a booking or reservation create (D143 scope); label stands under BRIEF-v4', cert = 'sure';
  if (g) {
    if (g.l === r.label) die('N ' + n + ' group ' + g.name + ' letter ' + g.l + ' equals label ' + r.label);
    letter = g.l; basis = g.b; cert = g.c;
  }
  recs.push({ label: r.label, letter, cert });
  out.push([r.op_id, r.label, letter, letter !== r.label ? 'yes' : 'no', basis, cert]);
}
fs.writeFileSync('answers-d143-r15.csv', out.map(r => r.map(esc).join(',')).join('\n') + '\n');
console.log('changed by pair:', tally(recs.filter(r => r.label !== r.letter), r => r.label + '->' + r.letter));
console.log('by certainty:', tally(recs, r => r.cert));
console.log('total:', recs.length);
