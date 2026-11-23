// Lists every row whose truth is x but today's classifyRow class is not x, per set,
// grouped by method. Writes leaks.txt (all) and leaks-d141.txt (rows with D141 families).
// Run: node poc/d141-mech/dump.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyRow } from '../../src/flow.js';
import { loadA, loadB, toOp } from './load.mjs';

const here = (f) => fileURLToPath(new URL(f, import.meta.url));
const GROUPS = [['GET/HEAD/OPTIONS/QUERY', ['GET', 'HEAD', 'OPTIONS', 'QUERY']], ['PUT', ['PUT']], ['PATCH', ['PATCH']], ['POST', ['POST']]];
const groupOf = (m) => { const g = GROUPS.find(([, ms]) => ms.includes(m)); return g ? g[0] : 'OTHER:' + m; };
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function leaks(rows) {
  const out = [];
  for (const r of rows) {
    if (r.truth !== 'x') continue;
    const v = classifyRow(toOp(r));
    if (v.class !== 'x') out.push({ r, cls: v.class, rule: v.rule });
  }
  return out;
}

function render(title, sets) {
  const lines = [title, ''];
  for (const [name, list] of sets) {
    const groups = new Map();
    for (const l of list) { const g = groupOf(l.r.method); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(l); }
    lines.push(`===== SET ${name}: ${list.length} rows (truth x, today's class not x) =====`);
    const order = [...GROUPS.map(([g]) => g), ...[...groups.keys()].filter((g) => !GROUPS.some(([x]) => x === g))];
    for (const g of order) lines.push(`  ${g}: ${(groups.get(g) || []).length}`);
    for (const g of order) {
      const items = (groups.get(g) || []).sort((a, b) => cmp(a.r.vendor, b.r.vendor) || cmp(a.r.path, b.r.path));
      lines.push('', `--- ${name} / ${g} (${items.length}) ---`);
      for (const { r, cls, rule } of items) {
        const d = r.description.replace(/\s+/g, ' ').slice(0, 300);
        lines.push(`${r.id} | set ${r.set} | ${r.vendor} | ${r.method} ${r.path} | opId=${r.operationId} | summary=${r.summary} | desc=${d} | families=${r.families} | today=${cls} ${rule}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

const A = leaks(loadA().rows);
const B = leaks(loadB().rows);
fs.writeFileSync(here('leaks.txt'), render('leaks: truth x, today classifyRow class not x (A = export-v4-d141 label_d141, B = exam #7 truth.csv; never pooled)', [['A', A], ['B', B]]));
const Af = A.filter((l) => l.r.families !== ''); const Bf = B.filter((l) => l.r.families !== '');
fs.writeFileSync(here('leaks-d141.txt'), render('leaks with non-empty d141 families (B has no families, so it is empty)', [['A', Af], ['B', Bf]]));
const cnt = (list) => GROUPS.map(([g]) => `${g}=${list.filter((l) => groupOf(l.r.method) === g).length}`).join(' ') + ` other=${list.filter((l) => groupOf(l.r.method).startsWith('OTHER')).length} total=${list.length}`;
console.log('A all   ', cnt(A)); console.log('A d141  ', cnt(Af));
console.log('B all   ', cnt(B)); console.log('B d141  ', cnt(Bf));
