// Readout for step 3 — run with: node poc/step3/readout.mjs
// Loads the 15-provider corpus, runs the whole flow (step 1 + step 2 +
// step 3) over all 4171 rows and prints the tables. Also writes
// run-proof/step3.csv (one row per operation).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadRows } from '../step1/corpus.mjs';
import { toCsv } from '../step1/csv.mjs';
import { applyStep1 } from '../step1/step1.mjs';
import { applyStep2 } from '../step2/step2.mjs';
import { applyStep3, RAISE_WORDS, wordsForStep3, sourceForRule } from './step3.mjs';
import { classifyRow } from './flow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_CSV = path.join(REPO_ROOT, 'run-proof/step3.csv');

const METHOD_ORDER = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE', 'PATCH'];

function pad(v, w) { return String(v).padEnd(w); }
function padL(v, w) { return String(v).padStart(w); }
function table(header, rows, aligns) {
  const widths = header.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length)));
  const line = (cells) => cells
    .map((c, i) => (aligns[i] === 'r' ? padL(c ?? '', widths[i]) : pad(c ?? '', widths[i])))
    .join('  ')
    .replace(/\s+$/, '');
  const out = [line(header), widths.map((w) => '-'.repeat(w)).join('  ')];
  for (const r of rows) out.push(line(r));
  return out.join('\n');
}
function pct(a, b) { return b === 0 ? '-' : (100 * a / b).toFixed(1) + '%'; }

const rows = loadRows();
const providers = [...new Set(rows.map((r) => r.provider))].sort();

// --- The method-floor pile step 3's raise-word rule reaches into ----------
const inherited = rows.filter((r) => !applyStep1(r));
const step2hits = inherited.map((row) => ({ row, hit: applyStep2(row) }));
const floorRows = step2hits.filter(({ hit }) => hit && hit.rule === 'method-floor').map(({ row }) => row);
console.log(`Step 2's method-floor pile (step 3's only reach into PUT/DELETE/PATCH): ${floorRows.length} rows`);

const raised = floorRows.map((row) => ({ row, hit: applyStep3(row) })).filter(({ hit }) => hit);
console.log('\nraise-word ledger (right = truth x, false alarm = truth r or w)');
console.log(table(
  ['rule', 'claimed', 'right', 'false alarms'],
  [['raise-word', raised.length,
    raised.filter(({ row }) => row.truth === 'x').length,
    raised.filter(({ row }) => row.truth !== 'x').length]],
  ['l', 'r', 'r', 'r'],
));

// --- per word ---------------------------------------------------------------
const wordStats = [...RAISE_WORDS].map((word) => {
  const fired = floorRows.filter((r) => wordsForStep3(r).includes(word));
  return {
    word,
    fires: fired.length,
    right: fired.filter((r) => r.truth === 'x').length,
    wrong: fired.filter((r) => r.truth !== 'x').length,
    provs: [...new Set(fired.map((r) => r.provider))].sort(),
  };
});
console.log('\nPer word — RAISE_WORDS on the method-floor pile');
console.log(table(
  ['word', 'fires', 'right', 'wrong', 'providers', 'provider list'],
  wordStats.filter((s) => s.fires).sort((a, b) => b.fires - a.fires || a.word.localeCompare(b.word))
    .map((s) => [s.word, s.fires, s.right, s.wrong, s.provs.length, s.provs.join(' ')]),
  ['l', 'r', 'r', 'r', 'r', 'l'],
));
const neverFires = wordStats.filter((s) => !s.fires).map((s) => s.word).sort();
console.log(`never fires on a method-floor row (kept anyway — an unfired word costs nothing): ${neverFires.join(', ') || '(none)'}`);

// --- LOVO -------------------------------------------------------------------
const lovoRows = [];
let lc = 0, lr = 0;
for (const held of providers) {
  const others = rows.filter((r) => r.provider !== held);
  const othersInherited = others.filter((r) => !applyStep1(r));
  const othersFloor = othersInherited.filter((r) => {
    const h = applyStep2(r);
    return h && h.rule === 'method-floor';
  });
  const othersWords = new Map(othersFloor.map((r) => [r.rowId, wordsForStep3(r)]));
  const kept = new Set([...RAISE_WORDS].filter((w) => othersFloor.some((r) => othersWords.get(r.rowId).includes(w))));
  const mineFloor = floorRows.filter((r) => r.provider === held);
  let c = 0, ri = 0;
  for (const row of mineFloor) {
    const hit = applyStep3(row, kept);
    if (!hit) continue;
    c += 1;
    if (row.truth === 'x') ri += 1;
  }
  lc += c; lr += ri;
  if (mineFloor.length) lovoRows.push([held, mineFloor.length, kept.size, c, ri]);
}
console.log('\nLOVO (leave-one-vendor-out, raise-word only) — THIS IS THE HONEST NUMBER');
console.log(table(
  ['held-out provider', 'method-floor rows', 'raise words kept', 'claimed', 'right'],
  [...lovoRows, ['TOTAL', floorRows.length, '', lc, lr]],
  ['l', 'r', 'r', 'r', 'r'],
));
console.log(`fitted (all 15): ${raised.length} claimed, ${raised.filter(({ row }) => row.truth === 'x').length} right. LOVO: ${lc} claimed, ${lr} right.`);

// --- whole flow ---------------------------------------------------------------
const flow = rows.map((row) => ({ row, hit: classifyRow(row) }));
function score(pool) {
  const order = { r: 0, w: 1, x: 2 };
  const exact = pool.filter(({ row, hit }) => hit.class === row.truth).length;
  const leaks = pool.filter(({ row, hit }) => order[hit.class] < order[row.truth]).length;
  const over = pool.filter(({ row, hit }) => order[hit.class] > order[row.truth]).length;
  return [pool.length, exact, pct(exact, pool.length), leaks, pct(leaks, pool.length), over, pct(over, pool.length)];
}
console.log('\nWhole flow — step 1 (r) + step 2 (w) + step 3 (x)');
console.log(table(
  ['scope', 'n', 'exact', 'exact %', 'leaks', 'leak %', 'over-tight', 'over %'],
  [
    ['ALL', ...score(flow)],
    ...METHOD_ORDER.filter((m) => flow.some(({ row }) => row.method === m))
      .map((m) => [m, ...score(flow.filter(({ row }) => row.method === m))]),
  ],
  ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
));

// --- precision per emitted class ---------------------------------------------
const ORDER = { r: 0, w: 1, x: 2 };
function precision(cls) {
  const said = flow.filter(({ hit }) => hit.class === cls);
  return [cls, said.length, said.filter(({ row }) => row.truth === cls).length,
    pct(said.filter(({ row }) => row.truth === cls).length, said.length),
    said.filter(({ row }) => ORDER[cls] < ORDER[row.truth]).length];
}
console.log('\nPrecision per emitted class (loose = a leak, emitted looser than truth)');
console.log(table(
  ['class', 'n', 'right', 'right %', 'loose-wrong'],
  [precision('r'), precision('w'), precision('x')],
  ['l', 'r', 'r', 'r', 'r'],
));

// --- run-proof/step3.csv ---------------------------------------------------
mkdirSync(path.dirname(OUT_CSV), { recursive: true });
const header = ['provider', 'method', 'path', 'operationId', 'summary', 'truth', 'confidence', 'class', 'step', 'rule', 'source'];
writeFileSync(OUT_CSV, toCsv(flow.map(({ row, hit }) => ({
  provider: row.provider,
  method: row.method,
  path: row.path,
  operationId: row.operationId,
  summary: row.summary,
  truth: row.truth,
  confidence: row.confidence,
  class: hit.class,
  step: hit.step,
  rule: hit.rule,
  source: sourceForRule(hit.rule),
})), header));
console.log(`\nwrote ${path.relative(REPO_ROOT, OUT_CSV)} (${flow.length} rows)`);
