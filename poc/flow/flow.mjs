// The one classifier entry point for poc/flow: step 1 first, then step 2,
// then the floor as step 3's placeholder for whatever POST leaves behind.
// Order is fixed here and nowhere else.
import { applyStep1 } from './step1.mjs';
import { floorFor } from './floor.mjs';
import { buildStep2Context, classifyStep2 } from './step2.mjs';

const CLASS_ORDER = { r: 0, w: 1, x: 2 };

// The one ctx the flow needs, built once per corpus.
export function buildContext(rows, vendors) {
  return buildStep2Context(rows, vendors);
}

export function classifyRow(row, ctx) {
  const step1 = applyStep1(row);
  if (step1) return { ...step1, flag: '' };

  const step2 = classifyStep2(row, ctx);
  if (step2) return step2;

  return { class: floorFor(row.method), step: 3, rule: 'floor', flag: '' };
}

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

export function scoreRows(rows, ctx) {
  let step1OverTight = 0;
  let step1Leaks = 0;
  let floorGetLeaks = 0;
  let exact = 0;
  let leaks = 0;
  let overTight = 0;
  let step2FalseAlarms = 0;
  let step2Leaks = 0;
  let step2XPileRows = 0;
  let step2XPileLeaks = 0;
  const byMethod = {};

  for (const row of rows) {
    const result = classifyRow(row, ctx);
    const truth = row.gt_class;

    if (truth === 'r' && result.class !== 'r') step1OverTight += 1;
    if (result.step === 1 && result.rule === 'read-verb' && truth !== 'r') step1Leaks += 1;
    if ((row.method === 'GET' || row.method === 'HEAD' || row.method === 'OPTIONS') && (truth === 'w' || truth === 'x')) {
      floorGetLeaks += 1;
    }
    if (RAISE_METHODS.has(row.method)) {
      if (truth === 'w' && result.class === 'x') step2FalseAlarms += 1;
      if (truth === 'x' && result.class === 'w') step2Leaks += 1;
      if (result.flag === 'x-pile') {
        step2XPileRows += 1;
        if (truth === 'x') step2XPileLeaks += 1;
      }
    }

    if (!byMethod[row.method]) byMethod[row.method] = { n: 0, leaks: 0, overTight: 0 };
    const m = byMethod[row.method];
    m.n += 1;

    if (result.class === truth) {
      exact += 1;
    } else if (CLASS_ORDER[result.class] < CLASS_ORDER[truth]) {
      leaks += 1;
      m.leaks += 1;
    } else if (CLASS_ORDER[result.class] > CLASS_ORDER[truth]) {
      overTight += 1;
      m.overTight += 1;
    }
  }

  return {
    step1: { overTight: step1OverTight, leaks: step1Leaks },
    floorGet: { leaks: floorGetLeaks },
    step2: {
      falseAlarms: step2FalseAlarms,
      leaks: step2Leaks,
      xPile: { rows: step2XPileRows, leaks: step2XPileLeaks },
    },
    exact,
    leaks,
    overTight,
    byMethod,
  };
}
