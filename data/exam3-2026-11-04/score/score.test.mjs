// Tests for score.mjs on a tiny synthetic spec + truth in a temp dir (never the real ops).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { joinRows, loadTruth, modeABar, modeCBar, checkBlocks, tally, verifyModelSet, runConfig, sha256Buf, parseCsv, CONFIGS } from './score.mjs';

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

test('bar a: 5.0 points of 1377 is 69 rows; 68 fails, 69 passes', () => {
  const mech = { n: 1377, exact: 1000, loose: 100, tight: 277 };
  const at = (exact, loose) => modeABar(mech, { n: 1377, exact, loose, tight: 1377 - exact - loose });
  assert.equal(at(1068, 100).exactOk, false);
  assert.equal(at(1069, 100).exactOk, true);
  assert.equal(at(1069, 100).pass, true);
  assert.equal(at(1069, 101).looseOk, false); // one more leak than mech fails
  assert.equal(at(1069, 101).pass, false);
  assert.equal(at(1100, 90).pass, true); // fewer leaks is fine
  assert.throws(() => modeABar(mech, { n: 10, exact: 5, loose: 0, tight: 5 }), /denominators/);
});
test('bar c: 2% loose and 20% tight on integer counts', () => {
  assert.deepEqual(modeCBar({ n: 1000, exact: 0, loose: 20, tight: 200 }), { looseOk: true, tightOk: true });
  assert.deepEqual(modeCBar({ n: 1000, exact: 0, loose: 21, tight: 201 }), { looseOk: false, tightOk: false });
});
test('tally separates too loose from too tight', () => {
  const t = tally([{ letter: 'r', truth: 'x' }, { letter: 'x', truth: 'r' }, { letter: 'w', truth: 'w' }]);
  assert.deepEqual(t, { n: 3, exact: 1, loose: 1, tight: 1 });
});

const A = CONFIGS['a-fp32'];
test('checkBlocks: "rwxlite: off" fails for modes a and b; wrong model / pass / confidence fail', () => {
  const on = { mode: 'on', model: 'rwxlite-0.3.0+8514ddcc', pass: 'a', confidence: null };
  const off = { mode: 'off', model: null, reason: 'could not get the model' };
  assert.throws(() => checkBlocks('a-fp32', A, { rwxlite: off, jev: { mode: 'off' } }, 'rwxlite-0.3.0+8514ddcc'), /"rwxlite: off"/);
  assert.throws(() => checkBlocks('b95-fp32', CONFIGS['b95-fp32'], { rwxlite: off, jev: { mode: 'off' } }, 'x'), /"rwxlite: off"/);
  checkBlocks('a-fp32', A, { rwxlite: on, jev: { mode: 'off' } }, 'rwxlite-0.3.0+8514ddcc');
  assert.throws(() => checkBlocks('a-fp32', A, { rwxlite: { ...on, model: 'rwxlite-0.2.0+8ad0a182' }, jev: { mode: 'off' } }, 'rwxlite-0.3.0+8514ddcc'), /model string/);
  assert.throws(() => checkBlocks('b95-fp32', CONFIGS['b95-fp32'], { rwxlite: { ...on, pass: 'b', confidence: 70 }, jev: { mode: 'off' } }, 'rwxlite-0.3.0+8514ddcc'), /confidence 70/);
  // mode a with nothing to send is legitimate; mode b never is
  const nothing = { mode: 'off', reason: 'nothing to check' };
  checkBlocks('a-fp32', A, { rwxlite: nothing, jev: { mode: 'off' } }, 'm');
  assert.throws(() => checkBlocks('b95-fp32', CONFIGS['b95-fp32'], { rwxlite: nothing, jev: { mode: 'off' } }, 'm'), /"rwxlite: off"/);
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
  : { mode: 'on', model: 'rwxlite-0.3.0+8514ddcc', pass: 'a', confidence: null, sent: 2, raised: 1, lowered: 0, kept: 1, undecided: 0 };
const rows = ${JSON.stringify(good)};
fs.writeFileSync(path.join(out, stem + '.rwxmap.json'), JSON.stringify({ rwxlite: rl, jev: { mode: 'off' } }));
fs.writeFileSync(path.join(out, stem + '.rwxmap.review.json'), JSON.stringify({ rows }));
`);
  return { work: w, ctx: { work: w, entry: 'file:///nope', caches: { fp32: path.join(w, 'c') }, specs, rwxmap } };
}
test('runConfig end to end: a reported "rwxlite: off" is a loud failure, never scored', () => {
  const { ctx } = stubSetup('off');
  assert.throws(() => runConfig({ name: 'a-fp32', cfg: A, ctx, ops, vendors: VEND, stems: ['tiny'] }), /"rwxlite: off".*refusing to score a mechanical fallback/s);
});
test('runConfig end to end: an on run joins 1:1 and sums the rwxlite counts', () => {
  const { ctx } = stubSetup('on');
  const r = runConfig({ name: 'a-fp32', cfg: A, ctx, ops, vendors: VEND, stems: ['tiny'] });
  assert.equal(r.joined.length, 3);
  assert.deepEqual(r.rwxlite, { sent: 2, raised: 1, lowered: 0, kept: 1, undecided: 0 });
  assert.deepEqual(r.models, ['rwxlite-0.3.0+8514ddcc']);
});
