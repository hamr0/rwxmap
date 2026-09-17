// Proof for step 3 — run with: node poc/step3/proof.mjs
// Re-computes every pinned number from the corpus and asserts it. Prints
// "All pins hold." and exits 0, or prints each mismatch and exits 1.
import { loadRows } from '../step1/corpus.mjs';
import { applyStep1 } from '../step1/step1.mjs';
import { applyStep2 } from '../step2/step2.mjs';
import { applyStep3, RAISE_WORDS, wordsForStep3 } from './step3.mjs';
import { classifyRow } from './flow.mjs';

const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) failures.push(`${name}: got ${g}, want ${w}`);
}

const rows = loadRows();
check('corpus rows', rows.length, 4171);
check('RAISE_WORDS size', RAISE_WORDS.size, 17);

const ORDER = { r: 0, w: 1, x: 2 };

// --- the method-floor pile step 3's raise-word rule reaches into ----------
const inherited = rows.filter((r) => !applyStep1(r));
const step2hits = inherited.map((row) => ({ row, hit: applyStep2(row) }));
const floorRows = step2hits.filter(({ hit }) => hit && hit.rule === 'method-floor').map(({ row }) => row);
check('method-floor pile', floorRows.length, 902);

const raised = floorRows.map((row) => ({ row, hit: applyStep3(row) })).filter(({ hit }) => hit);
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

const floorPost = flow.filter(({ hit }) => hit.rule === 'floor-post');
check('floor-post is the leftover pile, all POST', {
  n: floorPost.length,
  allPost: floorPost.every(({ row }) => row.method === 'POST'),
}, { n: 985, allPost: true });
check(
  'floor-post truth',
  {
    r: floorPost.filter(({ row }) => row.truth === 'r').length,
    w: floorPost.filter(({ row }) => row.truth === 'w').length,
    x: floorPost.filter(({ row }) => row.truth === 'x').length,
  },
  { r: 33, w: 153, x: 799 },
);
check('floor-post right rate is 81.1%', (100 * floorPost.filter(({ row }) => row.truth === 'x').length / floorPost.length).toFixed(1), '81.1');

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
let lc = 0, lr = 0;
for (const held of new Set(rows.map((r) => r.provider))) {
  const others = rows.filter((r) => r.provider !== held);
  const othersInherited = others.filter((r) => !applyStep1(r));
  const othersFloor = othersInherited.filter((r) => {
    const h = applyStep2(r);
    return h && h.rule === 'method-floor';
  });
  const othersWords = new Map(othersFloor.map((r) => [r.rowId, wordsForStep3(r)]));
  const kept = new Set([...RAISE_WORDS].filter((w) => othersFloor.some((r) => othersWords.get(r.rowId).includes(w))));
  const mineFloor = floorRows.filter((r) => r.provider === held);
  for (const row of mineFloor) {
    const hit = applyStep3(row, kept);
    if (!hit) continue;
    lc += 1;
    if (row.truth === 'x') lr += 1;
  }
}
check('LOVO raise-word', { claimed: lc, right: lr }, { claimed: 6, right: 6 });

if (failures.length) {
  for (const f of failures) console.log('MISMATCH ' + f);
  process.exit(1);
}
console.log('All pins hold.');
