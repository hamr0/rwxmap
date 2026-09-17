// Readout for step 2 — run with: node poc/step2/readout.mjs
// Loads the 15-provider corpus, runs step 1 then step 2 over all 4171 rows
// and prints the tables. Also writes run-proof/step2.csv (one row per
// operation). Imports nothing from poc/flow or poc/archive.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadRows } from '../step1/corpus.mjs';
import { toCsv } from '../step1/csv.mjs';
import { applyStep1 } from '../step1/step1.mjs';
import { matchesAnyStem } from '../step1/words.mjs';
import { applyStep2, MODIFY_VERBS, OTHER_PARTY, verbForRow, wordsForRow } from './step2.mjs';
import { classifyRow } from './flow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_CSV = path.join(REPO_ROOT, 'run-proof/step2.csv');

const METHOD_ORDER = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE', 'PATCH'];
const RULES = ['method-floor', 'modify-verb', 'modify-verb-summary'];

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

// --- What step 2 inherits --------------------------------------------------
const inherited = rows.filter((r) => !applyStep1(r));
const inhByMethod = new Map();
for (const row of inherited) {
  if (!inhByMethod.has(row.method)) inhByMethod.set(row.method, { n: 0, r: 0, w: 0, x: 0 });
  const c = inhByMethod.get(row.method);
  c.n += 1;
  c[row.truth] += 1;
}
console.log('What step 2 inherits (the rows step 1 did not claim)');
console.log(table(
  ['method', 'n', 'r', 'w', 'x'],
  [
    ...METHOD_ORDER.filter((m) => inhByMethod.has(m)).map((m) => {
      const c = inhByMethod.get(m);
      return [m, c.n, c.r, c.w, c.x];
    }),
    ['total', inherited.length, inherited.filter((r) => r.truth === 'r').length,
      inherited.filter((r) => r.truth === 'w').length, inherited.filter((r) => r.truth === 'x').length],
  ],
  ['l', 'r', 'r', 'r', 'r'],
));

// --- Step 2 ledger ---------------------------------------------------------
const hits = inherited.map((row) => ({ row, hit: applyStep2(row) }));
const ledger = Object.fromEntries(RULES.map((r) => [r, { claimed: 0, right: 0, leaks: 0, over: 0 }]));
for (const { row, hit } of hits) {
  if (!hit) continue;
  const l = ledger[hit.rule];
  l.claimed += 1;
  if (row.truth === 'w') l.right += 1;
  else if (row.truth === 'x') l.leaks += 1;
  else l.over += 1;
}
const tot = RULES.reduce((a, r) => ({
  claimed: a.claimed + ledger[r].claimed,
  right: a.right + ledger[r].right,
  leaks: a.leaks + ledger[r].leaks,
  over: a.over + ledger[r].over,
}), { claimed: 0, right: 0, leaks: 0, over: 0 });
console.log('\n\nStep 2 ledger  (right = truth w, leaks = truth x, over-tight = truth r)');
console.log(table(
  ['rule', 'claimed', 'right', 'leaks', 'leak rate', 'over-tight'],
  [
    ...RULES.map((r) => [r, ledger[r].claimed, ledger[r].right, ledger[r].leaks, pct(ledger[r].leaks, ledger[r].claimed), ledger[r].over]),
    ['total', tot.claimed, tot.right, tot.leaks, pct(tot.leaks, tot.claimed), tot.over],
  ],
  ['l', 'r', 'r', 'r', 'r', 'r'],
));
console.log(`rows left for step 3: ${hits.filter(({ hit }) => !hit).length}`);

// --- The POST leaks --------------------------------------------------------
const postLeaks = hits.filter(({ row, hit }) => hit && hit.rule !== 'method-floor' && row.truth === 'x');
console.log(`\n\nThe POST leaks (${postLeaks.length}) — rows step 2 called w that are truth x`);
console.log(table(
  ['provider', 'truth', 'rule', 'operationId', 'summary'],
  postLeaks.map(({ row, hit }) => [row.provider, row.truth, hit.rule, row.operationId, row.summary]),
  ['l', 'l', 'l', 'l', 'l'],
));

// --- Reach -----------------------------------------------------------------
const postInherited = inherited.filter((r) => r.method === 'POST');
const wPost = postInherited.filter((r) => r.truth === 'w');
const wPostFound = wPost.filter((r) => applyStep2(r));
console.log(`\n\nReach: step 2 found ${wPostFound.length} of the ${wPost.length} truth-w POST rows it inherited (${pct(wPostFound.length, wPost.length)}).`);

// --- Per word --------------------------------------------------------------
// A MODIFY verb "fires" on a POST row whose verb matches it, whether or not
// the OTHER_PARTY gate then blocks the row; right/leaks count only the rows
// actually claimed.
const modStats = [];
for (const word of MODIFY_VERBS) {
  const one = new Set([word]);
  const fired = postInherited.filter((r) => matchesAnyStem(verbForRow(r), one));
  const claimed = fired.filter((r) => applyStep2(r, { modifyVerbs: one }));
  modStats.push({
    word,
    fires: fired.length,
    claimed: claimed.length,
    right: claimed.filter((r) => r.truth === 'w').length,
    leaks: claimed.filter((r) => r.truth === 'x').length,
    provs: [...new Set(fired.map((r) => r.provider))].sort(),
  });
}
console.log('\n\nPer word — MODIFY_VERBS on the POST rows step 2 inherited');
console.log('fires = the row\'s verb matched; claimed = fired and the OTHER_PARTY gate let it through.');
console.log(table(
  ['word', 'fires', 'claimed', 'right', 'leaks', 'providers', 'provider list'],
  modStats.filter((s) => s.fires).sort((a, b) => b.fires - a.fires || a.word.localeCompare(b.word))
    .map((s) => [s.word, s.fires, s.claimed, s.right, s.leaks, s.provs.length, s.provs.join(' ')]),
  ['l', 'r', 'r', 'r', 'r', 'r', 'l'],
));
const neverMod = modStats.filter((s) => !s.fires).map((s) => s.word).sort();
console.log(`never fires on a POST row (kept anyway — an unfired word costs nothing): ${neverMod.join(', ') || '(none)'}`);

// --- Per word, the gate ----------------------------------------------------
// A row reaches the gate when its verb matched MODIFY_VERBS. A gate word
// "blocks" such a row when it is one of the row's words.
const atGate = postInherited.filter((r) => matchesAnyStem(verbForRow(r), MODIFY_VERBS));
const gateWords = new Map(atGate.map((r) => [r.rowId, wordsForRow(r)]));
const corpusWordProvs = new Map();
for (const word of OTHER_PARTY) {
  corpusWordProvs.set(word, new Set(rows.filter((r) => wordsForRow(r).includes(word)).map((r) => r.provider)));
}
const gateStats = [...OTHER_PARTY].map((word) => {
  const blocked = atGate.filter((r) => gateWords.get(r.rowId).includes(word));
  return {
    word,
    blocked: blocked.length,
    blockedX: blocked.filter((r) => r.truth === 'x').length,
    blockedW: blocked.filter((r) => r.truth === 'w').length,
    corpusProvs: corpusWordProvs.get(word).size,
  };
});
console.log('\n\nPer word — OTHER_PARTY (the gate) on the POST rows that reached it');
console.log(table(
  ['word', 'POST rows blocked', 'of those truth x', 'of those truth w', 'providers in corpus'],
  gateStats.filter((s) => s.blocked).sort((a, b) => b.blocked - a.blocked || a.word.localeCompare(b.word))
    .map((s) => [s.word, s.blocked, s.blockedX, s.blockedW, s.corpusProvs]),
  ['l', 'r', 'r', 'r', 'r'],
));
// A gate word can block nothing and still be present on POST rows (it just
// never landed on a row whose verb had already matched). The stricter list
// is the one that appears on no POST row at all.
const postWords = new Map(postInherited.map((r) => [r.rowId, wordsForRow(r)]));
const onNoPostRow = new Set([...OTHER_PARTY].filter((w) => !postInherited.some((r) => postWords.get(r.rowId).includes(w))));
console.log(table(
  ['word (blocks nothing)', 'POST rows blocked', 'on any POST row?', 'providers in corpus'],
  gateStats.filter((s) => !s.blocked).sort((a, b) => a.word.localeCompare(b.word))
    .map((s) => [s.word, s.blocked, onNoPostRow.has(s.word) ? 'no' : 'yes', s.corpusProvs]),
  ['l', 'r', 'l', 'r'],
));
console.log(`never fires on a POST row at all (kept anyway — an unfired word costs nothing): ${[...onNoPostRow].sort().join(', ') || '(none)'}`);

// --- LOVO ------------------------------------------------------------------
// The honest number. For each provider in turn, BOTH lists are rebuilt from
// the other 14 providers only: a MODIFY verb is kept if it fires as some
// other provider's row verb, an OTHER_PARTY word if it appears in some other
// provider's row words — anywhere in the corpus, not just in step 2's pile.
// Then only the held-out provider's POST rows are classified with those
// rebuilt lists. Nothing the held-out provider taught is used on it.
const lovoRows = [];
let lc = 0, lr = 0, ll = 0;
const allWords = new Map(rows.map((r) => [r.rowId, wordsForRow(r)]));
const allVerbs = new Map(rows.map((r) => [r.rowId, verbForRow(r)]));
for (const held of providers) {
  const others = rows.filter((r) => r.provider !== held);
  const mv = new Set([...MODIFY_VERBS].filter((w) => others.some((r) => matchesAnyStem(allVerbs.get(r.rowId), new Set([w])))));
  const op = new Set([...OTHER_PARTY].filter((w) => others.some((r) => allWords.get(r.rowId).includes(w))));
  let c = 0, ri = 0, le = 0;
  const mine = postInherited.filter((r) => r.provider === held);
  for (const row of mine) {
    if (!applyStep2(row, { modifyVerbs: mv, otherParty: op })) continue;
    c += 1;
    if (row.truth === 'w') ri += 1; else if (row.truth === 'x') le += 1;
  }
  lc += c; lr += ri; ll += le;
  lovoRows.push([held, mine.length, mv.size, op.size, c, ri, le]);
}
console.log('\n\nLOVO (leave-one-vendor-out, POST rules only) — THIS IS THE HONEST NUMBER');
console.log('It is what step 2\'s POST rule should be expected to do on a provider it has never seen.');
console.log(table(
  ['held-out provider', 'POST rows', 'modify words kept', 'gate words kept', 'claimed', 'right', 'leaks'],
  [...lovoRows, ['TOTAL', postInherited.length, '', '', lc, lr, ll]],
  ['l', 'r', 'r', 'r', 'r', 'r', 'r'],
));
console.log(`honest leak rate on an unseen provider: ${ll} of ${lc} claimed (${pct(ll, lc)}) — against ${tot.leaks - ledger['method-floor'].leaks} of ${ledger['modify-verb'].claimed + ledger['modify-verb-summary'].claimed} (${pct(tot.leaks - ledger['method-floor'].leaks, ledger['modify-verb'].claimed + ledger['modify-verb-summary'].claimed)}) fitted on all 15.`);

// --- Whole flow so far -----------------------------------------------------
const flow = rows.map((row) => ({ row, hit: classifyRow(row) }));
function score(pool) {
  const exact = pool.filter(({ row, hit }) => hit.class === row.truth).length;
  const order = { r: 0, w: 1, x: 2 };
  const leaks = pool.filter(({ row, hit }) => order[hit.class] < order[row.truth]).length;
  const over = pool.filter(({ row, hit }) => order[hit.class] > order[row.truth]).length;
  return [pool.length, exact, pct(exact, pool.length), leaks, pct(leaks, pool.length), over, pct(over, pool.length)];
}
console.log('\n\nWhole flow so far — step 1 (r) + step 2 (w) + the step-3 placeholder (everything else x)');
console.log(table(
  ['scope', 'n', 'exact', 'exact %', 'leaks', 'leak %', 'over-tight', 'over %'],
  [
    ['ALL', ...score(flow)],
    ...METHOD_ORDER.filter((m) => flow.some(({ row }) => row.method === m))
      .map((m) => [m, ...score(flow.filter(({ row }) => row.method === m))]),
  ],
  ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
));

// --- run-proof/step2.csv ---------------------------------------------------
mkdirSync(path.dirname(OUT_CSV), { recursive: true });
const header = ['provider', 'method', 'path', 'operationId', 'summary', 'truth', 'confidence', 'class', 'step', 'rule'];
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
})), header));
console.log(`\nwrote ${path.relative(REPO_ROOT, OUT_CSV)} (${flow.length} rows)`);
