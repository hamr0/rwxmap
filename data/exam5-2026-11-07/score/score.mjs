// Pre-registered scorer for shared clean exam #5, rwxmap side (mechanical v4 gate).
// Runs the REAL rwxmap CLI per spec per config from three scratch copies of src/ at one git
// ref (V3 shipped; V4 = four files replaced by poc/mech-v4's; V4-R13 = V4 plus the one-line
// RWXLITE_TAG change), joins each operation to ops.csv 1:1, scores against truth.csv
// (sha256-checked), prints the GATE (mech-v4 vs mech-v3) and the reported-only bars.
// Too loose and too tight are always separate. Vanilla node ESM, no deps.
// See docs/wiki/exam-prereg-exam5.md for the copies, configs, hashes and bars.
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

/** The five files a model release carries, and the variant each manifest describes. */
export const FILE_NAMES = ['manifest.json', 'manifest-exact.json', 'model-int8-pc.onnx', 'model-fp32.onnx', 'vocab.txt'];
const VARIANT_FILES = {
  fp32: { manifest: 'manifest-exact.json', modelFile: 'model-fp32.onnx' },
  int8: { manifest: 'manifest.json', modelFile: 'model-int8-pc.onnx' },
};

/**
 * The BASELINE: rwxlite 0.2.0 as shipped (D135). Package from tag v0.2.0 (commit 6c47fec),
 * model files are the published v0.2.0 release assets. Its manifests carry no temperature
 * field: rwxlite's own default for that is 0.844 (src/answerer.js TEMPERATURE).
 */
export const BASE = {
  label: 'base',
  tag: 'v0.2.0',
  version: '0.2.0',
  ref: '6c47fec6734e666462164025674b55e8323d5b86',
  releaseUrl: 'https://github.com/hamr0/rwxlite/releases/download/v0.2.0/',
  temperature: 0.844,
  temperatureMayBeAbsent: true,
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
const TEMP_RE = /^\d+(\.\d+)?$/;

/**
 * Build the CANDIDATE description from command-line values. Refuses unless the tag, all five
 * file hashes, both model strings, the temperature and the safetensors hash are given, are
 * well formed, and agree with each other (a model string is rwxlite-<version>+<first 8 hex of
 * its model file's sha256>).
 * @param {{tag?: string, files?: string[], fp32Model?: string, int8Model?: string, ref?: string, temperature?: string, safetensors?: string, tarball?: string, tarballSha?: string}} o
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
  if (!o.temperature || !TEMP_RE.test(o.temperature) || !(Number(o.temperature) > 0)) die(`candidate: --cand-temperature must be a positive number like 0.991463, got ${JSON.stringify(o.temperature)}`);
  if (!o.safetensors || !HEX64.test(o.safetensors)) die('candidate: --cand-safetensors must be 64 lowercase hex (informational, recorded in the addendum)');
  if (!o.tarball) die('candidate: --cand-tarball is required (the package is installed from the tarball, not from the git ref)');
  if (!o.tarballSha || !HEX64.test(o.tarballSha)) die('candidate: --cand-tarball-sha must be 64 lowercase hex');
  const version = o.tag.slice(1);
  const spec = { label: 'cand', tag: o.tag, version, ref: o.ref, tarball: o.tarball, tarballSha: o.tarballSha, files, temperature: Number(o.temperature), temperatureText: o.temperature, safetensors: o.safetensors };
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
  ['rwxlite tag / version', (c) => c.tag],
  ['manifest.json sha256 (int8)', (c) => c.files['manifest.json']],
  ['manifest-exact.json sha256 (fp32)', (c) => c.files['manifest-exact.json']],
  ['model-int8-pc.onnx sha256', (c) => c.files['model-int8-pc.onnx']],
  ['model-fp32.onnx sha256', (c) => c.files['model-fp32.onnx']],
  ['vocab.txt sha256', (c) => c.files['vocab.txt']],
  ['fp32 model string', (c) => c.fp32.model],
  ['int8 model string', (c) => c.int8.model],
  ['temperature (from the fp32 manifest)', (c) => c.temperatureText],
  ['model.safetensors sha256', (c) => c.safetensors],
];
export const PREREG_PATH = 'docs/wiki/exam-prereg-exam5.md';

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

/** @typedef {{args: string[], copy: 'v3'|'v4'|'r13', variant?: 'fp32', pass?: 'a', model?: 'base'|'cand'}} Config */
/** @type {Record<string, Config>} */
export const CONFIGS = {
  'mech-v3': { args: ['--engine', 'mechanical'], copy: 'v3' },
  'mech-v4': { args: ['--engine', 'mechanical'], copy: 'v4' },
  'a-020-v3': { args: [], copy: 'v3', variant: 'fp32', pass: 'a', model: 'base' },
  'a-020-v4': { args: [], copy: 'v4', variant: 'fp32', pass: 'a', model: 'base' },
  'a-r13-v4': { args: [], copy: 'r13', variant: 'fp32', pass: 'a', model: 'cand' },
};
const MODE_A = Object.keys(CONFIGS).filter((n) => CONFIGS[n].pass === 'a');

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

/** ops.csv -> [{id, provider, method, path, operationId, summary, description}] ; header must be exact. */
export function loadOps(opsPath) {
  const rows = parseCsv(fs.readFileSync(opsPath, 'utf8'));
  const head = rows[0]?.join(',');
  if (head !== 'id,provider,method,path,operationId,summary,description') die(`ops.csv header unexpected: ${head}`);
  const ops = rows.slice(1).filter((r) => r.length > 1).map((r) => ({ id: r[0], provider: r[1], method: r[2], path: r[3], operationId: r[4], summary: r[5], description: r[6] }));
  if (new Set(ops.map((o) => o.id)).size !== ops.length) die('ops.csv has duplicate ids');
  return ops;
}

/** sources.json of the exam dir -> {vendor stem: provider}. */
export function loadVendors(sourcesPath) {
  const list = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
  const vendors = {};
  for (const s of list) {
    if (!s.vendor || !s.provider) die(`sources.json entry without vendor/provider: ${JSON.stringify(s)}`);
    if (s.vendor in vendors) die(`sources.json lists vendor ${s.vendor} twice`);
    vendors[s.vendor] = s.provider;
  }
  return vendors;
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

/** Read an input file and refuse unless its sha256 equals `expectedSha` (required). Returns the text. */
export function readHashed(file, expectedSha, flag) {
  if (!file) die(`refusing: no file given for ${flag}`);
  if (!expectedSha) die(`refusing: no expected sha256 given (${flag}-sha) for ${file}`);
  if (!HEX64.test(expectedSha)) die(`refusing: ${flag}-sha is not a sha256 hex: ${expectedSha}`);
  if (!fs.existsSync(file)) die(`refusing: ${flag} file not found: ${file}`);
  const buf = fs.readFileSync(file);
  const got = sha256Buf(buf);
  if (got !== expectedSha) die(`refusing: sha256 of ${file} is ${got}, expected ${expectedSha}`);
  return buf.toString('utf8');
}

/**
 * Hash every file of a model set in `dir` against `files` {name: sha256}. Throws on any difference.
 */
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
export function joinRows(ops, sidecars, vendors) {
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

/**
 * exact; loose1 = truth one class above the letter; loose2 = truth x, letter r;
 * loose = loose1 + loose2 (too loose); tight = letter above truth.
 */
export function tally(rows) {
  const t = { n: rows.length, exact: 0, loose1: 0, loose2: 0, loose: 0, tight: 0 };
  for (const r of rows) {
    const d = RANK[r.letter] - RANK[r.truth];
    if (d === 0) t.exact++;
    else if (d > 0) t.tight++;
    else { t.loose++; if (d === -2) t.loose2++; else t.loose1++; }
  }
  return t;
}
export function groupTally(rows, keyFn) {
  const g = new Map();
  for (const r of rows) { const k = keyFn(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  return [...g.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, rs]) => [k, tally(rs)]);
}

/**
 * The rwxmap GATE (user ruling 2026-11-06): mech-v4 vs mech-v3 on the same rows, integer counts.
 * GO only if (1) v4 too loose is strictly lower, (2) v4 loose-2 is no higher, (3) v4 too tight is
 * no higher. A tie on (1) fails.
 */
export function gate(v3, v4) {
  if (v3.n !== v4.n) die('gate: different denominators');
  const looseOk = v4.loose < v3.loose;
  const loose2Ok = v4.loose2 <= v3.loose2;
  const tightOk = v4.tight <= v3.tight;
  return { looseOk, loose2Ok, tightOk, pass: looseOk && loose2Ok && tightOk };
}
/** rwxlite's bar (theirs, reported only): cand too loose <= base's AND cand exact >= base's; a tie passes. */
export function rwxliteBar(base, cand) {
  if (base.n !== cand.n) die('rwxliteBar: different denominators');
  const looseOk = cand.loose <= base.loose;
  const exactOk = cand.exact >= base.exact;
  return { looseOk, exactOk, pass: looseOk && exactOk };
}
/**
 * D133 mode a bar (reported only): too loose <= mech's AND exact >= mech exact + ceil(5% of n) rows.
 * Integer arithmetic on counts. Same N required.
 */
export function modeABar(mech, cand) {
  if (mech.n !== cand.n) die('modeABar: different denominators');
  const looseOk = cand.loose <= mech.loose;
  const gainPts100 = (cand.exact - mech.exact) * 100; // points * n
  const exactOk = gainPts100 >= 5 * mech.n;
  return { looseOk, exactOk, pass: looseOk && exactOk, deltaPoints: gainPts100 / mech.n, needRows: Math.ceil(5 * mech.n / 100) };
}

// ---------------------------------------------------------------- the one-line tag change

/** The only line the candidate copy may change (src/modeldownload.js). */
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
const sameBytes = (a, b) => fs.readFileSync(a).equals(fs.readFileSync(b));

/**
 * Fail unless the scratch copy `newDir` differs from `origDir` in nothing but the one
 * RWXLITE_TAG line of src/modeldownload.js, which must now equal `newTag`.
 * Returns {changed: [files], diff: unified diff text} (diff is '' when nothing changed).
 */
export function checkOnlyTagChanged(origDir, newDir, newTag) {
  const a = listFiles(origDir), b = listFiles(newDir);
  if (a.join('\n') !== b.join('\n')) die('tag guard: the scratch copy has a different file list than the archive');
  const changed = a.filter((f) => !sameBytes(path.join(origDir, f), path.join(newDir, f)));
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

// ---------------------------------------------------------------- the three copies

/** The four src files V4 replaces with poc/mech-v4's, and the two that must already be identical. */
export const REPLACED = ['flow.js', 'step1.js', 'step2.js', 'step3.js'];
export const MUST_MATCH = ['tokens.js', 'types.js'];

/**
 * Every "scorer fails unless" check of the prereg's Code under test, on three scratch trees
 * (each holding src/ and package.json) and `poc`, the folder holding poc/mech-v4's files at the same ref.
 * Returns the unified diff of V4-R13 against V4 (exactly one line).
 */
export function checkCopies({ v3, v4, r13, poc, tag }) {
  const l3 = listFiles(v3);
  if (l3.join('\n') !== listFiles(v4).join('\n') || (r13 && l3.join('\n') !== listFiles(r13).join('\n'))) die('copies guard: the three copies do not list the same files');
  const want = REPLACED.map((n) => path.join('src', n)).sort();
  const differ = l3.filter((f) => !sameBytes(path.join(v3, f), path.join(v4, f)));
  if (differ.join('\n') !== want.join('\n')) die(`copies guard: V3 and V4 must differ in exactly ${want.join(', ')}; they differ in ${differ.join(', ') || 'nothing'}`);
  for (const n of REPLACED) {
    if (!fs.existsSync(path.join(poc, n)) || !sameBytes(path.join(poc, n), path.join(v4, 'src', n))) die(`copies guard: V4's src/${n} is not byte-identical to poc/mech-v4/${n}`);
  }
  for (const n of MUST_MATCH) {
    if (!fs.existsSync(path.join(poc, n)) || !sameBytes(path.join(poc, n), path.join(v3, 'src', n))) die(`copies guard: ${n} differs between poc/mech-v4 and src/`);
  }
  if (!r13) return '';
  const g = checkOnlyTagChanged(v4, r13, tag);
  if (g.changed.length !== 1) die(`copies guard: V4-R13 must differ from V4 by exactly one line of ${TAG_FILE}, found ${g.changed.length} changed file(s)`);
  return g.diff;
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
 * Refuse unless the working-tree src/, package.json and poc/mech-v4/ equal `sha`. Tracked
 * differences are checked in all three; untracked files only in src/ and package.json
 * (an untracked readout in poc/mech-v4 cannot change a byte of either copy).
 */
export function assertTreeMatchesRef(repo, sha, ref) {
  const dirty = spawnSync('git', ['-C', repo, 'diff', '--quiet', sha, '--', 'src', 'package.json', 'poc/mech-v4']);
  if (dirty.status !== 0) die(`rwxmap: working-tree src/, package.json or poc/mech-v4/ differs from ${ref}; commit first`);
  const untracked = gitIn(repo, 'ls-files', '--others', '--exclude-standard', '--', 'src', 'package.json').toString().trim();
  if (untracked) die(`rwxmap: untracked file(s) in src/ or package.json (not in ${ref}): ${untracked.split('\n').join(', ')}`);
}

/**
 * The three scratch copies at `ref` (git archive of src + package.json; `yaml` via a read-only
 * symlink to the repo's node_modules): V3, V4 (four files from the same ref's poc/mech-v4),
 * V4-R13 (V4 plus the RWXLITE_TAG line). Runs every guard. Never reads the working tree's
 * files; the repo's own src/ is never written. Returns {sha, dirs: {v3, v4, r13}, diff}.
 * `tag` is the candidate's tag; without it (no candidate) the R13 copy is not made.
 */
export function prepareCopies({ repo, ref, work, tag }) {
  const sha = gitIn(repo, 'rev-parse', '--verify', `${ref}^{commit}`).toString().trim();
  assertTreeMatchesRef(repo, sha, ref);
  const pocRoot = path.join(work, 'poc-archive');
  extractArchive(repo, sha, ['poc/mech-v4'], pocRoot);
  const poc = path.join(pocRoot, 'poc', 'mech-v4');
  const dirs = { v3: path.join(work, 'rwxmap-v3'), v4: path.join(work, 'rwxmap-v4'), ...(tag ? { r13: path.join(work, 'rwxmap-v4-r13') } : {}) };
  for (const [k, dir] of Object.entries(dirs)) {
    extractArchive(repo, sha, ['src', 'package.json'], dir);
    if (k === 'v3') continue;
    for (const n of REPLACED) fs.copyFileSync(path.join(poc, n), path.join(dir, 'src', n));
  }
  if (tag) {
    const tagFile = path.join(dirs.r13, TAG_FILE);
    fs.writeFileSync(tagFile, retag(fs.readFileSync(tagFile, 'utf8'), tag));
  }
  const diff = checkCopies({ ...dirs, poc, tag });
  for (const dir of Object.values(dirs)) fs.symlinkSync(path.join(repo, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  return { sha, dirs, diff };
}

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
 * The candidate tarball: its file's sha256 must equal `sha` AND `sha` must appear in the prereg
 * text (read at --rwxmap-ref). Returns nothing; throws otherwise.
 */
export function checkTarballSha(file, sha, preregText) {
  if (!fs.existsSync(file)) die(`tarball: file not found: ${file}`);
  const got = sha256File(file);
  if (got !== sha) die(`tarball: sha256 of ${file} is ${got}, --cand-tarball-sha says ${sha}`);
  if (!preregText.includes(sha)) die(`tarball: sha256 ${sha} does not appear in the prereg at the ref`);
}

/**
 * Install the candidate package from its tarball into `pkgDir` (a folder named rwxlite). The
 * tarball's package/package.json must be rwxlite at the tag's version, and every file under
 * package/src/ must be byte-identical to git archive of `ref`'s src/ (same file list, same bytes).
 */
export function installTarball({ tarball, repo, sha, version, pkgDir, work }) {
  const ls = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' });
  if (ls.status !== 0) die(`tarball: tar could not list ${tarball}: ${ls.stderr}`);
  const names = ls.stdout.split('\n').filter(Boolean);
  if (!names.length || names.some((n) => !n.startsWith('package/') || n.split('/').includes('..'))) die('tarball: an entry is outside package/ (or has ..); refusing to extract');
  const tmp = path.join(work, 'tgz-extract');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const x = spawnSync('tar', ['-xzf', tarball, '-C', tmp, '--no-same-owner']);
  if (x.status !== 0) die(`tarball: tar failed: ${x.stderr}`);
  const pj = JSON.parse(fs.readFileSync(path.join(tmp, 'package', 'package.json'), 'utf8'));
  if (pj.name !== 'rwxlite' || pj.version !== version) die(`tarball is ${pj.name}@${pj.version}, expected rwxlite@${version}`);
  const ref = path.join(work, 'tgz-ref-src');
  extractArchive(repo, sha, ['src'], ref);
  const a = listFiles(path.join(ref, 'src')), b = listFiles(path.join(tmp, 'package', 'src'));
  if (a.join('\n') !== b.join('\n')) die(`tarball: package/src/ lists different files than the ref's src/ (ref: ${a.join(', ')}; tarball: ${b.join(', ')})`);
  const diff = a.filter((f) => !sameBytes(path.join(ref, 'src', f), path.join(tmp, 'package', 'src', f)));
  if (diff.length) die(`tarball: package/src/ differs from the ref's src/ in: ${diff.join(', ')}`);
  fs.mkdirSync(path.dirname(pkgDir), { recursive: true });
  fs.renameSync(path.join(tmp, 'package'), pkgDir);
  return { files: a.length };
}

/** The temperature the fp32 manifest gives (absent = the 0.2.0 default, allowed only for the baseline) must equal spec.temperature. */
export function checkTemperature(spec, manifest) {
  const t = manifest.temperature ?? (spec.temperatureMayBeAbsent ? spec.temperature : undefined);
  if (t === undefined) die(`${spec.label}: the fp32 manifest has no temperature field`);
  if (t !== spec.temperature) die(`${spec.label}: fp32 manifest temperature ${t} != pre-registered ${spec.temperature}`);
}

/**
 * Scratch install of one rwxlite build: verify the five files, install the package (the
 * baseline: the ref's src + package.json; the candidate: its tarball, checked against the ref's src/; a real package folder named rwxlite so the version reader finds it)
 * at <work>/pkg-<label>/node_modules/rwxlite, onnxruntime-node via a read-only symlink to
 * the rwxlite checkout's node_modules, and one verified model cache per variant.
 */
export function prepareRwxlite({ spec, repo, modelsDir, work }) {
  verifyModelSet(modelsDir, spec.files);
  const sha = gitIn(repo, 'rev-parse', '--verify', `${spec.ref}^{commit}`).toString().trim();
  const pkgDir = path.join(work, `pkg-${spec.label}`, 'node_modules', 'rwxlite');
  fs.rmSync(path.join(work, `pkg-${spec.label}`), { recursive: true, force: true });
  if (spec.tarball) {
    if (sha256File(spec.tarball) !== spec.tarballSha) die('tarball changed since it was checked');
    installTarball({ tarball: spec.tarball, repo, sha, version: spec.version, pkgDir, work });
  } else {
    extractArchive(repo, sha, ['src', 'package.json'], pkgDir);
    const pj = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    if (pj.name !== 'rwxlite' || pj.version !== spec.version) die(`rwxlite ref ${sha} is ${pj.name}@${pj.version}, expected rwxlite@${spec.version}`);
  }
  const ort = path.join(repo, 'node_modules');
  if (!fs.existsSync(path.join(ort, 'onnxruntime-node'))) die(`onnxruntime-node not found in ${ort}`);
  fs.symlinkSync(ort, path.join(pkgDir, 'node_modules'), 'dir');
  const caches = {};
  for (const v of ['fp32', 'int8']) {
    const m = spec[v];
    const man = JSON.parse(fs.readFileSync(path.join(modelsDir, m.manifest), 'utf8'));
    if (man.version !== spec.version || man.model !== m.model || man.modelFile !== m.modelFile) die(`${m.manifest}: version/model/modelFile ${man.version}/${man.model}/${man.modelFile} do not match ${spec.version}/${m.model}/${m.modelFile}`);
    if (v === 'fp32') checkTemperature(spec, man);
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
  if (!cfg.variant) { // mechanical
    if (rl?.mode !== 'off' || jev?.mode !== 'off') die(`${name}: expected rwxlite and Jev off, got rwxlite=${rl?.mode} jev=${jev?.mode}`);
    return;
  }
  if (jev?.mode !== 'off') die(`${name}: Jev ran in an rwxlite config`);
  if (rl?.mode !== 'on') {
    // Mode a with no loose/tight row sends nothing and fetches no model: legitimate, counted, no model to assert.
    if (rl?.reason === 'nothing to check') return;
    die(`${name}: "rwxlite: off" (${rl?.reason}); refusing to score a mechanical fallback as ${name}`);
  }
  if (rl.model !== expectedModel) die(`${name}: model string ${rl.model} != expected ${expectedModel}`);
  if (rl.pass !== cfg.pass) die(`${name}: pass ${rl.pass} != ${cfg.pass}`);
  if (rl.confidence !== null) die(`${name}: mode a reported confidence ${rl.confidence}`);
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
 * One config over the (selected) vendors -> {joined, rwxlite, models, notes}.
 * ctx = {work, specs, copies: {v3, v4, r13: dir}, models: {base|cand: {entry, caches, spec}}}
 */
export function runConfig({ name, cfg, ctx, ops, vendors, stems }) {
  const m = cfg.model ? ctx.models[cfg.model] : undefined;
  if (cfg.model && !m) die(`${name}: no ${cfg.model} model prepared`);
  const rwxmap = ctx.copies[cfg.copy];
  if (!rwxmap) die(`${name}: no ${cfg.copy} copy prepared`);
  const env = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: path.join(ctx.work, 'home'), SCORE_RWXLITE_ENTRY: m ? m.entry : (ctx.models.base?.entry ?? 'file:///none') };
  env.XDG_CACHE_HOME = m ? m.caches[cfg.variant] : path.join(ctx.work, 'cache-none');
  fs.mkdirSync(env.HOME, { recursive: true });
  const expectedModel = cfg.variant ? m.spec[cfg.variant].model : undefined;
  const sidecars = {}, blocks = [], models = new Set(), notes = [];
  for (const stem of stems) {
    const spec = fs.readdirSync(ctx.specs).filter((f) => f.startsWith(`${stem}.`)).map((f) => path.join(ctx.specs, f));
    if (spec.length !== 1) die(`spec for ${stem}: found ${spec.length} files`);
    const res = runCli({ rwxmap, spec: spec[0], stem, cfg, env, work: ctx.work, name });
    checkBlocks(`${name}/${stem}`, cfg, res.combined, expectedModel);
    sidecars[stem] = res.sidecar.rows;
    blocks.push(res.combined.rwxlite);
    if (res.combined.rwxlite?.model) models.add(res.combined.rwxlite.model);
    if (cfg.variant && !/using cached rwxlite-/.test(res.stderr) && res.combined.rwxlite.mode === 'on') notes.push(`${stem}: no "using cached" line in stderr`);
  }
  const { joined, opsRows, sidecarRows } = joinRows(ops, sidecars, vendors);
  const rl = { sent: sum(blocks, 'sent'), raised: sum(blocks, 'raised'), lowered: sum(blocks, 'lowered'), kept: sum(blocks, 'kept'), undecided: sum(blocks, 'undecided') };
  return { joined, opsRows, sidecarRows, rwxlite: rl, models: [...models], notes };
}

// ---------------------------------------------------------------- lean check and parity replay

/** lean.csv -> Map id -> {class, rule, marker}. Header, classes and markers are validated. */
export function parseLean(text) {
  const rows = parseCsv(text);
  if (rows[0]?.join(',') !== 'id,class,rule,marker') die(`lean.csv header must be id,class,rule,marker, got: ${rows[0]?.join(',')}`);
  const m = new Map();
  for (const r of rows.slice(1)) {
    if (r.length === 1 && r[0] === '') continue;
    if (r.length !== 4) die(`lean.csv bad row: ${JSON.stringify(r)}`);
    if (!(r[1] in RANK)) die(`lean.csv class not r|w|x for ${r[0]}: ${JSON.stringify(r[1])}`);
    if (!['tight', 'loose', 'settled'].includes(r[3])) die(`lean.csv marker not tight|loose|settled for ${r[0]}: ${JSON.stringify(r[3])}`);
    if (m.has(r[0])) die(`lean.csv duplicate id ${r[0]}`);
    m.set(r[0], { class: r[1], rule: r[2], marker: r[3] });
  }
  return m;
}

/**
 * Compare lean.csv to mech-v4, row by row joined by id. The real CLI (copy V4) supplies the
 * letter and the marker (`joined`). The rule is in no CLI output file, so `inProc` is
 * V4's own flow.js classifyRow run in-process on the same ops.csv rows (Map id -> {class, rule, review});
 * it must equal lean.csv in class, rule and marker too. Any difference, missing or extra row throws.
 */
export function checkLean(lean, joined, inProc) {
  const problems = [];
  const seen = new Set();
  for (const r of joined) {
    seen.add(r.id);
    const l = lean.get(r.id);
    if (!l) { problems.push(`extra (in the CLI run, not in lean.csv): ${r.id}`); continue; }
    if (r.letter !== l.class) problems.push(`${r.id}: CLI class ${r.letter} != lean ${l.class}`);
    if (r.review !== l.marker) problems.push(`${r.id}: CLI marker ${r.review} != lean ${l.marker}`);
    const p = inProc.get(r.id);
    if (!p) problems.push(`${r.id}: no in-process verdict`);
    else {
      if (p.class !== l.class) problems.push(`${r.id}: V4 in-process class ${p.class} != lean ${l.class}`);
      if (p.rule !== l.rule) problems.push(`${r.id}: V4 in-process rule ${p.rule} != lean ${l.rule}`);
      if (p.review !== l.marker) problems.push(`${r.id}: V4 in-process marker ${p.review} != lean ${l.marker}`);
    }
  }
  for (const id of lean.keys()) if (!seen.has(id)) problems.push(`missing (in lean.csv, not in the CLI run): ${id}`);
  if (problems.length) die(`lean check failed, ${problems.length} problem(s):\n  ${problems.slice(0, 50).join('\n  ')}${problems.length > 50 ? `\n  ... and ${problems.length - 50} more` : ''}`);
}

/** rwxlite predictions csv (id,model,p_is_x,p_changes), one row per op in ops.csv order -> [{pIsX, pChanges}]. */
export function parsePreds(text, opsIds, model) {
  const rows = parseCsv(text);
  if (rows[0]?.join(',') !== 'id,model,p_is_x,p_changes') die(`predictions header must be id,model,p_is_x,p_changes, got: ${rows[0]?.join(',')}`);
  const body = rows.slice(1).filter((r) => !(r.length === 1 && r[0] === ''));
  if (body.length !== opsIds.length) die(`predictions: ${body.length} rows, ops.csv has ${opsIds.length}`);
  const num = (s, what, id) => { const v = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) ? Number(s) : NaN; if (!Number.isFinite(v)) die(`predictions: ${what} of ${id} is not a number: ${JSON.stringify(s)}`); return v; };
  return body.map((r, i) => {
    if (r.length !== 4) die(`predictions: bad row ${i + 2}: ${JSON.stringify(r)}`);
    if (r[0] !== opsIds[i]) die(`predictions: row ${i + 2} is id ${r[0]}, ops.csv order has ${opsIds[i]}`);
    if (r[1] !== model) die(`predictions: ${r[0]} model ${r[1]} != the candidate's fp32 model ${model}`);
    return { pIsX: num(r[2], 'p_is_x', r[0]), pChanges: num(r[3], 'p_changes', r[0]) };
  });
}

/**
 * Replay the committed predictions through secondPass (code from copy V4-R13): mechanical v4
 * verdicts from classifyRow on the ops.csv rows, a stub engine that returns each asked row's
 * committed p. Returns {rows: Map id -> {letter, review, evidence}, summary}.
 */
export async function replayPreds({ ops, preds, model, classifyRow, secondPass }) {
  const verdicts = ops.map((o) => classifyRow({ method: o.method, path: o.path, operationId: o.operationId, summary: o.summary, description: o.description }));
  const engine = async (items) => items.map((it) => ({ pIsX: preds[it.index].pIsX, pChanges: preds[it.index].pChanges, model }));
  const { verdicts: out, summary } = await secondPass(ops, verdicts, engine, { model });
  return { rows: new Map(ops.map((o, i) => [o.id, { letter: out[i].class, review: out[i].review, evidence: out[i].source }])), summary };
}

/** Parity: the replay must equal the real a-r13-v4 CLI verdicts (letter, marker, evidence) row for row, and the counts. */
export function checkParity(replay, cliRows, cliCounts) {
  const problems = [];
  const seen = new Set();
  for (const r of cliRows) {
    seen.add(r.id);
    const p = replay.rows.get(r.id);
    if (!p) { problems.push(`${r.id}: in the CLI run, not in the replay`); continue; }
    if (p.letter !== r.letter) problems.push(`${r.id}: replay class ${p.letter} != CLI ${r.letter}`);
    if (p.review !== r.review) problems.push(`${r.id}: replay marker ${p.review} != CLI ${r.review}`);
    if (p.evidence !== r.evidence) problems.push(`${r.id}: replay evidence ${p.evidence} != CLI ${r.evidence}`);
  }
  for (const id of replay.rows.keys()) if (!seen.has(id)) problems.push(`${id}: in the replay, not in the CLI run`);
  for (const k of ['sent', 'raised', 'lowered', 'kept', 'undecided']) if (replay.summary[k] !== cliCounts[k]) problems.push(`count ${k}: replay ${replay.summary[k]} != CLI ${cliCounts[k]}`);
  if (problems.length) die(`parity failed, ${problems.length} problem(s):\n  ${problems.slice(0, 50).join('\n  ')}${problems.length > 50 ? `\n  ... and ${problems.length - 50} more` : ''}`);
}

// ---------------------------------------------------------------- report

const c = (n, d) => `${String(n).padStart(4)} (${pct(n, d).padStart(5)})`;
const line = (label, t) => `${label.padEnd(14)} exact ${c(t.exact, t.n)}  loose-1 ${c(t.loose1, t.n)}  loose-2 ${c(t.loose2, t.n)}  too loose ${c(t.loose, t.n)}  too tight ${c(t.tight, t.n)}  of ${t.n}`;
const tooLoose = (rows) => rows.filter((r) => RANK[r.letter] < RANK[r.truth]);
const markerCounts = (rows) => ['tight', 'loose', 'settled'].map((k) => `${k} ${rows.filter((r) => r.review === k).length}`).join(' · ');

export function renderConfig(name, res, N) {
  const t = tally(res.joined);
  const out = [`== ${name} ==  model(s): ${res.models.join(', ') || '(none)'}  rows ${t.n}`];
  out.push(line('overall', t));
  if (t.n !== N) out.push(`  NOTE: denominator ${t.n} is not ${N}`);
  if (CONFIGS[name].variant) {
    const r = res.rwxlite;
    out.push(`rwxlite: sent ${r.sent} · raised ${r.raised} · lowered ${r.lowered} · kept ${r.kept} · undecided (asked, scored x) ${r.undecided}`);
  }
  out.push(`markers on the ${t.loose} too-loose rows: ${markerCounts(tooLoose(res.joined))}`);
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

const sgn = (n) => (n >= 0 ? '+' : '') + n;
export function renderVerdicts(results, N) {
  const tl = (n) => results[n] && tally(results[n].joined);
  const out = ['== GATE: mech-v4 vs mech-v3 (user ruling 2026-11-06; mechanical alone decides; integer counts) =='];
  const v3 = tl('mech-v3'), v4 = tl('mech-v4');
  if (!v3 || !v4) out.push('no verdict: needs mech-v3 and mech-v4 in this run');
  else {
    const g = gate(v3, v4);
    const ok = (b) => (b ? 'OK' : 'FAIL');
    out.push(`1. too loose (loose-1 + loose-2): v4 ${v4.loose} vs v3 ${v3.loose} (${sgn(v4.loose - v3.loose)}) -> ${ok(g.looseOk)} (need strictly lower; a tie fails)`);
    out.push(`2. loose-2: v4 ${v4.loose2} vs v3 ${v3.loose2} (${sgn(v4.loose2 - v3.loose2)}) -> ${ok(g.loose2Ok)} (need <=)`);
    out.push(`3. too tight: v4 ${v4.tight} vs v3 ${v3.tight} (${sgn(v4.tight - v3.tight)}) -> ${ok(g.tightOk)} (need <=)`);
    out.push(`GATE => ${g.pass ? 'GO: v4 replaces v3' : 'NO-GO: v3 stays in src/'}   (beside it: exact v4 ${v4.exact} vs v3 ${v3.exact}, of ${N})`);
  }
  out.push('', "== rwxlite's bar, REPORTED ONLY (theirs, not rwxmap's gate): a-r13-v4 vs a-020-v4, too loose <= and exact >=, a tie passes ==");
  const base = tl('a-020-v4'), cand = tl('a-r13-v4');
  if (!base || !cand) out.push('no verdict: needs a-020-v4 and a-r13-v4 in this run');
  else {
    const b = rwxliteBar(base, cand);
    out.push(`too loose ${cand.loose} vs ${base.loose} (${sgn(cand.loose - base.loose)}) -> ${b.looseOk ? 'OK' : 'FAIL'}; exact ${cand.exact} vs ${base.exact} (${sgn(cand.exact - base.exact)}) -> ${b.exactOk ? 'OK' : 'FAIL'}  => ${b.pass ? 'PASS' : 'FAIL'}   (beside it: too tight ${cand.tight} vs ${base.tight}, ${sgn(cand.tight - base.tight)})`);
  }
  out.push('', '== D133 mode a bar vs mech-v4, REPORTED ONLY: too loose <= mech-v4 and exact >= mech-v4 exact + ceil(5% of n) rows ==');
  for (const name of MODE_A) {
    if (!results[name]) continue;
    if (!v4) { out.push(`${name}: no mech-v4 in this run; no verdict`); continue; }
    const t = tally(results[name].joined), b = modeABar(v4, t);
    out.push(`${name}: too loose ${t.loose} vs mech-v4 ${v4.loose} -> ${b.looseOk ? 'OK' : 'FAIL'}; exact ${t.exact} (${pct(t.exact, N)}) vs mech-v4 ${v4.exact} (${pct(v4.exact, N)}) = ${b.deltaPoints.toFixed(2)} points, need ${b.needRows} more rows -> ${b.exactOk ? 'OK' : 'FAIL'}  => ${b.pass ? 'PASS' : 'FAIL'}`);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- main

/** The in-process verdicts of the V4 copy on the ops.csv rows, for the lean check (the rule is in no CLI output). */
async function inProcessVerdicts(copyDir, ops) {
  const { classifyRow } = await import(pathToFileURL(path.join(copyDir, 'src', 'flow.js')).href);
  return new Map(ops.map((o) => [o.id, classifyRow({ method: o.method, path: o.path, operationId: o.operationId, summary: o.summary, description: o.description })]));
}

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
    'cand-temperature': { type: 'string' },
    'cand-safetensors': { type: 'string' },
    'cand-tarball': { type: 'string' },
    'cand-tarball-sha': { type: 'string' },
    work: { type: 'string' },
    'exam-dir': { type: 'string', default: EXAM },
    ops: { type: 'string' },
    specs: { type: 'string' },
    truth: { type: 'string' },
    'truth-sha': { type: 'string' },
    lean: { type: 'string' },
    'lean-sha': { type: 'string' },
    preds: { type: 'string' },
    'preds-sha': { type: 'string' },
    out: { type: 'string', default: HERE },
    config: { type: 'string' },
    vendor: { type: 'string' },
    'join-only': { type: 'boolean', default: false },
  } });

  if (!v['truth-sha']) die('refusing: no expected truth sha256 given (--truth-sha)');
  const exam = path.resolve(v['exam-dir']);
  const opsPath = v.ops ?? path.join(exam, 'ops.csv');
  const opsAll = loadOps(opsPath);
  const truth = loadTruth(v.truth ?? path.join(exam, 'truth.csv'), v['truth-sha'], opsAll.map((o) => o.id));
  const sha = sha256File(opsPath);
  const shaFile = path.join(path.dirname(opsPath), 'ops.csv.sha256');
  if (fs.existsSync(shaFile) && fs.readFileSync(shaFile, 'utf8').split(/\s+/)[0] !== sha) die('ops.csv sha256 differs from ops.csv.sha256');
  console.log(`exam dir ${exam}; ops.csv sha256 ${sha}; truth.csv sha256 verified; ${opsAll.length} ops`);

  const VENDORS = loadVendors(path.join(exam, 'sources.json'));
  const stems = v.vendor ? v.vendor.split(',') : Object.keys(VENDORS);
  for (const s of stems) if (!VENDORS[s]) die(`unknown vendor ${s}`);
  const partial = stems.length !== Object.keys(VENDORS).length;
  if (partial && !v['join-only']) die('--vendor (a subset) is allowed only with --join-only');
  const providers = new Set(opsAll.map((o) => o.provider));
  if (Object.keys(VENDORS).length !== 7 || [...providers].sort().join() !== Object.values(VENDORS).sort().join()) die(`ops providers ${[...providers].join()} != the 7 in sources.json ${Object.values(VENDORS).join()}`);
  const ops = opsAll.filter((o) => stems.some((s) => VENDORS[s] === o.provider)).map((o) => ({ ...o, truth: truth.get(o.id) }));

  // The candidate: all of it on the command line, or none of it.
  const candGiven = ['cand-ref', 'cand-tag', 'cand-models', 'cand-file', 'cand-model-fp32', 'cand-model-int8', 'cand-temperature', 'cand-safetensors', 'cand-tarball', 'cand-tarball-sha'].filter((k) => v[k] !== undefined);
  const cand = candGiven.length ? candidateSpec({ ref: v['cand-ref'], tag: v['cand-tag'], files: v['cand-file'], fp32Model: v['cand-model-fp32'], int8Model: v['cand-model-int8'], temperature: v['cand-temperature'], safetensors: v['cand-safetensors'], tarball: v['cand-tarball'] && path.resolve(v['cand-tarball']), tarballSha: v['cand-tarball-sha'] }) : undefined;
  if (cand && !v['cand-models']) die('candidate: --cand-models <dir> is required');
  if (cand) {
    // The addendum as COMMITTED at --rwxmap-ref, never the working tree.
    const repo = path.resolve(v.rwxmap);
    const at = gitIn(repo, 'rev-parse', '--verify', `${v['rwxmap-ref']}^{commit}`).toString().trim();
    const preregText = gitIn(repo, 'show', `${at}:${PREREG_PATH}`).toString('utf8');
    checkAddendum(preregText, cand);
    checkTarballSha(cand.tarball, cand.tarballSha, preregText);
    console.log(`candidate addendum: every field matches ${PREREG_PATH} at ${at}; tarball sha256 matches the file and the prereg`);
  }

  const all = Object.keys(CONFIGS).filter((n) => cand || CONFIGS[n].model !== 'cand');
  const names = v.config ? v.config.split(',') : all;
  for (const n of names) {
    if (!CONFIGS[n]) die(`unknown config ${n}`);
    if (CONFIGS[n].model === 'cand' && !cand) die(`${n}: refusing, no candidate given (--cand-ref, --cand-tag, --cand-models, five --cand-file, --cand-model-fp32, --cand-model-int8, --cand-temperature, --cand-safetensors, --cand-tarball, --cand-tarball-sha)`);
  }
  if (!cand) console.log('candidate: none given; a-r13-v4 skipped (no rwxlite bar possible)');
  const joinOnly = v['join-only'];
  const wantLean = names.includes('mech-v4') && !joinOnly;
  const wantParity = names.includes('a-r13-v4') && !joinOnly;
  if (wantLean && (!v.lean || !v['lean-sha'])) die('refusing: mech-v4 is scored only with --lean <lean.csv> --lean-sha <sha256>');
  if (wantParity && (!v.preds || !v['preds-sha'])) die('refusing: a-r13-v4 is scored only with --preds <predictions csv> --preds-sha <sha256> (parity first)');
  if (!wantParity && (v.preds || v['preds-sha'])) die('--preds given but a-r13-v4 is not being scored');
  if (!wantLean && (v.lean || v['lean-sha'])) die('--lean given but mech-v4 is not being scored');
  const leanMap = wantLean ? parseLean(readHashed(v.lean, v['lean-sha'], '--lean')) : undefined;
  const predText = wantParity ? readHashed(v.preds, v['preds-sha'], '--preds') : undefined;

  const work = path.resolve(v.work ?? fs.mkdtempSync(path.join(os.tmpdir(), 'exam5-score-')));
  fs.mkdirSync(work, { recursive: true });
  const usedModels = ['base', 'cand'].filter((k) => names.some((n) => CONFIGS[n].model === k));
  const specs = { base: BASE, cand };
  const needR13 = names.includes('a-r13-v4');
  const copies = prepareCopies({ repo: path.resolve(v.rwxmap), ref: v['rwxmap-ref'], work, tag: needR13 ? cand.tag : undefined });
  const ctx = { work, specs: v.specs ? path.resolve(v.specs) : path.join(exam, 'specs'), copies: copies.dirs, models: {} };
  console.log(`rwxmap ${v['rwxmap-ref']} = ${copies.sha}; scratch copies V3 ${copies.dirs.v3}, V4 ${copies.dirs.v4}${copies.dirs.r13 ? `, V4-R13 ${copies.dirs.r13}` : ''}`);
  console.log('copy guards passed (same file list; V3 vs V4 differ in exactly flow/step1/step2/step3.js, each byte-identical to poc/mech-v4 at the ref; tokens.js and types.js equal in poc/mech-v4 and src/). ' + (copies.dirs.r13 ? `V4-R13 vs V4, the whole change:\n${copies.diff}` : 'no candidate, so no V4-R13 copy.'));
  for (const k of usedModels) {
    const spec = specs[k];
    let modelsDir;
    if (k === 'base') { modelsDir = path.resolve(v['models-base'] ?? path.join(work, 'models-base')); await fetchBaseModels(modelsDir); }
    else modelsDir = path.resolve(v['cand-models']);
    const prep = prepareRwxlite({ spec, repo: v['rwxlite-repo'], modelsDir, work });
    ctx.models[k] = { entry: prep.entry, caches: prep.caches, spec };
    console.log(`${k}: model set verified (5 files); rwxlite ref ${spec.ref} = ${prep.sha}; models ${spec.fp32.model}, ${spec.int8.model}; fp32 temperature ${spec.temperature} matches its manifest`);
  }

  // Every CLI run first, silently; the lean check and parity then gate any scoring output.
  const results = {};
  for (const name of names) {
    const res = runConfig({ name, cfg: CONFIGS[name], ctx, ops, vendors: VENDORS, stems });
    results[name] = res;
    console.log(`${name}: CLI run ok, ${res.joined.length} of ${res.opsRows} ops rows joined 1:1 (${res.sidecarRows} sidecar rows, 0 unmatched, 0 extra)${CONFIGS[name].variant ? `; rwxlite model ${res.models.join(',') || '(none: nothing to check)'}, sent ${res.rwxlite.sent}` : ''}`);
  }
  if (wantLean) {
    checkLean(leanMap, results['mech-v4'].joined, await inProcessVerdicts(copies.dirs.v4, opsAll));
    console.log(`lean check passed: mech-v4 CLI class and marker, and V4's in-process class, rule and marker, equal lean.csv on all ${leanMap.size} rows`);
  }
  if (wantParity) {
    const preds = parsePreds(predText, opsAll.map((o) => o.id), cand.fp32.model);
    const flow = await import(pathToFileURL(path.join(copies.dirs.r13, 'src', 'flow.js')).href);
    const sp = await import(pathToFileURL(path.join(copies.dirs.r13, 'src', 'secondpass.js')).href);
    const replay = await replayPreds({ ops: opsAll, preds, model: cand.fp32.model, classifyRow: flow.classifyRow, secondPass: sp.secondPass });
    checkParity(replay, results['a-r13-v4'].joined, results['a-r13-v4'].rwxlite);
    console.log(`parity passed: the replay of ${preds.length} committed predictions equals the a-r13-v4 CLI run on all ${replay.rows.size} rows (class, marker, evidence) and on sent/raised/lowered/kept/undecided`);
  }
  if (joinOnly) { console.log(`\nscratch kept at ${work}`); return 0; }

  fs.mkdirSync(v.out, { recursive: true });
  for (const name of names) {
    console.log('\n' + renderConfig(name, results[name], opsAll.length));
    writeRows(path.join(v.out, `rows-${name}.csv`), results[name].joined);
  }
  console.log('\n' + renderVerdicts(results, opsAll.length));
  for (const n of ['mech-v3', 'mech-v4', 'a-r13-v4']) {
    if (!results[n]) continue;
    const loose = tooLoose(results[n].joined);
    console.log(`\ntoo-loose rows, ${n} (${loose.length}): id provider method path truth->letter marker evidence`);
    for (const r of loose) console.log(`  ${r.id} ${r.provider} ${r.method} ${r.path} ${r.truth}->${r.letter} ${r.review} ${r.evidence}`);
  }
  if (results['mech-v3'] && results['mech-v4']) {
    const b = new Map(results['mech-v4'].joined.map((r) => [r.id, r]));
    const diff = results['mech-v3'].joined.filter((r) => b.get(r.id).letter !== r.letter);
    const markerOnly = results['mech-v3'].joined.filter((r) => b.get(r.id).letter === r.letter && b.get(r.id).review !== r.review).length;
    console.log(`\nrows where mech-v3 and mech-v4 differ in letter (${diff.length}; a further ${markerOnly} differ only in marker): id provider method path truth v3->v4 (markers v3/v4)`);
    for (const r of diff) { const o = b.get(r.id); console.log(`  ${r.id} ${r.provider} ${r.method} ${r.path} ${r.truth} ${r.letter}->${o.letter} (${r.review}/${o.review})`); }
  }
  console.log(`\nscratch kept at ${work} (holds the CLI outputs; delete when done)`);
  return 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`score: ${e.message}`); process.exit(1); });
}
