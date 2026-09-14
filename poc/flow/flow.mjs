// The one classifier entry point for poc/flow: step 1 first, then (once
// step 2 exists) step 2, then the floor as step 3's placeholder. Order is
// fixed here and nowhere else.
import { applyStep1 } from './step1.mjs';
import { floorFor } from './floor.mjs';

const CLASS_ORDER = { r: 0, w: 1, x: 2 };

// ctx is unused for now but kept for step 2, which will need it.
export function classifyRow(row, ctx) {
  const step1 = applyStep1(row);
  if (step1) return { ...step1, flag: '' };

  // step 2 goes here

  if (row.method === 'PUT' || row.method === 'DELETE' || row.method === 'PATCH') {
    return { class: floorFor(row.method), step: 2, rule: 'floor', flag: '' };
  }
  return { class: floorFor(row.method), step: 3, rule: 'floor', flag: '' };
}

export function scoreRows(rows, ctx) {
  let step1OverTight = 0;
  let step1Leaks = 0;
  let floorGetLeaks = 0;
  let exact = 0;
  let leaks = 0;
  let overTight = 0;

  for (const row of rows) {
    const result = classifyRow(row, ctx);
    const truth = row.gt_class;

    if (truth === 'r' && result.class !== 'r') step1OverTight += 1;
    if (result.step === 1 && result.rule === 'read-verb' && truth !== 'r') step1Leaks += 1;
    if ((row.method === 'GET' || row.method === 'HEAD' || row.method === 'OPTIONS') && (truth === 'w' || truth === 'x')) {
      floorGetLeaks += 1;
    }

    if (result.class === truth) {
      exact += 1;
    } else if (CLASS_ORDER[result.class] < CLASS_ORDER[truth]) {
      leaks += 1;
    } else if (CLASS_ORDER[result.class] > CLASS_ORDER[truth]) {
      overTight += 1;
    }
  }

  return {
    step1: { overTight: step1OverTight, leaks: step1Leaks },
    floorGet: { leaks: floorGetLeaks },
    exact,
    leaks,
    overTight,
  };
}
