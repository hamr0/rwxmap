// Pre-registered scorer for shared clean exam #6: rwxmap 0.11.0 exactly as shipped.
// Installs rwxmap@0.11.0 + rwxlite@0.3.1 from npm into a fresh scratch folder, runs the REAL CLI
// per config (mech, a, b95) per spec, joins each operation to ops.csv 1:1, scores against truth.csv
// (sha256-checked). Too loose and too tight are always separate. Vanilla node ESM, no deps.
// See docs/wiki/exam-prereg-exam6.md. Run ONCE: node data/exam6-2026-11-08/score/score.mjs
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAM = path.dirname(HERE);
const REPO = path.resolve(EXAM, '..', '..');
export const SCRATCH = path.join(REPO, '.claude', 'scratchpad', 'exam6-run');

export const RANK = { r: 0, w: 1, x: 2 };
export const EXPECTED_N = 1588;
export const RWXMAP_VERSION = '0.11.0';
export const RWXLITE_VERSION = '0.3.1';
export const MODEL = 'rwxlite-0.3.1+bbe1997d';
export const CONFIGS = {
  mech: { args: ['--engine', 'mechanical'], rwxlite: false },
  a: { args: [], rwxlite: true },
  b95: { args: ['--engine', 'rwxlite'], rwxlite: true },
};
const HEX64 = /^[0-9a-f]{64}$/;
const die = (msg) => { throw new Error(msg); };
const pct = (n, d) => (d === 0 ? '0.0%' : `${(100 * n / d).toFixed(1)}%`);

export function sha256Buf(buf) { return createHash('sha256').update(buf).digest('hex'); }

/** RFC 4180 CSV -> array of arrays. */
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

export function parseOps(text) {
  const rows = parseCsv(text);
  const head = rows[0]?.join(',');
  if (head !== 'id,provider,method,path,operationId,summary,description') die(`ops.csv header unexpected: ${head}`);
  const ops = rows.slice(1).filter((r) => r.length > 1).map((r) => ({ id: r[0], provider: r[1], method: r[2], path: r[3] }));
  if (new Set(ops.map((o) => o.id)).size !== ops.length) die('ops.csv has duplicate ids');
  return ops;
}

/** truth text, refused unless its sha256 equals expectedSha. Returns Map id -> label. */
export function parseTruth(buf, expectedSha, opsIds) {
  if (!expectedSha || !HEX64.test(expectedSha)) die(`refusing: expected truth sha256 missing or not hex: ${expectedSha}`);
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

// ---------------------------------------------------------------- join

/**
 * Join output rows to ops 1:1 by (provider, METHOD uppercase, raw path).
 * sidecars: {stem: [{method,path,letter,marker,evidence}]}; vendors: {stem: provider}.
 * Throws on any unmatched ops row, unmatched output row or duplicate key.
 * Returns {joined, counts:{matched, unmatchedOps, unmatchedOutput, duplicates, skipped}}.
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
      hit.set(o.id, { ...o, predicted: r.letter, marker: r.marker, evidence: r.evidence });
    }
  }
  let unmatchedOps = 0;
  for (const o of ops) if (!hit.has(o.id)) { unmatchedOps++; problems.push(`ops row with no output op: ${o.id} ${o.provider} ${o.method} ${o.path}`); }
  if (problems.length) {
    die(`join failed (matched ${hit.size}, unmatched ops ${unmatchedOps}, unmatched output ${unmatchedOutput}, duplicates ${duplicates}):\n  ${problems.slice(0, 50).join('\n  ')}${problems.length > 50 ? `\n  ... and ${problems.length - 50} more` : ''}`);
  }
  return { joined: ops.map((o) => hit.get(o.id)), counts: { matched: hit.size, unmatchedOps, unmatchedOutput, duplicates, skipped: 0 } };
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

/** Counts per outcome; loose = loose1 + loose2 (too loose). */
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
 * D133 mode a bar (reported only): a's too loose <= mech's AND a's exact >= mech's exact + ceil(5% of n).
 * Integer arithmetic.
 */
export function modeABar(mech, a) {
  if (mech.n !== a.n) die('modeABar: different denominators');
  const needRows = Math.ceil(5 * mech.n / 100);
  const looseOk = a.loose <= mech.loose;
  const exactOk = a.exact >= mech.exact + needRows;
  return { looseOk, exactOk, needRows, pass: looseOk && exactOk };
}

// ---------------------------------------------------------------- rendering

const line = (label, t) => `${label.padEnd(18)} n ${String(t.n).padStart(4)} · exact ${t.exact} (${pct(t.exact, t.n)}) · loose-1 ${t.loose1} (${pct(t.loose1, t.n)}) · loose-2 ${t.loose2} (${pct(t.loose2, t.n)}) · TOO LOOSE ${t.loose} (${pct(t.loose, t.n)}) · TOO TIGHT ${t.tight} (${pct(t.tight, t.n)})`;
const markerCounts = (rows) => ['tight', 'loose', 'settled'].map((m) => `${m} ${rows.filter((r) => r.marker === m).length}`).join(' · ');

export function renderConfig(name, res) {
  const t = tally(res.joined);
  const out = [`== ${name} ==  model(s): ${res.models.join(', ') || '(none)'}`];
  out.push(`join: matched ${res.counts.matched} · unmatched ops ${res.counts.unmatchedOps} · unmatched output ${res.counts.unmatchedOutput} · duplicate keys ${res.counts.duplicates} · skipped ${res.counts.skipped}`);
  out.push(line('overall', t));
  if (CONFIGS[name].rwxlite) {
    const r = res.rwxlite;
    out.push(`rwxlite: sent ${r.sent} · raised ${r.raised} · lowered ${r.lowered} · kept ${r.kept} · undecided (asked, scored x) ${r.undecided}`);
  }
  const tl = tooLoose(res.joined);
  out.push(`markers on the ${t.loose} too-loose rows: ${markerCounts(tl)}`);
  out.push('by vendor:');
  for (const [k, g] of groupTally(res.joined, (r) => r.provider)) out.push('  ' + line(k, g));
  out.push('by method:');
  for (const [k, g] of groupTally(res.joined, (r) => r.method)) out.push('  ' + line(k, g));
  out.push(`every too-loose row (${tl.length}): id | vendor | method | path | truth | predicted | marker`);
  for (const r of tl) out.push(`  ${r.id} | ${r.provider} | ${r.method} | ${r.path} | ${r.truth} | ${r.predicted} | ${r.marker}`);
  return out.join('\n');
}

export function renderBar(mech, a) {
  const b = modeABar(mech, a);
  return [
    'D133 mode a bar (reported only, no gate):',
    `  too loose: a ${a.loose} <= mech ${mech.loose}: ${b.looseOk ? 'PASS' : 'FAIL'}`,
    `  exact: a ${a.exact} >= mech ${mech.exact} + ${b.needRows} (ceil(0.05 x ${mech.n})) = ${mech.exact + b.needRows}: ${b.exactOk ? 'PASS' : 'FAIL'}`,
    `  both: ${b.pass ? 'PASS' : 'FAIL'} (reported only)`,
  ].join('\n');
}

export function writeRows(file, joined) {
  const lines = ['id,provider,method,path,truth,predicted,marker,result'];
  for (const r of joined) lines.push([r.id, r.provider, r.method, r.path, r.truth, r.predicted, r.marker, classify(r.truth, r.predicted)].map(q).join(','));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

// ---------------------------------------------------------------- setup and CLI runs

/** Check one run's logs and combined JSON against what the config requires. Throws otherwise. */
export function checkRun(name, cfg, logText, combined) {
  if (combined?.rwxmapVersion !== RWXMAP_VERSION) die(`${name}: rwxmapVersion ${combined?.rwxmapVersion} != ${RWXMAP_VERSION}`);
  if (cfg.rwxlite) {
    if (!logText.includes(`rwxlite: on (${MODEL})`)) die(`${name}: engine line lacks "rwxlite: on (${MODEL})"`);
    if (combined.rwxlite?.mode !== 'on' || combined.rwxlite?.model !== MODEL) die(`${name}: combined rwxlite block is ${JSON.stringify(combined.rwxlite)}`);
  } else if (!logText.includes('rwxlite: off (mechanical)')) die(`${name}: engine line lacks "rwxlite: off (mechanical)"`);
}

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
  const vm = ver('rwxmap'), vl = ver('rwxlite');
  if (vm !== RWXMAP_VERSION) die(`installed rwxmap ${vm} != ${RWXMAP_VERSION}`);
  if (vl !== RWXLITE_VERSION) die(`installed rwxlite ${vl} != ${RWXLITE_VERSION}`);
  const lock = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'package-lock.json'), 'utf8')).packages;
  return { env, vm, vl, integrity: { rwxmap: lock['node_modules/rwxmap']?.integrity, rwxlite: lock['node_modules/rwxlite']?.integrity } };
}

function runConfig(name, cfg, env, specs) {
  const sidecars = {}, blocks = [], models = new Set();
  for (const s of specs) {
    const out = path.join(SCRATCH, 'out', name, s.stem);
    fs.mkdirSync(out, { recursive: true });
    const r = spawnSync(path.join(SCRATCH, 'node_modules', '.bin', 'rwxmap'), [s.file, '--vendor', s.stem, '-o', out, ...cfg.args], { cwd: SCRATCH, env, encoding: 'utf8', maxBuffer: 256 << 20 });
    fs.writeFileSync(path.join(SCRATCH, 'out', name, `${s.stem}.stdout.log`), r.stdout ?? '');
    fs.writeFileSync(path.join(SCRATCH, 'out', name, `${s.stem}.stderr.log`), r.stderr ?? '');
    if (r.status !== 0) die(`${name}/${s.stem}: rwxmap exited ${r.status}\n${r.stderr}`);
    const rd = (f) => JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'));
    const combined = rd(`${s.stem}.rwxmap.json`);
    checkRun(`${name}/${s.stem}`, cfg, `${r.stdout}\n${r.stderr}`, combined);
    sidecars[s.stem] = rd(`${s.stem}.rwxmap.review.json`).rows;
    blocks.push(combined.rwxlite);
    if (combined.rwxlite?.model) models.add(combined.rwxlite.model);
  }
  return { sidecars, blocks, models: [...models] };
}

export async function main() {
  const date = new Date().toISOString();
  const ops = parseOps(fs.readFileSync(path.join(EXAM, 'ops.csv'), 'utf8'));
  if (ops.length !== EXPECTED_N) die(`ops.csv has ${ops.length} rows, expected ${EXPECTED_N}`);
  const sources = JSON.parse(fs.readFileSync(path.join(EXAM, 'sources.json'), 'utf8'));
  const vendors = {}, specs = [];
  for (const s of sources) {
    vendors[s.vendor] = s.provider;
    specs.push({ stem: s.vendor, file: path.join(EXAM, s.file) });
  }
  if (specs.length !== 5) die(`expected 5 specs, sources.json lists ${specs.length}`);
  for (const s of specs) if (!fs.existsSync(s.file)) die(`spec missing: ${s.file}`);
  const expectedSha = fs.readFileSync(path.join(EXAM, 'truth.csv.sha256'), 'utf8').trim().split(/\s+/)[0];
  const truth = parseTruth(fs.readFileSync(path.join(EXAM, 'truth.csv')), expectedSha, ops.map((o) => o.id));

  const inst = setup();
  const results = {};
  for (const name of ['mech', 'a', 'b95']) {
    const run = runConfig(name, CONFIGS[name], inst.env, specs);
    const { joined, counts } = joinRows(ops, run.sidecars, vendors);
    const sum = (k) => run.blocks.reduce((n, x) => n + (x?.[k] ?? 0), 0);
    results[name] = {
      joined: joined.map((r) => ({ ...r, truth: truth.get(r.id) })), counts, models: run.models,
      rwxlite: { sent: sum('sent'), raised: sum('raised'), lowered: sum('lowered'), kept: sum('kept'), undecided: sum('undecided') },
    };
  }
  const out = [
    `exam #6 scorer · run ${date}`,
    `scratch npm: rwxmap ${inst.vm} (${inst.integrity.rwxmap}) · rwxlite ${inst.vl} (${inst.integrity.rwxlite})`,
    `model string seen: ${[...new Set(Object.values(results).flatMap((r) => r.models))].join(', ') || '(none)'}`,
    `truth.csv sha256 ${expectedSha} (verified) · N ${ops.length}`,
    '',
  ];
  for (const name of ['mech', 'a', 'b95']) {
    out.push(renderConfig(name, results[name]), '');
    writeRows(path.join(HERE, `rows-${name}.csv`), results[name].joined);
  }
  out.push(renderBar(tally(results.mech.joined), tally(results.a.joined)));
  const text = out.join('\n') + '\n';
  fs.writeFileSync(path.join(HERE, 'score.txt'), text);
  process.stdout.write(text);
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error(e.message); process.exit(1); });
