// Proof for step 2 — run with: node poc/step2/proof.mjs
// Re-computes every pinned number from the corpus and asserts it. Prints
// "All pins hold." and exits 0, or prints each mismatch and exits 1.
import { loadRows } from '../step1/corpus.mjs';
import { applyStep1 } from '../step1/step1.mjs';
import { matchesAnyStem } from '../step1/words.mjs';
import { applyStep2, MODIFY_VERBS, OTHER_PARTY, verbForRow, wordsForRow } from './step2.mjs';
import { classifyRow } from './flow.mjs';

const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) failures.push(`${name}: got ${g}, want ${w}`);
}

const rows = loadRows();
check('corpus rows', rows.length, 4171);

// --- the lists ------------------------------------------------------------
check('MODIFY_VERBS size', MODIFY_VERBS.size, 24);
check('OTHER_PARTY size', OTHER_PARTY.size, 21);
// Rejected for paying most of the leaks; imagined and never seen in the corpus.
check('rejected verbs absent', ['set', 'attach', 'finalize'].filter((w) => MODIFY_VERBS.has(w)), []);
check('imagined gate words absent', ['guest', 'guests', 'invitee', 'teammate', 'attendee'].filter((w) => OTHER_PARTY.has(w)), []);
// Removed 2026-09-17: 18 POST rows vetoed between them, all truth w, zero leaks caught.
check('human-noun gate words removed', ['customer', 'contact', 'agent', 'person'].filter((w) => OTHER_PARTY.has(w)), []);

// --- what step 2 inherits -------------------------------------------------
const inherited = rows.filter((r) => !applyStep1(r));
check('inherited rows', inherited.length, 2119);
const inhByMethod = new Map();
for (const row of inherited) {
  if (!inhByMethod.has(row.method)) inhByMethod.set(row.method, { n: 0, r: 0, w: 0, x: 0 });
  const c = inhByMethod.get(row.method);
  c.n += 1;
  c[row.truth] += 1;
}
check('inherited POST', inhByMethod.get('POST'), { n: 1217, r: 33, w: 380, x: 804 });
check('inherited DELETE', inhByMethod.get('DELETE'), { n: 473, r: 0, w: 434, x: 39 });
check('inherited PUT', inhByMethod.get('PUT'), { n: 345, r: 0, w: 320, x: 25 });
check('inherited PATCH', inhByMethod.get('PATCH'), { n: 84, r: 0, w: 82, x: 2 });
check('step 1 left no GET behind', inhByMethod.has('GET'), false);

// --- step 2 ledger --------------------------------------------------------
const RULES = ['method-floor', 'modify-verb', 'modify-verb-summary'];
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
check('ledger method-floor', ledger['method-floor'], { claimed: 902, right: 836, leaks: 66, over: 0 });
check('ledger modify-verb', ledger['modify-verb'], { claimed: 114, right: 113, leaks: 1, over: 0 });
check('ledger modify-verb-summary', ledger['modify-verb-summary'], { claimed: 118, right: 114, leaks: 4, over: 0 });
const tot = RULES.reduce((a, r) => ({
  claimed: a.claimed + ledger[r].claimed,
  right: a.right + ledger[r].right,
  leaks: a.leaks + ledger[r].leaks,
}), { claimed: 0, right: 0, leaks: 0 });
check('ledger total', tot, { claimed: 1134, right: 1063, leaks: 71 });
check('step 2 leak rate is 6.3%', (100 * tot.leaks / tot.claimed).toFixed(1), '6.3');
check('step 2 claimed 53.5% of what it inherited', (100 * tot.claimed / inherited.length).toFixed(1), '53.5');
const passed = hits.filter(({ hit }) => !hit).map(({ row }) => row);
check('rows left for step 3', passed.length, 985);
check('rows left for step 3 are 46.5% of what it inherited', (100 * passed.length / inherited.length).toFixed(1), '46.5');
check(
  'truth of the rows left for step 3',
  Object.fromEntries(['r', 'w', 'x'].map((c) => [c, passed.filter((r) => r.truth === c).length])),
  { r: 33, w: 153, x: 799 },
);
check('step 2 never assigns r or x', hits.filter(({ hit }) => hit && hit.class !== 'w').length, 0);

// --- the POST leaks, exactly ----------------------------------------------
check(
  'the 5 POST leaks',
  hits.filter(({ row, hit }) => hit && hit.rule !== 'method-floor' && row.truth === 'x')
    .map(({ row }) => `${row.provider} ${row.operationId}`).sort(),
  [
    'mailchimp postCampaignsIdActionsCancelSend',
    'square BatchChangeInventory',
    'stripe PostClimateOrdersOrderCancel',
    'stripe PostPaymentIntentsIntentCancel',
    'stripe PostSubscriptionsSubscriptionExposedId',
  ],
);

// --- the POST rule on its own, and its reach ------------------------------
const postClaimed = hits.filter(({ hit }) => hit && hit.rule !== 'method-floor').map(({ row }) => row);
check(
  'POST rule alone',
  {
    claimed: postClaimed.length,
    right: postClaimed.filter((r) => r.truth === 'w').length,
    leaks: postClaimed.filter((r) => r.truth === 'x').length,
  },
  { claimed: 232, right: 227, leaks: 5 },
);
const postInherited = inherited.filter((r) => r.method === 'POST');
const wPost = postInherited.filter((r) => r.truth === 'w');
const wPostFound = wPost.filter((r) => applyStep2(r)).length;
check('truth-w POST rows found', [wPostFound, wPost.length], [227, 380]);
check('reach is 59.7% of the truth-w POST rows', (100 * wPostFound / wPost.length).toFixed(1), '59.7');

// --- words that never fire ------------------------------------------------
const neverMod = [...MODIFY_VERBS]
  .filter((w) => !postInherited.some((r) => matchesAnyStem(verbForRow(r), new Set([w])))).sort();
check('MODIFY_VERBS that never fire on a POST row', neverMod, ['suspend', 'unpause']);
const postWords = new Map(postInherited.map((r) => [r.rowId, wordsForRow(r)]));
const neverGate = [...OTHER_PARTY]
  .filter((w) => !postInherited.some((r) => postWords.get(r.rowId).includes(w))).sort();
check('OTHER_PARTY words on no POST row', neverGate, ['assignee', 'owner', 'participant', 'recipient', 'roles']);

// --- LOVO — the honest number ---------------------------------------------
// Both lists rebuilt per held-out provider from the other 14 providers'
// corpus rows: a MODIFY verb kept if it fires as another provider's row verb,
// an OTHER_PARTY word kept if it appears in another provider's row words.
// Then only the held-out provider's POST rows are classified.
const allWords = new Map(rows.map((r) => [r.rowId, wordsForRow(r)]));
const allVerbs = new Map(rows.map((r) => [r.rowId, verbForRow(r)]));
let lc = 0, lr = 0, ll = 0;
for (const held of new Set(rows.map((r) => r.provider))) {
  const others = rows.filter((r) => r.provider !== held);
  const mv = new Set([...MODIFY_VERBS].filter((w) => others.some((r) => matchesAnyStem(allVerbs.get(r.rowId), new Set([w])))));
  const op = new Set([...OTHER_PARTY].filter((w) => others.some((r) => allWords.get(r.rowId).includes(w))));
  for (const row of postInherited.filter((r) => r.provider === held)) {
    if (!applyStep2(row, { modifyVerbs: mv, otherParty: op })) continue;
    lc += 1;
    if (row.truth === 'w') lr += 1; else if (row.truth === 'x') ll += 1;
  }
}
check('LOVO', { claimed: lc, right: lr, leaks: ll }, { claimed: 219, right: 212, leaks: 7 });
check('LOVO leak rate is 3.2%', (100 * ll / lc).toFixed(1), '3.2');

// --- whole flow so far ----------------------------------------------------
const ORDER = { r: 0, w: 1, x: 2 };
const flow = rows.map((row) => ({ row, hit: classifyRow(row) }));
check('flow classifies every row', flow.filter(({ hit }) => !hit).length, 0);
const flowExact = flow.filter(({ row, hit }) => hit.class === row.truth).length;
const flowLeaks = flow.filter(({ row, hit }) => ORDER[hit.class] < ORDER[row.truth]).length;
const flowOver = flow.filter(({ row, hit }) => ORDER[hit.class] > ORDER[row.truth]).length;
check('flow exact', flowExact, 3911);
check('flow leaks', flowLeaks, 74);
check('flow over-tight', flowOver, 186);
check('flow exact is 93.8%', (100 * flowExact / rows.length).toFixed(1), '93.8');
check('flow leaks are 1.8%', (100 * flowLeaks / rows.length).toFixed(1), '1.8');
check('flow over-tight is 4.5%', (100 * flowOver / rows.length).toFixed(1), '4.5');

// --- precision per emitted class ------------------------------------------
// "loose-wrong" = the row's truth is tighter than the class emitted, i.e. a
// leak. The x column is the step-3 placeholder, so it cannot leak by
// construction; it is pinned anyway so a future step 3 has to keep it at 0.
function precision(cls) {
  const said = flow.filter(({ hit }) => hit.class === cls);
  return {
    n: said.length,
    right: (100 * said.filter(({ row }) => row.truth === cls).length / said.length).toFixed(1),
    loose: said.filter(({ row }) => ORDER[cls] < ORDER[row.truth]).length,
  };
}
check('says r', precision('r'), { n: 2052, right: '99.9', loose: 3 });
check('says w', precision('w'), { n: 1134, right: '93.7', loose: 71 });
check('says x', precision('x'), { n: 985, right: '81.1', loose: 0 });

if (failures.length) {
  for (const f of failures) console.log('MISMATCH ' + f);
  process.exit(1);
}
console.log('All pins hold.');
