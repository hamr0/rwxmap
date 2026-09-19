// Pure scoring helpers. No I/O, no truth reading beyond the truth_class
// values callers pass in explicitly.

const RANK = { r: 0, w: 1, x: 2 };

/**
 * Tally predictions against truths under the r < w < x order.
 * leak = predicted looser than truth (a security cost).
 * overTight = predicted tighter than truth (a usability cost).
 *
 * @param {string[]} predictions
 * @param {string[]} truths
 * @returns {{n: number, exact: number, leaks: number, overTight: number}}
 */
export function tally(predictions, truths) {
  let exact = 0;
  let leaks = 0;
  let overTight = 0;
  const n = predictions.length;
  for (let i = 0; i < n; i++) {
    const p = RANK[predictions[i]];
    const t = RANK[truths[i]];
    if (p === t) exact++;
    else if (p < t) leaks++;
    else overTight++;
  }
  return { n, exact, leaks, overTight };
}

/**
 * Group rows by row.provider and tally predFn(row) against row.truth_class
 * for each vendor.
 *
 * @param {Array<object>} rows each row must carry `provider` and `truth_class`
 * @param {(row: object) => string} predFn
 * @returns {Array<{vendor: string, n: number, exact: number, leaks: number, overTight: number}>}
 */
export function perVendor(rows, predFn) {
  const byVendor = new Map();
  for (const row of rows) {
    const v = row.provider;
    if (!byVendor.has(v)) byVendor.set(v, { predictions: [], truths: [] });
    const g = byVendor.get(v);
    g.predictions.push(predFn(row));
    g.truths.push(row.truth_class);
  }
  const out = [];
  for (const [vendor, g] of byVendor) {
    out.push({ vendor, ...tally(g.predictions, g.truths) });
  }
  return out;
}
