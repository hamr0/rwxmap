// Exam #7 leakage check: op overlap between our 12 specs and rwxlite r15 specs. Read-only.
// Rule (FIXED): key = METHOD + " " + path, {...}->{}, lowercased path, trailing slash dropped (bare "/" kept).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCsv } from './csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHORT = path.join(HERE, '..');
const R15 = '/home/hamr/PycharmProjects/rwxlite/data/r15';
const FILES = [
  { file: 'ops-r15.csv.gz', source: 'github', expect: 455381 },
  { file: 'ops-r15-catalogues.csv.gz', source: null, expect: 32720 },
  { file: 'ops-r15-swaggerhub.csv.gz', source: null, expect: 287533 },
  { file: 'ops-r15-cloud.csv.gz', source: null, expect: 40337 },
];

export function normOp(method, p) {
  let s = String(p).replace(/\{[^}]*\}/g, '{}').toLowerCase();
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return String(method).toUpperCase() + ' ' + s;
}

export function makeState() {
  return { specs: new Map(), perFile: {} };
}
function fileStat(st, f) {
  return (st.perFile[f] ??= { rows: 0, skippedEmpty: 0, unparseable: 0, specs: new Set(), rpc: 0 });
}
export function addRow(st, f, defaultSource, r) {
  const fs_ = fileStat(st, f);
  fs_.rows++;
  const m = (r.method ?? '').trim(), p = r.path ?? '';
  if (!m || !p.trim()) { fs_.skippedEmpty++; return; }
  const sha = r.spec_sha256;
  if (!sha) { fs_.skippedEmpty++; return; }
  if (r.api_style === 'rpc') fs_.rpc++;
  fs_.specs.add(sha);
  let sp = st.specs.get(sha);
  if (!sp) {
    sp = { sha, source: r.source || defaultSource, vendor_key: r.vendor_key, repo: r.repo, repo_owner: r.repo_owner,
      repo_name: r.repo_name, file_path: r.file_path, files: new Set(), keys: new Set() };
    st.specs.set(sha, sp);
  }
  sp.files.add(f);
  sp.keys.add(normOp(m, p));
}

export function evaluate(st, ours) { // ours: Map vendor -> {role, keys:Set}
  const flagged = [], near = [];
  for (const sp of st.specs.values()) {
    const own = sp.keys.size;
    let isFlag = false;
    const rows = [];
    for (const [v, o] of ours) {
      let shared = 0;
      for (const k of sp.keys) if (o.keys.has(k)) shared++;
      const pct = shared / own;
      const row = { sp, own, v, role: o.role, shared, pct };
      if (shared >= 5 && pct >= 0.25) { isFlag = true; row.kind = 'flag'; rows.push(row); }
      else if (shared >= 3 || (shared >= 1 && pct >= 0.15)) { row.kind = 'near'; rows.push(row); }
    }
    // a spec that flags for any vendor is flagged; its non-flag pairs are not listed as near misses
    for (const r of rows) {
      if (r.kind === 'flag') flagged.push(r);
      else if (!isFlag) near.push(r);
    }
  }
  const by = (a, b) => b.shared - a.shared || b.pct - a.pct;
  return { flagged: flagged.sort(by), near: near.sort(by) };
}

const COLS = ['spec_sha256', 'source', 'vendor_key', 'repo', 'repo_owner', 'repo_name', 'file_path', 'r15_ops', 'our_vendor', 'our_role', 'shared', 'pct'];
const q = (x) => { x = String(x ?? ''); return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
function toCsv(rows) {
  const out = [COLS.join(',')];
  for (const r of rows) {
    const s = r.sp;
    out.push([s.sha, s.source, s.vendor_key, s.repo, s.repo_owner, s.repo_name, s.file_path, r.own, r.v, r.role, r.shared, r.pct.toFixed(4)].map(q).join(','));
  }
  return out.join('\n') + '\n';
}

async function loadOurs() {
  const { loadSpec } = await import('../../../src/load.js');
  const { operationsFrom } = await import('../../../src/exporter.js');
  const res = JSON.parse(fs.readFileSync(path.join(SHORT, 'results.json'), 'utf8'));
  const picked = fs.readFileSync(path.join(SHORT, 'picked.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
  const ours = new Map(); let bad = 0;
  for (const [vendor, role] of picked) {
    const l = await loadSpec(path.join(SHORT, 'specs', vendor + '.spec'));
    const ops = operationsFrom(l.doc);
    const raw = new Set(ops.map((o) => o.method.toLowerCase() + ' ' + o.path.replace(/\{[^}]*\}/g, '{}')));
    const keys = new Set(ops.map((o) => normOp(o.method, o.path)));
    const exp = res.find((r) => r.name === vendor)?.deduped;
    const ok = raw.size === exp;
    if (!ok) bad++;
    console.log(`ours ${vendor.padEnd(12)} ${role.padEnd(8)} ops=${ops.length} deduped=${raw.size} results.json=${exp} normalised=${keys.size} ${ok ? 'OK' : 'MISMATCH'}`);
    ours.set(vendor, { role, keys });
  }
  if (bad) { console.error(`FAIL: ${bad} op-count mismatch(es) vs results.json`); process.exit(2); }
  return ours;
}

function selftest() {
  const mk = (n) => Array.from({ length: n }, (_, i) => ['GET', `/Alpha/${i}/{id}/`]);
  const ours = new Map([['fakev', { role: 'exam7', keys: new Set(mk(20).map(([m, p]) => normOp(m, p))) }]]);
  const st = makeState();
  const feed = (sha, shared) => {
    for (let i = 0; i < 20; i++) {
      const p = i < shared ? `/alpha/${i}/{x}` : `/other-${sha}/${i}`; // {x} vs {id} and case/trailing slash must normalise
      addRow(st, 'self', 'github', { method: i % 2 ? 'get' : 'GET', path: p, spec_sha256: sha, vendor_key: 'k' });
    }
  };
  feed('five', 5); feed('four', 4);
  const { flagged, near } = evaluate(st, ours);
  const ok = flagged.length === 1 && flagged[0].sp.sha === 'five' && flagged[0].shared === 5 &&
    near.length === 1 && near[0].sp.sha === 'four' && near[0].shared === 4;
  console.log('selftest', ok ? 'PASS' : 'FAIL', 'flagged=' + flagged.map((r) => r.sp.sha + ':' + r.shared), 'near=' + near.map((r) => r.sp.sha + ':' + r.shared));
  process.exit(ok ? 0 : 1);
}

async function main() {
  if (process.argv.includes('--selftest')) return selftest();
  const ours = await loadOurs();
  const st = makeState();
  const lines = [];
  const log = (s) => { console.log(s); lines.push(s); };
  let mism = 0;
  const expHeader = ['method', 'path', 'spec_sha256', 'vendor_key', 'repo', 'repo_owner', 'repo_name', 'file_path'];
  for (const F of FILES) {
    const src = F.file.includes('catalogues') ? null : null;
    const res = await readCsv(path.join(R15, F.file), (r) => addRow(st, F.file, F.source, r));
    const miss = expHeader.filter((h) => !res.header.includes(h));
    if (miss.length) { console.error(`FAIL ${F.file}: header missing ${miss}`); process.exit(2); }
    const s = fileStat(st, F.file);
    s.unparseable = res.bad;
    const flag = res.rows === F.expect ? 'OK' : `MISMATCH (expected ${F.expect})`;
    if (res.rows !== F.expect) mism++;
    log(`${F.file}: header=${res.header.length} cols, data rows=${res.rows} ${flag}; specs=${s.specs.size}; skipped empty method/path/sha=${s.skippedEmpty}; unparseable (ragged)=${res.bad}; api_style=rpc rows=${s.rpc}`);
  }
  log(`distinct specs overall (by spec_sha256): ${st.specs.size}`);
  const multi = [...st.specs.values()].filter((s) => s.files.size > 1).length;
  log(`specs present in more than one file (merged by sha): ${multi}`);
  log(`cloud rows with api_style=rpc: ${fileStat(st, 'ops-r15-cloud.csv.gz').rpc} (RPC-style ops cannot match REST method+path)`);
  const { flagged, near } = evaluate(st, ours);
  fs.writeFileSync(path.join(HERE, 'flagged.csv'), toCsv(flagged));
  fs.writeFileSync(path.join(HERE, 'near-miss.csv'), toCsv(near));
  for (const [name, list] of [['FLAGGED', flagged], ['NEAR MISS', near]]) {
    log(`${name}: ${list.length} (spec, our_vendor) pairs; ${new Set(list.map((r) => r.sp.sha)).size} specs`);
    const c = {};
    for (const r of list) { const k = `${r.sp.source} x ${r.v}`; c[k] = (c[k] || 0) + 1; }
    for (const k of Object.keys(c).sort()) log(`  ${k}: ${c[k]}`);
  }
  if (mism) log(`WARNING: ${mism} file row-count mismatch(es)`);
  fs.writeFileSync(path.join(HERE, 'summary.txt'), lines.join('\n') + '\n');
  if (mism) process.exit(3);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
