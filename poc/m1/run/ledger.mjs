// The three per-goal ledgers, each charged only to the goal that owns it,
// plus a combined line that is never used in place of a per-goal number.
import { CLASS_ORDER } from '../arbiter/arbiter.mjs';
import { classify } from './pipeline.mjs';

const isGoal2Leak = (pred, truth) => truth === 'x' && pred === 'w';
const isGoal1FalseAlarm = (pred, truth) => truth === 'w' && pred === 'x';
const isOverTight = (pred, truth) => truth === 'r' && pred !== 'r';
const isLoosening = (pred, truth) => CLASS_ORDER[pred] < CLASS_ORDER[truth];

function countAt(rows, ctx, upTo, predicate) {
  let n = 0;
  for (const row of rows) {
    const res = classify(row, ctx, { upTo });
    if (predicate(res.class, row.gt_class)) n += 1;
  }
  return n;
}

// rows, ctx (from core/corpus.mjs's loadContext()) -> per-goal ledger.
export function computeLedger(rows, ctx) {
  const goal2Leaks = countAt(rows, ctx, 'goal2', isGoal2Leak);

  const goal1FalseAlarms = countAt(rows, ctx, 'goal1', isGoal1FalseAlarm);
  const goal2LeaksAtGoal1 = countAt(rows, ctx, 'goal1', isGoal2Leak);
  const goal1LeakCost = goal2LeaksAtGoal1 - goal2Leaks;

  const goal3OverTight = countAt(rows, ctx, 'goal3', isOverTight);
  const loosingAtGoal3 = countAt(rows, ctx, 'goal3', isLoosening);
  const loosingAtGoal1 = countAt(rows, ctx, 'goal1', isLoosening);
  const goal3LeakCost = loosingAtGoal3 - loosingAtGoal1;

  const combined = {
    goal2Leaks: countAt(rows, ctx, 'goal3', isGoal2Leak),
    goal1FalseAlarms: countAt(rows, ctx, 'goal3', isGoal1FalseAlarm),
    goal3OverTight,
  };

  return {
    goal2: { leaks: goal2Leaks },
    goal1: { falseAlarms: goal1FalseAlarms, leakCost: goal1LeakCost },
    goal3: { overTight: goal3OverTight, leakCost: goal3LeakCost },
    combined,
  };
}
