// D137 pilot runner: sends the v4 isX question (isXQuestionV4) for each blind
// row to Jev and appends one JSON line per row to <out.jsonl>.
//   node poc/v4-pilot/run-jev.mjs <pilot-blind.csv> <out.jsonl>
// Key: RWXMAP_JEV_KEY env var ONLY. Never reads a .env file.
// Transport: src/jev-client.js's askJev is hard-wired to src/jev.js's own
// question, so postOnce below is a minimal copy of its transport (endpoint,
// model, timeout, 429/529 backoff and answer checks are imported or copied
// unchanged). Rows are never classified here beyond p >= 0.5 -> x.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseCsv } from '../../tools/csv.js';
import { jevState } from '../../src/jev.js';
import { JEV_ENDPOINT, JEV_MODEL, JEV_CONCURRENCY, JEV_TIMEOUT_MS, JEV_RETRY_BASE_MS } from '../../src/jev-client.js';
import { questionJson } from './jev-v4.mjs';

const SHA_FILE = new URL('../../data/pilot-v4-2026-11-05/jev-v4-question.json.sha256', import.meta.url).pathname;
const MAX_RETRIES = 5;
const RETRY_CAP_MS = 16_000;
const BATCH = 20;

// Copy of jev-client.js postOnce (not exported there).
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
    throw new Error(`jev: request failed (${err instanceof Error ? err.message : 'network error'})`);
  }
  if (res.status === 429 || res.status === 529) {
    if (attempt >= MAX_RETRIES) throw new Error(`jev: HTTP ${res.status} after ${attempt} retries`);
    await new Promise((r) => setTimeout(r, Math.min(2 ** attempt * retryBaseMs, RETRY_CAP_MS)));
    return postOnce(fetchImpl, key, body, attempt + 1, timeoutMs, retryBaseMs);
  }
  if (!res.ok) throw new Error(`jev: HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new Error('jev: malformed JSON response');
  }
}

const count = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

async function askOne(fetchImpl, key, row, questions, o) {
  const body = { state: jevState(row), model: JEV_MODEL, questions };
  const json = await postOnce(fetchImpl, key, body, 0, o.timeoutMs, o.retryBaseMs);
  const ans = json && typeof json === 'object' && json.answers && typeof json.answers === 'object' ? json.answers.isX : undefined;
  const p = ans && typeof ans === 'object' ? ans.noul : undefined;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) throw new Error('jev: missing or malformed answer');
  const model = json && typeof json.model === 'string' ? json.model : '';
  if (model === '') throw new Error('jev: response carries no model string');
  const u = json.usage && typeof json.usage === 'object' ? json.usage : {};
  return { p, model, input: count(u.input_tokens), output: count(u.output_tokens) };
}

/** Returns the exit code. Everything external is injectable for tests. */
export async function run({ csvPath, outPath, env = process.env, fetchImpl = globalThis.fetch, shaPath = SHA_FILE,
  log = console.log, concurrency = JEV_CONCURRENCY, timeoutMs = JEV_TIMEOUT_MS, retryBaseMs = JEV_RETRY_BASE_MS }) {
  const key = env.RWXMAP_JEV_KEY;
  if (!key) { log('error: RWXMAP_JEV_KEY is not set'); return 1; }
  if (!csvPath || !outPath) { log('usage: run-jev.mjs <pilot-blind.csv> <out.jsonl>'); return 1; }

  const qJson = questionJson();
  const sha = crypto.createHash('sha256').update(qJson).digest('hex');
  const expected = fs.readFileSync(shaPath, 'utf8').trim().split(/\s+/)[0];
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  log(`rows: ${rows.length}`);
  log(`question sha256: ${sha}`);
  if (sha !== expected) { log(`error: sha mismatch, expected ${expected}`); return 1; }

  const done = new Set();
  if (fs.existsSync(outPath)) {
    for (const line of fs.readFileSync(outPath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { done.add(JSON.parse(line).row_id); } catch { /* torn last line: row is redone */ }
    }
  }
  const todo = rows.filter((r) => !done.has(r.row_id));
  log(`already done: ${done.size}, to send: ${todo.length}`);

  const questions = JSON.parse(qJson);
  const o = { timeoutMs, retryBaseMs };
  const tally = { x: 0, w: 0, error: 0, input: 0, output: 0 };

  for (let start = 0; start < todo.length; start += BATCH) {
    const batch = todo.slice(start, start + BATCH);
    const results = new Array(batch.length);
    let next = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= batch.length) return;
        const row = batch[i];
        try {
          const a = await askOne(fetchImpl, key, row, questions, o);
          results[i] = { row_id: row.row_id, p: a.p, label: a.p >= 0.5 ? 'x' : 'w', model: a.model, error: null, input: a.input, output: a.output };
        } catch (err) {
          results[i] = { row_id: row.row_id, p: null, label: 'x', model: null, error: err instanceof Error ? err.message : 'error', input: 0, output: 0 };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker));
    fs.appendFileSync(outPath, results.map((r) => JSON.stringify({ row_id: r.row_id, p: r.p, label: r.label, model: r.model, error: r.error })).join('\n') + '\n');
    for (const r of results) {
      if (r.error) tally.error++; else tally[r.label]++;
      tally.input += r.input; tally.output += r.output;
    }
  }
  log(`this run: x ${tally.x}, w ${tally.w}, errors ${tally.error} (errors are labelled x in the file)`);
  log(`tokens this run: input ${tally.input}, output ${tally.output}`);
  return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === new URL(import.meta.url).pathname) {
  process.exit(await run({ csvPath: process.argv[2], outPath: process.argv[3] }));
}
