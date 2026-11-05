// node setup.mjs <scratch-dir>
// Exports rwxlite 0.2.0 and 0.2.1 from git, downloads the 5 v0.2.0 release assets,
// checks every sha256 against the manifest, lays out one rwxmap model cache per variant.
// Writes only under <scratch>. Never writes inside the rwxlite repo.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256File } from '../../data/exam3-2026-11-04/score/score.mjs';
import { ASSETS, RELEASE_URL, RWXLITE_REPO, VERSIONS, VARIANTS } from './common.mjs';

const die = (m) => { throw new Error(m); };

export function exportVersion(scratch, ver) {
  const { commit } = VERSIONS[ver];
  const rp = spawnSync('git', ['-C', RWXLITE_REPO, 'rev-parse', '--verify', `${commit}^{commit}`], { encoding: 'utf8' });
  if (rp.status !== 0) die(`rev-parse ${commit}: ${rp.stderr}`);
  const full = rp.stdout.trim();
  const dest = path.join(scratch, `rwxlite-${ver}`);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const ar = spawnSync('git', ['-C', RWXLITE_REPO, 'archive', full], { maxBuffer: 256 << 20 });
  if (ar.status !== 0) die(`git archive ${full}: ${ar.stderr}`);
  const tar = spawnSync('tar', ['-x', '-C', dest], { input: ar.stdout });
  if (tar.status !== 0) die(`tar: ${tar.stderr}`);
  const pj = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
  if (pj.name !== 'rwxlite' || pj.version !== ver) die(`${commit} is ${pj.name}@${pj.version}, expected rwxlite@${ver}`);
  const ort = path.join(RWXLITE_REPO, 'node_modules');
  if (!fs.existsSync(path.join(ort, 'onnxruntime-node'))) die(`onnxruntime-node not found in ${ort}`);
  fs.symlinkSync(ort, path.join(dest, 'node_modules'), 'dir');
  return { dest, full };
}

async function download(models) {
  fs.mkdirSync(models, { recursive: true });
  for (const f of ASSETS) {
    const p = path.join(models, f);
    if (fs.existsSync(p)) continue; // already there; hashes are checked below either way
    const res = await fetch(RELEASE_URL + f, { redirect: 'follow' });
    if (!res.ok) die(`download ${f}: HTTP ${res.status}`);
    fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
}

/** Check every file a manifest lists against its sha256 and its model string against sha8. Returns the manifest. */
export function checkManifest(models, manifestName) {
  const m = JSON.parse(fs.readFileSync(path.join(models, manifestName), 'utf8'));
  if (m.version !== '0.2.0') die(`${manifestName}: version ${m.version}, expected 0.2.0`);
  for (const [f, want] of Object.entries(m.files)) {
    const got = sha256File(path.join(models, f));
    if (got !== want) die(`${manifestName}: sha256 of ${f} is ${got}, manifest says ${want}`);
  }
  const want = `rwxlite-0.2.0+${m.files[m.modelFile].slice(0, 8)}`;
  if (m.model !== want) die(`${manifestName}: model ${m.model} != ${want}`);
  return m;
}

export function buildCaches(scratch, models) {
  const out = {};
  for (const [v, { manifest, modelFile }] of Object.entries(VARIANTS)) {
    const m = checkManifest(models, manifest);
    if (m.modelFile !== modelFile) die(`${manifest}: modelFile ${m.modelFile}, expected ${modelFile}`);
    const dir = path.join(scratch, `cache-${v}`, 'rwxmap', m.model);
    fs.rmSync(path.join(scratch, `cache-${v}`), { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(models, manifest), path.join(dir, 'manifest.json'));
    for (const f of Object.keys(m.files)) {
      fs.copyFileSync(path.join(models, f), path.join(dir, f));
      if (sha256File(path.join(dir, f)) !== m.files[f]) die(`copied ${f} differs from manifest`);
    }
    out[v] = { cache: path.join(scratch, `cache-${v}`), dir, model: m.model };
  }
  return out;
}

export async function main(argv) {
  if (!argv[0]) die('usage: node setup.mjs <scratch-dir>');
  const scratch = path.resolve(argv[0]);
  fs.mkdirSync(scratch, { recursive: true });
  const models = path.join(scratch, 'models');
  await download(models);
  for (const f of ASSETS) console.log(`${sha256File(path.join(models, f))}  ${f}`);
  const caches = buildCaches(scratch, models);
  for (const [v, c] of Object.entries(caches)) console.log(`cache ${v}: ${c.dir} (manifest sha256 checks ok)`);
  for (const ver of Object.keys(VERSIONS)) {
    const e = exportVersion(scratch, ver);
    console.log(`exported rwxlite ${ver} = ${e.full} -> ${e.dest}`);
  }
  console.log('setup ok');
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(`setup: ${e.message}`); process.exit(1); });
}
