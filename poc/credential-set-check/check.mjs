// Cross-check: on the 32 rows rwxlite measured, does rwxmap's second pass
// ever lower a credential-set verdict? Runs the real classifyRow and the real
// secondPass with a stub engine that replays rwxlite's recorded answers.
import { readFileSync } from 'node:fs';
import { classifyRow } from '../../src/flow.js';
import { secondPass, readAnswer, LOWER_MIN_P, NEVER_LOWER_RULES } from '../../src/secondpass.js';

const FIX = new URL('../../data/credential-set-2026-11-04/credential-set.jsonl', import.meta.url);
const rows = readFileSync(FIX, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const MODEL = 'rwxlite-0.1.0+8ad0a182';
const RANK = { r: 0, w: 1, x: 2 };

const MODES = [
  { name: 'a (as run)', opts: {}, force: false },
  { name: 'a forced', opts: {}, force: true },
  { name: 'b 95', opts: { confidence: 95 }, force: false },
  { name: 'b 0', opts: { confidence: 0 }, force: false },
];
const SETS = ['before', 'after'];

const ops = rows.map((r) => ({ method: r.method, path: r.path, operationId: r.operationId, summary: r.summary }));
const mech = ops.map((o) => classifyRow(o));

console.log(`rows: ${rows.length}; model ${MODEL}; NEVER_LOWER_RULES = ${[...NEVER_LOWER_RULES]}; LOWER_MIN_P = ${LOWER_MIN_P}`);
const notCred = mech.map((v, i) => [v, i]).filter(([v]) => v.rule !== 'credential-set');
console.log(`our classifier calls rule credential-set on ${mech.length - notCred.length} of ${mech.length} rows`);
console.log('DISAGREEMENTS (our rule is not credential-set):');
if (notCred.length === 0) console.log('  none');
for (const [v, i] of notCred) console.log(`  ${rows[i].provider} ${rows[i].method} ${rows[i].path} -> ours ${v.class}/${v.rule}/${v.review}; rwxlite before argmax ${rows[i].before.argmax}`);

const results = {}; // key -> {finals:[], tot}
for (const m of MODES) for (const s of SETS) {
  const finals = [];
  const tot = { sent: 0, lowered: 0, undecided: 0, kept: 0, raised: 0, r: 0, w: 0, x: 0 };
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i][s];
    const engine = async (items) => items.map(() => ({ pIsX: a.isX, pChanges: a.changes, model: rows[i].model }));
    const v = m.force ? { ...mech[i], review: 'tight' } : mech[i];
    const { verdicts, summary } = await secondPass([ops[i]], [v], engine, { model: MODEL, ...m.opts });
    finals.push(verdicts[0]);
    for (const k of ['sent', 'lowered', 'undecided', 'kept', 'raised']) tot[k] += summary[k];
    tot[verdicts[0].class] += 1;
  }
  results[`${m.name}|${s}`] = { finals, tot };
}

console.log('\nPER ROW (finals as class/review; mode a as run: "-" means not sent, mechanical kept)');
const hdr = ['provider', 'method', 'path', 'ourRule', 'ours', 'before', 'after'];
for (const m of MODES) for (const s of SETS) hdr.push(`${m.name}/${s}`);
console.log(hdr.join(' | '));
rows.forEach((r, i) => {
  const cells = [r.provider, r.method, r.path, mech[i].rule, `${mech[i].class}/${mech[i].review}`,
    `${r.before.argmax}@${r.before.maxP.toFixed(3)}`, `${r.after.argmax}@${r.after.maxP.toFixed(3)}`];
  for (const m of MODES) for (const s of SETS) {
    const f = results[`${m.name}|${s}`].finals[i];
    cells.push(`${f.class}/${f.review}${f.rule === mech[i].rule ? '' : ' [' + f.rule + ']'}`);
  }
  console.log(cells.join(' | '));
});

console.log('\nTOTALS per mode / answer set (of ' + rows.length + ' rows; sent = rows the engine was asked)');
console.log('mode | answers | sent | r | w | x | lowered | undecided | kept | raised');
for (const m of MODES) for (const s of SETS) {
  const t = results[`${m.name}|${s}`].tot;
  console.log(`${m.name} | ${s} | ${t.sent} | ${t.r} | ${t.w} | ${t.x} | ${t.lowered} | ${t.undecided} | ${t.kept} | ${t.raised}`);
}
const asRun = results['a (as run)|before'].tot.sent;
console.log(`\nMode a as the product runs it: ${asRun} of ${rows.length} rows sent; the rest are settled and not sent.`);

console.log('\nCOUNTERFACTUAL without the guard (answer letter below our class and p >= threshold; src not edited)');
for (const s of SETS) for (const [label, thr] of [['b 95', 0.95], ['b 0', 0], ['a forced (0.97)', LOWER_MIN_P]]) {
  let n = 0;
  rows.forEach((r, i) => {
    const read = readAnswer({ pIsX: r[s].isX, pChanges: r[s].changes, model: r.model }, MODEL);
    if (read && RANK[read.letter] < RANK[mech[i].class] && read.p >= thr) n += 1;
  });
  console.log(`${s} p's, ${label}: ${n} of ${rows.length} would be lowered`);
}
