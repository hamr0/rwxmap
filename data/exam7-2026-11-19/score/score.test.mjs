// Tests for the exam #7 score.mjs on synthetic fixtures in temp dirs (never the real ops, specs, truth,
// lean or a model, never the repo .env). runConfig is exercised with a stub standing in for the CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  joinRows, parseTruth, modeABar, d135Gate, retag, checkOnlyTagChanged, candidateSpec, checkAddendum, preregTruthSha,
  ADDENDUM_FIELDS, BASE, checkRun, tally, classify, verifyModelSet, runConfig, sha256Buf, parseCsv, CONFIGS, VENDORS,
  prepareSpecs, prepareRwxmap, renderVerdicts, renderDiff, main, EXPECTED_N,
} from './score.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'score7-test-'));
const VEND = { tiny: 'tiny.test' };
const ops = [
  { id: 't-1', provider: 'tiny.test', method: 'GET', path: '/a' },
  { id: 't-2', provider: 'tiny.test', method: 'POST', path: '/a' },
  { id: 't-3', provider: 'tiny.test', method: 'DELETE', path: '/a/{id}' },
].map((o) => ({ ...o, truth: 'r' }));
const sc = (m, p, letter = 'x') => ({ method: m, path: p, letter, marker: 'settled', evidence: 'floor' });
const good = [sc('GET', '/a'), sc('POST', '/a'), sc('DELETE', '/a/{id}')];

// ---- join
test('join: 1:1 passes and carries predicted/marker/evidence', () => {
  const r = joinRows(ops, { tiny: good }, VEND);
  assert.equal(r.joined.length, 3);
  assert.equal(r.joined[0].marker, 'settled');
  assert.equal(r.joined[0].predicted, 'x');
  assert.deepEqual(r.counts, { matched: 3, unmatchedOps: 0, unmatchedOutput: 0, duplicates: 0 });
});
test('join: unmatched ops row fails', () => {
  assert.throws(() => joinRows(ops, { tiny: good.slice(0, 2) }, VEND), /ops row with no output op: t-3/);
});
test('join: extra output row fails', () => {
  assert.throws(() => joinRows(ops, { tiny: [...good, sc('PUT', '/zzz')] }, VEND), /output op with no ops row/);
});
test('join: duplicate output row fails', () => {
  assert.throws(() => joinRows(ops, { tiny: [...good, sc('GET', '/a')] }, VEND), /matched twice/);
});
test('join: a letter that is not r|w|x fails (asked rows must come out as x)', () => {
  assert.throws(() => joinRows(ops, { tiny: [sc('GET', '/a', '?'), sc('POST', '/a'), sc('DELETE', '/a/{id}')] }, VEND), /bad letter/);
});
test('join: a vendor stem with no provider fails', () => {
  assert.throws(() => joinRows(ops, { nope: good }, VEND), /no provider for vendor stem nope/);
});

// ---- truth: the three sha256 checks
const T = 'id,label\nt-1,r\nt-2,x\nt-3,x\n';
const ids = ['t-1', 't-2', 't-3'];
test('truth: refuses with no sha, a bad sha, and a mismatch with --truth-sha', () => {
  const buf = Buffer.from(T), sha = sha256Buf(buf);
  const all = { expectedSha: sha, fileSha: sha, preregSha: sha };
  assert.throws(() => parseTruth(buf, { ...all, expectedSha: undefined }, ids), /no expected truth sha256/);
  assert.throws(() => parseTruth(buf, { ...all, expectedSha: 'abc' }, ids), /not a sha256/);
  assert.throws(() => parseTruth(buf, { ...all, expectedSha: 'a'.repeat(64) }, ids), /!= --truth-sha/);
  assert.equal(parseTruth(buf, all, ids).get('t-2'), 'x');
});
test('truth: refuses when truth.csv.sha256 or the prereg value differs, even if --truth-sha is right', () => {
  const buf = Buffer.from(T), sha = sha256Buf(buf);
  assert.throws(() => parseTruth(buf, { expectedSha: sha, fileSha: 'b'.repeat(64), preregSha: sha }, ids), /!= truth\.csv\.sha256/);
  assert.throws(() => parseTruth(buf, { expectedSha: sha, fileSha: sha, preregSha: 'c'.repeat(64) }, ids), /!= the value committed in the prereg/);
});
test('truth: bad label, missing id, extra id, duplicate id fail even with the right shas', () => {
  const go = (s, idl = ['t-1', 't-2']) => { const b = Buffer.from(s), h = sha256Buf(b); return parseTruth(b, { expectedSha: h, fileSha: h, preregSha: h }, idl); };
  assert.throws(() => go('id,label\nt-1,r\nt-2,q\n'), /label not r\|w\|x/);
  assert.throws(() => go('id,label\nt-1,r\n'), /1 ops without truth/);
  assert.throws(() => go('id,label\nt-1,r\nt-2,w\nt-9,x\n'), /1 truth ids not in ops/);
  assert.throws(() => go('id,label\nt-1,r\nt-1,w\nt-2,x\n'), /duplicate id t-1/);
  assert.throws(() => go('a,b\nt-1,r\n'), /header must be id,label/);
});
test('main: refuses with no --rwxmap-ref (no HEAD default) and with no --truth-sha, before touching any file', async () => {
  await assert.rejects(() => main([], () => {}), /--rwxmap-ref is required/);
  await assert.rejects(() => main(['--truth-sha', 'a'.repeat(64)], () => {}), /--rwxmap-ref is required/);
  await assert.rejects(() => main(['--rwxmap-ref', 'abc'], () => {}), /no expected truth sha256/);
  await assert.rejects(() => main(['--rwxmap-ref', 'abc', '--truth-sha', 'zz'], () => {}), /not a sha256/);
});

// ---- counting
test('classify and tally: exact, loose-1, loose-2, too tight are counted apart', () => {
  assert.equal(classify('x', 'r'), 'loose-2');
  assert.equal(classify('x', 'w'), 'loose-1');
  assert.equal(classify('w', 'r'), 'loose-1');
  assert.equal(classify('r', 'x'), 'tight');
  assert.equal(classify('w', 'w'), 'exact');
  const t = tally([
    { predicted: 'r', truth: 'x' }, { predicted: 'w', truth: 'x' }, { predicted: 'r', truth: 'w' },
    { predicted: 'x', truth: 'r' }, { predicted: 'w', truth: 'w' },
  ]);
  assert.deepEqual(t, { n: 5, exact: 1, loose1: 2, loose2: 1, loose: 3, tight: 1 });
  assert.throws(() => classify('q', 'r'), /bad class/);
});

// ---- bars
const tl = (n, exact, loose, loose2 = 0) => ({ n, exact, loose1: loose - loose2, loose2, loose, tight: n - exact - loose });
test('D135 gate: cand too loose <= base AND cand exact >= base, on integer counts; ties pass', () => {
  const base = tl(1579, 1300, 20);
  const at = (exact, loose) => d135Gate(base, tl(1579, exact, loose));
  assert.equal(at(1301, 19).pass, true); // better on both
  assert.equal(at(1300, 20).pass, true); // tie on both passes
  assert.equal(at(1300, 19).pass, true); // tie on exact, better on loose
  assert.equal(at(1301, 20).pass, true); // tie on loose, better on exact
  assert.equal(at(1400, 21).pass, false); // one more leak fails despite a big exact gain
  assert.equal(at(1400, 21).exactOk, true);
  assert.equal(at(1299, 10).pass, false); // one fewer exact fails despite fewer leaks
  assert.equal(at(1299, 10).looseOk, true);
  assert.equal(at(1301, 19).tightDelta, (1579 - 1301 - 19) - (1579 - 1300 - 20)); // too tight reported, not gated
  assert.throws(() => d135Gate(base, tl(1377, 1, 0)), /denominators/);
});
test('D133 bar: 5.0 points of 1579 is 79 rows (ceil of 78.95); 78 fails, 79 passes', () => {
  const mech = tl(1579, 1000, 100);
  const at = (exact, loose) => modeABar(mech, tl(1579, exact, loose));
  assert.equal(at(1079, 100).needRows, 79);
  assert.equal(Math.ceil(0.05 * 1579), 79);
  assert.equal(at(1078, 100).exactOk, false);
  assert.equal(at(1079, 100).exactOk, true);
  assert.equal(at(1079, 100).pass, true);
  assert.equal(at(1079, 101).looseOk, false); // one more leak than mech fails
  assert.equal(at(1079, 101).pass, false);
  assert.equal(at(1200, 90).pass, true);
  assert.throws(() => modeABar(mech, tl(10, 5, 0)), /denominators/);
});
test('renderVerdicts: GO and NO-GO text follow the gate; no verdict without both configs', () => {
  const mk = (exact, loose) => {
    const joined = [];
    for (let i = 0; i < 10; i++) joined.push({ truth: 'x', predicted: i < exact ? 'x' : (i < exact + loose ? 'r' : 'x') });
    return { joined, rwxlite: { undecided: 0 } };
  };
  assert.match(renderVerdicts({ 'a-base': mk(8, 1), 'a-cand': mk(8, 1) }, 10), /=> GO/);
  assert.match(renderVerdicts({ 'a-base': mk(8, 1), 'a-cand': mk(8, 2) }, 10), /=> NO-GO/);
  assert.match(renderVerdicts({ 'a-base': mk(8, 1) }, 10), /no verdict/);
});
test('renderDiff: lists only rows whose letter differs, with truth', () => {
  const row = (id, p) => ({ id, provider: 'p', method: 'GET', path: '/' + id, truth: 'w', predicted: p });
  const out = renderDiff({ joined: [row('a', 'x'), row('b', 'w')] }, { joined: [row('a', 'w'), row('b', 'w')] });
  assert.match(out, /differ \(1\)/);
  assert.match(out, /a \| p \| GET \| \/a \| w \| x->w \| tight -> exact/);
});

// ---- candidate description
const H = (c) => c.repeat(64);
const candArgs = (over = {}) => ({
  version: '0.4.0', ref: 'abc1234', tag: 'v0.4.0', model: 'rwxlite-0.4.0+e5f60718',
  modelSha: 'e5f60718' + H('4').slice(8), manifestSha: H('2'), vocabSha: H('5'), preregCommit: 'def5678', ...over,
});
test('candidateSpec: complete and consistent passes', () => {
  const c = candidateSpec(candArgs());
  assert.equal(c.model, 'rwxlite-0.4.0+e5f60718');
  assert.equal(c.files['model-fp32.onnx'].slice(0, 8), 'e5f60718');
});
test('candidateSpec: every field is required and checked', () => {
  for (const k of ['version', 'ref', 'tag', 'model', 'modelSha', 'manifestSha', 'vocabSha', 'preregCommit']) assert.throws(() => candidateSpec(candArgs({ [k]: undefined })), /is required/, k);
  assert.throws(() => candidateSpec(candArgs({ tag: '0.4.0' })), /--cand-tag/);
  assert.throws(() => candidateSpec(candArgs({ tag: 'v0.4.1' })), /is not v0\.4\.0/);
  assert.throws(() => candidateSpec(candArgs({ version: '0.4' })), /--cand-version/);
  assert.throws(() => candidateSpec(candArgs({ ref: 'main' })), /commit hash/);
  assert.throws(() => candidateSpec(candArgs({ model: 'rwxlite-0.4.0+deadbeef' })), /does not match the model-fp32\.onnx hash/);
  assert.throws(() => candidateSpec(candArgs({ vocabSha: 'zz' })), /not 64 lowercase hex/);
  // a model string equal to the baseline's is refused
  assert.throws(() => candidateSpec(candArgs({ version: '0.3.1', tag: 'v0.3.1', model: BASE.model, modelSha: BASE.files['model-fp32.onnx'] })), /equals the baseline/);
});

// ---- the addendum check (PENDING refusal)
const addendumText = (vals) => '# x\n\n### CANDIDATE: the model\n\nintro **CANDIDATE ADDENDUM: PENDING.**\n\n| field | value |\n|---|---|\n' + ADDENDUM_FIELDS.map(([l], i) => '| ' + l + ' | ' + (vals[i] ?? 'PENDING') + ' |').join('\n') + '\n\nprose after\n\n## Next\n| rwxlite package version | 9.9.9 |\n';
const goodVals = (c) => ADDENDUM_FIELDS.map(([, get]) => get(c));
test('addendum: matching values pass (backticks allowed)', () => {
  const c = candidateSpec(candArgs());
  checkAddendum(addendumText(goodVals(c).map((v, i) => (i % 2 ? '`' + v + '`' : v))), c);
});
test('addendum: PENDING fields are refused, one or all', () => {
  const c = candidateSpec(candArgs());
  const vals = goodVals(c); vals[4] = 'PENDING';
  assert.throws(() => checkAddendum(addendumText(vals), c), /"model-fp32\.onnx sha256" is still PENDING/);
  const vals2 = goodVals(c); vals2[7] = '**PENDING**';
  assert.throws(() => checkAddendum(addendumText(vals2), c), /"rwxlite prereg commit \(rwxlite repo\)" is still PENDING/);
  assert.throws(() => checkAddendum(addendumText([]), c), /still PENDING/);
});
test('addendum: a differing value, a missing row or a missing section is refused', () => {
  const c = candidateSpec(candArgs());
  const vals = goodVals(c); vals[2] = 'v0.4.1';
  assert.throws(() => checkAddendum(addendumText(vals), c), /prereg says v0\.4\.1, command line says v0\.4\.0/);
  assert.throws(() => checkAddendum(addendumText(goodVals(c)).replace('| vocab.txt sha256 |', '| other |'), c), /no row "vocab\.txt sha256"/);
  assert.throws(() => checkAddendum('nothing here', c), /no "### CANDIDATE:" section/);
});
test('addendum: the real prereg table has the labels the scorer looks for', () => {
  const t = fs.readFileSync(path.join(HERE, '..', '..', '..', 'docs', 'wiki', 'exam-prereg-exam7.md'), 'utf8');
  for (const [label] of ADDENDUM_FIELDS) assert.ok(t.includes('| ' + label + ' |'), label);
});
test('prereg truth sha: PENDING, missing and non-hex are refused; a filled value is returned', () => {
  assert.throws(() => preregTruthSha('- `truth.csv` sha256: **PENDING**\n'), /still PENDING/);
  assert.throws(() => preregTruthSha('nothing\n'), /no "- `truth\.csv` sha256:" line/);
  assert.throws(() => preregTruthSha('- `truth.csv` sha256: `xyz`\n'), /not 64 lowercase hex/);
  assert.equal(preregTruthSha('- `truth.csv` sha256: `' + H('a') + '`\n'), H('a'));
  assert.equal(preregTruthSha('- `truth.csv` sha256: **' + H('b') + '**\n'), H('b'));
});

// ---- the one-line tag change
const MD = "// header\nexport const RWXLITE_TAG = 'v0.3.1';\nexport const RWXLITE_VERSION = RWXLITE_TAG.slice(1);\n";
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
  const g = checkOnlyTagChanged(treeWith(MD), treeWith(retag(MD, 'v0.4.0')), 'v0.4.0');
  assert.deepEqual(g.changed, [path.join('src', 'modeldownload.js')]);
  assert.match(g.diff, /^-export const RWXLITE_TAG = 'v0.3.1';$/m);
  assert.match(g.diff, /^\+export const RWXLITE_TAG = 'v0.4.0';$/m);
  assert.equal(g.diff.split('\n').filter((l) => /^[-+][^-+]/.test(l)).length, 2);
});
test('tag guard: no change passes with an empty diff', () => {
  assert.equal(checkOnlyTagChanged(treeWith(MD), treeWith(MD), 'v0.3.1').diff, '');
});
test('tag guard: a second changed line, another changed file, an extra file or a wrong tag fails', () => {
  const ok = retag(MD, 'v0.4.0');
  assert.throws(() => checkOnlyTagChanged(treeWith(MD), treeWith(ok.replace('// header', '// changed')), 'v0.4.0'), /2 lines changed/);
  assert.throws(() => checkOnlyTagChanged(treeWith(MD), treeWith(ok, { 'src/other.js': 'export const evil = 1;\n' }), 'v0.4.0'), /changed more than/);
  assert.throws(() => checkOnlyTagChanged(treeWith(MD), treeWith(ok, { 'src/new.js': 'x' }), 'v0.4.0'), /different file list/);
  assert.throws(() => checkOnlyTagChanged(treeWith(MD), treeWith(ok), 'v0.5.0'), /not RWXLITE_TAG -> v0\.5\.0/);
  assert.throws(() => checkOnlyTagChanged(treeWith(MD), treeWith(MD.replace("'v0.3.1'", "'v0.3.1'; evil()")), 'v0.4.0'), /not RWXLITE_TAG/);
});
test('retag: needs exactly one RWXLITE_TAG line and a plain tag', () => {
  assert.equal(retag(MD, 'v0.4.0'), MD.replace('v0.3.1', 'v0.4.0'));
  assert.throws(() => retag('nothing', 'v0.4.0'), /found 0/);
  assert.throws(() => retag(MD + MD, 'v0.4.0'), /found 2/);
  assert.throws(() => retag(MD, "v0.4.0'; evil(); '"), /not a tag/);
});

// prepareRwxmap on a throwaway git repo: refuses a dirty or untracked src/, archives the ref, applies the one-line change.
function gitRepo() {
  const d = tmp();
  const g = (...a) => { const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-C', d, ...a], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  g('init', '-q');
  fs.mkdirSync(path.join(d, 'src'));
  fs.mkdirSync(path.join(d, 'node_modules'));
  fs.writeFileSync(path.join(d, 'src', 'modeldownload.js'), MD);
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  g('add', 'src', 'package.json'); g('commit', '-q', '-m', 'x');
  return { d, g, sha: g('rev-parse', 'HEAD') };
}
test('prepareRwxmap: archives the ref, one-line retag is the whole diff; dirty or untracked src/ is refused', () => {
  const { d, sha } = gitRepo();
  const w = tmp();
  const base = prepareRwxmap({ repo: d, ref: sha, work: w, label: 'base' });
  assert.equal(base.tag, 'v0.3.1'); assert.equal(base.diff, '');
  const cand = prepareRwxmap({ repo: d, ref: sha, work: w, label: 'cand', tag: 'v0.4.0' });
  assert.match(cand.diff, /^\+export const RWXLITE_TAG = 'v0.4.0';$/m);
  assert.equal(fs.readFileSync(path.join(d, 'src', 'modeldownload.js'), 'utf8'), MD); // the repo is untouched
  fs.writeFileSync(path.join(d, 'src', 'modeldownload.js'), MD + '// dirty\n');
  assert.throws(() => prepareRwxmap({ repo: d, ref: sha, work: w, label: 'x' }), /differs from/);
  fs.writeFileSync(path.join(d, 'src', 'modeldownload.js'), MD);
  fs.writeFileSync(path.join(d, 'src', 'stray.js'), 'x');
  assert.throws(() => prepareRwxmap({ repo: d, ref: sha, work: w, label: 'x' }), /untracked files/);
});

// ---- model set, spec preparation
test('verifyModelSet: matching files pass, one changed byte fails', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'a.bin'), 'hello');
  const files = { 'a.bin': sha256Buf(Buffer.from('hello')) };
  verifyModelSet(d, files);
  fs.writeFileSync(path.join(d, 'a.bin'), 'hellp');
  assert.throws(() => verifyModelSet(d, files), /sha256 of a\.bin/);
  assert.throws(() => verifyModelSet(d, { 'b.bin': files['a.bin'] }), /missing/);
});
function sourcesFixture() {
  const d = tmp(); fs.mkdirSync(path.join(d, 'specs'));
  const sources = Object.entries(VENDORS).map(([vendor, { provider }]) => {
    const raw = Buffer.from(`{"spec":"${vendor}"}`), gz = gzipSync(raw, { level: 9 });
    const file = `specs/${vendor}.json.gz`;
    fs.writeFileSync(path.join(d, file), gz);
    return { vendor, provider, file, sha256: sha256Buf(raw), sha256_gz: sha256Buf(gz) };
  });
  return { d, sources };
}
test('prepareSpecs: gunzips and checks sha256 of the uncompressed bytes; a changed byte or a wrong vendor set fails', () => {
  const { d, sources } = sourcesFixture();
  const dest = path.join(tmp(), 'specs');
  const r = prepareSpecs(sources, d, dest);
  assert.equal(r.specs.length, 6);
  assert.equal(fs.readFileSync(path.join(dest, 'gitness.json'), 'utf8'), '{"spec":"gitness"}');
  assert.equal(r.vendors.gitness, 'harness.io');
  assert.throws(() => prepareSpecs(sources.map((s) => (s.vendor === 'vikunja' ? { ...s, sha256: H('0') } : s)), d, dest), /uncompressed sha256/);
  assert.throws(() => prepareSpecs(sources.map((s) => (s.vendor === 'vikunja' ? { ...s, sha256_gz: H('0') } : s)), d, dest), /gz sha256/);
  assert.throws(() => prepareSpecs(sources.slice(1), d, dest), /not the 6 expected/);
});

test('parseCsv: quoted commas, quotes and newlines', () => {
  assert.deepEqual(parseCsv('a,b\n1,"x,""y""\nz"\n'), [['a', 'b'], ['1', 'x,"y"\nz']]);
});
test('EXPECTED_N and the vendor table agree', () => {
  assert.equal(EXPECTED_N, 1579);
  assert.equal(Object.values(VENDORS).reduce((n, v) => n + v.ops, 0), EXPECTED_N);
  assert.deepEqual(Object.keys(CONFIGS), ['mech', 'a-base', 'a-cand', 'b85-base', 'b85-cand']);
});

// ---- checkRun: the engine line and the combined block
const on = (o = {}) => ({ mode: 'on', model: BASE.model, pass: 'a', confidence: null, ...o });
const off = { mode: 'off', model: null, reason: 'could not get the model' };
const J = { mode: 'off' };
const lineA = `rwxmap: rwxlite: on (${BASE.model}) — 5 sent`;
const lineB = `rwxmap: rwxlite: on (${BASE.model}) — mode b, confidence 85 — 5 sent`;
test('checkRun: "rwxlite: off" fails for modes a and b; wrong model / pass / confidence fail', () => {
  const A = CONFIGS['a-base'], B = CONFIGS['b85-base'];
  assert.throws(() => checkRun('a', A, 'rwxmap: rwxlite: off (mechanical) — x', { rwxlite: off, jev: J }, BASE.model), /lacks "rwxlite: on/);
  assert.throws(() => checkRun('a', A, 'rwxmap: rwxlite: nothing to check (x)', { rwxlite: off, jev: J }, BASE.model), /lacks "rwxlite: on/);
  checkRun('a', A, lineA, { rwxlite: on(), jev: J }, BASE.model);
  assert.throws(() => checkRun('a', A, lineA.replace('bbe1997d', '8503b655'), { rwxlite: on(), jev: J }, BASE.model), /lacks "rwxlite: on/);
  assert.throws(() => checkRun('a', A, lineA, { rwxlite: on({ model: 'rwxlite-0.2.0+8503b655' }), jev: J }, BASE.model), /model string/);
  assert.throws(() => checkRun('a', A, lineA, { rwxlite: on({ pass: 'b' }), jev: J }, BASE.model), /pass b != a/);
  assert.throws(() => checkRun('a', A, lineA, { rwxlite: on({ confidence: 85 }), jev: J }, BASE.model), /mode a reported confidence/);
  checkRun('b', B, lineB, { rwxlite: on({ pass: 'b', confidence: 85 }), jev: J }, BASE.model);
  assert.throws(() => checkRun('b', B, lineB, { rwxlite: on({ pass: 'b', confidence: 95 }), jev: J }, BASE.model), /confidence 95 != 85/);
  assert.throws(() => checkRun('b', B, lineB.replace('85', '95'), { rwxlite: on({ pass: 'b', confidence: 85 }), jev: J }, BASE.model), /lacks "mode b, confidence 85"/);
  assert.throws(() => checkRun('a', A, lineA, { rwxlite: on(), jev: { mode: 'on' } }, BASE.model), /Jev/);
});
test('checkRun: mech must say off (mechanical)', () => {
  checkRun('mech', CONFIGS.mech, 'rwxmap: rwxlite: off (mechanical)', { rwxlite: off, jev: J }, undefined);
  assert.throws(() => checkRun('mech', CONFIGS.mech, lineA, { rwxlite: on(), jev: J }, undefined), /lacks "rwxlite: off \(mechanical\)"/);
});

// ---- runConfig end to end through a stub CLI (the real CLI is never started by the tests)
function stubSetup(log, block) {
  const w = tmp(), rwxmap = path.join(w, 'rw');
  fs.mkdirSync(path.join(rwxmap, 'src'), { recursive: true });
  fs.writeFileSync(path.join(w, 'spec.json'), '{}');
  fs.writeFileSync(path.join(rwxmap, 'src', 'cli.js'), `
import fs from 'node:fs'; import path from 'node:path';
const a = process.argv.slice(2); const stem = a[a.indexOf('--vendor') + 1]; const out = a[a.indexOf('-o') + 1];
console.error(${JSON.stringify(log)});
fs.writeFileSync(path.join(out, stem + '.rwxmap.json'), JSON.stringify({ rwxlite: ${JSON.stringify(block)}, jev: { mode: 'off' } }));
fs.writeFileSync(path.join(out, stem + '.rwxmap.review.json'), JSON.stringify({ rows: ${JSON.stringify(good)} }));
`);
  const ctx = { work: w, specs: [{ stem: 'tiny', file: path.join(w, 'spec.json') }], rwxmap, models: { base: { entry: 'file:///nope', cache: path.join(w, 'c'), rwxmap, spec: BASE } } };
  return { ctx };
}
const counts = { sent: 2, raised: 1, lowered: 0, kept: 1, undecided: 0 };
test('runConfig end to end: a reported "rwxlite: off" is a loud failure, never scored', () => {
  const { ctx } = stubSetup('rwxmap: rwxlite: off (mechanical) — could not get the model', { ...off, ...counts });
  assert.throws(() => runConfig({ name: 'a-base', cfg: CONFIGS['a-base'], ctx, ops, vendors: VEND }), /lacks "rwxlite: on \(rwxlite-0\.3\.1\+bbe1997d\)"/);
});
test('runConfig end to end: an on run joins 1:1 and sums the rwxlite counts; b85 asserts confidence 85', () => {
  const { ctx } = stubSetup(lineA, { ...on(), ...counts });
  const r = runConfig({ name: 'a-base', cfg: CONFIGS['a-base'], ctx, ops, vendors: VEND });
  assert.equal(r.joined.length, 3);
  assert.deepEqual(r.rwxlite, counts);
  assert.deepEqual(r.models, [BASE.model]);
  const b = stubSetup(lineB, { ...on({ pass: 'b', confidence: 85 }), ...counts });
  assert.equal(runConfig({ name: 'b85-base', cfg: CONFIGS['b85-base'], ctx: b.ctx, ops, vendors: VEND }).joined.length, 3);
  const bad = stubSetup(lineB, { ...on({ pass: 'b', confidence: 95 }), ...counts });
  assert.throws(() => runConfig({ name: 'b85-base', cfg: CONFIGS['b85-base'], ctx: bad.ctx, ops, vendors: VEND }), /confidence 95 != 85/);
});
