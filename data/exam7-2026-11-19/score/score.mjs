// Pre-registered scorer for shared clean exam #7 (D142 next-model ship gate, D140 mode b at 85), rwxmap side.
// Runs the REAL rwxmap CLI per spec per config, joins each operation to ops.csv 1:1, scores against
// truth.csv (three sha256 checks), prints the D142 gate and the D133 bar. Two models are compared:
// the BASELINE (rwxlite 0.3.1 as shipped) and a CANDIDATE whose every addendum field must be given
// on the command line and match the prereg as committed at --rwxmap-ref. Too loose (loose-1 and
// loose-2 counted separately) and too tight are never folded together. Vanilla node ESM, no deps.
// The spec is docs/wiki/exam-prereg-exam7.md; where it and exam #4's scorer differ, the prereg wins.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAM = path.dirname(HERE);
const REPO = path.resolve(EXAM, '..', '..');

export const RANK = { r: 0, w: 1, x: 2 };
export const EXPECTED_N = 1579;
export const OPS_SHA = 'abe5e6cd410c72d0bee1b85948ccb12b7d898873f9cb032eb5d27bcd5e447ea3';
/** vendor stem -> {provider, ops}, from the prereg's row table (also checked against sources.json and ops.csv). */
export const VENDORS = {
  ringcentral: { provider: 'ringcentral.com', ops: 347 },
  openziti: { provider: 'openziti.io', ops: 204 },
  gitness: { provider: 'harness.io', ops: 257 },
  huggingface: { provider: 'huggingface.co', ops: 386 },
  pipedrive: { provider: 'pipedrive.com', ops: 213 },
  vikunja: { provider: 'vikunja.io', ops: 172 },
};
export const PREREG_PATH = 'docs/wiki/exam-prereg-exam7.md';
const HEX64 = /^[0-9a-f]{64}$/;
const TAG_RE = /^v\d+\.\d+\.\d+$/;
const VER_RE = /^\d+\.\d+\.\d+$/;
const REF_RE = /^[0-9a-f]{7,40}$/;
const die = (msg) => { throw new Error(msg); };
const pct = (n, d) => (d === 0 ? '0.0%' : `${(100 * n / d).toFixed(1)}%`);

/** Only fp32 is scored (int8 is not part of this exam). */
export const FILE_NAMES = ['manifest-exact.json', 'model-fp32.onnx', 'vocab.txt'];

/**
 * The BASELINE: rwxlite 0.3.1 as shipped. ref = the v0.3.1 tag commit, whose src/ and package.json are
 * byte-identical to the published npm 0.3.1 (checked 2026-11-19 against exam #6's npm install).
 * File hashes are the v0.3.1 release assets' own sha256 (GitHub release digests, exam #5 prereg).
 */
export const BASE = {
  label: 'base',
  tag: 'v0.3.1',
  version: '0.3.1',
  ref: '5069dfa1f242f451a2d8b38c7bf2bfb08710d03b',
  releaseUrl: 'https://github.com/hamr0/rwxlite/releases/download/v0.3.1/',
  files: {
    'manifest-exact.json': 'c6bac86970888049952305f72434abe5c9d8f854224a5537f14e5a428a977739',
    'model-fp32.onnx': 'bbe1997d43020724f9eab9e42e8f6337e9640fe46f764b6fceac1eb1d000a3cf',
    'vocab.txt': '07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3',
  },
  model: 'rwxlite-0.3.1+bbe1997d',
  manifest: 'manifest-exact.json',
  modelFile: 'model-fp32.onnx',
};

/** Addendum rows, in the prereg, and the candidate value each must equal. */
export const ADDENDUM_FIELDS = [
  ['rwxlite package version', (c) => c.version],
  ['rwxlite package ref (commit in the rwxlite repo)', (c) => c.ref],
  ['rwxlite tag / version (the tag rwxmap would pin)', (c) => c.tag],
  ['model string (fp32)', (c) => c.model],
  ['model-fp32.onnx sha256', (c) => c.files['model-fp32.onnx']],
  ['manifest-exact.json sha256 (fp32)', (c) => c.files['manifest-exact.json']],
  ['vocab.txt sha256', (c) => c.files['vocab.txt']],
  ['rwxlite prereg commit (rwxlite repo)', (c) => c.preregCommit],
];

/**
 * Build the CANDIDATE from command-line values. Every field is required and must be well formed and
 * consistent (tag = v<version>; model string = rwxlite-<version>+<first 8 hex of the model file's sha256>;
 * different from the baseline's).
 */
export function candidateSpec(o) {
  const need = (k, v) => { if (!v) die(`candidate: --cand-${k} is required`); };
  need('version', o.version); need('ref', o.ref); need('tag', o.tag); need('model', o.model);
  need('model-sha', o.modelSha); need('manifest-sha', o.manifestSha); need('vocab-sha', o.vocabSha); need('prereg-commit', o.preregCommit);
  if (!VER_RE.test(o.version)) die(`candidate: --cand-version must look like 0.4.0, got ${JSON.stringify(o.version)}`);
  if (!TAG_RE.test(o.tag)) die(`candidate: --cand-tag must look like v0.4.0, got ${JSON.stringify(o.tag)}`);
  if (o.tag !== `v${o.version}`) die(`candidate: --cand-tag ${o.tag} is not v${o.version}`);
  if (!REF_RE.test(o.ref)) die(`candidate: --cand-ref must be a commit hash (7-40 lowercase hex), got ${JSON.stringify(o.ref)}`);
  for (const [k, v] of [['model-sha', o.modelSha], ['manifest-sha', o.manifestSha], ['vocab-sha', o.vocabSha]]) if (!HEX64.test(v)) die(`candidate: --cand-${k} is not 64 lowercase hex`);
  const want = `rwxlite-${o.version}+${o.modelSha.slice(0, 8)}`;
  if (o.model !== want) die(`candidate: --cand-model ${o.model} does not match the model-fp32.onnx hash (expected ${want})`);
  if (o.model === BASE.model) die('candidate: the model string equals the baseline\'s; the candidate must be a different model');
  return {
    label: 'cand', version: o.version, tag: o.tag, ref: o.ref, model: o.model, preregCommit: o.preregCommit,
    manifest: BASE.manifest, modelFile: BASE.modelFile,
    files: { 'manifest-exact.json': o.manifestSha, 'model-fp32.onnx': o.modelSha, 'vocab.txt': o.vocabSha },
  };
}

/** Text of the "### CANDIDATE:" section of the prereg (up to the next heading of level 1-3). */
function candidateSection(preregText) {
  const start = preregText.indexOf('### CANDIDATE:');
  if (start < 0) die('addendum: no "### CANDIDATE:" section in the prereg');
  const rest = preregText.slice(start + 3);
  const end = rest.search(/^#{1,3} /m);
  return end < 0 ? rest : rest.slice(0, end);
}

/**
 * Check a candidate against the CANDIDATE ADDENDUM table in the prereg text. Refuses if the section or any
 * field row is missing, if any value is PENDING or empty, or if any value differs from the command line.
 */
export function checkAddendum(preregText, cand) {
  const cells = new Map();
  for (const l of candidateSection(preregText).split('\n')) {
    const m = /^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$/.exec(l);
    if (m) cells.set(m[1], m[2].replace(/^`|`$/g, '').trim());
  }
  const problems = [];
  for (const [label, get] of ADDENDUM_FIELDS) {
    const v = cells.get(label);
    if (v === undefined) problems.push(`no row "${label}"`);
    else if (v === '' || /pending/i.test(v)) problems.push(`"${label}" is still PENDING`);
    else if (v !== get(cand)) problems.push(`"${label}": prereg says ${v}, command line says ${get(cand)}`);
  }
  if (problems.length) die(`addendum: refusing to score a candidate that the committed prereg does not state:\n  ${problems.join('\n  ')}`);
}

/** The truth.csv sha256 as committed in the prereg text. Refuses if absent, PENDING or not a sha256. */
export function preregTruthSha(preregText) {
  const m = /^- `truth\.csv` sha256:[ \t]*(.*)$/m.exec(preregText);
  if (!m) die('prereg: no "- `truth.csv` sha256:" line');
  const v = m[1].replace(/[*`]/g, '').trim();
  if (v === '' || /pending/i.test(v)) die('prereg: the truth.csv sha256 is still PENDING at this ref; refusing to score');
  if (!HEX64.test(v)) die(`prereg: the truth.csv sha256 is not 64 lowercase hex: ${JSON.stringify(v)}`);
  return v;
}

/** @typedef {{args: string[], pass?: 'a'|'b', confidence?: number, model?: 'base'|'cand', gate?: true}} Config */
/** @type {Record<string, Config>} */
export const CONFIGS = {
  mech: { args: ['--engine', 'mechanical'] },
  'a-base': { args: [], pass: 'a', model: 'base' },
  'a-cand': { args: [], pass: 'a', model: 'cand', gate: true },
  'b85-base': { args: ['--engine', 'rwxlite'], pass: 'b', confidence: 85, model: 'base' },
  'b85-cand': { args: ['--engine', 'rwxlite'], pass: 'b', confidence: 85, model: 'cand' },
};

// ---------------------------------------------------------------- small utils

export function sha256Buf(buf) { return createHash('sha256').update(buf).digest('hex'); }
export function sha256File(p) { return sha256Buf(fs.readFileSync(p)); }

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

/** ops.csv text -> [{id, provider, method, path}] ; header must be exact. */
export function parseOps(text) {
  const rows = parseCsv(text);
  const head = rows[0]?.join(',');
  if (head !== 'id,provider,method,path,operationId,summary,description') die(`ops.csv header unexpected: ${head}`);
  const ops = rows.slice(1).filter((r) => r.length > 1).map((r) => ({ id: r[0], provider: r[1], method: r[2], path: r[3] }));
  if (new Set(ops.map((o) => o.id)).size !== ops.length) die('ops.csv has duplicate ids');
  return ops;
}

/**
 * truth.csv bytes. Refused unless sha256(bytes) equals `expectedSha` (--truth-sha, required) AND `fileSha`
 * (truth.csv.sha256) AND `preregSha` (the value committed in the prereg at the ref). Returns Map id -> label.
 */
export function parseTruth(buf, { expectedSha, fileSha, preregSha }, opsIds) {
  if (!expectedSha) die('refusing: no expected truth sha256 given (--truth-sha)');
  if (!HEX64.test(expectedSha)) die(`refusing: --truth-sha is not a sha256 hex: ${expectedSha}`);
  const got = sha256Buf(buf);
  if (got !== expectedSha) die(`refusing: truth sha256 ${got} != --truth-sha ${expectedSha}`);
  if (fileSha !== got) die(`refusing: truth sha256 ${got} != truth.csv.sha256 ${fileSha}`);
  if (preregSha !== got) die(`refusing: truth sha256 ${got} != the value committed in the prereg ${preregSha}`);
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

/**
 * sources.json entries -> {vendors: stem -> provider, specs: [{stem, file}]}. Each spec is gunzipped into
 * `destDir` as <stem>.<ext> and the sha256 of the uncompressed bytes (and of the .gz on disk) is checked
 * against sources.json before anything runs. The stems and providers must be exactly VENDORS.
 */
export function prepareSpecs(sources, examDir, destDir) {
  const stems = sources.map((s) => s.vendor).sort().join();
  if (stems !== Object.keys(VENDORS).sort().join()) die(`sources.json vendors ${stems} are not the 6 expected`);
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  const vendors = {}, specs = [];
  for (const s of sources) {
    if (s.provider !== VENDORS[s.vendor].provider) die(`sources.json: ${s.vendor} provider ${s.provider} != ${VENDORS[s.vendor].provider}`);
    if (!HEX64.test(s.sha256 ?? '') || !HEX64.test(s.sha256_gz ?? '')) die(`sources.json: ${s.vendor} has no sha256 / sha256_gz`);
    const gz = fs.readFileSync(path.join(examDir, s.file));
    if (sha256Buf(gz) !== s.sha256_gz) die(`spec ${s.file}: gz sha256 ${sha256Buf(gz)} != sources.json ${s.sha256_gz}`);
    const raw = gunzipSync(gz);
    if (sha256Buf(raw) !== s.sha256) die(`spec ${s.file}: uncompressed sha256 ${sha256Buf(raw)} != sources.json ${s.sha256}`);
    const m = /^specs\/([a-z]+)\.(json|ya?ml)\.gz$/.exec(s.file);
    if (!m || m[1] !== s.vendor) die(`sources.json: unexpected spec file name ${s.file}`);
    const dest = path.join(destDir, `${s.vendor}.${m[2]}`);
    fs.writeFileSync(dest, raw);
    vendors[s.vendor] = s.provider;
    specs.push({ stem: s.vendor, file: dest });
  }
  return { vendors, specs };
}

// ---------------------------------------------------------------- the join

/**
 * Join sidecar rows (per vendor stem) to ops 1:1 by (provider, METHOD, path). Throws, listing the
 * offenders, on any unmatched ops row, unmatched/extra output row or duplicate; every letter must be r|w|x.
 * Returns {joined (in ops order), counts}.
 */
export function joinRows(ops, sidecars, vendors) {
  const byKey = new Map();
  for (const o of ops) {
    const k = `${o.provider}\0${o.method.toUpperCase()}\0${o.path}`;
    if (byKey.has(k)) die(`ops has two rows for ${o.provider} ${o.method} ${o.path}`);
    byKey.set(k, o);
  }
  const hit = new Map();
  const problems = [];
  let unmatchedOutput = 0, duplicates = 0;
  for (const [stem, rows] of Object.entries(sidecars)) {
    const provider = vendors[stem];
    if (!provider) die(`no provider for vendor stem ${stem}`);
    for (const r of rows) {
      const o = byKey.get(`${provider}\0${String(r.method).toUpperCase()}\0${r.path}`);
      if (!o) { unmatchedOutput++; problems.push(`output op with no ops row: ${stem} ${r.method} ${r.path}`); continue; }
      if (hit.has(o.id)) { duplicates++; problems.push(`duplicate key: ${o.id} matched twice (${stem} ${r.method} ${r.path})`); continue; }
      if (!(r.letter in RANK)) { problems.push(`bad letter ${JSON.stringify(r.letter)} for ${o.id}`); continue; }
      hit.set(o.id, { ...o, predicted: r.letter, marker: r.marker, evidence: r.evidence });
    }
  }
  let unmatchedOps = 0;
  for (const o of ops) if (!hit.has(o.id)) { unmatchedOps++; problems.push(`ops row with no output op: ${o.id} ${o.provider} ${o.method} ${o.path}`); }
  if (problems.length) {
    die(`join failed (matched ${hit.size}, unmatched ops ${unmatchedOps}, unmatched output ${unmatchedOutput}, duplicates ${duplicates}):\n  ${problems.slice(0, 50).join('\n  ')}${problems.length > 50 ? `\n  ... and ${problems.length - 50} more` : ''}`);
  }
  return { joined: ops.map((o) => hit.get(o.id)), counts: { matched: hit.size, unmatchedOps, unmatchedOutput, duplicates } };
}

// ---------------------------------------------------------------- scoring

/** exact | loose-1 | loose-2 | tight, from truth and predicted class. */
export function classify(truth, predicted) {
  if (!(truth in RANK) || !(predicted in RANK)) die(`bad class: truth ${truth} predicted ${predicted}`);
  const d = RANK[predicted] - RANK[truth];
  if (d === 0) return 'exact';
  if (d > 0) return 'tight';
  return d === -2 ? 'loose-2' : 'loose-1';
}

/** Counts per outcome; loose = loose1 + loose2 (too loose). Too tight is never folded in. */
export function tally(rows) {
  const t = { n: rows.length, exact: 0, loose1: 0, loose2: 0, loose: 0, tight: 0 };
  for (const r of rows) {
    const c = classify(r.truth, r.predicted);
    if (c === 'exact') t.exact++;
    else if (c === 'tight') t.tight++;
    else { t.loose++; if (c === 'loose-2') t.loose2++; else t.loose1++; }
  }
  return t;
}
export function groupTally(rows, keyFn) {
  const g = new Map();
  for (const r of rows) { const k = keyFn(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  return [...g.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, rs]) => [k, tally(rs)]);
}
export const tooLoose = (rows) => rows.filter((r) => RANK[r.predicted] < RANK[r.truth]);

/**
 * D133 mode a bar (reported only): too loose <= mech's AND exact >= mech's exact + ceil(5% of n).
 * Integer arithmetic on counts (5.0 points of 1579 = 78.95 rows, so 79).
 */
export function modeABar(mech, a) {
  if (mech.n !== a.n) die('modeABar: different denominators');
  const needRows = Math.ceil(5 * mech.n / 100);
  const looseOk = a.loose <= mech.loose;
  const exactOk = a.exact >= mech.exact + needRows;
  return { looseOk, exactOk, needRows, pass: looseOk && exactOk };
}
/**
 * D142 gate (user ruling 2026-11-20, replaces the D135 "same or better" gate for this exam): the candidate
 * replaces 0.3.1 only if, on the same rows, a-cand's exact >= a-base's exact (a tie passes) AND a-cand's too
 * loose share <= a-base's too loose share + 1.0 point. Integer form: cand.loose - base.loose <= floor(0.01 * n)
 * (15 at n 1579). Too tight is reported beside the gate and is not part of it.
 */
export function d142Gate(base, cand) {
  if (base.n !== cand.n) die('d142Gate: different denominators');
  const looseAllowance = Math.floor(0.01 * base.n);
  const looseOk = cand.loose - base.loose <= looseAllowance;
  const exactOk = cand.exact >= base.exact;
  return { looseOk, exactOk, looseAllowance, pass: looseOk && exactOk, looseDelta: cand.loose - base.loose, exactDelta: cand.exact - base.exact, tightDelta: cand.tight - base.tight };
}

// ---------------------------------------------------------------- the one-line tag change

/** The only line a candidate run may change in a scratch copy of rwxmap (src/modeldownload.js). */
const TAG_LINE_RE = /^export const RWXLITE_TAG = 'v\d+\.\d+\.\d+';$/;
const TAG_FILE = path.join('src', 'modeldownload.js');
const tagLine = (tag) => `export const RWXLITE_TAG = '${tag}';`;

/** Replace the RWXLITE_TAG line (exactly one must exist) with `newTag`. */
export function retag(text, newTag) {
  if (!TAG_RE.test(newTag)) die(`retag: ${JSON.stringify(newTag)} is not a tag like v0.4.0`);
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
 * Fail unless the scratch copy `newDir` differs from the pristine archive `origDir` in nothing but the one
 * RWXLITE_TAG line of src/modeldownload.js, which must now equal `newTag`. Returns {changed, diff}.
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
const readTag = (file) => /^export const RWXLITE_TAG = '(v[\d.]+)';$/m.exec(fs.readFileSync(file, 'utf8'))?.[1] ?? die(`no RWXLITE_TAG in ${file}`);

/**
 * A scratch copy of rwxmap at `ref` (git archive of src + package.json; `yaml` via a read-only symlink to the
 * repo's node_modules). With `tag`, applies the one-line RWXLITE_TAG change and runs the guard. Refuses a
 * working tree whose src/ or package.json differs from `ref` (tracked changes or untracked files in src/).
 * Returns {dir, sha, diff, tag} where tag is the RWXLITE_TAG the copy ends up with.
 */
export function prepareRwxmap({ repo, ref, work, label, tag }) {
  const sha = gitIn(repo, 'rev-parse', '--verify', `${ref}^{commit}`).toString().trim();
  const dirty = spawnSync('git', ['-C', repo, 'diff', '--quiet', sha, '--', 'src', 'package.json']);
  if (dirty.status !== 0) die(`rwxmap: working-tree src/ or package.json differs from ${ref}; commit first`);
  const untracked = gitIn(repo, 'ls-files', '--others', '--exclude-standard', '--', 'src', 'package.json').toString().trim();
  if (untracked) die(`rwxmap: untracked files under src/ (${untracked.split('\n')[0]} ...); the working tree is not ${ref}`);
  const dir = path.join(work, `rwxmap-${label}`), orig = path.join(work, `rwxmap-${label}-orig`);
  extractArchive(repo, sha, ['src', 'package.json'], dir);
  extractArchive(repo, sha, ['src', 'package.json'], orig);
  if (tag) {
    const f = path.join(dir, TAG_FILE);
    fs.writeFileSync(f, retag(fs.readFileSync(f, 'utf8'), tag));
  }
  const finalTag = tag ?? readTag(path.join(orig, TAG_FILE));
  const guard = checkOnlyTagChanged(orig, dir, finalTag);
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  return { dir, sha, diff: guard.diff, tag: finalTag };
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
 * Scratch install of one rwxlite build: verify the three files, install the ref's package (src + package.json,
 * a real package folder named rwxlite so the version reader finds it) at <work>/pkg-<label>/node_modules/rwxlite,
 * onnxruntime-node via a read-only symlink to the rwxlite checkout's node_modules, and one verified fp32 model
 * cache laid out as rwxmap's (<cache>/rwxmap/rwxlite-<version>+<sha8>/).
 */
export function prepareRwxlite({ spec, repo, modelsDir, work }) {
  verifyModelSet(modelsDir, spec.files);
  const sha = gitIn(repo, 'rev-parse', '--verify', `${spec.ref}^{commit}`).toString().trim();
  if (!sha.startsWith(spec.ref)) die(`rwxlite ref ${spec.ref} resolved to ${sha}; give the commit hash itself`);
  const pkgDir = path.join(work, `pkg-${spec.label}`, 'node_modules', 'rwxlite');
  fs.rmSync(path.join(work, `pkg-${spec.label}`), { recursive: true, force: true });
  extractArchive(repo, sha, ['src', 'package.json'], pkgDir);
  const pj = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  if (pj.name !== 'rwxlite' || pj.version !== spec.version) die(`rwxlite ref ${sha} is ${pj.name}@${pj.version}, expected rwxlite@${spec.version}`);
  const ort = path.join(repo, 'node_modules');
  if (!fs.existsSync(path.join(ort, 'onnxruntime-node'))) die(`onnxruntime-node not found in ${ort}`);
  fs.symlinkSync(ort, path.join(pkgDir, 'node_modules'), 'dir');
  const man = JSON.parse(fs.readFileSync(path.join(modelsDir, spec.manifest), 'utf8'));
  if (man.version !== spec.version || man.model !== spec.model || man.modelFile !== spec.modelFile) die(`${spec.manifest}: version/model/modelFile ${man.version}/${man.model}/${man.modelFile} do not match ${spec.version}/${spec.model}/${spec.modelFile}`);
  const cache = path.join(work, `cache-${spec.label}`);
  const dir = path.join(cache, 'rwxmap', spec.model);
  fs.rmSync(cache, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(modelsDir, spec.manifest), path.join(dir, 'manifest.json'));
  for (const [f, want] of Object.entries(man.files)) {
    if (spec.files[f] !== want) die(`${spec.manifest} lists ${f} sha256 ${want}, not the pre-registered one`);
    fs.copyFileSync(path.join(modelsDir, f), path.join(dir, f));
    if (sha256File(path.join(dir, f)) !== want) die(`copied ${f} does not match the frozen hash`);
  }
  return { sha, entry: pathToFileURL(path.join(pkgDir, 'src', 'index.js')).href, cache };
}

// ---------------------------------------------------------------- CLI runs

/**
 * Check one run's log text and combined JSON against what the config requires. Throws otherwise, so an
 * "rwxlite: off" fallback, a wrong model string, pass or confidence is never scored.
 */
export function checkRun(name, cfg, logText, combined, expectedModel) {
  const rl = combined?.rwxlite, jev = combined?.jev;
  if (jev?.mode !== 'off') die(`${name}: Jev block is ${jev?.mode}; Jev is not scored`);
  if (!cfg.model) { // mech
    if (!logText.includes('rwxlite: off (mechanical)')) die(`${name}: engine line lacks "rwxlite: off (mechanical)"`);
    if (rl?.mode !== 'off') die(`${name}: expected rwxlite off, got ${rl?.mode}`);
    return;
  }
  if (!logText.includes(`rwxlite: on (${expectedModel})`)) die(`${name}: engine line lacks "rwxlite: on (${expectedModel})"; refusing to score a mechanical fallback or another model as ${name}`);
  if (rl?.mode !== 'on') die(`${name}: combined rwxlite block is ${JSON.stringify(rl)}`);
  if (rl.model !== expectedModel) die(`${name}: model string ${rl.model} != expected ${expectedModel}`);
  if (rl.pass !== cfg.pass) die(`${name}: pass ${rl.pass} != ${cfg.pass}`);
  if (cfg.pass === 'b') {
    if (rl.confidence !== cfg.confidence) die(`${name}: confidence ${rl.confidence} != ${cfg.confidence}`);
    if (!logText.includes(`mode b, confidence ${cfg.confidence}`)) die(`${name}: engine line lacks "mode b, confidence ${cfg.confidence}"`);
  } else if (rl.confidence !== null) die(`${name}: mode a reported confidence ${rl.confidence}`);
}

/** Run the real CLI for one config on one spec; returns {combined, sidecar, log}. */
export function runCli({ rwxmap, spec, stem, cfg, env, work, name }) {
  const out = path.join(work, 'out', name, stem);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const cwd = path.join(work, 'cwd'); // no .env here, never the repo root
  fs.mkdirSync(cwd, { recursive: true });
  if (fs.existsSync(path.join(cwd, '.env'))) die(`${cwd} holds a .env; refusing to run the CLI there`);
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(path.join(HERE, 'preload.mjs')).href, path.join(rwxmap, 'src', 'cli.js'), spec, '--vendor', stem, '-o', out, ...cfg.args], { cwd, env, encoding: 'utf8', maxBuffer: 256 << 20 });
  fs.writeFileSync(path.join(work, 'out', name, `${stem}.stdout.log`), r.stdout ?? '');
  fs.writeFileSync(path.join(work, 'out', name, `${stem}.stderr.log`), r.stderr ?? '');
  if (r.status !== 0) die(`${name}/${stem}: rwxmap exited ${r.status}\n${r.stderr}`);
  const rd = (f) => JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'));
  return { combined: rd(`${stem}.rwxmap.json`), sidecar: rd(`${stem}.rwxmap.review.json`), log: `${r.stdout}\n${r.stderr}` };
}

const sum = (a, k) => a.reduce((n, x) => n + (x?.[k] ?? 0), 0);

/**
 * One config over the vendors -> {sidecars, rwxlite, models, notes}; then joined 1:1 to ops.
 * ctx = {work, specs: [{stem, file}], rwxmap (dir for mech), models: {base|cand: {entry, cache, rwxmap, spec}}}
 */
export function runConfig({ name, cfg, ctx, ops, vendors }) {
  const m = cfg.model ? ctx.models[cfg.model] : undefined;
  if (cfg.model && !m) die(`${name}: no ${cfg.model} model prepared`);
  const rwxmap = m ? m.rwxmap : ctx.rwxmap;
  const env = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: path.join(ctx.work, 'home'), SCORE_RWXLITE_ENTRY: m ? m.entry : (ctx.models.base?.entry ?? 'file:///none') };
  env.XDG_CACHE_HOME = m ? m.cache : path.join(ctx.work, 'cache-none');
  fs.mkdirSync(env.HOME, { recursive: true });
  const expectedModel = m ? m.spec.model : undefined;
  const sidecars = {}, blocks = [], models = new Set(), notes = [];
  for (const s of ctx.specs) {
    const res = runCli({ rwxmap, spec: s.file, stem: s.stem, cfg, env, work: ctx.work, name });
    checkRun(`${name}/${s.stem}`, cfg, res.log, res.combined, expectedModel);
    sidecars[s.stem] = res.sidecar.rows;
    blocks.push(res.combined.rwxlite);
    if (res.combined.rwxlite?.model) models.add(res.combined.rwxlite.model);
    if (cfg.model && !/using cached rwxlite-/.test(res.log)) notes.push(`${s.stem}: no "using cached" line in the log`);
  }
  const { joined, counts } = joinRows(ops, sidecars, vendors);
  const rwxlite = { sent: sum(blocks, 'sent'), raised: sum(blocks, 'raised'), lowered: sum(blocks, 'lowered'), kept: sum(blocks, 'kept'), undecided: sum(blocks, 'undecided') };
  return { joined, counts, rwxlite, models: [...models], notes };
}

// ---------------------------------------------------------------- report

/** count with two shares: of the group's own rows | of N */
const cell = (c, n, N) => `${c} (${pct(c, n)} | ${pct(c, N)})`;
const line = (label, t, N) => `${label.padEnd(16)} n ${String(t.n).padStart(4)} · exact ${cell(t.exact, t.n, N)} · loose-1 ${cell(t.loose1, t.n, N)} · loose-2 ${cell(t.loose2, t.n, N)} · TOO LOOSE ${cell(t.loose, t.n, N)} · TOO TIGHT ${cell(t.tight, t.n, N)}`;
const markerCounts = (rows) => ['tight', 'loose', 'settled'].map((m) => `${m} ${rows.filter((r) => r.marker === m).length}`).join(' · ');

export function renderConfig(name, res, N) {
  const t = tally(res.joined);
  const out = [`== ${name} ==  model(s): ${res.models.join(', ') || '(none)'}`];
  out.push(`join: matched ${res.counts.matched} · unmatched ops ${res.counts.unmatchedOps} · unmatched output ${res.counts.unmatchedOutput} · duplicate keys ${res.counts.duplicates}`);
  out.push(`(shares are: of the group's own rows | of all ${N} rows)`);
  out.push(line('overall', t, N));
  if (t.n !== N) out.push(`  NOTE: denominator ${t.n} is not ${N}`);
  if (CONFIGS[name].model) {
    const r = res.rwxlite;
    out.push(`rwxlite: sent ${r.sent} · raised ${r.raised} · lowered ${r.lowered} · kept ${r.kept} · undecided (asked, scored x) ${r.undecided}`);
  }
  const tl = tooLoose(res.joined);
  out.push(`markers on the ${t.loose} too-loose rows: ${markerCounts(tl)}`);
  out.push('by vendor:');
  for (const [k, g] of groupTally(res.joined, (r) => r.provider)) out.push('  ' + line(k, g, N));
  out.push('by method:');
  for (const [k, g] of groupTally(res.joined, (r) => r.method.toUpperCase())) out.push('  ' + line(k, g, N));
  for (const n of res.notes) out.push(`  note: ${n}`);
  out.push(`every too-loose row (${tl.length}): id | vendor | method | path | truth | predicted | marker`);
  for (const r of tl) out.push(`  ${r.id} | ${r.provider} | ${r.method} | ${r.path} | ${r.truth} | ${r.predicted} | ${r.marker}`);
  return out.join('\n');
}

export function writeRows(file, joined) {
  const lines = ['id,provider,method,path,truth,predicted,marker,result'];
  for (const r of joined) lines.push([r.id, r.provider, r.method, r.path, r.truth, r.predicted, r.marker, classify(r.truth, r.predicted)].map(q).join(','));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

export function renderVerdicts(results, N) {
  const sg = (n) => `${n >= 0 ? '+' : ''}${n}`;
  const out = ['== D142 gate (user ruling 2026-11-20: exact no fewer, too loose at most +1.0 point = +15 rows of 1579) =='];
  const base = results['a-base'] && tally(results['a-base'].joined);
  const cand = results['a-cand'] && tally(results['a-cand'].joined);
  if (!base || !cand) out.push('no verdict: needs a-base and a-cand in this run');
  else {
    const g = d142Gate(base, cand);
    out.push(`a-cand (GATE) vs a-base: too loose ${cand.loose} vs ${base.loose} (${sg(g.looseDelta)}) -> ${g.looseOk ? 'OK' : 'FAIL'} (need <= +${g.looseAllowance}); exact ${cand.exact} vs ${base.exact} (${sg(g.exactDelta)}) -> ${g.exactOk ? 'OK' : 'FAIL'} (need >=)  => ${g.pass ? 'GO: round 15 may replace 0.3.1' : 'NO-GO: 0.3.1 stays'}`);
    out.push(`  beside the gate, not part of it: too tight ${cand.tight} vs ${base.tight} (${sg(g.tightDelta)}), of ${N}`);
  }
  out.push('', '== D133 mode a bar vs mech (reported only, for both models; it is not the D142 gate) ==');
  const mech = results.mech && tally(results.mech.joined);
  for (const name of ['a-base', 'a-cand']) {
    if (!results[name]) continue;
    if (!mech) { out.push(`${name}: no mech in this run; no verdict`); continue; }
    const t = tally(results[name].joined), b = modeABar(mech, t);
    out.push(`mode a ${name}: too loose ${t.loose} vs mech ${mech.loose} -> ${b.looseOk ? 'OK' : 'FAIL'}; exact ${t.exact} (${pct(t.exact, N)}) vs mech ${mech.exact} (${pct(mech.exact, N)}), need >= mech + ${b.needRows} = ${mech.exact + b.needRows} -> ${b.exactOk ? 'OK' : 'FAIL'}  => ${b.pass ? 'PASS' : 'FAIL'}`);
  }
  out.push('', '== D140 mode b at confidence 85 (no bar, reported) ==');
  for (const name of ['b85-base', 'b85-cand']) {
    if (!results[name]) continue;
    const t = tally(results[name].joined);
    out.push(`mode b ${name}: exact ${t.exact} (${pct(t.exact, N)}), too loose ${t.loose} (loose-1 ${t.loose1}, loose-2 ${t.loose2}; ${pct(t.loose, N)}), too tight ${t.tight} (${pct(t.tight, N)}), asked ${results[name].rwxlite.undecided} (${pct(results[name].rwxlite.undecided, N)})`);
  }
  return out.join('\n');
}

/** Rows whose letter differs between a-base and a-cand, listed with truth. */
export function renderDiff(baseRes, candRes) {
  const cb = new Map(candRes.joined.map((r) => [r.id, r]));
  const diff = baseRes.joined.filter((r) => cb.get(r.id).predicted !== r.predicted);
  const out = [`rows where a-base and a-cand differ (${diff.length}): id | vendor | method | path | truth | base->cand | base result -> cand result`];
  for (const r of diff) {
    const c = cb.get(r.id);
    out.push(`  ${r.id} | ${r.provider} | ${r.method} | ${r.path} | ${r.truth} | ${r.predicted}->${c.predicted} | ${classify(r.truth, r.predicted)} -> ${classify(r.truth, c.predicted)}`);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- main

export async function main(argv, log = (s) => process.stdout.write(s + '\n')) {
  const { values: v } = parseArgs({ args: argv, options: {
    'rwxmap-ref': { type: 'string' },
    'truth-sha': { type: 'string' },
    rwxmap: { type: 'string', default: REPO },
    'rwxlite-repo': { type: 'string', default: '/home/hamr/PycharmProjects/rwxlite' },
    'models-base': { type: 'string' },
    'cand-models': { type: 'string' },
    'cand-version': { type: 'string' },
    'cand-ref': { type: 'string' },
    'cand-tag': { type: 'string' },
    'cand-model': { type: 'string' },
    'cand-model-sha': { type: 'string' },
    'cand-manifest-sha': { type: 'string' },
    'cand-vocab-sha': { type: 'string' },
    'cand-prereg-commit': { type: 'string' },
    work: { type: 'string' },
    out: { type: 'string', default: HERE },
    config: { type: 'string' },
  } });
  if (!v['rwxmap-ref']) die('refusing: --rwxmap-ref is required (no HEAD default); pass the commit that holds the filled addendum');
  if (!v['truth-sha']) die('refusing: no expected truth sha256 given (--truth-sha)');
  if (!HEX64.test(v['truth-sha'])) die(`refusing: --truth-sha is not a sha256 hex: ${v['truth-sha']}`);
  const repo = path.resolve(v.rwxmap);

  // The candidate: every addendum field on the command line, or none of it.
  const candKeys = ['cand-models', 'cand-version', 'cand-ref', 'cand-tag', 'cand-model', 'cand-model-sha', 'cand-manifest-sha', 'cand-vocab-sha', 'cand-prereg-commit'];
  const candGiven = candKeys.filter((k) => v[k] !== undefined);
  const cand = candGiven.length ? candidateSpec({ version: v['cand-version'], ref: v['cand-ref'], tag: v['cand-tag'], model: v['cand-model'], modelSha: v['cand-model-sha'], manifestSha: v['cand-manifest-sha'], vocabSha: v['cand-vocab-sha'], preregCommit: v['cand-prereg-commit'] }) : undefined;
  if (cand && !v['cand-models']) die('candidate: --cand-models <dir> is required');

  // The prereg as COMMITTED at --rwxmap-ref, never the working tree.
  const at = gitIn(repo, 'rev-parse', '--verify', `${v['rwxmap-ref']}^{commit}`).toString().trim();
  const preregText = gitIn(repo, 'show', `${at}:${PREREG_PATH}`).toString('utf8');
  const preregSha = preregTruthSha(preregText);
  if (cand) { checkAddendum(preregText, cand); log(`candidate addendum: every field matches ${PREREG_PATH} at ${at}`); }

  const names = v.config ? v.config.split(',') : Object.keys(CONFIGS).filter((n) => cand || CONFIGS[n].model !== 'cand');
  for (const n of names) {
    if (!CONFIGS[n]) die(`unknown config ${n}`);
    if (CONFIGS[n].model === 'cand' && !cand) die(`${n}: refusing, no candidate given (every --cand-* flag is required)`);
  }
  if (!cand) log('candidate: none given; *-cand configs skipped (no D142 verdict possible)');

  // Inputs.
  const opsPath = path.join(EXAM, 'ops.csv');
  const opsBuf = fs.readFileSync(opsPath);
  const opsSha = sha256Buf(opsBuf);
  if (opsSha !== OPS_SHA) die(`ops.csv sha256 ${opsSha} != the prereg's ${OPS_SHA}`);
  const opsShaFile = fs.readFileSync(path.join(EXAM, 'ops.csv.sha256'), 'utf8').trim().split(/\s+/)[0];
  if (opsShaFile !== opsSha) die('ops.csv sha256 differs from ops.csv.sha256');
  const ops = parseOps(opsBuf.toString('utf8'));
  if (ops.length !== EXPECTED_N) die(`ops.csv has ${ops.length} rows, expected ${EXPECTED_N}`);
  for (const [stem, { provider, ops: n }] of Object.entries(VENDORS)) {
    const got = ops.filter((o) => o.provider === provider).length;
    if (got !== n) die(`ops.csv has ${got} rows for ${stem} (${provider}), expected ${n}`);
  }
  const truthBuf = fs.readFileSync(path.join(EXAM, 'truth.csv'));
  const fileSha = fs.readFileSync(path.join(EXAM, 'truth.csv.sha256'), 'utf8').trim().split(/\s+/)[0];
  const truth = parseTruth(truthBuf, { expectedSha: v['truth-sha'], fileSha, preregSha }, ops.map((o) => o.id));
  log(`ops.csv sha256 ${opsSha}; truth.csv sha256 ${v['truth-sha']} (matches --truth-sha, truth.csv.sha256 and the prereg at ${at}); ${ops.length} ops`);
  const scored = ops.map((o) => ({ ...o, truth: truth.get(o.id) }));

  const work = path.resolve(v.work ?? path.join(REPO, '.claude', 'scratchpad', 'exam7-run'));
  fs.mkdirSync(work, { recursive: true });
  const sources = JSON.parse(fs.readFileSync(path.join(EXAM, 'sources.json'), 'utf8'));
  const { vendors, specs } = prepareSpecs(sources, EXAM, path.join(work, 'specs'));
  log(`specs: 6 gunzipped into ${path.join(work, 'specs')}; uncompressed sha256 of each equals sources.json`);

  const usedModels = ['base', 'cand'].filter((k) => names.some((n) => CONFIGS[n].model === k));
  const modelSpecs = { base: BASE, cand };
  const baseMap = prepareRwxmap({ repo, ref: v['rwxmap-ref'], work, label: 'base' });
  log(`rwxmap ${v['rwxmap-ref']} = ${baseMap.sha}; scratch copy ${baseMap.dir}; src unchanged (RWXLITE_TAG ${baseMap.tag})`);
  const ctx = { work, specs, rwxmap: baseMap.dir, models: {} };
  for (const k of usedModels) {
    const spec = modelSpecs[k];
    let modelsDir;
    if (k === 'base') { modelsDir = path.resolve(v['models-base'] ?? path.join(work, 'models-base')); await fetchBaseModels(modelsDir); }
    else modelsDir = path.resolve(v['cand-models']);
    const prep = prepareRwxlite({ spec, repo: v['rwxlite-repo'], modelsDir, work });
    let rwxmapDir = baseMap.dir;
    if (k === 'cand') {
      if (spec.tag === baseMap.tag) log(`candidate tag ${spec.tag} equals the pinned RWXLITE_TAG; the unchanged CLI is used`);
      else {
        const cm = prepareRwxmap({ repo, ref: v['rwxmap-ref'], work, label: 'cand', tag: spec.tag });
        rwxmapDir = cm.dir;
        log(`candidate rwxmap copy ${cm.dir}; the whole change vs the archive:\n${cm.diff}`);
      }
    }
    ctx.models[k] = { entry: prep.entry, cache: prep.cache, rwxmap: rwxmapDir, spec };
    log(`${k}: model set verified (3 files); rwxlite ref ${spec.ref} = ${prep.sha}; model ${spec.model}`);
  }

  const N = ops.length;
  const results = {}, text = [];
  fs.mkdirSync(v.out, { recursive: true });
  for (const name of names) {
    const res = runConfig({ name, cfg: CONFIGS[name], ctx, ops: scored, vendors });
    results[name] = res;
    text.push(renderConfig(name, res, N), '');
    writeRows(path.join(v.out, `rows-${name}.csv`), res.joined);
  }
  text.push(renderVerdicts(results, N));
  if (results['a-base'] && results['a-cand']) text.push('', renderDiff(results['a-base'], results['a-cand']));
  const header = [`exam #7 scorer · run ${new Date().toISOString()}`, `rwxmap ref ${at}; N ${N}; configs ${names.join(', ')}`, ''];
  const body = header.concat(text).join('\n') + '\n';
  fs.writeFileSync(path.join(v.out, 'score.txt'), body);
  log('\n' + body);
  log(`scratch kept at ${work} (holds the CLI outputs; delete when done)`);
  return 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(`score: ${e.message}`); process.exit(1); });
}
