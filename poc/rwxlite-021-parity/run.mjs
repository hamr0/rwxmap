// node run.mjs <scratch-dir> <0.2.0|0.2.1> [--vendor novu,ory]
// Drives the REAL rwxmap CLI exactly as the exam #3 scorer does (same ops, specs, per-vendor
// runs, same cwd rule), modes a and b95 x fp32 and int8, against the exported rwxlite <ver>
// and the v0.2.0 model cache. Writes <scratch>/out-<ver>/rows-<mode>-<variant>.csv (scorer row
// format) and req-<mode>-<variant>-<vendor>.jsonl (the exact request arrays the CLI sent).
// Scores are INFO ONLY: exam #3 is burned.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { CONFIGS, VENDORS, loadOps, loadTruth, joinRows, writeRows, tally, checkBlocks, runCli, sha256File } from '../../data/exam3-2026-11-04/score/score.mjs';
import { EXAM, REPO, TRUTH_SHA, VERSIONS, VARIANTS, MODES, configName } from './common.mjs';

const die = (m) => { throw new Error(m); };

export async function main(argv) {
  const { values: v, positionals: [scratchArg, ver] } = parseArgs({ args: argv, allowPositionals: true, options: { vendor: { type: 'string' } } });
  if (!scratchArg || !VERSIONS[ver]) die('usage: node run.mjs <scratch-dir> <0.2.0|0.2.1> [--vendor a,b]');
  const scratch = path.resolve(scratchArg);

  // truth first: sha256-checked before anything is scored
  const opsAll = loadOps(path.join(EXAM, 'ops.csv'));
  const fileSha = fs.readFileSync(path.join(EXAM, 'truth.csv.sha256'), 'utf8').split(/\s+/)[0];
  if (fileSha !== TRUTH_SHA) die(`truth.csv.sha256 file says ${fileSha}, expected ${TRUTH_SHA}`);
  const truth = loadTruth(path.join(EXAM, 'truth.csv'), TRUTH_SHA, opsAll.map((o) => o.id));
  console.log(`truth.csv sha256 verified (${TRUTH_SHA}); ${opsAll.length} ops`);

  const stems = v.vendor ? v.vendor.split(',') : Object.keys(VENDORS);
  for (const s of stems) if (!VENDORS[s]) die(`unknown vendor ${s}`);
  const ops = opsAll.filter((o) => stems.some((s) => VENDORS[s] === o.provider)).map((o) => ({ ...o, truth: truth.get(o.id) }));
  console.log(`vendors: ${stems.join(',')} (${ops.length} of ${opsAll.length} ops)`);

  const entry = path.join(scratch, `rwxlite-${ver}`, 'src', 'index.js');
  if (!fs.existsSync(entry)) die(`${entry} missing; run setup.mjs first`);
  const pj = JSON.parse(fs.readFileSync(path.join(scratch, `rwxlite-${ver}`, 'package.json'), 'utf8'));
  if (pj.version !== ver) die(`export at ${scratch}/rwxlite-${ver} is ${pj.version}`);
  const work = path.join(scratch, `work-${ver}`);
  const outDir = path.join(scratch, `out-${ver}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const specsDir = path.join(EXAM, 'specs');
  const shim = pathToFileURL(path.join(path.dirname(new URL(import.meta.url).pathname), 'capture-shim.mjs')).href;

  for (const variant of Object.keys(VARIANTS)) {
    const cacheRoot = path.join(scratch, `cache-${variant}`, 'rwxmap');
    const names = fs.existsSync(cacheRoot) ? fs.readdirSync(cacheRoot) : [];
    if (names.length !== 1) die(`${cacheRoot} should hold exactly one model folder, has ${names.length}; run setup.mjs`);
    const expectedModel = names[0];
    if (!new RegExp(`^rwxlite-0\\.2\\.0\\+[0-9a-f]{8}$`).test(expectedModel)) die(`unexpected cache folder ${expectedModel}`);
    for (const mode of MODES) {
      const name = configName(mode, variant);
      const cfg = CONFIGS[name];
      if (!cfg) die(`no scorer config ${name}`);
      const sidecars = {}, models = new Set(), sent = [];
      for (const stem of stems) {
        const spec = fs.readdirSync(specsDir).filter((f) => f.startsWith(`${stem}.`)).map((f) => path.join(specsDir, f));
        if (spec.length !== 1) die(`spec for ${stem}: ${spec.length} files`);
        const cap = path.join(outDir, `req-${mode}-${variant}-${stem}.jsonl`);
        fs.rmSync(cap, { force: true });
        const env = {
          PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: path.join(work, 'home'),
          SCORE_RWXLITE_ENTRY: shim, P021_REAL_ENTRY: pathToFileURL(entry).href, P021_CAPTURE: cap,
          XDG_CACHE_HOME: path.join(scratch, `cache-${variant}`),
        };
        fs.mkdirSync(env.HOME, { recursive: true });
        const res = runCli({ rwxmap: REPO, spec: spec[0], stem, cfg, env, work, name });
        checkBlocks(`${name}/${stem}`, cfg, res.combined, expectedModel);
        if (res.combined.rwxlite.mode === 'on') {
          if (res.combined.rwxlite.model !== expectedModel) die(`${name}/${stem}: model ${res.combined.rwxlite.model} != ${expectedModel}`);
          models.add(res.combined.rwxlite.model);
          if (!/using cached rwxlite-/.test(res.stderr)) console.log(`  note: ${stem}: no "using cached" line in stderr`);
          const lines = fs.existsSync(cap) ? fs.readFileSync(cap, 'utf8').split('\n').filter(Boolean) : [];
          const nReq = lines.reduce((n, l) => n + JSON.parse(l).length, 0);
          if (nReq !== res.combined.rwxlite.sent) die(`${name}/${stem}: captured ${nReq} requests but the CLI says it sent ${res.combined.rwxlite.sent}`);
          sent.push(nReq);
        } else sent.push(0); // mode a with nothing loose/tight: nothing sent, no model fetched
        sidecars[stem] = res.sidecar.rows;
      }
      const { joined, opsRows, sidecarRows } = joinRows(ops, sidecars, VENDORS);
      writeRows(path.join(outDir, `rows-${name}.csv`), joined);
      const t = tally(joined);
      console.log(`${name}: model ${[...models].join(',') || '(none sent)'}; join ok ${joined.length}/${opsRows} (${sidecarRows} sidecar rows); sent ${sent.reduce((a, b) => a + b, 0)} requests; INFO ONLY exact ${t.exact} loose ${t.loose} tight ${t.tight}`);
    }
  }
  console.log(`done: ${outDir}`);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(`run: ${e.message}`); process.exit(1); });
}
