// The three per-step ledgers, each charged only to the step that owns it,
// plus a combined line that is never used in place of a per-step number.
//
// Step 2 is a standalone classifier (the user's ruling, 2026-09-13), not
// a pipeline layer — its ledger runs classifyStep2 directly over every
// row, not classify(row, ctx, { upTo: 'step2' }).
import { CLASS_ORDER } from '../arbiter/arbiter.mjs';
import { classify } from './pipeline.mjs';
import { classifyStep2 } from '../step2/step2.mjs';

const isStep3Leak = (pred, truth) => truth === 'x' && pred === 'w';
const isStep2FalseAlarm = (pred, truth) => truth === 'w' && pred === 'x';
const isStep2Leak = (pred, truth) => truth === 'x' && pred === 'w';
const isOverTight = (pred, truth) => truth === 'r' && pred !== 'r';
const isLoosening = (pred, truth) => CLASS_ORDER[pred] < CLASS_ORDER[truth];

// Step 2 only classifies PUT/DELETE/PATCH (classifyStep2 returns every
// other method's untouched floor); its ledger is scored over that same
// population, matching the reference measurement (g1block.mjs). A truth-w
// POST row sitting at the POST floor's default 'x' is a floor-level
// mismatch no step-2 rule ever produced or could fix — charging it to
// step 2's ledger inflated false alarms from 803 to 906 (103 = the count
// of truth-w POST rows) before this scoping was added.
const STEP2_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

function countAt(rows, ctx, upTo, predicate) {
  let n = 0;
  for (const row of rows) {
    const res = classify(row, ctx, { upTo });
    if (predicate(res.class, row.gt_class)) n += 1;
  }
  return n;
}

// rows, ctx (from run/context.mjs's loadContext()) -> per-step ledger.
export function computeLedger(rows, ctx) {
  const step3Leaks = countAt(rows, ctx, 'step3', isStep3Leak);

  let step2FalseAlarms = 0;
  let step2Leaks = 0;
  for (const row of rows) {
    if (!STEP2_METHODS.has(row.method)) continue;
    const res = classifyStep2(row, ctx);
    if (isStep2FalseAlarm(res.class, row.gt_class)) step2FalseAlarms += 1;
    if (isStep2Leak(res.class, row.gt_class)) step2Leaks += 1;
  }

  const step1OverTight = countAt(rows, ctx, 'step3', isOverTight);
  const loosingAtStep1 = countAt(rows, ctx, 'step3', isLoosening);
  const loosingAtStep3 = countAt(rows, ctx, 'step3', isLoosening);
  const step1LeakCost = loosingAtStep1 - loosingAtStep3;

  const combined = {
    step3Leaks: countAt(rows, ctx, 'step3', isStep3Leak),
    step2FalseAlarms,
    step1OverTight,
  };

  return {
    step3: { leaks: step3Leaks },
    step2: { falseAlarms: step2FalseAlarms, leaks: step2Leaks },
    step1: { overTight: step1OverTight, leakCost: step1LeakCost },
    combined,
  };
}
