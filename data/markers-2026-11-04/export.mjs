// Mechanical marker export for rwxlite (2026-11-04): one line per APIs.guru
// operation, keyed provider+method+path+operationId. Mechanical only (no Jev).
// Usage: node export.mjs <apis-guru-ops.csv.gz> <out.csv.gz>
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parseCsv } from '../../tools/csv.js';
import { classifyRow } from '../../src/index.js';
const [, , inPath, outPath] = process.argv;
const rows = parseCsv(zlib.gunzipSync(fs.readFileSync(inPath)).toString('utf8'));
const q = (v) => /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
const out = ['provider,api_key,method,path,operationId,class,step,rule,source,evidence_vs_floor,review,destructive'];
const byReview = {}; const byEv = {}; const byClass = {};
for (const r of rows) {
  const method = (r.method || '').toUpperCase();
  const v = classifyRow({ method, path: r.path, operationId: r.operationId, summary: r.summary, description: r.description });
  const ev = v.source === 'floor' ? 'floor' : 'evidence';
  byReview[v.review] = (byReview[v.review] || 0) + 1; byEv[ev] = (byEv[ev] || 0) + 1; byClass[v.class] = (byClass[v.class] || 0) + 1;
  out.push([r.provider, r.api_key, method, r.path, r.operationId, v.class, v.step, v.rule, v.source, ev, v.review, v.destructive ? 'true' : 'false'].map((x) => q(String(x ?? ''))).join(','));
}
fs.writeFileSync(outPath, zlib.gzipSync(out.join('\n') + '\n'));
console.log('rows', out.length - 1, 'class', JSON.stringify(byClass), 'review', JSON.stringify(byReview), 'evidence_vs_floor', JSON.stringify(byEv));
