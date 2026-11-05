// node pcheck.mjs <scratch-dir>
// Direct p-level check, no CLI. The request arrays are the ones the real CLI sent (captured by
// run.mjs from inside src/rwxliteengine.js via capture-shim.mjs), in production chunks, per vendor.
// (i)   answerMany(chunk) vs answer(row) one at a time, per version and variant
// (ii)  0.2.1 vs 0.2.0 on the same chunks
// (iii) the model string each answerer reports
// Reads <scratch>/out-0.2.0 and out-0.2.1 captures; writes nothing. Info only.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VERSIONS, VARIANTS, MODES } from './common.mjs';
import { VENDORS } from '../../data/exam3-2026-11-04/score/score.mjs';

const die = (m) => { throw new Error(m); };

/** captures for one version: {`${mode}-${variant}`: {chunks: reqs[][], text: string}} in CLI vendor order. */
export function loadCaptures(dir) {
  const out = {};
  for (const mode of MODES) for (const variant of Object.keys(VARIANTS)) {
    const chunks = [];
    let text = '';
    for (const stem of Object.keys(VENDORS)) {
      const f = path.join(dir, `req-${mode}-${variant}-${stem}.jsonl`);
      if (!fs.existsSync(f)) continue; // a vendor that sent nothing, or not in this run
      const t = fs.readFileSync(f, 'utf8');
      text += `${stem}\n${t}`;
      for (const l of t.split('\n').filter(Boolean)) chunks.push(JSON.parse(l));
    }
    out[`${mode}-${variant}`] = { chunks, text };
  }
  return out;
}

/** slot -> {isX, changes} numbers, or {err} */
const slotP = (s) => (s && s.answers ? { isX: s.answers.isX.noul, changes: s.answers.changes.noul } : { err: String(s?.error ?? 'malformed') });

/** Max |dp| and count dp>0 for isX and changes over two aligned lists of slots; an error on one side only is counted separately. */
export function pstat(A, B) {
  if (A.length !== B.length) die(`pstat: ${A.length} vs ${B.length}`);
  const s = { n: A.length, isX: { max: 0, nz: 0 }, changes: { max: 0, nz: 0 }, errBoth: 0, errOne: 0 };
  for (let i = 0; i < A.length; i++) {
    const a = slotP(A[i]), b = slotP(B[i]);
    if (a.err || b.err) { if (a.err && b.err) s.errBoth++; else s.errOne++; continue; }
    for (const k of ['isX', 'changes']) { const d = Math.abs(a[k] - b[k]); if (d > s[k].max) s[k].max = d; if (d > 0) s[k].nz++; }
  }
  return s;
}
const fmt = (s) => `n ${s.n}  isX max|dp| ${s.isX.max.toExponential(3)} rows dp>0 ${s.isX.nz}  changes max|dp| ${s.changes.max.toExponential(3)} rows dp>0 ${s.changes.nz}  (errors: both ${s.errBoth}, one side ${s.errOne})`;

async function runAll(answerer, chunks) {
  const prod = [], single = [];
  for (const ch of chunks) {
    prod.push(...await answerer.answerMany(ch));
    for (const req of ch) { try { single.push(await answerer.answer(req)); } catch (e) { single.push({ error: e.message }); } }
  }
  return { prod, single };
}

export async function main(argv) {
  if (!argv[0]) die('usage: node pcheck.mjs <scratch-dir>');
  const scratch = path.resolve(argv[0]);
  const caps = {};
  for (const ver of Object.keys(VERSIONS)) caps[ver] = loadCaptures(path.join(scratch, `out-${ver}`));
  // the requests must not depend on the package version or on the variant
  for (const k of Object.keys(caps['0.2.0'])) {
    if (caps['0.2.0'][k].text !== caps['0.2.1'][k].text) die(`captured requests for ${k} differ between 0.2.0 and 0.2.1 runs`);
    console.log(`requests ${k}: ${caps['0.2.0'][k].chunks.length} chunks, ${caps['0.2.0'][k].chunks.flat().length} rows; byte-identical in the 0.2.0 and 0.2.1 CLI runs`);
  }
  const threads = Math.min(4, os.availableParallelism()); // what rwxliteengine.js passes
  const results = {};
  for (const variant of Object.keys(VARIANTS)) {
    const cacheRoot = path.join(scratch, `cache-${variant}`, 'rwxmap');
    const [name, ...rest] = fs.readdirSync(cacheRoot);
    if (!name || rest.length) die(`${cacheRoot} should hold exactly one model folder`);
    for (const ver of Object.keys(VERSIONS)) {
      const lib = await import(pathToFileURL(path.join(scratch, `rwxlite-${ver}`, 'src', 'index.js')).href);
      const a = await lib.loadAnswerer({ dir: path.join(cacheRoot, name), threads });
      console.log(`(iii) rwxlite ${ver} ${variant}: answerer.model = ${a.model}${a.model === name ? ' (= cache folder)' : ' MISMATCH vs ' + name}`);
      if (a.model !== name) die(`model string ${a.model} != ${name}`);
      for (const mode of MODES) {
        const chunks = caps[ver][`${mode}-${variant}`].chunks;
        results[`${ver}|${variant}|${mode}`] = chunks.length ? await runAll(a, chunks) : null;
      }
    }
  }
  console.log('\n(i) answerMany in production chunks vs answer() one row at a time');
  for (const variant of Object.keys(VARIANTS)) for (const ver of Object.keys(VERSIONS)) for (const mode of MODES) {
    const r = results[`${ver}|${variant}|${mode}`];
    console.log(`  ${ver} ${variant} mode ${mode}: ${r ? fmt(pstat(r.prod, r.single)) : 'no requests sent (skipped)'}`);
  }
  console.log('\n(ii) 0.2.1 vs 0.2.0 on the same chunks');
  for (const variant of Object.keys(VARIANTS)) for (const mode of MODES) {
    const o = results[`0.2.0|${variant}|${mode}`], n = results[`0.2.1|${variant}|${mode}`];
    if (!o || !n) { console.log(`  ${variant} mode ${mode}: no requests sent (skipped)`); continue; }
    console.log(`  ${variant} mode ${mode} answerMany : ${fmt(pstat(o.prod, n.prod))}`);
    console.log(`  ${variant} mode ${mode} one-by-one : ${fmt(pstat(o.single, n.single))}`);
  }
  return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(`pcheck: ${e.message}`); process.exit(1); });
}
