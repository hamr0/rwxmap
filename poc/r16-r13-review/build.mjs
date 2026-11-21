import { readFileSync, writeFileSync } from 'node:fs';
const A = '/home/hamr/PycharmProjects/rwxlite/data/r16/review/r13-suggestions-for-rwxmap.csv';
const B = new URL('./rows-numbered.txt', import.meta.url).pathname;
const OUT = new URL('./answers.csv', import.meta.url).pathname;
const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };

function parseCsv(s) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const parsed = parseCsv(readFileSync(A, 'utf8'));
const hdr = parsed[0];
const iId = hdr.indexOf('r13_row_id'), iLab = hdr.indexOf('r13_label');
if (iId < 0 || iLab < 0) fail('A missing columns');
const data = parsed.slice(1);
if (data.length !== 359) fail(`A has ${data.length} rows, expected 359`);
const label = new Map(); const order = [];
for (const r of data) {
  if (label.has(r[iId])) fail('duplicate id in A: ' + r[iId]);
  label.set(r[iId], r[iLab]); order.push(r[iId]);
}

const bl = readFileSync(B, 'utf8').split('\n').filter((l) => l !== '');
if (bl.length !== 359) fail(`B has ${bl.length} lines, expected 359`);
const idOf = new Map();
for (const l of bl) {
  const p = l.split('|'); const n = Number(p[0]);
  if (!label.has(p[1])) fail(`N ${n} maps to id ${p[1]} not in A`);
  idOf.set(n, p[1]);
}

const seen = new Set(); const dec = new Map(); const errs = [];
function add(ns, letter, basis, cert, check) {
  for (const n of ns) {
    if (!idOf.has(n)) { errs.push(`N ${n} not in B`); continue; }
    if (seen.has(n)) { errs.push(`N ${n} listed twice`); continue; }
    seen.add(n);
    if (check && label.get(idOf.get(n)) === letter) errs.push(`N ${n}: To ${letter} equals existing r13_label`);
    dec.set(n, { letter, basis, cert });
  }
}
const KD = 'kept: could be either; tighter class stands (doubt rule)';
const KL = 'kept: reads as w; bge x not supported by the text';
// To x, sure
add([3], 'x', 'DELETE is x and revokes a URL (BRIEF-v4 methods + b)', 'sure', 1);
add([6], 'x', 'returns authorization tokens (D141 a; token create)', 'sure', 1);
add([72], 'x', 'workflow extension endpoint config (D141 d)', 'sure', 1);
add([78], 'x', 'secret manager source config (D141 d)', 'sure', 1);
add([83], 'x', "sets a user's SSH public key (D141 d key upload)", 'sure', 1);
add([86], 'x', 'registers a client and hands out its secret (g)', 'sure', 1);
add([89], 'x', 'bans a member from a group (D141 e)', 'sure', 1);
add([90], 'x', 'subscribes user to a stream, adds membership (g)', 'sure', 1);
add([104], 'x', "returns a token for all the user's data (token create)", 'sure', 1);
add([109], 'x', 'creates a credential (b/g)', 'sure', 1);
// To x, doubt
add([4, 9, 14, 19, 26, 37, 67, 68, 70, 71, 74, 76, 88, 91, 93, 98, 100, 102, 110, 116, 132, 133, 138, 143, 145, 146],
  'x', 'could be either; tighter class (BRIEF-v4 doubt rule)', 'doubt', 1);
// To w, doubt
add([2], 'w', 'text says marks user active though deprecated; tighter class (doubt rule)', 'doubt', 1);
// To r, sure
add([13, 15, 20, 21, 22, 23, 24, 25, 28, 29, 30, 31, 32, 33, 36, 42, 45, 46, 49, 50, 51, 53, 54, 57, 58],
  'r', 'GET; text names no change (BRIEF-v4 methods)', 'sure', 1);
add([168, 169, 170, 172, 173, 174, 175, 176, 177], 'r', 'POST returns a generated answer, nothing stored (BRIEF-v4 i)', 'sure', 1);
// To w, sure
add([181], 'w', 'plain create of a group (ii)', 'sure', 1);
add([194, 215, 217, 228, 240, 243, 290, 301, 310, 314], 'w', 'plain edit or set (iii)', 'sure', 1);
add([209, 234], 'w', 'toggle with a named opposite (BRIEF-v4 w list)', 'sure', 1);
add([211, 219, 220, 230, 247, 257, 291, 306], 'w', 'plain create (ii)', 'sure', 1);
add([232, 304], 'w', 'comment, w (BRIEF-v4 comment rule)', 'sure', 1);
add([245, 248, 265], 'w', 'restart or reboot is w (D136)', 'sure', 1);
// kept, no letter check
const keep = (ns, basis, cert) => {
  for (const n of ns) {
    if (!idOf.has(n)) { errs.push(`N ${n} not in B`); continue; }
    if (seen.has(n)) { errs.push(`N ${n} listed twice`); continue; }
    seen.add(n); dec.set(n, { letter: null, basis, cert });
  }
};
keep([11, 27, 38, 43, 44, 47, 48, 55, 56, 59, 153, 164, 165, 171, 179, 187, 210, 214, 218, 241, 260, 267, 288, 294, 295, 336, 343, 344, 345], KD, 'doubt');
keep([7, 10, 69, 73, 75, 81, 108, 135, 136, 139, 140], KL, 'lean');
if (errs.length) fail('\n' + errs.join('\n'));

const q = (v) => (/[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
const out = ['r13_row_id,r13_label,rwxmap_letter,changed,basis,certainty'];
const pairs = {}, certs = {};
for (let n = 1; n <= 359; n++) {
  const id = idOf.get(n); const lab = label.get(id); const d = dec.get(n);
  const letter = d && d.letter ? d.letter : lab;
  const basis = d ? d.basis : 'label stands under BRIEF-v4 + D141';
  const cert = d ? d.cert : 'sure';
  const ch = letter !== lab;
  if (ch) pairs[`${lab}->${letter}`] = (pairs[`${lab}->${letter}`] || 0) + 1;
  certs[cert] = (certs[cert] || 0) + 1;
  out.push([id, lab, letter, ch ? 'yes' : 'no', basis, cert].map(q).join(','));
}
// A's order
const byId = new Map(out.slice(1).map((l) => [l.split(',')[0], l]));
const final = [out[0], ...order.map((id) => byId.get(id))];
writeFileSync(OUT, final.join('\n') + '\n');
console.log('changed by pair:', pairs);
console.log('by certainty:', certs);
console.log('total rows written:', final.length - 1);
