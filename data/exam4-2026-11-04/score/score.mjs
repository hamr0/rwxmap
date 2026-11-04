// Pre-registered scorer for shared clean exam #4 (D135 next-model gate), rwxmap side.
// Runs the REAL rwxmap CLI per spec per config, joins each operation to ops.csv
// 1:1, scores against truth.csv (sha256-checked), prints the D135 gate and the D133 bars.
// Two models are compared: the BASELINE (rwxlite 0.2.0 as shipped) and a CANDIDATE
// whose hashes must all be given on the command line. Too loose and too tight are
// always separate. Vanilla node ESM, no deps.
// See docs/wiki/exam-prereg-exam4.md for the configs, hashes and bars.
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
  permit: 'permit.io', immich: 'immich.app', polar: 'polar.sh', harbor: 'goharbor.io',
  zulip: 'zulip.com', chatwoot: 'chatwoot.com', render: 'render.com',
};

/** The five files a model release carries, and the variant each manifest describes. */
export const FILE_NAMES = ['manifest.json', 'manifest-exact.json', 'model-int8-pc.onnx', 'model-fp32.onnx', 'vocab.txt'];
const VARIANT_FILES = {
  fp32: { manifest: 'manifest-exact.json', modelFile: 'model-fp32.onnx' },
  int8: { manifest: 'manifest.json', modelFile: 'model-int8-pc.onnx' },
};

/**
 * The BASELINE: rwxlite 0.2.0 as shipped (D135). Package from tag v0.2.0 (commit 6c47fec),
 * model files are the published v0.2.0 release assets. No rwxmap tag change.
 */
export const BASE = {
  label: 'base',
  tag: 'v0.2.0',
  version: '0.2.0',
  ref: '6c47fec6734e666462164025674b55e8323d5b86',
  releaseUrl: 'https://github.com/hamr0/rwxlite/releases/download/v0.2.0/',
  files: {
    'manifest.json': '10407b787fae2cadc318780a8c4ad171dc07af1389129c284bfd85c54f6b38bc',
    'manifest-exact.json': 'a484251cd4daf9c6fc7c8d2cb3f4a43f0cbdd6f4447d2c9ff65721a2f767b774',
    'model-int8-pc.onnx': '8ad0a182b37237adc819bda2c03c01f0cb0e40afc2b20bdacb06193cd62a8844',
    'model-fp32.onnx': '8503b655a25202f8d01ced40ab685c34b287f70db8c0651528ca476f1470a48b',
    'vocab.txt': '07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3',
  },
  fp32: { model: 'rwxlite-0.2.0+8503b655', ...VARIANT_FILES.fp32 },
  int8: { model: 'rwxlite-0.2.0+8ad0a182', ...VARIANT_FILES.int8 },
};

const HEX64 = /^[0-9a-f]{64}$/;
const TAG_RE = /^v\d+\.\d+\.\d+$/;

/**
 * Build the CANDIDATE description from command-line values. Refuses unless the tag, all five
 * file hashes and both model strings are given, are well formed, and agree with each other
 * (a model string is rwxlite-<version>+<first 8 hex of its model file's sha256>).
 * @param {{tag?: string, files?: string[], fp32Model?: string, int8Model?: string, ref?: string}} o
 */
export function candidateSpec(o) {
  if (!o.ref) die('candidate: --cand-ref is required');
  if (!o.tag || !TAG_RE.test(o.tag)) die(`candidate: --cand-tag must look like v0.3.0, got ${JSON.stringify(o.tag)}`);
  const files = {};
  for (const kv of o.files ?? []) {
    const i = kv.indexOf('=');
    const name = kv.slice(0, i), sha = kv.slice(i + 1);
    if (i < 0 || !FILE_NAMES.includes(name)) die(`candidate: --cand-file ${JSON.stringify(kv)} is not <name>=<sha256> with a name from ${FILE_NAMES.join(', ')}`);
    if (!HEX64.test(sha)) die(`candidate: sha256 for ${name} is not 64 lowercase hex`);
    if (name in files) die(`candidate: --cand-file ${name} given twice`);
    files[name] = sha;
  }
  const missing = FILE_NAMES.filter((n) => !(n in files));
  if (missing.length) die(`candidate: refusing, no sha256 given for ${missing.join(', ')} (all five are required)`);
  const version = o.tag.slice(1);
  const spec = { label: 'cand', tag: o.tag, version, ref: o.ref, files };
  for (const [v, given] of [['fp32', o.fp32Model], ['int8', o.int8Model]]) {
    if (!given) die(`candidate: --cand-model-${v} is required`);
    const want = `rwxlite-${version}+${files[VARIANT_FILES[v].modelFile].slice(0, 8)}`;
    if (given !== want) die(`candidate: --cand-model-${v} ${given} does not match the ${VARIANT_FILES[v].modelFile} hash (expected ${want})`);
    spec[v] = { model: given, ...VARIANT_FILES[v] };
  }
  if (spec.fp32.model === BASE.fp32.model || spec.int8.model === BASE.int8.model) die('candidate: a model string equals the baseline\'s; the candidate must be a different model');
  return spec;
}

/** The addendum table rows, in the prereg, and the candidate value each must equal. */
export const ADDENDUM_FIELDS = [
  ['rwxlite package ref (commit in the rwxlite repo)', (c) => c.ref],
  ['rwxlite tag / version (the tag rwxmap would pin)', (c) => c.tag],
  ['manifest.json sha256 (int8)', (c) => c.files['manifest.json']],
  ['manifest-exact.json sha256 (fp32)', (c) => c.files['manifest-exact.json']],
  ['model-int8-pc.onnx sha256', (c) => c.files['model-int8-pc.onnx']],
  ['model-fp32.onnx sha256', (c) => c.files['model-fp32.onnx']],
  ['vocab.txt sha256', (c) => c.files['vocab.txt']],
  ['fp32 model string', (c) => c.fp32.model],
  ['int8 model string', (c) => c.int8.model],
];
export const PREREG_PATH = 'docs/wiki/exam-prereg-exam4.md';

/**
 * Check a candidate against the CANDIDATE ADDENDUM table in the prereg text. Refuses if the
 * section or any field row is missing, if any value is "pending" or empty, or if any value
 * differs from the command-line candidate.
 */
export function checkAddendum(preregText, cand) {
  const start = preregText.indexOf('### CANDIDATE:');
  if (start < 0) die('addendum: no "### CANDIDATE:" section in the prereg');
  const rest = preregText.slice(start + 3);
  const end = rest.search(/^#{1,3} /m);
  const section = end < 0 ? rest : rest.slice(0, end);
  const cells = new Map();
  for (const l of section.split('\n')) {
    const m = /^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$/.exec(l);
    if (m) cells.set(m[1], m[2].replace(/^`|`$/g, '').trim());
  }
  const problems = [];
  for (const [label, get] of ADDENDUM_FIELDS) {
    const v = cells.get(label);
    if (v === undefined) problems.push(`no row "${label}"`);
    else if (v === '' || /pending/i.test(v)) problems.push(`"${label}" is still pending`);
    else if (v !== get(cand)) problems.push(`"${label}": prereg says ${v}, command line says ${get(cand)}`);
  }
  if (problems.length) die(`addendum: refusing to score a candidate that the committed prereg does not state:\n  ${problems.join('\n  ')}`);
}

/** @typedef {{args: string[], variant?: 'fp32'|'int8', pass?: 'a'|'b', confidence?: number, jev?: true, model?: 'base'|'cand', gate?: true}} Config */
/** @type {Record<string, Config>} */
export const CONFIGS = {
  mech: { args: ['--engine', 'mechanical'] },
  'a-fp32-base': { args: [], variant: 'fp32', pass: 'a', model: 'base' },
  'a-fp32-cand': { args: [], variant: 'fp32', pass: 'a', model: 'cand', gate: true },
  'a-int8-base': { args: ['--model', 'small'], variant: 'int8', pass: 'a', model: 'base' },
  'a-int8-cand': { args: ['--model', 'small'], variant: 'int8', pass: 'a', model: 'cand' },
  'b95-fp32-base': { args: ['--engine', 'rwxlite', '--confidence', '95'], variant: 'fp32', pass: 'b', confidence: 95, model: 'base' },
  'b95-fp32-cand': { args: ['--engine', 'rwxlite', '--confidence', '95'], variant: 'fp32', pass: 'b', confidence: 95, model: 'cand' },
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
  if (!HEX64.test(expectedSha)) die(`refusing: --truth-sha is not a sha256 hex: ${expectedSha}`);
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
  const idSet = new Set(opsIds);
  const missing = opsIds.filter((id) => !truth.has(id));
  const extra = [...truth.keys()].filter((id) => !idSet.has(id));
  if (missing.length || extra.length) die(`truth/ops id mismatch: ${missing.length} ops without truth, ${extra.length} truth ids not in ops`);
  return truth;
}

/** Hash every file of a model set in `dir` against `files` {name: sha256}. Throws on any difference. */
export function verifyModelSet(dir, files) {
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
/**
 * D135 gate (user ruling 2026-11-04, "better or same, no regression"): the candidate replaces
 * 0.2.0 only if, on the same rows, a-fp32-cand's too loose <= a-fp32-base's too loose AND
 * a-fp32-cand's exact >= a-fp32-base's exact. Integer counts; a tie passes. Too tight is
 * reported beside it and is not part of the gate.
 */
export function d135Gate(base, cand) {
  if (base.n !== cand.n) die('d135Gate: different denominators');
  const looseOk = cand.loose <= base.loose;
  const exactOk = cand.exact >= base.exact;
  return { looseOk, exactOk, pass: looseOk && exactOk, looseDelta: cand.loose - base.loose, exactDelta: cand.exact - base.exact, tightDelta: cand.tight - base.tight };
}
/** Mode c bars (M3 gate as amended by D94, applied to Jev per D119): too loose <= 2% of all rows; too tight <= 20% of all rows (reported, not traded). */
export function modeCBar(t) {
  return { looseOk: t.loose * 100 <= 2 * t.n, tightOk: t.tight * 100 <= 20 * t.n };
}

// ---------------------------------------------------------------- the one-line tag change

/** The only line a candidate run may change in a scratch copy of rwxmap (src/modeldownload.js). */
const TAG_LINE_RE = /^export const RWXLITE_TAG = 'v\d+\.\d+\.\d+';$/;
const TAG_FILE = path.join('src', 'modeldownload.js');
const tagLine = (tag) => `export const RWXLITE_TAG = '${tag}';`;

/** Replace the RWXLITE_TAG line (exactly one must exist) with `newTag`. */
export function retag(text, newTag) {
  if (!TAG_RE.test(newTag)) die(`retag: ${JSON.stringify(newTag)} is not a tag like v0.3.0`);
  const lines = text.split('\n');
  const at = lines.map((l, i) => (TAG_LINE_RE.test(l) ? i : -1)).filter((i) => i >= 0);
  if (at.length !== 1) die(`retag: expected exactly one RWXLITE_TAG line in ${TAG_FILE}, found ${at.length}`);
  lines[at[0]] = tagLine(newTag);
  return lines.join('\n');
}

function listFiles(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.name === 'node_modules') continue; // the read-only dependency symlink is not source
    if (e.isDirectory()) out.push(...listFiles(dir, r)); else out.push(r);
  }
  return out.sort();
}

/**
 * Fail unless the scratch copy `newDir` differs from the pristine archive `origDir` in nothing
 * but the one RWXLITE_TAG line of src/modeldownload.js, which must now equal `newTag`.
 * Returns {changed: [files], diff: unified diff text} (diff is '' when nothing changed).
 */
export function checkOnlyTagChanged(origDir, newDir, newTag) {
  const a = listFiles(origDir), b = listFiles(newDir);
  if (a.join('\n') !== b.join('\n')) die('tag guard: the scratch copy has a different file list than the archive');
  const changed = a.filter((f) => !fs.readFileSync(path.join(origDir, f)).equals(fs.readFileSync(path.join(newDir, f))));
  if (changed.some((f) => f !== TAG_FILE)) die(`tag guard: the scratch copy changed more than ${TAG_FILE}: ${changed.join(', ')}`);
  if (changed.length === 0) return { changed, diff: '' };
  const ol = fs.readFileSync(path.join(origDir, TAG_FILE), 'utf8').split('\n');
  const nl = fs.readFileSync(path.join(newDir, TAG_FILE), 'utf8').split('\n');
  if (ol.length !== nl.length) die('tag guard: the line count of modeldownload.js changed');
  const lines = ol.map((l, i) => (l === nl[i] ? -1 : i)).filter((i) => i >= 0);
  if (lines.length !== 1) die(`tag guard: ${lines.length} lines changed in modeldownload.js, expected exactly 1`);
  if (!TAG_LINE_RE.test(ol[lines[0]]) || nl[lines[0]] !== tagLine(newTag)) die(`tag guard: the changed line is not RWXLITE_TAG -> ${newTag}: ${JSON.stringify(nl[lines[0]])}`);
  const d = spawnSync('diff', ['-u', '--label', `a/${TAG_FILE}`, '--label', `b/${TAG_FILE}`, path.join(origDir, TAG_FILE), path.join(newDir, TAG_FILE)], { encoding: 'utf8' });
  return { changed, diff: d.stdout };
}

// ---------------------------------------------------------------- scratch setup

const gitIn = (repo, ...a) => { const r = spawnSync('git', ['-C', repo, ...a], { encoding: 'buffer', maxBuffer: 256 << 20 }); if (r.status !== 0) die(`git ${a.join(' ')} failed: ${r.stderr}`); return r.stdout; };
function extractArchive(repo, sha, paths, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const tar = spawnSync('tar', ['-x', '-C', dest], { input: gitIn(repo, 'archive', sha, ...paths) });
  if (tar.status !== 0) die(`tar failed: ${tar.stderr}`);
}

/**
 * A scratch copy of rwxmap at `ref` (git archive of src + package.json; `yaml` via a read-only
 * symlink to the repo's node_modules). With `tag`, applies the one-line RWXLITE_TAG change and
 * runs the guard. Returns {dir, sha, diff}. The repo's own src/ is never written, and a
 * working-tree src/ that differs from `ref` is refused (the run must be of the committed code).
 */
export function prepareRwxmap({ repo, ref, work, label, tag }) {
  const sha = gitIn(repo, 'rev-parse', '--verify', `${ref}^{commit}`).toString().trim();
  const dirty = spawnSync('git', ['-C', repo, 'diff', '--quiet', sha, '--', 'src', 'package.json']);
  if (dirty.status !== 0) die(`rwxmap: working-tree src/ or package.json differs from ${ref}; commit first`);
  const dir = path.join(work, `rwxmap-${label}`), orig = path.join(work, `rwxmap-${label}-orig`);
  extractArchive(repo, sha, ['src', 'package.json'], dir);
  extractArchive(repo, sha, ['src', 'package.json'], orig);
  if (tag) {
    const f = path.join(dir, TAG_FILE);
    fs.writeFileSync(f, retag(fs.readFileSync(f, 'utf8'), tag));
  }
  const guard = checkOnlyTagChanged(orig, dir, tag ?? readTag(path.join(orig, TAG_FILE)));
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  return { dir, sha, diff: guard.diff };
}
const readTag = (file) => /^export const RWXLITE_TAG = '(v[\d.]+)';$/m.exec(fs.readFileSync(file, 'utf8'))?.[1] ?? die(`no RWXLITE_TAG in ${file}`);

/** Download any missing release asset of the baseline into `dir` (hashes are checked afterwards either way). */
export async function fetchBaseModels(dir, fetchFn = fetch) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of FILE_NAMES) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) continue;
    const res = await fetchFn(BASE.releaseUrl + f, { redirect: 'follow' });
    if (!res.ok) die(`download ${f}: HTTP ${res.status}`);
    fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
}

/**
 * Scratch install of one rwxlite build: verify the five files, install the ref's package
 * (src + package.json, a real package folder named rwxlite so the version reader finds it)
 * at <work>/pkg-<label>/node_modules/rwxlite, onnxruntime-node via a read-only symlink to
 * the rwxlite checkout's node_modules, and one verified model cache per variant.
 */
export function prepareRwxlite({ spec, repo, modelsDir, work }) {
  verifyModelSet(modelsDir, spec.files);
  const sha = gitIn(repo, 'rev-parse', '--verify', `${spec.ref}^{commit}`).toString().trim();
  const pkgDir = path.join(work, `pkg-${spec.label}`, 'node_modules', 'rwxlite');
  fs.rmSync(path.join(work, `pkg-${spec.label}`), { recursive: true, force: true });
  extractArchive(repo, sha, ['src', 'package.json'], pkgDir);
  const pj = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  if (pj.name !== 'rwxlite' || pj.version !== spec.version) die(`rwxlite ref ${sha} is ${pj.name}@${pj.version}, expected rwxlite@${spec.version}`);
  const ort = path.join(repo, 'node_modules');
  if (!fs.existsSync(path.join(ort, 'onnxruntime-node'))) die(`onnxruntime-node not found in ${ort}`);
  fs.symlinkSync(ort, path.join(pkgDir, 'node_modules'), 'dir');
  const caches = {};
  for (const v of ['fp32', 'int8']) {
    const m = spec[v];
    const man = JSON.parse(fs.readFileSync(path.join(modelsDir, m.manifest), 'utf8'));
    if (man.version !== spec.version || man.model !== m.model || man.modelFile !== m.modelFile) die(`${m.manifest}: version/model/modelFile ${man.version}/${man.model}/${man.modelFile} do not match ${spec.version}/${m.model}/${m.modelFile}`);
    const dir = path.join(work, `cache-${spec.label}-${v}`, 'rwxmap', m.model);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(modelsDir, m.manifest), path.join(dir, 'manifest.json'));
    for (const [f, want] of Object.entries(man.files)) {
      if (spec.files[f] !== want) die(`${m.manifest} lists ${f} sha256 ${want}, not the pre-registered one`);
      fs.copyFileSync(path.join(modelsDir, f), path.join(dir, f));
      if (sha256File(path.join(dir, f)) !== want) die(`copied ${f} does not match the frozen hash`);
    }
    caches[v] = path.join(work, `cache-${spec.label}-${v}`);
  }
  return { sha, entry: pathToFileURL(path.join(pkgDir, 'src', 'index.js')).href, caches };
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

/**
 * One config over the (selected) vendors -> {joined, rwxlite, jev, models, notes}.
 * ctx = {work, specs, rwxmap (dir for mech/c-jev), models: {base|cand: {entry, caches, rwxmap, spec}}}
 */
export function runConfig({ name, cfg, ctx, ops, vendors, stems }) {
  const m = cfg.model ? ctx.models[cfg.model] : undefined;
  if (cfg.model && !m) die(`${name}: no ${cfg.model} model prepared`);
  const rwxmap = m ? m.rwxmap : ctx.rwxmap;
  const env = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: path.join(ctx.work, 'home'), SCORE_RWXLITE_ENTRY: m ? m.entry : (ctx.models.base?.entry ?? 'file:///none') };
  env.XDG_CACHE_HOME = m ? m.caches[cfg.variant] : path.join(ctx.work, 'cache-none');
  if (cfg.jev) { if (!process.env.RWXMAP_JEV_KEY) die('c-jev: --jev given but RWXMAP_JEV_KEY is not set'); env.RWXMAP_JEV_KEY = process.env.RWXMAP_JEV_KEY; }
  fs.mkdirSync(env.HOME, { recursive: true });
  const expectedModel = cfg.variant ? m.spec[cfg.variant].model : undefined;
  const sidecars = {}, blocks = [], jevs = [], models = new Set(), notes = [];
  for (const stem of stems) {
    const spec = fs.readdirSync(ctx.specs).filter((f) => f.startsWith(`${stem}.`)).map((f) => path.join(ctx.specs, f));
    if (spec.length !== 1) die(`spec for ${stem}: found ${spec.length} files`);
    const res = runCli({ rwxmap, spec: spec[0], stem, cfg, env, work: ctx.work, name });
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
  const out = ['== D135 gate (next-model gate; user ruling 2026-11-04: better or same, no regression) =='];
  const base = results['a-fp32-base'] && tally(results['a-fp32-base'].joined);
  const cand = results['a-fp32-cand'] && tally(results['a-fp32-cand'].joined);
  if (!base || !cand) out.push('no verdict: needs a-fp32-base and a-fp32-cand in this run');
  else {
    const g = d135Gate(base, cand);
    out.push(`a-fp32-cand (GATE) vs a-fp32-base: too loose ${cand.loose} vs ${base.loose} (${g.looseDelta >= 0 ? '+' : ''}${g.looseDelta}) -> ${g.looseOk ? 'OK' : 'FAIL'} (need <=); exact ${cand.exact} vs ${base.exact} (${g.exactDelta >= 0 ? '+' : ''}${g.exactDelta}) -> ${g.exactOk ? 'OK' : 'FAIL'} (need >=)  => ${g.pass ? 'PASS: the candidate may replace 0.2.0' : 'FAIL: 0.2.0 stays'}`);
    out.push(`  beside the gate, not part of it: too tight ${cand.tight} vs ${base.tight} (${g.tightDelta >= 0 ? '+' : ''}${g.tightDelta}), of ${N}`);
  }
  out.push('', '== D133 mode a bar vs mech (reported for both models; it is not the D135 gate) ==');
  const mech = results.mech && tally(results.mech.joined);
  for (const name of ['a-fp32-base', 'a-fp32-cand', 'a-int8-base', 'a-int8-cand']) {
    if (!results[name]) continue;
    if (!mech) { out.push(`${name}: no mech in this run; no verdict`); continue; }
    const t = tally(results[name].joined), b = modeABar(mech, t);
    out.push(`mode a ${name}: too loose ${t.loose} vs mech ${mech.loose} -> ${b.looseOk ? 'OK' : 'FAIL'}; exact ${t.exact} (${pct(t.exact, N)}) vs mech ${mech.exact} (${pct(mech.exact, N)}) = ${b.deltaPoints.toFixed(2)} points, need >= 5.0 (${b.needRows} more rows) -> ${b.exactOk ? 'OK' : 'FAIL'}  => ${b.pass ? 'PASS' : 'FAIL'}`);
  }
  out.push('', '== mode b (D133: no bar) ==');
  for (const name of ['b95-fp32-base', 'b95-fp32-cand']) if (results[name]) { const t = tally(results[name].joined); out.push(`mode b ${name}: too loose ${t.loose} (${pct(t.loose, N)}), too tight ${t.tight} (${pct(t.tight, N)}), asked ${results[name].rwxlite.undecided} (${pct(results[name].rwxlite.undecided, N)})`); }
  out.push('', '== mode c ==');
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
    'rwxmap-ref': { type: 'string', default: 'HEAD' },
    'rwxlite-repo': { type: 'string', default: '/home/hamr/PycharmProjects/rwxlite' },
    'models-base': { type: 'string' },
    'cand-ref': { type: 'string' },
    'cand-tag': { type: 'string' },
    'cand-models': { type: 'string' },
    'cand-file': { type: 'string', multiple: true },
    'cand-model-fp32': { type: 'string' },
    'cand-model-int8': { type: 'string' },
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

  // The candidate: all of it on the command line, or none of it.
  const candGiven = ['cand-ref', 'cand-tag', 'cand-models', 'cand-file', 'cand-model-fp32', 'cand-model-int8'].filter((k) => v[k] !== undefined);
  const cand = candGiven.length ? candidateSpec({ ref: v['cand-ref'], tag: v['cand-tag'], files: v['cand-file'], fp32Model: v['cand-model-fp32'], int8Model: v['cand-model-int8'] }) : undefined;
  if (cand && !v['cand-models']) die('candidate: --cand-models <dir> is required');
  if (cand) {
    // The addendum as COMMITTED at --rwxmap-ref, never the working tree.
    const repo = path.resolve(v.rwxmap);
    const at = gitIn(repo, 'rev-parse', '--verify', `${v['rwxmap-ref']}^{commit}`).toString().trim();
    checkAddendum(gitIn(repo, 'show', `${at}:${PREREG_PATH}`).toString('utf8'), cand);
    console.log(`candidate addendum: every field matches ${PREREG_PATH} at ${at}`);
  }

  const all = Object.keys(CONFIGS).filter((n) => (cand || CONFIGS[n].model !== 'cand') && (v.jev || n !== 'c-jev'));
  const names = v.config ? v.config.split(',') : all;
  for (const n of names) {
    if (!CONFIGS[n]) die(`unknown config ${n}`);
    if (CONFIGS[n].model === 'cand' && !cand) die(`${n}: refusing, no candidate given (--cand-ref, --cand-tag, --cand-models, five --cand-file, --cand-model-fp32, --cand-model-int8)`);
  }
  if (!v.jev && names.includes('c-jev')) names.splice(names.indexOf('c-jev'), 1);
  if (!names.includes('c-jev') && !v.jev) console.log('c-jev: skipped (no --jev)');
  if (!cand) console.log('candidate: none given; *-cand configs skipped (no D135 verdict possible)');

  const work = path.resolve(v.work ?? fs.mkdtempSync(path.join(os.tmpdir(), 'exam4-score-')));
  fs.mkdirSync(work, { recursive: true });
  const usedModels = ['base', 'cand'].filter((k) => names.some((n) => CONFIGS[n].model === k));
  const specs = { base: BASE, cand };
  const ctx = { work, specs: v.specs, rwxmap: undefined, models: {} };
  const baseMap = prepareRwxmap({ repo: path.resolve(v.rwxmap), ref: v['rwxmap-ref'], work, label: 'base' });
  ctx.rwxmap = baseMap.dir;
  console.log(`rwxmap ${v['rwxmap-ref']} = ${baseMap.sha}; scratch copy ${baseMap.dir}; src unchanged (tag ${BASE.tag})`);
  for (const k of usedModels) {
    const spec = specs[k];
    let modelsDir;
    if (k === 'base') { modelsDir = path.resolve(v['models-base'] ?? path.join(work, 'models-base')); await fetchBaseModels(modelsDir); }
    else modelsDir = path.resolve(v['cand-models']);
    const prep = prepareRwxlite({ spec, repo: v['rwxlite-repo'], modelsDir, work });
    let rwxmapDir = baseMap.dir;
    if (k === 'cand') {
      const cm = prepareRwxmap({ repo: path.resolve(v.rwxmap), ref: v['rwxmap-ref'], work, label: 'cand', tag: spec.tag });
      rwxmapDir = cm.dir;
      console.log(`candidate rwxmap copy ${cm.dir}; the whole change vs the archive:\n${cm.diff}`);
    }
    ctx.models[k] = { entry: prep.entry, caches: prep.caches, rwxmap: rwxmapDir, spec };
    console.log(`${k}: model set verified (5 files); rwxlite ref ${spec.ref} = ${prep.sha}; models ${spec.fp32.model}, ${spec.int8.model}`);
  }

  const results = {};
  for (const name of names) {
    const res = runConfig({ name, cfg: CONFIGS[name], ctx, ops, vendors: VENDORS, stems });
    results[name] = res;
    if (v['join-only']) {
      console.log(`${name}: join ok: ${res.joined.length} of ${res.opsRows} ops rows matched 1:1 (${res.sidecarRows} sidecar rows, 0 unmatched, 0 extra)${CONFIGS[name].variant ? `; rwxlite model ${res.models.join(',') || '(none: nothing to check)'}, sent ${res.rwxlite.sent}` : ''}`);
      continue;
    }
    console.log('\n' + renderConfig(name, res, opsAll.length));
    fs.mkdirSync(v.out, { recursive: true });
    writeRows(path.join(v.out, `rows-${name}.csv`), res.joined);
  }
  if (!v['join-only']) {
    console.log('\n' + renderVerdicts(results, opsAll.length));
    for (const n of ['mech', 'a-fp32-base', 'a-fp32-cand', 'c-jev']) {
      if (!results[n]) continue;
      const loose = results[n].joined.filter((r) => RANK[r.letter] < RANK[r.truth]);
      console.log(`\ntoo-loose rows, ${n} (${loose.length}): id provider method path truth->letter evidence`);
      for (const r of loose) console.log(`  ${r.id} ${r.provider} ${r.method} ${r.path} ${r.truth}->${r.letter} ${r.evidence}`);
    }
    if (results['a-fp32-base'] && results['a-fp32-cand']) {
      const cb = new Map(results['a-fp32-cand'].joined.map((r) => [r.id, r]));
      const diff = results['a-fp32-base'].joined.filter((r) => cb.get(r.id).letter !== r.letter);
      console.log(`\nrows where a-fp32-base and a-fp32-cand differ (${diff.length}): id provider method path truth base->cand`);
      for (const r of diff) console.log(`  ${r.id} ${r.provider} ${r.method} ${r.path} ${r.truth} ${r.letter}->${cb.get(r.id).letter}`);
    }
  }
  console.log(`\nscratch kept at ${work} (holds the CLI outputs; delete when done)`);
  return 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(`score: ${e.message}`); process.exit(1); });
}
