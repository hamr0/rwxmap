// poc/cutoffs/score.mjs — tuning POC: do rwxlite's Jev cut-offs earn a build?
//
// Tuning numbers only. Reads cached Jev answers (no network, no Jev call),
// joins on row_id, classifies with src's classifyRow and applies Jev with
// src's applyJev (read-only imports), so the apply logic is the real one.
// Cuts are passed through options.thresholds under 'jev-lower',
// 'jev-lower-r', 'jev-raise-wx', 'jev-raise-get'. The two runs are never
// averaged. Tiers keep separate ledgers; "combined" lines say so.
//
// MODEL MISMATCH (stated, deliberate): the lower tier's isX answers are
// jev-1.13.0 and its changes answers (D129) are jev-1.14.0. applyJev only
// accepts a changes answer whose model equals the isX model, so for this POC
// the changes answer is given the isX answer's model string.
//
// Usage: node poc/cutoffs/score.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../tools/csv.js';
import { classifyRow } from '../../src/index.js';
import { applyJev, needsJev } from '../../src/jev.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const D = (p) => path.join(ROOT, 'data', p);

export const RANK = { r: 0, w: 1, x: 2 };
export const BAR = 10;
export const TODAY = { 'jev-lower': 0.1, 'jev-lower-r': 0.5, 'jev-raise-wx': 0.8, 'jev-raise-get': 0.5 };
export const RWXLITE = { 'jev-lower': 0.2, 'jev-lower-r': 0.5, 'jev-raise-wx': 0.6, 'jev-raise-get': 0.2 };
const steps = (a, b, s) => {
  const o = [];
  for (let i = 0; a + i * s <= b + 1e-9; i += 1) o.push(Math.round((a + i * s) * 100) / 100);
  return o;
};
export const GRID = {
  'jev-lower': steps(0.05, 0.4, 0.05),
  'jev-raise-wx': steps(0.5, 0.9, 0.05),
  'jev-raise-get': steps(0.2, 0.7, 0.05),
};
export const TIERS = ['jev-lower', 'jev-raise-wx', 'jev-raise-get'];
// Which way a cut change moves letters: lower tier cut up = looser; raise tiers cut down = tighter.

export function outcome(pred, truth) {
  if (RANK[pred] === undefined || RANK[truth] === undefined) throw new Error(`bad class ${pred}/${truth}`);
  if (pred === truth) return 'exact';
  return RANK[pred] < RANK[truth] ? 'leak' : 'over';
}

export function answerP(o, key) {
  if (!o || typeof o !== 'object' || o.error) return null;
  const a = o.answers && o.answers[key];
  const p = a && typeof a === 'object' ? a.noul : undefined;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return null;
  return p;
}

export const ratio = (right, wrong) => (wrong === 0 ? (right > 0 ? Infinity : 0) : right / wrong);
const fr = (x) => (x === Infinity ? 'inf' : x.toFixed(2));
const pct = (n, d) => (d === 0 ? '0.0%' : `${((100 * n) / d).toFixed(1)}%`);
const sg = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** Final letter of one item at the given cuts, via the real applyJev. */
export function letterAt(it, cuts) {
  if (!it.ans) return it.mech;
  return applyJev(it.verdict, it.ans, { thresholds: cuts, method: it.row.method }).class;
}

/** Compare before/after letters over items: moved, right, wrong, other, ledger deltas. */
export function compare(items, before, after) {
  const c = { n: items.length, moved: 0, looser: 0, tighter: 0, right: 0, wrong: 0, other: 0, exactB: 0, exactA: 0, leakB: 0, leakA: 0, overB: 0, overA: 0 };
  for (let i = 0; i < items.length; i += 1) {
    const t = items[i].truth;
    const ob = outcome(before[i], t);
    const oa = outcome(after[i], t);
    c[{ exact: 'exactB', leak: 'leakB', over: 'overB' }[ob]] += 1;
    c[{ exact: 'exactA', leak: 'leakA', over: 'overA' }[oa]] += 1;
    if (before[i] === after[i]) continue;
    c.moved += 1;
    const looser = RANK[after[i]] < RANK[before[i]];
    if (looser) c.looser += 1;
    else c.tighter += 1;
    if (ob !== 'exact' && oa === 'exact') c.right += 1;
    else if ((looser && oa === 'leak' && ob !== 'leak') || (!looser && oa === 'over' && ob !== 'over')) c.wrong += 1;
    else c.other += 1;
  }
  return c;
}

/** Bar (D100): loosening needs right/wrong >= 10; tighten-only needs right > wrong and too-loose never up. */
export function barFor(c) {
  if (c.moved === 0) return { dir: 'none', pass: false };
  if (c.looser > 0) return { dir: 'loosen', pass: c.right > 0 && ratio(c.right, c.wrong) >= BAR };
  return { dir: 'tighten', pass: c.right > c.wrong && c.leakA <= c.leakB };
}

export function sumC(list) {
  const s = { n: 0, moved: 0, looser: 0, tighter: 0, right: 0, wrong: 0, other: 0, exactB: 0, exactA: 0, leakB: 0, leakA: 0, overB: 0, overA: 0 };
  for (const c of list) for (const k of Object.keys(s)) s[k] += c[k];
  return s;
}

/** Pick the cut for a tier on `train`: best exact gain among grid cuts that pass the bar; else today's. */
export function pickCut(train, tier, grid = GRID[tier]) {
  if (train.length === 0) return TODAY[tier];
  const base = train.map((it) => letterAt(it, TODAY));
  let best = null;
  for (const g of grid) {
    if (g === TODAY[tier]) continue;
    const after = train.map((it) => letterAt(it, { ...TODAY, [tier]: g }));
    const c = compare(train, base, after);
    if (!barFor(c).pass) continue;
    const gain = c.exactA - c.exactB;
    const dist = Math.abs(g - TODAY[tier]);
    if (best === null || gain > best.gain || (gain === best.gain && dist < best.dist)) best = { g, gain, dist };
  }
  return best && best.gain > 0 ? best.g : TODAY[tier];
}

/** Leave-one-vendor-out for one tier. Returns picked cut per item index (into `items`) plus folds. */
export function lovoTier(items, tier) {
  const vendors = [...new Set(items.map((it) => it.row.provider))].sort();
  const cutOf = new Map();
  const folds = [];
  for (const v of vendors) {
    const g = pickCut(items.filter((it) => it.row.provider !== v), tier);
    folds.push({ vendor: v, cut: g, n: items.filter((it) => it.row.provider === v).length });
    for (const it of items) if (it.row.provider === v) cutOf.set(it, g);
  }
  return { cutOf, folds };
}

// ---- loading ----------------------------------------------------------------

function readJsonl(p) {
  const map = new Map();
  let bad = 0;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      map.set(o.row_id, o);
    } catch {
      bad += 1;
    }
  }
  return { map, bad };
}

/**
 * Build items for one set and one run. files: {isX, changes, wx, get} paths (get may be null).
 * Returns {items, notes[]}.
 */
export function buildItems(rows, files, label) {
  const notes = [];
  const src = {};
  for (const k of ['isX', 'changes', 'wx', 'get']) src[k] = files[k] ? readJsonl(files[k]) : null;
  const items = [];
  const tierCount = { 'jev-lower': 0, 'jev-raise-wx': 0, 'jev-raise-get': 0 };
  const skip = { 'jev-lower': { missing: 0, unusable: 0, chMissing: 0, chUnusable: 0 }, 'jev-raise-wx': { missing: 0, unusable: 0 }, 'jev-raise-get': { missing: 0, unusable: 0 } };
  const used = { isX: new Set(), changes: new Set(), wx: new Set(), get: new Set() };
  for (const row of rows) {
    const verdict = classifyRow(row);
    const tier = needsJev(verdict);
    const it = { row, truth: row.truth_class, verdict, mech: verdict.class, tier, ans: null, pX: null, pC: null };
    if (tier) {
      tierCount[tier] += 1;
      if (tier === 'jev-lower') {
        const o = src.isX && src.isX.map.get(row.row_id);
        const oc = src.changes && src.changes.map.get(row.row_id);
        if (o) used.isX.add(row.row_id);
        if (oc) used.changes.add(row.row_id);
        it.pX = answerP(o, 'isX');
        it.pC = answerP(oc, 'changes');
        if (!o) skip[tier].missing += 1;
        else if (it.pX === null || !o.model) skip[tier].unusable += 1;
        if (!oc) skip[tier].chMissing += 1;
        else if (it.pC === null) skip[tier].chUnusable += 1;
        if (it.pX !== null && o.model) {
          it.ans = { p: it.pX, model: o.model };
          if (it.pC !== null) it.ans.changes = { p: it.pC, model: o.model }; // model mismatch stated in header
        }
      } else {
        const key = tier === 'jev-raise-wx' ? 'wx' : 'get';
        const q = tier === 'jev-raise-wx' ? 'isX' : 'changes';
        const o = src[key] && src[key].map.get(row.row_id);
        if (o) used[key].add(row.row_id);
        const p = answerP(o, q);
        if (tier === 'jev-raise-wx') it.pX = p;
        else it.pC = p;
        if (!o) skip[tier].missing += 1;
        else if (p === null || !o.model) skip[tier].unusable += 1;
        else it.ans = { p, model: o.model };
      }
    }
    items.push(it);
  }
  for (const k of ['isX', 'changes', 'wx', 'get']) {
    if (!src[k]) continue;
    const extra = [...src[k].map.keys()].filter((id) => !used[k].has(id)).length;
    notes.push(`${label} ${k}: ${src[k].map.size} answers, ${src[k].bad} unparseable lines, ${extra} answers whose row_id is not in that tier's pile now (ignored)`);
  }
  notes.push(`${label} piles: ${JSON.stringify(tierCount)}; no-answer/unusable (fail closed, never moved): ${JSON.stringify(skip)}`);
  return { items, notes };
}

// ---- reporting -------------------------------------------------------------

function fl(c, side, label) {
  const e = side === 'B' ? c.exactB : c.exactA;
  const l = side === 'B' ? c.leakB : c.leakA;
  const o = side === 'B' ? c.overB : c.overA;
  return `${e} exact (${pct(e, c.n)}) / ${l} too loose (${pct(l, c.n)}) / ${o} too tight (${pct(o, c.n)}) of ${c.n} ${label}`;
}

function cutsFor(tier, g) {
  return { ...TODAY, [tier]: g };
}

function sweep(setName, runName, items) {
  for (const tier of TIERS) {
    const pile = items.filter((it) => it.tier === tier);
    if (pile.length === 0) {
      console.log(`  [${tier}] no pile rows / no cached answers in this set: not measurable`);
      continue;
    }
    const base = pile.map((it) => letterAt(it, TODAY));
    const b = compare(pile, base, base);
    console.log(`  [${tier}] ${setName} ${runName}, today cut ${TODAY[tier]}: ${fl(b, 'B', `${tier} pile rows`)}`);
    for (const g of GRID[tier]) {
      const after = pile.map((it) => letterAt(it, cutsFor(tier, g)));
      const c = compare(pile, base, after);
      const bar = barFor(c);
      const mark = g === TODAY[tier] ? ' (today)' : '';
      console.log(
        `    cut ${g.toFixed(2)}${mark}: moved ${c.moved} of ${c.n} pile rows (${pct(c.moved, c.n)}); looser ${c.looser} tighter ${c.tighter}; right ${c.right}, wrong ${c.wrong}, other ${c.other}; ratio ${fr(ratio(c.right, c.wrong))}; leaks ${c.leakB}->${c.leakA} (${sg(c.leakA - c.leakB)}), over-tight ${c.overB}->${c.overA} (${sg(c.overA - c.overB)}); bar(${bar.dir}) ${bar.dir === 'none' ? '-' : bar.pass ? 'PASS' : 'fail'}`,
      );
    }
  }
}

function lettersFor(items, cutsOf) {
  return items.map((it) => letterAt(it, cutsOf(it)));
}

function ledgerLines(label, items, before, after) {
  const all = compare(items, before, after);
  console.log(`    ${label} combined (all tiers + unmoved rows): before ${fl(all, 'B', 'rows')}`);
  console.log(`    ${label} combined: after  ${fl(all, 'A', 'rows')}; moved ${all.moved}, right ${all.right}, wrong ${all.wrong}, other ${all.other}, ratio ${fr(ratio(all.right, all.wrong))}`);
  for (const tier of TIERS) {
    const idx = items.map((it, i) => (it.tier === tier ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    const c = compare(idx.map((i) => items[i]), idx.map((i) => before[i]), idx.map((i) => after[i]));
    console.log(`    ${tier} own ledger: moved ${c.moved} of ${c.n}; right ${c.right} wrong ${c.wrong} other ${c.other} ratio ${fr(ratio(c.right, c.wrong))}; leaks ${c.leakB}->${c.leakA} over ${c.overB}->${c.overA}; ${fl(c, 'A', 'pile rows')}`);
  }
}

function main() {
  let rowsC = parseCsv(fs.readFileSync(D('combined-2026-09-21/labelled.csv'), 'utf8'));
  const tuningOnly = process.argv.includes('--provider-corpus-only');
  const rowsB = parseCsv(fs.readFileSync(D('relabel-buildset-2026-09-23/labelled.csv'), 'utf8'));
  for (const [n, rs, want] of [['combined', rowsC, 6557], ['buildset', rowsB, 1819]]) {
    if (rs.length !== want) throw new Error(`${n}: expected ${want} rows, got ${rs.length}`);
    const bad = rs.filter((r) => !(r.truth_class in RANK)).length;
    if (bad) throw new Error(`${n}: ${bad} rows with invalid truth_class`);
  }
  const J = 'jev-tiers-2026-09-23/';
  const F = 'f1-post-r-2026-11-03/';
  const runFiles = {
    run1: { isX: D(J + 'out-lower.jsonl'), changes: D(F + 'out-changes-run1.jsonl'), wx: D(J + 'out-raise-wx-xonly.jsonl'), get: D(J + 'out-raise-get.jsonl') },
    run2: { isX: D(J + 'out-lower-run2.jsonl'), changes: D(F + 'out-changes-run2.jsonl'), wx: D(J + 'out-raise-wx-xonly-run2.jsonl'), get: D(J + 'out-raise-get-run2.jsonl') },
  };
  console.log('MODEL MISMATCH: lower isX answers are jev-1.13.0, changes answers jev-1.14.0; the changes answer is given the isX model string for this POC (src requires them equal).');
  console.log(`today's cuts ${JSON.stringify(TODAY)}; rwxlite's ${JSON.stringify(RWXLITE)} (lower-r kept at 0.50, they proposed none)`);
  console.log(`bars (D100): loosening (lower cut up) LOVO right/wrong >= ${BAR} on both runs; tighten-only (raise cuts down) more right than wrong and too-loose never up, both runs and LOVO.`);
  console.log('right = row was not exact and becomes exact; wrong = a moved row becomes a NEW error of the direction it moved (looser -> new leak, tighter -> new over-tight); other = the rest of moved rows (partial improvements, deepened errors).');

  if (tuningOnly) rowsC = rowsC.filter((r) => r.source_set === 'provider-corpus-2026-09-16');
  console.log(tuningOnly ? `MODE: --provider-corpus-only: combined restricted to source_set provider-corpus-2026-09-16 (${rowsC.length} rows); the burned exam rows (exam-2026-09-17, exam-2026-09-20) are dropped` : 'MODE: full combined (includes the burned exam-2026-09-17 and exam-2026-09-20 source rows)');
  const sets = { combined: { rows: rowsC, label: `combined (${rowsC.length})`, runs: {} }, buildset: { rows: rowsB, label: 'buildset (1819, separate line)', runs: {} } };
  for (const [sn, s] of Object.entries(sets)) {
    for (const [rn, files] of Object.entries(runFiles)) {
      const f = sn === 'buildset' ? { ...files, get: null } : files;
      const { items, notes } = buildItems(s.rows, f, `${sn} ${rn}`);
      s.runs[rn] = items;
      for (const n of notes) console.log(`join: ${n}`);
    }
  }

  const picks = {}; // in-sample picks that pass the bar on both runs (combined set)
  for (const sn of ['combined', 'buildset']) {
    const s = sets[sn];
    console.log('');
    console.log(`################ ${s.label} ################`);
    for (const rn of ['run1', 'run2']) {
      const items = s.runs[rn];
      const base = lettersFor(items, () => TODAY);
      const lite = lettersFor(items, () => RWXLITE);
      console.log('');
      console.log(`=== 1/2. ${sn} ${rn}: today's cuts vs rwxlite's cuts ===`);
      ledgerLines('today', items, base, base);
      console.log('  rwxlite cuts vs today:');
      ledgerLines('rwxlite', items, base, lite);
      console.log('');
      console.log(`=== 3. ${sn} ${rn}: per-tier sweeps (others at today's) ===`);
      sweep(sn, rn, items);
    }

    // in-sample pick that passes on both runs: max min exact gain
    console.log('');
    console.log(`=== 4. ${sn}: best per-tier pick passing the bar in-sample on BOTH runs (max of min exact gain; else today's) ===`);
    const pick = { ...TODAY };
    for (const tier of TIERS) {
      const piles = ['run1', 'run2'].map((rn) => s.runs[rn].filter((it) => it.tier === tier));
      if (piles[0].length === 0) {
        console.log(`  ${tier}: not measurable here`);
        continue;
      }
      let best = null;
      for (const g of GRID[tier]) {
        if (g === TODAY[tier]) continue;
        const cs = piles.map((p) => compare(p, p.map((it) => letterAt(it, TODAY)), p.map((it) => letterAt(it, cutsFor(tier, g)))));
        if (!cs.every((c) => barFor(c).pass)) continue;
        const gain = Math.min(...cs.map((c) => c.exactA - c.exactB));
        if (best === null || gain > best.gain) best = { g, gain };
      }
      if (best && best.gain > 0) pick[tier] = best.g;
      console.log(`  ${tier}: ${best ? `cut ${best.g} (min exact gain ${best.gain})` : 'no cut passes on both runs'} -> ${pick[tier]}`);
    }
    if (sn === 'combined') Object.assign(picks, pick);
    const useCuts = sn === 'combined' ? pick : picks;
    if (sn === 'buildset') console.log(`  (buildset joint below uses the cuts picked on combined: ${JSON.stringify(useCuts)})`);
    for (const rn of ['run1', 'run2']) {
      const items = s.runs[rn];
      const base = lettersFor(items, () => TODAY);
      console.log(`  joint best-picks ${sn} ${rn}:`);
      ledgerLines('best-picks', items, base, lettersFor(items, () => useCuts));
      console.log(`  joint rwxlite set ${sn} ${rn}:`);
      ledgerLines('rwxlite', items, base, lettersFor(items, () => RWXLITE));
    }

    // LOVO
    console.log('');
    console.log(`=== 5. ${sn}: LOVO per tier (cut picked on the other vendors; pooled over held-out vendors) ===`);
    const lovoRes = {};
    for (const rn of ['run1', 'run2']) {
      const items = s.runs[rn];
      lovoRes[rn] = {};
      for (const tier of TIERS) {
        const pile = items.filter((it) => it.tier === tier);
        if (!pile.length) continue;
        const { cutOf, folds } = lovoTier(pile, tier);
        lovoRes[rn][tier] = cutOf;
        const base = pile.map((it) => letterAt(it, TODAY));
        const after = pile.map((it) => letterAt(it, { ...TODAY, [tier]: cutOf.get(it) }));
        const c = compare(pile, base, after);
        const bar = barFor(c);
        const dist = {};
        for (const f of folds) dist[f.cut] = (dist[f.cut] || 0) + 1;
        const vend = new Set(pile.map((it) => it.row.provider)).size;
        console.log(`  ${rn} ${tier}: folds ${vend} vendors, picked cut counts ${JSON.stringify(dist)}; pooled moved ${c.moved} of ${c.n}; right ${c.right}, wrong ${c.wrong}, other ${c.other}; ratio ${fr(ratio(c.right, c.wrong))}; leaks ${c.leakB}->${c.leakA}, over ${c.overB}->${c.overA}; bar(${bar.dir}) ${bar.dir === 'none' ? 'NO MOVE (stays at today)' : bar.pass ? 'PASS' : 'FAIL'}`);
      }
    }
    console.log('  pass/fail per tier (both runs, LOVO pooled):');
    const verdictOf = {};
    for (const tier of TIERS) {
      if (!lovoRes.run1[tier]) {
        console.log(`    ${tier}: not measurable on ${sn}`);
        continue;
      }
      const res = ['run1', 'run2'].map((rn) => {
        const pile = s.runs[rn].filter((it) => it.tier === tier);
        const cutOf = lovoRes[rn][tier];
        const c = compare(pile, pile.map((it) => letterAt(it, TODAY)), pile.map((it) => letterAt(it, { ...TODAY, [tier]: cutOf.get(it) })));
        return barFor(c);
      });
      const ok = res.every((b) => b.pass);
      verdictOf[tier] = ok;
      console.log(`    ${tier}: ${ok ? 'PASS' : 'FAIL (or no move)'} [run1 ${res[0].dir}/${res[0].pass ? 'pass' : 'fail'}, run2 ${res[1].dir}/${res[1].pass ? 'pass' : 'fail'}]`);
    }
    // joint LOVO
    for (const rn of ['run1', 'run2']) {
      const items = s.runs[rn];
      const base = lettersFor(items, () => TODAY);
      const after = items.map((it, i) => {
        if (!it.tier || !lovoRes[rn][it.tier]) return base[i];
        return letterAt(it, { ...TODAY, [it.tier]: lovoRes[rn][it.tier].get(it) });
      });
      console.log(`  joint LOVO (all tiers at their LOVO picks) ${sn} ${rn}:`);
      ledgerLines('LOVO-joint', items, base, after);
      if (sn === 'combined') {
        // 6. rows changed
        const changed = items.map((it, i) => ({ it, i })).filter(({ i }) => base[i] !== after[i]);
        const other = s.runs[rn === 'run1' ? 'run2' : 'run1'];
        let show = changed;
        let note = '';
        if (changed.length > 120) {
          const wrong = changed.filter(({ it, i }) => {
            const looser = RANK[after[i]] < RANK[base[i]];
            const oa = outcome(after[i], it.truth);
            const ob = outcome(base[i], it.truth);
            return !(ob !== 'exact' && oa === 'exact') && ((looser && oa === 'leak' && ob !== 'leak') || (!looser && oa === 'over' && ob !== 'over'));
          });
          const right = changed.filter(({ it, i }) => outcome(base[i], it.truth) !== 'exact' && outcome(after[i], it.truth) === 'exact').slice(0, 40);
          show = [...wrong, ...right];
          note = ` (>120: showing all ${wrong.length} wrong + first ${right.length} right; ${changed.length - show.length} others not shown)`;
        }
        console.log('');
        console.log(`=== 6. ${rn}: rows whose letter changes at LOVO-picked cuts vs today: ${changed.length}${note} ===`);
        console.log('  row_id | provider | method | path | operationId | truth | before | after | pIsX | pChanges | (other run pIsX, pChanges)');
        for (const { it, i } of show) {
          const o = other[i];
          console.log(`  ${it.row.row_id} | ${it.row.provider} | ${it.row.method} | ${it.row.path} | ${it.row.operationId} | ${it.truth} | ${base[i]} | ${after[i]} | ${it.pX} | ${it.pC} | (${o.pX}, ${o.pC})`);
        }
      }
    }

    // 7. F3
    if (sn === 'combined') {
      console.log('');
      console.log('=== 7. F3: POST truth-w rows at x today (floor-post, isX not <= 0.10) that move at each lower cut; the new leaks it costs ===');
      for (const rn of ['run1', 'run2']) {
        const pile = s.runs[rn].filter((it) => it.tier === 'jev-lower');
        const todayL = pile.map((it) => letterAt(it, TODAY));
        const f3 = pile.filter((it, i) => it.row.method === 'POST' && it.truth === 'w' && todayL[i] === 'x');
        const inRange = f3.filter((it) => it.pX !== null && it.pX >= 0.2 && it.pX <= 0.57).length;
        const noAns = f3.filter((it) => it.pX === null).length;
        console.log(`  ${rn}: ${f3.length} POST truth-w rows sit at x today (of ${pile.length} lower-pile rows; ${noAns} have no usable answer); ${inRange} of them have isX p in 0.20-0.57 (rwxlite's F3 band)`);
        const base = pile.map((it) => letterAt(it, TODAY));
        for (const g of GRID['jev-lower']) {
          const after = pile.map((it) => letterAt(it, cutsFor('jev-lower', g)));
          const c = compare(pile, base, after);
          const toW = f3.filter((it) => letterAt(it, cutsFor('jev-lower', g)) === 'w').length;
          const toR = f3.filter((it) => letterAt(it, cutsFor('jev-lower', g)) === 'r').length;
          const newLeakTx = pile.filter((it, i) => it.truth === 'x' && base[i] === 'x' && after[i] !== 'x').length;
          console.log(`    cut ${g.toFixed(2)}: F3 rows -> w ${toW} (fixed), -> r ${toR} (new leak); of the ${c.moved} pile rows moved: right ${c.right}, wrong ${c.wrong} (of which truth-x rows newly lowered ${newLeakTx}); pile leaks ${c.leakB}->${c.leakA}`);
        }
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
