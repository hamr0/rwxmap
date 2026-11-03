// poc/f1-post-r/score.mjs — F1 POC: on jev-lower's floor-post pile, ALSO ask
// the "changes" question so a POST read can drop x -> r, not only x -> w.
//
// Tuning numbers only. Truth: data/combined-2026-09-21/labelled.csv (6557
// rows). The floor-post pile is found by running src's classifyRow
// (read-only import) over those rows. Answers:
//   isX     data/jev-tiers-2026-09-23/out-lower{,-run2}.jsonl   (criteria-x)
//   changes data/f1-post-r-2026-11-03/out-changes-run{1,2}.jsonl (criteria-changes)
// Run 1 pairs isX run 1 with changes run 1; run 2 pairs the two run-2 files.
// The runs are never averaged.
//
// Decision rules (both fail closed: a missing/errored/malformed answer never
// moves a row):
//   A  p_isX <= 0.10 -> w; then, only if lowered, p_changes <= T -> r
//   B  p_changes <= T -> r regardless of isX; else p_isX <= 0.10 -> w
//
// Usage: node poc/f1-post-r/score.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../tools/csv.js';
import { classifyRow } from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

export const RANK = { r: 0, w: 1, x: 2 };
export const T_LOWER = 0.1;
export const T_R = [0.05, 0.1, 0.15, 0.2, 0.3, 0.5];
export const BAR = 10;
export const VARIANTS = ['A', 'B'];

/** 'exact' | 'leak' (too loose) | 'over' (too tight). */
export function outcome(pred, truth) {
  if (RANK[pred] === undefined || RANK[truth] === undefined) throw new Error(`bad class ${pred}/${truth}`);
  if (pred === truth) return 'exact';
  return RANK[pred] < RANK[truth] ? 'leak' : 'over';
}

/** A Noul p in [0,1], or null (fail closed). */
export function answerP(out, key) {
  if (!out || typeof out !== 'object' || out.error) return null;
  const a = out.answers && out.answers[key];
  const p = a && typeof a === 'object' ? a.noul : undefined;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return null;
  return p;
}

/** Today's jev-lower on a floor-post row (mechanical x). */
export function baseline(pX) {
  return pX !== null && pX <= T_LOWER ? 'w' : 'x';
}

/** F1 on a floor-post row. Never raises above x; never moves on a null answer. */
export function applyF1(variant, pX, pC, t) {
  const lowered = baseline(pX);
  const readByChanges = pC !== null && pC <= t;
  if (variant === 'A') return lowered === 'w' && readByChanges ? 'r' : lowered;
  if (variant === 'B') return readByChanges ? 'r' : lowered;
  throw new Error(`unknown variant ${variant}`);
}

/** Exact / leak / over over parallel arrays. */
export function ledger(preds, truths) {
  const l = { n: preds.length, exact: 0, leak: 0, over: 0 };
  for (let i = 0; i < preds.length; i += 1) l[outcome(preds[i], truths[i])] += 1;
  return l;
}

/**
 * The moves to r F1 makes over the baseline, on pile rows.
 * right = truth r. wrong = truth w or x, split; truth-x rows split again into
 * fresh leaks (baseline x, exact) and deepened leaks (baseline w, already a leak).
 */
export function moves(rows, variant, t) {
  const m = { moved: 0, right: 0, wrongW: 0, wrongX: 0, wrongXfresh: 0, wrongXdeepened: 0, list: [] };
  for (const r of rows) {
    const after = applyF1(variant, r.pX, r.pC, t);
    if (after !== 'r') continue;
    m.moved += 1;
    m.list.push(r);
    if (r.truth === 'r') m.right += 1;
    else if (r.truth === 'w') m.wrongW += 1;
    else {
      m.wrongX += 1;
      if (baseline(r.pX) === 'w') m.wrongXdeepened += 1;
      else m.wrongXfresh += 1;
    }
  }
  m.wrong = m.wrongW + m.wrongX;
  return m;
}

/** right / wrong; Infinity when wrong is 0 and right > 0. */
export function ratio(right, wrong) {
  if (wrong === 0) return right > 0 ? Infinity : 0;
  return right / wrong;
}

/**
 * Pick T: the largest T in T_R whose ratio on `rows` meets BAR and moves at
 * least one row. null when none does (F1 then moves nothing).
 */
export function pickT(rows, variant) {
  let best = null;
  for (const t of T_R) {
    const m = moves(rows, variant, t);
    if (m.moved > 0 && ratio(m.right, m.wrong) >= BAR) best = t;
  }
  return best;
}

/** Leave-one-vendor-out: pick T on the other vendors, score the held-out one. */
export function lovo(rows, variant) {
  const vendors = [...new Set(rows.map((r) => r.provider))].sort();
  const folds = [];
  const pooled = { moved: 0, right: 0, wrongW: 0, wrongX: 0, wrong: 0 };
  for (const v of vendors) {
    const train = rows.filter((r) => r.provider !== v);
    const test = rows.filter((r) => r.provider === v);
    const t = pickT(train, variant);
    const m = t === null ? { moved: 0, right: 0, wrongW: 0, wrongX: 0, wrong: 0 } : moves(test, variant, t);
    folds.push({ vendor: v, n: test.length, t, ...m });
    for (const k of Object.keys(pooled)) pooled[k] += m[k];
  }
  return { folds, pooled };
}

// ---- reporting ------------------------------------------------------------

const pct = (n, d) => (d === 0 ? '0.0%' : `${((100 * n) / d).toFixed(1)}%`);
const sgn = (n) => (n >= 0 ? `+${n}` : `${n}`);
const fmtRatio = (x) => (x === Infinity ? 'inf' : x.toFixed(2));

function fmtLedger(l, label) {
  return `${l.exact} exact (${pct(l.exact, l.n)}) / ${l.leak} too loose (${pct(l.leak, l.n)}) / ${l.over} too tight (${pct(l.over, l.n)}), of ${l.n} ${label}`;
}

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

function loadRun(name, isXFile, changesFile, all, pileIds) {
  const isX = readJsonl(isXFile);
  const ch = readJsonl(changesFile);
  const models = {};
  const skip = { isXMissing: 0, isXUnusable: 0, chMissing: 0, chUnusable: 0 };
  for (const [src, label] of [[isX, 'isX'], [ch, 'changes']]) {
    for (const o of src.map.values()) {
      const k = `${label}:${o.model ?? '(none)'}`;
      models[k] = (models[k] || 0) + 1;
    }
  }
  const extraIsX = [...isX.map.keys()].filter((id) => !pileIds.has(id)).length;
  const extraCh = [...ch.map.keys()].filter((id) => !pileIds.has(id)).length;
  const pile = [];
  for (const row of all) {
    if (!pileIds.has(row.row_id)) continue;
    const ox = isX.map.get(row.row_id);
    const oc = ch.map.get(row.row_id);
    const pX = answerP(ox, 'isX');
    const pC = answerP(oc, 'changes');
    if (!ox) skip.isXMissing += 1;
    else if (pX === null) skip.isXUnusable += 1;
    if (!oc) skip.chMissing += 1;
    else if (pC === null) skip.chUnusable += 1;
    pile.push({ ...row, truth: row.truth_class, pX, pC });
  }
  console.log(`--- ${name}: ${path.relative(ROOT, isXFile)} + ${path.relative(ROOT, changesFile)}`);
  console.log(`  unparseable JSONL lines: isX ${isX.bad}, changes ${ch.bad}`);
  console.log(`  answers whose row_id is not in this pile (ignored): isX ${extraIsX}, changes ${extraCh}`);
  console.log(
    `  pile rows without a usable answer (fail closed, never moved): isX missing ${skip.isXMissing}, isX errored/malformed ${skip.isXUnusable}, changes missing ${skip.chMissing}, changes errored/malformed ${skip.chUnusable}`,
  );
  console.log(`  model versions seen: ${JSON.stringify(models)}`);
  return pile;
}

function report(name, pile, all, mech) {
  const pileIds = new Set(pile.map((r) => r.row_id));
  const byId = new Map(pile.map((r) => [r.row_id, r]));
  const truthsAll = all.map((r) => r.truth_class);
  const truthsPile = pile.map((r) => r.truth);

  const baseAll = all.map((r, i) => (pileIds.has(r.row_id) ? baseline(byId.get(r.row_id).pX) : mech[i]));
  const lb = ledger(pile.map((r) => baseline(r.pX)), truthsPile);
  const la = ledger(baseAll, truthsAll);
  console.log('');
  console.log(`=== ${name}: baseline (today: mechanical + jev-lower at ${T_LOWER}; other Jev tiers not applied) ===`);
  console.log(`  pile:     ${fmtLedger(lb, 'floor-post pile rows')}`);
  console.log(`  all 6557: ${fmtLedger(la, 'combined rows')}`);

  const out = {};
  for (const variant of VARIANTS) {
    console.log('');
    console.log(`=== ${name}: variant ${variant} sweep ===`);
    out[variant] = {};
    for (const t of T_R) {
      const m = moves(pile, variant, t);
      const predAll = all.map((r, i) => (pileIds.has(r.row_id) ? applyF1(variant, byId.get(r.row_id).pX, byId.get(r.row_id).pC, t) : mech[i]));
      const lp = ledger(pile.map((r) => applyF1(variant, r.pX, r.pC, t)), truthsPile);
      const lA = ledger(predAll, truthsAll);
      out[variant][t] = m;
      const rt = ratio(m.right, m.wrong);
      console.log(
        `  T_r=${t.toFixed(2)}  moved to r ${m.moved} of ${pile.length} pile rows (${pct(m.moved, pile.length)}); right (truth r) ${m.right} (${pct(m.right, m.moved)} of ${m.moved} moved); wrong truth w ${m.wrongW}, wrong truth x ${m.wrongX} (fresh ${m.wrongXfresh}, already-leaking w->r ${m.wrongXdeepened}); ratio right/wrong ${fmtRatio(rt)} (bar ${BAR}: ${rt >= BAR ? 'PASS' : 'fail'})`,
      );
      console.log(`      pile:     ${fmtLedger(lp, 'pile rows')}`);
      console.log(`      all 6557: ${fmtLedger(lA, 'combined rows')}`);
      const implied = m.wrongW + m.wrongXfresh;
      console.log(
        `      too loose on 6557: ${la.leak} -> ${lA.leak} (${sgn(lA.leak - la.leak)}); implied by wrong moves = truth-w ${m.wrongW} + fresh truth-x ${m.wrongXfresh} = ${implied} (${lA.leak - la.leak === implied ? 'matches' : 'MISMATCH'}); ${m.wrongXdeepened} truth-x rows already too loose at w go deeper to r`,
      );
    }
  }
  return out;
}

function main() {
  const all = parseCsv(fs.readFileSync(path.join(ROOT, 'data/combined-2026-09-21/labelled.csv'), 'utf8'));
  if (all.length !== 6557) throw new Error(`expected 6557 combined rows, got ${all.length}`);
  let badTruth = 0;
  for (const r of all) if (!(r.truth_class in RANK)) badTruth += 1;
  if (badTruth) throw new Error(`${badTruth} rows with an invalid truth_class`);
  const verdicts = all.map((r) => classifyRow(r));
  const mech = verdicts.map((v) => v.class);
  const pileIds = new Set(all.filter((r, i) => verdicts[i].rule === 'floor-post').map((r) => r.row_id));
  verdicts.forEach((v, i) => {
    if (v.rule === 'floor-post' && v.class !== 'x') throw new Error(`floor-post row ${all[i].row_id} is not x`);
  });

  console.log(`combined rows: ${all.length}; floor-post pile (classifyRow rule 'floor-post'): ${pileIds.size}; rows outside the pile keep their mechanical class`);
  const tm = { r: 0, w: 0, x: 0 };
  const methods = {};
  for (const r of all) {
    if (!pileIds.has(r.row_id)) continue;
    tm[r.truth_class] += 1;
    methods[r.method] = (methods[r.method] || 0) + 1;
  }
  const n = pileIds.size;
  console.log(`pile truth: r ${tm.r} (${pct(tm.r, n)} of ${n}), w ${tm.w} (${pct(tm.w, n)} of ${n}), x ${tm.x} (${pct(tm.x, n)} of ${n}); methods ${JSON.stringify(methods)}`);
  console.log('');

  const D1 = path.join(ROOT, 'data/jev-tiers-2026-09-23');
  const D2 = path.join(ROOT, 'data/f1-post-r-2026-11-03');
  const runs = {
    run1: loadRun('run1', path.join(D1, 'out-lower.jsonl'), path.join(D2, 'out-changes-run1.jsonl'), all, pileIds),
    run2: loadRun('run2', path.join(D1, 'out-lower-run2.jsonl'), path.join(D2, 'out-changes-run2.jsonl'), all, pileIds),
  };

  const sweeps = {};
  for (const [name, pile] of Object.entries(runs)) sweeps[name] = report(name, pile, all, mech);

  // LOVO
  for (const variant of VARIANTS) {
    for (const [name, pile] of Object.entries(runs)) {
      const { folds, pooled } = lovo(pile, variant);
      console.log('');
      console.log(`=== LOVO ${name} variant ${variant}: T_r picked on the other vendors = largest T with right/wrong >= ${BAR} (none -> no moves) ===`);
      for (const f of folds) {
        console.log(
          `  ${f.vendor.padEnd(14)} n=${String(f.n).padStart(4)}  T_r=${f.t === null ? 'none' : f.t.toFixed(2)}  moved ${f.moved}  right ${f.right}  wrong w ${f.wrongW}  wrong x ${f.wrongX}`,
        );
      }
      const rt = ratio(pooled.right, pooled.wrong);
      console.log(
        `  POOLED: moved ${pooled.moved} of ${pile.length} pile rows; right ${pooled.right} (${pct(pooled.right, pooled.moved)} of ${pooled.moved} moved); wrong w ${pooled.wrongW}, wrong x ${pooled.wrongX}; ratio ${fmtRatio(rt)} (bar ${BAR}: ${rt >= BAR ? 'PASS' : 'fail'})`,
      );
    }
  }

  // Chosen T per variant: in-sample pick per run; the smaller of the two if they differ.
  for (const variant of VARIANTS) {
    const p1 = pickT(runs.run1, variant);
    const p2 = pickT(runs.run2, variant);
    let chosen = p1 === null || p2 === null ? null : Math.min(p1, p2);
    let note = 'smaller of the two in-sample picks';
    if (chosen === null) {
      // No T passes on both runs: list wrong moves at the T with the best run-1 ratio, for reading.
      let best = T_R[0];
      let br = -1;
      for (const t of T_R) {
        const m = sweeps.run1[variant][t];
        const r = m.moved ? ratio(m.right, m.wrong) : -1;
        if (r > br) {
          br = r;
          best = t;
        }
      }
      chosen = best;
      note = `NO T passes on both runs (run1 pick ${p1}, run2 pick ${p2}); listing at the best run-1 ratio instead`;
    }
    console.log('');
    console.log(`=== variant ${variant}: chosen T_r = ${chosen.toFixed(2)} (${note}; run1 pick ${p1}, run2 pick ${p2}) ===`);
    const r1 = new Map(runs.run1.map((r) => [r.row_id, r]));
    const r2 = new Map(runs.run2.map((r) => [r.row_id, r]));
    let flips = 0;
    let flipR1only = 0;
    let flipR2only = 0;
    let bothR = 0;
    for (const [id, a] of r1) {
      const b = r2.get(id);
      const ra = applyF1(variant, a.pX, a.pC, chosen) === 'r';
      const rb = applyF1(variant, b.pX, b.pC, chosen) === 'r';
      if (ra && rb) bothR += 1;
      if (ra !== rb) {
        flips += 1;
        if (ra) flipR1only += 1;
        else flipR2only += 1;
      }
    }
    console.log(
      `  run1 vs run2 at T_r=${chosen.toFixed(2)}: ${flips} of ${r1.size} pile rows flip the r decision (${flipR1only} r only in run1, ${flipR2only} r only in run2); ${bothR} r on both`,
    );
    for (const name of ['run1', 'run2']) {
      const m = moves(runs[name], variant, chosen);
      const wrong = m.list.filter((r) => r.truth !== 'r');
      console.log(`  ${name} wrong moves at T_r=${chosen.toFixed(2)}: ${wrong.length} of ${m.moved} moved`);
      const other = name === 'run1' ? r2 : r1;
      for (const r of wrong) {
        const o = other.get(r.row_id);
        console.log(
          `    ${r.row_id}\t${r.provider}\t${r.method}\t${r.path}\t${r.operationId}\ttruth=${r.truth}\tp_isX=${r.pX}\tp_changes=${r.pC}\t(other run: p_isX=${o.pX} p_changes=${o.pC})\t${(r.summary || '').slice(0, 80)}`,
        );
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
