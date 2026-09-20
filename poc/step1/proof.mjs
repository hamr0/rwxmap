// Proof for step 1 — run with: node poc/step1/proof.mjs
// Re-computes every pinned number from the corpus and asserts it. Prints
// "All pins hold." and exits 0, or prints each mismatch and exits 1.
import { loadRows } from './corpus.mjs';
import { applyStep1, READ_VERBS, SAFE_VERBS } from './step1.mjs';
import { leadVerbAfterModifiers, matchesAnyStem, stemMatches, tokensForRow } from './words.mjs';

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
const RULES = ['method', 'read-verb', 'read-verb-anywhere'];
const ledger = Object.fromEntries(RULES.map((r) => [r, { claimed: 0, right: 0, leaks: 0 }]));
for (const { row, hit } of results) {
  if (!hit) continue;
  const l = ledger[hit.rule];
  l.claimed += 1;
  if (row.truth === 'r') l.right += 1; else l.leaks += 1;
}
check('ledger method', ledger.method, { claimed: 1960, right: 1958, leaks: 2 });
check('ledger read-verb', ledger['read-verb'], { claimed: 87, right: 87, leaks: 0 });
// The price the user accepted on 2026-09-16: 5 claimed, 4 right, 1 leak.
check('ledger read-verb-anywhere', ledger['read-verb-anywhere'], { claimed: 5, right: 4, leaks: 1 });
check('ledger total', {
  claimed: RULES.reduce((n, r) => n + ledger[r].claimed, 0),
  right: RULES.reduce((n, r) => n + ledger[r].right, 0),
  leaks: RULES.reduce((n, r) => n + ledger[r].leaks, 0),
}, { claimed: 2052, right: 2049, leaks: 3 });
check(
  'read-verb-anywhere rows',
  results.filter(({ hit }) => hit && hit.rule === 'read-verb-anywhere')
    .map(({ row }) => [row.provider, row.operationId, row.truth, row.confidence]),
  [
    ['stripe', 'PostPaymentMethodDomainsPaymentMethodDomainValidate', 'w', 'low'],
    ['digitalocean', 'apps_validate_appSpec', 'r', 'high'],
    ['digitalocean', 'apps_validate_rollback', 'r', 'high'],
    ['digitalocean', 'registries_validate_name', 'r', 'high'],
    ['digitalocean', 'registry_validate_name', 'r', 'high'],
  ],
);
const missed = results.filter(({ row, hit }) => row.truth === 'r' && !hit);
check('truth r rows', rows.filter((r) => r.truth === 'r').length, 2082);
check('missed reads', missed.length, 33);
check(
  'missed reads = POST truth r minus POST claims',
  byMethod.get('POST').r - ledger['read-verb'].right - ledger['read-verb-anywhere'].right,
  33,
);

// --- per word -------------------------------------------------------------
const postRows = rows.filter((r) => r.method === 'POST');
const postLead = new Map(postRows.map((r) => [r.rowId, leadVerbAfterModifiers(r)]));
const postTokens = new Map(postRows.map((r) => [r.rowId, tokensForRow(r).tokens]));
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

// --- per word, the anywhere rule ------------------------------------------
// Only the POST rows the lead rule left behind ever reach this rule.
const anywhereRows = postRows.filter((r) => !matchesAnyStem(postLead.get(r.rowId), READ_VERBS));
const firedAnywhere = [];
for (const word of SAFE_VERBS) {
  const hits = anywhereRows.filter((r) => postTokens.get(r.rowId).some((t) => stemMatches(t, word)));
  if (!hits.length) continue;
  firedAnywhere.push(word);
  check(`safe word ${word}`, [hits.length, hits.filter((r) => r.truth === 'r').length, new Set(hits.map((r) => r.provider)).size], word === 'validate' ? [5, 4, 2] : null);
}
check('safe words that fire', firedAnywhere, ['validate']);
check('SAFE_VERBS is a subset of READ_VERBS', [...SAFE_VERBS].every((w) => READ_VERBS.has(w)), true);

// --- LOVO -----------------------------------------------------------------
// Both word lists are rebuilt per held-out provider: a READ_VERBS word is
// kept if it fires on another provider's lead token (the carried-over 13
// always), a SAFE_VERBS word if it fires on any token of another provider's
// POST rows.
let lovoClaimed = 0, lovoRight = 0, lovoLeaks = 0;
for (const held of [...new Set(rows.map((r) => r.provider))]) {
  const others = postRows.filter((r) => r.provider !== held);
  const keptRead = new Set();
  for (const word of READ_VERBS) {
    if (CARRIED_OVER.has(word) || others.some((r) => stemMatches(postLead.get(r.rowId), word))) keptRead.add(word);
  }
  const keptSafe = new Set();
  for (const word of SAFE_VERBS) {
    if (others.some((r) => postTokens.get(r.rowId).some((t) => stemMatches(t, word)))) keptSafe.add(word);
  }
  for (const row of postRows.filter((r) => r.provider === held)) {
    if (!applyStep1(row, { readVerbs: keptRead, safeVerbs: keptSafe })) continue;
    lovoClaimed += 1;
    if (row.truth === 'r') lovoRight += 1; else lovoLeaks += 1;
  }
}
check('LOVO', { claimed: lovoClaimed, right: lovoRight, leaks: lovoLeaks }, { claimed: 83, right: 82, leaks: 1 });

if (failures.length) {
  for (const f of failures) console.log('MISMATCH ' + f);
  process.exit(1);
}
console.log('All pins hold.');
