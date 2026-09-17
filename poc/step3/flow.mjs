// The whole ladder: step 1 (r), then step 2 (w), then step 3 (x). Step 1 and
// step 2 are frozen (D74, D75) and are imported unchanged; nothing here
// re-implements or overrides either of them.
import { applyStep1 } from '../step1/step1.mjs';
import { applyStep2 } from '../step2/step2.mjs';
import { applyStep3 } from './step3.mjs';

/**
 * Classify one row through the full flow.
 * @param {{method?:string, operationId?:string, path?:string, summary?:string}} row
 * @returns {{class:'r'|'w'|'x', step:1|2|3, rule:string}}
 */
export function classifyRow(row) {
  const one = applyStep1(row);
  if (one) return one;

  const two = applyStep2(row);
  if (two) {
    // Step 2's word claims (modify-verb, modify-verb-summary) are FINAL:
    // step 3 never overrides them. A word beats no word -- step 2 read the
    // row's verb and decided w on evidence, so step 3's noun scan may only
    // raise the WORDLESS method floor, never a claim step 2 already
    // supported with a word of its own.
    if (two.rule === 'method-floor') {
      const raised = applyStep3(row);
      if (raised) return raised;
    }
    return two;
  }

  // Neither step 1 nor step 2 claimed the row: the named leftover pile.
  // No word fired, only the method is known, and the method here is always
  // POST (steps 1 and 2 between them claim every GET/PUT/DELETE/PATCH row).
  return { class: 'x', step: 3, rule: 'floor-post' };
}
