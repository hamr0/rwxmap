import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
      cell += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(cell); cell = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
    cell += c; i++;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvLine = (a) => a.map(csvCell).join(',') + '\r\n';
const RANK = { r: 0, w: 1, x: 2 };

const lab = new Map();
for (let p = 1; p <= 13; p++) {
  const o = parseCsv(readFileSync(join(here, 'out', `part-${String(p).padStart(2, '0')}.csv`), 'utf8')).slice(1);
  for (const r of o) { if (lab.has(r[0])) throw new Error('dup labeller id ' + r[0]); lab.set(r[0], r); }
}
const cand = parseCsv(readFileSync(join(here, 'candidates.csv'), 'utf8')).slice(1);
if (cand.length !== lab.size) throw new Error(`candidates ${cand.length} != labelled ${lab.size}`);

let csv = csvLine(['id', 'split', 'families', 'old_label', 'labeller_letter', 'confidence', 'new_label', 'changed', 'reason']);
const cnt = { all: 0, move: {}, famMove: {}, split: {}, conf: {}, unsureKept: 0, lowerNA: 0, lowerFam: {} };
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
for (const c of cand) {
  const [id, split, fam, , , , , , old] = c;
  const l = lab.get(id); if (!l) throw new Error('no label for ' + id);
  const [, letter, conf, reason] = l;
  const nw = RANK[old] >= RANK[letter] ? old : letter; // tighten-only
  if (RANK[letter] < RANK[old]) { cnt.lowerNA++; for (const f of fam) bump(cnt.lowerFam, f + ' ' + old + '->' + letter); }
  const ch = nw !== old ? 1 : 0;
  csv += csvLine([id, split, fam, old, letter, conf, nw, ch, reason]);
  if (conf === 'unsure' && letter !== old) bump(cnt, 'unsureKept');
  if (ch) {
    cnt.all++; const mv = old + '->' + nw; bump(cnt.move, mv); bump(cnt.split, split + ' ' + mv); bump(cnt.conf, conf);
    for (const f of fam) bump(cnt.famMove, f + ' ' + mv);
  }
}
writeFileSync(join(here, 'merged.csv'), csv);
console.log('candidates', cand.length, 'changed', cnt.all, 'unsure rows where labeller differed from old', cnt.unsureKept);
console.log('moves', JSON.stringify(cnt.move, null, 1));
console.log('family x move (a row in several families counts in each)', JSON.stringify(cnt.famMove, null, 1));
console.log('split x move', JSON.stringify(cnt.split, null, 1));
console.log('changed by confidence', JSON.stringify(cnt.conf));
console.log('lowers not applied:', cnt.lowerNA);
console.log('lowers not applied by family x move (a row in several families counts in each)', JSON.stringify(cnt.lowerFam, null, 1));
