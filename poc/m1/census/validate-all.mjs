import { parseYaml } from './yaml-mini.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/home/hamr/PycharmProjects/rwxmap/data/camara-2026-09-01/specs';
function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out = out.concat(walk(p));
    else if (e.endsWith('.yaml') || e.endsWith('.yml')) out.push(p);
  }
  return out;
}
const files = walk(ROOT);
console.log('total files', files.length);
let ok = 0, fail = 0, noPaths = 0;
for (const f of files) {
  try {
    const doc = parseYaml(readFileSync(f, 'utf8'));
    if (!doc || typeof doc !== 'object') { fail++; console.log('BAD DOC', f); continue; }
    if (!doc.paths || Object.keys(doc.paths).length === 0) { noPaths++; console.log('NO PATHS', f); continue; }
    if (!doc.openapi) { console.log('NO OPENAPI KEY', f); }
    ok++;
  } catch (e) {
    fail++;
    console.log('ERROR', f, e.message);
  }
}
console.log({ok, fail, noPaths});
