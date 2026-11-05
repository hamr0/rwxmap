// D133 rule comparison on rwxlite's fresh 949 rows (TUNING data, not an exam).
// Scores: 0 mechanical alone, 1 rwxlite's tier rule (independent), 2 rwxmap's real secondPass().
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { classifyRow } from '../../src/flow.js';
import { secondPass } from '../../src/secondpass.js';

const RANK = { r: 0, w: 1, x: 2 };
const LETTER = ['r', 'w', 'x'];
const TIER = { 'jev-lower': 'lower', 'jev-raise-wx': 'raise-wx', 'jev-raise-get': 'raise-get' };
const CUT = { lower: 0.30, rcut: 0.40, raiseWx: 0.15, raiseGet: 0.05 };
const ASK_BELOW = 0.97;
const NOUN = '(?:password|passcode|passphrase|pin|pin code|auth key|authkey|api key|apikey|api secret|secret key|client secret)s?';
const CRED = new RegExp('\\b(?:change|reset|rotate|regenerate|renew|revoke|invalidate|expire)\\b(?: \\w+){0,3}? ' + NOUN + '\\b(?! (?:polic|rule|requirement|complexity|setting|config))');
const norm = (s) => String(s ?? '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[^A-Za-z0-9]+/g, ' ').toLowerCase();
const credHit = (st) => String(st.method).toUpperCase() !== 'GET' && ['operationId', 'summary', 'path'].some((f) => CRED.test(norm(st[f])));

/** Rule 1: rwxlite's tier rule, written from the PRD text. */
export function rule1(row, mechLetter) {
  const tier = TIER[row.jev_tier] ?? 'none';
  const { isX, changes } = row;
  const pr = 1 - changes, pw = changes - isX;
  let m = RANK[mechLetter];
  if (tier === 'lower' && m === 2 && isX < CUT.lower) m = (row.state.method === 'POST' && changes < CUT.rcut) ? 0 : 1;
  else if (tier === 'raise-wx' && m === 1 && isX >= CUT.raiseWx) m = 2;
  else if (tier === 'raise-get' && m === 0 && changes >= CUT.raiseGet) m = 1;
  if (credHit(row.state)) m = 2;
  const lowering = m < RANK[mechLetter];
  const asked = lowering && Math.max(pr, pw, isX) < ASK_BELOW;
  return { letter: LETTER[m], asked, mech: mechLetter };
}

export function score(items) { // items: {pred, truth}
  const c = { n: items.length, exact: 0, loose: 0, tight: 0 };
  for (const { pred, truth } of items) {
    if (pred === truth) c.exact++; else if (RANK[pred] < RANK[truth]) c.loose++; else c.tight++;
  }
  return c;
}

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const lines = (b) => b.toString('utf8').split(/\r?\n/).filter(Boolean);

async function main() {
  const dir = '../../data/rwxlite-fresh-2026-11-03/';
  const rows = lines(gunzipSync(readFileSync(here(dir + 'decision.jsonl.gz')))).map((l) => JSON.parse(l));
  const truth = new Map(lines(readFileSync(here(dir + 'truth.csv'))).slice(1).map((l) => l.split(',')));
  const rulings = lines(readFileSync(here(dir + 'rulings.csv'))).slice(1).map((l) => l.split(',')).map((a) => [a[0], a[3]]);
  const vendor = new Map(lines(gunzipSync(readFileSync(here(dir + 'ops.csv.gz')))).slice(1).map((l) => [l.split(',')[0], l.split(',')[1]]));
  const labA = null;
  const N = rows.length;
  const out = [];
  const P = (s = '') => out.push(s);
  const pct = (k) => `${k} (${(100 * k / N).toFixed(1)}%)`;

  P('D133 rule comparison on rwxlite fresh-exam 949 rows. TUNING data, NOT an exam for rwxmap (rwxlite burned it).');
  P('Note: fixture p are from the int8 per-channel model; rwxmap default model is fp32 (rwxlite: 7 rows differ under its rule).');
  P(`rows ${N}; truth rows ${truth.size}; vendor rows ${vendor.size}`);
  const rulingMismatch = rulings.filter(([id, r]) => truth.get(id) !== r);
  P(`rulings.csv: ${rulings.length} rulings; truth.csv label differs from ruling on ${rulingMismatch.length} (${rulingMismatch.map((x) => x[0]).join(',') || 'none'}) -> truth already includes the rulings: ${rulingMismatch.length === 0}`);

  // Rule 0: mechanical
  const ops = rows.map((r) => ({ method: r.state.method, path: r.state.path, operationId: r.state.operationId, summary: r.state.summary, description: r.state.description }));
  const mech = ops.map((o) => classifyRow(o));
  const leanBad = rows.map((r, i) => ({ r, i })).filter(({ r, i }) => r.lean.class !== mech[i].class || r.lean.rule !== mech[i].rule);
  const leanClassBad = leanBad.filter(({ r, i }) => r.lean.class !== mech[i].class);
  P(`lean vs our mechanical verdict: class mismatches ${leanClassBad.length}, class-or-rule mismatches ${leanBad.length}`);
  for (const { r, i } of leanBad) P(`  ${r.id} ${r.method} ${r.state.path} fixture lean ${r.lean.class}/${r.lean.rule} ours ${mech[i].class}/${mech[i].rule}`);

  // Rule 1
  const r1 = rows.map((r, i) => rule1(r, mech[i].class));
  const par = rows.map((r, i) => ({ r, i })).filter(({ r, i }) => r1[i].letter !== r.expected.letter || r1[i].asked !== r.expected.asked);
  // Parity: rule 1 run from the fixture's own lean (as rwxlite's test does).
  const r1fix = rows.map((r) => rule1(r, r.lean.class));
  const parFix = rows.filter((r, i) => r1fix[i].letter !== r.expected.letter || r1fix[i].asked !== r.expected.asked);
  P(`rule 1 parity vs fixture.expected: using fixture lean ${parFix.length} mismatches; using our mechanical ${par.length} mismatches`);
  if (parFix.length) { P('PARITY FAILED'); writeFileSync(here('readout.txt'), out.join('\n') + '\n'); console.log(out.join('\n')); process.exit(1); }
  const asked1 = r1.filter((x) => x.asked).length;
  P(`fixture expected counts: asked ${rows.filter((r) => r.expected.asked).length}`);

  // Rule 2: real secondPass with a stub engine
  const model = 'rwxlite-0.1.0+00000000';
  const stub = async (items) => items.map((it) => ({ pIsX: rows[it.index].isX, pChanges: rows[it.index].changes, model }));
  const sp = await secondPass(ops, mech, stub, { model });
  const r2 = sp.verdicts;

  const T = rows.map((r) => truth.get(r.id));
  const letters = {
    '0 mechanical': mech.map((v) => v.class),
    '1 rwxlite tier rule (asked scored stricter)': r1.map((x) => (x.asked ? x.mech : x.letter)),
    '2 rwxmap secondPass (undecided = x)': r2.map((v) => v.class),
  };
  const ctx = r1.map((x) => x.letter);
  const scores = {};
  P('');
  P('HEADLINE (949 rows; too loose = predicted looser than truth; too tight = stricter)');
  for (const [name, L] of Object.entries(letters)) {
    const s = score(L.map((pred, i) => ({ pred, truth: T[i] })));
    scores[name] = s;
    P(`${name}: exact ${pct(s.exact)}, too loose ${pct(s.loose)}, too tight ${pct(s.tight)}`);
  }
  const sc = score(ctx.map((pred, i) => ({ pred, truth: T[i] })));
  P(`context only, rule 1 with asked rows taking the lowered letter: exact ${pct(sc.exact)}, too loose ${pct(sc.loose)}, too tight ${pct(sc.tight)}`);

  const na = score(ctx.map((pred, i) => ({ pred, truth: T[i], asked: r1[i].asked })).filter((x) => !x.asked));
  P(`rwxlite's own scoring (asked rows set aside, not scored): right ${na.exact}, too loose ${na.loose}, too tight ${na.tight}, asked ${asked1} (their reference: 810 / 5 / 60 / 74)`);

  // moves
  const mv1 = { sent: rows.filter((r) => TIER[r.jev_tier]).length, raised: 0, lowered: 0, kept: 0, asked: asked1 };
  rows.forEach((r, i) => { if (!TIER[r.jev_tier] && !credHit(r.state)) return; const a = RANK[r1[i].letter], b = RANK[mech[i].class]; if (a > b) mv1.raised++; else if (a < b) mv1.lowered++; else if (TIER[r.jev_tier]) mv1.kept++; });
  P('');
  P(`rule 1 moves: tier rows (sent) ${mv1.sent}, raised ${mv1.raised}, lowered(incl. asked) ${mv1.lowered}, kept ${mv1.kept}, asked ${mv1.asked}; lowered and accepted ${mv1.lowered - mv1.asked}`);
  const s2 = sp.summary;
  P(`rule 2 moves: sent ${s2.sent}, raised ${s2.raised}, lowered ${s2.lowered}, kept ${s2.kept}, undecided ${s2.undecided}`);
  P(`rule 2 review markers (tight/loose/settled): ${['tight', 'loose', 'settled'].map((k) => r2.filter((v) => v.review === k).length).join('/')}`);

  // bar
  P('');
  P('D133 mode-a bar (too loose <= mechanical alone; exact >= mechanical + 5 points). TUNING, not an exam.');
  const m0 = scores['0 mechanical'];
  for (const [name, s] of Object.entries(scores).slice(1)) {
    const pts = 100 * (s.exact - m0.exact) / N;
    P(`${name}: too loose ${s.loose} vs ${m0.loose} -> ${s.loose <= m0.loose ? 'ok' : 'FAIL'}; exact ${pts >= 0 ? '+' : ''}${pts.toFixed(1)} pts -> ${pts >= 5 ? 'ok' : 'FAIL'}`);
  }

  // diffs between rules 1 and 2
  const L1 = letters['1 rwxlite tier rule (asked scored stricter)'], L2 = letters['2 rwxmap secondPass (undecided = x)'];
  const fmt = (i) => `${rows[i].id} ${rows[i].method} ${rows[i].state.path} | mech ${mech[i].class}/${mech[i].review} | r1 ${r1[i].letter}${r1[i].asked ? ' asked' : ''} | r2 ${r2[i].class} | truth ${T[i]}`;
  const diffs = rows.map((_, i) => i).filter((i) => L1[i] !== L2[i]);
  let scope = 0, pick = 0;
  const why = diffs.map((i) => {
    const sent = mech[i].review === 'loose' || mech[i].review === 'tight';
    const inTier = !!TIER[rows[i].jev_tier];
    const cred = credHit(rows[i].state);
    const w = (inTier !== sent || (cred && !sent)) ? 'scope' : 'pick';
    w === 'scope' ? scope++ : pick++;
    return `${w} (tier ${rows[i].jev_tier ?? 'none'}, cred ${cred}, sent ${sent})`;
  });
  P('');
  P(`ROWS WHERE RULE 1 AND RULE 2 DIFFER: ${diffs.length} (different scope ${scope}, different letter pick ${pick})`);
  diffs.forEach((i, k) => P(`  ${fmt(i)} | ${why[k]}`));

  // too loose lists
  for (const [name, L] of Object.entries(letters)) {
    P('');
    const idx = L.map((_, i) => i).filter((i) => RANK[L[i]] < RANK[T[i]]);
    P(`TOO-LOOSE ROWS, ${name}: ${idx.length}`);
    idx.forEach((i) => P(`  ${fmt(i)}`));
  }
  // fixes / introduces
  const looseSet = (L) => new Set(L.map((_, i) => i).filter((i) => RANK[L[i]] < RANK[T[i]]));
  const lm = looseSet(letters['0 mechanical']);
  for (const [name, L] of Object.entries(letters).slice(1)) {
    const ls = looseSet(L);
    const fixed = [...lm].filter((i) => !ls.has(i)), intro = [...ls].filter((i) => !lm.has(i));
    P('');
    P(`${name}: fixes ${fixed.length} of mechanical's ${lm.size} too-loose rows, introduces ${intro.length}`);
    fixed.forEach((i) => P(`  fixed ${fmt(i)}`));
    intro.forEach((i) => P(`  introduced ${fmt(i)}`));
  }

  // per vendor
  P('');
  P('PER VENDOR (provider from ops.csv; each rule: exact/too loose/too tight of n)');
  const vs = [...new Set(rows.map((r) => vendor.get(r.id)))];
  for (const v of vs) {
    const idx = rows.map((_, i) => i).filter((i) => vendor.get(rows[i].id) === v);
    const cells = Object.entries(letters).map(([name, L]) => { const s = score(idx.map((i) => ({ pred: L[i], truth: T[i] }))); return `${name.split(' ')[0]}: ${s.exact}/${s.loose}/${s.tight}`; });
    P(`  ${v} n=${idx.length}: ${cells.join('  ')}`);
  }
  const txt = out.join('\n') + '\n';
  writeFileSync(here('readout.txt'), txt);
  console.log(txt);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
