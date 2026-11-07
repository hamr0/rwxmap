// Validates one labeller file against its blind part. Run: node validate.mjs <file> <vendor>
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseCsv } from './csv.mjs';

export const VENDORS = ['front', 'planetscale', 'paddle', 'hookdeck', 'fusionauth', 'semaphore', 'weaviate'];

// Returns { errors: [...], counts, unsure, low, distinct, rows }.
export function validate(fileText, partText) {
  const errors = [];
  const ids = parseCsv(partText).slice(1).filter((r) => r.length > 1).map((r) => r[0]);
  const rows = parseCsv(fileText);
  const hdr = rows.shift() || [];
  if (hdr.join(',') !== 'row_id,truth_class,confidence,reason') errors.push('bad header: ' + hdr.join(','));
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  if (rows.length !== ids.length) errors.push(`row count ${rows.length} != ${ids.length}`);
  const counts = { r: 0, w: 0, x: 0, '?': 0 };
  let low = 0; const reasons = new Set();
  rows.forEach((r, i) => {
    if (r.length !== 4) { errors.push(`row ${i + 1}: ${r.length} columns`); return; }
    if (i < ids.length && r[0] !== ids[i]) errors.push(`row ${i + 1}: id ${r[0]} != ${ids[i]}`);
    if (!Object.hasOwn(counts, r[1])) errors.push(`${r[0]}: truth_class '${r[1]}'`); else counts[r[1]]++;
    if (r[2] !== 'high' && r[2] !== 'low') errors.push(`${r[0]}: confidence '${r[2]}'`); else if (r[2] === 'low') low++;
    if (r[3].trim() === '') errors.push(`${r[0]}: empty reason`); else reasons.add(r[3].trim());
  });
  return { errors, counts, unsure: counts['?'], low, distinct: reasons.size, rows: rows.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [file, vendor] = process.argv.slice(2);
  if (!file || !VENDORS.includes(vendor)) { console.error('usage: node validate.mjs <file> <' + VENDORS.join('|') + '>'); process.exit(2); }
  const here = dirname(fileURLToPath(import.meta.url));
  const res = validate(readFileSync(file, 'utf8'), readFileSync(join(here, 'blind', `part-${vendor}.csv`), 'utf8'));
  const c = res.counts;
  console.log(`${vendor}: rows ${res.rows} r ${c.r} w ${c.w} x ${c.x} ? ${c['?']} low ${res.low} distinct-reasons ${res.distinct}`);
  if (res.errors.length) {
    for (const e of res.errors.slice(0, 20)) console.error('FAIL: ' + e);
    if (res.errors.length > 20) console.error(`... ${res.errors.length - 20} more`);
    process.exit(1);
  }
}
