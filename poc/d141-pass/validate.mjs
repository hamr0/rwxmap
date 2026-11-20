import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

// RFC4180-ish parser (copied approach: quoted cells, doubled quotes, CRLF or LF)
export function parseCsv(text) {
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

if (import.meta.url === 'file://' + process.argv[1]) {
  let bad = 0;
  console.log('part rows r w x sure likely unsure distinctReasons errors');
  for (let p = 1; p <= 13; p++) {
    const n = String(p).padStart(2, '0');
    const b = parseCsv(readFileSync(join(here, 'blind', `part-${n}.csv`), 'utf8'));
    const o = parseCsv(readFileSync(join(here, 'out', `part-${n}.csv`), 'utf8'));
    const errs = [];
    const err = (m) => { if (errs.length < 5) errs.push(m); errs.n = (errs.n || 0) + 1; };
    if (o[0].join(',') !== 'id,letter,confidence,reason') err('header ' + o[0].join(','));
    const body = o.slice(1);
    if (body.length !== b.length - 1) err(`rows ${body.length} vs blind ${b.length - 1}`);
    const L = { r: 0, w: 0, x: 0 }, C = { sure: 0, likely: 0, unsure: 0 }, R = new Set();
    body.forEach((r, k) => {
      if (r.length !== 4) err(`row ${k + 2} has ${r.length} cols`);
      if (b[k + 1] && r[0] !== b[k + 1][0]) err(`row ${k + 2} id ${r[0]} != blind ${b[k + 1][0]}`);
      if (!(r[1] in L)) err(`row ${k + 2} letter ${r[1]}`); else L[r[1]]++;
      if (!(r[2] in C)) err(`row ${k + 2} conf ${r[2]}`); else C[r[2]]++;
      if (!r[3] || !r[3].trim()) err(`row ${k + 2} empty reason`); else R.add(r[3]);
    });
    if (errs.n) bad++;
    console.log(`${n} ${body.length} ${L.r} ${L.w} ${L.x} ${C.sure} ${C.likely} ${C.unsure} ${R.size} ${errs.n ? 'ERRORS(' + errs.n + '): ' + errs.join('; ') : 'none'}`);
  }
  process.exit(bad ? 1 : 0);
}
