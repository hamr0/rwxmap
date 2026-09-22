// rwxmap — the package entry point. The mechanical surface is one
// function, classifyRow, which takes an OpenAPI operation and returns the
// r/w/x verdict the D87 ladder reached (see docs/product/prd.md "M3 spec
// (D87)"), plus the two types an adopter needs to name its argument and
// its result.
//
// Also exported: the optional D88 Jev tier (jev.js) — applyJev, needsJev,
// jevState, jevQuestions, JEV_THRESHOLD. This tier is opt-in and makes no
// network call itself; it only decides, given an answer the adopter
// already obtained, whether a 'floor-post' verdict lowers from x to w. The
// core (classifyRow alone) works completely without it.
//
// Everything else in src/ is internal and deliberately NOT re-exported —
// the individual steps, the word lists, the tokeniser. An export is a
// promise, and those are implementation: the word lists change as they are
// measured, and the steps only mean anything in the ladder's order. An
// adopter who needs to know WHY a row was classified reads the verdict's
// own `step`, `rule`, `source` and `matched` fields (and, for a Jev-lowered
// row, its `jev` field).
//
// The published map emitter (D76/D77's adopter-facing `evidence` floor/list
// map) is deliberately not here yet: the PRD puts it after the ladder, in
// its own pass, and this entry point ships the classifier as it stands
// rather than guessing at that shape.

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

export { classifyRow } from './flow.js';
export { applyJev, needsJev, jevState, jevQuestions, JEV_THRESHOLD } from './jev.js';
