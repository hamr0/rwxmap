// Pre-registered scorer for shared clean exam #3 (D133), rwxmap side.
// Runs the REAL rwxmap CLI per spec per config, joins each operation to ops.csv
// 1:1, scores against truth.csv (sha256-checked), prints the D133 bar verdicts.
// Too loose and too tight are always separate. Vanilla node ESM, no deps.
// See docs/wiki/exam-prereg-exam3.md for the configs, hashes and bars.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAM = path.dirname(HERE);
const REPO = path.resolve(EXAM, '..', '..');

/** spec file stem -> ops.csv provider */
export const VENDORS = {
  clerk: 'clerk.com', neon: 'neon.com', supabase: 'supabase.com', mux: 'mux.com',
  netbird: 'netbird.io', ory: 'ory.sh', novu: 'novu.co',
};

/** The r10 model set (rwxlite 0.3.0), frozen. */
export const MODEL_SET = {
  files: {
    'manifest.json': '8123dc0417cc56cf580da12f1ec7d9e02627e77d95fc422e9e9a319bdc134d31',
    'manifest-exact.json': 'a7104e7aefac868dfd1809c0e0c47f52700412f06e9e3184e464ae075419ffe2',
    'model-int8-pc.onnx': '093c908d492d07121159287b5beadd3d4d75c403a4cde4f701ac918475be1173',
    'model-fp32.onnx': '8514ddccdafcda28ae468aced91673545c3c1d56201754e89a79dcb10ca61a26',
    'vocab.txt': '07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3',
  },
  fp32: { model: 'rwxlite-0.3.0+8514ddcc', manifest: 'manifest-exact.json', modelFile: 'model-fp32.onnx' },
  int8: { model: 'rwxlite-0.3.0+093c908d', manifest: 'manifest.json', modelFile: 'model-int8-pc.onnx' },
};

/** @typedef {{args: string[], variant?: 'fp32'|'int8', pass?: 'a'|'b', confidence?: number, jev?: true}} Config */
/** @type {Record<string, Config>} */
export const CONFIGS = {
  mech: { args: ['--engine', 'mechanical'] },
  'a-fp32': { args: [], variant: 'fp32', pass: 'a' },
  'a-int8': { args: ['--model', 'small'], variant: 'int8', pass: 'a' },
  'b95-fp32': { args: ['--engine', 'rwxlite', '--confidence', '95'], variant: 'fp32', pass: 'b', confidence: 95 },
  'b95-int8': { args: ['--engine', 'rwxlite', '--confidence', '95', '--model', 'small'], variant: 'int8', pass: 'b', confidence: 95 },
  'c-jev': { args: ['--engine', 'jev'], jev: true },
};

const RANK = { r: 0, w: 1, x: 2 };

// ---------------------------------------------------------------- small utils

export function sha256Buf(buf) { return createHash('sha256').update(buf).digest('hex'); }
export function sha256File(p) { return sha256Buf(fs.readFileSync(p)); }
const pct = (n, d) => (d === 0 ? '0.0%' : `${(100 * n / d).toFixed(1)}%`);
const die = (msg) => { throw new Error(msg); };

/** RFC 4180 CSV -> array of arrays (quoted fields may hold commas, quotes, newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', i = 0, inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const q = (s) => (/[",\r\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));

// ---------------------------------------------------------------- inputs

/** ops.csv -> [{id, provider, method, path}] ; header must be exact. */
export function loadOps(opsPath) {
  const rows = parseCsv(fs.readFileSync(opsPath, 'utf8'));
  const head = rows[0]?.join(',');
  if (head !== 'id,provider,method,path,operationId,summary,description') die(`ops.csv header unexpected: ${head}`);
  const ops = rows.slice(1).filter((r) => r.length > 1).map((r) => ({ id: r[0], provider: r[1], method: r[2], path: r[3] }));
  if (new Set(ops.map((o) => o.id)).size !== ops.length) die('ops.csv has duplicate ids');
  return ops;
}

/** truth.csv, refused unless its sha256 equals `expectedSha` (required). */
export function loadTruth(truthPath, expectedSha, opsIds) {
  if (!expectedSha) die('refusing: no expected truth sha256 given (--truth-sha)');
  if (!/^[0-9a-f]{64}$/.test(expectedSha)) die(`refusing: --truth-sha is not a sha256 hex: ${expectedSha}`);
  if (!fs.existsSync(truthPath)) die(`refusing: truth file not found: ${truthPath}`);
  const buf = fs.readFileSync(truthPath);
  const got = sha256Buf(buf);
  if (got !== expectedSha) die(`refusing: truth sha256 ${got} != expected ${expectedSha}`);
  const rows = parseCsv(buf.toString('utf8'));
  if (rows[0]?.join(',') !== 'id,label') die(`truth.csv header must be id,label, got: ${rows[0]?.join(',')}`);
  const truth = new Map();
  for (const r of rows.slice(1)) {
    if (r.length === 1 && r[0] === '') continue;
    if (r.length !== 2) die(`truth.csv bad row: ${JSON.stringify(r)}`);
    if (!(r[1] in RANK)) die(`truth.csv label not r|w|x for ${r[0]}: ${JSON.stringify(r[1])}`);
    if (truth.has(r[0])) die(`truth.csv duplicate id ${r[0]}`);
    truth.set(r[0], r[1]);
  }
  const missing = opsIds.filter((id) => !truth.has(id));
  const extra = [...truth.keys()].filter((id) => !opsIds.includes(id));
  if (missing.length || extra.length) die(`truth/ops id mismatch: ${missing.length} ops without truth, ${extra.length} truth ids not in ops`);
  return truth;
}

/** Hash all 5 model-set files in `dir` against the frozen list. Throws on any difference. */
export function verifyModelSet(dir, files = MODEL_SET.files) {
  for (const [name, want] of Object.entries(files)) {
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) die(`model set: missing ${p}`);
    const got = sha256File(p);
    if (got !== want) die(`model set: sha256 of ${name} is ${got}, expected ${want}`);
  }
}

// ---------------------------------------------------------------- the join

/**
 * Join sidecar rows (per vendor stem) to ops 1:1 by (provider, METHOD, path).
 * Throws, listing the offenders, on any unmatched op, unmatched/extra/duplicate sidecar row.
 * @param {Array<{id,provider,method,path}>} ops
 * @param {Record<string, any[]>} sidecars stem -> sidecar rows [{method,path,letter,marker,evidence}]
 * @param {Record<string,string>} vendors stem -> provider
 */
export function joinRows(ops, sidecars, vendors = VENDORS) {
  const byKey = new Map();
  for (const o of ops) {
    const k = `${o.provider}\0${o.method}\0${o.path}`;
    if (byKey.has(k)) die(`ops has two rows for ${o.provider} ${o.method} ${o.path}`);
    byKey.set(k, o);
  }
  const hit = new Map();
  const problems = [];
  let sidecarRows = 0;
  for (const [stem, rows] of Object.entries(sidecars)) {
    const provider = vendors[stem];
    if (!provider) die(`no provider for vendor stem ${stem}`);
    for (const r of rows) {
      sidecarRows++;
      const k = `${provider}\0${String(r.method).toUpperCase()}\0${r.path}`;
      const o = byKey.get(k);
      if (!o) { problems.push(`extra (no ops row): ${stem} ${r.method} ${r.path}`); continue; }
      if (hit.has(o.id)) { problems.push(`duplicate: ${o.id} matched twice (${stem} ${r.method} ${r.path})`); continue; }
      hit.set(o.id, { ...o, letter: r.letter, review: r.marker, evidence: r.evidence });
    }
  }
  const scoped = new Set(Object.keys(sidecars).map((s) => vendors[s]));
  for (const o of ops) if (scoped.has(o.provider) && !hit.has(o.id)) problems.push(`unmatched ops row: ${o.id} ${o.provider} ${o.method} ${o.path}`);
  if (problems.length) die(`join failed, ${problems.length} problem(s):\n  ${problems.slice(0, 50).join('\n  ')}${problems.length > 50 ? `\n  ... and ${problems.length - 50} more` : ''}`);
  return { joined: ops.filter((o) => hit.has(o.id)).map((o) => hit.get(o.id)), opsRows: [...scoped].reduce((n, p) => n + ops.filter((o) => o.provider === p).length, 0), sidecarRows };
}

// ---------------------------------------------------------------- scoring

export function tally(rows) {
  const t = { n: rows.length, exact: 0, loose: 0, tight: 0 };
  for (const r of rows) {
    const d = RANK[r.letter] - RANK[r.truth];
    if (d === 0) t.exact++; else if (d < 0) t.loose++; else t.tight++;
  }
  return t;
}
export function groupTally(rows, keyFn) {
  const g = new Map();
  for (const r of rows) { const k = keyFn(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  return [...g.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, rs]) => [k, tally(rs)]);
}

/**
 * D133 mode a bar: too loose <= mech's too loose AND exact >= mech exact + 5.0 points.
 * Integer arithmetic on counts (no float compare). Same N required.
 */
export function modeABar(mech, cand) {
  if (mech.n !== cand.n) die('modeABar: different denominators');
  const looseOk = cand.loose <= mech.loose;
  const gainPts100 = (cand.exact - mech.exact) * 100; // points * n
  const exactOk = gainPts100 >= 5 * mech.n;
  return { looseOk, exactOk, pass: looseOk && exactOk, deltaPoints: gainPts100 / mech.n, needRows: Math.ceil(5 * mech.n / 100) };
}
/** Mode c bars (M3 gate as amended by D94, applied to Jev per D119): too loose <= 2% of all rows; too tight <= 20% of all rows (reported, not traded). */
export function modeCBar(t) {
  return { looseOk: t.loose * 100 <= 2 * t.n, tightOk: t.tight * 100 <= 20 * t.n };
}

// ---------------------------------------------------------------- CLI runs

/** Verify the combined JSON's rwxlite/jev blocks say what this config requires. Throws otherwise. */
export function checkBlocks(name, cfg, combined, expectedModel) {
  const rl = combined?.rwxlite, jev = combined?.jev;
  if (cfg.jev) {
    if (jev?.mode !== 'on') die(`${name}: Jev did not run (jev.mode=${jev?.mode}); not scoring a mechanical run as mode c`);
    return;
  }
  if (!cfg.variant) { // mech
    if (rl?.mode !== 'off' || jev?.mode !== 'off') die(`${name}: expected rwxlite and Jev off, got rwxlite=${rl?.mode} jev=${jev?.mode}`);
    return;
  }
  if (jev?.mode !== 'off') die(`${name}: Jev ran in an rwxlite config`);
  if (rl?.mode !== 'on') {
    // Mode a with no loose/tight row sends nothing and fetches no model: legitimate, counted, no model to assert.
    if (cfg.pass === 'a' && rl?.reason === 'nothing to check') return;
    die(`${name}: "rwxlite: off" (${rl?.reason}); refusing to score a mechanical fallback as ${name}`);
  }
  if (rl.model !== expectedModel) die(`${name}: model string ${rl.model} != expected ${expectedModel}`);
  if (rl.pass !== cfg.pass) die(`${name}: pass ${rl.pass} != ${cfg.pass}`);
  if (cfg.pass === 'b' && rl.confidence !== cfg.confidence) die(`${name}: confidence ${rl.confidence} != ${cfg.confidence}`);
  if (cfg.pass === 'a' && rl.confidence !== null) die(`${name}: mode a reported confidence ${rl.confidence}`);
}

/**
 * Scratch setup for the r10 build: verify the 5 files, install the ref's src into
 * <work>/pkg/node_modules/rwxlite (git archive; onnxruntime-node via a symlink to the
 * rwxlite checkout's node_modules, read only), and lay out one verified model cache
 * per variant. Nothing outside <work> is written; ~/.cache is never touched.
 */
export function prepareRwxlite({ repo, ref, modelsDir, work }) {
  verifyModelSet(modelsDir);
  const git = (...a) => { const r = spawnSync('git', ['-C', repo, ...a], { encoding: 'buffer' }); if (r.status !== 0) die(`git ${a.join(' ')} failed: ${r.stderr}`); return r; };
  const sha = git('rev-parse', '--verify', `${ref}^{commit}`).stdout.toString().trim();
  const pkgDir = path.join(work, 'pkg', 'node_modules', 'rwxlite');
  fs.rmSync(path.join(work, 'pkg'), { recursive: true, force: true });
  fs.mkdirSync(pkgDir, { recursive: true });
  const tar = spawnSync('tar', ['-x', '-C', pkgDir], { input: git('archive', sha, 'src', 'package.json').stdout });
  if (tar.status !== 0) die(`tar failed: ${tar.stderr}`);
  const pj = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  if (pj.name !== 'rwxlite' || pj.version !== '0.3.0') die(`rwxlite ref ${sha} is ${pj.name}@${pj.version}, expected rwxlite@0.3.0`);
  const ort = path.join(repo, 'node_modules');
  if (!fs.existsSync(path.join(ort, 'onnxruntime-node'))) die(`onnxruntime-node not found in ${ort}`);
  fs.symlinkSync(ort, path.join(pkgDir, 'node_modules'), 'dir');
  const caches = {};
  for (const v of ['fp32', 'int8']) {
    const m = MODEL_SET[v];
    const dir = path.join(work, `cache-${v}`, 'rwxmap', m.model);
    fs.mkdirSync(dir, { recursive: true });
    for (const [src, dst] of [[m.manifest, 'manifest.json'], [m.modelFile, m.modelFile], ['vocab.txt', 'vocab.txt']]) {
      fs.copyFileSync(path.join(modelsDir, src), path.join(dir, dst));
      if (sha256File(path.join(dir, dst)) !== MODEL_SET.files[src]) die(`copied ${dst} does not match the frozen hash`);
    }
    caches[v] = path.join(work, `cache-${v}`);
  }
  return { sha, entry: pathToFileURL(path.join(pkgDir, 'src', 'index.js')).href, caches };
}

/** Run the real CLI for one config on one spec; returns {combined, sidecar, stderr}. */
export function runCli({ rwxmap, spec, stem, cfg, env, work, name }) {
  const out = path.join(work, 'out', name, stem);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const cwd = path.join(work, 'cwd'); // no .env here, never the repo root
  fs.mkdirSync(cwd, { recursive: true });
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(path.join(HERE, 'preload.mjs')).href, path.join(rwxmap, 'src', 'cli.js'), spec, '--vendor', stem, '-o', out, ...cfg.args], { cwd, env, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) die(`${name}/${stem}: rwxmap exited ${r.status}\n${r.stderr}`);
  const rd = (f) => JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'));
  return { combined: rd(`${stem}.rwxmap.json`), sidecar: rd(`${stem}.rwxmap.review.json`), stderr: r.stderr };
}

const sum = (a, k) => a.reduce((n, x) => n + (x?.[k] ?? 0), 0);

/** One config over the (selected) vendors -> {joined, rwxlite, jev, models, notes}. */
export function runConfig({ name, cfg, ctx, ops, vendors, stems }) {
  const env = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: path.join(ctx.work, 'home'), SCORE_RWXLITE_ENTRY: ctx.entry };
  if (cfg.variant) env.XDG_CACHE_HOME = ctx.caches[cfg.variant];
  else env.XDG_CACHE_HOME = path.join(ctx.work, 'cache-none');
  if (cfg.jev) { if (!process.env.RWXMAP_JEV_KEY) die('c-jev: --jev given but RWXMAP_JEV_KEY is not set'); env.RWXMAP_JEV_KEY = process.env.RWXMAP_JEV_KEY; }
  fs.mkdirSync(env.HOME, { recursive: true });
  const expectedModel = cfg.variant ? MODEL_SET[cfg.variant].model : undefined;
  const sidecars = {}, blocks = [], jevs = [], models = new Set(), notes = [];
  for (const stem of stems) {
    const spec = fs.readdirSync(ctx.specs).filter((f) => f.startsWith(`${stem}.`)).map((f) => path.join(ctx.specs, f));
    if (spec.length !== 1) die(`spec for ${stem}: found ${spec.length} files`);
    const res = runCli({ rwxmap: ctx.rwxmap, spec: spec[0], stem, cfg, env, work: ctx.work, name });
    checkBlocks(`${name}/${stem}`, cfg, res.combined, expectedModel);
    sidecars[stem] = res.sidecar.rows;
    blocks.push(res.combined.rwxlite);
    jevs.push(res.combined.jev);
    if (res.combined.rwxlite?.model) models.add(res.combined.rwxlite.model);
    if (cfg.jev && res.combined.jev?.model) models.add(res.combined.jev.model);
    if (cfg.variant && !/using cached rwxlite-/.test(res.stderr) && res.combined.rwxlite.mode === 'on') notes.push(`${stem}: no "using cached" line in stderr`);
  }
  const { joined, opsRows, sidecarRows } = joinRows(ops, sidecars, vendors);
  const rl = { sent: sum(blocks, 'sent'), raised: sum(blocks, 'raised'), lowered: sum(blocks, 'lowered'), kept: sum(blocks, 'kept'), undecided: sum(blocks, 'undecided') };
  const jv = { sent: sum(jevs, 'sent'), answered: sum(jevs, 'answered'), failed: sum(jevs, 'failed'), changed: sum(jevs, 'changed') };
  return { joined, opsRows, sidecarRows, rwxlite: rl, jev: jv, models: [...models], notes };
}

// ---------------------------------------------------------------- report

const line = (label, t) => `${label.padEnd(14)} exact ${String(t.exact).padStart(4)} (${pct(t.exact, t.n).padStart(5)})  too loose ${String(t.loose).padStart(4)} (${pct(t.loose, t.n).padStart(5)})  too tight ${String(t.tight).padStart(4)} (${pct(t.tight, t.n).padStart(5)})  of ${t.n}`;

export function renderConfig(name, res, N) {
  const t = tally(res.joined);
  const out = [`== ${name} ==  model(s): ${res.models.join(', ') || '(none)'}  rows ${t.n}`];
  out.push(line('overall', t));
  if (t.n !== N) out.push(`  NOTE: denominator ${t.n} is not ${N}`);
  if (CONFIGS[name].variant) {
    const r = res.rwxlite;
    out.push(`rwxlite: sent ${r.sent} · raised ${r.raised} · lowered ${r.lowered} · kept ${r.kept} · undecided (asked, scored x) ${r.undecided}`);
  }
  if (CONFIGS[name].jev) out.push(`Jev: sent ${res.jev.sent} · answered ${res.jev.answered} · failed ${res.jev.failed} · changed ${res.jev.changed}`);
  out.push('by vendor:');
  for (const [k, g] of groupTally(res.joined, (r) => r.provider)) out.push('  ' + line(k, g));
  out.push('by method:');
  for (const [k, g] of groupTally(res.joined, (r) => r.method)) out.push('  ' + line(k, g));
  for (const n of res.notes) out.push(`  note: ${n}`);
  return out.join('\n');
}

export function writeRows(file, joined) {
  const lines = ['id,provider,method,path,truth,letter,review,evidence'];
  for (const r of joined) lines.push([r.id, r.provider, r.method, r.path, r.truth, r.letter, r.review, r.evidence].map(q).join(','));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

export function renderVerdicts(results, N) {
  const out = ['== D133 bar verdicts =='];
  const mech = results.mech && tally(results.mech.joined);
  for (const name of ['a-fp32', 'a-int8']) {
    if (!results[name]) continue;
    if (!mech) { out.push(`${name}: no mech in this run; no verdict`); continue; }
    const t = tally(results[name].joined), b = modeABar(mech, t);
    out.push(`mode a ${name}${name === 'a-fp32' ? ' (GATE)' : ' (reported beside the gate)'}: too loose ${t.loose} vs mech ${mech.loose} -> ${b.looseOk ? 'OK' : 'FAIL'}; exact ${t.exact} (${pct(t.exact, N)}) vs mech ${mech.exact} (${pct(mech.exact, N)}) = ${b.deltaPoints.toFixed(2)} points, need >= 5.0 (${b.needRows} more rows) -> ${b.exactOk ? 'OK' : 'FAIL'}  => ${b.pass ? 'PASS' : 'FAIL'}`);
  }
  for (const name of ['b95-fp32', 'b95-int8']) if (results[name]) { const t = tally(results[name].joined); out.push(`mode b ${name}: no bar (D133); too loose ${t.loose} (${pct(t.loose, N)}), too tight ${t.tight} (${pct(t.tight, N)}), asked ${results[name].rwxlite.undecided} (${pct(results[name].rwxlite.undecided, N)})`); }
  if (results['c-jev']) {
    const t = tally(results['c-jev'].joined), b = modeCBar(t);
    out.push(`mode c c-jev (existing Jev bars, M3 gate item 1+2 as amended by D94, Jev shipped on that gate by D119): too loose ${t.loose} (${pct(t.loose, N)}) <= 2% -> ${b.looseOk ? 'PASS' : 'FAIL'}; too tight ${t.tight} (${pct(t.tight, N)}) <= 20% (reported, never traded against item 1) -> ${b.tightOk ? 'within' : 'over'}. Jev is non-deterministic: a near-bar result must repeat on a second run.`);
  } else out.push('c-jev: skipped (no --jev)');
  return out.join('\n');
}

// ---------------------------------------------------------------- main

export async function main(argv) {
  const { values: v } = parseArgs({ args: argv, options: {
    rwxmap: { type: 'string', default: REPO },
    'rwxlite-repo': { type: 'string', default: '/home/hamr/PycharmProjects/rwxlite' },
    'rwxlite-ref': { type: 'string', default: 'fe374c0' },
    models: { type: 'string', default: '/home/hamr/PycharmProjects/rwxlite/data/m1-r10' },
    work: { type: 'string' },
    ops: { type: 'string', default: path.join(EXAM, 'ops.csv') },
    specs: { type: 'string', default: path.join(EXAM, 'specs') },
    truth: { type: 'string', default: path.join(EXAM, 'truth.csv') },
    'truth-sha': { type: 'string' },
    out: { type: 'string', default: HERE },
    config: { type: 'string' },
    vendor: { type: 'string' },
    'join-only': { type: 'boolean', default: false },
    jev: { type: 'boolean', default: false },
    parity: { type: 'string' },
  } });

  const opsAll = loadOps(v.ops);
  const truth = loadTruth(v.truth, v['truth-sha'], opsAll.map((o) => o.id));
  const sha = sha256File(v.ops);
  const shaFile = path.join(path.dirname(v.ops), 'ops.csv.sha256');
  if (fs.existsSync(shaFile) && fs.readFileSync(shaFile, 'utf8').split(/\s+/)[0] !== sha) die('ops.csv sha256 differs from ops.csv.sha256');
  console.log(`ops.csv sha256 ${sha}; truth.csv sha256 verified; ${opsAll.length} ops`);

  const stems = v.vendor ? v.vendor.split(',') : Object.keys(VENDORS);
  for (const s of stems) if (!VENDORS[s]) die(`unknown vendor ${s}`);
  const partial = stems.length !== Object.keys(VENDORS).length;
  if (partial && !v['join-only']) die('--vendor (a subset) is allowed only with --join-only');
  const providers = new Set(opsAll.map((o) => o.provider));
  if ([...providers].sort().join() !== Object.values(VENDORS).sort().join()) die(`ops providers ${[...providers].join()} != the 7 expected`);
  const ops = opsAll.filter((o) => stems.some((s) => VENDORS[s] === o.provider)).map((o) => ({ ...o, truth: truth.get(o.id) }));

  const names = v.config ? v.config.split(',') : Object.keys(CONFIGS).filter((n) => n !== 'c-jev' || v.jev);
  for (const n of names) if (!CONFIGS[n]) die(`unknown config ${n}`);
  if (!v.jev && names.includes('c-jev')) names.splice(names.indexOf('c-jev'), 1);
  if (!names.includes('c-jev') && !v.jev) console.log('c-jev: skipped (no --jev)');

  const work = path.resolve(v.work ?? fs.mkdtempSync(path.join(os.tmpdir(), 'exam3-score-')));
  fs.mkdirSync(work, { recursive: true });
  const needModel = names.some((n) => CONFIGS[n].variant);
  const prep = prepareRwxlite({ repo: v['rwxlite-repo'], ref: v['rwxlite-ref'], modelsDir: v.models, work });
  if (needModel) console.log(`model set verified (5 files); rwxlite ref ${v['rwxlite-ref']} = ${prep.sha}; scratch ${work}`);
  const ctx = { work, entry: prep.entry, caches: prep.caches, specs: v.specs, rwxmap: path.resolve(v.rwxmap) };
  console.log(`rwxmap checkout ${ctx.rwxmap}`);

  const results = {};
  for (const name of names) {
    const res = runConfig({ name, cfg: CONFIGS[name], ctx, ops, vendors: VENDORS, stems });
    results[name] = res;
    if (v['join-only']) {
      console.log(`${name}: join ok: ${res.joined.length} of ${res.opsRows} ops rows matched 1:1 (${res.sidecarRows} sidecar rows, 0 unmatched, 0 extra)${CONFIGS[name].variant ? `; rwxlite model ${res.models.join(',') || '(none: nothing to check)'}, sent ${res.rwxlite.sent}` : ''}`);
      continue;
    }
    res.joined = res.joined.map((r) => ({ ...r }));
    console.log('\n' + renderConfig(name, res, opsAll.length));
    fs.mkdirSync(v.out, { recursive: true });
    writeRows(path.join(v.out, `rows-${name}.csv`), res.joined);
  }
  if (!v['join-only']) {
    console.log('\n' + renderVerdicts(results, opsAll.length));
    for (const n of ['mech', 'a-fp32', 'c-jev']) {
      if (!results[n]) continue;
      const loose = results[n].joined.filter((r) => RANK[r.letter] < RANK[r.truth]);
      console.log(`\ntoo-loose rows, ${n} (${loose.length}): id provider method path truth->letter evidence`);
      for (const r of loose) console.log(`  ${r.id} ${r.provider} ${r.method} ${r.path} ${r.truth}->${r.letter} ${r.evidence}`);
    }
  }
  if (v.parity) console.log('\nparity: skipped. The combined JSON and the sidecar carry only counts for rwxlite, no per-row pIsX/pChanges, and src/ is not to be changed. rwxlite compares its own p files via m0/exam3-parity.mjs.');
  console.log(`\nscratch kept at ${work} (holds the CLI outputs; delete when done)`);
  return 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(`score: ${e.message}`); process.exit(1); });
}
