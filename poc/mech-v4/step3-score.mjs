// Step 3 measurement (POST): candidate A (keep x) and B (pull floor to w) on top of the current v4 verdict.
// Measurement only; changes nothing in the core. Run: node poc/mech-v4/step3-score.mjs
import fs from 'node:fs';
import { loadSets } from './sets.mjs';
import { classifyRow } from './flow.js';
import { step2, PATH_X_WORDS } from './step2.js';
import { splitTokens, stemMatches, verbForRow } from './tokens.js';

const RANK = { r: 0, w: 1, x: 2 };
const bucket = (cls, truth) => { const d = RANK[truth] - RANK[cls]; return d === 0 ? 'exact' : d === 1 ? 'loose1' : d === 2 ? 'loose2' : 'tight'; };
const B_WORDS = 'tag project label file upload domain template config asset comment contact custom_field repo card item flow segment alert location image attachment note ticket environment create copy restart lock'.split(' ');
const LEAD_ONLY = new Set(['restart', 'lock']);
const VETO = process.argv.includes('--veto');
const out = [];
const P = (s = '') => out.push(s);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');
const isParam = (s) => s.startsWith('{') && s.endsWith('}');
const cnt = () => ({ r: 0, w: 0, x: 0 });

// A probe: the real step2 matcher on a PUT copy with no operationId/summary and empty cantUndo/credentialSet.
const probeWords = { cantUndo: new Set(), credentialSet: new Set() };
const probe = (row) => step2({ ...row, method: 'PUT', operationId: '', summary: '' }, probeWords);
// Independent direct copy of step2's pathWordMatch (verbatim logic) for the probe cross-check.
function directPathWords(row) {
  const pieces = [];
  for (const seg of String(row.path || '').split('/')) {
    if (seg === '' || isParam(seg)) continue;
    for (const piece of seg.split('#')) { const toks = splitTokens(piece); if (toks.length) pieces.push(toks); }
  }
  const found = [];
  for (const word of PATH_X_WORDS) {
    const parts = word.split('_'); const n = parts.length; let hit = false;
    for (const toks of pieces) {
      if (n === 1) hit = toks.some((t) => stemMatches(t, word) || t.includes(word));
      else {
        for (let i = 0; i + n <= toks.length && !hit; i++) {
          let ok = true;
          for (let k = 0; k < n - 1 && ok; k++) ok = toks[i + k] === parts[k];
          if (ok && (toks[i + n - 1] === parts[n - 1] || stemMatches(toks[i + n - 1], parts[n - 1]))) hit = true;
        }
        if (!hit) hit = toks.some((t) => t.includes(parts.join('')));
      }
      if (hit) break;
    }
    if (hit) found.push(word);
  }
  return found.sort();
}

// B matcher: returns [{word, where}]
function bMatches(row) {
  const segs = String(row.path || '').split('/').filter((s) => s && !isParam(s));
  const pieces = segs.length ? segs[segs.length - 1].split('#').map(splitTokens).filter((t) => t.length) : [];
  const { verb } = verbForRow(row);
  const res = [];
  for (const word of B_WORDS) {
    let where = null;
    if (!LEAD_ONLY.has(word)) {
      if (word === 'custom_field') {
        for (const toks of pieces) for (let i = 0; i + 2 <= toks.length; i++) {
          if (toks[i] === 'custom' && stemMatches(toks[i + 1], 'field')) where = 'last-segment';
        }
      } else {
        for (const toks of pieces) if (toks.some((t) => stemMatches(t, word))) where = 'last-segment';
      }
    }
    if (!where && (word === 'restart' || word === 'lock') && stemMatches(verb, word)) where = 'lead-verb';
    if (where) res.push({ word, where });
  }
  return res;
}

const all = loadSets().filter((s) => s.v4);
const rows = all.map((s) => {
  const cur = classifyRow(s.row);
  const o = { set: s.set, id: s.id, row: s.row, truth: s.v4, cur, post: String(s.row.method || '').toUpperCase() === 'POST', vendor: s.row.provider };
  if (o.post) {
    o.probe = probe(s.row);
    o.aFire = !!o.probe && o.probe.rule === 'path-x-word';
    o.group = cur.rule.startsWith('read-verb') ? 'read-verb*' : cur.rule.startsWith('cant-undo-verb') ? 'cant-undo-verb*' : cur.rule.startsWith('modify-verb') ? 'modify-verb*' : cur.rule;
    o.isA = o.group === 'modify-verb*' && o.aFire;
    o.isFloor = cur.rule === 'floor-post';
    o.elig = o.isFloor && !o.aFire;
    o.bm = o.elig ? bMatches(s.row) : [];
  }
  return o;
});
const posts = rows.filter((r) => r.post);

// probe cross-check
let probeBad = 0, probeRuleBad = 0;
for (const r of posts) {
  if (r.probe && r.probe.rule !== 'path-x-word') probeRuleBad++;
  const direct = directPathWords(r.row);
  const pm = r.probe ? r.probe.matched : [];
  if (JSON.stringify(direct) !== JSON.stringify(pm)) probeBad++;
}

// 1
P('== 1) POST pile by current rule group (truth r/w/x) ==');
const groups = new Map();
for (const r of posts) { if (!groups.has(r.group)) groups.set(r.group, cnt()); groups.get(r.group)[r.truth]++; }
for (const [g, c] of [...groups].sort()) P(`  ${g.padEnd(18)} n=${c.r + c.w + c.x} truth r=${c.r} w=${c.w} x=${c.x}`);
const eq = (c, a, b, d) => c && c.r === a && c.w === b && c.x === d;
const fl = groups.get('floor-post'), kw = groups.get('modify-verb*');
const asserts = [
  ['POST n = 4653', posts.length === 4653],
  ['floor-post truth 253/1795/1538', eq(fl, 253, 1795, 1538)],
  ['KEEP_W truth 0/408/162', eq(kw, 0, 408, 162)],
  ['all rows = 16486', rows.length === 16486],
];
for (const [n, ok] of asserts) P(`  assert ${n}: ${ok ? 'OK' : 'FAIL'}`);
P(`  probe check: probe rule is only null or path-x-word on all POST rows (violations ${probeRuleBad}); probe matched list vs verbatim direct copy of pathWordMatch on the path: ${probeBad} differences over ${posts.length} POST rows`);
P(`  A probe fires on POST: ${posts.filter((r) => r.aFire).length} (modify-verb*: ${posts.filter((r) => r.isA).length}, floor: ${posts.filter((r) => r.isFloor && r.aFire).length}, other: ${posts.filter((r) => r.aFire && !r.isA && !r.isFloor).length})`);
P(`  B eligible pile (floor-post, probe does not fire): ${posts.filter((r) => r.elig).length}`);
P();

// 2
P('== 2) A alone (modify-verb* rows, path-x-word fires -> stays x) ==');
const aRows = posts.filter((r) => r.isA);
const ac = cnt(); for (const r of aRows) ac[r.truth]++;
P(`  rows fired: ${aRows.length}; truth r=${ac.r} w=${ac.w} x=${ac.x}`);
P(`  leaks closed (truth x, were w): ${ac.x}; new too tight (truth w or r, now x): ${ac.w + ac.r} (w=${ac.w}, r=${ac.r}); ratio closed/new = ${(ac.x / Math.max(1, ac.w + ac.r)).toFixed(2)}`);
const av = new Map(); for (const r of aRows) if (r.truth === 'x') av.set(r.vendor, (av.get(r.vendor) || 0) + 1);
P(`  vendors with a closed leak (${av.size}): ${[...av].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v}=${n}`).join(' ')}`);
P();

// B per word stats
const elig = posts.filter((r) => r.elig);
const stats = (pile) => {
  const m = new Map(B_WORDS.map((w) => [w, { c: cnt(), v: new Set() }]));
  for (const r of pile) for (const b of r.bm) { const e = m.get(b.word); e.c[r.truth]++; e.v.add(r.vendor); }
  return m;
};
const pass = (c) => (c.x === 0 ? c.w >= 1 : c.w > 10 * c.x);
const full = stats(elig);
P('== 3) B per word, fitted on the full pile (NOT quotable) ==');
P('  word          fires  r    w    x   vendors  passes-bar(w>10x)');
for (const w of B_WORDS) {
  const e = full.get(w); const n = e.c.r + e.c.w + e.c.x;
  P(`  ${w.padEnd(13)} ${String(n).padStart(5)} ${String(e.c.r).padStart(4)} ${String(e.c.w).padStart(4)} ${String(e.c.x).padStart(4)} ${String(e.v.size).padStart(7)}   ${pass(e.c) ? 'yes' : 'no'}`);
}
P();

// LOVO
const vendors = [...new Set(elig.map((r) => r.vendor))];
const admittedByV = new Map();
for (const v of vendors) {
  const m = stats(elig.filter((r) => r.vendor !== v));
  admittedByV.set(v, new Set(B_WORDS.filter((w) => pass(m.get(w).c))));
}
const admitFor = (v) => admittedByV.get(v) || new Set(); // vendors with no eligible rows have nothing to apply to
for (const r of elig) {
  const adm = admitFor(r.vendor);
  const hit = r.bm.find((b) => adm.has(b.word));
  r.lovoWord = hit ? hit.word : null; r.lovoWhere = hit ? hit.where : null;
}
const lovoRows = elig.filter((r) => r.lovoWord);
P('== 4) B leave-one-vendor-out ==');
P(`  vendors with eligible floor rows (folds): ${vendors.length}`);
P('  word          folds-admitted   (of ' + vendors.length + ')');
for (const w of B_WORDS) P(`  ${w.padEnd(13)} ${String([...admittedByV.values()].filter((s) => s.has(w)).length).padStart(5)}`);
const lc = cnt(); for (const r of lovoRows) lc[r.truth]++;
P(`  B LOVO totals (rows lowered x->w, ${lovoRows.length}): right (truth w)=${lc.w}  new leaks (truth x)=${lc.x}  truth r moved one step closer=${lc.r}`);
const ratio = lc.x === 0 ? Infinity : lc.w / lc.x;
P(`  ratio right/leak = ${lc.x === 0 ? 'inf (0 leaks)' : ratio.toFixed(2)}  -> ${(lc.x === 0 ? lc.w >= 1 : ratio > 10) ? 'GO' : 'NO-GO'} vs >10`);
P();

// 5
const fitAdm = new Set(B_WORDS.filter((w) => pass(full.get(w).c)));
const fitRows = elig.filter((r) => r.bm.some((b) => fitAdm.has(b.word)));
const fc = cnt(); for (const r of fitRows) fc[r.truth]++;
P('== 5) B fitted totals (admitted on full pile; NOT quotable) ==');
P(`  admitted words (${fitAdm.size}): ${[...fitAdm].join(' ') || '(none)'}`);
P(`  rows lowered ${fitRows.length}: right (truth w)=${fc.w} new leaks (truth x)=${fc.x} truth r closer=${fc.r}; ratio ${fc.x === 0 ? 'inf' : (fc.w / fc.x).toFixed(2)}`);
P();

// 6
const variants = {
  cur: (r) => ({ cls: r.cur.class, rev: r.cur.review }),
  A: (r) => (r.post && r.isA ? { cls: 'x', rev: 'tight' } : { cls: r.cur.class, rev: r.cur.review }),
  AB: (r) => (r.post && r.isA ? { cls: 'x', rev: 'tight' } : r.post && r.lovoWord ? { cls: 'w', rev: 'loose' } : { cls: r.cur.class, rev: r.cur.review }),
};
const summarize = (pile, vn) => {
  const t = { exact: 0, loose1: 0, loose2: 0, tight: 0 }; const mk = { tight: 0, loose: 0, settled: 0 };
  let nl = 0, nt = 0, tl = 0, tt = 0;
  for (const r of pile) {
    const v = variants[vn](r); const b = bucket(v.cls, r.truth); t[b]++; mk[v.rev]++;
    if (b === 'loose1' || b === 'loose2') { tl++; if (v.rev !== 'settled') nl++; }
    if (b === 'tight') { tt++; if (v.rev !== 'settled') nt++; }
  }
  return `exact=${t.exact} (${pct(t.exact, pile.length)}) loose-1=${t.loose1} loose-2=${t.loose2} too-tight=${t.tight} | marked tight=${mk.tight} loose=${mk.loose} settled=${mk.settled} | too-loose non-settled ${nl}/${tl}, too-tight non-settled ${nt}/${tt}`;
};
P('== 6) Joint: current v4 vs v4+A vs v4+A+B(LOVO) ==');
for (const [name, pile] of [['POST rows', posts], ['all rows', rows]]) {
  P(`  -- ${name} (n=${pile.length})`);
  for (const [vn, label] of [['cur', 'v4 current'], ['A', 'v4+A'], ['AB', 'v4+A+B(LOVO)']]) P(`    ${label.padEnd(14)} ${summarize(pile, vn)}`);
}
P();

// 7
P('== 7) B LOVO fires that are leaks (truth x) ==');
const leaks = lovoRows.filter((r) => r.truth === 'x');
for (const r of leaks) P(`  [${r.set}] ${r.id} | ${r.vendor} | ${r.row.path} | ${r.row.operationId} | ${String(r.row.summary || '').slice(0, 80)} | word=${r.lovoWord} (${r.lovoWhere})`);
P(`  (${leaks.length} leaks)`);

// --veto variant: veto words keep a B-eligible row at x. Fixed list, two LOVO layers.
const vStart = out.length;
if (VETO) {
  const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ');
  const V_WORDS = 'url presigned job transaction refund reversal capture credit'.split(' ');
  const staticTokens = (row) => {
    const toks = [];
    for (const seg of String(row.path || '').split('/')) {
      if (seg === '' || isParam(seg)) continue;
      for (const piece of seg.split('#')) toks.push(...splitTokens(piece));
    }
    return toks;
  };
  for (const r of elig) {
    const toks = staticTokens(r.row);
    r.vm = V_WORDS.filter((v) => toks.some((t) => stemMatches(t, v) || t.includes(v)));
  }
  // keep the no-veto LOVO result for comparison
  for (const r of elig) { r.nvWord = r.lovoWord; r.nvWhere = r.lovoWhere; }
  const nvRows = elig.filter((r) => r.nvWord);
  const nvLeaks = nvRows.filter((r) => r.truth === 'x');
  const nc = cnt(); for (const r of nvRows) nc[r.truth]++;

  const vPile = (pile) => pile.filter((r) => r.bm.length > 0);
  const vStats = (pile) => {
    const m = new Map(V_WORDS.map((v) => [v, { c: cnt(), vx: new Map() }]));
    for (const r of vPile(pile)) for (const v of r.vm) { const e = m.get(v); e.c[r.truth]++; if (r.truth === 'x') e.vx.set(r.vendor, (e.vx.get(r.vendor) || 0) + 1); }
    return m;
  };
  const vAdmit = (m) => new Set(V_WORDS.filter((v) => m.get(v).c.x > m.get(v).c.w));
  const vetoed = (r, adm) => r.vm.some((v) => adm.has(v));

  // per fold
  const vAdmByV = new Map(), bAdmByV = new Map();
  for (const v0 of vendors) {
    const other = elig.filter((r) => r.vendor !== v0);
    const va = vAdmit(vStats(other));
    vAdmByV.set(v0, va);
    const m = stats(other.filter((r) => !vetoed(r, va)));
    bAdmByV.set(v0, new Set(B_WORDS.filter((w) => pass(m.get(w).c))));
  }
  for (const r of elig) {
    const va = vAdmByV.get(r.vendor), ba = bAdmByV.get(r.vendor);
    const hit = vetoed(r, va) ? null : r.bm.find((b) => ba.has(b.word));
    r.vWord = hit ? hit.word : null; r.vWhere = hit ? hit.where : null;
  }
  const vRows = elig.filter((r) => r.vWord);
  const vc = cnt(); for (const r of vRows) vc[r.truth]++;

  // a) veto words fitted
  const fullV = vStats(elig);
  P('== a) veto words, fitted on the B-matched floor pile (NOT quotable) ==');
  P(`  B-matched eligible floor rows: ${vPile(elig).length}`);
  P('  word         vetoed   r    w    x   vendors-with-x  top-vendor(share of x)   LOVO-folds-admitted (of ' + vendors.length + ')');
  for (const v of V_WORDS) {
    const e = fullV.get(v); const n = e.c.r + e.c.w + e.c.x;
    const top = [...e.vx].sort((a, b) => b[1] - a[1])[0];
    const folds = [...vAdmByV.values()].filter((s) => s.has(v)).length;
    P(`  ${v.padEnd(12)} ${String(n).padStart(6)} ${String(e.c.r).padStart(3)} ${String(e.c.w).padStart(4)} ${String(e.c.x).padStart(4)} ${String(e.vx.size).padStart(8)}          ${top ? `${top[0]} ${top[1]}/${e.c.x} (${pct(top[1], e.c.x)})` : '-'}   ${folds}`);
  }
  P();

  // b) B words with veto (fitted: veto words admitted on the full pile)
  const fitV = vAdmit(fullV);
  const fullB = stats(elig.filter((r) => !vetoed(r, fitV)));
  P('== b) B per word with veto, fitted (veto words admitted on the full pile: ' + ([...fitV].join(' ') || '(none)') + '; NOT quotable) ==');
  P('  word          fires  r    w    x   vendors  passes-bar(w>10x)  LOVO-folds-admitted   (* = word of interest)');
  for (const w of B_WORDS) {
    const e = fullB.get(w); const n = e.c.r + e.c.w + e.c.x;
    const folds = [...bAdmByV.values()].filter((s) => s.has(w)).length;
    P(`  ${w.padEnd(13)} ${String(n).padStart(5)} ${String(e.c.r).padStart(4)} ${String(e.c.w).padStart(4)} ${String(e.c.x).padStart(4)} ${String(e.v.size).padStart(7)}   ${pass(e.c) ? 'yes' : 'no '}                ${String(folds).padStart(4)}   ${['upload', 'file', 'create', 'note'].includes(w) ? '*' : ''}`);
  }
  P();

  // c) totals
  const ratioOf = (c) => (c.x === 0 ? Infinity : c.w / c.x);
  const verdict = (c) => ((c.x === 0 ? c.w >= 1 : c.w / c.x > 10) ? 'GO' : 'NO-GO');
  P('== c) B LOVO totals: with veto vs without ==');
  P(`  without veto (rows lowered ${nvRows.length}): right (truth w)=${nc.w}  new leaks (truth x)=${nc.x}  truth r one step closer=${nc.r}  ratio=${nc.x === 0 ? 'inf' : ratioOf(nc).toFixed(2)}  -> ${verdict(nc)} vs >10`);
  P(`  with veto    (rows lowered ${vRows.length}): right (truth w)=${vc.w}  new leaks (truth x)=${vc.x}  truth r one step closer=${vc.r}  ratio=${vc.x === 0 ? 'inf' : ratioOf(vc).toFixed(2)}  -> ${verdict(vc)} vs >10`);
  P();

  // d) joint
  const variants2 = {
    cur: variants.cur, AB: variants.AB,
    ABV: (r) => (r.post && r.isA ? { cls: 'x', rev: 'tight' } : r.post && r.vWord ? { cls: 'w', rev: 'loose' } : { cls: r.cur.class, rev: r.cur.review }),
  };
  const sum2 = (pile, vn) => {
    const t = { exact: 0, loose1: 0, loose2: 0, tight: 0 };
    for (const r of pile) t[bucket(variants2[vn](r).cls, r.truth)]++;
    return `exact=${t.exact} (${pct(t.exact, pile.length)}) loose-1=${t.loose1} loose-2=${t.loose2} too-tight=${t.tight}`;
  };
  P('== d) Joint: v4 current / v4+A+B(LOVO, no veto) / v4+A+B(LOVO, veto) ==');
  for (const [name, pile] of [['all rows', rows], ['POST rows', posts]]) {
    P(`  -- ${name} (n=${pile.length})`);
    for (const [vn, label] of [['cur', 'v4 current'], ['AB', 'v4+A+B no veto'], ['ABV', 'v4+A+B veto']]) P(`    ${label.padEnd(16)} ${sum2(pile, vn)}`);
  }
  P();

  // e) leaks
  const fmt = (r, w, wh) => `  [${r.set}] ${r.id} | ${r.vendor} | ${r.row.path} | ${r.row.operationId} | ${String(r.row.summary || '').slice(0, 80)} | word=${w} (${wh})`;
  const vLeaks = vRows.filter((r) => r.truth === 'x');
  P('== e) B LOVO leaks (truth x) under --veto ==');
  for (const r of vLeaks) P(fmt(r, r.vWord, r.vWhere));
  P(`  (${vLeaks.length} leaks)`);
  P('  -- leaks in the no-veto run that the veto run removed');
  const removed = nvLeaks.filter((r) => !r.vWord);
  for (const r of removed) P(fmt(r, r.nvWord, r.nvWhere) + ` | vetoed-by=${r.vm.join(',') || '(B word not admitted in fold)'}`);
  P(`  (${removed.length} removed)`);
  P('  -- leaks new in the veto run (not leaks in the no-veto run)');
  const fresh = vLeaks.filter((r) => !r.nvWord);
  for (const r of fresh) P(fmt(r, r.vWord, r.vWhere));
  P(`  (${fresh.length} new)`);
  // also: right lowerings lost to the veto
  const lostRight = nvRows.filter((r) => r.truth === 'w' && !r.vWord).length;
  const gainedRight = vRows.filter((r) => r.truth === 'w' && !r.nvWord).length;
  P(`  right lowerings (truth w) lost to veto: ${lostRight}; gained (word newly admitted once pile is cleaned): ${gainedRight}`);

  const vtsv = ['set\tid\tprovider\tpath\toperationId\ttruth\tcandidate\tword\tadmitted_in_lovo\tveto_words\tvetoed_in_fold'];
  for (const r of posts) {
    if (r.isA) vtsv.push([r.set, r.id, r.vendor, r.row.path, r.row.operationId, r.truth, 'A', r.probe.matched.join(','), '-', '-', '-'].map(clean).join('\t'));
    for (const b of r.bm) vtsv.push([r.set, r.id, r.vendor, r.row.path, r.row.operationId, r.truth, 'B', b.word, (bAdmByV.get(r.vendor) || new Set()).has(b.word) ? 'yes' : 'no', r.vm.join(',') || '-', r.vm.some((v) => (vAdmByV.get(r.vendor) || new Set()).has(v)) ? 'yes' : 'no'].map(clean).join('\t'));
  }
  fs.writeFileSync(new URL('./step3-veto-fires.tsv', import.meta.url), vtsv.join('\n') + '\n');
  fs.writeFileSync(new URL('./step3-veto-readout.txt', import.meta.url), out.slice(vStart).join('\n') + '\n');
  console.log(out.slice(vStart).join('\n'));
  process.exit(asserts.every(([, ok]) => ok) && probeRuleBad === 0 && probeBad === 0 ? 0 : 1);
}

// fires tsv
const tsv = ['set\tid\tprovider\tpath\toperationId\ttruth\tcandidate\tword\tadmitted_in_lovo'];
const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ');
for (const r of posts) {
  if (r.isA) tsv.push([r.set, r.id, r.vendor, r.row.path, r.row.operationId, r.truth, 'A', r.probe.matched.join(','), '-'].map(clean).join('\t'));
  for (const b of r.bm) tsv.push([r.set, r.id, r.vendor, r.row.path, r.row.operationId, r.truth, 'B', b.word, admitFor(r.vendor).has(b.word) ? 'yes' : 'no'].map(clean).join('\t'));
}
fs.writeFileSync(new URL('./step3-fires.tsv', import.meta.url), tsv.join('\n') + '\n');
fs.writeFileSync(new URL('./step3-readout.txt', import.meta.url), out.join('\n') + '\n');
console.log(out.join('\n'));
process.exit(asserts.every(([, ok]) => ok) && probeRuleBad === 0 && probeBad === 0 ? 0 : 1);
