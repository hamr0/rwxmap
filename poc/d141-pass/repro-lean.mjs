// Reproduction check: lean computed from r15 op fields vs the lean prefix in texts-r15.jsonl (made at rwxmap 1c25be1).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { leanAll, parsePrefix } from './lean.mjs';
import { parseCsv } from './validate.mjs';
const R = '/home/hamr/PycharmProjects/rwxlite/data/r15/labels/';
const rows = parseCsv(gunzipSync(readFileSync(R + 'final-labels-r15-d141.csv.gz')).toString('utf8'));
const h = rows[0], ix = Object.fromEntries(h.map((n, i) => [n, i]));
const body = rows.slice(1).filter((r) => r.length === h.length);
const texts = new Map();
for (const l of readFileSync(R + 'texts-r15.jsonl', 'utf8').split('\n').filter(Boolean)) { const j = JSON.parse(l); texts.set(j.op_id, j.text); }
const N = 2000, step = Math.floor(body.length / N);
const pick = []; for (let i = 0; i < N; i++) pick.push(body[i * step]);
const ops = pick.map((r) => ({ method: r[ix.method], path: r[ix.path], operationId: r[ix.operationId], summary: r[ix.summary], description: r[ix.description] }));
const got = leanAll(ops);
let ok = 0, bad = 0, nopre = 0; const ex = [];
pick.forEach((r, i) => {
  const p = parsePrefix(texts.get(r[ix.op_id]));
  if (!p) { nopre++; return; }
  if (p.letter === got[i].lean_letter && p.rule === got[i].lean_rule) ok++;
  else { bad++; if (ex.length < 10) ex.push(`${r[ix.op_id]} ${r[ix.method]} ${r[ix.path]} stored=${p.letter} ${p.rule} computed=${got[i].lean_letter} ${got[i].lean_rule}`); }
});
console.log(`csv rows ${body.length} (of ${rows.length - 1}); sampled ${pick.length} (every ${step}th); match ${ok}; mismatch ${bad}; no prefix ${nopre}`);
for (const e of ex) console.log('  ' + e);
process.exit(bad / pick.length > 0.005 || nopre ? 1 : 0);
