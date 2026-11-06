// Step 2 measurement: candidate path words that would pull a floor-w PUT/PATCH row up to x.
// Measurement only; changes nothing in flow/steps.
import fs from 'node:fs';
import { loadSets } from './sets.mjs';
import { classifyRow } from './flow.js';
import { splitTokens, stemMatches } from './tokens.js';

const FAMILIES = {
  F1: 'role permission member membership collaborator grant acl access policy scope share shared_link sharing invite invitation allowlist trusted sso idp identity_provider oauth authorization mfa scim protection'.split(' '),
  F2: 'key api_key token secret credential certificate password pass signing'.split(' '),
  F3: 'webhook hook integration destination logpush log_stream logsink log_drain forwarding event_stream subscription channel connection'.split(' '),
  F4: 'stop cancel abort finalize promote migrate upgrade downgrade regenerate roll revoke unblock deny verify complete reactivate failover'.split(' '),
};
const MODES = ['A', 'B', 'C'];
const SITE_ARG = process.argv.find((a) => a.startsWith('--site='));
const SITE = SITE_ARG ? SITE_ARG.slice(7) : 'any';
if (SITE !== 'any' && SITE !== 'target') { console.error('--site must be any or target'); process.exit(1); }
const isParam = (s) => s.startsWith('{') && s.endsWith('}');

// Returns {all: string[][] pieces of every static segment, last: string[][] pieces of trailing-action segment or []}
function pathUnits(path) {
  const segs = String(path || '').split('/').filter((s) => s !== '');
  const all = [];
  let lastIdx = -1;
  let paramBefore = false;
  let lastAfterParam = false;
  segs.forEach((s, i) => {
    if (isParam(s)) { paramBefore = true; return; }
    all.push(...s.split('#').map(splitTokens).filter((t) => t.length));
    lastIdx = i;
    lastAfterParam = paramBefore;
  });
  const tgt = lastIdx >= 0 ? segs[lastIdx].split('#').map(splitTokens).filter((t) => t.length) : [];
  let last = [];
  if (lastIdx >= 0 && (lastIdx === segs.length - 1 || lastAfterParam)) {
    last = segs[lastIdx].split('#').map(splitTokens).filter((t) => t.length);
  }
  return { all, last, tgt };
}

// matched token strings for a word under a mode within pieces
function match(word, pieces, mode) {
  const parts = word.split('_');
  const out = [];
  for (const toks of pieces) {
    if (parts.length === 1) {
      for (const t of toks) {
        const a = t === word;
        const b = a || stemMatches(t, word);
        const c = b || t.includes(word);
        if (mode === 'A' ? a : mode === 'B' ? b : c) out.push(t);
      }
    } else {
      const n = parts.length;
      for (let i = 0; i + n <= toks.length; i++) {
        let ok = true;
        for (let k = 0; k < n - 1 && ok; k++) ok = toks[i + k] === parts[k];
        if (!ok) continue;
        const last = toks[i + n - 1];
        const ok2 = mode === 'A' ? last === parts[n - 1] : last === parts[n - 1] || stemMatches(last, parts[n - 1]);
        if (ok2) out.push(toks.slice(i, i + n).join(' '));
      }
      if (mode === 'C') {
        const g = parts.join('');
        for (const t of toks) if (t.includes(g)) out.push(t);
      }
    }
  }
  return [...new Set(out)];
}
// C-only tokens: contain the word (glued) but are not a B match
function cOnlyTokens(word, pieces) {
  const parts = word.split('_');
  const g = parts.join('');
  const bset = new Set(match(word, pieces, 'B'));
  const out = new Set();
  for (const toks of pieces) for (const t of toks) {
    if (t.includes(g) && !bset.has(t)) out.add(t);
  }
  return [...out];
}

// ---- pile
const sets = loadSets();
const pile = [];
for (const s of sets) {
  const m = String(s.row.method || '').toUpperCase();
  if (m !== 'PUT' && m !== 'PATCH') continue;
  if (!s.v4) continue;
  if (classifyRow(s.row).source !== 'floor') continue;
  pile.push({ ...s, vendor: s.row.provider, method: m, truth: s.v4 });
}
const cnt = { x: 0, w: 0, r: 0 };
for (const p of pile) cnt[p.truth] = (cnt[p.truth] || 0) + 1;
if (pile.length !== 2927 || cnt.x !== 682 || cnt.w !== 2242 || cnt.r !== 3) {
  console.error(`ASSERT FAIL pile=${pile.length} x/w/r=${cnt.x}/${cnt.w}/${cnt.r}`);
  process.exit(1);
}
if (pile.some((p) => !p.vendor)) { console.error('ASSERT FAIL: row without provider'); process.exit(1); }

// ---- fires: fire[mode][family][word] = Set of row indices ; tokens for C
const words = [];
for (const [fam, ws] of Object.entries(FAMILIES)) for (const w of ws) words.push({ fam, w });
const key = (m, w) => m + '|' + w;
const buildFires = (site) => {
  const rowFires = pile.map(() => new Map()); // key -> matched tokens
  const nonB = new Map(); // word -> Map token -> {x,w,r}
  pile.forEach((p, i) => {
    const u = pathUnits(p.row.path);
    for (const { fam, w } of words) {
      const pieces = fam === 'F4' ? u.last : (site === 'target' ? u.tgt : u.all);
      for (const m of MODES) {
        const t = match(w, pieces, m);
        if (t.length) rowFires[i].set(key(m, w), t);
      }
      for (const t of cOnlyTokens(w, pieces)) {
        if (!nonB.has(w)) nonB.set(w, new Map());
        const mm = nonB.get(w);
        if (!mm.has(t)) mm.set(t, { x: 0, w: 0, r: 0 });
        mm.get(t)[p.truth]++;
      }
    }
  });
  return { rowFires, nonB };
};
const { rowFires, nonB } = buildFires(SITE);

const out = [];
const P = (s = '') => out.push(s);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');

function stat(rowsIdx) {
  const c = { n: rowsIdx.length, x: 0, w: 0, r: 0 };
  const vx = new Map();
  for (const i of rowsIdx) {
    c[pile[i].truth]++;
    if (pile[i].truth === 'x') vx.set(pile[i].vendor, (vx.get(pile[i].vendor) || 0) + 1);
  }
  let top = '-', topN = 0;
  for (const [v, n] of vx) if (n > topN) { top = v; topN = n; }
  return { ...c, vendors: vx.size, top, topShare: c.x ? pct(topN, c.x) : 'n/a', topN };
}
const rowsFiring = (ws, m) => pile.map((_, i) => i).filter((i) => ws.some((w) => rowFires[i].has(key(m, w))));
const fmt = (s) => `fired=${s.n} x=${s.x} w=${s.w} r=${s.r} xVendors=${s.vendors} topVendorXShare=${s.topShare}${s.x ? ` (${s.topN}/${s.x} ${s.top})` : ''}`;

// 1
P('== 1. Pile ==');
P(`rows=${pile.length}  truth x/w/r=${cnt.x}/${cnt.w}/${cnt.r}`);
P(`vendors=${new Set(pile.map((p) => p.vendor)).size}`);
for (const m of ['PUT', 'PATCH']) {
  const r = pile.filter((p) => p.method === m);
  P(`${m}: ${r.length} rows, x=${r.filter((p) => p.truth === 'x').length} w=${r.filter((p) => p.truth === 'w').length} r=${r.filter((p) => p.truth === 'r').length}`);
}
P();
// 2
P('== 2. Per family x mode ==');
for (const fam of Object.keys(FAMILIES)) for (const m of MODES) P(`${fam} ${m}: ${fmt(stat(rowsFiring(FAMILIES[fam], m)))}`);
P();
// 3
P('== 3. Per word x mode (sorted by x fires desc within family, per mode) ==');
for (const m of MODES) for (const fam of Object.keys(FAMILIES)) {
  P(`-- ${fam} mode ${m}`);
  const rows = FAMILIES[fam].map((w) => ({ w, s: stat(rowsFiring([w], m)) })).sort((a, b) => b.s.x - a.s.x || b.s.w - a.s.w);
  for (const { w, s } of rows) P(`  ${w.padEnd(18)} ${fmt(s)}`);
}
P();
// 4
P('== 4. Mode C only: tokens a word was found inside that are NOT a B match ==');
for (const { fam, w } of words) {
  const mm = nonB.get(w);
  if (!mm) continue;
  const items = [...mm].sort((a, b) => (b[1].x + b[1].w + b[1].r) - (a[1].x + a[1].w + a[1].r));
  P(`${fam} ${w}: ` + items.map(([t, c]) => `${t}(x${c.x}/w${c.w}/r${c.r})`).join(' '));
}
P();
// 5
function lovo(ws, m, fitted) {
  const vendors = [...new Set(pile.map((p) => p.vendor))];
  const res = { x: 0, w: 0, r: 0 };
  const stats = (i, list) => list.filter((w) => rowFires[i].has(key(m, w)));
  const admit = (excl) => {
    const a = [];
    for (const w of ws) {
      let x = 0, ww = 0;
      pile.forEach((p, i) => {
        if (excl && p.vendor === excl) return;
        if (!rowFires[i].has(key(m, w))) return;
        if (p.truth === 'x') x++; else if (p.truth === 'w') ww++;
      });
      if (x > ww) a.push(w);
    }
    return a;
  };
  if (fitted) {
    const a = admit(null);
    pile.forEach((p, i) => { if (stats(i, a).length) res[p.truth]++; });
  } else {
    for (const v of vendors) {
      const a = admit(v);
      pile.forEach((p, i) => { if (p.vendor === v && stats(i, a).length) res[p.truth]++; });
    }
  }
  return `closed(x raised)=${res.x} newTight(w raised)=${res.w} r raised=${res.r} remainingLeaks=${cnt.x - res.x}/${cnt.x}`;
}
P('== 5. Leave-one-vendor-out (admit word iff x fires > w fires on other vendors) ==');
const scopes = [...Object.keys(FAMILIES).map((f) => [f, FAMILIES[f]]), ['ALL', words.map((x) => x.w)]];
for (const [name, ws] of scopes) for (const m of MODES) {
  P(`${name} ${m} LOVO:   ${lovo(ws, m, false)}`);
  P(`${name} ${m} fitted (not quotable): ${lovo(ws, m, true)}`);
}
P();
// 6
P('== 6. Words failing the bar on the full pile (x fires <= w fires) ==');
for (const m of MODES) {
  P(`-- mode ${m}`);
  for (const { fam, w } of words) {
    const s = stat(rowsFiring([w], m));
    if (s.x <= s.w) P(`  ${fam} ${w} x=${s.x} w=${s.w} r=${s.r}`);
  }
}

if (SITE === 'target') {
  const raisedC = (rf) => {
    const vendors = [...new Set(pile.map((p) => p.vendor))];
    const res = pile.map(() => []);
    const ws = words.map((x) => x.w);
    for (const v of vendors) {
      const adm = [];
      for (const w of ws) {
        let x = 0, ww = 0;
        pile.forEach((p, i) => {
          if (p.vendor === v || !rf[i].has(key('C', w))) return;
          if (p.truth === 'x') x++; else if (p.truth === 'w') ww++;
        });
        if (x > ww) adm.push(w);
      }
      pile.forEach((p, i) => { if (p.vendor === v) res[i] = adm.filter((w) => rf[i].has(key('C', w))); });
    }
    return res;
  };
  const ra = raisedC(buildFires('any').rowFires);
  const rt = raisedC(rowFires);
  const g = { a: [], b: [], c: [], d: [] };
  pile.forEach((p, i) => {
    const ia = ra[i].length > 0, it = rt[i].length > 0;
    if (ia === it) return;
    const line = `  ${p.vendor}\t${p.method}\t${p.row.path}\ttruth=${p.truth}\t${(ia ? ra[i] : rt[i]).join(',')}`;
    if (ia) { if (p.truth === 'x') g.a.push(line); else if (p.truth === 'w') g.b.push(line); }
    else if (p.truth === 'x') g.c.push(line); else if (p.truth === 'w') g.d.push(line);
  });
  P();
  P('== 7. any vs target, mode C, LOVO, all families ==');
  P(`(a) truth x raised by any not target (fixes lost)=${g.a.length}`);
  P(`(b) truth w raised by any not target (false fires removed)=${g.b.length}`);
  P(`(c) truth x raised by target only=${g.c.length}`);
  P(`(d) truth w raised by target only=${g.d.length}`);
  for (const [k, t] of [['a', '(a) fixes lost'], ['b', '(b) false fires removed'], ['c', '(c) x raised by target only'], ['d', '(d) w raised by target only']]) {
    P(`-- ${t}`);
    for (const l of g[k]) P(l);
  }
}
const text = out.join('\n') + '\n';
const sfx = SITE === 'target' ? '-target' : '';
const dir = new URL('./', import.meta.url);
fs.writeFileSync(new URL(`step2${sfx}-readout.txt`, dir), text);
console.log(text);

// tsv
const lines = [];
pile.forEach((p, i) => {
  for (const { fam, w } of words) {
    const c = rowFires[i].get(key('C', w));
    if (!c) continue;
    lines.push({ fam, w, truth: p.truth, line: [p.set, p.id, p.vendor, p.method, p.row.path, p.truth, fam, w, c.join('|'), rowFires[i].has(key('A', w)) ? 'A' : '-', rowFires[i].has(key('B', w)) ? 'B' : '-'].join('\t') });
  }
});
lines.sort((a, b) => a.fam.localeCompare(b.fam) || a.w.localeCompare(b.w) || a.truth.localeCompare(b.truth));
fs.writeFileSync(new URL(`step2${sfx}-fires.tsv`, dir), ['set\tid\tprovider\tmethod\tpath\ttruth\tfamily\tword\tmatched_token\tA\tB', ...lines.map((l) => l.line)].join('\n') + '\n');
