// The one place every pin lives, plus the two small readers proof.mjs and
// flow.test.mjs both use: pinDiffs (did any pin move) and verdictFor (what
// one row's classification means against truth).
//
// Pins are measured on the 5465-row tuning corpus, LOVO. A pin moves only
// with a logged re-measure (learnings.md) and the user's word.
export const PINS = {
  step1: { overTight: 49, leaks: 0 },
  floorGet: { leaks: 17 },
  step2: {
    falseAlarms: 803,
    leaks: 211,
    xPile: { rows: 2441, leaks: 192 },
  },
  exact: 4282,
  leaks: 228,
  overTight: 955,
  byMethod: {
    GET: { n: 550, leaks: 17, overTight: 0 },
    POST: { n: 509, leaks: 0, overTight: 127 },
    PUT: { n: 1696, leaks: 93, overTight: 305 },
    DELETE: { n: 2079, leaks: 76, overTight: 424 },
    PATCH: { n: 631, leaks: 42, overTight: 99 },
  },
  rows: 5465,
  vendors: 332,
};

const CLASS_ORDER = { r: 0, w: 1, x: 2 };

// verdictFor(result, truth): 'ok' when result.class === truth; 'LEAK' when
// result.class is looser than truth (r<w<x); otherwise 'FALSE-ALARM' when
// truth is w and class is x, else 'OVER-TIGHT' (truth r, class not r).
export function verdictFor(result, truth) {
  const cls = result.class;
  if (cls === truth) return 'ok';
  if (CLASS_ORDER[cls] < CLASS_ORDER[truth]) return 'LEAK';
  if (truth === 'w' && cls === 'x') return 'FALSE-ALARM';
  return 'OVER-TIGHT';
}

// Walk PINS recursively, comparing against the equivalent path in `actual`
// (a { score, rows, vendors } shaped bag built by the caller). Returns a
// list of { name, pinned, actual } for every leaf that differs; empty when
// every pin holds.
function walk(pinned, actual, prefix, out) {
  for (const key of Object.keys(pinned)) {
    const pinnedVal = pinned[key];
    const name = prefix ? `${prefix}.${key}` : key;
    if (pinnedVal !== null && typeof pinnedVal === 'object') {
      walk(pinnedVal, actual && typeof actual === 'object' ? actual[key] : undefined, name, out);
      continue;
    }
    const actualVal = actual && typeof actual === 'object' ? actual[key] : undefined;
    if (actualVal !== pinnedVal) {
      out.push({ name, pinned: pinnedVal, actual: actualVal });
    }
  }
  return out;
}

// pinDiffs(score, rowCount, vendorCount): compares `score` (a scoreRows
// ledger) plus rowCount/vendorCount against PINS. Returns a list of
// { name, pinned, actual } for every pin that differs; empty when all hold.
export function pinDiffs(score, rowCount, vendorCount) {
  const actual = { ...score, rows: rowCount, vendors: vendorCount };
  return walk(PINS, actual, '', []);
}
