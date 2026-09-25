// poc/jev-tiers/score.mjs — scores one D95 tier against its own pile.
//
// Usage: node score.mjs <lower|raise-wx|raise-get> <rows.json.gz> <answers.jsonl>
//
// The three tiers are INDEPENDENT (D95): each reads only its own pile, may
// make only its own one-way move, and keeps its OWN ledger. Nothing here
// mixes two tiers, and no line is printed as a single blended accuracy
// number. A move in any direction other than the tier's own is a BUG, not a
// result — assertMove throws rather than scoring it.
//
// Fail-closed, mirroring src/jev.js's applyJev: a missing, errored or
// malformed answer leaves the verdict exactly as the mechanical flow left it.
import fs from 'node:fs';
import zlib from 'node:zlib';

const RANK = { r: 0, w: 1, x: 2 };
export const BAR = 10;

/**
 * The three tiers. `from` is the class the mechanical flow gives every row in
 * the pile; `to` is the only class this tier may move a row to; `direction`
 * is the only direction it may move in.
 */
export const TIERS = {
  lower: {
    question: 'isX',
    from: 'x',
    to: ['w'],
    direction: 'lower',
    // lower when p(x) is at or under t: Jev is at least (1-t) sure it is w.
    thresholds: [0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5],
    win: 'over-tight rows fixed',
    harm: 'new leaks',
    ratioName: 'over-tight fixed per new leak',
  },
  'raise-wx': {
    question: 'isX',
    from: 'w',
    to: ['x'],
    direction: 'raise',
    // raise when p(x) is at or above t.
    thresholds: [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98],
    win: 'leaks closed',
    harm: 'false alarms created',
    ratioName: 'leaks closed per false alarm',
  },
  'raise-get': {
    question: 'changes',
    from: 'r',
    to: ['w', 'x'],
    direction: 'raise',
    // raise when p(changes) is at or above t.
    thresholds: [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98],
    win: 'leaks closed',
    harm: 'false alarms created',
    ratioName: 'leaks closed per false alarm',
  },
};

/** r < w < x. 'exact', 'leak' (too loose) or 'over-tight'. */
export function outcome(pred, truth) {
  if (RANK[pred] === undefined || RANK[truth] === undefined) throw new Error(`bad class ${pred}/${truth}`);
  if (RANK[pred] === RANK[truth]) return 'exact';
  return RANK[pred] < RANK[truth] ? 'leak' : 'over-tight';
}

/**
 * The move a tier is allowed to make. Throws on any other direction — a
 * lowering tier that raises, or a raising tier that lowers, is a bug in this
 * file, never a number to report.
 * @param {string} tier
 * @param {string} from
 * @param {string} to
 */
export function assertMove(tier, from, to) {
  const spec = TIERS[tier];
  if (!spec) throw new Error(`unknown tier ${tier}`);
  if (RANK[from] === undefined || RANK[to] === undefined) throw new Error(`bad class ${from}->${to}`);
  if (from !== spec.from) throw new Error(`tier ${tier} moves from ${spec.from}, got ${from}`);
  if (!spec.to.includes(to)) throw new Error(`tier ${tier} may only move to ${spec.to.join('/')}, got ${to}`);
  const dir = RANK[to] > RANK[from] ? 'raise' : RANK[to] < RANK[from] ? 'lower' : 'none';
  if (dir !== spec.direction) throw new Error(`tier ${tier} may only ${spec.direction}, ${from}->${to} is a ${dir}`);
  return true;
}

/**
 * The model's p for this tier's question, or null when the answer is missing,
 * errored or malformed. Fail-closed: null means no move.
 * @param {object|undefined} out one JSONL line
 * @param {string} key question key
 * @returns {number|null}
 */
export function answerP(out, key) {
  if (!out || typeof out !== 'object') return null;
  if (out.error) return null;
  const a = out.answers && out.answers[key];
  if (!a || typeof a !== 'object') return null;
  const p = a.noul;
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return null;
  return p;
}

/**
 * The class this tier gives a row at threshold t. Returns the mechanical
 * class unchanged whenever the answer is unusable or the threshold is not
 * met.
 * @param {string} tier
 * @param {number|null} p
 * @param {number} t
 * @param {string} [raiseTo] which class a raise-get raise lands on ('w' or 'x')
 */
export function applyTier(tier, p, t, raiseTo) {
  const spec = TIERS[tier];
  if (!spec) throw new Error(`unknown tier ${tier}`);
  if (p === null) return spec.from; // fail closed
  const to = spec.to.length === 1 ? spec.to[0] : raiseTo;
  if (to === undefined) throw new Error(`tier ${tier} needs a raiseTo (${spec.to.join('/')})`);
  const fires = spec.direction === 'lower' ? p <= t : p >= t;
  if (!fires) return spec.from;
  assertMove(tier, spec.from, to);
  return to;
}

// ---- reporting ------------------------------------------------------------

function pct(n, denom) {
  return denom === 0 ? '0.0%' : `${((100 * n) / denom).toFixed(1)}%`;
}

/** This tier's own ledger over its own pile. Never blended with another tier. */
export function ledger(preds, truths) {
  const l = { n: preds.length, exact: 0, leak: 0, overTight: 0 };
  for (let i = 0; i < preds.length; i += 1) {
    const o = outcome(preds[i], truths[i]);
    if (o === 'exact') l.exact += 1;
    else if (o === 'leak') l.leak += 1;
    else l.overTight += 1;
  }
  return l;
}

function printLedger(label, l) {
  console.log(`  ${label}`);
  console.log(`    n            = ${l.n} rows (this tier's pile only)`);
  console.log(`    exact        = ${l.exact} of ${l.n} rows (${pct(l.exact, l.n)} of this tier's ${l.n} pile rows)`);
  console.log(`    leaks        = ${l.leak} of ${l.n} rows (${pct(l.leak, l.n)} of this tier's ${l.n} pile rows) [too loose]`);
  console.log(`    over-tight   = ${l.overTight} of ${l.n} rows (${pct(l.overTight, l.n)} of this tier's ${l.n} pile rows)`);
}

function readJson(p) {
  const buf = fs.readFileSync(p);
  const json = p.endsWith('.gz') ? zlib.gunzipSync(buf) : buf;
  return JSON.parse(json.toString('utf8'));
}

function readJsonl(p) {
  const buf = fs.readFileSync(p);
  const text = (p.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8');
  const map = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      map.set(o.row_id, o);
    } catch {
      /* partial final line from a kill; the row stays unanswered = fail closed */
    }
  }
  return map;
}

function main() {
  const [, , tier, rowsPath, outPath] = process.argv;
  if (!tier || !rowsPath || !outPath || !TIERS[tier]) {
    console.error('usage: node score.mjs <lower|raise-wx|raise-get> <rows.json[.gz]> <answers.jsonl>');
    process.exit(2);
  }
  const spec = TIERS[tier];
  const rows = readJson(rowsPath);
  const answers = readJsonl(outPath);

  for (const row of rows) {
    if (!['r', 'w', 'x'].includes(row.truth)) throw new Error(`row ${row.row_id} has no truth`);
    row.p = answerP(answers.get(row.row_id), spec.question);
  }
  const usable = rows.filter((r) => r.p !== null).length;
  const unusable = rows.length - usable;

  console.log(`tier ${tier}: moves ${spec.from} -> ${spec.to.join(' or ')} only (${spec.direction}), question "${spec.question}"`);
  console.log(`rows: ${rows.length} in this pile, ${usable} with a usable answer, ${unusable} missing/malformed (fail closed: stay ${spec.from})`);
  const truthCounts = { r: 0, w: 0, x: 0 };
  for (const r of rows) truthCounts[r.truth] += 1;
  console.log(
    `truth in this pile (r < w < x): r=${truthCounts.r} (${pct(truthCounts.r, rows.length)} of ${rows.length}), w=${truthCounts.w} (${pct(truthCounts.w, rows.length)} of ${rows.length}), x=${truthCounts.x} (${pct(truthCounts.x, rows.length)} of ${rows.length})`,
  );
  console.log('');

  const truths = rows.map((r) => r.truth);
  const base = ledger(rows.map(() => spec.from), truths);
  console.log('=== Mechanical baseline (no Jev) ===');
  printLedger(`every row stays ${spec.from}`, base);
  console.log('');

  for (const raiseTo of spec.to) {
    if (spec.to.length > 1) console.log(`=== Threshold sweep — raise ${spec.from} -> ${raiseTo} ===`);
    else console.log(`=== Threshold sweep — ${spec.direction} ${spec.from} -> ${raiseTo} ===`);
    console.log(
      `  (no threshold can be pinned from one run: Jev is non-deterministic. Bar: ${BAR} ${spec.ratioName}.)`,
    );
    for (const t of spec.thresholds) {
      const preds = rows.map((r) => applyTier(tier, r.p, t, raiseTo));
      const l = ledger(preds, truths);
      let moved = 0;
      let win = 0;
      let harm = 0;
      for (let i = 0; i < rows.length; i += 1) {
        if (preds[i] === spec.from) continue;
        moved += 1;
        const before = outcome(spec.from, truths[i]);
        const after = outcome(preds[i], truths[i]);
        if (before !== 'exact' && after === 'exact') win += 1;
        if (before === 'exact' && after !== 'exact') harm += 1;
      }
      const ratio = win / Math.max(harm, 1);
      console.log('');
      printLedger(
        `t=${t.toFixed(2)}  moved=${moved} of ${rows.length} pile rows (${pct(moved, rows.length)} of ${rows.length})`,
        l,
      );
      console.log(
        `    ${spec.win} = ${win}; ${spec.harm} = ${harm}; ratio = ${ratio.toFixed(2)} ${spec.ratioName} (bar ${BAR}: ${ratio >= BAR ? 'PASS' : 'fail'})`,
      );
      console.log(
        `    vs baseline: leaks ${base.leak} -> ${l.leak} (${l.leak - base.leak >= 0 ? '+' : ''}${l.leak - base.leak}), over-tight ${base.overTight} -> ${l.overTight} (${l.overTight - base.overTight >= 0 ? '+' : ''}${l.overTight - base.overTight}), exact ${base.exact} -> ${l.exact} (${l.exact - base.exact >= 0 ? '+' : ''}${l.exact - base.exact}), all of ${rows.length} pile rows`,
      );
    }
    console.log('');
  }

  // Calibration: how the model's p lines up with truth inside this pile.
  console.log('=== Calibration: p bucket -> n, truth share (r < w < x) ===');
  const buckets = Array.from({ length: 10 }, () => ({ n: 0, r: 0, w: 0, x: 0 }));
  for (const r of rows) {
    if (r.p === null) continue;
    const idx = Math.min(9, Math.floor(r.p * 10));
    buckets[idx].n += 1;
    buckets[idx][r.truth] += 1;
  }
  for (let i = 0; i < 10; i += 1) {
    const b = buckets[i];
    console.log(
      `  [${(i / 10).toFixed(1)},${((i + 1) / 10).toFixed(1)})  n=${String(b.n).padStart(4)}  r=${String(b.r).padStart(4)} (${pct(b.r, b.n)} of ${b.n})  w=${String(b.w).padStart(4)} (${pct(b.w, b.n)} of ${b.n})  x=${String(b.x).padStart(4)} (${pct(b.x, b.n)} of ${b.n})`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
