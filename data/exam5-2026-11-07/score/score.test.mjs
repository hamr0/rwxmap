// Tests for the exam #5 score.mjs on a tiny synthetic spec + truth in a temp dir (never the real ops).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { joinRows, loadTruth, modeABar, gate, rwxliteBar, retag, checkOnlyTagChanged, checkCopies, REPLACED, MUST_MATCH, candidateSpec, checkAddendum, checkTemperature, checkTarballSha, installTarball, ADDENDUM_FIELDS, BASE, FILE_NAMES, checkBlocks, tally, verifyModelSet, runConfig, sha256Buf, parseCsv, CONFIGS, parseLean, checkLean, parsePreds, replayPreds, checkParity, readHashed } from './score.mjs';
import { classifyRow } from '../../../src/flow.js';
import { secondPass } from '../../../src/secondpass.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'score-test-'));
const VEND = { tiny: 'tiny.test' };
const ops = [
  { id: 't-1', provider: 'tiny.test', method: 'GET', path: '/a' },
  { id: 't-2', provider: 'tiny.test', method: 'POST', path: '/a' },
  { id: 't-3', provider: 'tiny.test', method: 'DELETE', path: '/a/{id}' },
].map((o) => ({ ...o, truth: 'r' }));
const sc = (m, p, letter = 'x') => ({ method: m, path: p, letter, marker: 'settled', evidence: 'floor' });
const good = [sc('GET', '/a'), sc('POST', '/a'), sc('DELETE', '/a/{id}')];

test('join: 1:1 passes and carries letter/review/evidence', () => {
  const r = joinRows(ops, { tiny: good }, VEND);
  assert.equal(r.joined.length, 3);
  assert.equal(r.joined[0].review, 'settled');
});
test('join: unmatched ops row fails', () => {
  assert.throws(() => joinRows(ops, { tiny: good.slice(0, 2) }, VEND), /unmatched ops row: t-3/);
});
test('join: extra sidecar row fails', () => {
  assert.throws(() => joinRows(ops, { tiny: [...good, sc('PUT', '/zzz')] }, VEND), /extra \(no ops row\)/);
});
test('join: duplicate sidecar row fails', () => {
  assert.throws(() => joinRows(ops, { tiny: [...good, sc('GET', '/a')] }, VEND), /matched twice/);
});

test('truth: refuses with no sha, a bad sha, and a mismatched sha', () => {
  const d = tmp(), f = path.join(d, 'truth.csv');
  fs.writeFileSync(f, 'id,label\nt-1,r\nt-2,x\nt-3,x\n');
  const ids = ['t-1', 't-2', 't-3'];
  assert.throws(() => loadTruth(f, undefined, ids), /no expected truth sha256/);
  assert.throws(() => loadTruth(f, 'abc', ids), /not a sha256/);
  assert.throws(() => loadTruth(f, 'a'.repeat(64), ids), /truth sha256 .* != expected/);
  const ok = loadTruth(f, sha256Buf(fs.readFileSync(f)), ids);
  assert.equal(ok.get('t-2'), 'x');
});
test('truth: bad label, missing id and extra id fail even with the right sha', () => {
  const d = tmp(), f = path.join(d, 't.csv'), ids = ['t-1', 't-2'];
  const put = (s) => { fs.writeFileSync(f, s); return sha256Buf(Buffer.from(s)); };
  assert.throws(() => loadTruth(f, put('id,label\nt-1,r\nt-2,q\n'), ids), /label not r\|w\|x/);
  assert.throws(() => loadTruth(f, put('id,label\nt-1,r\n'), ids), /1 ops without truth/);
  assert.throws(() => loadTruth(f, put('id,label\nt-1,r\nt-2,w\nt-9,x\n'), ids), /1 truth ids not in ops/);
});
test('truth: score CLI without --truth-sha exits 1 and prints a refusal', () => {
  const d = tmp(), f = path.join(d, 'truth.csv');
  fs.writeFileSync(f, 'id,label\n');
  const r = spawnSync(process.execPath, [path.join(HERE, 'score.mjs'), '--truth', f], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no expected truth sha256/);
});

test('bar a: 5.0 points of 1443 is 73 rows (ceil of 72.15); 72 fails, 73 passes', () => {
  const mech = { n: 1443, exact: 1000, loose: 100, loose1: 100, loose2: 0, tight: 343 };
  const at = (exact, loose) => modeABar(mech, { n: 1443, exact, loose, tight: 1443 - exact - loose });
  assert.equal(at(1073, 100).needRows, 73);
  assert.equal(Math.ceil(0.05 * 1443), 73);
  assert.equal(at(1072, 100).exactOk, false);
  assert.equal(at(1073, 100).exactOk, true);
  assert.equal(at(1073, 100).pass, true);
  assert.equal(at(1073, 101).looseOk, false); // one more leak than mech fails
  assert.equal(at(1100, 90).pass, true); // fewer leaks is fine
  assert.throws(() => modeABar(mech, { n: 10, exact: 5, loose: 0, tight: 5 }), /denominators/);
});
const T = (exact, loose1, loose2, tight, n = 1443) => ({ n, exact, loose1, loose2, loose: loose1 + loose2, tight });
test('GATE: all three checks must hold, on integer counts', () => {
  const v3 = T(1200, 30, 10, 203);
  assert.equal(gate(v3, T(1210, 25, 10, 198)).pass, true); // lower too loose, loose-2 tie, tighter
  assert.equal(gate(v3, T(1210, 28, 8, 197)).pass, true); // loose-2 lower is fine
  assert.deepEqual(gate(v3, T(1210, 25, 11, 197)), { looseOk: true, loose2Ok: false, tightOk: true, pass: false }); // loose-2 higher fails
  assert.deepEqual(gate(v3, T(1210, 25, 10, 204)), { looseOk: true, loose2Ok: true, tightOk: false, pass: false }); // one more too tight fails
  assert.equal(gate(v3, T(1210, 25, 10, 203)).tightOk, true); // too tight tie is fine
  assert.throws(() => gate(v3, T(1, 0, 0, 9, 10)), /denominators/);
});
test('GATE: a tie on too loose fails even when everything else improves', () => {
  const v3 = T(1200, 30, 10, 203);
  const g = gate(v3, T(1300, 30, 10, 103)); // same too loose (40), far fewer too tight
  assert.equal(g.looseOk, false);
  assert.equal(g.loose2Ok, true);
  assert.equal(g.tightOk, true);
  assert.equal(g.pass, false);
  assert.equal(gate(v3, T(1300, 20, 19, 104)).looseOk, true); // 39 < 40 passes check 1 (check 2 fails: 19 > 10)
  assert.equal(gate(v3, T(1300, 20, 19, 104)).pass, false);
});
test("rwxlite's bar: too loose <= and exact >=, a tie passes", () => {
  const base = T(1300, 20, 0, 123);
  assert.equal(rwxliteBar(base, T(1300, 20, 0, 123)).pass, true);
  assert.equal(rwxliteBar(base, T(1301, 19, 0, 123)).pass, true);
  assert.equal(rwxliteBar(base, T(1400, 21, 0, 22)).pass, false);
  assert.equal(rwxliteBar(base, T(1299, 10, 0, 134)).pass, false);
});
test('tally separates loose-1, loose-2 and too tight; too loose is their sum', () => {
  const t = tally([{ letter: 'r', truth: 'x' }, { letter: 'w', truth: 'x' }, { letter: 'r', truth: 'w' }, { letter: 'x', truth: 'r' }, { letter: 'w', truth: 'w' }]);
  assert.deepEqual(t, { n: 5, exact: 1, loose1: 2, loose2: 1, loose: 3, tight: 1 });
});

const A = CONFIGS['a-020-v3'];
test('checkBlocks: "rwxlite: off" fails for mode a; wrong model / pass / confidence fail; mechanical needs both off', () => {
  const on = { mode: 'on', model: 'rwxlite-0.2.0+8503b655', pass: 'a', confidence: null };
  const off = { mode: 'off', model: null, reason: 'could not get the model' };
  assert.throws(() => checkBlocks('a-020-v3', A, { rwxlite: off, jev: { mode: 'off' } }, 'rwxlite-0.2.0+8503b655'), /"rwxlite: off"/);
  checkBlocks('a-020-v3', A, { rwxlite: on, jev: { mode: 'off' } }, 'rwxlite-0.2.0+8503b655');
  assert.throws(() => checkBlocks('a-020-v3', A, { rwxlite: { ...on, model: 'rwxlite-0.2.0+8ad0a182' }, jev: { mode: 'off' } }, 'rwxlite-0.2.0+8503b655'), /model string/);
  assert.throws(() => checkBlocks('a-020-v3', A, { rwxlite: { ...on, pass: 'b' }, jev: { mode: 'off' } }, 'rwxlite-0.2.0+8503b655'), /pass b/);
  assert.throws(() => checkBlocks('a-020-v3', A, { rwxlite: { ...on, confidence: 70 }, jev: { mode: 'off' } }, 'rwxlite-0.2.0+8503b655'), /confidence 70/);
  assert.throws(() => checkBlocks('a-020-v3', A, { rwxlite: on, jev: { mode: 'on' } }, 'rwxlite-0.2.0+8503b655'), /Jev ran/);
  // mode a with nothing to send is legitimate
  checkBlocks('a-020-v3', A, { rwxlite: { mode: 'off', reason: 'nothing to check' }, jev: { mode: 'off' } }, 'm');
  // mechanical
  checkBlocks('mech-v3', CONFIGS['mech-v3'], { rwxlite: off, jev: { mode: 'off' } }, undefined);
  assert.throws(() => checkBlocks('mech-v4', CONFIGS['mech-v4'], { rwxlite: on, jev: { mode: 'off' } }, undefined), /expected rwxlite and Jev off/);
});
test('configs: the five of the prereg, with their copies and models', () => {
  assert.deepEqual(Object.keys(CONFIGS), ['mech-v3', 'mech-v4', 'a-020-v3', 'a-020-v4', 'a-r13-v4']);
  assert.deepEqual(Object.entries(CONFIGS).map(([k, c]) => [k, c.copy, c.model ?? null]), [['mech-v3', 'v3', null], ['mech-v4', 'v4', null], ['a-020-v3', 'v3', 'base'], ['a-020-v4', 'v4', 'base'], ['a-r13-v4', 'r13', 'cand']]);
});

test('verifyModelSet: matching files pass, one changed byte fails', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'a.bin'), 'hello');
  const files = { 'a.bin': sha256Buf(Buffer.from('hello')) };
  verifyModelSet(d, files);
  fs.writeFileSync(path.join(d, 'a.bin'), 'hellp');
  assert.throws(() => verifyModelSet(d, files), /sha256 of a\.bin/);
  assert.throws(() => verifyModelSet(d, { 'b.bin': files['a.bin'] }), /missing/);
});

test('parseCsv: quoted commas, quotes and newlines', () => {
  assert.deepEqual(parseCsv('a,b\n1,"x,""y""\nz"\n'), [['a', 'b'], ['1', 'x,"y"\nz']]);
});

// End to end through runConfig with a stub CLI standing in for rwxmap (never the real ops, never a model).
function stubSetup(mode) {
  const w = tmp(), rwxmap = path.join(w, 'rw'), specs = path.join(w, 'specs');
  fs.mkdirSync(path.join(rwxmap, 'src'), { recursive: true });
  fs.mkdirSync(specs);
  fs.writeFileSync(path.join(specs, 'tiny.json'), '{}');
  fs.writeFileSync(path.join(rwxmap, 'mode.txt'), mode);
  fs.writeFileSync(path.join(rwxmap, 'src', 'cli.js'), `
import fs from 'node:fs'; import path from 'node:path';
const a = process.argv.slice(2); const stem = a[a.indexOf('--vendor') + 1]; const out = a[a.indexOf('-o') + 1];
const mode = fs.readFileSync(new URL('../mode.txt', import.meta.url), 'utf8');
const rl = mode === 'off' ? { mode: 'off', model: null, reason: 'could not get the model (x)', sent: 0, raised: 0, lowered: 0, kept: 0, undecided: 0 }
  : { mode: 'on', model: 'rwxlite-0.2.0+8503b655', pass: 'a', confidence: null, sent: 2, raised: 1, lowered: 0, kept: 1, undecided: 0 };
const rows = ${JSON.stringify(good)};
fs.writeFileSync(path.join(out, stem + '.rwxmap.json'), JSON.stringify({ rwxlite: rl, jev: { mode: 'off' } }));
fs.writeFileSync(path.join(out, stem + '.rwxmap.review.json'), JSON.stringify({ rows }));
`);
  return { work: w, ctx: { work: w, specs, copies: { v3: rwxmap, v4: rwxmap, r13: rwxmap }, models: { base: { entry: 'file:///nope', caches: { fp32: path.join(w, 'c') }, spec: BASE } } } };
}
test('runConfig end to end: a reported "rwxlite: off" is a loud failure, never scored', () => {
  const { ctx } = stubSetup('off');
  assert.throws(() => runConfig({ name: 'a-020-v3', cfg: A, ctx, ops, vendors: VEND, stems: ['tiny'] }), /"rwxlite: off".*refusing to score a mechanical fallback/s);
});
test('runConfig end to end: an on run joins 1:1 and sums the rwxlite counts', () => {
  const { ctx } = stubSetup('on');
  const r = runConfig({ name: 'a-020-v3', cfg: A, ctx, ops, vendors: VEND, stems: ['tiny'] });
  assert.equal(r.joined.length, 3);
  assert.deepEqual(r.rwxlite, { sent: 2, raised: 1, lowered: 0, kept: 1, undecided: 0 });
  assert.deepEqual(r.models, ['rwxlite-0.2.0+8503b655']);
});

// ---- the candidate description and the one-line tag change
const H = (c) => c.repeat(64);
const candArgs = (over = {}) => {
  const files = { 'manifest.json': H('1'), 'manifest-exact.json': H('2'), 'model-int8-pc.onnx': 'a1b2c3d4' + H('3').slice(8), 'model-fp32.onnx': 'e5f60718' + H('4').slice(8), 'vocab.txt': H('5') };
  return { ref: 'abc', tag: 'v0.3.0', files: Object.entries(files).map(([k, s]) => k + '=' + s), fp32Model: 'rwxlite-0.3.0+e5f60718', int8Model: 'rwxlite-0.3.0+a1b2c3d4', temperature: '0.991463', safetensors: H('9'), tarball: '/x/rwxlite-0.3.0.tgz', tarballSha: H('8'), ...over };
};
test('candidateSpec: complete and consistent passes', () => {
  const c = candidateSpec(candArgs());
  assert.equal(c.fp32.model, 'rwxlite-0.3.0+e5f60718');
  assert.equal(c.version, '0.3.0');
});
test('candidateSpec: refuses a missing hash, a missing model string, a bad tag, a wrong model string, a baseline model', () => {
  assert.throws(() => candidateSpec(candArgs({ files: candArgs().files.slice(1) })), /no sha256 given for manifest\.json/);
  assert.throws(() => candidateSpec(candArgs({ int8Model: undefined })), /--cand-model-int8 is required/);
  assert.throws(() => candidateSpec(candArgs({ tag: '0.3.0' })), /--cand-tag/);
  assert.throws(() => candidateSpec(candArgs({ ref: undefined })), /--cand-ref/);
  assert.throws(() => candidateSpec(candArgs({ fp32Model: 'rwxlite-0.3.0+deadbeef' })), /does not match the model-fp32\.onnx hash/);
  assert.throws(() => candidateSpec(candArgs({ files: [...candArgs().files, 'vocab.txt=' + H('6')] })), /given twice/);
  assert.throws(() => candidateSpec(candArgs({ files: candArgs().files.map((f) => f.replace(/^vocab.txt=.*/, 'vocab.txt=zz')) })), /not 64 lowercase hex/);
  assert.throws(() => candidateSpec(candArgs({ files: [...candArgs().files.slice(0, 4), 'bogus=' + H('7')] })), /not <name>=<sha256>/);
  // a candidate whose model strings equal the baseline's is refused
  const b = { ...BASE.files };
  assert.throws(() => candidateSpec({ ref: 'abc', tag: 'v0.2.0', files: FILE_NAMES.map((n) => n + '=' + b[n]), fp32Model: BASE.fp32.model, int8Model: BASE.int8.model, temperature: '0.844', safetensors: H('9'), tarball: '/x', tarballSha: H('8') }), /equals the baseline/);
  assert.throws(() => candidateSpec(candArgs({ tarball: undefined })), /--cand-tarball is required/);
  assert.throws(() => candidateSpec(candArgs({ tarballSha: 'zz' })), /--cand-tarball-sha/);
  assert.throws(() => candidateSpec(candArgs({ temperature: undefined })), /--cand-temperature/);
  assert.throws(() => candidateSpec(candArgs({ temperature: '0' })), /--cand-temperature/);
  assert.throws(() => candidateSpec(candArgs({ safetensors: 'zz' })), /--cand-safetensors/);
});

const MD = "// header\nexport const RWXLITE_TAG = 'v0.2.0';\nexport const RWXLITE_VERSION = RWXLITE_TAG.slice(1);\n";
function treeWith(modeldownload, extra = {}) {
  const d = tmp();
  fs.mkdirSync(path.join(d, 'src'));
  fs.writeFileSync(path.join(d, 'src', 'modeldownload.js'), modeldownload);
  fs.writeFileSync(path.join(d, 'src', 'other.js'), 'export {};\n');
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  for (const [f, c] of Object.entries(extra)) fs.writeFileSync(path.join(d, f), c);
  return d;
}
test('tag guard: the one-line RWXLITE_TAG change passes and the diff shows only that line', () => {
  const g = checkOnlyTagChanged(treeWith(MD), treeWith(retag(MD, 'v0.3.0')), 'v0.3.0');
  assert.deepEqual(g.changed, [path.join('src', 'modeldownload.js')]);
  assert.match(g.diff, /^-export const RWXLITE_TAG = 'v0.2.0';$/m);
  assert.match(g.diff, /^\+export const RWXLITE_TAG = 'v0.3.0';$/m);
  assert.equal(g.diff.split('\n').filter((l) => /^[-+][^-+]/.test(l)).length, 2);
});
test('tag guard: no change passes with an empty diff', () => {
  assert.equal(checkOnlyTagChanged(treeWith(MD), treeWith(MD), 'v0.2.0').diff, '');
});
test('tag guard: a second changed line, another changed file, an extra file or a wrong tag fails', () => {
  const ok = retag(MD, 'v0.3.0');
  assert.throws(() => checkOnlyTagChanged(treeWith(MD), treeWith(ok.replace('// header', '// changed')), 'v0.3.0'), /2 lines changed/);
  assert.throws(() => checkOnlyTagChanged(treeWith(MD), treeWith(ok, { 'src/other.js': 'export const evil = 1;\n' }), 'v0.3.0'), /changed more than/);
  assert.throws(() => checkOnlyTagChanged(treeWith(MD), treeWith(ok, { 'src/new.js': 'x' }), 'v0.3.0'), /different file list/);
  assert.throws(() => checkOnlyTagChanged(treeWith(MD), treeWith(ok), 'v0.4.0'), /not RWXLITE_TAG -> v0.4.0/);
  assert.throws(() => checkOnlyTagChanged(treeWith(MD), treeWith(MD.replace("'v0.2.0'", "'v0.2.0'; evil()")), 'v0.3.0'), /not RWXLITE_TAG/);
});
test('retag: needs exactly one RWXLITE_TAG line and a plain tag', () => {
  assert.equal(retag(MD, 'v0.3.1'), MD.replace('v0.2.0', 'v0.3.1'));
  assert.throws(() => retag('nothing', 'v0.3.0'), /found 0/);
  assert.throws(() => retag(MD + MD, 'v0.3.0'), /found 2/);
  assert.throws(() => retag(MD, "v0.3.0'; evil(); '"), /not a tag/);
});

// ---- the addendum check
const addendumText = (vals) => '# x\n\n### CANDIDATE: the model\n\nintro\n\n| field | value |\n|---|---|\n' + ADDENDUM_FIELDS.map(([l], i) => '| ' + l + ' | ' + (vals[i] ?? 'pending') + ' |').join('\n') + '\n\nprose after\n\n## Next\n| rwxlite tag / version | v9.9.9 |\n';
test('addendum: matching values pass (backticks allowed)', () => {
  const c = candidateSpec(candArgs());
  checkAddendum(addendumText(ADDENDUM_FIELDS.map(([, get], i) => (i % 2 ? '`' + get(c) + '`' : get(c)))), c);
});
test('addendum: pending fields are refused, all of them named', () => {
  const c = candidateSpec(candArgs());
  const vals = ADDENDUM_FIELDS.map(([, get]) => get(c)); vals[3] = 'pending';
  assert.throws(() => checkAddendum(addendumText(vals), c), /"model-fp32\.onnx sha256"|"manifest-exact\.json sha256 \(fp32\)" is still pending/);
  assert.throws(() => checkAddendum(addendumText([]), c), /still pending/);
});
test('addendum: a pending temperature, a pending safetensors hash or a differing temperature is refused', () => {
  const c = candidateSpec(candArgs());
  const all = () => ADDENDUM_FIELDS.map(([, get]) => get(c));
  const idx = (label) => ADDENDUM_FIELDS.findIndex(([l]) => l === label);
  checkAddendum(addendumText(all()), c); // control: everything filled passes
  let vals = all(); vals[idx('temperature (from the fp32 manifest)')] = '**pending** (rwxlite announced T 0.991463)';
  assert.throws(() => checkAddendum(addendumText(vals), c), /"temperature \(from the fp32 manifest\)" is still pending/);
  vals = all(); vals[idx('model.safetensors sha256')] = 'pending';
  assert.throws(() => checkAddendum(addendumText(vals), c), /"model\.safetensors sha256" is still pending/);
  vals = all(); vals[idx('temperature (from the fp32 manifest)')] = '0.9915';
  assert.throws(() => checkAddendum(addendumText(vals), c), /prereg says 0\.9915, command line says 0\.991463/);
});
test('addendum: the real prereg has a row for every field (so a filled prereg can be matched)', () => {
  const text = fs.readFileSync(path.join(HERE, '..', '..', '..', 'docs', 'wiki', 'exam-prereg-exam5.md'), 'utf8');
  const c = candidateSpec(candArgs());
  let msg = '';
  try { checkAddendum(text, c); } catch (e) { msg = e.message; }
  assert.ok(msg, 'the draft prereg is pending, so the check must refuse');
  assert.doesNotMatch(msg, /no row/);
  assert.doesNotMatch(msg, /no "### CANDIDATE:" section/);
});
test('temperature: the fp32 manifest must carry the pre-registered value; only the baseline may omit it (0.2.0 default)', () => {
  const cand = candidateSpec(candArgs());
  checkTemperature(cand, { temperature: 0.991463 });
  assert.throws(() => checkTemperature(cand, { temperature: 0.99 }), /!= pre-registered 0\.991463/);
  assert.throws(() => checkTemperature(cand, {}), /no temperature field/);
  checkTemperature(BASE, {});
  checkTemperature(BASE, { temperature: 0.844 });
  assert.throws(() => checkTemperature(BASE, { temperature: 0.9 }), /!= pre-registered 0\.844/);
});
test('addendum: a differing value, a missing row or a missing section is refused', () => {
  const c = candidateSpec(candArgs());
  const vals = ADDENDUM_FIELDS.map(([, get]) => get(c)); vals[1] = 'v0.3.1';
  assert.throws(() => checkAddendum(addendumText(vals), c), /prereg says v0\.3\.1, command line says v0\.3\.0/);
  const ok = ADDENDUM_FIELDS.map(([, get]) => get(c));
  assert.throws(() => checkAddendum(addendumText(ok).replace('| vocab.txt sha256 |', '| other |'), c), /no row "vocab\.txt sha256"/);
  assert.throws(() => checkAddendum('nothing here', c), /no "### CANDIDATE:" section/);
});

// ---- the three copies
const SRC_FILES = { ...Object.fromEntries([...REPLACED, ...MUST_MATCH, 'other.js'].map((n) => [n, 'export const n = ' + JSON.stringify(n) + ';\n'])), 'modeldownload.js': MD };
function copiesTrees() {
  const mk = (files) => { const d = tmp(); fs.mkdirSync(path.join(d, 'src')); fs.writeFileSync(path.join(d, 'package.json'), '{}'); for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(d, 'src', n), t); return d; };
  const poc = tmp();
  const v4files = { ...SRC_FILES };
  for (const n of REPLACED) { v4files[n] = 'export const v4 = ' + JSON.stringify(n) + ';\n'; fs.writeFileSync(path.join(poc, n), v4files[n]); }
  for (const n of MUST_MATCH) fs.writeFileSync(path.join(poc, n), SRC_FILES[n]);
  return { v3: mk(SRC_FILES), v4: mk(v4files), r13: mk({ ...v4files, 'modeldownload.js': retag(MD, 'v0.3.0') }), poc, tag: 'v0.3.0', mk, v4files };
}
test('copies guard: the right three copies pass and return the one-line diff', () => {
  const t = copiesTrees();
  const diff = checkCopies(t);
  assert.equal(diff.split('\n').filter((l) => /^[-+][^-+]/.test(l)).length, 2);
  assert.equal(checkCopies({ ...t, r13: undefined }), '');
});
test('copies guard: a fifth differing file in V4 fails', () => {
  const t = copiesTrees();
  fs.writeFileSync(path.join(t.v4, 'src', 'other.js'), 'export const evil = 1;\n');
  fs.writeFileSync(path.join(t.r13, 'src', 'other.js'), 'export const evil = 1;\n');
  assert.throws(() => checkCopies(t), /V3 and V4 must differ in exactly .*they differ in .*other\.js/);
});
test('copies guard: a replaced file missing from V4 (only three differ) fails', () => {
  const t = copiesTrees();
  fs.copyFileSync(path.join(t.v3, 'src', 'step3.js'), path.join(t.v4, 'src', 'step3.js'));
  fs.copyFileSync(path.join(t.v3, 'src', 'step3.js'), path.join(t.r13, 'src', 'step3.js'));
  assert.throws(() => checkCopies(t), /must differ in exactly/);
});
test('copies guard: a V4 file that is not byte-identical to poc/mech-v4 fails', () => {
  const t = copiesTrees();
  fs.appendFileSync(path.join(t.poc, 'step2.js'), '// drift\n');
  assert.throws(() => checkCopies(t), /src\/step2\.js is not byte-identical to poc\/mech-v4\/step2\.js/);
});
test('copies guard: a changed tokens.js (poc vs src) fails, and so does a changed types.js', () => {
  let t = copiesTrees();
  fs.writeFileSync(path.join(t.poc, 'tokens.js'), 'export const tokens = "changed";\n');
  assert.throws(() => checkCopies(t), /tokens\.js differs between poc\/mech-v4 and src\//);
  t = copiesTrees();
  fs.writeFileSync(path.join(t.poc, 'types.js'), 'export {};\n');
  assert.throws(() => checkCopies(t), /types\.js differs between poc\/mech-v4 and src\//);
});
test('copies guard: a two-line tag diff (or another file) in V4-R13 fails', () => {
  let t = copiesTrees();
  fs.writeFileSync(path.join(t.r13, 'src', 'modeldownload.js'), retag(MD, 'v0.3.0').replace('// header', '// changed'));
  assert.throws(() => checkCopies(t), /2 lines changed/);
  t = copiesTrees();
  fs.writeFileSync(path.join(t.r13, 'src', 'other.js'), 'export const evil = 1;\n');
  assert.throws(() => checkCopies(t), /changed more than/);
  t = copiesTrees();
  assert.throws(() => checkCopies({ ...t, tag: 'v0.4.0' }), /not RWXLITE_TAG -> v0.4.0/);
  t = copiesTrees();
  fs.writeFileSync(path.join(t.r13, 'src', 'modeldownload.js'), MD); // no change at all: R13 would be 0.2.x
  assert.throws(() => checkCopies(t), /exactly one line/);
});
test('copies guard: a different file list fails', () => {
  const t = copiesTrees();
  fs.writeFileSync(path.join(t.r13, 'src', 'extra.js'), 'x');
  assert.throws(() => checkCopies(t), /do not list the same files/);
});

// ---- the lean check
const leanText = (rows) => 'id,class,rule,marker\n' + rows.map((r) => r.join(',')).join('\n') + '\n';
const LEAN = [['t-1', 'r', 'read-floor', 'settled'], ['t-2', 'x', 'post-floor', 'tight'], ['t-3', 'x', 'delete-floor', 'settled']];
const cliRows = () => [{ id: 't-1', letter: 'r', review: 'settled' }, { id: 't-2', letter: 'x', review: 'tight' }, { id: 't-3', letter: 'x', review: 'settled' }];
const inProc = () => new Map(LEAN.map(([id, c, rule, m]) => [id, { class: c, rule, review: m }]));
test('lean check: identical class, rule and marker pass', () => {
  checkLean(parseLean(leanText(LEAN)), cliRows(), inProc());
});
test('lean check: a CLI class or marker mismatch, an in-process rule mismatch, a missing or extra row fails', () => {
  const lean = () => parseLean(leanText(LEAN));
  let rows = cliRows(); rows[0].letter = 'w';
  assert.throws(() => checkLean(lean(), rows, inProc()), /t-1: CLI class w != lean r/);
  rows = cliRows(); rows[1].review = 'loose';
  assert.throws(() => checkLean(lean(), rows, inProc()), /t-2: CLI marker loose != lean tight/);
  const p = inProc(); p.get('t-3').rule = 'other-rule';
  assert.throws(() => checkLean(lean(), cliRows(), p), /t-3: V4 in-process rule other-rule != lean delete-floor/);
  assert.throws(() => checkLean(lean(), cliRows().slice(0, 2), inProc()), /missing \(in lean\.csv, not in the CLI run\): t-3/);
  assert.throws(() => checkLean(lean(), [...cliRows(), { id: 't-9', letter: 'r', review: 'settled' }], inProc()), /extra \(in the CLI run, not in lean\.csv\): t-9/);
});
test('lean file: a bad header, class or marker, or a duplicate id is refused', () => {
  assert.throws(() => parseLean('id,letter,rule,marker\n'), /header/);
  assert.throws(() => parseLean(leanText([['t-1', 'q', 'r', 'settled']])), /class not r\|w\|x/);
  assert.throws(() => parseLean(leanText([['t-1', 'r', 'r', 'maybe']])), /marker not/);
  assert.throws(() => parseLean(leanText([LEAN[0], LEAN[0]])), /duplicate id/);
});
test('hashed inputs: a wrong or missing sha256 is refused, a right one returns the text', () => {
  const d = tmp(), f = path.join(d, 'lean.csv');
  fs.writeFileSync(f, 'abc');
  assert.equal(readHashed(f, sha256Buf(Buffer.from('abc')), '--lean'), 'abc');
  assert.throws(() => readHashed(f, 'a'.repeat(64), '--lean'), /sha256 of .* is .*, expected/);
  assert.throws(() => readHashed(f, undefined, '--lean'), /no expected sha256/);
});

// ---- the parity replay (real src flow.js and secondpass.js on a tiny list)
const MODEL = 'rwxlite-0.3.0+e5f60718';
const pops = [
  { id: 'p-1', method: 'GET', path: '/things', operationId: 'listThings', summary: 'List things', description: '' },
  { id: 'p-2', method: 'PUT', path: '/things/{id}', operationId: 'putThing', summary: 'Put thing', description: '' },
  { id: 'p-3', method: 'POST', path: '/things', operationId: 'createThing', summary: 'Create thing', description: '' },
  { id: 'p-4', method: 'DELETE', path: '/things/{id}', operationId: 'deleteThing', summary: 'Delete thing', description: '' },
];
const predText = (rows) => 'id,model,p_is_x,p_changes\n' + rows.map((r) => r.join(',')).join('\n') + '\n';
const PREDS = [['p-1', MODEL, '0.01', '0.02'], ['p-2', MODEL, '0.98', '0.99'], ['p-3', MODEL, '0.01', '0.99'], ['p-4', MODEL, '0.5', '0.5']];
async function replay(rows = PREDS) {
  return replayPreds({ ops: pops, preds: parsePreds(predText(rows), pops.map((o) => o.id), MODEL), model: MODEL, classifyRow, secondPass });
}
const asCli = (rp) => [...rp.rows].map(([id, r]) => ({ id, ...r }));
test('parity: the replay moves rows the way the committed p says, and an identical CLI run passes', async () => {
  const rp = await replay();
  assert.ok(rp.summary.sent >= 1);
  assert.equal(rp.rows.get('p-2').letter, 'x'); // PUT floor w raised to x by p(x) 0.98
  const counts = { sent: rp.summary.sent, raised: rp.summary.raised, lowered: rp.summary.lowered, kept: rp.summary.kept, undecided: rp.summary.undecided };
  checkParity(rp, asCli(rp), counts);
});
test('parity: one differing letter, marker or evidence, a missing row or a wrong count fails', async () => {
  const rp = await replay();
  const counts = { ...rp.summary };
  const mut = (f) => { const r = asCli(rp); f(r); return r; };
  assert.throws(() => checkParity(rp, mut((r) => { r[1].letter = 'w'; }), counts), /p-2: replay class x != CLI w/);
  assert.throws(() => checkParity(rp, mut((r) => { r[1].review = 'settled'; }), counts), /p-2: replay marker/);
  assert.throws(() => checkParity(rp, mut((r) => { r[1].evidence = 'floor'; }), counts), /p-2: replay evidence rwxlite != CLI floor/);
  assert.throws(() => checkParity(rp, asCli(rp).slice(1), counts), /p-1: in the replay, not in the CLI run/);
  assert.throws(() => checkParity(rp, asCli(rp), { ...counts, raised: counts.raised + 1 }), /count raised/);
});
test('parity: a different committed p changes the replay, so it would not equal the CLI run it was not made from', async () => {
  const rp = await replay();
  const other = await replay([PREDS[0], ['p-2', MODEL, '0.01', '0.02'], PREDS[2], PREDS[3]]);
  assert.throws(() => checkParity(other, asCli(rp), { ...rp.summary }), /parity failed/);
});
test('predictions file: wrong model, id order, row count, header or a non-number is refused', () => {
  const ids = pops.map((o) => o.id);
  assert.throws(() => parsePreds(predText(PREDS.map((r, i) => (i === 2 ? [r[0], 'rwxlite-0.2.0+8503b655', r[2], r[3]] : r))), ids, MODEL), /model rwxlite-0\.2\.0\+8503b655 !=/);
  assert.throws(() => parsePreds(predText([PREDS[1], PREDS[0], PREDS[2], PREDS[3]]), ids, MODEL), /ops\.csv order/);
  assert.throws(() => parsePreds(predText(PREDS.slice(1)), ids, MODEL), /3 rows, ops\.csv has 4/);
  assert.throws(() => parsePreds('id,model,p,q\n', ids, MODEL), /header/);
  assert.throws(() => parsePreds(predText(PREDS.map((r, i) => (i === 0 ? [r[0], r[1], 'NaN', r[3]] : r))), ids, MODEL), /not a number/);
});

// ---- the candidate tarball (a real temp git repo and a real tar)
function tarballSetup({ version = '0.3.0', src = { 'index.js': 'export const a = 1;\n', 'sub/b.js': 'export const b = 2;\n' }, tarSrc } = {}) {
  const w = tmp(), repo = path.join(w, 'repo');
  fs.mkdirSync(path.join(repo, 'src', 'sub'), { recursive: true });
  for (const [f, t] of Object.entries(src)) fs.writeFileSync(path.join(repo, 'src', f), t);
  fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"rwxlite","version":"0.2.1"}');
  const g = (...a) => { const r = spawnSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  g('init', '-q'); g('add', '.'); g('commit', '-q', '-m', 'x');
  const sha = g('rev-parse', 'HEAD');
  const pk = path.join(w, 'pk', 'package');
  fs.mkdirSync(path.join(pk, 'src', 'sub'), { recursive: true });
  for (const [f, t] of Object.entries(tarSrc ?? src)) { fs.mkdirSync(path.dirname(path.join(pk, 'src', f)), { recursive: true }); fs.writeFileSync(path.join(pk, 'src', f), t); }
  fs.writeFileSync(path.join(pk, 'package.json'), JSON.stringify({ name: 'rwxlite', version }));
  const tgz = path.join(w, 'r.tgz');
  assert.equal(spawnSync('tar', ['-czf', tgz, '-C', path.join(w, 'pk'), 'package']).status, 0);
  return { w, repo, sha, tgz };
}
const install = (t, version = '0.3.0') => installTarball({ tarball: t.tgz, repo: t.repo, sha: t.sha, version, pkgDir: path.join(t.w, 'pkg', 'node_modules', 'rwxlite'), work: t.w });
test('tarball: a matching package installs as a folder named rwxlite', () => {
  const t = tarballSetup();
  assert.equal(install(t).files, 2);
  assert.ok(fs.existsSync(path.join(t.w, 'pkg', 'node_modules', 'rwxlite', 'src', 'sub', 'b.js')));
});
test('tarball: a src that differs from the ref (bytes, extra file or missing file) fails', () => {
  assert.throws(() => install(tarballSetup({ tarSrc: { 'index.js': 'export const a = 9;\n', 'sub/b.js': 'export const b = 2;\n' } })), /differs from the ref's src\/ in: index\.js/);
  assert.throws(() => install(tarballSetup({ tarSrc: { 'index.js': 'export const a = 1;\n', 'sub/b.js': 'export const b = 2;\n', 'c.js': 'x' } })), /lists different files/);
  assert.throws(() => install(tarballSetup({ tarSrc: { 'index.js': 'export const a = 1;\n' } })), /lists different files/);
});
test('tarball: a version (or name) that is not the tag fails', () => {
  assert.throws(() => install(tarballSetup({ version: '0.2.1' })), /is rwxlite@0\.2\.1, expected rwxlite@0\.3\.0/);
});
test('tarball: sha mismatch with the file fails; a sha missing from the prereg fails; both right passes', () => {
  const t = tarballSetup(), sha = sha256Buf(fs.readFileSync(t.tgz));
  checkTarballSha(t.tgz, sha, 'text with ' + sha + ' in it');
  assert.throws(() => checkTarballSha(t.tgz, 'a'.repeat(64), 'text with ' + 'a'.repeat(64)), /sha256 of .* is .*--cand-tarball-sha says/);
  assert.throws(() => checkTarballSha(t.tgz, sha, 'a prereg that does not state it'), /does not appear in the prereg/);
  assert.throws(() => checkTarballSha(path.join(t.w, 'nope.tgz'), sha, sha), /file not found/);
});
