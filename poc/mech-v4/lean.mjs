// Lean mechanical-v4 runner: ops CSV in, id,class,rule,marker CSV out.
// Usage: node poc/mech-v4/lean.mjs <ops.csv> <out-dir>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { classifyRow } from './flow.js';

const HEADER = ['id', 'provider', 'method', 'path', 'operationId', 'summary', 'description'];
const CLASSES = new Set(['r', 'w', 'x']);
const MARKERS = new Set(['tight', 'loose', 'settled']);

/** Strict RFC 4180 reader: returns arrays of fields; throws on an unterminated quote. */
export function parseRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (inQ) throw new Error('unterminated quoted field');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const q = (v) => (/[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);

function fail(msg) {
  console.error('lean: ' + msg);
  process.exit(1);
}

function main() {
  const [inPath, outDir] = process.argv.slice(2);
  if (!inPath || !outDir) fail('usage: node poc/mech-v4/lean.mjs <ops.csv> <out-dir>');
  const buf = fs.readFileSync(inPath);
  let rows;
  try { rows = parseRows(buf.toString('utf8')); } catch (e) { fail(e.message); }
  if (!rows.length || rows[0].join(',') !== HEADER.join(',')) fail('wrong header, expected ' + HEADER.join(','));
  const ids = new Set();
  const out = [];
  const byClass = {}, byRule = {}, byMarker = {}, byRM = {};
  const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (let i = 1; i < rows.length; i++) {
    const f = rows[i];
    if (f.length === 1 && f[0] === '') continue; // blank line
    if (f.length !== HEADER.length) fail(`line-record ${i + 1}: ${f.length} fields, expected ${HEADER.length}`);
    const [id, , method, p, operationId, summary, description] = f;
    if (ids.has(id)) fail(`duplicate id ${id}`);
    ids.add(id);
    const v = classifyRow({ method, path: p, operationId, summary, description });
    if (!CLASSES.has(v.class)) fail(`id ${id}: bad class ${v.class}`);
    if (!MARKERS.has(v.review)) fail(`id ${id}: bad marker ${v.review}`);
    if (!v.rule) fail(`id ${id}: empty rule`);
    out.push([id, v.class, v.rule, v.review].map(q).join(','));
    inc(byClass, v.class); inc(byRule, v.rule); inc(byMarker, v.review); inc(byRM, v.rule + ' x ' + v.review);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const csv = ['id,class,rule,marker', ...out].join('\n') + '\n';
  fs.writeFileSync(path.join(outDir, 'lean.csv'), csv);
  const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
  fs.writeFileSync(path.join(outDir, 'lean.csv.sha256'), sha(csv) + '  lean.csv\n');
  const sect = (t, o) => `\n${t}\n` + Object.keys(o).sort().map((k) => `  ${k}\t${o[k]}`).join('\n') + '\n';
  const counts = `input sha256\t${sha(buf)}\ntotal rows\t${out.length}\n`
    + sect('by class', byClass) + sect('by rule', byRule) + sect('by marker', byMarker) + sect('by rule x marker', byRM);
  fs.writeFileSync(path.join(outDir, 'lean-counts.txt'), counts);
  process.stdout.write(counts);
}

if (import.meta.url === new URL(process.argv[1], 'file://' + process.cwd() + '/').href) main();
