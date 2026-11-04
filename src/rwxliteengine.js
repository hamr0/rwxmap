// The rwxlite adapter (D133): turns the `rwxlite` package's answerer into the
// engine function secondpass.js takes. rwxlite is loaded with a dynamic
// import, so rwxmap works (mechanical alone) when it is not installed.
//
// rwxlite's shapes (its src/answerer.js):
//   request  {state: {method, path, operationId, summary, description},
//             questions: {isX: 1, changes: 1}, lean: {class, rule}}
//   success  {model, answers: {isX: {noul}, changes: {noul}}}
//            isX.noul = p(x), changes.noul = p(w) + p(x)
//   no answer {model, error}
// secondPass wants {pIsX, pChanges, model} or an error; anything that is not a
// well-formed success becomes {error}, which secondPass counts as undecided.
import * as os from 'node:os';

/** Rows per answerMany call: bounds the model's memory on a big spec. */
const CHUNK = 64;

/** @param {unknown} e @returns {string} */
function msg(e) { return e instanceof Error ? e.message : String(e); }

/**
 * One rwxlite slot -> one secondPass answer.
 * @param {any} slot
 * @returns {{pIsX: number, pChanges: number, model: string} | {error: string}}
 */
function mapSlot(slot) {
  if (!slot || typeof slot !== 'object') return { error: 'malformed rwxlite answer' };
  if ('error' in slot) return { error: String(slot.error) };
  const isX = slot.answers?.isX?.noul;
  const changes = slot.answers?.changes?.noul;
  if (typeof isX !== 'number' || typeof changes !== 'number' || typeof slot.model !== 'string') return { error: 'malformed rwxlite answer' };
  return { pIsX: isX, pChanges: changes, model: slot.model };
}

/**
 * Load rwxlite on a verified model folder.
 *   {status: 'on', engine: {model, run}}   engine.model is the folder's model string
 *   {status: 'off', reason}                mechanical alone, reason is printed
 * @param {{dir: string, model: string, importer?: (name: string) => Promise<any>, threads?: number}} opts
 * @returns {Promise<{status: 'on', engine: {model: string, run: import('./secondpass.js').Engine}} | {status: 'off', reason: string}>}
 */
export async function loadRwxliteEngine({ dir, model, importer = (name) => import(name), threads = Math.min(4, os.availableParallelism()) }) {
  let lib;
  try {
    lib = await importer('rwxlite');
  } catch (err) {
    const e = /** @type {any} */ (err);
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /['"]rwxlite['"]/.test(String(e.message))) {
      return { status: 'off', reason: 'the rwxlite package is not installed (npm install rwxlite)' };
    }
    return { status: 'off', reason: `the rwxlite package could not be loaded (${msg(err)})` };
  }
  let answerer;
  try {
    answerer = await lib.loadAnswerer({ dir, threads });
  } catch (err) {
    const m = msg(err);
    const hint = /onnxruntime-node/.test(m) ? ' (install it with ONNXRUNTIME_NODE_INSTALL=skip npm install onnxruntime-node to skip the large GPU libraries)' : '';
    return { status: 'off', reason: `rwxlite could not load the model (${m})${hint}` };
  }
  if (!answerer || typeof answerer.answerMany !== 'function') return { status: 'off', reason: 'the rwxlite package has no answerMany' };
  if (answerer.model !== model) {
    return { status: 'off', reason: `rwxlite reports model ${answerer.model} but the verified folder is ${model}` };
  }

  /** @type {import('./secondpass.js').Engine} */
  const run = async (items) => {
    /** @type {any[]} */
    const out = [];
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      const reqs = chunk.map((it) => ({
        state: { method: it.method, path: it.path, operationId: it.operationId, summary: it.summary, description: it.description },
        questions: { isX: 1, changes: 1 },
        lean: it.lean,
      }));
      let got;
      try { got = await answerer.answerMany(reqs); } catch (err) { got = null; out.push(...chunk.map(() => ({ error: msg(err) }))); }
      if (got === null) continue;
      if (!Array.isArray(got) || got.length !== chunk.length) {
        out.push(...chunk.map(() => ({ error: 'rwxlite returned the wrong number of answers' })));
        continue;
      }
      out.push(...got.map(mapSlot));
    }
    return out;
  };
  return { status: 'on', engine: { model, run } };
}
