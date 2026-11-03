// poc/cantundo-verbs/score.mjs — take-back POC: does adding lead VERBS to
// step 2's CANT_UNDO earn a build? (rwxlite found x rows that read as creates
// but are sends, transfers or payments.) Tuning numbers only.
//
// Each candidate verb is measured on its own: classifyRow(row, {cantUndo:
// CANT_UNDO + verb}) against classifyRow(row). Matching is step 2's own; this
// file never re-implements it (tokens.js helpers are used only to mine the
// "found" list, and by APIs.guru to skip rows cheaply -- the survivors are
// then confirmed by classifyRow).
//
// Truth: combined (6557, v3) and buildset (1819), separate lines. Views:
//   mech  classifyRow alone
//   jev1/jev2  mech then src applyJev with the cached answers (run 1 / run 2):
//     jev-lower: isX data/jev-tiers-2026-09-23/out-lower{,-run2}.jsonl, then the
//       changes question data/f1-post-r-2026-11-03/out-changes-run{1,2}.jsonl
//     jev-raise-wx: out-raise-wx-xonly{,-run2}.jsonl
//     jev-raise-get is NOT applied (GET rows; no verb touches them).
//   The cached files cover pc- rows only, so the buildset line is mech only.
//   The changes answers come from jev-1.14.0 and the isX answers from
//   jev-1.13.0; applyJev wants one model on both, so the changes answer is
//   handed the isX model string (a cached-replay shortcut, same as poc/f1).
//
// Usage: node poc/cantundo-verbs/score.mjs > poc/cantundo-verbs/score.txt
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../tools/csv.js';
import { classifyRow, applyJev, needsJev } from '../../src/index.js';
import { CANT_UNDO } from '../../src/step2.js';
import { KEEP_W } from '../../src/step3.js';
import { verbForRow, matchingMembers } from '../../src/tokens.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RANK = { r: 0, w: 1, x: 2 };
export const CANDIDATES = [
  'transfer', 'deliver', 'notify', 'invite', 'share', 'submit', 'issue', 'dispatch', 'broadcast', 'post',
  'payout', 'withdraw', 'deposit', 'disburse', 'settle', 'confirm', 'finalize', 'disable', 'suspend',
  'deactivate', 'lock', 'block', 'ban', 'terminate', 'kill', 'invalidate', 'regenerate',
];
export const VIEWS_COMBINED = ['mech', 'jev1', 'jev2'];

const pct = (n, d) => (d === 0 ? '0.0%' : `${((100 * n) / d).toFixed(1)}%`);
const frac = (n, d) => `${n} (${pct(n, d)})`;
const trunc = (s, n) => { const t = String(s || '').replace(/\s+/g, ' '); return t.length > n ? `${t.slice(0, n - 1)}~` : t; };
const withVerbs = (vs) => ({ cantUndo: new Set([...CANT_UNDO, ...vs]) });

// ---- pure pieces (tested) ---------------------------------------------------

/** Tally the rows whose letter changed in one view. items: {truth, before, after}. */
export function tallyMoves(items) {
  const t = { moved: 0, right: 0, wrongW: 0, wrongR: 0 };
  for (const i of items) {
    if (RANK[i.after] < RANK[i.before]) throw new Error('a verb must never lower a letter');
    if (i.after === i.before) continue;
    t.moved += 1;
    if (i.truth === 'x') t.right += 1; else if (i.truth === 'w') t.wrongW += 1; else t.wrongR += 1;
  }
  t.wrong = t.wrongW + t.wrongR;
  return t;
}

/**
 * Leave-one-vendor-out for one verb in one view. items carry provider, truth,
 * before, after. Fold: keep the verb only when right > wrong on the OTHER
 * vendors' moved rows; the held-out vendor's moved rows count only if kept.
 */
export function lovoVerb(items) {
  const vendors = [...new Set(items.map((i) => i.provider))];
  const pooled = { moved: 0, right: 0, wrongW: 0, wrongR: 0, wrong: 0, dropped: 0, folds: vendors.length };
  for (const v of vendors) {
    const other = tallyMoves(items.filter((i) => i.provider !== v));
    if (!(other.right > other.wrong)) { pooled.dropped += 1; continue; }
    const mine = tallyMoves(items.filter((i) => i.provider === v));
    pooled.moved += mine.moved; pooled.right += mine.right;
    pooled.wrongW += mine.wrongW; pooled.wrongR += mine.wrongR; pooled.wrong += mine.wrong;
  }
  return pooled;
}

export function ledger(pairs) {
  const l = { n: pairs.length, exact: 0, leak: 0, over: 0 };
  for (const [p, t] of pairs) {
    if (p === t) l.exact += 1; else if (RANK[p] < RANK[t]) l.leak += 1; else l.over += 1;
  }
  return l;
}

// ---- cached Jev -------------------------------------------------------------

function readJsonl(rel) {
  const map = new Map();
  let bad = 0;
  for (const line of fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const o = JSON.parse(line); map.set(o.row_id, o); } catch { bad += 1; }
  }
  return { map, bad };
}

const answerP = (o, key) => {
  const a = o && !o.error && o.answers && o.answers[key];
  return a && typeof a.noul === 'number' ? a.noul : null;
};

export const JEV_FILES = {
  jev1: { lower: 'data/jev-tiers-2026-09-23/out-lower.jsonl', changes: 'data/f1-post-r-2026-11-03/out-changes-run1.jsonl', wx: 'data/jev-tiers-2026-09-23/out-raise-wx-xonly.jsonl' },
  jev2: { lower: 'data/jev-tiers-2026-09-23/out-lower-run2.jsonl', changes: 'data/f1-post-r-2026-11-03/out-changes-run2.jsonl', wx: 'data/jev-tiers-2026-09-23/out-raise-wx-xonly-run2.jsonl' },
};

export function loadJev() {
  const out = {};
  for (const [name, f] of Object.entries(JEV_FILES)) {
    out[name] = { lower: readJsonl(f.lower), changes: readJsonl(f.changes), wx: readJsonl(f.wx) };
  }
  return out;
}

/**
 * The letter a verdict ends at after the cached Jev run `jev` (null = mech
 * only). `stats` counts pile rows with no usable answer (they stay put).
 */
export function finalClass(row, verdict, jev, stats) {
  if (!jev) return verdict.class;
  const tier = needsJev(verdict);
  if (!tier) return verdict.class;
  const bump = (k) => { if (stats) stats[k] = (stats[k] || 0) + 1; };
  let answer = null;
  if (tier === 'jev-lower') {
    const o = jev.lower.map.get(row.row_id);
    const p = answerP(o, 'isX');
    if (p === null) { bump('lowerNoAnswer'); return verdict.class; }
    const c = answerP(jev.changes.map.get(row.row_id), 'changes');
    answer = { p, model: o.model, changes: c === null ? null : { p: c, model: o.model } };
  } else if (tier === 'jev-raise-wx') {
    const o = jev.wx.map.get(row.row_id);
    const p = answerP(o, 'isX');
    if (p === null) { bump('wxNoAnswer'); return verdict.class; }
    answer = { p, model: o.model };
  } else { bump('tierNotApplied'); return verdict.class; }
  return applyJev(verdict, answer, { method: row.method }).class;
}

// ---- sets -------------------------------------------------------------------

export function loadSet(rel, jev) {
  const all = parseCsv(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  const rows = [];
  let skipped = 0;
  for (const r of all) {
    if (RANK[r.truth_class] === undefined) { skipped += 1; continue; }
    rows.push({ ...r, truth: r.truth_class });
  }
  const stats = {};
  const views = jev ? VIEWS_COMBINED : ['mech'];
  const classify = (words) => rows.map((r) => {
    const verdict = classifyRow(r, words);
    const fin = {};
    for (const v of views) fin[v] = finalClass(r, verdict, v === 'mech' ? null : jev[v], v === 'jev1' ? stats : null);
    return { verdict, fin };
  });
  const base = classify({});
  return { rel, read: all.length, skipped, rows, views, base, classify, stats };
}

/** Items for one verb set (default words + `verbs`) against the base. */
export function itemsFor(set, verbs) {
  const after = set.classify(withVerbs(verbs));
  return set.rows.map((r, i) => ({
    row: r, provider: r.provider, truth: r.truth,
    baseVerdict: set.base[i].verdict, verdict: after[i].verdict,
    before: set.base[i].fin, after: after[i].fin,
    fired: after[i].verdict.rule.startsWith('cant-undo-verb') && verbs.some((v) => after[i].verdict.matched.includes(v)),
  }));
}

function viewItems(items, view) { return items.map((i) => ({ provider: i.provider, truth: i.truth, before: i.before[view], after: i.after[view] })); }

function evalVerb(set, verb) {
  const items = itemsFor(set, [verb]);
  const fired = items.filter((i) => i.fired);
  const byV = {};
  for (const i of fired) byV[i.provider] = (byV[i.provider] || 0) + 1;
  const top = Object.entries(byV).sort((a, b) => b[1] - a[1]);
  const res = {
    verb, items, fired: fired.length,
    firedTruth: { x: 0, w: 0, r: 0 }, firedFloorPost: 0, vendors: top.length,
    topVendor: top[0] ? top[0][0] : '', topShare: fired.length ? top[0][1] / fired.length : 0, views: {},
  };
  for (const i of fired) { res.firedTruth[i.truth] += 1; if (i.baseVerdict.rule === 'floor-post') res.firedFloorPost += 1; }
  for (const view of set.views) {
    const vi = viewItems(items, view);
    res.views[view] = {
      t: tallyMoves(vi), lovo: lovoVerb(vi),
      before: ledger(vi.map((i) => [i.before, i.truth])), after: ledger(vi.map((i) => [i.after, i.truth])),
    };
  }
  return res;
}

/** ok = no moves or right > wrong; fail = moves and right <= wrong. */
export function viewState(t) { return t.moved === 0 ? 'n/a' : t.right > t.wrong ? 'ok' : 'FAIL'; }

export function verdictFor(combined, build) {
  const checks = [];
  for (const v of VIEWS_COMBINED) {
    checks.push([`comb ${v}`, viewState(combined.views[v].t)]);
    checks.push([`comb ${v} LOVO`, viewState(combined.views[v].lovo)]);
    checks.push([`comb ${v} loose`, combined.views[v].after.leak <= combined.views[v].before.leak ? 'ok' : 'FAIL']);
  }
  checks.push(['build mech', viewState(build.views.mech.t)]);
  checks.push(['build mech LOVO', viewState(build.views.mech.lovo)]);
  checks.push(['build loose', build.views.mech.after.leak <= build.views.mech.before.leak ? 'ok' : 'FAIL']);
  const anyMove = VIEWS_COMBINED.some((v) => combined.views[v].t.moved > 0);
  const fail = checks.filter(([, s]) => s === 'FAIL').map(([n]) => n);
  return { pass: anyMove && fail.length === 0, anyMove, fail, checks };
}

// ---- mining the "found" list -----------------------------------------------

export function mineFound(set, exclude) {
  const stat = new Map();
  set.rows.forEach((r, i) => {
    const rule = set.base[i].verdict.rule;
    if (rule !== 'floor-post' && rule !== 'method-floor') return;
    const verb = verbForRow(r).verb;
    if (!/^[a-z]{3,}$/.test(verb)) return;
    if (!stat.has(verb)) stat.set(verb, { verb, n: 0, x: 0, w: 0, r: 0, leak: 0, v: new Set() });
    const e = stat.get(verb);
    e.n += 1; e[r.truth] += 1; e.v.add(r.provider);
    if (r.truth === 'x' && set.views.some((k) => set.base[i].fin[k] !== 'x')) e.leak += 1;
  });
  return [...stat.values()]
    .filter((e) => e.leak >= 2 && e.x >= e.w + e.r && e.v.size >= 2 && !exclude.has(e.verb))
    .sort((a, b) => b.leak - a.leak).slice(0, 15);
}

// ---- APIs.guru prevalence ---------------------------------------------------

function prevalence(verbs) {
  const all = parseCsv(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'data/corpus/apis-guru-ops.csv.gz'))).toString('utf8'));
  console.log(`\n================ APIs.guru prevalence: ${all.length} ops read (no truth); per verb: lead matches step 2 reaches -> fires confirmed by classifyRow`);
  const pre = all.map((r) => {
    const m = (r.method || '').toUpperCase();
    return (m === 'POST' || m === 'PUT' || m === 'PATCH') ? verbForRow(r).verb : '';
  });
  const out = {};
  for (const verb of verbs) {
    const one = new Set([verb]);
    let fires = 0, moved = 0, floorPost = 0;
    const pv = {};
    for (let k = 0; k < all.length; k += 1) {
      if (!pre[k] || matchingMembers(pre[k], one).length === 0) continue;
      const r = all[k];
      const a = classifyRow(r, withVerbs([verb]));
      if (!(a.rule.startsWith('cant-undo-verb') && a.matched.includes(verb))) continue;
      const b = classifyRow(r);
      fires += 1; pv[r.provider] = (pv[r.provider] || 0) + 1;
      if (b.class !== a.class) moved += 1;
      if (b.rule === 'floor-post') floorPost += 1;
    }
    const top = Object.entries(pv).sort((x, y) => y[1] - x[1]);
    out[verb] = { fires, moved, floorPost, providers: top.length, top: top[0] ? top[0][0] : '', share: fires ? top[0][1] / fires : 0 };
  }
  return { out, n: all.length };
}

// ---- reporting --------------------------------------------------------------

const L = (l) => `${l.exact} exact / ${l.leak} too loose / ${l.over} too tight of ${l.n}`;

function tableRow(res, set, apis) {
  const cells = [res.verb.padEnd(11), String(res.fired).padStart(4), `x${res.firedTruth.x}/w${res.firedTruth.w}/r${res.firedTruth.r}`.padEnd(11)];
  for (const view of set.views) {
    const t = res.views[view].t;
    cells.push(`${view}: mv ${t.moved} R${t.right} W${t.wrongW} r${t.wrongR}`.padEnd(26));
  }
  cells.push(`${res.vendors}v top ${res.topVendor} ${pct(res.topShare * 100, 100)}${res.topShare > 0.5 && res.fired >= 1 ? ' FLAG' : ''}`.padEnd(30));
  const a = apis && apis[res.verb];
  if (a) cells.push(`apis.guru fires ${a.fires} (mv ${a.moved}, floorPOST ${a.floorPost}) ${a.providers} prov`);
  return cells.join(' ');
}

function report(label, verbs, comb, build, apis) {
  console.log(`\n================ ${label}`);
  const results = {};
  for (const verb of verbs) {
    const rc = evalVerb(comb, verb);
    const rb = evalVerb(build, verb);
    const v = verdictFor(rc, rb);
    results[verb] = { rc, rb, v };
    console.log(`COMB  ${tableRow(rc, comb, apis)}`);
    console.log(`      LOVO pooled: ${VIEWS_COMBINED.map((x) => `${x}: mv ${rc.views[x].lovo.moved} R${rc.views[x].lovo.right} W${rc.views[x].lovo.wrong}`).join(' | ')}`);
    console.log(`BUILD ${tableRow(rb, build)}`);
    console.log(`      LOVO pooled: mech: mv ${rb.views.mech.lovo.moved} R${rb.views.mech.lovo.right} W${rb.views.mech.lovo.wrong}`);
    console.log(`      => ${v.pass ? 'PASS' : 'FAIL'}${v.anyMove ? '' : ' (no letter moves anywhere on combined)'}${v.fail.length ? `  failing: ${v.fail.join(', ')}` : ''}${rc.topShare > 0.5 && rc.fired > 0 ? '  FLAG: >50% one vendor (fitting)' : ''}`);
  }
  return results;
}

function jointLine(name, verbs, set, label) {
  const items = itemsFor(set, verbs);
  const fired = items.filter((i) => i.fired).length;
  console.log(`  ${label} ${name} [${verbs.join(',') || '(none)'}]: fires ${fired} of ${set.rows.length}`);
  for (const view of set.views) {
    const vi = viewItems(items, view);
    const t = tallyMoves(vi);
    console.log(`    ${view}: moved ${t.moved}, right ${t.right}, wrong w ${t.wrongW}, wrong r ${t.wrongR}; before ${L(ledger(vi.map((i) => [i.before, i.truth])))} -> after ${L(ledger(vi.map((i) => [i.after, i.truth])))}`);
  }
}

/** Joint LOVO: per fold keep each verb that is right > wrong on the other vendors (own view), apply the kept set to the held-out vendor. */
export function jointLovo(set, verbs, view) {
  const perVerb = verbs.map((v) => ({ v, items: viewItems(itemsFor(set, [v]), view) }));
  const vendors = [...new Set(set.rows.map((r) => r.provider))];
  const cache = new Map();
  const pooled = { moved: 0, right: 0, wrongW: 0, wrongR: 0 };
  for (const vendor of vendors) {
    const kept = perVerb.filter((p) => { const t = tallyMoves(p.items.filter((i) => i.provider !== vendor)); return t.right > t.wrong; }).map((p) => p.v);
    if (!kept.length) continue;
    const key = kept.join(',');
    if (!cache.has(key)) cache.set(key, itemsFor(set, kept));
    const t = tallyMoves(viewItems(cache.get(key).filter((i) => i.provider === vendor), view));
    pooled.moved += t.moved; pooled.right += t.right; pooled.wrongW += t.wrongW; pooled.wrongR += t.wrongR;
  }
  return pooled;
}

function listing(comb, results) {
  const lines = [];
  for (const [verb, { rc }] of Object.entries(results)) {
    for (const i of rc.items) {
      if (!i.fired) continue;
      if (!comb.views.some((v) => i.after[v] !== i.before[v])) continue;
      lines.push({ verb, i });
    }
  }
  const wrong = lines.filter((l) => l.i.truth !== 'x');
  const right = lines.filter((l) => l.i.truth === 'x');
  const shown = lines.length > 150 ? [...wrong, ...right.slice(0, 50)] : lines;
  console.log(`\n================ LISTING: every fire that changes a letter on combined in any view (${lines.length} verb-row pairs: ${right.length} truth x, ${wrong.length} truth w/r)${lines.length > 150 ? `; >150 so all ${wrong.length} wrong + 50 right` : ''}`);
  console.log('verb | row_id | provider | method | path | operationId | summary | truth | before mech/jev1/jev2 | after mech/jev1/jev2');
  for (const { verb, i } of shown) {
    const r = i.row;
    const f = (o) => comb.views.map((v) => o[v]).join('/');
    console.log(`${verb} | ${r.row_id} | ${r.provider} | ${r.method} | ${r.path} | ${r.operationId} | ${trunc(r.summary, 80)} | ${i.truth} | ${f(i.before)} | ${f(i.after)}`);
  }
}

function main() {
  for (const c of CANDIDATES) if (CANT_UNDO.has(c)) throw new Error(`${c} is already in CANT_UNDO`);
  const jev = loadJev();
  const comb = loadSet('data/combined-2026-09-21/labelled.csv', jev);
  const build = loadSet('data/relabel-buildset-2026-09-23/labelled.csv', null);
  console.log(`combined: read ${comb.read}, skipped ${comb.skipped} (truth not r/w/x), scored ${comb.rows.length}`);
  console.log(`buildset: read ${build.read}, skipped ${build.skipped}, scored ${build.rows.length}; mech only (no cached Jev answers cover b#### rows)`);
  const ids = new Set(comb.rows.map((r) => r.row_id));
  for (const [name, j] of Object.entries(jev)) {
    for (const [k, v] of Object.entries(j)) {
      let notIn = 0; for (const id of v.map.keys()) if (!ids.has(id)) notIn += 1;
      console.log(`  ${name}.${k}: ${v.map.size} answers, ${v.bad} malformed lines, ${notIn} answers for rows not in combined (ignored)`);
    }
  }
  console.log(`  baseline pile rows without a usable answer or tier not applied (jev1): ${JSON.stringify(comb.stats)}`);
  for (const view of comb.views) console.log(`  baseline combined ${view}: ${L(ledger(comb.rows.map((r, i) => [comb.base[i].fin[view], r.truth])))}`);
  console.log(`  baseline buildset mech: ${L(ledger(build.rows.map((r, i) => [build.base[i].fin.mech, r.truth])))}`);
  const overlap = CANDIDATES.filter((c) => [...KEEP_W].some((k) => matchingMembers(c, new Set([k])).length || matchingMembers(k, new Set([c])).length));
  console.log(`  candidates overlapping KEEP_W (step 2 would win; breaks the disjointness test): ${overlap.join(',') || 'none'}`);

  const found = mineFound(comb, new Set([...CANDIDATES, ...CANT_UNDO]));
  console.log('\n================ FOUND list (mined by me on combined: lead verb of floor-post/method-floor rows with >=2 truth-x rows that end below x in some view, pile truth x >= w+r, >=2 vendors; FITTED, labelled apart)');
  for (const e of found) console.log(`  ${e.verb.padEnd(12)} pile rows ${e.n} truth x ${e.x} w ${e.w} r ${e.r}, leaks ${e.leak}, vendors ${e.v.size}`);
  const foundVerbs = found.map((e) => e.verb);

  const apis = prevalence([...CANDIDATES, ...foundVerbs]);
  console.log(`  (apis.guru n=${apis.n})`);

  const results = report('CANDIDATES (each verb on its own)', CANDIDATES, comb, build, apis.out);
  const fres = report('FOUND (mined, fitted to combined)', foundVerbs, comb, build, apis.out);

  const passing = CANDIDATES.filter((v) => results[v].v.pass);
  const fpass = foundVerbs.filter((v) => fres[v].v.pass);
  console.log('\n================ SUMMARY');
  console.log(`PASS candidates: ${passing.join(',') || '(none)'}`);
  console.log(`FAIL candidates: ${CANDIDATES.filter((v) => !results[v].v.pass).map((v) => `${v}${results[v].v.anyMove ? '' : '(no moves)'}`).join(',')}`);
  console.log(`PASS found: ${fpass.join(',') || '(none)'}; FAIL found: ${foundVerbs.filter((v) => !fres[v].v.pass).join(',')}`);

  console.log('\n================ JOINT');
  for (const [name, vs] of [['all candidates', CANDIDATES], ['passing candidates', passing], ['passing found', fpass], ['passing candidates + passing found', [...passing, ...fpass]]]) {
    jointLine(name, vs, comb, 'combined');
    jointLine(name, vs, build, 'buildset');
    if (vs.length) for (const view of comb.views) {
      const p = jointLovo(comb, vs, view);
      console.log(`    joint LOVO ${view}: moved ${p.moved}, right ${p.right}, wrong w ${p.wrongW}, wrong r ${p.wrongR}`);
    }
  }
  listing(comb, results);
  listing(comb, fres);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
