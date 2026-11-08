// Fetch each candidate spec (name<TAB>url in candidates.tsv) into SCRATCH, parse it, count deduped ops.
// Usage: node fetch-and-count.mjs [--cached] [name ...]   (writes results.json beside this file)
// Dedupe key = METHOD + path with every {param} collapsed to {} (same as exam #3). Specs are untrusted data: only parsed, never executed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH = '/home/hamr/PycharmProjects/rwxmap/.claude/scratchpad/exam6';
const { parse: parseYaml } = await import(pathToFileURL('/home/hamr/PycharmProjects/rwxmap/node_modules/yaml/dist/index.js').href);
const args = process.argv.slice(2);
const cached = args.includes('--cached');
const only = args.filter(a => !a.startsWith('--'));
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace', 'query'];
const rows = fs.readFileSync(path.join(HERE, 'candidates.tsv'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
fs.mkdirSync(SCRATCH, { recursive: true });

async function get(url) {
  const ctl = AbortSignal.timeout(60000);
  const r = await fetch(url, { redirect: 'follow', signal: ctl, headers: { 'user-agent': 'spec-survey/1', accept: 'application/json, application/yaml, */*' } });
  let buf = Buffer.from(await r.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  return { status: r.status, finalUrl: r.url, buf };
}
function analyse(buf) {
  const text = buf.toString('utf8');
  let doc, fmt;
  try { doc = JSON.parse(text); fmt = 'json'; } catch { doc = parseYaml(text, { maxAliasCount: -1 }); fmt = 'yaml'; }
  if (!doc || typeof doc !== 'object' || !doc.paths) throw new Error('no paths object');
  const ver = doc.openapi ? 'openapi ' + doc.openapi : doc.swagger ? 'swagger ' + doc.swagger : 'unknown';
  const seen = new Set(); const mix = {}; let raw = 0, noOpId = 0, noSum = 0, dep = 0;
  for (const [p, item] of Object.entries(doc.paths)) {
    if (!item || typeof item !== 'object') continue;
    for (const m of METHODS) {
      const op = item[m]; if (!op || typeof op !== 'object') continue;
      raw++;
      const key = m.toUpperCase() + ' ' + p.replace(/\{[^}]*\}/g, '{}');
      if (seen.has(key)) continue; seen.add(key);
      const M = m.toUpperCase(); mix[M] = (mix[M] || 0) + 1;
      if (!op.operationId) noOpId++; if (!op.summary) noSum++; if (op.deprecated) dep++;
    }
  }
  return { fmt, ver, title: doc.info?.title, infoVersion: doc.info?.version, servers: (doc.servers || []).slice(0, 2).map(s => s.url), host: doc.host, raw, deduped: seen.size, mix, noOpId, noSum, deprecated: dep };
}
const out = [];
for (const [name, url] of rows) {
  if (only.length && !only.includes(name)) continue;
  const f = path.join(SCRATCH, name + '.spec');
  const rec = { name, url };
  try {
    let buf;
    if (cached && fs.existsSync(f)) buf = fs.readFileSync(f);
    else {
      const g = await get(url); rec.status = g.status; rec.finalUrl = g.finalUrl;
      if (g.status !== 200) throw new Error('HTTP ' + g.status);
      buf = g.buf; fs.writeFileSync(f, buf);
    }
    rec.bytes = buf.length; rec.sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    Object.assign(rec, analyse(buf));
  } catch (e) { rec.error = String(e.message).slice(0, 120); }
  out.push(rec);
  console.log(name.padEnd(14), rec.error ? 'ERR ' + rec.error : `${rec.ver} ops=${rec.deduped} raw=${rec.raw} ${JSON.stringify(rec.mix)} "${rec.title}"`);
}
const prev = fs.existsSync(path.join(HERE, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'results.json'), 'utf8')) : [];
const merged = [...prev.filter(p => !out.some(o => o.name === p.name)), ...out];
fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(merged, null, 1));
