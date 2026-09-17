// Proof for the whole flow — run with: node tools/proof-flow.js
// Re-computes every pinned number from the corpus, using src/ only, and
// asserts it. Prints "All pins hold." and exits 0, or prints each mismatch
// and exits 1.
//
// This is the src/ counterpart of poc/step3/proof.mjs, and it imports
// NOTHING from poc/ — every number below is recomputed from src/step1.js,
// src/step2.js, src/step3.js and src/flow.js. The POC's proof stays where
// it is and keeps passing on its own code; the two agreeing is what says
// the rebuild landed.
//
// One structural difference from the POC's proof: `source` and `matched`
// are read straight off each verdict, not re-derived afterwards from the
// rule name by sourceForRule/matchedWordsForRule. Those two helpers do not
// exist in src/ — each rule now returns its own source and its own matched
// at the moment it matches, so there is nothing left that can drift from
// what actually fired, and nothing here needs to guard against that drift.
import { loadRows } from './corpus.js';
import { step1, READ_VERBS, SAFE_VERBS } from '../src/step1.js';
import { step2, MODIFY_VERBS } from '../src/step2.js';
import { step3, RAISE_WORDS, wordsForStep3 } from '../src/step3.js';
import { classifyRow } from '../src/flow.js';

const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) failures.push(`${name}: got ${g}, want ${w}`);
}

const rows = loadRows();
check('corpus rows', rows.length, 4171);

const ORDER = { r: 0, w: 1, x: 2 };

// --- the method-floor pile step 3's raise-word rule reaches into ----------
const inherited = rows.filter((r) => !step1(r));
const step2hits = inherited.map((row) => ({ row, hit: step2(row) }));
const floorRows = step2hits.filter(({ hit }) => hit && hit.rule === 'method-floor').map(({ row }) => row);
check('method-floor pile', floorRows.length, 902);

const raised = floorRows.map((row) => ({ row, hit: step3(row) })).filter(({ hit }) => hit);
check(
  'raise-word ledger',
  {
    claimed: raised.length,
    right: raised.filter(({ row }) => row.truth === 'x').length,
    falseAlarms: raised.filter(({ row }) => row.truth !== 'x').length,
  },
  { claimed: 19, right: 19, falseAlarms: 0 },
);

// --- the whole flow ---------------------------------------------------------
const flow = rows.map((row) => ({ row, hit: classifyRow(row) }));
check('flow classifies every row', flow.filter(({ hit }) => !hit).length, 0);

const floorPostRows = flow.filter(({ hit }) => hit.rule === 'floor-post');
check('floor-post is the leftover pile, all POST', {
  n: floorPostRows.length,
  allPost: floorPostRows.every(({ row }) => row.method === 'POST'),
}, { n: 985, allPost: true });
check(
  'floor-post truth',
  {
    r: floorPostRows.filter(({ row }) => row.truth === 'r').length,
    w: floorPostRows.filter(({ row }) => row.truth === 'w').length,
    x: floorPostRows.filter(({ row }) => row.truth === 'x').length,
  },
  { r: 33, w: 153, x: 799 },
);
check('floor-post right rate is 81.1%', (100 * floorPostRows.filter(({ row }) => row.truth === 'x').length / floorPostRows.length).toFixed(1), '81.1');

const overAll = flow.filter(({ row, hit }) => ORDER[hit.class] > ORDER[row.truth]);
const overFromFloorPost = overAll.filter(({ hit }) => hit.rule === 'floor-post').length;
check('floor-post holds every over-tight row in the flow', overFromFloorPost, 186);
check('flow over-tight total', overAll.length, 186);

const exact = flow.filter(({ row, hit }) => hit.class === row.truth).length;
const leaks = flow.filter(({ row, hit }) => ORDER[hit.class] < ORDER[row.truth]).length;
check('flow exact', exact, 3930);
check('flow leaks', leaks, 55);
check('flow exact is 94.2%', (100 * exact / rows.length).toFixed(1), '94.2');
check('flow leaks are 1.3%', (100 * leaks / rows.length).toFixed(1), '1.3');
check('flow over-tight is 4.5%', (100 * overAll.length / rows.length).toFixed(1), '4.5');

// --- precision per emitted class -------------------------------------------
function precision(cls) {
  const said = flow.filter(({ hit }) => hit.class === cls);
  return {
    n: said.length,
    right: said.filter(({ row }) => row.truth === cls).length,
    loose: said.filter(({ row }) => ORDER[cls] < ORDER[row.truth]).length,
  };
}
check('says r', precision('r'), { n: 2052, right: 2049, loose: 3 });
check('says w', precision('w'), { n: 1115, right: 1063, loose: 52 });
check('says x', precision('x'), { n: 1004, right: 818, loose: 0 });

// --- LOVO on the raise-word rule --------------------------------------------
// Rebuild RAISE_WORDS per held-out provider from the other 14 providers'
// method-floor rows only, then classify only the held-out provider's
// method-floor rows with that rebuilt list.
let lovoClaimed = 0;
let lovoRight = 0;
for (const held of new Set(rows.map((r) => r.provider))) {
  const others = rows.filter((r) => r.provider !== held);
  const othersInherited = others.filter((r) => !step1(r));
  const othersFloor = othersInherited.filter((r) => {
    const h = step2(r);
    return h && h.rule === 'method-floor';
  });
  const othersWords = new Map(othersFloor.map((r) => [r.rowId, wordsForStep3(r)]));
  const kept = new Set([...RAISE_WORDS].filter((w) => othersFloor.some((r) => othersWords.get(r.rowId).includes(w))));
  const mineFloor = floorRows.filter((r) => r.provider === held);
  for (const row of mineFloor) {
    const hit = step3(row, { raiseWords: kept });
    if (!hit) continue;
    lovoClaimed += 1;
    if (row.truth === 'x') lovoRight += 1;
  }
}
check('LOVO raise-word', { claimed: lovoClaimed, right: lovoRight }, { claimed: 6, right: 6 });

// --- source split: floor (method-only default) vs list (a word fired) ------
function sourceStats(pool) {
  return {
    claims: pool.length,
    right: pool.filter(({ row, hit }) => hit.class === row.truth).length,
    leaks: pool.filter(({ row, hit }) => ORDER[hit.class] < ORDER[row.truth]).length,
    over: pool.filter(({ row, hit }) => ORDER[hit.class] > ORDER[row.truth]).length,
  };
}
const bySource = { floor: [], list: [] };
for (const entry of flow) bySource[entry.hit.source].push(entry);

check('source floor', sourceStats(bySource.floor), { claims: 3828, right: 3593, leaks: 49, over: 186 });
check('source list', sourceStats(bySource.list), { claims: 343, right: 337, leaks: 6, over: 0 });

function stepSourceStats(step, source) {
  return sourceStats(flow.filter(({ hit }) => hit.step === step && hit.source === source));
}
check('step 1 list', stepSourceStats(1, 'list'), { claims: 92, right: 91, leaks: 1, over: 0 });
check('step 1 floor', stepSourceStats(1, 'floor'), { claims: 1960, right: 1958, leaks: 2, over: 0 });
check('step 2 list', stepSourceStats(2, 'list'), { claims: 232, right: 227, leaks: 5, over: 0 });
check('step 2 floor', stepSourceStats(2, 'floor'), { claims: 883, right: 836, leaks: 47, over: 0 });
check('step 3 list', stepSourceStats(3, 'list'), { claims: 19, right: 19, leaks: 0, over: 0 });
check('step 3 floor', stepSourceStats(3, 'floor'), { claims: 985, right: 799, leaks: 0, over: 186 });

// --- matched: the word each rule reported when it fired ---------------------
const listRows = flow.filter(({ hit }) => hit.source === 'list');
const floorMatched = flow.filter(({ hit }) => hit.source === 'floor');
check('matched is non-empty for every list row', {
  n: listRows.length,
  nonEmpty: listRows.filter(({ hit }) => hit.matched.length > 0).length,
}, { n: 343, nonEmpty: 343 });
check('matched is empty for every floor row', {
  n: floorMatched.length,
  empty: floorMatched.filter(({ hit }) => hit.matched.length === 0).length,
}, { n: 3828, empty: 3828 });

function matchedCountForRule(rule) {
  return flow.filter(({ hit }) => hit.rule === rule && hit.matched.length > 0).length;
}
check('matched count per rule', {
  'read-verb': matchedCountForRule('read-verb'),
  'read-verb-anywhere': matchedCountForRule('read-verb-anywhere'),
  'modify-verb': matchedCountForRule('modify-verb'),
  'modify-verb-summary': matchedCountForRule('modify-verb-summary'),
  'raise-word': matchedCountForRule('raise-word'),
}, {
  'read-verb': 87,
  'read-verb-anywhere': 5,
  'modify-verb': 114,
  'modify-verb-summary': 118,
  'raise-word': 19,
});

// Every reported word is a member of the list its rule owns.
const OWNING_LIST = {
  'read-verb': READ_VERBS,
  'read-verb-anywhere': SAFE_VERBS,
  'modify-verb': MODIFY_VERBS,
  'modify-verb-summary': MODIFY_VERBS,
  'raise-word': RAISE_WORDS,
};
let allWordsOwned = true;
for (const { hit } of listRows) {
  const list = OWNING_LIST[hit.rule];
  for (const w of hit.matched) {
    if (!list || !list.has(w)) allWordsOwned = false;
  }
}
check('every reported word is a member of the list its rule owns', allWordsOwned, true);

// All 19 raise-word rows report a member of RAISE_WORDS, and three named
// rows report exactly the words the brief names.
const raiseWordRows = flow.filter(({ hit }) => hit.rule === 'raise-word');
check('raise-word rows all report RAISE_WORDS members', {
  n: raiseWordRows.length,
  allOwned: raiseWordRows.every(({ hit }) => hit.matched.every((w) => RAISE_WORDS.has(w))),
}, { n: 19, allOwned: true });

function matchedFor(provider, operationId) {
  const found = raiseWordRows.find(({ row }) => row.provider === provider && row.operationId === operationId);
  return found ? found.hit.matched : undefined;
}
check('jira deleteSharePermission -> permission', matchedFor('jira', 'deleteSharePermission'), ['permission']);
check('zoom userPassword -> password', matchedFor('zoom', 'userPassword'), ['password']);
// asana updateMembership's path is /memberships/{membership_gid}: the plural
// path segment "memberships" is itself a separate RAISE_WORDS member, and it
// genuinely fires alongside "membership" -- wordsForStep3(row) contains both,
// and step3's own membership test fires on either. Reporting only
// "membership" here would be a silent drop of a real match. Pinned as
// observed, not as the brief's shorthand.
check('asana updateMembership -> membership + memberships (see note above)', matchedFor('asana', 'updateMembership'), ['membership', 'memberships']);

if (failures.length) {
  for (const f of failures) console.log('MISMATCH ' + f);
  process.exit(1);
}
console.log('All pins hold.');
