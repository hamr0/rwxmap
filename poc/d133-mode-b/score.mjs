// D133 mode b (PLANNED rule, not yet built in src): rwxlite alone judges every row, no mechanical scope.
// Scores on rwxlite's fresh 949 rows (TUNING data for rwxmap, burned as rwxlite's exam).
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const RANK = { r: 0, w: 1, x: 2 };
export const CS = [0, 50, 60, 70, 80, 90, 95, 97, 99];

/** Largest share wins, tie -> tighter. Below confidence c (0-99) the row is x and asked. */
export function decide(row, c) {
  const sh = { r: 1 - row.changes, w: row.changes - row.isX, x: row.isX };
  let L = 'r';
  if (sh.w >= sh[L]) L = 'w'; // ties go to the tighter letter
  if (sh.x >= sh[L]) L = 'x';
  const p = sh[L];
  return p >= c / 100 ? { letter: L, asked: false, sh } : { letter: 'x', asked: true, sh };
}

export function score(items) {
  const s = { n: items.length, exact: 0, loose: 0, tight: 0 };
  for (const { pred, truth } of items) {
    if (pred === truth) s.exact++; else if (RANK[pred] < RANK[truth]) s.loose++; else s.tight++;
  }
  return s;
}

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const lines = (b) => b.toString('utf8').split(/\r?\n/).filter(Boolean);

function main() {
  const dir = '../../data/rwxlite-fresh-2026-11-03/';
  const rows = lines(gunzipSync(readFileSync(here(dir + 'decision.jsonl.gz')))).map((l) => JSON.parse(l));
  const truth = new Map(lines(readFileSync(here(dir + 'truth.csv'))).slice(1).map((l) => l.split(',')));
  const vendor = new Map(lines(gunzipSync(readFileSync(here(dir + 'ops.csv.gz')))).slice(1).map((l) => { const a = l.split(','); return [a[0], a[1].replace(/^get|\..*$/g, '')]; }));
  const T = rows.map((r) => truth.get(r.id));
  const N = rows.length;
  const out = [];
  const P = (s = '') => out.push(s);
  const pc = (k, n = N) => `${k} (${(100 * k / n).toFixed(1)}%)`;
  const sc = (idx, c) => score(idx.map((i) => ({ pred: decide(rows[i], c).letter, truth: T[i] })));
  const all = rows.map((_, i) => i);

  P('D133 MODE B - PLANNED rule, NOT yet built in src. Measured here from the fixture shares only.');
  P('Rule: rwxlite alone judges every row (no mechanical scope). x=isX, w=changes-isX, r=1-changes; letter = largest share (tie -> tighter), p = that share.');
  P('With confidence c: p >= c/100 -> the letter; else the row is x and "asked" (marked for review).');
  P('TUNING data for rwxmap (rwxlite burned it as its exam); not an exam for rwxmap.');
  P('Note: p values are int8 per-channel; rwxmap default model is fp32 (rwxlite: 7 rows differ under its rule). This rule will be re-measured with the real code once mode b is built.');
  P(`rows ${N}; truth rows ${truth.size}; vendor rows ${vendor.size}`);
  P('');
  P('MAIN TABLE (all 949 rows; asked rows scored as x; too loose = looser than truth, too tight = stricter)');
  for (const c of CS) {
    const s = sc(all, c), a = all.filter((i) => decide(rows[i], c).asked).length;
    P(`c=${String(c).padStart(2)}: exact ${pc(s.exact)}, too loose ${pc(s.loose)}, too tight ${pc(s.tight)}, asked ${pc(a)}`);
  }
  P('');
  P('CONTEXT: same, restricted to rows NOT asked (what the model decided alone; n = rows not asked)');
  for (const c of CS) {
    const idx = all.filter((i) => !decide(rows[i], c).asked), s = sc(idx, c);
    P(`c=${String(c).padStart(2)}: n ${idx.length}: exact ${pc(s.exact, idx.length)}, too loose ${pc(s.loose, idx.length)}, too tight ${pc(s.tight, idx.length)}`);
  }
  P('');
  P('REFERENCE from poc/d133-rule-compare/readout.txt (same 949 rows):');
  try {
    const ref = lines(readFileSync(here('../d133-rule-compare/readout.txt')));
    for (const l of ref) if (/^(0 mechanical|2 rwxmap secondPass)/.test(l)) P('  ' + l);
  } catch { P('  (readout.txt not readable)'); }

  const C = 70;
  const mech = rows.map((r) => r.lean.class);
  const fmt = (i) => { const d = decide(rows[i], C); return `${rows[i].id} ${rows[i].method} ${rows[i].state.path} | mech ${mech[i]} | shares r ${d.sh.r.toFixed(3)} w ${d.sh.w.toFixed(3)} x ${d.sh.x.toFixed(3)} | mode b ${d.letter}${d.asked ? ' asked' : ''} | truth ${T[i]}`; };
  const loose = all.filter((i) => RANK[decide(rows[i], C).letter] < RANK[T[i]]);
  P('');
  P(`TOO-LOOSE ROWS at c=${C}: ${loose.length}`);
  loose.forEach((i) => P('  ' + fmt(i)));

  P('');
  P(`PER VENDOR at c=${C} (n; exact / too loose / too tight / asked)`);
  for (const v of ['coolify', 'workos', 'lago', 'resend']) {
    const idx = all.filter((i) => vendor.get(rows[i].id) === v), s = sc(idx, C);
    const a = idx.filter((i) => decide(rows[i], C).asked).length;
    P(`  ${v} n=${idx.length}: ${s.exact} / ${s.loose} / ${s.tight} / ${a}`);
  }
  const other = all.filter((i) => !['coolify', 'workos', 'lago', 'resend'].includes(vendor.get(rows[i].id)));
  P(`  vendors not in the four: ${other.length} rows`);
  const txt = out.join('\n') + '\n';
  writeFileSync(here('readout.txt'), txt);
  console.log(txt);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
