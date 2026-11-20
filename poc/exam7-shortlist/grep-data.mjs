// Raw case-insensitive text grep of rwxmap/data and rwxlite/data for every candidate alias.
// gz decompressed; npy/npz/pkl/onnx/parquet/safetensors/pt/bin/tar.gz/log skipped (as exam #6). rwxlite/data/r15 is skipped by name (quarantine).
// Usage: node grep-data.mjs   -> writes grep-hits.json (per alias: files, substring count, whole-word count, one sample)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOTS = ['/home/hamr/PycharmProjects/rwxmap/data', '/home/hamr/PycharmProjects/rwxlite/data'];
const R15 = '/home/hamr/PycharmProjects/rwxlite/data/r15';
const SKIP = /\.(npy|npz|pkl|onnx|parquet|safetensors|pt|bin|tar\.gz|log)$/;
const al = JSON.parse(fs.readFileSync(path.join(HERE, 'aliases.json'), 'utf8'));
const all = [...new Set(Object.values(al).flat())].sort();
const res = Object.fromEntries(all.map(a => [a, { files: {}, sub: 0, word: 0, sample: null }]));
const re = new RegExp('(' + all.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
let nfiles = 0, skipped = 0, skippedR15 = 0, bytes = 0;
function* walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (p === R15) { skippedR15++; continue; }
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}
for (const root of ROOTS) for (const f of walk(root)) {
  if (SKIP.test(f)) { skipped++; continue; }
  let b; try { b = fs.readFileSync(f); if (f.endsWith('.gz')) b = zlib.gunzipSync(b); } catch { skipped++; continue; }
  if (b.includes(0)) { skipped++; continue; } // binary
  nfiles++; bytes += b.length;
  const t = b.toString('utf8'); re.lastIndex = 0; let m;
  const rel = f.replace('/home/hamr/PycharmProjects/', '');
  while ((m = re.exec(t))) {
    const a = m[1].toLowerCase(), r = res[a]; if (!r) continue;
    r.sub++; r.files[rel] = (r.files[rel] || 0) + 1;
    const pre = t[m.index - 1] || ' ', post = t[m.index + m[0].length] || ' ';
    if (!/[a-z0-9]/i.test(pre) && !/[a-z0-9]/i.test(post)) r.word++;
    if (!r.sample) r.sample = t.slice(Math.max(0, m.index - 60), m.index + 80).replace(/\s+/g, ' ');
  }
}
fs.writeFileSync(path.join(HERE, 'grep-hits.json'), JSON.stringify({ filesScanned: nfiles, filesSkipped: skipped, r15Skipped: skippedR15, bytes, aliases: res }, null, 1));
console.log('scanned', nfiles, 'files', (bytes / 1e6).toFixed(0), 'MB; skipped', skipped, '; r15 skipped', skippedR15);
for (const [v, list] of Object.entries(al)) console.log(v.padEnd(12), list.map(a => `${a}:${res[a].sub}/${res[a].word}w/${Object.keys(res[a].files).length}f`).join('  '));
