// Loads the six tuning sets with v3 truth and v4 truth. Ported from the pinned baseline loader.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parseCsv } from '../../tools/csv.js';

const D = new URL('../../data/', import.meta.url);
const rd = (p) => {
  const buf = fs.readFileSync(new URL(p, D));
  return parseCsv(p.endsWith('.gz') ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8'));
};

/** @returns {{set:string,id:string,row:object,v3:string|undefined,v4:string|undefined}[]} */
export function loadSets() {
  const ex = new Map(
    rd('export-v4-gap-2026-11-06/export-v4.csv')
      .filter((r) => r.flag !== 'rwxlite')
      .map((r) => [r.set + '|' + r.id, r.label]),
  );
  const sets = [];
  const add = (set, rows, idk, lab) => {
    for (const r of rows) {
      const v3 = lab(r);
      sets.push({ set, id: r[idk], row: r, v3, v4: v3 ? ex.get(set + '|' + r[idk]) || v3 : undefined });
    }
  };
  add('combined', rd('combined-2026-09-21/labelled.csv'), 'row_id', (r) => r.truth_class);
  add('buildset', rd('relabel-buildset-2026-09-23/labelled.csv'), 'row_id', (r) => r.truth_class);
  add('exam22', rd('exam-2026-09-22/labelled.csv'), 'row_id', (r) => r.truth_class);
  for (const [s, dir, ops] of [
    ['exam3', 'exam3-2026-11-04', 'ops.csv'],
    ['exam4', 'exam4-2026-11-04', 'ops.csv'],
    ['fresh', 'rwxlite-fresh-2026-11-03', 'ops.csv.gz'],
  ]) {
    const t = new Map(rd(dir + '/' + (s === 'fresh' ? 'truth.csv' : 'truth-d136.csv')).map((r) => [r.id, r.label]));
    add(s, rd(dir + '/' + ops), 'id', (r) => t.get(r.id));
  }
  return sets;
}
