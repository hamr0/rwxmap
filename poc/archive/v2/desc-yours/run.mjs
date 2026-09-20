// Sweep runner for the description-mined "yours" allowlist experiment.
// Never wired into poc/flow; reads the real corpus and the real x-pile
// (via poc/flow's own buildContext + classifyRow), never a re-implemented
// flow.
import { loadRows } from '../flow/corpus.mjs';
import { buildDescYours, resolvePile, SOURCES } from './mine.mjs';

const { rows, vendors } = loadRows();

const EXPECTED_PILE = 1972;
const EXPECTED_TRUTH = { w: 1795, x: 155, r: 22 };

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function pad(s, n) {
  s = String(s);
  return s + ' '.repeat(Math.max(0, n - s.length));
}

// --- guard: the pile this run computes must be the same 1972-row
// population the whole experiment is measured against. -----------------
{
  // resolvePile itself asserts nothing about pile size; recompute directly
  // here to fail fast before running the sweep.
  const anyRecords = resolvePile(rows, vendors, { minN: 2, minWShare: 0.80, source: 'summary' });
  if (anyRecords.length !== EXPECTED_PILE) {
    throw new Error(`ESCALATE: x-pile is ${anyRecords.length} rows, expected ${EXPECTED_PILE} -- population drifted.`);
  }
  const truth = { w: 0, x: 0, r: 0 };
  for (const rec of anyRecords) truth[rec.truth] += 1;
  for (const cls of ['w', 'x', 'r']) {
    if (truth[cls] !== EXPECTED_TRUTH[cls]) {
      throw new Error(`ESCALATE: x-pile truth ${cls}=${truth[cls]}, expected ${EXPECTED_TRUTH[cls]} -- population drifted.`);
    }
  }
}

// --- the sweep -----------------------------------------------------------

const MIN_W_SHARES = [0.80, 0.85, 0.90, 0.95];
const MIN_NS = [2, 3, 5];

const header = [
  'source', 'minN', 'minWShare', 'listSize(med)', 'pileBefore', 'resolved',
  'pileAfter', 'resolved+truth=w', 'resolved+truth=x(LEAK)', 'resolved+truth=r', 'right/leak',
];
console.log(header.map((h, i) => pad(h, i === 0 ? 12 : 16)).join(''));

const sweepRows = [];
for (const source of SOURCES) {
  for (const minWShare of MIN_W_SHARES) {
    for (const minN of MIN_NS) {
      const ctx = buildDescYours(rows, vendors, { minN, minWShare, source });
      const listSizes = vendors.map((v) => ctx.yoursFor(v).size);
      const listSizeMed = median(listSizes);

      const records = resolvePile(rows, vendors, { minN, minWShare, source });
      const resolved = records.filter((r) => r.outcome === 'resolved');
      const resW = resolved.filter((r) => r.truth === 'w').length;
      const resX = resolved.filter((r) => r.truth === 'x').length;
      const resR = resolved.filter((r) => r.truth === 'r').length;
      const ratio = resX === 0 ? (resW > 0 ? `${resW}/0` : '-') : (resW / resX).toFixed(1);

      sweepRows.push({ source, minN, minWShare, listSizeMed, resolved: resolved.length, resW, resX, resR, ratio, records, ctx });

      const row = [
        source, minN, minWShare.toFixed(2), listSizeMed, EXPECTED_PILE, resolved.length,
        EXPECTED_PILE - resolved.length, resW, resX, resR, ratio,
      ];
      console.log(row.map((v, i) => pad(v, i === 0 ? 12 : 16)).join(''));
    }
  }
}

// --- detail block: source='both', minN=2, minWShare=0.80 ------------------

const detail = sweepRows.find((r) => r.source === 'both' && r.minN === 2 && r.minWShare === 0.80);
if (!detail) throw new Error('ESCALATE: expected sweep to include source=both, minN=2, minWShare=0.80');

console.log('\n--- top 15 vendors by rows resolved (source=both, minN=2, minWShare=0.80) ---');
const byVendor = new Map();
for (const rec of detail.records) {
  if (rec.outcome !== 'resolved') continue;
  byVendor.set(rec.vendor, (byVendor.get(rec.vendor) || 0) + 1);
}
const topVendors = [...byVendor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log(pad('vendor', 30) + pad('resolved', 10));
for (const [vendor, count] of topVendors) {
  console.log(pad(vendor, 30) + pad(count, 10));
}

console.log('\n--- first 20 leak-unflagged rows (resolved but truth=x; source=both, minN=2, minWShare=0.80) ---');
const leaks = detail.records.filter((r) => r.outcome === 'resolved' && r.truth === 'x').slice(0, 20);
console.log(pad('vendor', 20) + pad('method', 10) + pad('operationId', 40) + 'summary (60 chars)');
for (const rec of leaks) {
  const summary = (rec.summary || '').slice(0, 60);
  console.log(pad(rec.vendor, 20) + pad(rec.method, 10) + pad(rec.operationId, 40) + summary);
}
if (leaks.length === 0) {
  console.log('(none -- zero leaks unflagged at this setting)');
}
