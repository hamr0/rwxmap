// poc/jev-tiers/run.mjs — Jev POC runner for the three D95 tier
// measurements. Behaviour copied from poc/jev-d87/run.mjs (batched append,
// resume, key handling, retry) with ONE addition: the criteria set is chosen
// by the first argument, because this POC has two of them.
//
// Raw fetch, no SDK. The key is read from `pass amr/jev_api`, never written
// to disk and never printed. Responses are appended as JSONL in batches, so a
// kill mid-run loses only the unflushed batch. Resumable: rows already present
// in the output file are skipped.
//
// Usage: node run.mjs <criteria-x|criteria-changes> <rows.json.gz> <out.jsonl> [concurrency]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';

const CRITERIA = { 'criteria-x': './criteria-x.mjs', 'criteria-x-raise': './criteria-x-raise.mjs', 'criteria-changes': './criteria-changes.mjs' };

const [, , criteriaArg, rowsPath, outPath, concArg] = process.argv;
if (!criteriaArg || !rowsPath || !outPath || !CRITERIA[criteriaArg]) {
  console.error('usage: node run.mjs <criteria-x|criteria-changes> <rows.json|rows.json.gz> <out.jsonl> [concurrency]');
  process.exit(2);
}
const { questions, stateFor } = await import(CRITERIA[criteriaArg]);

const CONCURRENCY = Number(concArg || 8);
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const BATCH = 20;

// Key from pass, never written to disk, never printed.
const KEY = execFileSync('pass', ['show', 'amr/jev_api'], { encoding: 'utf8' })
  .split('\n')[0]
  .trim();
if (!KEY) throw new Error('no key from pass amr/jev_api');

function readRows(p) {
  const buf = readFileSync(p);
  const json = p.endsWith('.gz') ? zlib.gunzipSync(buf) : buf;
  return JSON.parse(json.toString('utf8'));
}

const rows = readRows(rowsPath);
const done = new Set();
if (existsSync(outPath)) {
  for (const line of readFileSync(outPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      done.add(JSON.parse(line).row_id);
    } catch {
      /* partial final line from a kill; ignore */
    }
  }
}
const todo = rows.filter((r) => !done.has(r.row_id));
console.error(`${criteriaArg}: ${rows.length} rows, ${done.size} already done, ${todo.length} to do`);

let buffer = [];
let completed = 0;
let failed = 0;
let inTokens = 0;

function flush() {
  if (buffer.length === 0) return;
  appendFileSync(outPath, buffer.map((o) => JSON.stringify(o)).join('\n') + '\n');
  buffer = [];
}

async function ask(row, attempt = 0) {
  const body = JSON.stringify({
    state: stateFor(row),
    model: 'jev-latest',
    questions: questions(),
  });
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body,
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`HTTP ${res.status} after ${attempt} retries`);
    const wait = Math.min(2 ** attempt * 500, 16000);
    await new Promise((r) => setTimeout(r, wait));
    return ask(row, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function worker(queue) {
  while (queue.length) {
    const row = queue.pop();
    try {
      const json = await ask(row);
      inTokens += json.usage?.input_tokens ?? 0;
      buffer.push({ row_id: row.row_id, answers: json.answers, usage: json.usage, model: json.model });
    } catch (err) {
      failed++;
      buffer.push({ row_id: row.row_id, error: String(err.message || err) });
    }
    completed++;
    if (buffer.length >= BATCH) flush();
    if (completed % 100 === 0) console.error(`  ${completed}/${todo.length} (${failed} failed)`);
  }
}

const queue = [...todo].reverse();
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker(queue)));
flush();
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.error(
  `done: ${completed} rows, ${failed} failed, ${secs}s, ${inTokens} input tokens (~$${((inTokens / 1e9) * 42).toFixed(4)})`,
);
