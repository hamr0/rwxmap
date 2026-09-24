// rwxmap — the package entry point. The mechanical surface is one
// function, classifyRow, which takes an OpenAPI operation and returns the
// r/w/x verdict the D87 ladder reached (see docs/product/prd.md "M3 spec
// (D87)"), plus the two types an adopter needs to name its argument and
// its result.
//
// Also exported: the optional Jev tiers (jev.js) — applyJev, needsJev,
// assertJevMove, jevState, jevQuestions, jevTier, JEV_TIERS, and the four
// threshold constants (JEV_THRESHOLD, JEV_LOWER_THRESHOLD,
// JEV_RAISE_WX_THRESHOLD, JEV_RAISE_GET_THRESHOLD). These tiers are opt-in
// and make no network call themselves; they only decide, given an answer
// the adopter already obtained, whether one verdict moves in the one
// direction its own tier owns (D95): 'floor-post' x lowers to w,
// 'method-floor' w raises to x, or a 'method' r raises to w. The core
// (classifyRow alone) works completely without them.
//
// Everything else in src/ is internal and deliberately NOT re-exported —
// the individual steps, the word lists, the tokeniser. An export is a
// promise, and those are implementation: the word lists change as they are
// measured, and the steps only mean anything in the ladder's order. An
// adopter who needs to know WHY a row was classified reads the verdict's
// own `step`, `rule`, `source` and `matched` fields (and, for a Jev-moved
// row, its `jev` field).
//
// reviewHint IS exported, unlike the steps, because it is not a rule about
// the world: it derives the published `review` field from method + class +
// source, and an adopter re-deriving it by hand would be duplicating the one
// writer of that field.
//
// Also exported: the bareguard exporter (exporter.js) — operationsFrom,
// exportGate and exportSidecar. These are the carrier half of the project,
// and they are a promise worth making because the contract they implement
// is agreed with another repo (D91, amended by D103): an adopter turns a
// parsed OpenAPI document into a draft `tools` section of
// `bareguard.rwx.json` plus a human-facing sidecar, and must be able to do
// that without re-deriving the key shape, the marker or the collision rule
// by hand. operationsFrom does no I/O and no parsing — the caller reads
// and parses the file, which is what keeps this package dependency-free.
//
// The published map emitter (D76/D77's adopter-facing `evidence` floor/list
// map) is deliberately not here yet: the PRD puts it after the ladder, in
// its own pass, and this entry point ships the classifier as it stands
// rather than guessing at that shape.

/** @typedef {import('./types.js').Operation} Operation */
/** @typedef {import('./types.js').Verdict} Verdict */

export { classifyRow, reviewHint } from './flow.js';
export {
  applyJev,
  needsJev,
  assertJevMove,
  jevState,
  jevQuestions,
  jevTier,
  JEV_TIERS,
  JEV_THRESHOLD,
  JEV_LOWER_THRESHOLD,
  JEV_RAISE_WX_THRESHOLD,
  JEV_RAISE_GET_THRESHOLD,
} from './jev.js';
export { operationsFrom, exportGate, exportSidecar } from './exporter.js';
