// The three per-goal ledgers, each charged only to the goal that owns it,
// plus a combined line that is never used in place of a per-goal number.
//
// Goal 1 is a standalone classifier (the user's ruling, 2026-09-13), not
// a pipeline layer — its ledger runs classifyGoal1 directly over every
// row, not classify(row, ctx, { upTo: 'goal1' }).
import { CLASS_ORDER } from '../arbiter/arbiter.mjs';
import { classify } from './pipeline.mjs';
import { classifyGoal1 } from '../goal1/goal1.mjs';

const isGoal2Leak = (pred, truth) => truth === 'x' && pred === 'w';
const isGoal1FalseAlarm = (pred, truth) => truth === 'w' && pred === 'x';
const isGoal1Leak = (pred, truth) => truth === 'x' && pred === 'w';
const isOverTight = (pred, truth) => truth === 'r' && pred !== 'r';
const isLoosening = (pred, truth) => CLASS_ORDER[pred] < CLASS_ORDER[truth];

// Goal 1 only classifies PUT/DELETE/PATCH (classifyGoal1 returns every
// other method's untouched floor); its ledger is scored over that same
// population, matching the reference measurement (g1block.mjs). A truth-w
// POST row sitting at the POST floor's default 'x' is a floor-level
// mismatch no goal-1 rule ever produced or could fix — charging it to
// goal 1's ledger inflated false alarms from 803 to 906 (103 = the count
// of truth-w POST rows) before this scoping was added.
const GOAL1_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

function countAt(rows, ctx, upTo, predicate) {
  let n = 0;
  for (const row of rows) {
    const res = classify(row, ctx, { upTo });
    if (predicate(res.class, row.gt_class)) n += 1;
  }
  return n;
}

// rows, ctx (from run/context.mjs's loadContext()) -> per-goal ledger.
export function computeLedger(rows, ctx) {
  const goal2Leaks = countAt(rows, ctx, 'goal2', isGoal2Leak);

  let goal1FalseAlarms = 0;
  let goal1Leaks = 0;
  for (const row of rows) {
    if (!GOAL1_METHODS.has(row.method)) continue;
    const res = classifyGoal1(row, ctx);
    if (isGoal1FalseAlarm(res.class, row.gt_class)) goal1FalseAlarms += 1;
    if (isGoal1Leak(res.class, row.gt_class)) goal1Leaks += 1;
  }

  const goal3OverTight = countAt(rows, ctx, 'goal3', isOverTight);
  const loosingAtGoal3 = countAt(rows, ctx, 'goal3', isLoosening);
  const loosingAtGoal2 = countAt(rows, ctx, 'goal2', isLoosening);
  const goal3LeakCost = loosingAtGoal3 - loosingAtGoal2;

  const combined = {
    goal2Leaks: countAt(rows, ctx, 'goal3', isGoal2Leak),
    goal1FalseAlarms,
    goal3OverTight,
  };

  return {
    goal2: { leaks: goal2Leaks },
    goal1: { falseAlarms: goal1FalseAlarms, leaks: goal1Leaks },
    goal3: { overTight: goal3OverTight, leakCost: goal3LeakCost },
    combined,
  };
}
