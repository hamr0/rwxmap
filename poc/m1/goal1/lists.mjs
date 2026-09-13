// D57: goal 1's own lowering-verb list, mined from goal 1's own pile —
// never imports goal 2's lists (LIVE_VERBS, NON_NOUN_READ_VERBS live in
// goal2/lists.mjs and stay there).
//
// The pile: every PUT/DELETE/PATCH row still at class x after goal 2 runs
// (any rule — floor or a goal-2 raise), keyed by (method, verb) where verb
// is the summary's lead verb (fallbackVerbFromSummary) with a trailing 's'
// folded off exactly as the reference measurement (g1verbs.mjs) does. A
// (method, verb) is admitted leave-one-vendor-out: excluding vendor v's
// own rows, the remaining rows for that (method, verb) must span >=
// MIN_VENDORS distinct vendors and have an x-share <= 1 - MIN_NON_X_SHARE
// (i.e. non-x share >= MIN_NON_X_SHARE), with at least one row.
import { fallbackVerbFromSummary } from '../arbiter/judge.mjs';

export const MIN_VENDORS = 5;
export const MIN_NON_X_SHARE = 0.95;

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// Trailing-'s' fold, exactly as g1verbs.mjs: only for verbs longer than 4
// chars and not already ending in 'ss' (so "process" stays "process").
function foldVerb(v) {
  if (v && v.length > 4 && v.endsWith('s') && !v.endsWith('ss')) return v.slice(0, -1);
  return v;
}

export function foldedVerbForRow(row) {
  return foldVerb(fallbackVerbFromSummary(row.summary));
}

// pile: array of { row, gt_class } (or plain rows with .gt_class) sitting
// at x after goal 2 on PUT/DELETE/PATCH. Builds per-(method,verb) stats,
// each with a per-vendor breakdown, applies the LOVO bar per vendor, and
// returns { lowerVerbsFor } — lowerVerbsFor(vendor) -> Set<"METHOD verb">,
// mirroring goal2/allowlist.mjs's buildGoal2Context -> { allowlistFor }.
export function buildGoal1LowerVerbs(pile, vendors) {
  const stat = new Map(); // "METHOD verb" -> { w, x, r, byVendor: Map<vendor, {w,x,r}> }

  for (const entry of pile) {
    const row = entry.row || entry;
    if (!RAISE_METHODS.has(row.method)) continue;
    const verb = foldedVerbForRow(row);
    if (!verb) continue;
    const key = `${row.method} ${verb}`;
    if (!stat.has(key)) stat.set(key, { w: 0, x: 0, r: 0, byVendor: new Map() });
    const t = stat.get(key);
    const cls = row.gt_class;
    t[cls] = (t[cls] || 0) + 1;
    if (!t.byVendor.has(row.vendor)) t.byVendor.set(row.vendor, { w: 0, x: 0, r: 0 });
    const v = t.byVendor.get(row.vendor);
    v[cls] = (v[cls] || 0) + 1;
  }

  const perVendor = new Map();
  for (const vendor of vendors) {
    const admitted = new Set();
    for (const [key, t] of stat) {
      const own = t.byVendor.get(vendor) || { w: 0, x: 0, r: 0 };
      const w = t.w - own.w, x = t.x - own.x, r = t.r - own.r;
      const n = w + x + r;
      const otherVendors = t.byVendor.size - (t.byVendor.has(vendor) ? 1 : 0);
      if (n > 0 && otherVendors >= MIN_VENDORS && x / n <= 1 - MIN_NON_X_SHARE) {
        admitted.add(key);
      }
    }
    perVendor.set(vendor, admitted);
  }

  function lowerVerbsFor(vendor) {
    return perVendor.get(vendor) || new Set();
  }

  return { lowerVerbsFor };
}

// D57 piece 4: goal 1's own yours-noun list — same shape as goal 2's
// allowlist (goal2/allowlist.mjs's buildGoal2Context -> allowlistFor), the
// other direction (this one LOWERS x -> w) and goal 1's own bar, mined
// from goal 1's own pile. Never imports goal 2's allowlist build; only
// reuses nounsForRow (the noun reader, not a list) as a caller-supplied
// per-row noun set.
//
// The pile: every PUT/DELETE/PATCH row still at x after goal 1's
// lower-verb rule runs (piece 3), each entry { row, nouns } where nouns
// is that row's noun set from goal2/allowlist.mjs's nounsForRow(row,
// ctx.junkSet) (assembled in run/context.mjs). A noun is admitted
// leave-one-vendor-out: excluding vendor v's own rows, the remaining rows
// bearing that noun must span >= NOUN_MIN_VENDORS distinct OTHER vendors
// and have an x-share <= 1 - NOUN_MIN_SAFE_SHARE (i.e. non-x share >=
// NOUN_MIN_SAFE_SHARE), with at least one row.
export const NOUN_MIN_VENDORS = 2;
export const NOUN_MIN_SAFE_SHARE = 0.90;

export function buildGoal1YoursNouns(pile, vendors) {
  const stat = new Map(); // noun -> { w, x, r, byVendor: Map<vendor, {w,x,r}> }

  for (const entry of pile) {
    const row = entry.row || entry;
    const nouns = entry.nouns;
    if (!nouns || nouns.size === 0) continue;
    const cls = row.gt_class;
    for (const n of nouns) {
      if (!stat.has(n)) stat.set(n, { w: 0, x: 0, r: 0, byVendor: new Map() });
      const t = stat.get(n);
      t[cls] = (t[cls] || 0) + 1;
      if (!t.byVendor.has(row.vendor)) t.byVendor.set(row.vendor, { w: 0, x: 0, r: 0 });
      const v = t.byVendor.get(row.vendor);
      v[cls] = (v[cls] || 0) + 1;
    }
  }

  const perVendor = new Map();
  for (const vendor of vendors) {
    const admitted = new Set();
    for (const [noun, t] of stat) {
      const own = t.byVendor.get(vendor) || { w: 0, x: 0, r: 0 };
      const w = t.w - own.w, x = t.x - own.x, r = t.r - own.r;
      const n = w + x + r;
      const otherVendors = t.byVendor.size - (t.byVendor.has(vendor) ? 1 : 0);
      if (n > 0 && otherVendors >= NOUN_MIN_VENDORS && x / n <= 1 - NOUN_MIN_SAFE_SHARE) {
        admitted.add(noun);
      }
    }
    perVendor.set(vendor, admitted);
  }

  function yoursNounsFor(vendor) {
    return perVendor.get(vendor) || new Set();
  }

  return { yoursNounsFor };
}
