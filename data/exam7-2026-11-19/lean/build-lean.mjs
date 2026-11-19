// Builds lean.csv: rwxmap mechanical verdict (classifyOperations from src/exporter.js) for every exam #7 op.
// Same logic as poc/d141-pass/lean.mjs. lean_rule has the alias credential-set -> cant-undo-verb.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { classifyOperations } from '../../../src/exporter.js';
import { parseCsv, enc } from '../labelling/csv.mjs';

const dir = fileURLToPath(new URL('.', import.meta.url));
const ALIAS = { 'credential-set': 'cant-undo-verb' };
const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };

const [head, ...rows] = parseCsv(readFileSync(dir + '../ops.csv', 'utf8'));
const want = 'id,provider,method,path,operationId,summary,description';
if (head.join(',') !== want) fail('ops.csv header ' + head.join(','));
const ops = rows.filter((r) => r.length > 1 || r[0] !== '').map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
if (ops.length !== 1579) fail('row count ' + ops.length);
if (new Set(ops.map((o) => o.id)).size !== ops.length) fail('ids not unique');

const buildOp = (o) => {
  const r = { method: String(o.method).toUpperCase(), path: o.path };
  for (const k of ['operationId', 'summary', 'description']) if (o[k] !== '' && o[k] != null) r[k] = o[k];
  return r;
};
const res = classifyOperations(ops.map(buildOp));
if (res.length !== ops.length) fail('result length ' + res.length);
const lean = res.map((v) => ({ lean_letter: v.class, lean_rule: Object.hasOwn(ALIAS, v.rule) ? ALIAS[v.rule] : v.rule }));
lean.forEach((l, i) => {
  if (!['r', 'w', 'x'].includes(l.lean_letter)) fail('bad letter row ' + i + ': ' + l.lean_letter);
  if (!l.lean_rule) fail('empty rule row ' + i);
});

const out = 'id,lean_letter,lean_rule\n' + ops.map((o, i) => [enc(o.id), lean[i].lean_letter, enc(lean[i].lean_rule)].join(',') + '\n').join('');
writeFileSync(dir + 'lean.csv', out);
const sha = createHash('sha256').update(out).digest('hex');
writeFileSync(dir + 'lean.csv.sha256', sha + '  lean.csv\n');

const tally = (keyf) => { const m = {}; ops.forEach((o, i) => { const k = keyf(o, i); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort(); };
console.log('rows', ops.length, 'sha256', sha);
console.log('by letter'); for (const [k, n] of tally((o, i) => lean[i].lean_letter)) console.log(' ', k, n);
console.log('by method x letter'); for (const [k, n] of tally((o, i) => o.method.toUpperCase() + ' ' + lean[i].lean_letter)) console.log(' ', k, n);
console.log('by rule'); for (const [k, n] of tally((o, i) => lean[i].lean_rule)) console.log(' ', k, n);
