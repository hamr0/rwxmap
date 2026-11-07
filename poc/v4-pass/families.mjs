import fs from 'node:fs';
import { parseCsv, toCsv } from '../../tools/csv.js';

const D = 'data/pass-v4-2026-11-05/';
const OUT = D + 'suspects/disagree/';
const SEED = 20261112;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, seed) {
  const rnd = mulberry32(seed), a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const FAMILIES = [
  ['upload', 'upload'],
  ['credential', 'key apikey secret credential certificate cert token password passphrase csr'],
  ['access', 'role permission policy policie acl scope authorization authorizer authorize privilege access trust saml oauth oidc sso identity authenticator auth mapper claim conditional allowlist whitelist allowed'],
  ['membership', 'member membership requestor recipient assignment assign'],
  ['outside', 'webhook hook integration extension subscription subscribe notification connector connection target sink forwarder transport push feed datafeed export destination endpoint stream alarm'],
  ['session', 'session'],
  ['container', 'group team organization org project channel tenant repository cluster workspace'],
].map(([n, w]) => [n, w.split(' ')]);
const ORDER = [...FAMILIES.map((f) => f[0]), 'rest'];
const GROUPS = ['G01', 'G04', 'G06'];

function wordSet(text) {
  const parts = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.toLowerCase());
  const s = new Set();
  for (const w of parts) {
    s.add(w);
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 1) s.add(w.slice(0, -1));
  }
  return s;
}

const rows = parseCsv(fs.readFileSync(OUT + 'c-rows.csv', 'utf8'));
const key = new Map(parseCsv(fs.readFileSync(D + 'pass-key.csv', 'utf8')).map((r) => [r.pass_id, r]));
const son = new Map(parseCsv(fs.readFileSync(OUT + 'disagree-rows.csv', 'utf8')).map((r) => [r.row_id, r]));

const out = [];
for (const r of rows) {
  const k = key.get(r.pass_id), s = son.get(r.row_id);
  if (!k || !s) throw new Error('missing join for ' + r.row_id);
  const ws = wordSet([r.operationId, r.summary, k.path].join(' '));
  let family = 'rest', matched = '';
  for (const [name, list] of FAMILIES) {
    const m = list.find((w) => ws.has(w));
    if (m) { family = name; matched = m; break; }
  }
  out.push({
    row_id: r.row_id, pass_id: r.pass_id, group_id: r.group_id, family, matched_word: matched,
    provider: r.provider, method: r.method, operationId: r.operationId, summary: r.summary,
    sonnet_class: s.sonnet_class, sonnet_confidence: s.sonnet_confidence, sonnet_reason: s.sonnet_reason,
  });
}
const header = ['row_id', 'pass_id', 'group_id', 'family', 'matched_word', 'provider', 'method', 'operationId', 'summary', 'sonnet_class', 'sonnet_confidence', 'sonnet_reason'];
fs.writeFileSync(OUT + 'c-families.csv', toCsv(out, header));

const cnt = (f, g) => out.filter((r) => r.family === f && (!g || r.group_id === g)).length;
let md = '# c-rows families\n\n| family | ' + GROUPS.join(' | ') + ' | total |\n|---|' + '---|'.repeat(GROUPS.length + 1) + '\n';
for (const f of ORDER) md += `| ${f} | ${GROUPS.map((g) => cnt(f, g)).join(' | ')} | ${cnt(f)} |\n`;
md += `| total | ${GROUPS.map((g) => out.filter((r) => r.group_id === g).length).join(' | ')} | ${out.length} |\n`;

for (const f of ORDER) for (const g of GROUPS) {
  const sub = out.filter((r) => r.family === f && r.group_id === g);
  if (!sub.length) continue;
  md += `\n## ${f}/${g} (${sub.length} rows)\n\nTop matched words:\n\n`;
  const wc = new Map();
  for (const r of sub) { const w = r.matched_word || '(none)'; wc.set(w, (wc.get(w) || 0) + 1); }
  const top = [...wc].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 10);
  for (const [w, c] of top) md += `- ${w}: ${c}\n`;
  const pick = sub.length <= 12 ? sub : shuffle(sub, SEED).slice(0, 12);
  md += `\nRows (${pick.length} of ${sub.length}):\n\n`;
  for (const r of pick) {
    md += `- ${r.row_id} | ${r.provider} | ${r.method} | ${r.operationId} | ${r.summary.slice(0, 80)} | ${r.sonnet_class} (${r.sonnet_confidence}): ${r.sonnet_reason}\n`;
  }
}
fs.writeFileSync(OUT + 'c-families.md', md);
