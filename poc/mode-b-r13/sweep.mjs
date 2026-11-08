// Mode b --confidence sweep on rwxlite 0.3.1, exams #5 and #6 (both burned, now tuning).
// Tuning measurement only: runs the real shipped CLI (rwxmap@0.11.0 + rwxlite@0.3.1) from a scratch
// install; no src/ code is touched. Reuses the exported pure functions of exam6's score.mjs.
// Run from anywhere: node poc/mode-b-r13/sweep.mjs   (never from a cwd holding a .env)
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseCsv, parseOps, parseTruth, joinRows, classify, tally, groupTally, sha256Buf, checkRun,
  RWXMAP_VERSION, RWXLITE_VERSION, MODEL, RANK,
} from '../../data/exam6-2026-11-08/score/score.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SCRATCH = path.join(REPO, '.claude', 'scratchpad', 'mode-b-r13');
const CUTS = [99, 97, 95, 93, 90, 85, 80, 75, 70];
const die = (m) => { throw new Error(m); };
const pct = (n, d) => `${(100 * n / d).toFixed(1)}%`;
const q = (s) => (/[",\r\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const t0 = Date.now();

const SETS = {
  exam6: { dir: path.join(REPO, 'data', 'exam6-2026-11-08'), n: 1588, vendors: 5 },
  exam5: { dir: path.join(REPO, 'data', 'exam5-2026-11-07'), n: 1443, vendors: 7 },
};

function sh(cmd, args, opts) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 << 20, ...opts });
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} exited ${r.status}\n${r.stdout}\n${r.stderr}`);
  return r;
}

function setup() {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  const home = path.join(SCRATCH, 'home'), cache = path.join(SCRATCH, 'cache');
  fs.mkdirSync(home, { recursive: true }); fs.mkdirSync(cache, { recursive: true });
  const env = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: home, XDG_CACHE_HOME: cache, ONNXRUNTIME_NODE_INSTALL: 'skip' };
  sh('npm', ['init', '-y'], { cwd: SCRATCH, env });
  sh('npm', ['install', '--no-audit', '--no-fund', `rwxmap@${RWXMAP_VERSION}`, `rwxlite@${RWXLITE_VERSION}`], { cwd: SCRATCH, env });
  const ver = (p) => JSON.parse(fs.readFileSync(path.join(SCRATCH, 'node_modules', p, 'package.json'), 'utf8')).version;
  if (ver('rwxmap') !== RWXMAP_VERSION) die(`installed rwxmap ${ver('rwxmap')}`);
  if (ver('rwxlite') !== RWXLITE_VERSION) die(`installed rwxlite ${ver('rwxlite')}`);
  return env;
}

function runConfig(setName, name, cfg, env, specs) {
  const sidecars = {}, blocks = [];
  for (const s of specs) {
    const out = path.join(SCRATCH, 'out', setName, name, s.stem);
    fs.mkdirSync(out, { recursive: true });
    const r = spawnSync(path.join(SCRATCH, 'node_modules', '.bin', 'rwxmap'), [s.file, '--vendor', s.stem, '-o', out, ...cfg.args], { cwd: SCRATCH, env, encoding: 'utf8', maxBuffer: 256 << 20 });
    fs.writeFileSync(path.join(out, 'stdout.log'), r.stdout ?? '');
    fs.writeFileSync(path.join(out, 'stderr.log'), r.stderr ?? '');
    if (r.status !== 0) die(`${setName}/${name}/${s.stem}: rwxmap exited ${r.status}\n${r.stderr}`);
    const rd = (f) => JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'));
    const combined = rd(`${s.stem}.rwxmap.json`);
    checkRun(`${setName}/${name}/${s.stem}`, cfg, `${r.stdout}\n${r.stderr}`, combined);
    sidecars[s.stem] = rd(`${s.stem}.rwxmap.review.json`).rows;
    blocks.push(combined.rwxlite);
  }
  return { sidecars, blocks };
}

function loadSet(setName) {
  const S = SETS[setName];
  const ops = parseOps(fs.readFileSync(path.join(S.dir, 'ops.csv'), 'utf8'));
  if (ops.length !== S.n) die(`${setName}: ops ${ops.length} != ${S.n}`);
  const sources = JSON.parse(fs.readFileSync(path.join(S.dir, 'sources.json'), 'utf8'));
  if (sources.length !== S.vendors) die(`${setName}: ${sources.length} sources`);
  const vendors = {}, specs = [];
  for (const s of sources) { vendors[s.vendor] = s.provider; specs.push({ stem: s.vendor, file: path.join(S.dir, s.file) }); }
  for (const s of specs) if (!fs.existsSync(s.file)) die(`spec missing ${s.file}`);
  const sha = fs.readFileSync(path.join(S.dir, 'truth.csv.sha256'), 'utf8').trim().split(/\s+/)[0];
  const truth = parseTruth(fs.readFileSync(path.join(S.dir, 'truth.csv')), sha, ops.map((o) => o.id));
  return { ops, vendors, specs, truth, sha };
}

function readRowsCsv(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const h = rows[0];
  return new Map(rows.slice(1).filter((r) => r.length > 1).map((r) => [r[0], Object.fromEntries(h.map((k, i) => [k, r[i]]))]));
}

/** Compare joined rows to a committed csv on letter (+ marker if wanted). Returns list of differing rows. */
function parity(joined, file, letterCol, markerCol) {
  const ref = readRowsCsv(file);
  const diffs = [];
  if (ref.size !== joined.length) diffs.push(`row count ${joined.length} vs ${ref.size}`);
  for (const r of joined) {
    const c = ref.get(r.id);
    if (!c) { diffs.push(`${r.id} missing in ref`); continue; }
    if (c[letterCol] !== r.predicted || (markerCol && c[markerCol] !== r.marker)) diffs.push(`${r.id} ${r.provider} ${r.method} ${r.path}: got ${r.predicted}/${r.marker} ref ${c[letterCol]}/${markerCol ? c[markerCol] : '-'}`);
  }
  return diffs;
}

const CFGS = { mech: { args: ['--engine', 'mechanical'], rwxlite: false } };
for (const c of CUTS) CFGS[`b${c}`] = { args: ['--engine', 'rwxlite', '--confidence', String(c)], rwxlite: true };

const env = setup();
const R = {}; // R[set][cfg] = {joined, rwxlite, counts}
const info = {};
for (const setName of Object.keys(SETS)) {
  const L = loadSet(setName);
  info[setName] = { sha: L.sha, n: L.ops.length };
  R[setName] = {};
  for (const [name, cfg] of Object.entries(CFGS)) {
    const run = runConfig(setName, name, cfg, env, L.specs);
    const { joined, counts } = joinRows(L.ops, run.sidecars, L.vendors);
    if (counts.unmatchedOps || counts.unmatchedOutput || counts.duplicates) die(`join problems ${setName}/${name}`);
    const sum = (k) => run.blocks.reduce((n, x) => n + (x?.[k] ?? 0), 0);
    R[setName][name] = {
      joined: joined.map((r) => ({ ...r, truth: L.truth.get(r.id) })), counts,
      rw: cfg.rwxlite ? { raised: sum('raised'), lowered: sum('lowered'), undecided: sum('undecided'), sent: sum('sent') } : null,
    };
    console.error(`${setName}/${name} done ${((Date.now() - t0) / 1000).toFixed(0)}s join ${JSON.stringify(counts)}`);
  }
}

// ---------------- parity (before any table)
const parityLines = [];
let useE5 = true;
const parityFail = [];
{
  const d = parity(R.exam6.b95.joined, path.join(SETS.exam6.dir, 'score', 'rows-b95.csv'), 'predicted', 'marker');
  parityLines.push(`exam6 b95 vs rows-b95.csv (letters+markers): ${R.exam6.b95.joined.length - d.length}/${R.exam6.b95.joined.length}`);
  if (d.length) parityFail.push(['exam6 b95', d]);
  const m = parity(R.exam6.mech.joined, path.join(SETS.exam6.dir, 'score', 'rows-mech.csv'), 'predicted', 'marker');
  parityLines.push(`exam6 mech vs rows-mech.csv (letters+markers): ${R.exam6.mech.joined.length - m.length}/${R.exam6.mech.joined.length}`);
  if (m.length) parityFail.push(['exam6 mech', m]);
  const e = parity(R.exam5.mech.joined, path.join(SETS.exam5.dir, 'score', 'rows-mech-v4.csv'), 'letter', null);
  parityLines.push(`exam5 mech vs rows-mech-v4.csv (letters): ${R.exam5.mech.joined.length - e.length}/${R.exam5.mech.joined.length}`);
  if (e.length) { useE5 = false; parityLines.push('exam5 PARITY FAILED: exam5 excluded from the tables'); parityFail.push(['exam5 mech', e]); }
}
for (const l of parityLines) console.log(l);
if (parityFail.some(([n]) => n !== 'exam5 mech')) {
  for (const [n, d] of parityFail) { console.log(`PARITY FAIL ${n}: ${d.length} differing`); d.slice(0, 60).forEach((x) => console.log('  ' + x)); }
  process.exit(2);
}
if (!useE5) for (const [n, d] of parityFail) { console.log(`PARITY FAIL ${n}: ${d.length} differing`); d.slice(0, 60).forEach((x) => console.log('  ' + x)); }

// ---------------- tables
const sets = useE5 ? ['exam5', 'exam6'] : ['exam6'];
const cfgNames = Object.keys(CFGS);
const rowsOf = (setNames, cfg) => setNames.flatMap((s) => R[s][cfg].joined);
const rwOf = (setNames, cfg) => {
  if (!CFGS[cfg].rwxlite) return null;
  const o = { raised: 0, lowered: 0, undecided: 0 };
  for (const s of setNames) for (const k of Object.keys(o)) o[k] += R[s][cfg].rw[k];
  return o;
};
const label = (cfg) => (cfg === 'mech' ? 'mech' : `b ${cfg.slice(1)}`);
function table(title, setNames) {
  const n = rowsOf(setNames, 'mech').length;
  const out = [`${title}  (N ${n})`, 'cut     | exact          | loose-1      | loose-2      | too loose    | too tight      | undecided      | lowered        | raised'];
  const cell = (c) => `${String(c).padStart(4)} ${pct(c, n).padStart(6)}`;
  for (const cfg of cfgNames) {
    const t = tally(rowsOf(setNames, cfg)), rw = rwOf(setNames, cfg);
    out.push([label(cfg).padEnd(7), cell(t.exact), cell(t.loose1), cell(t.loose2), cell(t.loose), cell(t.tight), rw ? cell(rw.undecided) : '      -      ', rw ? cell(rw.lowered) : '      -      ', rw ? cell(rw.raised) : '      -'].join(' | '));
  }
  return out.join('\n');
}

const outTxt = [];
outTxt.push(`mode b --confidence sweep · rwxmap ${RWXMAP_VERSION} + rwxlite ${RWXLITE_VERSION} (${MODEL}) · run ${new Date().toISOString()}`);
outTxt.push(`truth sha256 verified: exam6 ${info.exam6.sha} · exam5 ${info.exam5.sha}`);
outTxt.push('join (1:1 on provider, METHOD, raw path), counts per config: matched = N, unmatched ops 0, unmatched output 0, duplicates 0 (any non-zero would have aborted)');
for (const s of Object.keys(SETS)) outTxt.push(`  ${s}: N ${info[s].n}, ${cfgNames.length} configs all joined clean`);
outTxt.push('PARITY:', ...parityLines.map((l) => '  ' + l), '');
outTxt.push(table('POOLED exam5+exam6', sets), '');
for (const s of sets) outTxt.push(table(s.toUpperCase(), [s]), '');

// exam6 mode a reference
{
  const a = readRowsCsv(path.join(SETS.exam6.dir, 'score', 'rows-a.csv'));
  const rows = R.exam6.mech.joined.map((r) => ({ truth: r.truth, predicted: a.get(r.id).predicted }));
  const t = tally(rows), n = rows.length;
  const sc = fs.readFileSync(path.join(SETS.exam6.dir, 'score', 'score.txt'), 'utf8');
  const sec = sc.split('== a ==')[1].split('== b95 ==')[0].split('\n').find((l) => l.startsWith('rwxlite:'));
  outTxt.push(`MODE A reference (exam6 only, rows-a.csv, rwxlite 0.3.1 at its default cut): exact ${t.exact} (${pct(t.exact, n)}) · loose-1 ${t.loose1} · loose-2 ${t.loose2} · too loose ${t.loose} (${pct(t.loose, n)}) · too tight ${t.tight} (${pct(t.tight, n)})`);
  outTxt.push(`  from score.txt: ${sec}`, '');
}

// per vendor
const vendorsAll = [...new Set(sets.flatMap((s) => R[s].mech.joined.map((r) => r.provider)))].sort();
outTxt.push(`PER VENDOR (${vendorsAll.length}): too loose / too tight   [rows n]`);
outTxt.push(['vendor'.padEnd(18), 'n'.padStart(4), ...cfgNames.map((c) => label(c).padStart(8))].join(' '));
const perV = {}; // perV[cfg][vendor] = tally
for (const cfg of cfgNames) perV[cfg] = Object.fromEntries(groupTally(rowsOf(sets, cfg), (r) => r.provider));
for (const v of vendorsAll) {
  outTxt.push([v.padEnd(18), String(perV.mech[v].n).padStart(4), ...cfgNames.map((c) => `${perV[c][v].loose}/${perV[c][v].tight}`.padStart(8))].join(' '));
}
outTxt.push('');

// pick
const looseOf = (setNames, cfg) => tally(rowsOf(setNames, cfg));
function passOn(setNames, cut) {
  const m = looseOf(setNames, 'mech'), b = looseOf(setNames, `b${cut}`);
  return b.loose <= m.loose && b.loose2 <= m.loose2;
}
outTxt.push('PRE-REGISTERED TEST: PASS(C) iff pooled too loose(b,C) <= pooled too loose(mech) AND pooled loose-2(b,C) <= pooled loose-2(mech).');
const pm = looseOf(sets, 'mech');
outTxt.push(`mech pooled: too loose ${pm.loose}, loose-2 ${pm.loose2}`);
outTxt.push('cut | pooled too loose / loose-2 | PASS pooled | exam5 alone | exam6 alone | vendors made worse (of ' + vendorsAll.length + ')');
const passing = [];
for (const c of CUTS) {
  const b = looseOf(sets, `b${c}`);
  const pp = passOn(sets, c);
  const worse = vendorsAll.filter((v) => perV[`b${c}`][v].loose > perV.mech[v].loose);
  if (pp) passing.push(c);
  const e5 = useE5 ? (passOn(['exam5'], c) ? 'pass' : 'fail') : 'n/a';
  const e6 = passOn(['exam6'], c) ? 'pass' : 'fail';
  outTxt.push(`${String(c).padStart(3)} | ${String(b.loose).padStart(3)} / ${b.loose2}${' '.repeat(18)} | ${pp ? 'PASS' : 'fail'}${' '.repeat(7)} | ${e5.padEnd(11)} | ${e6.padEnd(11)} | ${worse.length}${worse.length ? '  (' + worse.join(', ') + ')' : ''}`);
}
outTxt.push(`passing cuts: ${passing.length ? passing.join(', ') : '(none)'}`);
outTxt.push(passing.length ? `PICK: C=${Math.min(...passing)}` : 'PICK: none');
outTxt.push(`run time ${((Date.now() - t0) / 60000).toFixed(1)} min`);
const text = outTxt.join('\n') + '\n';
fs.writeFileSync(path.join(HERE, 'readout.txt'), text);
process.stdout.write(text);

// rows CSVs
for (const s of Object.keys(SETS)) for (const cfg of cfgNames) {
  const lines = ['id,provider,method,path,truth,predicted,marker,result'];
  for (const r of R[s][cfg].joined) lines.push([r.id, r.provider, r.method, r.path, r.truth, r.predicted, r.marker, classify(r.truth, r.predicted)].map(q).join(','));
  fs.writeFileSync(path.join(HERE, 'rows', `${s}-${cfg}.csv.gz`), zlib.gzipSync(lines.join('\n') + '\n'));
}
