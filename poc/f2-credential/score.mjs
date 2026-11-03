// poc/f2-credential/score.mjs — F2 POC: a credential noun on a write row
// raises it to x (BRIEF-v3 clause (b): resets/rotates/changes a credential,
// key, token, secret, certificate, session, password or consent is x).
//
// Tuning numbers only. Truth: data/combined-2026-09-21/labelled.csv (6557)
// and data/relabel-buildset-2026-09-23/labelled.csv (1819), scored as
// separate lines, never blended. Baseline is src classifyRow (read-only
// import). Jev raise-wx answers are the cached x-only runs in
// data/jev-tiers-2026-09-23/out-raise-wx-xonly{,-run2}.jsonl, applied
// through src applyJev at its default 0.80. APIs.guru prevalence reads
// data/corpus/apis-guru-ops.csv.gz (no truth).
//
// The rule only RAISES: a fired row becomes x; a row already x stays x.
//
// Usage: node poc/f2-credential/score.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../tools/csv.js';
import { classifyRow, applyJev, needsJev } from '../../src/index.js';
import { READ_VERBS } from '../../src/step1.js';
import { splitTokens, tokensForRow, leadVerbAfterModifiers, matchingMembers } from '../../src/tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

export const RANK = { r: 0, w: 1, x: 2 };

// Canonical word -> the single tokens that count as it (bare + plural).
// apikey/appkey also match as the two-token bigrams api+key, app+key.
export const NOUNS = {
  password: ['password', 'passwords'],
  passcode: ['passcode', 'passcodes'],
  pin: ['pin', 'pins'],
  secret: ['secret', 'secrets'],
  credential: ['credential', 'credentials'],
  apikey: ['apikey', 'apikeys'],
  appkey: ['appkey', 'appkeys'],
  token: ['token', 'tokens'],
  certificate: ['certificate', 'certificates'],
  cert: ['cert', 'certs'],
};
const TOKEN_TO_WORD = new Map();
for (const [w, forms] of Object.entries(NOUNS)) for (const f of forms) TOKEN_TO_WORD.set(f, w);
const BIGRAM_HEAD = { api: 'apikey', app: 'appkey' };

/** Canonical credential words found in a token array. */
export function wordsInTokens(tokens) {
  const out = new Set();
  for (let i = 0; i < tokens.length; i += 1) {
    const w = TOKEN_TO_WORD.get(tokens[i]);
    if (w) out.add(w);
    const head = BIGRAM_HEAD[tokens[i]];
    if (head && (tokens[i + 1] === 'key' || tokens[i + 1] === 'keys')) out.add(head);
  }
  return out;
}

/** Tokens of non-{param} path segments, split by src's splitter. */
export function pathTokens(p) {
  const out = [];
  for (const seg of String(p || '').split('/')) {
    if (!seg || (seg.startsWith('{') && seg.endsWith('}'))) continue;
    out.push(...splitTokens(seg));
  }
  return out;
}

export function summaryTokens(s) {
  return String(s || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/** Credential words in operationId + path (C1/C3), and with summary (C2). */
export function credWords(row, withSummary) {
  const ws = wordsInTokens(tokensForRow(row));
  for (const w of wordsInTokens(pathTokens(row.path))) ws.add(w);
  if (withSummary) for (const w of wordsInTokens(summaryTokens(row.summary))) ws.add(w);
  return ws;
}

export function readLead(row) {
  return matchingMembers(leadVerbAfterModifiers(row), READ_VERBS).length > 0;
}

// Data-suggested variants (V*) were added AFTER reading the C1/C2 fires on
// the combined set, so they are fitted to those rows by construction; only
// their LOVO and buildset lines say anything.
export const CHANGE_VERBS = new Set(['change', 'regenerate', 'regen']);

/** V1 gate: the lead verb is a change/regenerate verb. */
export function changeLead(row) {
  return matchingMembers(leadVerbAfterModifiers(row), CHANGE_VERBS).length > 0;
}

/** V2 gate: the last path segment is literal and its last token is a credential noun. */
export function endpointWords(row) {
  const segs = String(row.path || '').split('/').filter(Boolean);
  const last = segs[segs.length - 1] || '';
  if (!last || (last.startsWith('{') && last.endsWith('}'))) return new Set();
  const toks = splitTokens(last);
  const w = wordsInTokens(toks.slice(-2));
  // only a noun that ends the segment counts (api_keys, password; not password_rules)
  const end = toks[toks.length - 1];
  return TOKEN_TO_WORD.has(end) || end === 'key' || end === 'keys' ? w : new Set();
}

export const CANDIDATES = {
  C1: { methods: new Set(['PUT', 'PATCH']), summary: false },
  C2: { methods: new Set(['PUT', 'PATCH']), summary: true },
  C3: { methods: new Set(['PUT', 'PATCH', 'POST']), summary: false },
  V1: { methods: new Set(['PUT', 'PATCH']), summary: true, gate: 'change', note: 'variant: C2 + lead verb change/regenerate/regen' },
  V2: { methods: new Set(['PUT', 'PATCH']), summary: false, gate: 'endpoint', note: 'variant: last path segment is a literal credential noun' },
  V3: { methods: new Set(['PUT', 'PATCH']), summary: true, gate: 'either', note: 'variant: V1 or V2' },
  V4: { methods: new Set(['PUT', 'PATCH']), summary: true, gate: 'either', only: new Set(['password', 'passcode', 'pin']), note: 'variant: V3 limited to password/passcode/pin' },
};

/**
 * The words a candidate fires on for one row ([] = no fire). `excluded`
 * is true when a noun was present but the lead verb is a read verb.
 */
export function fireWords(row, cand) {
  const m = (row.method || '').toUpperCase();
  if (!cand.methods.has(m)) return { words: [], excluded: false };
  let ws = credWords(row, cand.summary);
  if (cand.gate) {
    const v1 = changeLead(row) ? ws : new Set();
    const v2 = endpointWords(row);
    ws = cand.gate === 'change' ? v1 : cand.gate === 'endpoint' ? v2 : new Set([...v1, ...v2]);
  }
  if (cand.only) ws = new Set([...ws].filter((w) => cand.only.has(w)));
  if (ws.size === 0) return { words: [], excluded: false };
  if (readLead(row)) return { words: [], excluded: true };
  return { words: [...ws].sort(), excluded: false };
}

/** F2 never lowers: fires -> x, else unchanged. */
export function raise(cls, fires) {
  return fires ? 'x' : cls;
}

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

/** Move tally over rows that fire: moved = before != x. */
export function tally(rows, beforeKey) {
  const t = { fires: 0, alreadyX: 0, moved: 0, right: 0, wrongW: 0, wrongR: 0, leaksClosed: 0, fromR: 0 };
  for (const r of rows) {
    t.fires += 1;
    const b = r[beforeKey];
    if (b === 'x') { t.alreadyX += 1; continue; }
    t.moved += 1;
    if (b === 'r') t.fromR += 1;
    if (r.truth === 'x') { t.right += 1; t.leaksClosed += 1; }
    else if (r.truth === 'w') t.wrongW += 1;
    else t.wrongR += 1;
  }
  t.wrong = t.wrongW + t.wrongR;
  return t;
}

/** Per-word stats over moved rows (mechanical before). */
export function wordStats(rows) {
  const s = new Map();
  for (const r of rows) {
    for (const w of r.words) {
      if (!s.has(w)) s.set(w, { fires: 0, alreadyX: 0, moved: 0, right: 0, wrong: 0, vendors: new Set() });
      const e = s.get(w);
      e.fires += 1;
      e.vendors.add(r.provider);
      if (r.mech === 'x') { e.alreadyX += 1; continue; }
      e.moved += 1;
      if (r.truth === 'x') e.right += 1; else e.wrong += 1;
    }
  }
  return s;
}

/**
 * Leave-one-vendor-out. `fired` = rows with words (mech before). Per fold,
 * keep a word when right >= wrong on the other vendors' moved rows
 * (strict: also right > 0); a held-out row fires when one of its words is kept.
 */
export function lovo(fired, strict) {
  const vendors = [...new Set(fired.map((r) => r.provider))].sort();
  const pooled = { moved: 0, right: 0, wrongW: 0, wrongR: 0, wrong: 0 };
  const folds = [];
  for (const v of vendors) {
    const stats = wordStats(fired.filter((r) => r.provider !== v));
    const kept = (w) => {
      const e = stats.get(w) || { right: 0, wrong: 0 };
      return e.right >= e.wrong && (!strict || e.right > 0);
    };
    const f = { vendor: v, moved: 0, right: 0, wrong: 0, dropped: new Set() };
    for (const r of fired.filter((x) => x.provider === v)) {
      const k = r.words.filter(kept);
      for (const w of r.words) if (!kept(w)) f.dropped.add(w);
      if (k.length === 0 || r.mech === 'x') continue;
      f.moved += 1; pooled.moved += 1;
      if (r.truth === 'x') { f.right += 1; pooled.right += 1; }
      else { f.wrong += 1; pooled.wrong += 1; if (r.truth === 'w') pooled.wrongW += 1; else pooled.wrongR += 1; }
    }
    folds.push(f);
  }
  return { pooled, folds };
}

// ---- I/O ------------------------------------------------------------------

function readJsonl(p) {
  const map = new Map();
  let bad = 0;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const o = JSON.parse(line); map.set(o.row_id, o); } catch { bad += 1; }
  }
  return { map, bad };
}

function jevAnswer(o) {
  if (!o || o.error) return null;
  const a = o.answers && o.answers.isX;
  if (!a || typeof a.noul !== 'number') return null;
  return { p: a.noul, model: o.model };
}

function loadSet(rel) {
  const all = parseCsv(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  const rows = [];
  let skipped = 0;
  for (const r of all) {
    if (RANK[r.truth_class] === undefined) { skipped += 1; continue; }
    const v = classifyRow(r);
    rows.push({ ...r, truth: r.truth_class, verdict: v, mech: v.class });
  }
  return { rows, skipped, read: all.length };
}

// ---- reporting --------------------------------------------------------------

const pct = (n, d) => (d === 0 ? '0.0%' : `${((100 * n) / d).toFixed(1)}%`);
const L = (l) => `${l.exact} exact (${pct(l.exact, l.n)}) / ${l.leak} too loose (${pct(l.leak, l.n)}) / ${l.over} too tight (${pct(l.over, l.n)})`;
const trunc = (s, n) => { const t = String(s || '').replace(/\s+/g, ' '); return t.length > n ? `${t.slice(0, n - 1)}~` : t; };

function scoreSet(name, rel, jevRuns, listRows) {
  const { rows, skipped, read } = loadSet(rel);
  console.log(`\n================ ${name}: ${rel}`);
  console.log(`read ${read} rows; skipped ${skipped} (truth not r/w/x); scored ${rows.length}`);

  // Jev raise-wx (cached) on the method-floor pile.
  const ids = new Set(rows.map((r) => r.row_id));
  for (const [runName, file] of jevRuns) {
    const { map, bad } = readJsonl(path.join(ROOT, file));
    let pile = 0, joined = 0, missing = 0, unusable = 0, raised = 0;
    for (const r of rows) {
      let c = r.mech;
      if (needsJev(r.verdict) === 'jev-raise-wx') {
        pile += 1;
        const o = map.get(r.row_id);
        if (!o) missing += 1;
        else {
          joined += 1;
          const ans = jevAnswer(o);
          if (!ans) unusable += 1;
          else {
            const moved = applyJev(r.verdict, ans, { method: r.method });
            if (moved.class !== c) raised += 1;
            c = moved.class;
          }
        }
      }
      r[runName] = c;
    }
    let notInSet = 0;
    for (const id of map.keys()) if (!ids.has(id)) notInSet += 1;
    console.log(`jev ${runName} (${file}): method-floor pile ${pile}; answers joined ${joined}, pile rows with no answer ${missing} (stay w), unusable/errored ${unusable} (stay w), malformed lines ${bad}; answers for rows not in this set ${notInSet} (ignored); raised to x at 0.80: ${raised}`);
  }

  const runs = ['mech', ...jevRuns.map(([n]) => n)];
  const base = {};
  for (const k of runs) base[k] = ledger(rows.map((r) => [r[k], r.truth]));

  const results = {};
  for (const [cn, cand] of Object.entries(CANDIDATES)) {
    let excluded = 0;
    const excludedRows = [];
    const fired = [];
    for (const r of rows) {
      const f = fireWords(r, cand);
      if (f.excluded) { excluded += 1; excludedRows.push(r); }
      r[`w_${cn}`] = f.words;
      if (f.words.length) fired.push({ ...r, words: f.words });
    }
    console.log(`\n---- ${name} ${cn} (${[...cand.methods].join('/')}, noun in operationId+path${cand.summary ? '+summary' : ''})${cand.note ? ` [${cand.note}]` : ''}`);
    console.log(`rows with a credential noun excluded for a read lead verb: ${excluded}` +
      (excludedRows.length ? ` [${excludedRows.slice(0, 10).map((r) => `${r.row_id} ${r.method} ${r.operationId || r.path} truth ${r.truth}`).join('; ')}${excludedRows.length > 10 ? ' ...' : ''}]` : ''));

    // 1. fires
    for (const k of runs) {
      const t = tally(fired, k);
      console.log(`[1] fires vs ${k}: ${t.fires} fires of ${rows.length} rows; already x ${t.alreadyX}; moved ${t.moved}` +
        ` -> right (truth x, leak closed) ${t.right}, wrong truth w ${t.wrongW}, wrong truth r ${t.wrongR}; moved from r ${t.fromR}`);
      if (k === 'mech') results[cn] = { t, fired };
    }
    // by method, mechanical
    const byM = {};
    for (const r of fired) { const m = r.method.toUpperCase(); (byM[m] ||= []).push(r); }
    for (const [m, rs] of Object.entries(byM)) {
      const t = tally(rs, 'mech');
      console.log(`    ${m}: fires ${t.fires}, already x ${t.alreadyX}, moved ${t.moved}, right ${t.right}, wrong w ${t.wrongW}, wrong r ${t.wrongR}`);
    }

    // 2. whole set
    for (const k of runs) {
      const after = ledger(rows.map((r) => [raise(r[k], r[`w_${cn}`].length > 0), r.truth]));
      console.log(`[2] ${k}: before ${L(base[k])} | after ${L(after)}  of ${rows.length}`);
      results[cn][`after_${k}`] = after;
      results[cn][`before_${k}`] = base[k];
    }

    // 3. per word
    const ws = wordStats(fired);
    console.log('[3] per word (mechanical): word fires alreadyX moved right wrong vendors');
    for (const [w, e] of [...ws.entries()].sort((a, b) => b[1].fires - a[1].fires)) {
      console.log(`    ${w.padEnd(12)} ${String(e.fires).padStart(4)} ${String(e.alreadyX).padStart(4)} ${String(e.moved).padStart(4)} ${String(e.right).padStart(4)} ${String(e.wrong).padStart(4)}  ${[...e.vendors].sort().join(',')}`);
    }

    // 4. LOVO
    for (const strict of [false, true]) {
      const { pooled, folds } = lovo(fired, strict);
      const label = strict ? 'strict (right>=wrong and right>0)' : 'literal (right>=wrong)';
      console.log(`[4] LOVO ${label}: pooled moved ${pooled.moved}, leaks closed ${pooled.right}, new over-tight ${pooled.wrong} (w ${pooled.wrongW}, r ${pooled.wrongR}); ${pooled.right > pooled.wrong ? 'right > wrong' : 'right <= wrong'}`);
      const notable = folds.filter((f) => f.moved || f.dropped.size);
      for (const f of notable) console.log(`    fold ${f.vendor}: moved ${f.moved}, right ${f.right}, wrong ${f.wrong}${f.dropped.size ? `; words dropped ${[...f.dropped].sort().join(',')}` : ''}`);
      results[cn][strict ? 'lovoStrict' : 'lovo'] = pooled;
    }

    // vendor concentration
    const vc = {};
    for (const r of fired) vc[r.provider] = (vc[r.provider] || 0) + 1;
    const top = Object.entries(vc).sort((a, b) => b[1] - a[1]);
    const share = top.length ? top[0][1] / fired.length : 0;
    console.log(`    fires per vendor: ${top.map(([v, n]) => `${v} ${n}`).join(', ')}; top share ${pct(top.length ? top[0][1] : 0, fired.length)}${share > 0.5 ? ' FLAG: >50% one vendor (fitting)' : ''}`);
    results[cn].topShare = share;

    // 6. listing
    if (listRows) {
      const mv = (r) => r.mech !== 'x';
      let list = fired;
      if (fired.length > 150) {
        const wrong = fired.filter((r) => mv(r) && r.truth !== 'x');
        const right = fired.filter((r) => mv(r) && r.truth === 'x').slice(0, 40);
        list = [...wrong, ...right];
        console.log(`[6] ${fired.length} fires > 150: listing all ${wrong.length} wrong moves + ${right.length} right moves`);
      } else console.log(`[6] all ${fired.length} fires:`);
      console.log('    row_id | provider | method | path | operationId | summary | truth | before(mech rule) | after | words');
      for (const r of list) {
        console.log(`    ${r.row_id} | ${r.provider} | ${r.method} | ${r.path} | ${r.operationId} | ${trunc(r.summary, 80)} | ${r.truth} | ${r.mech}(${r.verdict.rule}) | x | ${r.words.join(',')}`);
      }
    }
  }
  return { results, n: rows.length };
}

function verdictLine(name, res) {
  for (const [cn, r] of Object.entries(res)) {
    const t = r.t;
    const a = r.after_mech, b = r.before_mech;
    const checks = [
      [`moves right ${t.right} > wrong ${t.wrong}`, t.right > t.wrong],
      [`too loose ${b.leak} -> ${a.leak} not up`, a.leak <= b.leak],
      [`too tight +${a.over - b.over} == wrong ${t.wrong}`, a.over - b.over === t.wrong],
      [`LOVO right ${r.lovo.right} > wrong ${r.lovo.wrong}`, r.lovo.right > r.lovo.wrong],
    ];
    for (const k of Object.keys(r).filter((x) => x.startsWith('after_') && x !== 'after_mech')) {
      const kk = k.slice(6);
      checks.push([`jev ${kk} too loose ${r[`before_${kk}`].leak} -> ${r[k].leak} not up`, r[k].leak <= r[`before_${kk}`].leak]);
    }
    const pass = checks.every(([, ok]) => ok);
    console.log(`${name} ${cn}: ${pass ? 'PASS' : 'FAIL'}  ${checks.map(([s, ok]) => `${ok ? 'ok' : 'NO'}: ${s}`).join('; ')}${r.topShare > 0.5 ? '; FLAG fitting (top vendor >50%)' : ''}`);
  }
}

function prevalence() {
  const text = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'data/corpus/apis-guru-ops.csv.gz'))).toString('utf8');
  const all = parseCsv(text);
  console.log(`\n================ APIs.guru prevalence: ${all.length} ops read (no truth)`);
  for (const [cn, cand] of Object.entries(CANDIDATES)) {
    const vc = {}; let fires = 0, excluded = 0, moved = 0;
    const wc = {};
    for (const r of all) {
      const f = fireWords(r, cand);
      if (f.excluded) excluded += 1;
      if (!f.words.length) continue;
      fires += 1;
      if (classifyRow(r).class !== 'x') moved += 1;
      vc[r.provider] = (vc[r.provider] || 0) + 1;
      for (const w of f.words) wc[w] = (wc[w] || 0) + 1;
    }
    const top = Object.entries(vc).sort((a, b) => b[1] - a[1]);
    console.log(`[5] ${cn}: ${fires} fires (would move ${moved} not already x) across ${top.length} providers; read-lead excluded ${excluded}; top share ${pct(top.length ? top[0][1] : 0, fires)}`);
    console.log(`    top 10: ${top.slice(0, 10).map(([v, n]) => `${v} ${n}`).join(', ')}`);
    console.log(`    per word: ${Object.entries(wc).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${n}`).join(', ')}`);
  }
}

function main() {
  const jev = [
    ['jev1', 'data/jev-tiers-2026-09-23/out-raise-wx-xonly.jsonl'],
    ['jev2', 'data/jev-tiers-2026-09-23/out-raise-wx-xonly-run2.jsonl'],
  ];
  const comb = scoreSet('combined', 'data/combined-2026-09-21/labelled.csv', jev, true);
  const build = scoreSet('buildset', 'data/relabel-buildset-2026-09-23/labelled.csv', jev, false);
  prevalence();
  console.log('\n================ BAR (D100 tighten-only; mechanical move counts; LOVO literal)');
  verdictLine('combined', comb.results);
  verdictLine('buildset', build.results);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
