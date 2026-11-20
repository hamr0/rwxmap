// Streaming RFC 4180 CSV parser, char-level. Quoted fields may hold commas, quotes ("") and newlines.
import fs from 'node:fs';
import zlib from 'node:zlib';

export function createParser(onRow) {
  let field = '', row = [], inQ = false, afterQ = false, pendingCR = false;
  function endField() { row.push(field); field = ''; afterQ = false; }
  function endRow() { endField(); onRow(row); row = []; }
  function feed(s) {
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (pendingCR) { pendingCR = false; endRow(); if (c === '\n') continue; }
      if (inQ) {
        if (c === '"') { inQ = false; afterQ = true; } else field += c;
      } else if (afterQ && c === '"') { field += '"'; inQ = true; afterQ = false; }
      else if (c === '"' && field === '' && !afterQ) inQ = true;
      else if (c === ',') endField();
      else if (c === '\n') endRow();
      else if (c === '\r') pendingCR = true;
      else field += c;
    }
  }
  function end() {
    if (pendingCR) { pendingCR = false; endRow(); return; }
    if (inQ) throw new Error('csv: EOF inside quoted field');
    if (field !== '' || row.length) endRow();
  }
  return { feed, end };
}

// Calls onRecord(obj) per data row (keyed by header); ragged rows go to onBad(row, n).
// Returns {header, rows, bad}.
export async function readCsv(file, onRecord, onBad = () => {}) {
  let header = null, rows = 0, bad = 0, n = 0;
  const p = createParser((r) => {
    n++;
    if (!header) { header = r; return; }
    if (r.length === 1 && r[0] === '') return; // blank line
    if (r.length !== header.length) { bad++; onBad(r, n); return; }
    rows++;
    const o = {};
    for (let i = 0; i < header.length; i++) o[header[i]] = r[i];
    onRecord(o);
  });
  let stream = fs.createReadStream(file);
  if (file.endsWith('.gz')) stream = stream.pipe(zlib.createGunzip());
  stream.setEncoding('utf8');
  for await (const chunk of stream) p.feed(chunk);
  p.end();
  return { header, rows, bad };
}
