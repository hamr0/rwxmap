// Usage: node score.mjs <workdir> [outdir]. Joins mech and Jev CLI outputs to fixture ids and scores vs truth.
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
const RANK = { r: 0, w: 1, x: 2 };
export function tally(items) { // items: {pred, truth}
  const c = { n: items.length, exact: 0, loose: 0, tight: 0 };
  for (const { pred, truth } of items) { if (pred === truth) c.exact++; else if (RANK[pred] < RANK[truth]) c.loose++; else c.tight++; }
  return c;
}
const pct = (n, d) => `${n} (${(100 * n / d).toFixed(1)}%)`;
const fmt = (c) => `exact ${pct(c.exact, c.n)}, too loose ${pct(c.loose, c.n)}, too tight ${pct(c.tight, c.n)}`;
async function main() {
  const [W, outDir = '.'] = process.argv.slice(2);
  const D = new URL('../../data/rwxlite-fresh-2026-11-03/', import.meta.url).pathname;
  const lines = (b) => b.toString('utf8').split(/\r?\n/).filter(Boolean);
  const truth = new Map(lines(fs.readFileSync(D + 'truth.csv')).slice(1).map((l) => l.split(',')));
  const map = JSON.parse(fs.readFileSync(W + '/idmap.json')), names = JSON.parse(fs.readFileSync(W + '/vendors.json'));
  const load = (mode) => { const m = {}; names.forEach((n, i) => { const v = 'v' + String(i).padStart(3, '0');
    for (const r of JSON.parse(fs.readFileSync(`${W}/out-${mode}/${v}.rwxmap.review.json`)).rows) m[v + ' ' + r.method + ' ' + r.path] = r; }); return m; };
  const mech = load('mech'), jev = load('jev');
  const vk = Object.fromEntries(names.map((n, i) => [n, 'v' + String(i).padStart(3, '0')]));
  const out = []; const P = (s = '') => out.push(s);
  let unjoined = 0, changed = 0; const items = { mech: [], jev: [] }, per = {}, loose = [];
  for (const [id, t] of truth) {
    const m = map[id]; const k = m && vk[m.vendor] + ' ' + m.method + ' ' + m.path;
    if (!m || !mech[k] || !jev[k]) { unjoined++; P(`UNJOINED ${id}`); continue; }
    const a = mech[k].letter, b = jev[k].letter; if (a !== b) changed++;
    items.mech.push({ pred: a, truth: t }); items.jev.push({ pred: b, truth: t });
    (per[m.vendor] ??= { mech: [], jev: [] }); per[m.vendor].mech.push({ pred: a, truth: t }); per[m.vendor].jev.push({ pred: b, truth: t });
    if (RANK[b] < RANK[t]) loose.push(`  ${id} ${m.method} ${m.path} | mech ${a} | jev ${b} | truth ${t}`);
  }
  const stats = { sent: 0, answered: 0, failed: 0, tin: 0, tout: 0 }, models = new Set(), sums = [];
  names.forEach((n, i) => { const v = 'v' + String(i).padStart(3, '0'); const log = fs.readFileSync(`${W}/out-jev/${v}.log`, 'utf8');
    const s = log.split('\n').find((l) => /Jev: on — \d+ sent/.test(l)); sums.push(`${n}: ${s}`);
    const mm = s.match(/(\d+) sent · (\d+) answered · (\d+) failed.* (\d+) in \/ (\d+) out/);
    stats.sent += +mm[1]; stats.answered += +mm[2]; stats.failed += +mm[3]; stats.tin += +mm[4]; stats.tout += +mm[5];
    models.add(JSON.parse(fs.readFileSync(`${W}/out-jev/${v}.rwxmap.json`)).jev.model); });
  P(`Mode c (mechanical -> Jev, today's Jev path), rwxlite fresh 949 rows. TUNING data, not an exam.`);
  P(`One run of a non-deterministic model. Mode c's planned D133 change (failed call -> x plus review) is not built yet, so this is today's Jev behaviour.`);
  P(`rows joined ${items.jev.length} of ${truth.size}; unjoined ${unjoined}; model ${[...models].join(',')}`);
  P(`Jev sent ${stats.sent}, answered ${stats.answered}, failed ${stats.failed}, letters changed ${changed}; tokens ${stats.tin} in / ${stats.tout} out`);
  P(); P('Jev summary line per CLI run:'); sums.forEach((s) => P('  ' + s));
  P(); P('HEADLINE (too loose = looser than truth; too tight = stricter)');
  P('mechanical (this run): ' + fmt(tally(items.mech)));
  P('mode c  mech -> Jev:   ' + fmt(tally(items.jev)));
  P('reference (poc/d133-rule-compare/readout.txt): mechanical 736 / 6 / 207; mode a (rwxmap secondPass) 826 / 6 / 117 (exact / too loose / too tight)');
  P(); P(`TOO-LOOSE ROWS, mode c: ${loose.length}`); loose.forEach((l) => P(l));
  P(); P('PER VENDOR (exact/too loose/too tight of n)');
  for (const [v, o] of Object.entries(per)) { const a = tally(o.mech), b = tally(o.jev); P(`  ${v} n=${a.n}: mech ${a.exact}/${a.loose}/${a.tight}  mode c ${b.exact}/${b.loose}/${b.tight}`); }
  fs.writeFileSync(outDir + '/readout.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
  return { unjoined, stats };
}
if (import.meta.url === `file://${process.argv[1]}`) main().then((r) => process.exit(r.unjoined ? 1 : 0));
