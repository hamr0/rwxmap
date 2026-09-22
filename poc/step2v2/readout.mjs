// Readout for step 2 v2 (D86) — run with: node poc/step2v2/readout.mjs [--rows]
//
// A comparison harness, not module code: it MAY import the frozen src/ flow
// (step1, step3, classifyRow) to build the v2 ladder inline and to diff v2
// against the frozen flow row by row. step2.mjs itself imports nothing.
//
// Reads data/combined-2026-09-21/rows.json.gz — 6557 rows, TUNING data. No
// number printed here is an accuracy claim; the accuracy read waits for the
// reversibility relabel (data/relabel-2026-09-22).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { step1 } from '../../src/step1.js';
import { step3, floorPost } from '../../src/step3.js';
import { classifyRow } from '../../src/flow.js';
import { step2v2, verbForRow, matchingMembers, DESTRUCTIVE_VERBS } from './step2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const ROWS_GZ = path.join(REPO_ROOT, 'data/combined-2026-09-21/rows.json.gz');
const EXPECTED_ROWS = 6557;
const EXPECTED_SHA = '3d07a5a410c91d2ef10494d8d91bcb01290acb1e67f7a89d85866781d1d38c5f';
const NEW_RULES = new Set(['method-delete', 'destructive-verb', 'destructive-verb-summary']);
const RANK = { r: 0, w: 1, x: 2 };
const METHOD_ORDER = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE', 'PATCH'];
const showRows = process.argv.includes('--rows');

// --- load + verify ---------------------------------------------------------
const json = gunzipSync(readFileSync(ROWS_GZ));
const sha = createHash('sha256').update(json).digest('hex');
if (sha !== EXPECTED_SHA) {
  console.error(`sha256 mismatch: ${sha} != ${EXPECTED_SHA}`);
  process.exit(1);
}
const rows = JSON.parse(json);
if (rows.length !== EXPECTED_ROWS) {
  console.error(`row count ${rows.length} != ${EXPECTED_ROWS}`);
  process.exit(1);
}

// --- helpers ---------------------------------------------------------------
function pad(v, w) { return String(v).padEnd(w); }
function padL(v, w) { return String(v).padStart(w); }
function table(header, body, aligns) {
  const widths = header.map((h, i) => Math.max(String(h).length, ...body.map((r) => String(r[i] ?? '').length)));
  const line = (cells) => cells
    .map((c, i) => (aligns[i] === 'r' ? padL(c ?? '', widths[i]) : pad(c ?? '', widths[i])))
    .join('  ')
    .replace(/\s+$/, '');
  const out = [line(header), widths.map((w) => '-'.repeat(w)).join('  ')];
  for (const r of body) out.push(line(r));
  return out.join('\n');
}
function pct(a, b) { return b === 0 ? '-' : (100 * a / b).toFixed(1) + '%'; }
function count(a, b) { return `${a} (${pct(a, b)})`; }
function methodIdx(m) { const i = METHOD_ORDER.indexOf(m); return i === -1 ? 99 : i; }

// The v2 ladder: step1 → step2v2 → (method-floor only) step3 raise → floorPost.
// Same precedence as src/flow.js: a word beats no word, so only the wordless
// PUT/PATCH floor is offered to step 3.
function classifyRowV2(row) {
  const one = step1(row);
  if (one) return one;
  const two = step2v2(row);
  if (two) {
    if (two.rule === 'method-floor') {
      const raised = step3(row);
      if (raised) return raised;
    }
    return two;
  }
  return floorPost();
}

// ledger(pred, truth): exact / leak (pred looser than truth) / over-tight.
function ledger(pairs) {
  const l = { n: 0, exact: 0, leaks: 0, tight: 0 };
  for (const { pred, truth } of pairs) {
    l.n += 1;
    if (pred === truth) l.exact += 1;
    else if (RANK[pred] < RANK[truth]) l.leaks += 1;
    else l.tight += 1;
  }
  return l;
}
function ledgerRow(label, l) {
  return [label, l.n, count(l.exact, l.n), count(l.leaks, l.n), count(l.tight, l.n)];
}

// --- run both flows -------------------------------------------------------
const scored = rows.map((row) => ({ row, v1: classifyRow(row), v2: classifyRowV2(row) }));

console.log(`data/combined-2026-09-21/rows.json.gz: ${rows.length} rows, sha256 ok. TUNING data — every number below is a diagnostic, not an exam.`);
console.log();

// ===========================================================================
// 1. MECHANICS DIFF vs the frozen flow
// ===========================================================================
console.log('=== 1. MECHANICS DIFF: v2 flow vs frozen src/flow.js, over all 6557 rows ===');
console.log();

const changed = scored.filter((s) => s.v1.class !== s.v2.class);
const unchanged = scored.filter((s) => s.v1.class === s.v2.class);
const failures = [];

for (const s of changed) {
  const dir = `${s.v1.class}→${s.v2.class}`;
  if (dir !== 'w→x') failures.push({ ...s, why: `class changed ${dir}, only w→x is allowed` });
  else if (!NEW_RULES.has(s.v2.rule)) failures.push({ ...s, why: `changed row has v2 rule ${s.v2.rule}, not one of the new rules` });
}

// Unchanged rows: same rule name, or — the one allowed exception — x by
// another route: the frozen flow already said x (raise-word, floor-post) and
// v2 says x by one of the new rules. Same class, different evidence.
const xByAnotherRoute = [];
for (const s of unchanged) {
  if (s.v1.rule === s.v2.rule) continue;
  if (s.v1.class === 'x' && s.v2.class === 'x' && NEW_RULES.has(s.v2.rule)) { xByAnotherRoute.push(s); continue; }
  failures.push({ ...s, why: `unchanged class ${s.v1.class} but rule ${s.v1.rule} → ${s.v2.rule}` });
}
// Unchanged rows with the same rule: the verdict must be identical apart from
// the new `destructive` field.
for (const s of unchanged) {
  if (s.v1.rule !== s.v2.rule) continue;
  const { destructive: _d, ...v2rest } = s.v2;
  if (JSON.stringify(v2rest) !== JSON.stringify(s.v1)) failures.push({ ...s, why: 'same rule but verdict differs beyond `destructive`' });
}

const perNewRule = {};
for (const s of changed) perNewRule[s.v2.rule] = (perNewRule[s.v2.rule] || 0) + 1;

console.log(`rows whose class changed: ${changed.length} of ${rows.length} (${pct(changed.length, rows.length)}), every one w→x`);
console.log(`rows whose class did not change: ${unchanged.length} of ${rows.length}`);
console.log(`  same rule name (verdict identical apart from \`destructive\`): ${unchanged.length - xByAnotherRoute.length}`);
console.log(`  x by another route (frozen said x by raise-word/floor-post, v2 says x by a new rule): ${xByAnotherRoute.length}`);
console.log();
console.log('changed rows (w→x) per v2 rule:');
console.log(table(['v2 rule', 'rows'], Object.entries(perNewRule).sort().map(([r, n]) => [r, n]), ['l', 'r']));
console.log();
{
  const routes = {};
  for (const s of xByAnotherRoute) { const k = `${s.v1.rule} → ${s.v2.rule}`; routes[k] = (routes[k] || 0) + 1; }
  console.log('x by another route, per frozen rule → v2 rule:');
  console.log(table(['route', 'rows'], Object.entries(routes).sort().map(([r, n]) => [r, n]), ['l', 'r']));
  console.log();
}
{
  const byMethod = {};
  for (const s of changed) {
    const k = `${s.row.method}|${s.v1.rule}|${s.v2.rule}`;
    byMethod[k] = (byMethod[k] || 0) + 1;
  }
  console.log('changed rows by method and frozen rule → v2 rule:');
  console.log(table(['method', 'frozen rule', 'v2 rule', 'rows'],
    Object.entries(byMethod).sort().map(([k, n]) => [...k.split('|'), n]), ['l', 'l', 'l', 'r']));
  console.log();
}

if (failures.length) {
  console.log(`MECHANICS ASSERTION FAILED on ${failures.length} rows:`);
  for (const f of failures) {
    console.log(`  ${f.row.row_id} | ${f.row.provider} | ${f.row.method} | ${f.row.operationId} | truth ${f.row.truth} | ${f.v1.rule}(${f.v1.class}) → ${f.v2.rule}(${f.v2.class}) | ${f.why}`);
  }
  process.exit(1);
}
console.log('mechanics assertions hold: every changed row is w→x by a new rule; no r↔anything, no x→w; every unchanged row keeps its rule (or is x by another route).');
console.log();

// ===========================================================================
// 2. POST rows that the frozen step 2 lowered to w by modify-verb, now x
// ===========================================================================
console.log('=== 2. POST rows: frozen modify-verb(-summary) said w, v2 destructive-verb(-summary) says x ===');
console.log('These are the rows where the frozen MODIFY_VERBS and DESTRUCTIVE_VERBS overlapped (cancel, delete, remove, detach, expire, disable, deactivate, suspend). Read them: the v1 truth column is what the labellers said under the OLD brief, before reversibility was folded in.');
console.log();
const overlap = changed.filter((s) => s.row.method === 'POST' && s.v1.rule.startsWith('modify-verb') && s.v2.rule.startsWith('destructive-verb'));
{
  const byVerb = {};
  const byTruth = {};
  for (const s of overlap) {
    for (const m of s.v2.matched) byVerb[m] = (byVerb[m] || 0) + 1;
    byTruth[s.row.truth] = (byTruth[s.row.truth] || 0) + 1;
  }
  console.log(`count: ${overlap.length} POST rows (of ${changed.length} changed rows). v1 truth: ${Object.entries(byTruth).sort().map(([t, n]) => `${t}=${n}`).join(', ')}`);
  console.log(table(['matched verb', 'rows'], Object.entries(byVerb).sort((a, b) => b[1] - a[1]).map(([v, n]) => [v, n]), ['l', 'r']));
  console.log();
  console.log(table(['row_id', 'provider', 'operationId', 'summary', 'v1 truth', 'frozen rule', 'v2 rule', 'matched'],
    overlap.map((s) => [s.row.row_id, s.row.provider, s.row.operationId, (s.row.summary || '').slice(0, 60), s.row.truth, s.v1.rule, s.v2.rule, s.v2.matched.join(',')]),
    ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l']));
  console.log();
}

// ===========================================================================
// 3. PROXY LEDGER
// ===========================================================================
console.log('=== 3. PROXY LEDGER (tuning data, PROXY truth — not an accuracy number) ===');
console.log('proxy truth = v1 truth, except a v1 truth-w row becomes x when its method is DELETE or its verb (read the same way step 2 reads it: lead after modifiers, summary when the lead is a bare method word) matches DESTRUCTIVE_VERBS.');
console.log('CAVEAT: the proxy flips truth and prediction with the SAME rule, so on every row where it applies (DELETE, destructive lead verb) it cannot disagree with itself. Those rows are exact by construction. Reversibility was never labelled; the honest number waits for data/relabel-2026-09-22.');
console.log();

function proxyTruth(row) {
  if (row.truth !== 'w') return row.truth;
  if ((row.method || '').toUpperCase() === 'DELETE') return 'x';
  const { verb } = verbForRow(row);
  if (matchingMembers(verb, DESTRUCTIVE_VERBS).length > 0) return 'x';
  return 'w';
}
const withProxy = scored.map((s) => ({ ...s, proxy: proxyTruth(s.row) }));
{
  const flipped = withProxy.filter((s) => s.row.truth === 'w' && s.proxy === 'x');
  const truthW = rows.filter((r) => r.truth === 'w').length;
  const tally = (key) => { const c = { r: 0, w: 0, x: 0 }; for (const s of withProxy) c[s[key] ?? s.row[key]] += 1; return c; };
  const t1 = { r: 0, w: 0, x: 0 }; for (const r of rows) t1[r.truth] += 1;
  const t2 = { r: 0, w: 0, x: 0 }; for (const s of withProxy) t2[s.proxy] += 1;
  console.log(`v1 truth-w rows flipped to x by the proxy: ${flipped.length} of ${truthW} truth-w rows (${pct(flipped.length, truthW)})`);
  console.log(`  by method: ${METHOD_ORDER.filter((m) => flipped.some((s) => s.row.method === m)).map((m) => `${m}=${flipped.filter((s) => s.row.method === m).length}`).join(', ')}`);
  console.log(`truth distribution v1: r ${t1.r} / w ${t1.w} / x ${t1.x}; proxy: r ${t2.r} / w ${t2.w} / x ${t2.x} (of ${rows.length})`);
  console.log();
}

for (const [label, key, truthKey] of [
  ['frozen flow vs v1 truth (reference)', 'v1', 'truth'],
  ['frozen flow vs PROXY truth', 'v1', 'proxy'],
  ['v2 flow vs PROXY truth', 'v2', 'proxy'],
]) {
  const pairs = withProxy.map((s) => ({ pred: s[key].class, truth: truthKey === 'truth' ? s.row.truth : s.proxy, step: s[key].step, rule: s[key].rule }));
  const body = [ledgerRow('all', ledger(pairs))];
  for (const st of [1, 2, 3]) body.push(ledgerRow(`step ${st}`, ledger(pairs.filter((p) => p.step === st))));
  const ruleNames = [...new Set(pairs.map((p) => `${p.step}:${p.rule}`))].sort();
  for (const rn of ruleNames) body.push(ledgerRow(`  ${rn}`, ledger(pairs.filter((p) => `${p.step}:${p.rule}` === rn))));
  console.log(`${label}:`);
  console.log(table(['scope', 'rows', 'exact', 'leaks', 'over-tight'], body, ['l', 'r', 'r', 'r', 'r']));
  console.log();
}

// ===========================================================================
// 4. PER-VERB FIRE TABLE over the v1 truth-w rows
// ===========================================================================
console.log('=== 4. PER-VERB FIRE TABLE: the 23 destructive verbs as the row verb, over the 2266 v1 truth-w rows (fires only — no truth for reversibility yet) ===');
{
  const truthW = rows.filter((r) => r.truth === 'w');
  console.log(`denominator: ${truthW.length} v1 truth-w rows`);
  const body = [];
  let totalFires = 0;
  const firedRows = new Set();
  for (const verb of [...DESTRUCTIVE_VERBS].sort()) {
    const hits = truthW.filter((r) => matchingMembers(verbForRow(r).verb, new Set([verb])).length > 0);
    totalFires += hits.length;
    for (const h of hits) firedRows.add(h.row_id);
    const byMethod = {};
    const byProvider = {};
    for (const h of hits) {
      byMethod[h.method] = (byMethod[h.method] || 0) + 1;
      byProvider[h.provider] = (byProvider[h.provider] || 0) + 1;
    }
    const methods = Object.entries(byMethod).sort((a, b) => methodIdx(a[0]) - methodIdx(b[0])).map(([m, n]) => `${m}=${n}`).join(' ');
    const providers = Object.entries(byProvider).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([p, n]) => `${p}=${n}`).join(' ');
    body.push([verb, hits.length, methods || '-', providers || '-']);
  }
  console.log(table(['verb', 'fires', 'by method', 'top providers (5)'], body, ['l', 'r', 'l', 'l']));
  console.log(`total fires ${totalFires} on ${firedRows.size} distinct rows of ${truthW.length} (a row counts once per member its verb stem-matches; equal numbers mean no row matched two members)`);
  const deleteMethodW = truthW.filter((r) => r.method === 'DELETE').length;
  console.log(`for comparison, truth-w DELETE rows (flipped by the method, no verb needed): ${deleteMethodW} of ${truthW.length}`);
  console.log();
}

// ===========================================================================
// 5. --rows
// ===========================================================================
if (showRows) {
  console.log('=== 5. every changed row ===');
  console.log('row_id | provider | method | operationId | v1 truth | frozen rule → v2 rule | matched');
  for (const s of changed) {
    console.log(`${s.row.row_id} | ${s.row.provider} | ${s.row.method} | ${s.row.operationId} | ${s.row.truth} | ${s.v1.rule} → ${s.v2.rule} | ${s.v2.matched.join(',')}`);
  }
} else {
  console.log('(run with --rows to list every changed row)');
}
