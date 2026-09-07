// E25 pass 9: derive the own-resource object-head list from CAMARA BUILD ONLY.
// A head qualifies when it is the objectHead() of at least two truth-w rows in
// the build half and never the objectHead() of a truth-x row in the build half.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from '../csv.mjs';
import { loadOps } from '../spec-text.mjs';
import { halfOf } from '../split.mjs';
import { objectHead } from '../rules-verb.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GT = path.join(HERE, '..', '..', '..', 'data', 'camara-2026-09-01', 'ground-truth.csv');
const gt = new Map();
for (const r of parseCsv(readFileSync(GT, 'utf8'))) gt.set([r.repo, r.path, r.method, r.operationId].join(''), r.gt_class);

const w = new Map(), x = new Set();
for (const op of loadOps()) {
  if (halfOf(op.repo) !== 'build') continue;
  const cls = gt.get([op.repo, op.path, op.method, op.operationId].join(''));
  if (!cls) continue;
  const text = (typeof op.summary === 'string' && /[A-Za-z]/.test(op.summary)) ? op.summary : (op.description ?? '');
  const head = objectHead(text);
  if (!head) continue;
  if (cls === 'w') w.set(head, (w.get(head) ?? 0) + 1);
  if (cls === 'x') x.add(head);
}
const heads = [...w.entries()].filter(([h, n]) => n >= 1 && !x.has(h)).map(([h]) => h).sort();
writeFileSync(path.join(HERE, 'own-objects.json'), JSON.stringify({
  provenance: 'E25 pass 9. Derived mechanically by derive-own.mjs from the CAMARA BUILD half only: object heads (objectHead() of the summary) seen on >=1 truth-w row and on no truth-x row in that half. Never touched by test-half or hold-out data.',
  heads,
}, null, 2) + '\n', 'utf8');
console.log(`${heads.length} heads:`, heads.join(', '));
