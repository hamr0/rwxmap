// Tests for the exam #4 score.mjs on a tiny synthetic spec + truth in a temp dir (never the real ops).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { joinRows, loadTruth, modeABar, modeCBar, d135Gate, retag, checkOnlyTagChanged, candidateSpec, checkAddendum, ADDENDUM_FIELDS, BASE, FILE_NAMES, checkBlocks, tally, verifyModelSet, runConfig, sha256Buf, parseCsv, CONFIGS } from './score.mjs';

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

test('bar a: 5.0 points of 1505 is 76 rows (ceil of 75.25); 75 fails, 76 passes', () => {
  const mech = { n: 1505, exact: 1000, loose: 100, tight: 405 };
  const at = (exact, loose) => modeABar(mech, { n: 1505, exact, loose, tight: 1505 - exact - loose });
  assert.equal(at(1076, 100).needRows, 76);
  assert.equal(Math.ceil(0.05 * 1505), 76);
  assert.equal(at(1075, 100).exactOk, false);
  assert.equal(at(1076, 100).exactOk, true);
  assert.equal(at(1076, 100).pass, true);
  assert.equal(at(1076, 101).looseOk, false); // one more leak than mech fails
  assert.equal(at(1076, 101).pass, false);
  assert.equal(at(1100, 90).pass, true); // fewer leaks is fine
  assert.throws(() => modeABar(mech, { n: 10, exact: 5, loose: 0, tight: 5 }), /denominators/);
});
test('D135 gate: cand too loose <= base AND cand exact >= base, on integer counts', () => {
  const base = { n: 1505, exact: 1300, loose: 20, tight: 185 };
  const at = (exact, loose) => d135Gate(base, { n: 1505, exact, loose, tight: 1505 - exact - loose });
  assert.equal(at(1301, 19).pass, true); // better on both
  assert.equal(at(1300, 20).pass, true); // exact tie on both passes
  assert.equal(at(1300, 20).looseOk && at(1300, 20).exactOk, true);
  assert.equal(at(1400, 21).pass, false); // one more leak fails even with a big exact gain
  assert.equal(at(1400, 21).exactOk, true);
  assert.equal(at(1299, 10).pass, false); // one fewer exact fails even with fewer leaks
  assert.equal(at(1299, 10).looseOk, true);
  assert.equal(at(1301, 19).tightDelta, 1505 - 1301 - 19 - 185); // too tight reported, not gated
  assert.equal(at(1300, 20).tightDelta, 0);
  assert.throws(() => d135Gate(base, { n: 1377, exact: 1, loose: 0, tight: 1376 }), /denominators/);
});
test('bar c: 2% loose and 20% tight on integer counts', () => {
  assert.deepEqual(modeCBar({ n: 1000, exact: 0, loose: 20, tight: 200 }), { looseOk: true, tightOk: true });
  assert.deepEqual(modeCBar({ n: 1000, exact: 0, loose: 21, tight: 201 }), { looseOk: false, tightOk: false });
});
test('tally separates too loose from too tight', () => {
  const t = tally([{ letter: 'r', truth: 'x' }, { letter: 'x', truth: 'r' }, { letter: 'w', truth: 'w' }]);
  assert.deepEqual(t, { n: 3, exact: 1, loose: 1, tight: 1 });
});

const A = CONFIGS['a-fp32-base'];
test('checkBlocks: "rwxlite: off" fails for modes a and b; wrong model / pass / confidence fail', () => {
  const on = { mode: 'on', model: 'rwxlite-0.2.0+8503b655', pass: 'a', confidence: null };
  const off = { mode: 'off', model: null, reason: 'could not get the model' };
  assert.throws(() => checkBlocks('a-fp32-base', A, { rwxlite: off, jev: { mode: 'off' } }, 'rwxlite-0.2.0+8503b655'), /"rwxlite: off"/);
  assert.throws(() => checkBlocks('b95-fp32-base', CONFIGS['b95-fp32-base'], { rwxlite: off, jev: { mode: 'off' } }, 'x'), /"rwxlite: off"/);
  checkBlocks('a-fp32-base', A, { rwxlite: on, jev: { mode: 'off' } }, 'rwxlite-0.2.0+8503b655');
  assert.throws(() => checkBlocks('a-fp32-base', A, { rwxlite: { ...on, model: 'rwxlite-0.2.0+8ad0a182' }, jev: { mode: 'off' } }, 'rwxlite-0.2.0+8503b655'), /model string/);
  assert.throws(() => checkBlocks('b95-fp32-base', CONFIGS['b95-fp32-base'], { rwxlite: { ...on, pass: 'b', confidence: 70 }, jev: { mode: 'off' } }, 'rwxlite-0.2.0+8503b655'), /confidence 70/);
  // mode a with nothing to send is legitimate; mode b never is
  const nothing = { mode: 'off', reason: 'nothing to check' };
  checkBlocks('a-fp32-base', A, { rwxlite: nothing, jev: { mode: 'off' } }, 'm');
  assert.throws(() => checkBlocks('b95-fp32-base', CONFIGS['b95-fp32-base'], { rwxlite: nothing, jev: { mode: 'off' } }, 'm'), /"rwxlite: off"/);
  // mech and c-jev
  checkBlocks('mech', CONFIGS.mech, { rwxlite: off, jev: { mode: 'off' } }, undefined);
  assert.throws(() => checkBlocks('mech', CONFIGS.mech, { rwxlite: on, jev: { mode: 'off' } }, undefined), /expected rwxlite and Jev off/);
  assert.throws(() => checkBlocks('c-jev', CONFIGS['c-jev'], { rwxlite: off, jev: { mode: 'off' } }, undefined), /Jev did not run/);
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
  return { work: w, ctx: { work: w, specs, rwxmap, models: { base: { entry: 'file:///nope', caches: { fp32: path.join(w, 'c') }, rwxmap, spec: BASE } } } };
}
test('runConfig end to end: a reported "rwxlite: off" is a loud failure, never scored', () => {
  const { ctx } = stubSetup('off');
  assert.throws(() => runConfig({ name: 'a-fp32-base', cfg: A, ctx, ops, vendors: VEND, stems: ['tiny'] }), /"rwxlite: off".*refusing to score a mechanical fallback/s);
});
test('runConfig end to end: an on run joins 1:1 and sums the rwxlite counts', () => {
  const { ctx } = stubSetup('on');
  const r = runConfig({ name: 'a-fp32-base', cfg: A, ctx, ops, vendors: VEND, stems: ['tiny'] });
  assert.equal(r.joined.length, 3);
  assert.deepEqual(r.rwxlite, { sent: 2, raised: 1, lowered: 0, kept: 1, undecided: 0 });
  assert.deepEqual(r.models, ['rwxlite-0.2.0+8503b655']);
});

// ---- the candidate description and the one-line tag change
const H = (c) => c.repeat(64);
const candArgs = (over = {}) => {
  const files = { 'manifest.json': H('1'), 'manifest-exact.json': H('2'), 'model-int8-pc.onnx': 'a1b2c3d4' + H('3').slice(8), 'model-fp32.onnx': 'e5f60718' + H('4').slice(8), 'vocab.txt': H('5') };
  return { ref: 'abc', tag: 'v0.3.0', files: Object.entries(files).map(([k, s]) => k + '=' + s), fp32Model: 'rwxlite-0.3.0+e5f60718', int8Model: 'rwxlite-0.3.0+a1b2c3d4', ...over };
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
  assert.throws(() => candidateSpec({ ref: 'abc', tag: 'v0.2.0', files: FILE_NAMES.map((n) => n + '=' + b[n]), fp32Model: BASE.fp32.model, int8Model: BASE.int8.model }), /equals the baseline/);
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
const addendumText = (vals) => '# x\n\n### CANDIDATE: the model\n\nintro\n\n| field | value |\n|---|---|\n' + ADDENDUM_FIELDS.map(([l], i) => '| ' + l + ' | ' + (vals[i] ?? 'pending') + ' |').join('\n') + '\n\nprose after\n\n## Next\n| rwxlite tag / version (the tag rwxmap would pin) | v9.9.9 |\n';
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
test('addendum: a differing value, a missing row or a missing section is refused', () => {
  const c = candidateSpec(candArgs());
  const vals = ADDENDUM_FIELDS.map(([, get]) => get(c)); vals[1] = 'v0.3.1';
  assert.throws(() => checkAddendum(addendumText(vals), c), /prereg says v0\.3\.1, command line says v0\.3\.0/);
  const ok = ADDENDUM_FIELDS.map(([, get]) => get(c));
  assert.throws(() => checkAddendum(addendumText(ok).replace('| vocab.txt sha256 |', '| other |'), c), /no row "vocab\.txt sha256"/);
  assert.throws(() => checkAddendum('nothing here', c), /no "### CANDIDATE:" section/);
});
