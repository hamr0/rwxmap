// Step 2, w: PUT/DELETE/PATCH rows start at w. In order, first hit
// decides: (a) live verb -> x, (b) other-party noun then money noun -> x,
// (c) every noun on the row is a "yours" noun -> w, flagged 'evidence',
// (d) otherwise -> w, flagged 'x-pile' (class stays w; rows step 2 gives
// up on belong to step 3). Imports nothing from poc/m1 or poc/m0 — each
// step owns its own lists (D57).
import { tokensForRow, matchesAnyStem, summaryVerb, callerPhraseInText, buildJunkSet, nounsForRow } from './words.mjs';

// LIVE_VERBS (27): literal copy of poc/archive/m1/step2/lists.mjs's LIVE_VERBS
// (itself a copy of step 3's list, D57 — never import another step's
// list, only copy it), plus 'confirm' added 2026-09-14 (hand raiser,
// measured 19 x / 2 w on 3 vendors).
export const LIVE_VERBS = new Set([
  'accept', 'approve', 'cancel', 'confirm', 'convert', 'dial', 'end',
  'execute', 'hangup', 'invite', 'kick', 'launch', 'merge', 'notify', 'pay',
  'publish', 'reboot', 'refund', 'reject', 'revoke', 'run', 'send', 'start',
  'submit', 'terminate', 'transfer', 'trigger',
]);

// Hand raising nouns, money moves by D20; measured 2026-09-14 payment
// 11 x / 0 w on 5 vendors; invoice, transaction, charge, checkout, payout
// rejected (mostly safe).
export const MONEY_NOUNS = new Set(['payment']);

// NON_NOUN_READ_VERBS (14): literal copy of poc/archive/m1/step3/lists.mjs's
// NON_NOUN_READ_VERBS (the same 14 as step1's READ_VERBS; each step keeps
// its own copy). Used only to keep verb tokens out of the noun reader,
// never as a rule step 2 applies on its own.
const NON_NOUN_READ_VERBS = new Set([
  'retrieve', 'verify', 'check', 'query', 'read', 'fetch', 'list', 'search',
  'match', 'count', 'lookup', 'assess', 'find', 'get',
]);

// Union of both verb lists, used only to keep verb tokens out of the noun
// set nounsForRow builds — not a rule in itself.
const NOUN_SKIP_VERBS = new Set([...LIVE_VERBS, ...NON_NOUN_READ_VERBS]);

const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);

// GET/HEAD/OPTIONS rows are truth r no matter whose thing they touch, so
// they carry no yours/other signal and only dilute the w-share; excluded
// from the yours mining (2026-09-14 decision).
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Mining bars (D63/D48 — not swept; named here instead of left as bare
// literals at the call site).
export const OTHER_MIN_VENDORS = 2;
export const OTHER_MIN_DANGER_SHARE = 0.30;
export const YOURS_MIN_N = 2;
export const YOURS_MIN_W_SHARE = 0.80;

// Shared per-noun, per-vendor w/x/r counting: for every row (already
// filtered by the caller to whichever population it wants counted), add
// one tally to the noun's totals and to the noun's per-vendor breakdown.
// Returns Map<noun, { w, x, r, byVendor: Map<vendor, {w,x,r}> }>.
function countNounsByVendor(rows, nounsOf) {
  const stat = new Map();
  for (const row of rows) {
    const nouns = nounsOf(row);
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
  return stat;
}

// Builds step 2's context: the junk set, a noun reader, and the two
// leave-one-vendor-out minings (other-party nouns over PUT/DELETE/PATCH
// only, yours nouns over write rows: every method but GET/HEAD/OPTIONS).
// Measured trade (2026-09-14): over all rows pile 2441 / 192 leaks; over
// write rows 1998 / 179; over PUT/DELETE/PATCH only 1582 / 159; classes
// (803/211) unchanged across all three — only the flag pile moves.
export function buildStep2Context(rows, vendors) {
  const junkSet = buildJunkSet(rows);
  const nounsOf = (row) => nounsForRow(row, junkSet, NOUN_SKIP_VERBS);

  const raiseRows = rows.filter((r) => RAISE_METHODS.has(r.method));
  const otherStat = countNounsByVendor(raiseRows, nounsOf);
  const writeRows = rows.filter((r) => !READ_METHODS.has(r.method));
  const yoursStat = countNounsByVendor(writeRows, nounsOf);

  const otherByVendor = new Map();
  const yoursByVendor = new Map();
  for (const vendor of vendors) {
    const otherAdmitted = new Set();
    for (const [noun, t] of otherStat) {
      const own = t.byVendor.get(vendor) || { w: 0, x: 0, r: 0 };
      const w = t.w - own.w, x = t.x - own.x, r = t.r - own.r;
      const n = w + x + r;
      const otherVendors = t.byVendor.size - (t.byVendor.has(vendor) ? 1 : 0);
      if (n > 0 && otherVendors >= OTHER_MIN_VENDORS && x / n >= OTHER_MIN_DANGER_SHARE) {
        otherAdmitted.add(noun);
      }
    }
    otherByVendor.set(vendor, otherAdmitted);

    const yoursAdmitted = new Set();
    for (const [noun, t] of yoursStat) {
      const own = t.byVendor.get(vendor) || { w: 0, x: 0, r: 0 };
      const w = t.w - own.w, x = t.x - own.x, r = t.r - own.r;
      const n = w + x + r;
      if (n >= YOURS_MIN_N && w / n >= YOURS_MIN_W_SHARE) {
        yoursAdmitted.add(noun);
      }
    }
    yoursByVendor.set(vendor, yoursAdmitted);
  }

  function otherNounsFor(vendor) {
    return otherByVendor.get(vendor) || new Set();
  }
  function yoursFor(vendor) {
    return yoursByVendor.get(vendor) || new Set();
  }

  // yoursStatFor(vendor, noun): { n, w } of the OTHER vendors' write rows
  // carrying this noun (n = w+x+r of the rest, w = w of the rest), the same
  // population yoursFor's admission bar is measured against -- exposed so
  // the proof can say why a noun did or didn't clear that bar. { n: 0, w: 0 }
  // when the noun was never seen on a write row at all.
  function yoursStatFor(vendor, noun) {
    const t = yoursStat.get(noun);
    if (!t) return { n: 0, w: 0 };
    const own = t.byVendor.get(vendor) || { w: 0, x: 0, r: 0 };
    const w = t.w - own.w, x = t.x - own.x, r = t.r - own.r;
    return { n: w + x + r, w };
  }

  return { junkSet, nounsOf, otherNounsFor, yoursFor, yoursStatFor };
}

// classifyStep2(row, ctx): null unless method is PUT/DELETE/PATCH.
export function classifyStep2(row, ctx) {
  if (!RAISE_METHODS.has(row.method)) return null;

  let hit = null;
  for (const t of tokensForRow(row).tokens) {
    const w = t.toLowerCase();
    if (matchesAnyStem(w, LIVE_VERBS)) { hit = w; break; }
  }
  if (!hit) {
    const sv = summaryVerb(row.summary);
    if (matchesAnyStem(sv, LIVE_VERBS)) hit = sv;
  }
  if (hit && !callerPhraseInText(row.summary)) {
    return { class: 'x', step: 3, rule: 'live-verb', flag: '' };
  }

  const nouns = ctx.nounsOf(row);
  const otherNouns = ctx.otherNounsFor(row.vendor);
  if ([...nouns].some((n) => otherNouns.has(n))) {
    return { class: 'x', step: 3, rule: 'other-noun', flag: '' };
  }
  if ([...nouns].some((n) => MONEY_NOUNS.has(n))) {
    return { class: 'x', step: 3, rule: 'money-noun', flag: '' };
  }

  const yoursNouns = ctx.yoursFor(row.vendor);
  if (nouns.size > 0 && [...nouns].every((n) => yoursNouns.has(n))) {
    return { class: 'w', step: 2, rule: 'yours-noun', flag: 'evidence' };
  }

  return { class: 'w', step: 2, rule: 'floor', flag: 'x-pile' };
}
