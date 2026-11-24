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
const H = parseCsv(fs.readFileSync(B + 'holdout400-for-rwxmap.csv', 'utf8'));
const S = parseCsv(fs.readFileSync(B + 'holdout400-sonnet-letters-for-rwxmap.csv', 'utf8'));
const NL = fs.readFileSync('h400-rows-numbered.txt', 'utf8').split('\n').filter(l => l !== '');
if (H.length !== 400) die('H rows ' + H.length);
if (S.length !== 400) die('S rows ' + S.length);
if (NL.length !== 400) die('N lines ' + NL.length);
if (new Set(H.map(r => r.op_id)).size !== 400) die('duplicate op_ids in H');
if (new Set(S.map(r => r.op_id)).size !== 400) die('duplicate op_ids in S');
const sm = new Map(S.map(r => [r.op_id, r]));
for (const r of H) if (!sm.has(r.op_id)) die('H op_id missing from S: ' + r.op_id);
const hset = new Set(H.map(r => r.op_id));
const n2id = new Map();
for (const l of NL) { const p = l.split('|'); const n = +p[0]; if (!hset.has(p[1])) die('N ' + n + ' maps to id not in H: ' + p[1]); if (n2id.has(n)) die('dup N ' + n); n2id.set(n, p[1]); }
const groups = [
  { l: null, c: 'lean', b: null, n: [33, 91, 119] },
  { l: 'x', c: 'sure', b: 'hands out a secret, token or presigned URL, or widens access (BRIEF-v4 g)', n: [116, 157, 209, 234, 236] },
  { l: 'x', c: 'doubt', b: 'could be either; tighter class (doubt rule)', n: [124, 149, 162, 166, 168, 172, 183, 191, 197, 204, 208, 226, 227, 237, 240, 242, 251, 255, 263, 264, 268, 272, 279] },
  { l: 'w', c: 'doubt', b: 'text may store a change; tighter class (doubt rule)', n: [71, 117] },
];
const ov = new Map();
for (const g of groups) for (const n of g.n) {
  if (ov.has(n)) die('N ' + n + ' in two override groups');
  if (!n2id.has(n)) die('override N ' + n + ' not in N map');
  ov.set(n, g);
}
const id2n = new Map([...n2id].map(([n, id]) => [id, n]));
const DEF = "Sonnet's letter agrees with BRIEF-v4 + D141 + D143";
const out = [['op_id', 'rwxmap_letter', 'basis', 'certainty']]; const recs = [];
for (const r of H) {
  const s = sm.get(r.op_id); const n = id2n.get(r.op_id); const g = ov.get(n);
  let letter = s.letter, basis = DEF, cert = s.confidence === 'unsure' ? 'sure'.replace('sure', 'lean') : 'sure';
  if (g) {
    cert = g.c;
    if (g.l) { if (g.l === s.letter) die('N ' + n + ' set letter ' + g.l + ' equals Sonnet letter'); letter = g.l; basis = g.b; }
  }
  recs.push({ from: s.letter, letter, cert });
  out.push([r.op_id, letter, basis, cert]);
}
fs.writeFileSync('answers-h400.csv', out.map(r => r.map(esc).join(',')).join('\n') + '\n');
console.log('changed by pair:', tally(recs.filter(r => r.from !== r.letter), r => r.from + '->' + r.letter));
console.log('by certainty:', tally(recs, r => r.cert));
console.log('by letter:', tally(recs, r => r.letter));
console.log('total:', recs.length);
