// poc/jev-d87/run.mjs — Jev POC runner for the D87 floor-post measurement.
// Copy of poc/jev/run.mjs, trimmed to this POC's single criteria set (no
// A/B choice — poc/jev-d87/criteria.mjs has only one questions()) and
// widened to accept a gzipped rows file.
//
// Raw fetch, no SDK. Appends raw responses as JSONL in batches, so a kill
// mid-run loses only the unflushed batch. Resumable: rows already in the
// output file are skipped.
//
// Usage: node run.mjs <rows.json|rows.json.gz> <out.jsonl> [concurrency]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';
import { questions, stateFor } from './criteria.mjs';

const [, , rowsPath, outPath, concArg] = process.argv;
if (!rowsPath || !outPath) {
  console.error('usage: node run.mjs <rows.json|rows.json.gz> <out.jsonl> [concurrency]');
  process.exit(2);
}
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
console.error(`${rows.length} rows, ${done.size} already done, ${todo.length} to do`);

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
