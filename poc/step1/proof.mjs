// Proof for step 1 — run with: node poc/step1/proof.mjs
// Re-computes every pinned number from the corpus and asserts it. Prints
// "All pins hold." and exits 0, or prints each mismatch and exits 1.
import { loadRows } from './corpus.mjs';
import { applyStep1, READ_VERBS } from './step1.mjs';
import { leadVerbAfterModifiers, matchesAnyStem, stemMatches } from './words.mjs';

const CARRIED_OVER = new Set([
  'retrieve', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'count', 'lookup', 'assess', 'find', 'get',
]);
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) failures.push(`${name}: got ${g}, want ${w}`);
}

const rows = loadRows();

// --- corpus ---------------------------------------------------------------
check('corpus rows', rows.length, 4171);
check('corpus providers', new Set(rows.map((r) => r.provider)).size, 15);
check('corpus missing truth', rows.filter((r) => !['r', 'w', 'x'].includes(r.truth)).length, 0);

// --- truth by method ------------------------------------------------------
const byMethod = new Map();
for (const row of rows) {
  if (!byMethod.has(row.method)) byMethod.set(row.method, { n: 0, r: 0, w: 0, x: 0 });
  const c = byMethod.get(row.method);
  c.n += 1;
  c[row.truth] += 1;
}
check('truth GET', byMethod.get('GET'), { n: 1960, r: 1958, w: 1, x: 1 });
check('truth POST', byMethod.get('POST'), { n: 1309, r: 124, w: 381, x: 804 });
check('truth PUT', byMethod.get('PUT'), { n: 345, r: 0, w: 320, x: 25 });
check('truth DELETE', byMethod.get('DELETE'), { n: 473, r: 0, w: 434, x: 39 });
check('truth PATCH', byMethod.get('PATCH'), { n: 84, r: 0, w: 82, x: 2 });
check('no HEAD rows', byMethod.has('HEAD'), false);
check('no OPTIONS rows', byMethod.has('OPTIONS'), false);

// --- the r floor ----------------------------------------------------------
const floorRows = rows.filter((r) => READ_METHODS.has(r.method));
const floorNotR = rows.filter((r) => READ_METHODS.has(r.method) && r.truth !== 'r');
check('floor rows', floorRows.length, 1960);
check('floor truth r', floorRows.length - floorNotR.length, 1958);
check(
  'floor exceptions',
  floorNotR.map((r) => [r.provider, r.operationId, r.truth, r.confidence]),
  [['datadog', 'GetGraphSnapshot', 'x', 'low'], ['intercom', 'listContactBanners', 'w', 'low']],
);
const perProviderFloor = [...new Set(rows.map((r) => r.provider))].sort().map((p) => {
  const rs = floorRows.filter((r) => r.provider === p);
  return [p, rs.filter((r) => r.truth === 'r').length, rs.length];
});
check('floor providers at 100%', perProviderFloor.filter(([, r, n]) => r === n).length, 13);
check('datadog floor', perProviderFloor.find(([p]) => p === 'datadog').slice(1), [116, 117]);
check('intercom floor', perProviderFloor.find(([p]) => p === 'intercom').slice(1), [107, 108]);

// --- step 1 ledger --------------------------------------------------------
const results = rows.map((row) => ({ row, hit: applyStep1(row) }));
const ledger = { method: { claimed: 0, right: 0, leaks: 0 }, 'read-verb': { claimed: 0, right: 0, leaks: 0 } };
for (const { row, hit } of results) {
  if (!hit) continue;
  const l = ledger[hit.rule];
  l.claimed += 1;
  if (row.truth === 'r') l.right += 1; else l.leaks += 1;
}
check('ledger method', ledger.method, { claimed: 1960, right: 1958, leaks: 2 });
check('ledger read-verb', ledger['read-verb'], { claimed: 87, right: 87, leaks: 0 });
check('ledger total', {
  claimed: ledger.method.claimed + ledger['read-verb'].claimed,
  right: ledger.method.right + ledger['read-verb'].right,
  leaks: ledger.method.leaks + ledger['read-verb'].leaks,
}, { claimed: 2047, right: 2045, leaks: 2 });
const missed = results.filter(({ row, hit }) => row.truth === 'r' && !hit);
check('missed reads', missed.length, 37);
check('missed reads = POST truth r minus read-verb claims', byMethod.get('POST').r - ledger['read-verb'].claimed, 37);

// --- per word -------------------------------------------------------------
const postRows = rows.filter((r) => r.method === 'POST');
const postLead = new Map(postRows.map((r) => [r.rowId, leadVerbAfterModifiers(r)]));
const WANT_WORDS = {
  search: [27, 27, 4], get: [16, 16, 3], retrieve: [15, 15, 1], validate: [5, 5, 3],
  read: [4, 4, 1], list: [4, 4, 3], calculate: [2, 2, 1], evaluate: [2, 2, 1],
  fetch: [2, 2, 2], check: [2, 2, 1], find: [1, 1, 1], analyse: [1, 1, 1],
  match: [1, 1, 1], parse: [1, 1, 1], sanitise: [1, 1, 1], suggest: [1, 1, 1],
  count: [1, 1, 1], introspect: [1, 1, 1],
};
const WANT_NEVER = ['query', 'lookup', 'assess', 'analyze', 'sanitize'];
const fired = [];
for (const word of READ_VERBS) {
  const hits = postRows.filter((r) => stemMatches(postLead.get(r.rowId), word));
  if (!hits.length) continue;
  fired.push(word);
  check(`word ${word}`, [hits.length, hits.filter((r) => r.truth === 'r').length, new Set(hits.map((r) => r.provider)).size], WANT_WORDS[word] ?? null);
}
check('words that fire', fired.slice().sort(), Object.keys(WANT_WORDS).sort());
check('words that never fire', [...READ_VERBS].filter((w) => !fired.includes(w)).sort(), WANT_NEVER.slice().sort());

// --- LOVO -----------------------------------------------------------------
let lovoClaimed = 0, lovoRight = 0, lovoLeaks = 0;
for (const held of [...new Set(rows.map((r) => r.provider))]) {
  const others = postRows.filter((r) => r.provider !== held);
  const kept = new Set();
  for (const word of READ_VERBS) {
    if (CARRIED_OVER.has(word) || others.some((r) => stemMatches(postLead.get(r.rowId), word))) kept.add(word);
  }
  for (const row of postRows.filter((r) => r.provider === held)) {
    if (!matchesAnyStem(postLead.get(row.rowId), kept)) continue;
    lovoClaimed += 1;
    if (row.truth === 'r') lovoRight += 1; else lovoLeaks += 1;
  }
}
check('LOVO', { claimed: lovoClaimed, right: lovoRight, leaks: lovoLeaks }, { claimed: 78, right: 78, leaks: 0 });

if (failures.length) {
  for (const f of failures) console.log('MISMATCH ' + f);
  process.exit(1);
}
console.log('All pins hold.');
