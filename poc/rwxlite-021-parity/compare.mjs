// node compare.mjs <scratch-dir>
// Diffs <scratch>/out-0.2.0 vs out-0.2.1 rows per mode and variant (letter AND review marker).
// Prints the differing count first, then every differing row, no sample cap. Scores vs truth
// are INFO ONLY (exam #3 is burned). Prints counts of anything excluded or skipped.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, tally } from '../../data/exam3-2026-11-04/score/score.mjs';
import { MODES, VARIANTS, configName } from './common.mjs';

const HEAD = 'id,provider,method,path,truth,letter,review,evidence';

/** rows file text -> [{id, provider, method, path, truth, letter, review, evidence}]; header must be exact. */
export function parseRows(text) {
  const rows = parseCsv(text);
  if (rows[0]?.join(',') !== HEAD) throw new Error(`rows header unexpected: ${rows[0]?.join(',')}`);
  return rows.slice(1).filter((r) => !(r.length === 1 && r[0] === '')).map((r) => {
    if (r.length !== 8) throw new Error(`rows: bad row ${JSON.stringify(r)}`);
    const [id, provider, method, p, truth, letter, review, evidence] = r;
    return { id, provider, method, path: p, truth, letter, review, evidence };
  });
}

/**
 * Pure diff of two row lists by id. A row differs when its letter OR its review marker differs.
 * Ids present on one side only are excluded from `diff` and counted in `onlyA` / `onlyB`.
 * @returns {{diff: Array<{a: object, b: object}>, same: number, onlyA: string[], onlyB: string[]}}
 */
export function diffRows(rowsA, rowsB) {
  const mapB = new Map(rowsB.map((r) => [r.id, r]));
  const seen = new Set();
  const diff = [], onlyA = [];
  let same = 0;
  for (const a of rowsA) {
    const b = mapB.get(a.id);
    if (!b) { onlyA.push(a.id); continue; }
    seen.add(a.id);
    if (a.letter !== b.letter || a.review !== b.review) diff.push({ a, b }); else same++;
  }
  const onlyB = rowsB.filter((r) => !seen.has(r.id)).map((r) => r.id);
  return { diff, same, onlyA, onlyB };
}

const sc = (t) => `exact ${t.exact} too loose ${t.loose} too tight ${t.tight} of ${t.n}`;

export function main(argv) {
  if (!argv[0]) throw new Error('usage: node compare.mjs <scratch-dir>');
  const scratch = path.resolve(argv[0]);
  const skipped = [];
  let total = 0;
  const out = [];
  for (const mode of MODES) for (const variant of Object.keys(VARIANTS)) {
    const name = configName(mode, variant);
    const fa = path.join(scratch, 'out-0.2.0', `rows-${name}.csv`), fb = path.join(scratch, 'out-0.2.1', `rows-${name}.csv`);
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) { skipped.push(name); continue; }
    const ra = parseRows(fs.readFileSync(fa, 'utf8')), rb = parseRows(fs.readFileSync(fb, 'utf8'));
    const d = diffRows(ra, rb);
    total += d.diff.length;
    out.push({ name, ra, rb, d });
  }
  console.log(`DIFFERING ROWS (letter or review marker), 0.2.1 vs 0.2.0, all files: ${total}`);
  for (const { name, d } of out) console.log(`  ${name}: ${d.diff.length} differ, ${d.same} same`);
  for (const { name, ra, rb, d } of out) {
    console.log(`\n== ${name} ==  differing ${d.diff.length}`);
    for (const { a, b } of d.diff) console.log(`  ${a.id} ${a.provider} ${a.method} ${a.path} truth ${a.truth}: 0.2.0 ${a.letter}/${a.review} -> 0.2.1 ${b.letter}/${b.review}  evidence ${a.evidence} | ${b.evidence}`);
    console.log(`  INFO ONLY (burned exam) 0.2.0: ${sc(tally(ra))}`);
    console.log(`  INFO ONLY (burned exam) 0.2.1: ${sc(tally(rb))}`);
    console.log(`  excluded: ${d.onlyA.length} ids only in 0.2.0, ${d.onlyB.length} ids only in 0.2.1`);
  }
  console.log(`\nskipped files (missing in either dir): ${skipped.length}${skipped.length ? ' ' + skipped.join(',') : ''}`);
  return out.some(({ d }) => d.onlyA.length || d.onlyB.length) ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exit(main(process.argv.slice(2))); } catch (e) { console.error(`compare: ${e.message}`); process.exit(1); }
}
