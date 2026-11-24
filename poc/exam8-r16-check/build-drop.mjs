// Exam #8: drop-list = (a) every flagged spec_sha256 + (b) every spec of a vendor_key with an exact/label/segment alias hit.
// Reads flagged.csv + provider-hits.csv (outputs of overlap.mjs / providers.mjs) and the r16 ops + vendors files. Read-only on inputs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCsv } from './csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const R16 = '/home/hamr/PycharmProjects/rwxlite/data/r16';
const q = (x) => { x = String(x ?? ''); return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };

const bySha = new Map(); // sha -> {vendor_key, repo_url, repo, file_path, rows}
const byVk = new Map();  // vendor_key -> Set(sha)
let rows = 0;
await readCsv(path.join(R16, 'ops-r16-github.csv.gz'), (r) => {
  rows++;
  const s = r.spec_sha256; if (!s) return;
  let e = bySha.get(s);
  if (!e) { e = { vendor_key: r.vendor_key, repo_url: r.repo_url, repo: r.repo, file_path: r.file_path, rows: 0 }; bySha.set(s, e); }
  e.rows++;
  if (!byVk.has(r.vendor_key)) byVk.set(r.vendor_key, new Set());
  byVk.get(r.vendor_key).add(s);
});
const vkShaFromVendorFile = new Map();
await readCsv(path.join(R16, 'vendors-r16-github.csv'), (r) => {
  vkShaFromVendorFile.set(r.vendor_key, new Set((r.spec_sha256s || '').split('|').filter(Boolean)));
});

const drop = new Map(); // sha -> Set(reason)
const add = (sha, reason) => { if (!drop.has(sha)) drop.set(sha, new Set()); drop.get(sha).add(reason); };
let nFlagRows = 0;
await readCsv(path.join(HERE, 'flagged.csv'), (r) => { nFlagRows++; add(r.spec_sha256, `flag:${r.our_vendor}:${r.shared}/${r.r16_ops}`); });
let nHit = 0, nNameUsed = 0, notInOps = 0, vfMismatch = 0;
await readCsv(path.join(HERE, 'provider-hits.csv'), (r) => {
  nHit++;
  if (!['exact', 'label', 'segment'].includes(r.match_type)) return;
  nNameUsed++;
  const vk = r.row_vendor_key;
  const a = byVk.get(vk) ?? new Set(), b = vkShaFromVendorFile.get(vk) ?? new Set();
  if (!a.size && !b.size) notInOps++;
  if (a.size !== b.size || [...a].some((x) => !b.has(x))) vfMismatch++;
  for (const sha of new Set([...a, ...b])) add(sha, `name:${r.our_vendor}:${r.match_type}:${r.column}:${r.value}`);
});

const out = ['spec_sha256,vendor_key,repo_url,reason,ops'];
let dropOps = 0; const vks = new Set(); let missing = 0;
for (const [sha, reasons] of [...drop].sort((x, y) => x[0].localeCompare(y[0]))) {
  const e = bySha.get(sha);
  if (!e) { missing++; out.push([sha, '', '', [...reasons].join('|'), 0].map(q).join(',')); continue; }
  dropOps += e.rows; vks.add(e.vendor_key);
  out.push([sha, e.vendor_key, e.repo_url, [...reasons].join('|'), e.rows].map(q).join(','));
}
fs.writeFileSync(path.join(HERE, 'drop-list.csv'), out.join('\n') + '\n');
const L = [];
L.push(`ops rows read: ${rows}; specs in ops: ${bySha.size}`);
L.push(`flagged.csv pair rows: ${nFlagRows}; provider-hits rows: ${nHit} (exact/label/segment used: ${nNameUsed}; name hits whose vendor_key has no specs: ${notInOps}; ops-vs-vendor-file spec_sha256s mismatches: ${vfMismatch})`);
L.push(`DROP LIST: ${drop.size} specs, ${vks.size} vendor_keys, ${dropOps} ops rows removed of ${rows} (${(100 * dropOps / rows).toFixed(3)}%); specs not found in ops: ${missing}`);
const nf = [...drop.values()].filter((s) => [...s].some((x) => x.startsWith('flag:'))).length;
const nn = [...drop.values()].filter((s) => [...s].some((x) => x.startsWith('name:'))).length;
L.push(`by reason: flag ${nf} specs, name ${nn} specs`);
// rwxlite's own 19 dropped specs: still present? matched by repo + file_path
const rep = JSON.parse(fs.readFileSync(path.join(R16, 'collect-report-github.json'), 'utf8')).exam8;
const present = new Map(); for (const e of bySha.values()) present.set(e.repo + '\0' + e.file_path, e);
let still = 0, stillOps = 0;
for (const d of rep.dropped_specs) { const e = present.get(d.repo + '\0' + d.file_path); if (e) { still++; stillOps += e.rows; L.push(`  rwxlite-dropped STILL PRESENT: ${d.repo} ${d.file_path} (${e.rows} rows, vendor_key ${e.vendor_key})`); } }
L.push(`rwxlite report: dropped_specs=${rep.dropped_specs.length} (report says ${rep.specs_dropped_at_this_stage} specs / ${rep.ops_dropped_at_this_stage} ops); still present in files: ${still} specs / ${stillOps} rows (matched by repo+file_path)`);
fs.writeFileSync(path.join(HERE, 'drop-summary.txt'), L.join('\n') + '\n');
console.log(L.join('\n'));
