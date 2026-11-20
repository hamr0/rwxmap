import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = '/home/hamr/PycharmProjects/rwxlite/data/round13/';
const net = JSON.parse(readFileSync(join(here, 'pattern-net.json'), 'utf8'));
const fams = Object.keys(net.families).sort();
const res = {};
for (const f of fams) res[f] = new RegExp(net.families[f]);

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csvLine = (a) => a.map(csvCell).join(',') + '\r\n';

const DESC = ' | desc: ';
const out = [];
const read = {}, withDesc = {};
for (const split of ['train', 'val']) {
  const lines = readFileSync(SRC + split + '.jsonl', 'utf8').split('\n').filter((l) => l.length);
  read[split] = lines.length; withDesc[split] = 0;
  for (const l of lines) {
    const r = JSON.parse(l);
    const t = r.text || '';
    const i = t.indexOf(DESC);
    const desc = i >= 0 ? t.slice(i + DESC.length) : '';
    if (i >= 0) withDesc[split]++;
    const m = r.method || '', p = r.path || '', o = r.operationId || '', s = r.summary || '';
    const text = (m + ' ' + p + ' ' + o + ' ' + s + ' ' + desc.slice(0, 600)).toLowerCase();
    const hit = fams.filter((f) => res[f].test(text));
    if (hit.length) out.push({ id: r.id, split, fam: hit.join(''), hit, m, p, o, s, desc, label: r.label });
  }
}

let csv = csvLine(['id', 'split', 'families', 'method', 'path', 'operationId', 'summary', 'description', 'old_label']);
for (const c of out) csv += csvLine([c.id, c.split, c.fam, c.m, c.p, c.o, c.s, c.desc, c.label]);
writeFileSync(join(here, 'candidates.csv'), csv);

const key = (id) => createHash('sha256').update('d141-pass:' + id).digest('hex');
const shuf = [...out].sort((a, b) => (key(a.id) < key(b.id) ? -1 : key(a.id) > key(b.id) ? 1 : 0));
rmSync(join(here, 'blind'), { recursive: true, force: true });
mkdirSync(join(here, 'blind'));
const PART = 400;
let parts = 0;
for (let i = 0; i < shuf.length; i += PART) {
  let b = csvLine(['id', 'method', 'path', 'operationId', 'summary', 'description']);
  for (const c of shuf.slice(i, i + PART)) b += csvLine([c.id, c.m, c.p, c.o, c.s, c.desc]);
  writeFileSync(join(here, 'blind', 'part-' + String(++parts).padStart(2, '0') + '.csv'), b);
}

const labels = [...new Set(out.map((c) => c.label))].sort();
const L = [];
for (const s of ['train', 'val']) L.push(`rows read ${s}: ${read[s]} (with desc segment: ${withDesc[s]})`);
for (const s of ['train', 'val']) L.push(`candidates ${s}: ${out.filter((c) => c.split === s).length}`);
L.push(`candidates total: ${out.length}`);
for (const f of fams) L.push(`family ${f}: ${out.filter((c) => c.hit.includes(f)).length}`);
for (const f of fams) for (const lb of labels) L.push(`family ${f} x old ${lb}: ${out.filter((c) => c.hit.includes(f) && c.label === lb).length}`);
L.push(`overlap rows (2+ families): ${out.filter((c) => c.hit.length > 1).length}`);
const combos = {};
for (const c of out) if (c.hit.length > 1) combos[c.fam] = (combos[c.fam] || 0) + 1;
for (const k of Object.keys(combos).sort()) L.push(`  overlap ${k}: ${combos[k]}`);
L.push(`parts (of ${PART}): ${parts}`);
const txt = L.join('\n') + '\n';
writeFileSync(join(here, 'counts.txt'), txt);
process.stdout.write(txt);
