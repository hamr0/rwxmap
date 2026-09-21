// Same runner as run.mjs, pointed at the minimal criteria.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { questionsMinimal, stateFor } from './criteria-minimal.mjs';
const [, , rowsPath, outPath, concArg] = process.argv;
const CONCURRENCY = Number(concArg || 10);
const KEY = execFileSync('pass', ['show', 'amr/jev_api'], { encoding: 'utf8' }).split('\n')[0].trim();
const rows = JSON.parse(readFileSync(rowsPath, 'utf8'));
const done = new Set();
if (existsSync(outPath)) for (const l of readFileSync(outPath, 'utf8').split('\n')) { if (l.trim()) try { done.add(JSON.parse(l).row_id); } catch {} }
const todo = rows.filter((r) => !done.has(r.row_id));
let buffer = [], completed = 0, failed = 0, inTokens = 0;
const flush = () => { if (buffer.length) { appendFileSync(outPath, buffer.map((o) => JSON.stringify(o)).join('\n') + '\n'); buffer = []; } };
async function ask(row, attempt = 0) {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: stateFor(row), model: 'jev-latest', questions: questionsMinimal() }) });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    await new Promise((r) => setTimeout(r, Math.min(2 ** attempt * 500, 16000))); return ask(row, attempt + 1); }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function worker(q) { while (q.length) { const row = q.pop();
    try { const j = await ask(row); inTokens += j.usage?.input_tokens ?? 0;
      buffer.push({ row_id: row.row_id, answers: j.answers, usage: j.usage }); }
    catch (e) { failed++; buffer.push({ row_id: row.row_id, error: String(e.message || e) }); }
    completed++; if (buffer.length >= 20) flush(); } }
const q = [...todo].reverse(); const t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, q.length) }, () => worker(q)));
flush();
console.error(`done: ${completed} rows, ${failed} failed, ${((Date.now()-t0)/1000).toFixed(1)}s, ${inTokens} input tokens (~$${((inTokens/1e9)*42).toFixed(4)})`);
