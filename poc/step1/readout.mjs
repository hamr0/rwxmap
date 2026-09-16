// Readout for step 1 — run with: node poc/step1/readout.mjs
// Loads the 15-provider corpus, runs applyStep1 over all 4171 rows and
// prints the tables. Also writes run-proof/step1.csv (one row per operation).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadRows } from './corpus.mjs';
import { applyStep1, READ_VERBS } from './step1.mjs';
import { leadVerbAfterModifiers, matchesAnyStem, stemMatches } from './words.mjs';
import { toCsv } from './csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_CSV = path.join(REPO_ROOT, 'run-proof/step1.csv');

// The 13 words carried over from poc/flow's step 1 list. They were not mined
// from this corpus, so LOVO always keeps them.
const CARRIED_OVER = new Set([
  'retrieve', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'count', 'lookup', 'assess', 'find', 'get',
]);

const METHOD_ORDER = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE', 'PATCH'];
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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

// --- Truth by method -------------------------------------------------------
const byMethod = new Map();
for (const row of rows) {
  if (!byMethod.has(row.method)) byMethod.set(row.method, { n: 0, r: 0, w: 0, x: 0 });
  const c = byMethod.get(row.method);
  c.n += 1;
  c[row.truth] += 1;
}
console.log('Truth by method');
console.log(table(
  ['method', 'n', 'r', 'w', 'x', 'r-share'],
  METHOD_ORDER.filter((m) => byMethod.has(m)).map((m) => {
    const c = byMethod.get(m);
    return [m, c.n, c.r, c.w, c.x, pct(c.r, c.n)];
  }),
  ['l', 'r', 'r', 'r', 'r', 'r'],
));
console.log(`\nrows ${rows.length}   providers ${providers.length}   missing truth 0`);

// --- The r floor -----------------------------------------------------------
const floorRows = rows.filter((r) => READ_METHODS.has(r.method));
const floorR = floorRows.filter((r) => r.truth === 'r');
const floorNotR = floorRows.filter((r) => r.truth !== 'r');
console.log(`\n\nThe r floor (GET/HEAD/OPTIONS rows)`);
console.log(`${floorR.length} of ${floorRows.length} are truth r (${pct(floorR.length, floorRows.length)}); ${floorNotR.length} are not.`);
console.log(table(
  ['provider', 'truth', 'conf', 'operationId', 'summary'],
  floorNotR.map((r) => [r.provider, r.truth, r.confidence, r.operationId, r.summary]),
  ['l', 'l', 'l', 'l', 'l'],
));
console.log('\nr-share per provider, read methods only');
console.log(table(
  ['provider', 'n', 'r', 'r-share'],
  providers.map((p) => {
    const rs = floorRows.filter((r) => r.provider === p);
    return [p, rs.length, rs.filter((r) => r.truth === 'r').length, pct(rs.filter((r) => r.truth === 'r').length, rs.length)];
  }),
  ['l', 'r', 'r', 'r'],
));

// --- Step 1 ledger ---------------------------------------------------------
const results = rows.map((row) => ({ row, hit: applyStep1(row) }));
const ledger = { method: { claimed: 0, right: 0, leaks: 0 }, 'read-verb': { claimed: 0, right: 0, leaks: 0 } };
for (const { row, hit } of results) {
  if (!hit) continue;
  const l = ledger[hit.rule];
  l.claimed += 1;
  if (row.truth === 'r') l.right += 1; else l.leaks += 1;
}
const totalClaimed = ledger.method.claimed + ledger['read-verb'].claimed;
const totalRight = ledger.method.right + ledger['read-verb'].right;
const totalLeaks = ledger.method.leaks + ledger['read-verb'].leaks;
const truthR = rows.filter((r) => r.truth === 'r');
const missed = results.filter(({ row, hit }) => row.truth === 'r' && !hit).map(({ row }) => row);
console.log('\n\nStep 1 ledger');
console.log(table(
  ['rule', 'claimed', 'right', 'leaks'],
  [
    ['method', ledger.method.claimed, ledger.method.right, ledger.method.leaks],
    ['read-verb', ledger['read-verb'].claimed, ledger['read-verb'].right, ledger['read-verb'].leaks],
    ['total', totalClaimed, totalRight, totalLeaks],
  ],
  ['l', 'r', 'r', 'r'],
));
console.log(`\nmissed reads: ${missed.length} truth-r rows step 1 did not claim (of ${truthR.length} truth r overall; all of them POST)`);

// --- Per word --------------------------------------------------------------
const postRows = rows.filter((r) => r.method === 'POST');
const postLead = new Map(postRows.map((r) => [r.rowId, leadVerbAfterModifiers(r)]));
const wordStats = [];
for (const word of READ_VERBS) {
  const fired = postRows.filter((r) => stemMatches(postLead.get(r.rowId), word));
  if (!fired.length) continue;
  const provs = [...new Set(fired.map((r) => r.provider))].sort();
  wordStats.push({
    word,
    fires: fired.length,
    right: fired.filter((r) => r.truth === 'r').length,
    wrong: fired.filter((r) => r.truth !== 'r').length,
    provs,
  });
}
wordStats.sort((a, b) => b.fires - a.fires || a.word.localeCompare(b.word));
console.log('\n\nPer word (POST rows only)');
console.log(table(
  ['word', 'fires', 'right', 'wrong', 'providers', 'provider list'],
  wordStats.map((s) => [s.word, s.fires, s.right, s.wrong, s.provs.length, s.provs.join(' ')]),
  ['l', 'r', 'r', 'r', 'r', 'l'],
));
const never = [...READ_VERBS].filter((w) => !wordStats.some((s) => s.word === w));
console.log(`never fires: ${never.join(', ') || '(none)'}`);

// --- LOVO ------------------------------------------------------------------
// For each provider in turn, rebuild READ_VERBS keeping a word only if it
// fires on at least one OTHER provider's POST rows (the carried-over 13 are
// always kept), then classify only that held-out provider's POST rows.
let lovoClaimed = 0, lovoRight = 0, lovoLeaks = 0;
const lovoRows = [];
for (const held of providers) {
  const others = postRows.filter((r) => r.provider !== held);
  const kept = new Set();
  for (const word of READ_VERBS) {
    if (CARRIED_OVER.has(word) || others.some((r) => stemMatches(postLead.get(r.rowId), word))) kept.add(word);
  }
  const mine = postRows.filter((r) => r.provider === held);
  let c = 0, ri = 0, le = 0;
  for (const row of mine) {
    if (!matchesAnyStem(postLead.get(row.rowId), kept)) continue;
    c += 1;
    if (row.truth === 'r') ri += 1; else le += 1;
  }
  lovoClaimed += c; lovoRight += ri; lovoLeaks += le;
  lovoRows.push([held, mine.length, kept.size, c, ri, le]);
}
console.log('\n\nLOVO (leave-one-vendor-out, POST rows only)');
console.log(table(
  ['held-out provider', 'POST rows', 'words kept', 'claimed', 'right', 'leaks'],
  [...lovoRows, ['TOTAL', postRows.length, '', lovoClaimed, lovoRight, lovoLeaks]],
  ['l', 'r', 'r', 'r', 'r', 'r'],
));

// --- The misses ------------------------------------------------------------
console.log('\n\nThe misses (truth-r POST rows step 1 did not claim)');
console.log(table(
  ['provider', 'conf', 'lead verb', 'operationId', 'summary'],
  missed.map((r) => [r.provider, r.confidence, leadVerbAfterModifiers(r), r.operationId, r.summary]),
  ['l', 'l', 'l', 'l', 'l'],
));

// --- run-proof/step1.csv ---------------------------------------------------
mkdirSync(path.dirname(OUT_CSV), { recursive: true });
const header = ['provider', 'method', 'path', 'operationId', 'summary', 'truth', 'confidence', 'class', 'step', 'rule'];
writeFileSync(OUT_CSV, toCsv(results.map(({ row, hit }) => ({
  provider: row.provider,
  method: row.method,
  path: row.path,
  operationId: row.operationId,
  summary: row.summary,
  truth: row.truth,
  confidence: row.confidence,
  class: hit ? hit.class : '',
  step: hit ? hit.step : '',
  rule: hit ? hit.rule : '',
})), header));
console.log(`\nwrote ${path.relative(REPO_ROOT, OUT_CSV)} (${results.length} rows)`);
