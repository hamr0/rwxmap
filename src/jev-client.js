// The Jev network client (PRD "What is next" item c, D118) — the plain
// Node `fetch` plumbing jev.js's own header says the caller must supply:
// "the caller obtains the model's answer and passes it to applyJev."
// src/cli.js is that caller.
//
// NOT CORE (D109): this file makes no r/w/x judgement and holds no word
// list. It only turns a jev.js question (jevState/jevQuestions) into an
// HTTP request, and a response into `{p, model}` for applyJev to read.
// jev.js itself stays pure and network-free (imported here read-only,
// never edited).
//
// Request shape and endpoint copied from poc/jev-tiers/run.mjs (the
// reference runner, D118): POST `{ state, model, questions }` to
// https://api.typesafe.ai/v1/systemone, `Authorization: Bearer <key>`.
// Response -> `{p, model}` exactly as poc/jev-tiers/score.mjs's answerP
// reads it: `answers[<question key>].noul` is the probability, and the
// question key is `isX` for jev-lower/jev-raise-wx and `changes` for
// jev-raise-get (jev.js's own TIERS table).
//
// Per-request timeout: 30s, via AbortSignal.timeout (D118). Retry with
// exponential backoff (500ms doubling, capped at 16s) on 429/529 ONLY, at
// most 5 retries — mirrors run.mjs's own retry. Any other failure
// (network error, timeout, a non-retryable or retry-exhausted HTTP
// status, malformed JSON, a missing/malformed answer for this tier's own
// question) is NOT retried: it throws, and the caller (runJevBatch below)
// turns that into a `null` result for the row. jev.js's applyJev is
// ALSO fail-closed on a bad answer — this file's own validation is a
// second, independent gate, never the only one a bad answer has to pass.
//
// `fetch` is injectable (the `fetchImpl` option) so a test never makes a
// real network call and the key it uses is always a fake one — no test
// in this file, or in cli.test.js, may reach the real endpoint.
//
// The key is read only far enough to put it in the Authorization header;
// it is never logged, printed, or included in a thrown Error's message.

import { jevState, jevQuestions } from './jev.js';

/** @typedef {import('./types.js').Operation} Operation */

/**
 * The minimal shape this file asks of `fetch`: real `fetch`'s own
 * signature is structurally wider than this (a real Response has plenty
 * more than `ok`/`status`/`json()`), so `globalThis.fetch` satisfies it
 * directly, and a test's fetch stub only has to build this much, never a
 * full Response stand-in.
 * @typedef {(url: string, init: {method: string, headers: Record<string, string>, body: string, signal: AbortSignal}) => Promise<{ok: boolean, status: number, json: () => Promise<any>}>} FetchLike
 */

/** The Jev endpoint (poc/jev-tiers/run.mjs:26), exported so a test can
 * assert against it without hard-coding the string twice. */
export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

/** The model requested when a caller does not override it. */
export const JEV_MODEL = 'jev-latest';

/** Default fan-out for runJevBatch (D118: "Concurrency 4"). */
export const JEV_CONCURRENCY = 4;

/** Default per-request timeout (D118: "Per-request timeout 30 s"). */
export const JEV_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 5;
/** Default retry backoff base (D118: "500 ms doubling, capped at 16 s"). */
export const JEV_RETRY_BASE_MS = 500;
const JEV_RETRY_CAP_MS = 16_000;

/**
 * Which Noul key this tier's answer lives under (jev.js's own TIERS
 * table: `question: 'isX'` for jev-lower/jev-raise-wx, `'changes'` for
 * jev-raise-get).
 * @param {string} tier
 * @returns {string}
 */
function questionKeyFor(tier) {
  return tier === 'jev-raise-get' ? 'changes' : 'isX';
}

/**
 * One HTTP attempt, retrying only on 429/529 with capped exponential
 * backoff. Throws on every other kind of failure — see the file header
 * for why that is correct here, not a bug to soften.
 *
 * @param {FetchLike} fetchImpl
 * @param {string} key
 * @param {object} body
 * @param {number} attempt
 * @param {number} timeoutMs
 * @param {number} retryBaseMs
 * @returns {Promise<any>} the parsed JSON response body.
 */
async function postOnce(fetchImpl, key, body, attempt, timeoutMs, retryBaseMs) {
  let res;
  try {
    res = await fetchImpl(JEV_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Deliberately does not interpolate `key` or the raw error object,
    // which could carry request internals — only the error's own message.
    throw new Error(`jev: request failed (${err instanceof Error ? err.message : 'network error'})`);
  }

  if (res.status === 429 || res.status === 529) {
    if (attempt >= MAX_RETRIES) throw new Error(`jev: HTTP ${res.status} after ${attempt} retries`);
    const wait = Math.min(2 ** attempt * retryBaseMs, JEV_RETRY_CAP_MS);
    await new Promise((resolve) => { setTimeout(resolve, wait); });
    return postOnce(fetchImpl, key, body, attempt + 1, timeoutMs, retryBaseMs);
  }

  if (!res.ok) throw new Error(`jev: HTTP ${res.status}`);

  try {
    return await res.json();
  } catch {
    throw new Error('jev: malformed JSON response');
  }
}

/**
 * Ask Jev one tier's question about one row. Sends ONLY the five fields
 * jevState(row) reads (method, path, operationId, summary, description)
 * plus the tier's own question (jevQuestions) and the model name — never
 * the row's mechanical verdict, truth label, or anything else the row
 * object might carry.
 *
 * @param {Operation} row
 * @param {string} tier  one of jev.js's JEV_TIERS.
 * @param {{fetchImpl: FetchLike, key: string, model?: string, timeoutMs?: number, retryBaseMs?: number}} opts
 *   `timeoutMs` defaults to JEV_TIMEOUT_MS (30s) and `retryBaseMs` to
 *   JEV_RETRY_BASE_MS (500ms); a test may override either to stay fast, a
 *   real run never does.
 * @returns {Promise<{p: number, model: string, usage: {input: number, output: number}}>}
 *   throws on any unusable answer (see the file header) rather than
 *   returning one. `usage` is the response's own `usage.input_tokens` /
 *   `usage.output_tokens` (poc/jev-tiers/run.mjs:93), a missing or
 *   non-number field counted as 0. It is cost bookkeeping only: it never
 *   decides whether the answer is usable, and the caller hands applyJev
 *   only `{p, model}`.
 */
export async function askJev(row, tier, opts) {
  const { fetchImpl, key, model = JEV_MODEL, timeoutMs = JEV_TIMEOUT_MS, retryBaseMs = JEV_RETRY_BASE_MS } = opts;
  const body = { state: jevState(row), model, questions: jevQuestions(tier) };
  const json = await postOnce(fetchImpl, key, body, 0, timeoutMs, retryBaseMs);

  const qKey = questionKeyFor(tier);
  const answer = json && typeof json === 'object' && json.answers && typeof json.answers === 'object'
    ? json.answers[qKey]
    : undefined;
  const p = answer && typeof answer === 'object' ? answer.noul : undefined;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
    throw new Error('jev: missing or malformed answer');
  }
  // The RESPONSE's own model string, never the request's own `model`
  // param as a fallback: a response that omits its model is exactly the
  // "moves the class but carries no model string" case applyJev's own
  // header calls out as worse than not moving at all, so this file must
  // treat it as unusable too, not paper over it with the model we asked
  // for (which the response is free to have ignored or overridden).
  const answeredModel = json && typeof json.model === 'string' ? json.model : '';
  if (answeredModel === '') {
    throw new Error('jev: response carries no model string');
  }

  return { p, model: answeredModel, usage: usageOf(json) };
}

/**
 * Token counts from a response's `usage`, each 0 when missing or not a
 * finite number. Never throws: a response with no usage is still a valid
 * answer.
 * @param {any} json
 * @returns {{input: number, output: number}}
 */
function usageOf(json) {
  const usage = json && typeof json.usage === 'object' && json.usage !== null ? json.usage : {};
  const count = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
  return { input: count(usage.input_tokens), output: count(usage.output_tokens) };
}

/**
 * Run askJev over many `{row, tier}` items with bounded concurrency.
 * NEVER THROWS: each item's own result is `{p, model, usage}` on success or
 * `null` on any failure at all (network, timeout, retries exhausted,
 * malformed answer, ...) — a row Jev cannot usefully answer for keeps its
 * mechanical verdict, the run never stops (D118). Results come back in
 * the SAME ORDER as `items`, so the caller zips them back onto the rows
 * it sent without re-deriving which row a result belongs to.
 *
 * @param {Array<{row: Operation, tier: string}>} items
 * @param {{fetchImpl: FetchLike, key: string, model?: string, concurrency?: number, timeoutMs?: number, retryBaseMs?: number}} opts
 *   Passed straight through to askJev for every item, `concurrency` aside.
 * @returns {Promise<Array<{p: number, model: string, usage: {input: number, output: number}}|null>>}
 */
export async function runJevBatch(items, opts) {
  const concurrency = Math.max(1, Math.min(opts.concurrency || JEV_CONCURRENCY, items.length || 1));
  /** @type {Array<{p: number, model: string, usage: {input: number, output: number}}|null>} */
  const results = new Array(items.length).fill(null);
  let next = 0;

  async function worker() {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      try {
        results[i] = await askJev(items[i].row, items[i].tier, opts);
      } catch {
        results[i] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
