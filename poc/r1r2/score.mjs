// poc/r1r2/score.mjs — tuning POC for D133 candidates R1 and R2.
// Pre-registered in docs/logs/learnings.md ("R1/R2 pre-registered"), bar set
// before measuring. Both rules only RAISE to x, on top of src classifyRow
// (read-only import). No Jev, no network.
//
// R1 (credential replace): PUT/PATCH, not claimed by CANT_UNDO or the
//    credential-set rule, last path segment literal and (lowercased, '-' '_'
//    removed) in {apikey, clientcredentials, token, secret}.
// R2 (end session): any method; (a) operationId lead tokens logout / signout /
//    endsession (or log+out, sign+out, end+session), or (b) any literal path
//    segment (normalised) in {logout, signout, endsession}.
//
// Usage: node poc/r1r2/score.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../tools/csv.js';
import { classifyRow } from '../../src/index.js';
import { tokensForRow } from '../../src/tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const GATE3 = '/home/hamr/PycharmProjects/rwxlite/data/gate-2026-11-06';
export const RANK = { r: 0, w: 1, x: 2 };

// Vendors the lead forbids reading (exam-3 spares). Matched on whole domain labels.
const BANNED = new Set(['clerk', 'neon', 'supabase', 'mux', 'netbird', 'ory', 'novu']);
export const isBanned = (provider) => String(provider || '').toLowerCase().split(/[.:]/).some((l) => BANNED.has(l));

// ---- the two matchers ------------------------------------------------------

const norm = (s) => String(s || '').toLowerCase().replace(/[-_]/g, '');
const isParam = (s) => s.startsWith('{') && s.endsWith('}');
const literalSegments = (p) => String(p || '').split('/').filter((s) => s && !isParam(s));

const R1_WORDS = new Set(['apikey', 'clientcredentials', 'token', 'secret']);
const R1_CLAIMED_RULES = new Set(['cant-undo-verb', 'cant-undo-verb-summary', 'credential-set']);

/** True when step 2 already claims the row (CANT_UNDO lead verb or D131). */
export function claimedByStep2(verdict) {
  return !!verdict && R1_CLAIMED_RULES.has(verdict.rule);
}

/** R1 match -> the segment word, or null. `verdict` = classifyRow(row), for the claim check. */
export function r1Match(row, verdict) {
  const m = (row.method || '').toUpperCase();
  if (m !== 'PUT' && m !== 'PATCH') return null;
  if (claimedByStep2(verdict)) return null;
  const segs = String(row.path || '').split('/').filter(Boolean);
  const last = segs[segs.length - 1];
  if (!last || isParam(last)) return null;
  const w = norm(last);
  return R1_WORDS.has(w) ? w : null;
}

const R2_WORDS = new Set(['logout', 'signout', 'endsession']);
const R2_PAIRS = new Set(['log out', 'sign out', 'end session']);

/** R2 match -> {a, b} (which clause fired), or null. */
export function r2Match(row) {
  let a = null;
  if ((row.operationId || '').trim() !== '') {
    const t = tokensForRow(row);
    if (t.length && R2_WORDS.has(t[0])) a = t[0];
    else if (t.length >= 2 && R2_PAIRS.has(`${t[0]} ${t[1]}`)) a = `${t[0]}+${t[1]}`;
  }
  const seg = literalSegments(row.path).map(norm).find((s) => R2_WORDS.has(s));
  const b = seg || null;
  return a || b ? { a, b } : null;
}

export const RULES = {
  R1: (row, v) => { const w = r1Match(row, v); return w ? { word: w } : null; },
  R2: (row) => { const m = r2Match(row); return m ? { word: m.a ? `a:${m.a}` : `b:${m.b}`, both: !!(m.a && m.b) } : null; },
};
export const RULE_SETS = { R1: ['R1'], R2: ['R2'], 'R1+R2': ['R1', 'R2'] };

/** Which rules in `names` fire: [] = none. */
export function fires(row, verdict, names) {
  const out = [];
  for (const n of names) { const f = RULES[n](row, verdict); if (f) out.push(`${n}:${f.word}`); }
  return out;
}

// ---- ledger / tally ---------------------------------------------------------

export function outcome(pred, truth) {
  if (RANK[pred] === undefined || RANK[truth] === undefined) throw new Error(`bad class ${pred}/${truth}`);
  if (pred === truth) return 'exact';
  return RANK[pred] < RANK[truth] ? 'leak' : 'over';
}
export function ledger(pairs) {
  const l = { n: pairs.length, exact: 0, leak: 0, over: 0 };
  for (const [p, t] of pairs) l[outcome(p, t)] += 1;
  return l;
}
/** Tally over fired rows: moved = mechanical letter is not x. */
export function tally(rows) {
  const t = { fires: rows.length, alreadyX: 0, moved: 0, right: 0, wrongW: 0, wrongR: 0 };
  for (const r of rows) {
    if (r.mech === 'x') { t.alreadyX += 1; continue; }
    t.moved += 1;
    if (r.truth === 'x') t.right += 1; else if (r.truth === 'w') t.wrongW += 1; else t.wrongR += 1;
  }
  t.wrong = t.wrongW + t.wrongR;
  return t;
}
export const byVendor = (rows) => {
  const m = new Map();
  for (const r of rows) { if (!m.has(r.provider)) m.set(r.provider, []); m.get(r.provider).push(r); }
  return m;
};

// ---- loading ----------------------------------------------------------------

const csv = (p) => parseCsv(fs.readFileSync(p, 'utf8'));
const csvGz = (p) => parseCsv(zlib.gunzipSync(fs.readFileSync(p)).toString('utf8'));

function mk(r, truth, line, stratum) {
  const v = classifyRow(r);
  return { row_id: r.row_id || r.id, provider: r.provider, method: r.method, path: r.path, operationId: r.operationId,
    summary: r.summary, description: r.description, truth, verdict: v, mech: v.class, line, stratum };
}

function loadCsvSet(line, rel) {
  const all = csv(path.join(ROOT, rel));
  let skipped = 0, banned = 0;
  const rows = [];
  for (const r of all) {
    if (RANK[r.truth_class] === undefined) { skipped += 1; continue; }
    if (isBanned(r.provider)) { banned += 1; continue; }
    rows.push(mk(r, r.truth_class, line));
  }
  return { line, rows, note: `read ${all.length}; skipped ${skipped} (truth not r/w/x); banned-vendor ${banned}` };
}

function loadFresh() {
  const dir = path.join(ROOT, 'data/rwxlite-fresh-2026-11-03');
  const ops = csvGz(path.join(dir, 'ops.csv.gz'));
  const truth = new Map(csv(path.join(dir, 'truth.csv')).map((r) => [r.id, r.label]));
  const dec = new Map();
  for (const l of zlib.gunzipSync(fs.readFileSync(path.join(dir, 'decision.jsonl.gz'))).toString('utf8').split('\n')) {
    if (l.trim()) { const o = JSON.parse(l); dec.set(o.id, o); }
  }
  let skipped = 0, banned = 0, methodDiff = 0;
  const rows = [];
  for (const r of ops) {
    const t = truth.get(r.id);
    if (RANK[t] === undefined) { skipped += 1; continue; }
    if (isBanned(r.provider)) { banned += 1; continue; }
    const d = dec.get(r.id);
    if (d && d.method !== r.method) methodDiff += 1;
    rows.push(mk(r, t, 'fresh949'));
  }
  return { line: 'fresh949', rows, note: `ops ${ops.length}; truth ${truth.size}; decision ${dec.size}; skipped ${skipped}; banned-vendor ${banned}; method differs ops vs decision ${methodDiff}` };
}

function loadGate3() {
  if (!fs.existsSync(path.join(GATE3, 'blind.csv'))) return null;
  const ops = csv(path.join(GATE3, 'blind.csv'));
  const truth = new Map(csv(path.join(GATE3, 'truth.csv')).map((r) => [r.id, r.label]));
  const part = new Map(csv(path.join(GATE3, 'part.csv')).map((r) => [r.id, r.part]));
  let skipped = 0, banned = 0;
  const rows = [];
  for (const r of ops) {
    const t = truth.get(r.id);
    if (RANK[t] === undefined) { skipped += 1; continue; }
    if (isBanned(r.provider)) { banned += 1; continue; }
    rows.push(mk(r, t, 'gate3', part.get(r.id)));
  }
  return { line: 'gate3', rows, note: `blind ${ops.length}; truth ${truth.size}; skipped ${skipped}; banned-vendor ${banned}` };
}

// ---- reporting --------------------------------------------------------------

const pct = (n, d) => (d === 0 ? '0.0%' : `${((100 * n) / d).toFixed(1)}%`);
const L = (l) => `${l.exact} exact (${pct(l.exact, l.n)}) / ${l.leak} too loose (${pct(l.leak, l.n)}) / ${l.over} too tight (${pct(l.over, l.n)}) of ${l.n}`;
const isWorkos = (p) => String(p).toLowerCase().split('.')[0] === 'workos';
const trunc = (s, n) => { const t = String(s || '').replace(/\s+/g, ' '); return t.length > n ? `${t.slice(0, n - 1)}~` : t; };

/** Score one rule set on one row pile; prints the block, returns summary. */
function block(title, rows, rname, listRows) {
  const names = RULE_SETS[rname];
  const fired = [];
  for (const r of rows) { const f = fires(r, r.verdict, names); if (f.length) fired.push({ ...r, fw: f }); }
  const t = tally(fired);
  const before = ledger(rows.map((r) => [r.mech, r.truth]));
  const firedIds = new Set(fired.map((r) => r.row_id));
  const after = ledger(rows.map((r) => [firedIds.has(r.row_id) ? 'x' : r.mech, r.truth]));
  // claimed-by-step-2 rows that a R1 shape would otherwise match (all already x by construction)
  let claimedShape = 0;
  if (names.includes('R1')) for (const r of rows) if (r1Match(r, null) && claimedByStep2(r.verdict)) claimedShape += 1;
  console.log(`\n-- ${title} | ${rname} | ${rows.length} rows`);
  console.log(`   fires ${t.fires} of ${rows.length}; already x ${t.alreadyX}; moved ${t.moved} -> right (truth x) ${t.right}, wrong truth w ${t.wrongW}, wrong truth r ${t.wrongR}; ${t.right > t.wrong ? 'right > wrong' : 'right <= wrong'}${t.moved === 0 ? ' (no moves: bar 1 vacuous)' : ''}` +
    (names.includes('R1') ? `; R1-shaped rows claimed by step 2 (already x): ${claimedShape}` : ''));
  console.log(`   before: ${L(before)}`);
  console.log(`   after : ${L(after)}  | too loose ${before.leak} -> ${after.leak} ${after.leak <= before.leak ? 'ok' : 'RISES'}; too tight ${before.over} -> ${after.over} (+${after.over - before.over}, wrong moves ${t.wrong})`);
  // per vendor + leave-one-vendor-out
  const bv = byVendor(fired);
  const per = [...bv.entries()].map(([v, rs]) => ({ v, t: tally(rs) })).sort((a, b) => b.t.fires - a.t.fires);
  console.log(`   per vendor (fires / moved / right / wrong): ${per.map(({ v, t: x }) => `${v} ${x.fires}/${x.moved}/${x.right}/${x.wrong}`).join(', ') || '(none)'}`);
  let topShare = 0, top = null;
  if (per.length) { top = per[0].v; topShare = per[0].t.fires / t.fires; }
  console.log(`   top vendor ${top || '-'} holds ${per.length ? per[0].t.fires : 0} of ${t.fires} fires (${pct(per.length ? per[0].t.fires : 0, t.fires)})${topShare > 0.5 ? ' FLAG: >50% one vendor' : ''}`);
  const lo = per.map(({ v }) => { const x = tally(fired.filter((r) => r.provider !== v)); return `-${v}: moved ${x.moved} right ${x.right} wrong ${x.wrong}${x.moved && x.right <= x.wrong ? ' (right<=wrong)' : ''}`; });
  console.log(`   leave-one-vendor-out (rows of vendor removed): ${lo.join('; ') || '(none)'}`);
  const movedPer = per.slice().sort((a, b) => b.t.moved - a.t.moved)[0];
  if (movedPer) {
    const x = tally(fired.filter((r) => r.provider !== movedPer.v));
    console.log(`   top-moved vendor removed (${movedPer.v}): moved ${x.moved}, right ${x.right}, wrong ${x.wrong}; ${x.right > x.wrong ? 'right > wrong' : 'right <= wrong'}`);
  }
  // workos excluded
  const nw = fired.filter((r) => !isWorkos(r.provider));
  const tw = tally(nw);
  const rowsNw = rows.filter((r) => !isWorkos(r.provider));
  const nwIds = new Set(nw.map((r) => r.row_id));
  const bw = ledger(rowsNw.map((r) => [r.mech, r.truth]));
  const aw = ledger(rowsNw.map((r) => [nwIds.has(r.row_id) ? 'x' : r.mech, r.truth]));
  console.log(`   workos excluded (${rows.length - rowsNw.length} rows removed): fires ${tw.fires}; already x ${tw.alreadyX}; moved ${tw.moved}, right ${tw.right}, wrong ${tw.wrong}; ${tw.moved === 0 ? 'no moves' : tw.right > tw.wrong ? 'right > wrong' : 'right <= wrong'}`);
  console.log(`      before: ${L(bw)}`);
  console.log(`      after : ${L(aw)} | too loose ${bw.leak} -> ${aw.leak} ${aw.leak <= bw.leak ? 'ok' : 'RISES'}`);
  if (listRows) {
    console.log('   fired rows: vendor | method | path | operationId | truth | before->after | verdict');
    for (const r of fired) {
      const mv = r.mech === 'x' ? 'already x' : r.truth === 'x' ? 'RIGHT' : 'WRONG';
      console.log(`     ${r.provider} | ${r.method} | ${r.path} | ${trunc(r.operationId, 60)} | ${r.truth} | ${r.mech}->x (${r.verdict.rule}) | ${mv} | ${r.fw.join(',')}`);
    }
  }
  return { t, before, after, topShare, rname };
}

function scoreLine(line, rows, note, stratum) {
  const title = stratum ? `${line}/${stratum}` : line;
  console.log(`\n================ ${title}${note ? ` (${note})` : ''}`);
  const res = {};
  for (const rn of Object.keys(RULE_SETS)) res[rn] = block(title, rows, rn, true);
  return res;
}

function prevalence() {
  const all = csvGz(path.join(ROOT, 'data/corpus/apis-guru-ops.csv.gz'));
  console.log(`\n================ APIs.guru prevalence: ${all.length} ops read (no truth)`);
  for (const rn of Object.keys(RULE_SETS)) {
    const vc = {}; let n = 0, moved = 0;
    for (const r of all) {
      const v = classifyRow(r);
      const f = fires(r, v, RULE_SETS[rn]);
      if (!f.length) continue;
      n += 1; if (v.class !== 'x') moved += 1;
      vc[r.provider] = (vc[r.provider] || 0) + 1;
    }
    const top = Object.entries(vc).sort((a, b) => b[1] - a[1]);
    const share = top.length ? top[0][1] / n : 0;
    const noWorkos = Object.entries(vc).filter(([p]) => !isWorkos(p)).reduce((s, [, c]) => s + c, 0);
    console.log(`[prev] ${rn}: ${n} fires (would move ${moved} not already x) across ${top.length} providers; top ${top[0] ? top[0][0] : '-'} ${pct(top.length ? top[0][1] : 0, n)}${share > 0.5 ? ' FLAG: >50% one provider' : ''}; with workos excluded ${noWorkos} fires`);
    console.log(`       top 10: ${top.slice(0, 10).map(([v, c]) => `${v} ${c}`).join(', ')}`);
  }
}

function main() {
  const sets = [loadCsvSet('combined', 'data/combined-2026-09-21/labelled.csv'), loadCsvSet('buildset', 'data/relabel-buildset-2026-09-23/labelled.csv'), loadFresh()];
  const g3 = loadGate3();
  const results = {};
  for (const s of sets) results[s.line] = scoreLine(s.line, s.rows, s.note);
  if (g3) {
    console.log(`\n[gate3 note] ${g3.note}. NOTE: gate-3 was the D131 exam (burned for that rule); used here as a tuning line for new rules only.`);
    results.gate3 = scoreLine('gate3', g3.rows, 'all 800');
    for (const st of ['cred', 'general']) results[`gate3/${st}`] = scoreLine('gate3', g3.rows.filter((r) => r.stratum === st), 'stratum', st);
  } else console.log('\n[gate3] SKIPPED: blind.csv not found');
  prevalence();
  console.log('\n================ BAR SUMMARY (D100 tighten-only; per rule; moved rows on mechanical)');
  for (const [line, res] of Object.entries(results)) {
    for (const [rn, r] of Object.entries(res)) {
      const checks = [
        [`right ${r.t.right} > wrong ${r.t.wrong}${r.t.moved === 0 ? ' (vacuous, no moves)' : ''}`, r.t.moved === 0 || r.t.right > r.t.wrong],
        [`too loose ${r.before.leak} -> ${r.after.leak}`, r.after.leak <= r.before.leak],
        [`top share ${pct(r.topShare * 100, 100)} <= 50%`, r.topShare <= 0.5],
      ];
      console.log(`${line} ${rn}: ${checks.every(([, ok]) => ok) ? 'ok  ' : 'CHECK'} ${checks.map(([s, ok]) => `${ok ? 'ok' : 'NO'}: ${s}`).join('; ')}`);
    }
  }
  console.log('(LOVO, workos-excluded and prevalence readings are in the blocks above; bar 3 and 4 are judged there.)');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
