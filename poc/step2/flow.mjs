// The flow so far: step 1 (r), then step 2 (w), then a placeholder floor.
// Step 1 is frozen (D74) and is imported unchanged.
import { applyStep1 } from '../step1/step1.mjs';
import { applyStep2 } from './step2.mjs';

/**
 * Classify one row through every step built so far.
 * @param {{method?:string, operationId?:string, path?:string, summary?:string}} row
 * @returns {{class:'r'|'w'|'x', step:1|2|3, rule:string}}
 */
export function classifyRow(row) {
  const one = applyStep1(row);
  if (one) return one;
  const two = applyStep2(row);
  if (two) return two;
  // STEP 3 IS NOT BUILT. This is a placeholder floor, not a rule: every row
  // neither step claimed is called x because x is the tighter class and the
  // invariant says the tool never loosens without evidence. When step 3
  // exists it replaces this line.
  return { class: 'x', step: 3, rule: 'unclaimed' };
}
