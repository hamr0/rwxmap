// Exam #6: does each fetched spec pass src/load.js loadSpec (parse only, no classification)?
// Prints format, sha256 match vs results.json, and a method-count over doc.paths (same dedupe key as fetch-and-count).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpec } from '../../src/load.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH = '/home/hamr/PycharmProjects/rwxmap/.claude/scratchpad/exam6';
const res = JSON.parse(fs.readFileSync(path.join(HERE, 'results.json'), 'utf8'));
const M = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace', 'query'];
for (const r of res) {
  try {
    const l = await loadSpec(path.join(SCRATCH, r.name + '.spec'));
    const seen = new Set();
    for (const [p, it] of Object.entries(l.doc.paths)) for (const m of M) if (it && it[m] && typeof it[m] === 'object') seen.add(m + ' ' + p.replace(/\{[^}]*\}/g, '{}'));
    console.log(r.name.padEnd(13), 'OK', l.format, 'ops=' + seen.size, 'sha=' + (l.sha256 === r.sha256 ? 'match' : 'MISMATCH'), 'bytes=' + l.bytes);
  } catch (e) { console.log(r.name.padEnd(13), 'ERROR', String(e.message).slice(0, 200)); }
}
