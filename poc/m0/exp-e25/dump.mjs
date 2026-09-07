// E25 diagnostic: dump every false alarm (tool tighter than truth) from a
// run-union CSV with its rule_ids and evidence, grouped by rule pair.
import { readFileSync } from 'node:fs';
import { parseCsv } from '../csv.mjs';
const files = process.argv.slice(2);
const rows = [];
for (const f of files) for (const r of parseCsv(readFileSync(f,'utf8'))) rows.push(r);
const RANK = { r:0, w:1, x:2 };
const fa = rows.filter(r => r.gt_class && RANK[r.class] > RANK[r.gt_class]);
const byRule = {};
for (const r of fa) {
  const key = r.rule_id.replace(/^U:/,'').split('>')[0];
  (byRule[key] ??= []).push(r);
}
const keys = Object.keys(byRule).sort((a,b)=>byRule[b].length-byRule[a].length);
console.log(`false alarms: ${fa.length}`);
for (const k of keys) {
  console.log(`\n## ${k}  n=${byRule[k].length}`);
  for (const r of byRule[k]) console.log(`  ${r.method} ${r.operationId} [${r.class}<-${r.gt_class}] ${r.confidence} | ${r.evidence.slice(0,150)}`);
}
