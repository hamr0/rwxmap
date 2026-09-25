// poc/d87/fragile.mjs — prices the 13 CANT_UNDO members poc/d87/lovo3.mjs
// found fragile under leave-three-vendors-out (execute, run, void dropped
// in ~87% of the 1771 folds; complete, capture, dismiss, expire, pay,
// refund, resend, reset, simulate, trigger dropped in ~24%). Answers what
// each one actually earns on the current lists, and what changes — per
// member alone, and with all 13 removed together — mechanically and with
// Jev, fitted and under leave-one/leave-three-vendor-out. Run:
//   node poc/d87/fragile.mjs
//
// Reuses poc/d87/readout.mjs's truth loading (loadRows/loadV3Truth/
// attachTruth) and poc/d87/lovo3.mjs's fold machinery (per-member/
// per-provider aggregation, the SAME adoption rules for rebuilding
// CANT_UNDO/KEEP_W, the SAME leave-three-out triple generation) — copied
// rather than imported, because neither file exports anything (both are
// run-as-main scripts), exactly the same relationship lovo3.mjs has to
// readout.mjs's loaders. Classifies via src/flow.js's classifyRow(row,
// words) and lowers via src/jev.js's applyJev/needsJev, against the
// recorded answers in data/jev-2026-09-22/out-floor.jsonl.gz — this
// measures src/, not a poc/ copy of it.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { matchingMembers, verbForRow } from '../../src/tokens.js';
import { CANT_UNDO } from '../../src/step2.js';
import { KEEP_W } from '../../src/step3.js';
import { classifyRow } from '../../src/flow.js';
import { applyJev, needsJev } from '../../src/jev.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const RANK = { r: 0, w: 1, x: 2 };
const CANT_UNDO_FULL = [...CANT_UNDO].sort();
const KEEP_W_FULL = [...KEEP_W].sort();

// The 13 members poc/d87/lovo3.mjs flagged fragile.
const FRAGILE = [
  'execute', 'run', 'void', 'complete', 'capture', 'dismiss', 'expire',
  'pay', 'refund', 'resend', 'reset', 'simulate', 'trigger',
].sort();
const FRAGILE_SET = new Set(FRAGILE);
for (const m of FRAGILE) {
  if (!CANT_UNDO.has(m)) throw new Error(`fragile member ${m} is not in CANT_UNDO`);
}
const REDUCED = new Set(CANT_UNDO_FULL.filter((m) => !FRAGILE_SET.has(m)));
const REDUCED_LIST = [...REDUCED].sort();

function outcome(pred, truth) {
  if (RANK[pred] === RANK[truth]) return 'exact';
  return RANK[pred] < RANK[truth] ? 'leak' : 'over-tight';
}

function pct(n, denom) {
  return denom === 0 ? '0.0%' : `${((100 * n) / denom).toFixed(1)}%`;
}

function line(...cells) {
  console.log(cells.join('  '));
}

// --- truth loading, identical to poc/d87/readout.mjs ----------------------

function loadRows() {
  const gzPath = path.join(ROOT, 'data', 'combined-2026-09-21', 'rows.json.gz');
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(gzPath)));
}

function loadV3Truth() {
  const dir = path.join(ROOT, 'data', 'relabel-2026-09-22', 'label');
  const truth = new Map();
  for (let i = 1; i <= 9; i += 1) {
    const p = path.join(dir, `labels-${i}.csv`);
    const lines = fs.readFileSync(p, 'utf8').trim().split('\n').slice(1);
    for (const l of lines) {
      const parts = l.split(',');
      truth.set(parts[0], parts[1]);
    }
  }
  const rulingsPath = path.join(dir, 'rulings.csv');
  const rulingLines = fs.readFileSync(rulingsPath, 'utf8').trim().split('\n').slice(1);
  for (const l of rulingLines) {
    const parts = l.split(',');
    truth.set(parts[0], parts[2]);
  }
  return truth;
}

function attachTruth(rows, v3Truth) {
  for (const row of rows) {
    if (row.truth === 'r') {
      row.truthClass = 'r';
      continue;
    }
    const v3 = v3Truth.get(row.row_id);
    if (v3 === undefined) throw new Error(`no v3 label for non-r row ${row.row_id}`);
    if (!['r', 'w', 'x'].includes(v3)) throw new Error(`row ${row.row_id} has invalid v3 label ${v3}`);
    row.truthClass = v3;
  }
}

// --- Jev answers, identical to poc/d87/lovo3.mjs ---------------------------

function loadJevAnswers() {
  const p = path.join(ROOT, 'data', 'jev-2026-09-22', 'out-floor.jsonl.gz');
  const text = zlib.gunzipSync(fs.readFileSync(p)).toString('utf8');
  const map = new Map();
  for (const l of text.split('\n')) {
    if (!l.trim()) continue;
    const o = JSON.parse(l);
    map.set(o.row_id, o);
  }
  return map;
}

function jevAnswerFor(jevMap, rowId) {
  const o = jevMap.get(rowId);
  if (!o || o.error) return undefined;
  const p = o.answers && o.answers.isX && o.answers.isX.noul;
  if (typeof p !== 'number' || !Number.isFinite(p)) return undefined;
  return { p, model: o.model };
}

// --- fold machinery, identical to poc/d87/lovo3.mjs ------------------------

function precomputeRows(rows) {
  for (const row of rows) {
    const method = (row.method || '').toUpperCase();
    row._method = method;
    const { verb } = verbForRow(row);
    row._verb = verb;
    row._cantUndoHits = (method === 'POST' || method === 'PUT' || method === 'PATCH')
      ? matchingMembers(verb, CANT_UNDO)
      : [];
    row._keepWHits = method === 'POST' ? matchingMembers(verb, KEEP_W) : [];
  }
}

function buildMemberProviderAgg(rows, members, hitsField, isAgree) {
  const perMember = new Map();
  for (const m of members) perMember.set(m, new Map());
  for (const row of rows) {
    const hits = row[hitsField];
    if (hits.length === 0) continue;
    for (const m of hits) {
      const byProvider = perMember.get(m);
      let cell = byProvider.get(row.provider);
      if (!cell) {
        cell = { a: 0, b: 0 };
        byProvider.set(row.provider, cell);
      }
      if (isAgree(row.truthClass)) cell.a += 1;
      else cell.b += 1;
    }
  }
  return perMember;
}

function keepWMemberKept(fixed, leak, provs) {
  const ratio = fixed / Math.max(leak, 1);
  return leak === 0 || (ratio >= 10 && provs >= 2);
}

function cantUndoMemberKept(countX, countWR, provs) {
  const claimsCount = countX + countWR;
  if (claimsCount === 0) return true; // unfired member costs nothing
  return countX > countWR && provs >= 2;
}

function rebuildForFold(perMemberAgg, members, heldOut, decide) {
  const kept = new Set();
  for (const m of members) {
    const byProvider = perMemberAgg.get(m);
    let a = 0;
    let b = 0;
    let provs = 0;
    for (const [provider, cell] of byProvider) {
      if (heldOut.has(provider)) continue;
      a += cell.a;
      b += cell.b;
      provs += 1;
    }
    if (decide(a, b, provs)) kept.add(m);
  }
  return kept;
}

function classifyFold(row, cantUndoSet, keepWSet) {
  return classifyRow(row, { cantUndo: cantUndoSet, keepW: keepWSet });
}

function freshLedger() {
  return { exact: 0, leak: 0, 'over-tight': 0 };
}

function jevOutcomeFor(row, verdict) {
  let v = verdict;
  if (needsJev(v)) v = applyJev(v, row._jevAnswer);
  return outcome(v.class, row.truthClass);
}

// ---------------------------------------------------------------------------

function main() {
  const t0 = Date.now();

  const rows = loadRows();
  const v3Truth = loadV3Truth();
  attachTruth(rows, v3Truth);
  precomputeRows(rows);

  const jevMap = loadJevAnswers();
  for (const row of rows) row._jevAnswer = jevAnswerFor(jevMap, row.row_id);

  const providers = [...new Set(rows.map((r) => r.provider))].sort();

  console.log('D87 fragile-13 pricing — poc/d87/fragile.mjs vs v3 relabel truth');
  console.log(`rows: ${rows.length} (combined v3 truth), providers: ${providers.length}`);
  console.log(`fragile members (13): ${FRAGILE.join(', ')}`);
  console.log(`CANT_UNDO stays at ${CANT_UNDO_FULL.length} members; with the 13 removed it has ${REDUCED_LIST.length}: ${REDUCED_LIST.join(', ')}`);
  console.log('');

  // ---- fitted verdicts, current (full) lists --------------------------
  for (const row of rows) {
    row._fittedFull = classifyRow(row);
  }

  // ---- A. Per fragile member, alone -----------------------------------
  console.log('=== A. Per fragile member, alone (fitted, full lists, n=6557) ===');
  console.log('For each member: rows it claims (step2, source=list, matched includes it), by method;');
  console.log('of those, truth split; providers named; and how many claims would change CLASS if only');
  console.log('that member (holding the other 28 CANT_UNDO members fixed) were removed.');
  console.log('');

  const memberSummary = new Map();

  for (const member of FRAGILE) {
    const reducedOne = new Set(CANT_UNDO_FULL.filter((m) => m !== member));
    const claims = rows.filter(
      (r) => r._fittedFull.step === 2 && r._fittedFull.source === 'list' && r._fittedFull.matched.includes(member),
    );
    const byMethod = { POST: 0, PUT: 0, PATCH: 0, other: 0 };
    for (const r of claims) {
      const m = r._method;
      if (byMethod[m] !== undefined) byMethod[m] += 1;
      else byMethod.other += 1;
    }
    const truthCounts = { x: 0, w: 0, r: 0 };
    for (const r of claims) truthCounts[r.truthClass] += 1;
    const provs = [...new Set(claims.map((r) => r.provider))].sort();

    // Recompute each claim's class with this one member removed.
    let changed = 0;
    const changedTo = { w: 0, x: 0, r: 0 };
    let sameClassEvidenceOnly = 0;
    for (const r of claims) {
      const without = classifyRow(r, { cantUndo: reducedOne });
      if (without.class !== r._fittedFull.class) {
        changed += 1;
        changedTo[without.class] += 1;
      } else {
        sameClassEvidenceOnly += 1;
      }
    }

    memberSummary.set(member, { claims: claims.length, providers: provs.length, changed });

    console.log(`-- ${member} --`);
    line(
      '  claims',
      claims.length,
      `POST=${byMethod.POST}`,
      `PUT=${byMethod.PUT}`,
      `PATCH=${byMethod.PATCH}`,
      byMethod.other ? `other=${byMethod.other}` : '',
    );
    line(
      '  of those, truth',
      `x=${truthCounts.x} (${pct(truthCounts.x, claims.length)})`,
      `w=${truthCounts.w} (${pct(truthCounts.w, claims.length)})`,
      `r=${truthCounts.r} (${pct(truthCounts.r, claims.length)})`,
    );
    line('  providers', provs.length, `[${provs.join(', ')}]`);
    line(
      '  if removed: changes CLASS on',
      changed,
      `of ${claims.length}`,
      `(-> w: ${changedTo.w}, -> x: ${changedTo.x}, -> r: ${changedTo.r})`,
      `; evidence-only (class unchanged, list->floor or stays list via another match): ${sameClassEvidenceOnly}`,
    );
    console.log('');
  }

  // ---- B. All 13 removed together, whole-flow ledger --------------------
  console.log('=== B. All 13 removed together — whole-flow ledger (fitted, n=6557) ===');

  function ledgerFor(words) {
    const mech = freshLedger();
    const jev = freshLedger();
    for (const row of rows) {
      const v = classifyRow(row, words);
      mech[outcome(v.class, row.truthClass)] += 1;
      jev[jevOutcomeFor(row, v)] += 1;
    }
    return { mech, jev };
  }

  const ledgerCurrent = ledgerFor({});
  const ledgerReduced = ledgerFor({ cantUndo: REDUCED });

  function printLedgerPair(label, cur, red, denom) {
    console.log(`-- ${label} --`);
    for (const key of ['exact', 'leak', 'over-tight']) {
      const c = cur[key];
      const r = red[key];
      line(
        `  ${key}`,
        `current=${c} (${pct(c, denom)})`,
        `13-removed=${r} (${pct(r, denom)})`,
        `delta=${r - c >= 0 ? '+' : ''}${r - c}`,
      );
    }
    console.log('');
  }

  printLedgerPair('mechanical', ledgerCurrent.mech, ledgerReduced.mech, rows.length);
  printLedgerPair('with Jev (t=0.10)', ledgerCurrent.jev, ledgerReduced.jev, rows.length);

  // ---- D. Evidence split, fitted, current vs 13-removed (mechanical) ----
  console.log('=== D. Evidence split (source list vs floor), fitted, mechanical, n=6557 ===');

  function evidenceSplit(words) {
    const counts = { list: 0, floor: 0, other: 0 };
    for (const row of rows) {
      const v = classifyRow(row, words);
      if (v.source === 'list') counts.list += 1;
      else if (v.source === 'floor') counts.floor += 1;
      else counts.other += 1;
    }
    return counts;
  }

  const evCurrent = evidenceSplit({});
  const evReduced = evidenceSplit({ cantUndo: REDUCED });
  line(
    '  current lists',
    `list=${evCurrent.list} (${pct(evCurrent.list, rows.length)})`,
    `floor=${evCurrent.floor} (${pct(evCurrent.floor, rows.length)})`,
    evCurrent.other ? `other=${evCurrent.other}` : '',
  );
  line(
    '  13-removed',
    `list=${evReduced.list} (${pct(evReduced.list, rows.length)})`,
    `floor=${evReduced.floor} (${pct(evReduced.floor, rows.length)})`,
    evReduced.other ? `other=${evReduced.other}` : '',
  );
  line(
    '  delta',
    `list=${evReduced.list - evCurrent.list}`,
    `floor=${evReduced.floor - evCurrent.floor}`,
    '(rows a human must now read before deploy)',
  );
  console.log('');

  // ---- C. Leave-one and leave-three-vendor-out, current vs 13-removed ----
  console.log('=== C. Leave-one-vendor-out and leave-three-vendor-out, current vs 13-removed lists ===');

  const cantUndoAgg = buildMemberProviderAgg(rows, CANT_UNDO_FULL, '_cantUndoHits', (t) => t === 'x');
  const keepWAgg = buildMemberProviderAgg(rows, KEEP_W_FULL, '_keepWHits', (t) => t === 'w' || t === 'r');

  const rowsByProvider = new Map(providers.map((p) => [p, rows.filter((r) => r.provider === p)]));

  // Per-member fragile drop tally under leave-THREE-out, current variant
  // (i.e. the same measurement lovo3.mjs made, kept here so part E can
  // quote it without re-deriving it from a second script run).
  const fragileDropCount3 = new Map(FRAGILE.map((m) => [m, 0]));

  function runFolds(foldList) {
    // variants: 'current' candidate pool = CANT_UNDO_FULL (29);
    // 'reduced' candidate pool = REDUCED_LIST (16, the 13 fragile members
    // never considered at all).
    const totals = {
      current: { mech: freshLedger(), jev: freshLedger() },
      reduced: { mech: freshLedger(), jev: freshLedger() },
    };
    let n = 0;
    const trackDrops = foldList.length === 1771; // only the leave-3 run tallies drops

    for (const heldArr of foldList) {
      const heldOut = new Set(heldArr);
      const keptKeepW = rebuildForFold(keepWAgg, KEEP_W_FULL, heldOut, keepWMemberKept);

      const keptCantUndoCurrent = rebuildForFold(cantUndoAgg, CANT_UNDO_FULL, heldOut, cantUndoMemberKept);
      const keptCantUndoReduced = rebuildForFold(cantUndoAgg, REDUCED_LIST, heldOut, cantUndoMemberKept);

      if (trackDrops) {
        for (const m of FRAGILE) {
          if (!keptCantUndoCurrent.has(m)) fragileDropCount3.set(m, fragileDropCount3.get(m) + 1);
        }
      }

      for (const provider of heldArr) {
        const pRows = rowsByProvider.get(provider);
        n += pRows.length;
        for (const row of pRows) {
          const vCur = classifyFold(row, keptCantUndoCurrent, keptKeepW);
          totals.current.mech[outcome(vCur.class, row.truthClass)] += 1;
          totals.current.jev[jevOutcomeFor(row, vCur)] += 1;

          const vRed = classifyFold(row, keptCantUndoReduced, keptKeepW);
          totals.reduced.mech[outcome(vRed.class, row.truthClass)] += 1;
          totals.reduced.jev[jevOutcomeFor(row, vRed)] += 1;
        }
      }
    }
    return { totals, n };
  }

  // -- leave-one-out: 23 folds of 1 held-out provider each --
  const lovo1Folds = providers.map((p) => [p]);
  const { totals: t1, n: n1 } = runFolds(lovo1Folds);

  console.log('-- leave-ONE-vendor-out (23 folds) --');
  line('  total classifications', n1, `(expected ${rows.length})`);
  printLedgerPair('  mechanical', t1.current.mech, t1.reduced.mech, n1);
  printLedgerPair('  with Jev (t=0.10)', t1.current.jev, t1.reduced.jev, n1);

  // -- leave-three-out: all C(23,3) = 1771 triples --
  const triples = [];
  for (let i = 0; i < providers.length; i += 1) {
    for (let j = i + 1; j < providers.length; j += 1) {
      for (let k = j + 1; k < providers.length; k += 1) {
        triples.push([providers[i], providers[j], providers[k]]);
      }
    }
  }
  const { totals: t3, n: n3 } = runFolds(triples);

  console.log(`-- leave-THREE-vendor-out (${triples.length} folds, C(23,3)) --`);
  line('  total classifications', n3, `(expected ${rows.length} * 231 = ${rows.length * 231})`);
  printLedgerPair('  mechanical', t3.current.mech, t3.reduced.mech, n3);
  printLedgerPair('  with Jev (t=0.10)', t3.current.jev, t3.reduced.jev, n3);

  console.log('Reading: if the 13 are only ever present because their own vendor is in the tuning set,');
  console.log('the reduced-list LOVO/LOVO3 numbers above should equal the current-list ones (delta 0).');
  console.log('');

  // ---- E. One-line verdict per member -------------------------------------
  console.log('=== E. One-line verdict per member (factual only) ===');
  for (const member of FRAGILE) {
    const s = memberSummary.get(member);
    const drop3 = fragileDropCount3.get(member);
    line(
      `  ${member}:`,
      `claims ${s.claims} rows on ${s.providers} providers, changes class on ${s.changed} of them,`,
      `LOVO effect: dropped in ${drop3}/${triples.length} leave-3 folds (${pct(drop3, triples.length)})`,
    );
  }
  console.log('');

  console.log(`total runtime: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main();
