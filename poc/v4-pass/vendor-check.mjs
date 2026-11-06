// Vendor cross-check (ruling (a), docs/wiki/truth-v4-plan.md): pass rows v4 calls w where AWS/GitHub says x.
// Usage: node poc/v4-pass/vendor-check.mjs   (no args, deterministic)
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseCsv, toCsv } from '../../tools/csv.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const IN = ROOT + 'data/pass-v4-2026-11-05/';
const OUT = IN + 'vendor/';
const JOINED = '/home/hamr/PycharmProjects/rwxlite/data/vendor/joined.jsonl';
const SEED = 20261114;

// copied from poc/v4-pass/suspects.mjs
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, seed) {
  const rnd = mulberry32(seed), a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// copied from poc/v4-pass/merge.mjs: ws, meth, normProv, normKey
const ws = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const meth = (m) => { const u = String(m || '').toUpperCase(); return u === 'QUERY' ? 'GET' : u; };
const normProv = (p) => String(p || '').toLowerCase().replace(/\.(com|io|app|sh|dev|ai|co|net|org)$/, '');
const normKey = (x) => [normProv(x.provider), meth(x.method), x.path, x.operationId || '', ws(x.summary)].join('|');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const lines = [];
const P = (s = '') => { console.log(s); lines.push(s); };
const tally = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => String(a[0]).localeCompare(String(b[0]))); };
const show = (t) => t.forEach(([k, n]) => P(`  ${k}: ${n}`));

// ---- 1. v4 labels
const key = parseCsv(fs.readFileSync(IN + 'pass-key.csv', 'utf8'));
const jev = new Map(fs.readFileSync(IN + 'jev-facts-pass.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((j) => [j.row_id, j.label]));
const fin = new Map(parseCsv(fs.readFileSync(IN + 'suspects/disagree/disagree-final.csv', 'utf8')).map((r) => [r.pass_id, r]));
const sKey = new Map(parseCsv(fs.readFileSync(IN + 'suspects/suspects-key.csv', 'utf8')).map((r) => [r.row_id, r.pass_id]));
const sonnet = new Map();
for (const f of fs.readdirSync(IN + 'suspects').filter((f) => /^sbatch-\d+-labels\.csv$/.test(f)).sort())
  for (const r of parseCsv(fs.readFileSync(IN + 'suspects/' + f, 'utf8'))) sonnet.set(sKey.get(r.row_id), r.truth_class);

const v4 = new Map(); // pass_id -> {label, source}
for (const k of key) {
  const f = fin.get(k.pass_id), j = jev.get(k.pass_id);
  if (f) v4.set(k.pass_id, { label: f.final_class, source: 'disagree-final/' + f.source });
  else if (j) v4.set(k.pass_id, { label: j, source: sonnet.has(k.pass_id) ? (sonnet.get(k.pass_id) === 'r' ? 'jev (sonnet r, jev w)' : 'jev (sonnet agreed)') : 'jev (not a suspect)' });
}
P(`pass rows: ${key.length}; with a v4 label: ${v4.size}; Jev rows: ${jev.size}; disagree-final rows: ${fin.size}; suspects with Sonnet label: ${sonnet.size}`);
P('v4 labels:'); show(tally([...v4.values()], (v) => v.label));
P('v4 label sources:'); show(tally([...v4.values()], (v) => v.source));
P('v4 label by source:'); show(tally([...v4.values()], (v) => v.source + ' -> ' + v.label));

// ---- 2. join
const byNk = new Map(), byRwx = new Map();
for (const k of key) {
  (byNk.get(k.norm_key) || byNk.set(k.norm_key, []).get(k.norm_key)).push(k);
  for (const o of k.origins.split(';')) if (o.startsWith('rwxlite:')) {
    const id = o.slice(8);
    (byRwx.get(id) || byRwx.set(id, []).get(id)).push(k);
  }
}
const joined = fs.readFileSync(JOINED, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const matches = []; // {line, rows, route}
const unmatched = [];
const nkMismatch = [];
for (const L of joined) {
  let rows = byRwx.get(L.id), route = 1;
  if (!rows) { rows = byNk.get(normKey(L)); route = 2; }
  if (rows) matches.push({ L, rows, route }); else unmatched.push(L);
}
P(`\njoined.jsonl lines: ${joined.length}`);
P(`route 1 (rwxlite:<id> in origins): ${matches.filter((m) => m.route === 1).length}`);
P(`route 2 (normalised key, only when route 1 found nothing): ${matches.filter((m) => m.route === 2).length}`);
P(`unmatched: ${unmatched.length}`);
P('unmatched by source / hint:'); show(tally(unmatched, (l) => `${l.source} / ${l.hint}`));
P(`lines matching more than one pass row: ${matches.filter((m) => m.rows.length > 1).length}`);

// ---- per pass row: joined lines
const perRow = new Map(); // pass_id -> lines[]
for (const m of matches) for (const r of m.rows) (perRow.get(r.pass_id) || perRow.set(r.pass_id, []).get(r.pass_id)).push(m.L);
P(`pass rows joined to at least one line: ${perRow.size}`);

// ---- 3. candidates
const cand = [], mixed = [];
for (const [pid, ls] of perRow) {
  const hints = new Set(ls.map((l) => l.hint));
  if (v4.get(pid)?.label !== 'w' || !hints.has('x')) continue;
  (hints.size > 1 ? mixed : cand).push({ pid, ls, hints });
}
const all = cand.concat(mixed).sort((a, b) => a.pid.localeCompare(b.pid));
P(`\ncandidates (v4 w, joined to >=1 line with hint x): ${all.length}`);
P(`  of which all joined lines hint x: ${cand.length}`);
P(`  of which joined lines have different hints (listed separately): ${mixed.length}`);
const xl = all.flatMap((c) => c.ls.filter((l) => l.hint === 'x').map((l) => ({ ...l, pid: c.pid })));
P('candidates by source (pass rows):'); show(tally(all, (c) => [...new Set(c.ls.filter((l) => l.hint === 'x').map((l) => l.source))].sort().join('+')));
P('candidates by vendor_level (x lines):'); show(tally(xl, (l) => l.vendor_level));
P('candidates by hint_sub (x lines):'); show(tally(xl, (l) => l.hint_sub));
P('candidates by source / vendor_level / hint_sub (x lines):'); show(tally(xl, (l) => `${l.source} / ${l.vendor_level} / ${l.hint_sub}`));
P('mixed-hint candidates:');
for (const c of mixed) P(`  ${c.pid}: ${c.ls.map((l) => `${l.id}=${l.hint}`).join(' ')}`);

// ---- 4. information only
const conflictW = [...perRow].filter(([pid, ls]) => v4.get(pid)?.label === 'w' && ls.some((l) => l.hint === 'conflict'));
const xOnlyR = [...perRow].filter(([pid, ls]) => v4.get(pid)?.label === 'x' && ls.every((l) => l.hint === 'r'));
P(`\ninfo: pass rows v4 w with a hint "conflict": ${conflictW.length}`);
P(`info: pass rows v4 x whose only hint is "r": ${xOnlyR.length}`);

// ---- 5. outputs
fs.mkdirSync(OUT, { recursive: true });
const byPid = new Map(key.map((k) => [k.pass_id, k]));
const keyRows = all.map((c) => {
  const xs = c.ls.filter((l) => l.hint === 'x');
  const u = (f) => [...new Set(xs.map(f))].sort().join(';');
  return { pass_id: c.pid, v4_label: 'w', v4_source: v4.get(c.pid).source, source: u((l) => l.source), vendor_level: u((l) => l.vendor_level), hint_sub: u((l) => l.hint_sub), rwxlite_ids: [...new Set(c.ls.map((l) => l.id))].sort().join(';') };
});
const wr = (n, t) => fs.writeFileSync(OUT + n, t);
const keyCsv = toCsv(keyRows, ['pass_id', 'v4_label', 'v4_source', 'source', 'vendor_level', 'hint_sub', 'rwxlite_ids']);
wr('candidates-key.csv', keyCsv);
const order = shuffle(all.map((c) => c.pid), SEED);
const blindRows = order.map((pid, i) => { const k = byPid.get(pid); return { row_id: 'vc' + String(i + 1).padStart(3, '0'), provider: k.provider, method: k.method, path: k.path, operationId: k.operationId, summary: k.summary, description: k.description }; });
const blindCsv = toCsv(blindRows, ['row_id', 'provider', 'method', 'path', 'operationId', 'summary', 'description']);
wr('candidates-blind.csv', blindCsv);
wr('candidates-blind.csv.sha256', `${sha(Buffer.from(blindCsv))}  candidates-blind.csv\n`);
wr('candidates-map.csv', toCsv(order.map((pid, i) => ({ row_id: 'vc' + String(i + 1).padStart(3, '0'), pid })).map((r) => ({ row_id: r.row_id, pass_id: r.pid })), ['row_id', 'pass_id']));

const cnt = (f) => tally(xl, f).map(([k, n]) => `${k}: ${n}`).join('; ');
wr('README.md', `# Vendor cross-check (ruling (a), docs/wiki/truth-v4-plan.md)

Purpose: vendor labels are a cross-check, not truth. Pass rows that v4 calls w where AWS (Permissions management) or GitHub (admin, secrets, keys, roles write) hints x get a second look. Generated by \`poc/v4-pass/vendor-check.mjs\` (no args, deterministic).

## Inputs
- pass-key.csv, jev-facts-pass.jsonl, suspects/suspects-key.csv, suspects/sbatch-NNN-labels.csv, suspects/disagree/disagree-final.csv (v4 label = disagree-final final_class if present, else Jev's label).
- ../../rwxlite data/vendor/joined.jsonl (${joined.length} lines; read-only).

## Join routes
- route 1: the line id appears as rwxlite:<id> in a pass row's origins: ${matches.filter((m) => m.route === 1).length} lines.
- route 2 (only when route 1 finds nothing): normKey from poc/v4-pass/merge.mjs (provider lowercased and stripped of a trailing .com/.io/...; method with QUERY folded to GET; path; operationId; summary whitespace-collapsed, lowercased): ${matches.filter((m) => m.route === 2).length} lines.
- unmatched lines: ${unmatched.length}.

## Candidates
- v4 w and joined to at least one hint x line: ${all.length} pass rows (${cand.length} all-x, ${mixed.length} mixed hints).
- by vendor_level (x lines): ${cnt((l) => l.vendor_level)}
- by hint_sub (x lines): ${cnt((l) => l.hint_sub)}

## Files
- candidates-key.csv: pass_id, v4_label, v4_source, source, vendor_level, hint_sub, rwxlite_ids (do not give to a labeller).
- candidates-blind.csv (+ .sha256): row_id vc001.., pass-key text only, no labels, hints or vendor fields; shuffled with mulberry32 + Fisher-Yates, seed ${SEED}.
- candidates-map.csv: row_id, pass_id.
`);
const hashes = ['candidates-key.csv', 'candidates-blind.csv', 'candidates-map.csv', 'README.md'].map((n) => `${n} ${sha(fs.readFileSync(OUT + n))}`);
P('\nsha256:'); hashes.forEach((h) => P('  ' + h));
