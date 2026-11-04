// The D133 second pass (mode a: mechanical -> rwxlite). Mechanical has
// already classified every row; this file asks an ENGINE about exactly the
// rows mechanical marks for a human (review 'loose' or 'tight') and applies
// what comes back under fixed rules. It holds no word list and runs no model:
// the engine is a function handed in (rwxlite itself, or a stub in a test).
//
// Each item sent to the engine carries `lean: {class, rule}`, rwxmap's own
// mechanical verdict for that row (class r|w|x, rule = the verdict's internal
// rule name). It goes only to the engine; it is never published.
//
// ENGINE CONTRACT. `engine(items)` is async and returns an array aligned with
// `items`. Each element is either `{pIsX, pChanges, model}` or an error /
// missing value (undefined, null, `{error}`, anything else). Both questions
// are answered in one request. From them:
//     p(x) = pIsX      p(w) = pChanges - pIsX      p(r) = 1 - pChanges
// The engine's letter L is the largest of the three (a tie goes to the
// tighter class); p is that share.
//
// RULES, per sent row with mechanical letter M:
//   error, timeout, malformed answer  -> class x, undecided (review tight).
//     Malformed = non-finite or out-of-[0,1] p, pChanges < pIsX, a missing
//     model string, or a model string other than the run's model.
//   L > M (raise)   -> accept L. review: tight if L is x, else loose.
//   L == M (keep)   -> keep the verdict untouched (its review stays as derived).
//   L < M (lower)   -> accept L only if p >= LOWER_MIN_P, review loose;
//                      otherwise class x, undecided (review tight).
// 'settled' rows are never sent and never change.
//
// WRITERS. The `review` marker is written only by flow.js's reviewHint; this
// file passes it what the second pass did. `evidence` (the verdict's `source`)
// is 'rwxlite' on a row the pass MOVED (raised, lowered, or undecided and pushed
// to x) and exactly as mechanical had it on a row it kept or left undecided at
// x. `destructive` follows the same rule as jev.js's applyJev: a moved verdict has no word behind it, so it carries none;
// a row left at x by the second pass keeps what mechanical gave it.
import { reviewHint } from './flow.js';
import { parseModelString } from './modelcache.js';

/** @typedef {import('./types.js').Verdict} Verdict */
/** @typedef {import('./types.js').Operation} Operation */

/** A lowering is accepted only at or above this share (rwxlite's measured cut-off). */
export const LOWER_MIN_P = 0.97;

const RANK = { r: 0, w: 1, x: 2 };

/**
 * @typedef {{index: number, method?: string, path?: string, operationId?: string, summary?: string, description?: string, lean: {class: 'r'|'w'|'x', rule: string}}} EngineItem
 * @typedef {(items: EngineItem[]) => Promise<Array<{pIsX?: unknown, pChanges?: unknown, model?: unknown, error?: unknown}|null|undefined>>} Engine
 */

/**
 * The engine's letter and share from a usable answer, or null when the answer
 * is unusable (error, missing or malformed).
 * @param {any} answer
 * @param {string} model the run's model string
 * @returns {{letter: 'r'|'w'|'x', p: number}|null}
 */
function readAnswer(answer, model) {
  if (!answer || typeof answer !== 'object' || answer.error) return null;
  const { pIsX, pChanges } = answer;
  if (typeof pIsX !== 'number' || !Number.isFinite(pIsX) || pIsX < 0 || pIsX > 1) return null;
  if (typeof pChanges !== 'number' || !Number.isFinite(pChanges) || pChanges < 0 || pChanges > 1) return null;
  if (pChanges < pIsX) return null;
  if (typeof answer.model !== 'string' || answer.model === '' || answer.model !== model) return null;
  const px = pIsX;
  const pw = pChanges - pIsX;
  const pr = 1 - pChanges;
  if (px >= pw && px >= pr) return { letter: 'x', p: px };
  if (pw >= pr) return { letter: 'w', p: pw };
  return { letter: 'r', p: pr };
}

/**
 * Run the second pass. Never throws on an engine failure: a failed engine
 * call leaves every sent row undecided (x, review tight). Throws only on a
 * bad CALL (a malformed model string, mismatched lengths): invalid input fails
 * loudly, it never falls back to mechanical.
 *
 * @param {Operation[]} ops
 * @param {Verdict[]} verdicts mechanical verdicts, same order as ops; not mutated.
 * @param {Engine} engine
 * @param {{model: string}} options the run's model string, rwxlite-<semver>+<sha8>.
 * @returns {Promise<{verdicts: Verdict[], summary: {model: string, sent: number, raised: number, lowered: number, kept: number, undecided: number}}>}
 */
export async function secondPass(ops, verdicts, engine, options) {
  const model = options && options.model;
  parseModelString(model);
  if (typeof engine !== 'function') throw new Error('secondPass: engine must be a function');
  if (!Array.isArray(ops) || !Array.isArray(verdicts) || ops.length !== verdicts.length) {
    throw new Error('secondPass: ops and verdicts must be arrays of the same length');
  }

  /** @type {EngineItem[]} */
  const items = [];
  verdicts.forEach((v, index) => {
    if (v.review !== 'loose' && v.review !== 'tight') return;
    const { method, path, operationId, summary, description } = ops[index];
    items.push({ index, method, path, operationId, summary, description, lean: { class: v.class, rule: v.rule } });
  });

  /** @type {any[]} */
  let answers = [];
  if (items.length > 0) {
    try {
      const got = await engine(items);
      if (Array.isArray(got)) answers = got;
    } catch {
      answers = [];
    }
  }

  const out = verdicts.slice();
  const summary = { model, sent: items.length, raised: 0, lowered: 0, kept: 0, undecided: 0 };

  items.forEach((item, i) => {
    const v = verdicts[item.index];
    const method = ops[item.index].method;
    const read = readAnswer(answers[i], model);

    if (read && read.letter === v.class) {
      summary.kept += 1;
      return;
    }
    if (read && RANK[read.letter] > RANK[v.class]) {
      summary.raised += 1;
      out[item.index] = moved(v, read.letter, 'rwxlite-raise', reviewHint(method, read.letter, v.source, 'raised'));
      return;
    }
    if (read && read.p >= LOWER_MIN_P) {
      summary.lowered += 1;
      out[item.index] = moved(v, read.letter, 'rwxlite-lower', reviewHint(method, read.letter, v.source, 'lowered'));
      return;
    }
    // Undecided: an unusable answer, or a lowering short of the cut-off.
    summary.undecided += 1;
    const review = reviewHint(method, 'x', v.source, 'undecided');
    out[item.index] = v.class === 'x'
      ? { ...v, review }
      : moved(v, 'x', 'rwxlite-undecided', review);
  });

  return { verdicts: out, summary };
}

/**
 * A verdict the second pass moved: new class, rule, review and source
 * (evidence 'rwxlite'); step and matched stay as mechanical had them; no
 * `destructive`.
 * @param {Verdict} v
 * @param {'r'|'w'|'x'} cls
 * @param {string} rule
 * @param {'tight'|'loose'|'settled'} review
 * @returns {Verdict}
 */
function moved(v, cls, rule, review) {
  return { class: cls, step: v.step, rule, source: 'rwxlite', matched: v.matched, review };
}
