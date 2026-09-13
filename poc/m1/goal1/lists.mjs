// Goal 1's own word lists (D57: each goal owns its own, never imports
// another goal's build). Goal 1 is a standalone classifier — the user's
// ruling 2026-09-13 — not a layer patching goal 2's output.

// LIVE_VERBS (26): a literal copy of goal2/lists.mjs's LIVE_VERBS (D57
// allows copying entries; never import goal 2's set). Same 26 words, goal
// 1's own copy so goal 1 never depends on goal 2 at runtime.
export const LIVE_VERBS = new Set([
  'accept', 'approve', 'cancel', 'convert', 'dial', 'end', 'execute',
  'hangup', 'invite', 'kick', 'launch', 'merge', 'notify', 'pay', 'publish',
  'reboot', 'refund', 'reject', 'revoke', 'run', 'send', 'start', 'submit',
  'terminate', 'transfer', 'trigger',
]);

// nounsForRow is goal 2's noun reader (goal2/allowlist.mjs) — a reader,
// not a list; reused here to build the noun stats this module owns.
import { nounsForRow } from '../goal2/allowlist.mjs';

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// Bar for goal 1's own "other party" noun list (D63, 2026-09-13): a noun
// is "other" for vendor v when, excluding v's own rows, it appears across
// >= OTHER_MIN_VENDORS other vendors and its x-share (danger share) among
// those rows is >= OTHER_MIN_DANGER_SHARE. Reference measurement:
// scratchpad/g1block.mjs, V>=2 danger>=30% -> 803 false alarms / 211 leaks
// over the 4406 PUT/DELETE/PATCH rows.
export const OTHER_MIN_VENDORS = 2;
export const OTHER_MIN_DANGER_SHARE = 0.30;

// Builds goal 1's own leave-one-vendor-out "other party" noun list.
//
// rows: ALL rows (this function filters to PUT/DELETE/PATCH itself).
// vendors: every vendor name.
// junkSet: goal 2's junk-noun set (buildGoal2Context's junkSet) — passed
// in by the caller (run/context.mjs), reused only as a noun-reader input,
// not as evidence.
//
// Per noun: counts w/x/r across ALL PUT/DELETE/PATCH rows bearing that
// noun, plus a per-vendor breakdown. For vendor v, exclude v's own rows
// from the count; the noun is admitted ("other") for v when the
// remaining rows span >= OTHER_MIN_VENDORS distinct other vendors, there
// is at least one remaining row, and their x-share >= OTHER_MIN_DANGER_SHARE.
//
// Returns { otherNounsFor } — otherNounsFor(vendor) -> Set<noun>, mirroring
// goal2/allowlist.mjs's buildGoal2Context -> { allowlistFor } shape.
export function buildGoal1OtherNouns(rows, vendors, junkSet) {
  const stat = new Map(); // noun -> { w, x, r, byVendor: Map<vendor, {w,x,r}> }

  for (const row of rows) {
    if (!RAISE_METHODS.has(row.method)) continue;
    const nouns = nounsForRow(row, junkSet);
    if (nouns.size === 0) continue;
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
      if (n > 0 && otherVendors >= OTHER_MIN_VENDORS && x / n >= OTHER_MIN_DANGER_SHARE) {
        admitted.add(noun);
      }
    }
    perVendor.set(vendor, admitted);
  }

  function otherNounsFor(vendor) {
    return perVendor.get(vendor) || new Set();
  }

  return { otherNounsFor };
}
