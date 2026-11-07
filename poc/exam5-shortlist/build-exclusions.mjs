// Build excluded-vendors.txt for exam #5 from rwxmap + rwxlite data. Read-only on both trees.
// Usage: node build-exclusions.mjs   -> writes excluded-vendors.txt next to this script
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOTS = [
  ['rwxmap', '/home/hamr/PycharmProjects/rwxmap/data'],
  ['rwxlite', '/home/hamr/PycharmProjects/rwxlite/data'],
  ['rwxmap-docs', '/home/hamr/PycharmProjects/rwxmap/docs'],
  ['rwxmap-poc', '/home/hamr/PycharmProjects/rwxmap/poc'],
  ['rwxlite-test', '/home/hamr/PycharmProjects/rwxlite/test'],
];
const KEYS = new Set(['aliases', 'provider', 'vendor', 'api_key', 'host', 'providers', 'repo']);
const names = new Map(); // name -> {sources:Set, first:string}
function add(name, src, file) {
  if (typeof name === 'string' && name.includes(';')) { name.split(';').forEach(n => add(n, src, file)); return; }
  if (typeof name !== 'string') return;
  name = name.trim().toLowerCase();
  if (!name || name.length > 80 || /\s/.test(name)) return;
  let e = names.get(name);
  if (!e) names.set(name, (e = { sources: new Set(), first: file }));
  e.sources.add(src);
}
function read(f) {
  let b = fs.readFileSync(f);
  if (f.endsWith('.gz')) b = zlib.gunzipSync(b);
  return b.toString('utf8');
}
function csvRows(text, wanted, cb) { // streaming-ish multi-line-quote aware parser; calls cb(fieldIdx->value) for wanted columns
  let i = 0, n = text.length, field = '', row = [], q = false, header = null, idx = [];
  const endRow = () => {
    row.push(field); field = '';
    if (!header) { header = row; idx = header.map((h, k) => (wanted.has(h.trim()) ? k : -1)).filter(k => k >= 0); }
    else for (const k of idx) if (row[k] !== undefined) cb(row[k]);
    row = [];
  };
  for (; i < n; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') endRow();
    else if (c !== '\r') field += c;
  }
  if (field || row.length) endRow();
}
function walkJson(o, src, file, depth = 0) {
  if (depth > 6 || o == null) return;
  if (Array.isArray(o)) { for (const v of o.slice(0, 5000)) { if (typeof v === 'string') add(v, src, file); else walkJson(v, src, file, depth + 1); } return; }
  if (typeof o === 'object') for (const [k, v] of Object.entries(o)) {
    if (KEYS.has(k) && typeof v === 'string') add(v, src, file);
    else if (KEYS.has(k) && Array.isArray(v)) v.forEach(x => add(x, src, file));
    else if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(k) && depth === 0) add(k, src, file); // top-level map keyed by vendor
    else walkJson(v, src, file, depth + 1);
  }
}
function walkDir(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory() && (e.name === 'exam4-shortlist' || e.name === 'exam5-shortlist')) continue;
    if (e.isDirectory()) { if (/specs/.test(e.name) || e.name === 'node_modules' || e.name === '.git') { out.push(p + '/'); continue; } walkDir(p, out); }
    else out.push(p);
  }
  return out;
}
const SKIP_BIG = /\.(npy|npz|pkl|onnx|parquet|safetensors|pt|bin|tar\.gz|log)$/;
for (const [proj, root] of ROOTS) {
  for (const f of walkDir(root)) {
    const rel = proj + ':' + path.relative(root, f);
    const src = proj + ':' + path.relative(root, f).split('/')[0];
    if (f.endsWith('/')) { // spec dirs: file names are vendors
      for (const s of fs.readdirSync(f)) add(s.replace(/\.(json|ya?ml|gz|META)(\.|$).*/i, '').replace(/__.*/, ''), src, rel);
      continue;
    }
    if (SKIP_BIG.test(f)) continue;
    const base = f.replace(/\.gz$/, '');
    try {
      if (base.endsWith('.csv')) csvRows(read(f), KEYS, v => add(v, src, rel));
      else if (base.endsWith('.jsonl')) { for (const l of read(f).split('\n')) { if (!l) continue; try { const o = JSON.parse(l); for (const k of KEYS) if (typeof o[k] === 'string') add(o[k], src, rel); } catch {} } }
      else if (base.endsWith('.json')) { if (fs.statSync(f).size < 60e6) walkJson(JSON.parse(read(f)), src, rel); }
      else if (path.basename(f) === 'providers.txt') read(f).split('\n').forEach(l => add(l, src, rel));
    } catch (e) { console.error('skip', rel, e.message); }
  }
}
// apis-guru spec file names (rwxmap corpus): vendors are the file stem before "__"
// (covered by the specs/ dir branch above)
// Hand-added: names in prose docs (locked split, exams, aliases). Source = the doc.
const HAND = [
  ['docs/logs/pre-registered-split-2026-09-18.md', 'auth0 cloudflare hubspot zendesk pagerduty dropbox shopify linear miro sentry github.com microsoft.com gitea.io appcenter.ms netbox.dev clearblade.com keycloak.local atlassian.com dracoon.team trello.com box.com gitlab.com launchdarkly.com azure.com'],
  ['rwxmap CLAUDE.md', 'okta docusign xero'],
  ['exam4 vendors (hand)', 'permit permit.io immich polar polarsource harbor goharbor zulip zulipchat chatwoot render onrender'],
  ['exam3 vendors (hand)', 'clerk neon supabase mux netbird ory novu'],
  ['data/exam3-2026-11-04/README.md aliases', 'clerk clerk.com neon neon.tech neon.com supabase mux netbird ory ory.com ory.sh oryapis.com novu novu.co'],
  ['brand aliases (hand)', 'hubapi hubspot hubspot.com atlassian bitbucket jira confluence trello statuspage opsgenie slack.com googleapis google gmail youtube gsuite azure microsoft office365 graph.microsoft.com aws amazonaws stripe twilio sendgrid github githubusercontent salesforce heroku digitalocean'],
];
for (const [src, list] of HAND) for (const n of list.split(/\s+/)) add(n, 'doc:' + src, src);
// SPLIT docs for count
const lines = [...names.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  .map(([n, e]) => `${n}\t${e.first}\t${[...e.sources].sort().join(',')}`);
fs.writeFileSync(path.join(HERE, 'excluded-vendors.txt'), lines.join('\n') + '\n');
const per = {};
for (const e of names.values()) for (const s of e.sources) per[s] = (per[s] || 0) + 1;
console.log('distinct names:', names.size);
for (const [s, c] of Object.entries(per).sort()) console.log(String(c).padStart(6), s);
