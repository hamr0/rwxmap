// rwxmap — the package entry point. This is the whole published surface:
// one function, classifyRow, which takes an OpenAPI operation and returns
// the r/w/x verdict the three-step ladder reached, plus the two types an
// adopter needs to name its argument and its result.
//
// Everything else in src/ is internal and deliberately NOT re-exported —
// the individual steps, the word lists, the tokeniser, wordsForStep3,
// floorPost. An export is a promise, and those are implementation: the word
// lists change as they are measured, and the steps only mean anything in
// the ladder's order. An adopter who needs to know WHY a row was classified
// reads the verdict's own `step`, `rule`, `source` and `matched` fields.
//
// The published map emitter (D76/D77's adopter-facing `evidence` floor/list
// map) is deliberately not here yet: the PRD puts it after step 3, in its
// own pass, and this entry point ships the classifier as it stands rather
// than guessing at that shape.

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

export { classifyRow } from './flow.js';
