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
const D = parseCsv(fs.readFileSync(B + 'd143-candidates-for-rwxmap.csv', 'utf8'));
const NL = fs.readFileSync('d143-rows-numbered.txt', 'utf8').split('\n').filter(l => l !== '');
if (D.length !== 526) die('D rows ' + D.length);
if (NL.length !== 526) die('M lines ' + NL.length);
if (new Set(D.map(r => r.op_id)).size !== 526) die('duplicate op_ids in D');
const dset = new Set(D.map(r => r.op_id));
const n2id = new Map();
for (const l of NL) { const p = l.split('|'); const n = +p[0]; if (!dset.has(p[1])) die('N ' + n + ' maps to id not in D: ' + p[1]); if (n2id.has(n)) die('dup N ' + n); n2id.set(n, p[1]); }
const A = [58, 68, 71, 73, 87, 90, 91, 92, 93, 94, 95, 96, 97, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 127, 128, 129, 132, 134, 135, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 166, 167, 168, 169, 170, 172, 177, 178, 179, 180, 181, 182, 183, 184, 185, 192, 193, 194, 195, 196, 197, 198, 199, 200, 202, 211, 215, 216, 218, 219, 220, 221, 222, 223, 225, 227, 228, 229, 230, 231, 232, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 281, 282, 283, 284, 285, 286, 287, 288, 293, 312, 313, 316, 317, 318, 322, 323, 324, 325, 326, 328, 329, 336, 337, 340, 341, 343, 345, 346, 347, 349, 350, 352, 354, 359, 364, 366, 367, 368, 369, 370, 371, 372, 374, 375, 378, 380, 383, 384, 386, 387, 400, 401, 403, 404, 407, 408, 410, 417, 421, 422, 425, 427, 428, 431, 432, 433, 434, 435, 437, 440, 441, 442, 443, 444, 447, 448, 449, 450, 451, 452, 453, 454, 455, 457, 458, 459, 460, 468, 469, 471, 472, 473, 474, 475, 477, 481, 483, 484, 487, 488, 489, 490, 491, 492, 495, 496, 497, 498, 500, 501, 505, 506, 507, 508, 515, 516, 517, 521, 523, 524];
const C = 'check-in, check-out or status change is a w edit (BRIEF-v4 iii)';
const groups = [
  { name: 'A', l: 'x', c: 'sure', b: 'creating a booking or reservation is x (D143)', n: A },
  { name: 'A-lean', l: 'x', c: 'lean', b: 'reads as a customer booking or reservation create (D143)', n: [163, 164, 201, 217, 226, 361, 373, 398, 402, 405, 420, 445, 446, 480, 486, 502] },
  { name: 'B-sure', l: 'x', c: 'sure', b: 'hands out a presigned URL or token, or moves money (BRIEF-v4 d/g)', n: [19, 26, 133, 145, 203, 357] },
  { name: 'B-doubt', l: 'x', c: 'doubt', b: 'could be either; tighter class (doubt rule): money/quote hold, upload URL, or published review', n: [130, 300, 513, 478, 86, 165, 190, 308, 309, 310, 351, 353, 382, 476] },
  { name: 'C-sure', l: 'w', c: 'sure', b: C, n: [16, 20, 24, 25, 27, 28, 29, 55, 56, 57, 63, 64] },
  { name: 'C-lean', l: 'w', c: 'lean', b: C, n: [45, 62] },
  { name: 'C-doubt', l: 'w', c: 'doubt', b: 'may sync or change state; tighter class (doubt rule)', n: [4] },
  { name: 'D-lean', l: 'r', c: 'lean', b: 'returns a snapshot; text says it creates nothing (BRIEF-v4 i)', n: [526] },
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
fs.writeFileSync('answers-d143.csv', out.map(r => r.map(esc).join(',')).join('\n') + '\n');
console.log('changed by pair:', tally(recs.filter(r => r.label !== r.letter), r => r.label + '->' + r.letter));
console.log('by certainty:', tally(recs, r => r.cert));
console.log('total:', recs.length);
