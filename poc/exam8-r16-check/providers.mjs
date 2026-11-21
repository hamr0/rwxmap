// Exam #8: name match of our 6 exam #8 vendors' aliases against the r16 github vendor file. Read-only.
// Multi-value cells are split on | ; , and whitespace (data check: only "|" is a real separator; the rest are incidental).
// match_type: exact (token == alias), label (alias is a whole-label sequence of the token, labels split on . : / @),
// segment (repo URL / fork parent path segment == alias), substring-only (alias inside a longer token; NOT a match).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCsv } from './csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHORT = path.join(HERE, '..', 'exam7-shortlist'); // data only (picked.tsv); aliases.json is local
const EXAM8 = new Set(['gitbook', 'baserow', 'looker', 'wekan', 'shortcut', 'bitrise']);
const R15 = '/home/hamr/PycharmProjects/rwxlite/data/r16';
const FILES = ['vendors-r16-github.csv'];
const COLS = ['vendor_key', 'vendor', 'keys_aliases', 'servers_domains', 'contact_domains', 'logo_domains', 'title_norms', 'repo_owners', 'fork_parents', 'repo_urls', 'repo_url'];
const PATH_COLS = new Set(['repo_urls', 'repo_url', 'fork_parents']);

const aliases = JSON.parse(fs.readFileSync(path.join(HERE, 'aliases.json'), 'utf8'));
const picked = fs.readFileSync(path.join(SHORT, 'picked.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t')).filter(([v]) => EXAM8.has(v));
const role = Object.fromEntries(picked.map(([v, r]) => [v, r]));
for (const v of Object.keys(aliases)) if (!role[v]) { console.error('FAIL: alias vendor not in picked.tsv: ' + v); process.exit(2); }
const A = []; // [vendor, alias, aliasLabels]
for (const [v, list] of Object.entries(aliases)) for (const a of list) A.push([v, a.toLowerCase(), a.toLowerCase().split('.')]);

const labelsOf = (t) => t.split(/[.:/@]/);
function hasSeq(labels, seq) {
  for (let i = 0; i + seq.length <= labels.length; i++) {
    let ok = true;
    for (let j = 0; j < seq.length; j++) if (labels[i + j] !== seq[j]) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}
function segments(t) { // path segments after stripping scheme://host/
  const s = t.replace(/^[a-z]+:\/\/[^/]*\//, '');
  return s.split('/').filter(Boolean);
}

export function matchToken(col, tok) {
  const t = tok.toLowerCase();
  const out = [];
  for (const [v, a, seq] of A) {
    let type = null;
    if (PATH_COLS.has(col)) {
      if (segments(t).includes(a)) type = 'segment';
    } else if (t === a) type = 'exact';
    else if (hasSeq(labelsOf(t), seq)) type = 'label';
    if (!type && t.includes(a)) type = 'substring-only';
    if (type) out.push({ v, a, type });
  }
  return out;
}

const q = (x) => { x = String(x ?? ''); return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };

function selftest() {
  const m = (c, t) => matchToken(c, t).map((x) => x.v + ':' + x.type).join(',');
  const checks = [
    [m('servers_domains', 'api.bitrise.io'), 'bitrise:exact'],
    [m('servers_domains', 'x.looker.com'), 'looker:label'],
    [m('vendor_key', 'shortcuts'), 'shortcut:substring-only'],
    [m('vendor_key', 'gitbook'), 'gitbook:exact'],
    [m('repo_urls', 'https://github.com/wekan/wekan'), 'wekan:segment'],
    [m('title_norms', 'baserowapp'), 'baserow:substring-only'],
  ];
  const bad = checks.filter(([g, w]) => !g.split(',').includes(w));
  console.log('selftest', bad.length ? 'FAIL ' + JSON.stringify(bad) : 'PASS');
  process.exit(bad.length ? 1 : 0);
}

async function main() {
  if (process.argv.includes('--selftest')) return selftest();
  const hits = ['file,row_vendor_key,column,value,our_vendor,our_role,match_type,alias'];
  const counts = {}; const lines = [];
  for (const f of FILES) {
    let rows = 0;
    const res = await readCsv(path.join(R15, f), (r) => {
      rows++;
      const rk = r.vendor_key ?? r.vendor ?? '';
      for (const col of COLS) {
        const cell = r[col]; if (!cell) continue;
        const seen = new Set();
        for (const tok of cell.split(/[|;,\s]+/)) {
          if (!tok) continue;
          for (const h of matchToken(col, tok)) {
            const dk = col + '\0' + tok + '\0' + h.v + '\0' + h.type;
            if (seen.has(dk)) continue; seen.add(dk);
            hits.push([f, rk, col, tok, h.v, role[h.v], h.type, h.a].map(q).join(','));
            const k = `${h.v}\t${f}\t${h.type}`; counts[k] = (counts[k] || 0) + 1;
          }
        }
      }
    });
    const present = COLS.filter((c) => res.header.includes(c));
    lines.push(`${f}: rows=${rows} ragged=${res.bad} header=${res.header.join('|')}`);
    lines.push(`  columns searched: ${present.join(', ')}`);
  }
  fs.writeFileSync(path.join(HERE, 'provider-hits.csv'), hits.join('\n') + '\n');
  lines.push('', 'our_vendor\tfile\tmatch_type\tcount (token hits; one per row x column x token x alias-match)');
  for (const k of Object.keys(counts).sort()) lines.push(`${k}\t${counts[k]}`);
  lines.push('', `total hit rows written: ${hits.length - 1}`);
  fs.writeFileSync(path.join(HERE, 'provider-summary.txt'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
