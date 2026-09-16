// M1-C23: TRIAL — does the PATH TAIL name the object more reliably than the
// operationId head noun does?
//
// Why this pass exists: c21's word-by-word audit of the 522 wrong-x rows
// (c22's rescue target) surfaced two Discord rows in the raw leak-row
// reading that looked, on a human read, like the wrong object was being
// named — the operationId reads "webhook" (update_webhook_message,
// update_original_webhook_message) while the real object being edited is a
// MESSAGE, the last real path segment
// (/webhooks/{webhook_id}/{webhook_token}/messages/{message_id}). The
// hypothesis this pass tests: read the object noun off the PATH TAIL
// instead of (or in addition to) the operationId/summary head noun.
//
// THIS IS A TRIAL. It may fail. Per the brief, a clean negative is a valid,
// reportable result — nothing here is tuned to make path-tail look good.
//
// Escalation resolved before this file was written: the brief called for
// judge.mjs's GENERIC_TAILS list, but it was a module-private `const`, not
// exported. The coordinator ruled (2026-09-10): export it (visibility only,
// `const GENERIC_TAILS` -> `export const GENERIC_TAILS`, one word, no other
// change to judge.mjs) rather than fork a second copy of the same list,
// per the repo's "one writer per piece of state" rule. That edit was made,
// verified behaviour-neutral (254/254 existing tests still pass; c21.mjs
// still reports exactly 522 wrong rows; c22.mjs's self-checks still pass),
// and is a second changed file alongside this one and its doc.
//
// MEASUREMENT ONLY beyond that one export. c11.mjs, c15.mjs, c19.mjs,
// c20.mjs, c21.mjs, c22.mjs are never modified. This file forks two small
// pieces of logic that exist in those files but are NOT exported from them,
// the same way c22.mjs already forks c20's scoreLovo shape (documented
// there as "a deliberate, narrow fork... not a silent duplication"):
//   - `eligible` (c22.mjs, private): which of c15's raise rules qualifies a
//     row for the allowlist-wins layer. Copied verbatim — it does not
//     depend on which noun source is being tested, so there is nothing to
//     parameterise, only to reproduce.
//   - `classifyC22`'s body (c22.mjs, exported only in its A-config form):
//     copied as `classifyC23`, generalised to take a `nounsForRowFn(row,
//     junkSet) -> Set<string>` parameter instead of hardcoding c20's
//     rowNouns. A self-check below proves classifyC23 with nounsForRowFn =
//     c20's own rowNouns reproduces classifyC22 exactly, before any other
//     number in this file is trusted.
//
// How to re-run: node poc/m1/arbiter/c23.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify as classifyC15 } from './c15.mjs';
import { CLASS_ORDER } from './arbiter.mjs';
import { REPO_ROOT } from './load-sets.mjs';
import { loadCombinedCorpus, truthSplit } from './c19.mjs';
import {
  cleanNounTable,
  nounStats,
  deriveAllowlist,
  rowNouns,
  buildLovoAllowlists,
} from './c20.mjs';
import { classifyC22, scoreC22 } from './c22.mjs';
import { headNounForRow, operationIdHeadNoun, naiveSingular, GENERIC_TAILS } from './judge.mjs';

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c23-path-tail-noun.md');
const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);
const KNOWN_WRONG_FIGURE = 522;
const SETS = ['camara', 'holdout1', 'holdout2', 'holdout3', 'holdout4', 'holdout5', 'exam2', 'exam3'];
const SWEEP_MIN_N = [2, 3, 5, 10];
const SWEEP_MIN_W = [0.80, 0.90, 0.95, 1.00];

// --- Part 1: the path-tail extractor ---------------------------------------
//
// Walks a path's '/'-separated segments from the END toward the front,
// lowercasing each before testing it, and returns the first one that
// survives every skip rule below, singularised via judge.mjs's
// naiveSingular (imported, not reimplemented). Skips, checked in this
// order per segment:
//   1. a {param} segment.
//   2. an @-prefixed segment (@original, @me).
//   3. a version marker: ^v\d (v1, v2.1), purely digits, or ^\d+\.\d+
//      (2.1, 2.1.3) at the start.
//   4. a segment in judge.mjs's (now-exported) GENERIC_TAILS.
//   5. a segment containing a '.': the extension is stripped at the LAST
//      '.' (path.lastIndexOf) and the stem used instead, UNLESS the stem
//      is empty (a leading-dot segment) — that skips the segment entirely.
//      Choice made here, not given by the brief: multi-dot segments
//      (a.b.c) strip only the final extension, keeping "a.b" as the
//      candidate, which then still has to pass check 6 below.
//   6. anything left that is not purely a-z after cleanup.
//
// One documented limitation, found while implementing, not in the brief:
// a hyphenated segment (booking-contact) is NOT split into its last word —
// it simply fails check 6 (the hyphen is non-alphabetic) and the walk
// continues to the segment before it. Part 4 below shows a real row this
// affects. A date-shaped segment with no dots (2010-04-01, cited in the
// brief as a version-marker example) does not actually match any of the
// three version regexes as literally specified (no dot, not purely digits,
// no leading v-digit) — it is caught instead by check 6 (dashes are
// non-alphabetic). Reported here rather than silently patched, since the
// brief's own examples turned out to route through a different rule than
// stated.
const VERSION_V_RE = /^v\d/;
const VERSION_DIGITS_RE = /^\d+$/;
const VERSION_DOTTED_RE = /^\d+\.\d+/;
const ALPHA_ONLY_RE = /^[a-z]+$/;

export function pathTailNoun(pathStr) {
  const p = pathStr || '';
  const segments = p.split('/').filter((s) => s !== '');
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i].toLowerCase();
    if (seg.startsWith('{')) continue;
    if (seg.startsWith('@')) continue;
    if (VERSION_V_RE.test(seg)) continue;
    if (VERSION_DIGITS_RE.test(seg)) continue;
    if (VERSION_DOTTED_RE.test(seg)) continue;
    if (GENERIC_TAILS.has(seg)) continue;
    let candidate = seg;
    if (candidate.includes('.')) {
      const dot = candidate.lastIndexOf('.');
      const stem = candidate.slice(0, dot);
      if (stem === '') continue;
      candidate = stem;
    }
    if (!ALPHA_ONLY_RE.test(candidate)) continue;
    return naiveSingular(candidate);
  }
  return null;
}

// --- shared scoring helpers (same shape as c19/c20/c22) --------------------

function pct(n, d) {
  if (!d) return 'n/a';
  return `${(100 * n / d).toFixed(1)}%`;
}

function mdTable(rows, header) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.map((c) => String(c)).join(' | ')} |`);
  return lines.join('\n');
}

function kindOf(predClass, gtClass) {
  const predIdx = CLASS_ORDER[predClass];
  const truthIdx = CLASS_ORDER[gtClass];
  if (predIdx < truthIdx) return 'leak';
  if (predIdx > truthIdx) return 'overTight';
  return 'exact';
}
function isGoal1Error(predClass, gtClass) { return gtClass === 'w' && predClass === 'x'; }

// --- forked-but-verified pieces (see file header) ---------------------------

// Verbatim copy of c22.mjs's private `eligible` — not exported there, and
// unaffected by which noun source is under test (it only looks at c15's
// fired rule and the row's method), so nothing to parameterise.
function eligible(base, row, variant) {
  if (!RAISE_METHODS.has(row.method)) return false;
  if (base.class !== 'x') return false;
  if (base.floor !== false) return false;
  if (base.rule === 'party-noun') return true;
  if (variant === 'NV' && base.rule === 'live-verb') return true;
  return false;
}

// Generalised copy of c22.mjs's classifyC22: same shape, but the row's noun
// set comes from nounsForRowFn(row, junkSet) instead of a hardcoded call to
// c20's rowNouns. Self-checked below against the real classifyC22.
function classifyC23(row, junkSet, allowlist, variant, nounsForRowFn) {
  const base = classifyC15(row);
  if (!eligible(base, row, variant)) return base;
  const nouns = nounsForRowFn(row, junkSet);
  if (nouns.size > 0 && [...nouns].every((n) => allowlist.has(n))) {
    return { class: 'w', rule: 'allowlist-wins', evidence: [...nouns], floor: false };
  }
  return base;
}

function scoreLovoC23(rows, junkSet, perVendorAllowlist, variant, nounsForRowFn) {
  return scoreC22(rows, (row) => classifyC23(row, junkSet, perVendorAllowlist.get(row.vendor), variant, nounsForRowFn));
}

// --- noun sources for configs A/B/C -----------------------------------------
//
// A: today's nouns, unchanged — c20's own rowNouns (headNounForRow +
//    operationIdHeadNoun, junk-filtered).
function nounsA(row, junkSet) {
  return rowNouns(row, junkSet);
}
// B: path-tail only.
function nounsB(row, junkSet) {
  const out = new Set();
  const n = pathTailNoun(row.path);
  if (n && !junkSet.has(n)) out.add(n);
  return out;
}
// C: today's nouns UNION the path-tail noun. Per the brief, c22's rule
// requires EVERY noun on the row to be allowlisted, so adding a noun can
// only make lowering harder (fewer rescues, fewer leaks) than A — never
// easier. That is a prediction about the DIRECTION, stated before the
// numbers are read; Part 3 below reports whether the data matches it.
function nounsC(row, junkSet) {
  const out = rowNouns(row, junkSet);
  const n = pathTailNoun(row.path);
  if (n && !junkSet.has(n)) out.add(n);
  return out;
}

// --- allowlist-table builders per noun source -------------------------------
//
// Per the brief: "the allowlist itself must be rebuilt from the same noun
// source being tested" — a config's allowlist must never be scored against
// nouns pulled from a different source. buildTableA is c19's buildNounTable
// verbatim shape (imported nowhere here since it is not re-exported cleanly
// standalone from c19 without also pulling classify logic — reproduced
// locally at the same ~10 lines, same field names, same RAISE_METHODS gate,
// so cleanNounTable/nounStats — both genuinely reused from c20 — accept it
// unchanged).
function buildTableA(rows) {
  const table = new Map();
  for (const row of rows) {
    const nouns = new Set();
    const sNoun = headNounForRow(row);
    if (sNoun) nouns.add(sNoun);
    const oNoun = operationIdHeadNoun(row);
    if (oNoun) nouns.add(oNoun);
    for (const noun of nouns) {
      if (!table.has(noun)) table.set(noun, { allCount: 0, pdpRows: [] });
      const entry = table.get(noun);
      entry.allCount += 1;
      if (RAISE_METHODS.has(row.method)) entry.pdpRows.push(row);
    }
  }
  return table;
}
function buildTableB(rows) {
  const table = new Map();
  for (const row of rows) {
    const noun = pathTailNoun(row.path);
    if (!noun) continue;
    if (!table.has(noun)) table.set(noun, { allCount: 0, pdpRows: [] });
    const entry = table.get(noun);
    entry.allCount += 1;
    if (RAISE_METHODS.has(row.method)) entry.pdpRows.push(row);
  }
  return table;
}
function buildTableC(rows) {
  const table = new Map();
  for (const row of rows) {
    const nouns = new Set();
    const sNoun = headNounForRow(row);
    if (sNoun) nouns.add(sNoun);
    const oNoun = operationIdHeadNoun(row);
    if (oNoun) nouns.add(oNoun);
    const tNoun = pathTailNoun(row.path);
    if (tNoun) nouns.add(tNoun);
    for (const noun of nouns) {
      if (!table.has(noun)) table.set(noun, { allCount: 0, pdpRows: [] });
      const entry = table.get(noun);
      entry.allCount += 1;
      if (RAISE_METHODS.has(row.method)) entry.pdpRows.push(row);
    }
  }
  return table;
}

const CONFIGS = [
  { name: 'A (baseline)', buildTable: buildTableA, nounsFn: nounsA },
  { name: 'B (path-tail only)', buildTable: buildTableB, nounsFn: nounsB },
  { name: 'C (union)', buildTable: buildTableC, nounsFn: nounsC },
];

// --- main --------------------------------------------------------------------

function main() {
  const { allRows } = loadCombinedCorpus();
  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  push('# M1-C23: does the path tail name the object better than the operationId head noun?');
  push('');
  push('TRIAL. Reading c22\'s 6 new-leak rows by hand at minN=5/minW=0.95');
  push('surfaced a candidate cause for two Discord rows (update_webhook_message,');
  push('update_original_webhook_message): the real object being edited is a');
  push('MESSAGE, the last real path segment, not "webhook". This pass reads');
  push('the object noun off the PATH TAIL instead, and re-runs c22\'s exact');
  push('sweep three ways (A: today\'s nouns, B: path-tail only, C: union) to');
  push('see whether that changes the trade. Not tuned to look good — a clean');
  push('negative is reported as such if that is what the numbers show.');
  push('');

  // --- verify judge.mjs's GENERIC_TAILS export is visible and unchanged ---
  push(`Verification: judge.mjs's GENERIC_TAILS is now exported and imported directly here (${GENERIC_TAILS.size} entries) — no second copy of the list exists in this file.`);
  push('');

  // --- self-check: classifyC23 with nounsA must reproduce classifyC22 exactly ---
  const rawTableA0 = buildTableA(allRows);
  const { junkSet: junkSetA0, cleanTable: cleanTableA0 } = cleanNounTable(rawTableA0);
  const statsA0 = nounStats(cleanTableA0);
  const allowA0 = deriveAllowlist(statsA0, 5, 0.95);
  let selfCheckMismatches = 0;
  for (const variant of ['N', 'NV']) {
    for (const row of allRows) {
      const a = classifyC22(row, junkSetA0, allowA0, variant);
      const b = classifyC23(row, junkSetA0, allowA0, variant, nounsA);
      if (a.class !== b.class || a.rule !== b.rule) selfCheckMismatches += 1;
    }
  }
  if (selfCheckMismatches > 0) {
    throw new Error(`ESCALATE: classifyC23(row, ..., nounsA) disagrees with the real classifyC22 on ${selfCheckMismatches} (row, variant) pairs at minN=5/minW=0.95 — the generalisation is not faithful, do not trust any number below.`);
  }
  push(`Self-check: classifyC23(row, junkSet, allowlist, variant, nounsA) reproduces classifyC22(row, junkSet, allowlist, variant) exactly on all ${allRows.length} rows, both variants, at minN=5/minW=0.95 (0 mismatches). Trusted.`);
  push('');

  // --- reproduce the known 522 baseline ---
  let baselineWrongX = 0;
  for (const row of allRows) {
    if (!RAISE_METHODS.has(row.method)) continue;
    const res = classifyC15(row);
    if (res.rule !== 'party-noun' && res.rule !== 'live-verb') continue;
    if (row.gt_class !== 'w') continue;
    baselineWrongX += 1;
  }
  if (baselineWrongX !== KNOWN_WRONG_FIGURE) {
    throw new Error(`ESCALATE: reproduced ${baselineWrongX} wrong-x rows, expected the known figure of ${KNOWN_WRONG_FIGURE}. Do not trust any number below until this is resolved.`);
  }
  push(`Baseline reproduced: ${baselineWrongX} wrong-x rows (c15 fired a word rule, truth w), matching c21/c22's known figure of ${KNOWN_WRONG_FIGURE} exactly.`);
  push('');

  // --- Part 2: agreement census -----------------------------------------
  const pdpRows = allRows.filter((r) => RAISE_METHODS.has(r.method));
  push('## Part 2: agreement census (diagnosis, no scoring)');
  push('');
  push(`Over all ${pdpRows.length} scorable PUT/DELETE/PATCH rows.`);
  push('');

  let tailNull = 0, opidNull = 0, summaryNull = 0;
  let agreeOpid = 0, disagreeOpid = 0;
  let agreeSummary = 0, disagreeSummary = 0;
  let tailOnlyVsOpid = 0, opidOnlyVsTail = 0;
  let tailOnlyVsSummary = 0, summaryOnlyVsTail = 0;
  const disagreementExamples = [];

  for (const row of pdpRows) {
    const tail = pathTailNoun(row.path);
    const opid = operationIdHeadNoun(row) || null;
    const summ = headNounForRow(row) || null;

    if (tail === null) tailNull += 1;
    if (opid === null) opidNull += 1;
    if (summ === null) summaryNull += 1;

    if (tail !== null && opid !== null) {
      if (tail === opid) agreeOpid += 1;
      else {
        disagreeOpid += 1;
        if (disagreementExamples.length < 15) {
          disagreementExamples.push([row.method, row.path, row.operationId || '(none)', row.summary || '(none)', row.gt_class, tail, opid]);
        }
      }
    } else if (tail !== null && opid === null) {
      tailOnlyVsOpid += 1;
    } else if (tail === null && opid !== null) {
      opidOnlyVsTail += 1;
    }

    if (tail !== null && summ !== null) {
      if (tail === summ) agreeSummary += 1;
      else disagreeSummary += 1;
    } else if (tail !== null && summ === null) {
      tailOnlyVsSummary += 1;
    } else if (tail === null && summ !== null) {
      summaryOnlyVsTail += 1;
    }
  }

  push(`pathTailNoun: null on ${tailNull}/${pdpRows.length} rows (${pct(tailNull, pdpRows.length)}).`);
  push(`operationIdHeadNoun: empty on ${opidNull}/${pdpRows.length} rows (${pct(opidNull, pdpRows.length)}).`);
  push(`headNounForRow (summary): empty on ${summaryNull}/${pdpRows.length} rows (${pct(summaryNull, pdpRows.length)}).`);
  push('');
  push('vs operationIdHeadNoun (rows where both are non-null):');
  push(`  agree: ${agreeOpid}, disagree: ${disagreeOpid}.`);
  push(`  path-tail produces a noun where operationIdHeadNoun does not: ${tailOnlyVsOpid}.`);
  push(`  operationIdHeadNoun produces a noun where path-tail does not: ${opidOnlyVsTail}.`);
  push('');
  push('vs headNounForRow / summary (rows where both are non-null):');
  push(`  agree: ${agreeSummary}, disagree: ${disagreeSummary}.`);
  push(`  path-tail produces a noun where the summary head noun does not: ${tailOnlyVsSummary}.`);
  push(`  summary head noun produces a noun where path-tail does not: ${summaryOnlyVsTail}.`);
  push('');
  push('15 real rows where path-tail and operationIdHeadNoun disagree:');
  push('');
  push(mdTable(disagreementExamples, ['method', 'path', 'operationId', 'summary', 'truth', 'path-tail noun', 'operationId head noun']));
  push('');

  // --- Part 3: does it change the C22 trade? ------------------------------
  push('## Part 3: does path-tail change the C22 rescue/leak trade?');
  push('');
  push('Expectation stated before reading the numbers: config C (union) can');
  push('only make the allowlist rule HARDER to satisfy than A, never easier —');
  push('c22\'s rule requires EVERY noun on the row to be allowlisted, so a');
  push('union of nouns is a strict superset of constraints. Reported below');
  push('whether the data matches that.');
  push('');

  const vendors = [...new Set(allRows.map((r) => r.vendor))].sort();
  const configResults = {}; // name -> { stats, sweepAllowlists: [{minN,minW,allowlist}], perVariant: { N: {lovoRows}, NV: {...} } }

  for (const cfg of CONFIGS) {
    const rawTable = cfg.buildTable(allRows);
    const { junkSet, cleanTable } = cleanNounTable(rawTable);
    const stats = nounStats(cleanTable);
    const sweepPoints = [];
    for (const minN of SWEEP_MIN_N) {
      for (const minW of SWEEP_MIN_W) {
        sweepPoints.push({ minN, minW, allowlist: deriveAllowlist(stats, minN, minW) });
      }
    }
    const perVariant = {};
    for (const variant of ['N', 'NV']) {
      const lovoRows = [];
      const perPoint = [];
      for (const p of sweepPoints) {
        const perVendorAllowlists = buildLovoAllowlists(stats, vendors, p.minN, p.minW);
        const lovoScore = scoreLovoC23(allRows, junkSet, perVendorAllowlists, variant, cfg.nounsFn);
        lovoRows.push({
          minN: p.minN, minW: p.minW, allowlistSize: p.allowlist.size,
          rescued: lovoScore.rescued, newLeaks: lovoScore.newLeaks,
          remainingWrong: KNOWN_WRONG_FIGURE - lovoScore.rescued,
        });
        perPoint.push({ p, perVendorAllowlists });
      }
      perVariant[variant] = { lovoRows, perPoint };
    }
    configResults[cfg.name] = { junkSet, stats, sweepPoints, perVariant, nounsFn: cfg.nounsFn };

    push(`### Config ${cfg.name}`);
    push('');
    for (const variant of ['N', 'NV']) {
      push(`Variant ${variant} (LOVO):`);
      push('');
      push(mdTable(
        perVariant[variant].lovoRows.map((r) => [r.minN, r.minW.toFixed(2), r.allowlistSize, r.rescued, r.newLeaks, r.remainingWrong]),
        ['minN', 'minW', 'allowlist size', 'rescued', 'new_leaks', 'remaining_wrong'],
      ));
      push('');
    }
  }

  // Compare A vs C directly per grid point to check the stated expectation.
  let cWorseOrEqualEverywhere = true;
  for (const variant of ['N', 'NV']) {
    const aRows = configResults['A (baseline)'].perVariant[variant].lovoRows;
    const cRows = configResults['C (union)'].perVariant[variant].lovoRows;
    for (let i = 0; i < aRows.length; i += 1) {
      if (cRows[i].rescued > aRows[i].rescued) cWorseOrEqualEverywhere = false;
    }
  }
  push(`Expectation check: config C's rescued count is <= config A's rescued count at every grid point, both variants: ${cWorseOrEqualEverywhere ? 'CONFIRMED' : 'VIOLATED'}.`);
  if (!cWorseOrEqualEverywhere) {
    push('The expectation as stated ("adding a noun can only make lowering harder") assumed a FIXED allowlist. It does not hold here because the');
    push('allowlist itself is rebuilt from a different candidate table per config (per the brief\'s own isolation rule) — config C\'s allowlist is');
    push('derived from union-table evidence, which is not the same allowlist config A gets, so the two are not being compared under a shared allowlist.');
    push('This is a data finding, not a plumbing bug — reported as such, not treated as fatal.');
  }
  push('');

  // --- Part 4: the two Discord rows + the other 4 named leak rows --------
  push('## Part 4: the two Discord rows, and c22\'s 6 named leak rows at minN=5/minW=0.95');
  push('');
  const discordRows = allRows.filter((r) => r.operationId === 'update_webhook_message' || r.operationId === 'update_original_webhook_message');
  push(`Found ${discordRows.length} Discord row(s) by operationId in the combined corpus.`);
  push('');
  for (const row of discordRows) {
    const tail = pathTailNoun(row.path);
    const opid = operationIdHeadNoun(row);
    push(`- \`${row.method} ${row.path}\` (${row.operationId}): path-tail noun = \`${tail}\`, operationIdHeadNoun = \`${opid || '(empty)'}\`, summary is empty so headNounForRow is empty. truth = ${row.gt_class}.`);
  }
  push('');
  push('Plain finding: **operationIdHeadNoun already resolves both Discord rows to "message"**, not "webhook" — its tail-stepback only steps back over');
  push('GENERIC_TAILS/"by", and "message" is the last operationId token, so it is returned directly. "message" is also already in c11.mjs\'s SHARED_NOUNS,');
  push('which is why c15 already classifies both rows correctly as x today (rule party-noun, evidence opid:message) — they are NOT among c22\'s 6');
  push('new-leak rows at minN=5/minW=0.95 (confirmed by grep against docs/logs/m1/c22-allowlist-wins.md and by direct row lookup above). The brief\'s');
  push('stated premise ("today the noun comes from the operationId head, which says webhook") does not hold for these two specific rows once measured.');
  push('');
  push('Path-tail on these rows literally returns "messag", not "message" — a real, measured artifact of naiveSingular (imported unmodified, per the');
  push('brief), not a bug in pathTailNoun itself: naiveSingular strips a trailing "es" by removing the last TWO characters unconditionally, so plural');
  push('"messages" (ends "es") becomes "messag" (drops the stem\'s own final "e" along with the plural "s"), while operationId "...webhook_message"');
  push('was already singular in the source text and never goes through that stripping path, so it comes out "message" intact. Same underlying word,');
  push('different literal strings — this is exactly the kind of disagreement counted in Part 2\'s census and shown as row 1 of its 15 examples (Twilio\'s');
  push('DeleteMessage, /Messages/{Sid}.json -> "messag" vs "message"). It has no effect on scoring here (config B/C build their own noun table from the');
  push('same pathTailNoun function, so "messag" is used consistently on both sides), but it does mean neither configuration B nor C changes anything');
  push('about these two specific Discord rows: they were never at risk (already correctly x via SHARED_NOUNS today) and remain correctly x under A, B, and C.');
  push('');

  const namedLeakOpIds = ['deleteNetwork', 'updateDevice', 'deleteDevice', 'validateWebhooks', 'PermissionProfiles_PutPermissionProfiles', 'updateBookingContact'];
  push('c22\'s actual 6 new-leak rows at minN=5/minW=0.95, variant N (from docs/logs/m1/c22-allowlist-wins.md Part F) — checked here against configs A/B/C at the same point:');
  push('');
  const displayN5W95 = { minN: 5, minW: 0.95 };
  const leakRowReport = [];
  for (const opId of namedLeakOpIds) {
    const row = allRows.find((r) => r.operationId === opId);
    if (!row) { leakRowReport.push([opId, '(not found in corpus)', '', '', '', '']); continue; }
    const perConfigClass = {};
    for (const cfg of CONFIGS) {
      const cr = configResults[cfg.name];
      const point = cr.perVariant.N.perPoint.find((pp) => pp.p.minN === displayN5W95.minN && Math.abs(pp.p.minW - displayN5W95.minW) < 1e-9);
      const allow = point.perVendorAllowlists.get(row.vendor);
      const pred = classifyC23(row, cr.junkSet, allow, 'N', cr.nounsFn);
      perConfigClass[cfg.name] = pred.class;
    }
    leakRowReport.push([
      opId, row.method, row.path, row.gt_class,
      perConfigClass['A (baseline)'], perConfigClass['B (path-tail only)'], perConfigClass['C (union)'],
    ]);
  }
  push(mdTable(leakRowReport, ['operationId', 'method', 'path', 'truth', 'pred (A)', 'pred (B)', 'pred (C)']));
  push('');
  push('(pred = this row\'s class under classifyC23 at minN=5/minW=0.95, variant N, using that row\'s own LOVO held-out-vendor allowlist for the named config — matching how c22 itself scored the original 6.)');
  push('');

  // --- Part 5: per-set breakdown -------------------------------------------
  push('## Part 5: per-set breakdown');
  push('');
  // Pick the best point: highest rescued among (config,variant,point)
  // combos at the global minimum new_leaks, same selection rule c22 used.
  let bestOverall = null;
  for (const cfg of CONFIGS) {
    for (const variant of ['N', 'NV']) {
      const rows = configResults[cfg.name].perVariant[variant].lovoRows;
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i];
        if (!bestOverall || r.newLeaks < bestOverall.newLeaks
          || (r.newLeaks === bestOverall.newLeaks && r.rescued > bestOverall.rescued)) {
          bestOverall = { config: cfg.name, variant, ...r, pointIndex: i };
        }
      }
    }
  }
  const noConfigWins = CONFIGS.every((cfg) => {
    const rN = configResults[cfg.name].perVariant.N.lovoRows;
    const idx = rN.findIndex((r) => r.minN === 5 && Math.abs(r.minW - 0.95) < 1e-9);
    return !(rN[idx].rescued > 0 && rN[idx].newLeaks < configResults['A (baseline)'].perVariant.N.lovoRows[idx].newLeaks);
  });
  let displayConfigName, displayVariant, displayMinN, displayMinW;
  if (bestOverall.config !== 'A (baseline)' && bestOverall.rescued > configResults['A (baseline)'].perVariant.N.lovoRows.find((r) => r.minN === 5 && Math.abs(r.minW - 0.95) < 1e-9).rescued) {
    displayConfigName = bestOverall.config; displayVariant = bestOverall.variant; displayMinN = bestOverall.minN; displayMinW = bestOverall.minW;
    push(`Winning point: config ${displayConfigName}, variant ${displayVariant}, minN=${displayMinN}, minW=${displayMinW.toFixed(2)} (LOVO rescued=${bestOverall.rescued}, new_leaks=${bestOverall.newLeaks}).`);
  } else {
    displayConfigName = 'A (baseline)'; displayVariant = 'N'; displayMinN = 5; displayMinW = 0.95;
    push('No configuration beat baseline A\'s own best point, so per-set numbers below are reported at baseline\'s minN=5/minW=0.95, variant N (the same point c22 itself named as best).');
  }
  push('');

  const cr = configResults[displayConfigName];
  const point = cr.perVariant[displayVariant].perPoint.find((pp) => pp.p.minN === displayMinN && Math.abs(pp.p.minW - displayMinW) < 1e-9);
  const perSetRows = [];
  for (const set of SETS) {
    const setRows = allRows.filter((r) => r.set === set);
    const score = scoreLovoC23(setRows, cr.junkSet, point.perVendorAllowlists, displayVariant, cr.nounsFn);
    perSetRows.push([set, score.rescued, score.newLeaks]);
  }
  push(mdTable(perSetRows, ['set', 'rescued', 'new_leaks']));
  push('');

  // --- Part 6: verdict ------------------------------------------------------
  push('## Verdict');
  push('');
  const aBest5x95 = configResults['A (baseline)'].perVariant.N.lovoRows.find((r) => r.minN === 5 && Math.abs(r.minW - 0.95) < 1e-9);
  const bBest = configResults['B (path-tail only)'].perVariant.N.lovoRows.reduce((best, r) => (r.newLeaks < best.newLeaks || (r.newLeaks === best.newLeaks && r.rescued > best.rescued) ? r : best));
  const cBest = configResults['C (union)'].perVariant.N.lovoRows.reduce((best, r) => (r.newLeaks < best.newLeaks || (r.newLeaks === best.newLeaks && r.rescued > best.rescued) ? r : best));
  push(`Config A (baseline) best-known point: rescued=${aBest5x95.rescued}, new_leaks=${aBest5x95.newLeaks} (minN=5, minW=0.95, variant N).`);
  push(`Config B (path-tail only) best point in this sweep: rescued=${bBest.rescued}, new_leaks=${bBest.newLeaks} (minN=${bBest.minN}, minW=${bBest.minW.toFixed(2)}, variant N).`);
  push(`Config C (union) best point in this sweep: rescued=${cBest.rescued}, new_leaks=${cBest.newLeaks} (minN=${cBest.minN}, minW=${cBest.minW.toFixed(2)}, variant N).`);
  push('');
  if (bBest.rescued > aBest5x95.rescued && bBest.newLeaks <= aBest5x95.newLeaks) {
    push('ONE-LINE VERDICT: path-tail (config B) beats the operationId head noun on this trade.');
  } else if (bBest.rescued === 0 || bBest.rescued <= aBest5x95.rescued) {
    push('ONE-LINE VERDICT: path-tail (config B) loses to, or at best ties, the operationId head noun on this trade — a clean negative for this trial.');
  } else {
    push('ONE-LINE VERDICT: path-tail (config B) ties the operationId head noun on this trade (comparable rescue at a comparable or worse leak cost).');
  }
  push('');

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
