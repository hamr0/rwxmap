import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const A = '/home/hamr/PycharmProjects/rwxlite/data/r16/labels/sonnet-recheck/r15-suggestions-for-rwxmap.csv';
const B = join(here, 'r15-rows-numbered.txt');
const OUT = join(here, 'answers-r15.csv');

const errs = [];
const fail = (m) => errs.push(m);

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = ''; rows.push(row); row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const all = parseCsv(readFileSync(A, 'utf8'));
const hdr = all[0];
const data = all.slice(1).filter((r) => r.length > 1 || r[0] !== '');
const ix = (n) => hdr.indexOf(n);
const [iId, iLab, iSon] = [ix('op_id'), ix('r15_label'), ix('sonnet_letter')];
if (iId < 0 || iLab < 0 || iSon < 0) fail('A header missing columns: ' + hdr.join(','));
if (data.length !== 263) fail(`A has ${data.length} rows, expected 263`);
const byId = new Map();
for (const r of data) {
  if (byId.has(r[iId])) fail('duplicate op_id in A: ' + r[iId]);
  byId.set(r[iId], r);
}

const bLines = readFileSync(B, 'utf8').split('\n').filter((l) => l.trim() !== '');
if (bLines.length !== 263) fail(`B has ${bLines.length} lines, expected 263`);
const nToId = new Map();
for (const l of bLines) {
  const p = l.split('|');
  const n = Number(p[0]);
  if (!Number.isInteger(n) || n < 1 || n > 263) { fail('bad N in B line: ' + l.slice(0, 60)); continue; }
  if (nToId.has(n)) fail('duplicate N in B: ' + n);
  nToId.set(n, p[1]);
  if (!byId.has(p[1])) fail(`N ${n} maps to id not in A: ${p[1]}`);
}

// [mode, certainty, basis, Ns, letter?]
const G = [
  ['accept', 'sure', 'plain create, edit, toggle or save (BRIEF-v4 ii/iii)', '1,2,3,5,7,8,10,11,12,13,15,16,17,19,20,21,22,23,24,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40'],
  ['accept', 'lean', 'plain create, edit, toggle or save (BRIEF-v4 ii/iii)', '9,14,25'],
  ['accept', 'sure', 'text names an x thing (BRIEF-v4 a-g, D130, D141 a/b)', '41,42,44,45,46,47,48,49,50,51,52,53,55,58,59'],
  ['accept', 'doubt', 'could be either; tighter class (doubt rule)', '43,54,56,57'],
  ['accept', 'sure', 'POST that only reads or returns a generated answer (BRIEF-v4 i)', '61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,80,81,82,83,84,85,86,87,88,89,90'],
  ['accept', 'sure', 'text names an x thing (D141 a/b/e, g, secret, workflow run)', '91,92,93,99,100,101,102,103,105,106,109'],
  ['accept', 'doubt', 'could be either; tighter class (doubt rule)', '94,95,96,97,104,107,108,110,111,112'],
  ['accept', 'sure', 'read only; nothing handed out or changed (BRIEF-v4 methods, i)', '113,114,115,117,118,119,120,122,127,128,129,130,132,133,134,135,137,138,139,140,141'],
  ['accept', 'lean', 'read only; nothing handed out or changed (BRIEF-v4 methods, i)', '131,136'],
  ['accept', 'sure', 'plain create, edit, toggle, own-store import (BRIEF-v4 ii/iii)', '150,158,164,165,166,169,172,174,192,194,210,224,226,227,233,237,242,243,245,246,248,249,250,251,252,255,258'],
  ['accept', 'lean', 'plain create, edit, toggle, own-store import (BRIEF-v4 ii/iii)', '151,184,228'],
  ['accept', 'doubt', 'r or w; tighter of the two (doubt rule)', '177'],
  ['set', 'doubt', 'POST with no text; unsure is x (BRIEF-v4)', '4,6,18', 'x'],
  ['keep', 'sure', 'unattached security policy object is w (user ruling)', '98'],
  ['keep', 'sure', 'availability or token validity check is x (D141 b)', '116,142'],
  ['keep', 'sure', 'hands out an API key (secret)', '121'],
  ['keep', 'doubt', 'kept: text contradicts itself; tighter stands', '60,79'],
  ['keep', 'doubt', 'kept: could be either; tighter stands (doubt rule)', '123,124,125,126'],
  ['keep', 'sure', 'kept: text names an x thing (sends, publishes, money, job, access, ledger, permanent)', '143,145,152,153,159,175,176,183,185,189,196,197,199,208,209,215,217,223,232,235,236,238,239,240,259,262'],
  ['keep', 'doubt', 'kept: public post or article, publishes (BRIEF-v4 c) vs plain create (ii); pattern for user ruling', '149,154,162,167,168,170,187,190,195,203,206,207,231,241,244,254,261'],
  ['keep', 'doubt', 'kept: booking or reservation may commit to an outside party (BRIEF-v4 d); pattern for user ruling', '156,157,161,182,191,221,222'],
  ['keep', 'doubt', 'kept: POST with no text; unsure is x', '178,200,211,230'],
  ['keep', 'doubt', 'kept: could be either; tighter stands (doubt rule)', '144,146,147,148,155,160,163,171,173,179,180,181,186,188,193,198,201,202,204,205,212,213,214,216,218,219,220,225,229,234,247,253,256,257,260,263'],
];

const assigned = new Map();
const dups = new Set();
for (const g of G) {
  for (const s of g[3].split(',')) {
    const n = Number(s);
    if (assigned.has(n)) dups.add(n);
    assigned.set(n, g);
  }
}
const missing = [];
for (let n = 1; n <= 263; n++) if (!assigned.has(n)) missing.push(n);
if (missing.length) fail('Ns missing from groups: ' + missing.join(','));
if (dups.size) fail('Ns listed twice: ' + [...dups].join(','));
for (const n of assigned.keys()) if (n < 1 || n > 263) fail('N out of range: ' + n);

const q = (s) => (/[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
const out = ['op_id,r15_label,rwxmap_letter,changed,basis,certainty'];
const pairs = {}, cert = {};
if (!errs.length) {
  const idToN = new Map([...nToId].map(([n, id]) => [id, n]));
  for (const r of data) {
    const id = r[iId], lab = r[iLab], n = idToN.get(id);
    if (n === undefined) { fail('A op_id not in B: ' + id); continue; }
    const g = assigned.get(n);
    let letter;
    if (g[0] === 'accept') letter = r[iSon];
    else if (g[0] === 'keep') letter = lab;
    else letter = g[4];
    if (g[0] !== 'keep' && letter === lab) fail(`N ${n} (${g[0]}) letter ${letter} equals r15_label`);
    const changed = letter !== lab;
    if (changed) { const k = `${lab}->${letter}`; pairs[k] = (pairs[k] || 0) + 1; }
    cert[g[1]] = (cert[g[1]] || 0) + 1;
    out.push([id, lab, letter, changed ? 'yes' : 'no', g[2], g[1]].map(q).join(','));
  }
}

if (errs.length) {
  console.error('FAILED:\n' + errs.join('\n'));
  process.exit(1);
}
writeFileSync(OUT, out.join('\n') + '\n');
console.log('changed by pair:', pairs);
console.log('by certainty:', cert);
console.log('total rows:', out.length - 1);
