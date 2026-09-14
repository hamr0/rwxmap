// M1-C24: via-negativa cleanup of the hand-written PARTY_NOUNS/SHARED_NOUNS
// blocklist (D48). c21's word-by-word audit found many of these words are
// wrong most of the time (webhook 0.018 precision, contact 0.050, device
// 0.087, network 0.063, customer 0.143, channel 0.133, repository 0.133)
// because those words actually mean the caller's OWN thing. The user's
// instruction: keep only the words that measure as third-party; anything
// that measures as "yours" comes out, and the absence of a "yours" noun
// (c20/c22's own, separately-derived allowlist machinery) does the work
// instead.
//
// MEASUREMENT ONLY. c11.mjs, c15.mjs, c19.mjs are never modified. c20.mjs
// and c22.mjs received one small, authorized, additive edit each (an
// OPTIONAL trailing `classifyBase` parameter, defaulting to the existing
// hardcoded classifyC15 import) so this file can inject an alternate base
// classifier without forking their layer logic — see the file-header
// comments in c20.mjs/c22.mjs for the exact diff. Proven behaviour-neutral
// before this file was written: 254/254 tests, c21.mjs still 522, c22.mjs's
// self-checks and adopted-point numbers (rescued=61, new_leaks=6) unchanged,
// c23.mjs exit 0.
//
// Interchangeability of the injected base classifier (c19.mjs's
// classifyWithNouns) with the real c15.classify, verified below rather than
// assumed:
//   - Both return { class, rule, evidence, floor }.
//   - classifyC20/classifyC22 call their base classifier as `classifyBase(row)`
//     — a single positional argument, no opts. The real classifyC15 is called
//     the same way throughout c20.mjs/c22.mjs (never with an opts object), so
//     c15.classify's opts.noTextRaise (default false) never fires in this
//     context either way — classifyWithNouns's omission of that branch is
//     therefore NOT a divergence for this stack.
//   - classifyWithNouns emits the exact rule strings 'party-noun' and
//     'live-verb' that c22's eligible() branches on (copied verbatim from
//     c15's own classify), and sets floor:false on those and floor:true on
//     'floor'/'read-verb'-is-false-floor.../'locked' the same way c15 does.
//   - ONE real, documented asymmetry exists and is measured, not papered
//     over (Part C-0 below): classifyWithNouns's THIRD noun-match fallback
//     (a buried operationId token, not the head noun) always tests the
//     REAL, hardcoded SHARED_NOUNS import, never the passed nounSet — this
//     is not a bug, it is copied verbatim from c15.mjs's own partyNounHit,
//     which has the identical asymmetry by design (c15 never extends
//     SHARED_NOUNS via the token fallback either). The practical
//     consequence for THIS pass: a SHARED_NOUNS word removed by the
//     cleanup can still raise x via a buried operationId token, even under
//     variant STRIP. Part C-0 counts exactly how many rows this affects
//     before any cfg1/2/3 number is trusted.
//
// How to re-run: node poc/m1/arbiter/c24.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify as classifyC15 } from './c15.mjs';
import { headNounForRow, operationIdHeadNoun } from './judge.mjs';
import { CLASS_ORDER } from './arbiter.mjs';
import { REPO_ROOT } from './load-sets.mjs';
import {
  loadCombinedCorpus, truthSplit, buildNounTable, classifyWithNouns,
} from './c19.mjs';
import {
  cleanNounTable, nounStats, deriveAllowlist, buildLovoAllowlists, classifyC20,
} from './c20.mjs';
import { classifyC22 } from './c22.mjs';
import { PARTY_NOUNS, SHARED_NOUNS } from './c11.mjs';

const OUT_MD = path.join(REPO_ROOT, 'docs/logs/m1/c24-party-nouns-cleanup.md');
const RAISE_METHODS = new Set(['PUT', 'DELETE', 'PATCH']);
const SETS = ['camara', 'holdout1', 'holdout2', 'holdout3', 'holdout4', 'holdout5', 'exam2', 'exam3'];

// c22's adopted point (M1-C22, the user's ruling): variant N, minN=5, minW=0.95.
const C22_MIN_N = 5;
const C22_MIN_W = 0.95;
// c20's adopted point (M1-C20/D50 lineage): minN=2, minW=0.80.
const C20_MIN_N = 2;
const C20_MIN_W = 0.80;

// The classification bar for THIS pass's word-by-word audit (given by the brief).
const YOURS_MIN_N = 5;
const YOURS_MIN_W = 0.80;
const YOURS_STRICT_MIN_W = 0.95;
const THIRD_PARTY_MAX_W = 0.50;

function pct(n, d) {
  if (!d) return 'n/a';
  return `${(100 * n / d).toFixed(1)}%`;
}

function mdTable(rows, header) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const r of rows) lines.push(`| ${r.map((c) => String(c)).join(' | ')} |`);
  return lines.join('\n');
}

// --- Part A: measure every word in PARTY_NOUNS / SHARED_NOUNS -------------
//
// candidate head noun of a row: headNounForRow(row) or operationIdHeadNoun(row)
// (both already lowercased + naiveSingular'd), same primitives c19's
// buildNounTable uses. A row counts for `word` if either equals it.
export function measureWord(word, pdpRows) {
  const rows = pdpRows.filter((r) => headNounForRow(r) === word || operationIdHeadNoun(r) === word);
  const n = rows.length;
  const split = truthSplit(rows);
  const vendors = new Set(rows.map((r) => r.vendor)).size;
  const wShare = n ? split.w / n : null;
  return { word, n, w: split.w, x: split.x, wShare, vendorCount: vendors };
}

export function classifyWord(stat) {
  if (stat.n === 0) return 'DEAD';
  if (stat.n >= YOURS_MIN_N && stat.wShare >= YOURS_MIN_W) return 'YOURS';
  if (stat.wShare < THIRD_PARTY_MAX_W) return 'THIRD-PARTY';
  return 'MIXED';
}

function ruleSplitString(goal1ByRule) {
  return [...goal1ByRule.entries()].sort((a, b) => b[1] - a[1]).map(([rule, n]) => `${rule} ${n}`).join(', ') || '(none)';
}

// --- main --------------------------------------------------------------

function main() {
  const { allRows } = loadCombinedCorpus();
  const pdpRows = allRows.filter((r) => RAISE_METHODS.has(r.method));
  const lines = [];
  const push = (s) => { lines.push(s); console.log(s); };

  push('# M1-C24: via-negativa cleanup of the hand-written PARTY_NOUNS/SHARED_NOUNS list');
  push('');
  push('Measurement only. Every number below is computed from the 5465-row');
  push('combined corpus (loadCombinedCorpus, six original sets + exam2 +');
  push('exam3). PUT/DELETE/PATCH rows only for word statistics (n=' + `${pdpRows.length}` + '),');
  push('matching where c15\'s party-noun raise rule actually fires.');
  push('');

  // --- authorized-edit proof: cfg0 (real classifyC15 default) reproduces
  // the known baseline numbers before anything else is trusted. ---
  const rawTable = buildNounTable(allRows);
  const { junkSet, cleanTable } = cleanNounTable(rawTable);
  const stats = nounStats(cleanTable);
  const vendors = [...new Set(allRows.map((r) => r.vendor))].sort();
  const allow20 = deriveAllowlist(stats, C20_MIN_N, C20_MIN_W);
  const allow22 = deriveAllowlist(stats, C22_MIN_N, C22_MIN_W);
  const perVendorAllow20 = buildLovoAllowlists(stats, vendors, C20_MIN_N, C20_MIN_W);
  const perVendorAllow22 = buildLovoAllowlists(stats, vendors, C22_MIN_N, C22_MIN_W);

  function isGoal1(predClass, gtClass) { return gtClass === 'w' && predClass === 'x'; }
  function isGoal2(predClass, gtClass) { return gtClass === 'x' && predClass === 'w'; }
  function isLoosening(predClass, gtClass) { return CLASS_ORDER[predClass] < CLASS_ORDER[gtClass]; }

  // Scope: ALL 5465 rows (coordinator's correction) — GET/POST are in the
  // base so the table matches the coordinator's independently-measured
  // reference numbers exactly. goal-1 is also split by res.rule so a word
  // moving from c15's `party-noun` rule to C20's `no-own-noun` rule (the
  // entire point of this pass) is visible, not just its net total.
  function scoreConfig(rows, scoreFn) {
    let goal1 = 0, goal2 = 0, allLoosening = 0, loosenOnGet = 0;
    const goal1ByRule = new Map();
    for (const row of rows) {
      const res = scoreFn(row);
      if (isGoal1(res.class, row.gt_class)) {
        goal1 += 1;
        goal1ByRule.set(res.rule, (goal1ByRule.get(res.rule) || 0) + 1);
      }
      if (isGoal2(res.class, row.gt_class)) goal2 += 1;
      if (isLoosening(res.class, row.gt_class)) {
        allLoosening += 1;
        if (row.method === 'GET') loosenOnGet += 1;
      }
    }
    return { n: rows.length, goal1, goal2, allLoosening, loosenOnGet, goal1ByRule };
  }

  // combinedClassify: real function composition, exactly as the coordinator
  // specified — classifyC22 wraps classifyC20 wraps classifyBase. C20 only
  // ever acts on rows its own inner base left at a floor-w (PUT/DELETE/PATCH);
  // for every other row (including one c15/classifyWithNouns already raised
  // to x via live-verb/party-noun) it returns that inner result UNCHANGED,
  // so C22's own eligibility check (which reads ITS classifyBase's returned
  // .rule) still sees the original rule name from whichever layer actually
  // produced it — 'party-noun'/'live-verb' from the base classifier, or
  // 'no-own-noun' from C20 (which C22 never touches, by design).
  function combinedClassify(row, classifyBase, useC20, useC22) {
    const a20 = perVendorAllow20.get(row.vendor) || new Set();
    const innerC20 = (rr) => (useC20 ? classifyC20(rr, junkSet, a20, classifyBase) : classifyBase(rr));
    if (!useC22) return innerC20(row);
    const a22 = perVendorAllow22.get(row.vendor) || new Set();
    return classifyC22(row, junkSet, a22, 'N', innerC20);
  }

  push('## Proof: the authorized c20.mjs/c22.mjs edit is faithful, and cfg 0 reproduces the real combined-stack numbers');
  push('');
  push('Reference (coordinator\'s independent re-measurement, all 5465 rows,');
  push('LOVO): c15 alone goal-2=280, all-loosening=297 (280 + 17 fixed GET');
  push('mismatches), goal-1=625 (floor 103, live-verb 81, party-noun 441);');
  push('c15+C20 goal-2=89, goal-1=1936 (floor 103, live-verb 81, no-own-noun');
  push('1311, party-noun 441); c15+C22 goal-2=286, goal-1=564 (floor 103,');
  push('live-verb 81, party-noun 380); c15+C20+C22 (= cfg 0) goal-2=95,');
  push('goal-1=1875 (floor 103, live-verb 81, no-own-noun 1311, party-noun 380).');
  push('');

  function checkAgainst(label, score, expectedGoal1, expectedGoal2, expectedSplit) {
    push(`${label}: goal-2=${score.goal2}, goal-1=${score.goal1} (${ruleSplitString(score.goal1ByRule)}).`);
    if (score.goal1 !== expectedGoal1 || score.goal2 !== expectedGoal2) {
      throw new Error(`ESCALATE: ${label} = goal-1 ${score.goal1} / goal-2 ${score.goal2}, expected goal-1 ${expectedGoal1} / goal-2 ${expectedGoal2}. Do not trust any number below.`);
    }
    for (const [rule, n] of Object.entries(expectedSplit)) {
      const got = score.goal1ByRule.get(rule) || 0;
      if (got !== n) {
        throw new Error(`ESCALATE: ${label} goal-1 rule '${rule}' = ${got}, expected ${n}. Do not trust any number below.`);
      }
    }
  }

  const c15OnlyScore = scoreConfig(allRows, (row) => classifyC15(row));
  checkAgainst('c15 alone', c15OnlyScore, 625, 280, { floor: 103, 'live-verb': 81, 'party-noun': 441 });
  const c15C20Score = scoreConfig(allRows, (row) => combinedClassify(row, classifyC15, true, false));
  checkAgainst('c15+C20', c15C20Score, 1936, 89, { floor: 103, 'live-verb': 81, 'no-own-noun': 1311, 'party-noun': 441 });
  const c15C22Score = scoreConfig(allRows, (row) => combinedClassify(row, classifyC15, false, true));
  checkAgainst('c15+C22', c15C22Score, 564, 286, { floor: 103, 'live-verb': 81, 'party-noun': 380 });
  const cfg0Bare = scoreConfig(allRows, (row) => combinedClassify(row, classifyC15, true, true));
  checkAgainst('cfg 0 (c15+C20+C22, default path)', cfg0Bare, 1875, 95, { floor: 103, 'live-verb': 81, 'no-own-noun': 1311, 'party-noun': 380 });
  push('All four intermediate configurations reproduce the coordinator\'s independently-measured numbers exactly, including the full goal-1 rule split. Trusted.');
  push('');

  const baseNounSet = new Set([...PARTY_NOUNS, ...SHARED_NOUNS]);
  const injectedBase = (row) => classifyWithNouns(row, baseNounSet);
  const cfg0Injected = scoreConfig(allRows, (row) => combinedClassify(row, injectedBase, true, true));
  push(`cfg 0 via the INJECTED path (classifyBase = classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS), the real, unmodified noun set): goal-1=${cfg0Injected.goal1}, goal-2=${cfg0Injected.goal2}.`);
  if (cfg0Injected.goal1 !== cfg0Bare.goal1 || cfg0Injected.goal2 !== cfg0Bare.goal2) {
    throw new Error(`ESCALATE: injected-path cfg0 (goal-1=${cfg0Injected.goal1}, goal-2=${cfg0Injected.goal2}) does not match the default-path cfg0 (goal-1=${cfg0Bare.goal1}, goal-2=${cfg0Bare.goal2}) with the SAME (unmodified) noun set. The injection is not faithful — do not trust cfg1/2/3.`);
  }
  push('Injected path matches the default path exactly, same noun set. Injection is faithful. Trusted.');
  push('');

  // --- Part C-0: measure the documented opid-token/SHARED_NOUNS asymmetry ---
  push('## Part C-0: the classifyWithNouns third-fallback asymmetry, measured');
  push('');
  push('classifyWithNouns\'s buried-operationId-token fallback always tests the');
  push('REAL, hardcoded SHARED_NOUNS import (this matches c15\'s own');
  push('partyNounHit, which has the identical asymmetry by design — neither');
  push('ever extends the token fallback with PARTY_NOUNS or a substituted');
  push('set). Consequence for this pass: a SHARED_NOUNS word removed under');
  push('a cleanup variant can still raise x via this fallback. Counted below,');
  push('not assumed.');
  push('');

  // --- Part A: word-by-word measurement ------------------------------------
  push('## Part A: word-by-word measurement');
  push('');
  push(`Bar: YOURS = n >= ${YOURS_MIN_N} and w-share >= ${YOURS_MIN_W}; THIRD-PARTY = w-share < ${THIRD_PARTY_MAX_W}; MIXED = everything else (including n < ${YOURS_MIN_N}); DEAD = n = 0 (never a candidate head noun on a PUT/DELETE/PATCH row).`);
  push('');
  push('c11.mjs adds \'repository\' to PARTY_NOUNS (it is not in judge.mjs\'s');
  push('own PARTY_NOUNS) — counted under PARTY_NOUNS below, as that is where');
  push('c11.mjs places it.');
  push('');

  function reportList(label, words) {
    const stats2 = [...words].sort().map((w) => {
      const s = measureWord(w, pdpRows);
      return { ...s, group: classifyWord(s), strictYours: s.n >= YOURS_MIN_N && s.wShare !== null && s.wShare >= YOURS_STRICT_MIN_W };
    });
    push(`### ${label} (${words.size} words)`);
    push('');
    push(mdTable(
      stats2.map((s) => [
        s.word, s.n, s.w, s.x,
        s.wShare === null ? 'n/a' : `${(s.wShare * 100).toFixed(1)}%`,
        s.vendorCount, s.group, s.strictYours ? 'yes' : 'no',
      ]),
      ['word', 'n', 'truth-w', 'truth-x', 'w-share', '# vendors', 'group', 'also passes at w-share>=0.95'],
    ));
    push('');
    return stats2;
  }

  const partyStats = reportList('PARTY_NOUNS', PARTY_NOUNS);
  const sharedStats = reportList('SHARED_NOUNS', SHARED_NOUNS);
  const allStats = [...partyStats.map((s) => ({ ...s, list: 'PARTY_NOUNS' })), ...sharedStats.map((s) => ({ ...s, list: 'SHARED_NOUNS' }))];

  for (const group of ['YOURS', 'THIRD-PARTY', 'MIXED', 'DEAD']) {
    const inGroup = allStats.filter((s) => s.group === group);
    push(`**${group}** (${inGroup.length}): ${inGroup.length ? inGroup.map((s) => `\`${s.word}\` (${s.list})`).join(', ') : '(none)'}`);
    push('');
  }
  const strictYours = allStats.filter((s) => s.group === 'YOURS' && s.strictYours);
  push(`Of the YOURS words, ${strictYours.length} would ALSO pass at the stricter w-share>=${YOURS_STRICT_MIN_W} bar: ${strictYours.length ? strictYours.map((s) => `\`${s.word}\``).join(', ') : '(none)'}.`);
  push('');

  // --- Part B: the proposed cleaned lists -----------------------------------
  push('## Part B: the proposed cleaned lists');
  push('');
  const yoursWords = new Set(allStats.filter((s) => s.group === 'YOURS').map((s) => s.word));
  const thirdPartyWords = new Set(allStats.filter((s) => s.group === 'THIRD-PARTY').map((s) => s.word));
  const mixedWords = new Set(allStats.filter((s) => s.group === 'MIXED').map((s) => s.word));
  const deadWords = new Set(allStats.filter((s) => s.group === 'DEAD').map((s) => s.word));

  // variant KEEP: remove YOURS only; MIXED and DEAD stay.
  const keepPartyNouns = new Set([...PARTY_NOUNS].filter((w) => !yoursWords.has(w)));
  const keepSharedNouns = new Set([...SHARED_NOUNS].filter((w) => !yoursWords.has(w)));
  const keepNounSet = new Set([...keepPartyNouns, ...keepSharedNouns]);

  // variant STRIP: remove YOURS, MIXED and DEAD; only THIRD-PARTY survives.
  const stripPartyNouns = new Set([...PARTY_NOUNS].filter((w) => thirdPartyWords.has(w)));
  const stripSharedNouns = new Set([...SHARED_NOUNS].filter((w) => thirdPartyWords.has(w)));
  const stripNounSet = new Set([...stripPartyNouns, ...stripSharedNouns]);

  push(`**variant KEEP** — removes only YOURS words (${yoursWords.size} removed), MIXED and DEAD stay:`);
  push('');
  push(`PARTY_NOUNS (${keepPartyNouns.size} of ${PARTY_NOUNS.size}): ${[...keepPartyNouns].sort().map((w) => `\`${w}\``).join(', ')}`);
  push('');
  push(`SHARED_NOUNS (${keepSharedNouns.size} of ${SHARED_NOUNS.size}): ${[...keepSharedNouns].sort().map((w) => `\`${w}\``).join(', ')}`);
  push('');
  push(`**variant STRIP** — removes YOURS, MIXED and DEAD; only THIRD-PARTY survives (${thirdPartyWords.size} words total):`);
  push('');
  push(`PARTY_NOUNS (${stripPartyNouns.size} of ${PARTY_NOUNS.size}): ${[...stripPartyNouns].sort().map((w) => `\`${w}\``).join(', ') || '(none)'}`);
  push('');
  push(`SHARED_NOUNS (${stripSharedNouns.size} of ${SHARED_NOUNS.size}): ${[...stripSharedNouns].sort().map((w) => `\`${w}\``).join(', ') || '(none)'}`);
  push('');

  // Part C-0 continued: does removing a SHARED_NOUNS word from a variant's
  // set actually get bypassed by the hardcoded third fallback? Measured for
  // both variants in continueMain() below (needs arbiter.mjs's tokensForRow
  // + judge.mjs's naiveSingular, imported after this function).
  push('Bypass check (Part C-0, continued): for each variant, rows where a');
  push('removed SHARED_NOUNS word would still fire x via the hardcoded');
  push('opid-token fallback (i.e. it is NOT the row\'s head noun, only a');
  push('buried operationId token) — this is the count classifyWithNouns');
  push('cannot suppress even under that variant\'s reduced noun set:');
  push('');

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD} (partial — continuing in-process)`);

  // The remainder (bypass count, Parts C/D/E) is appended below by
  // continueMain(), which has access to the primitives needed for the
  // opid-token bypass check and the four-configuration scoring.
  continueMain({
    lines, push, allRows, pdpRows, junkSet, stats, vendors,
    perVendorAllow20, perVendorAllow22, combinedClassify, classifyC15,
    keepNounSet, stripNounSet, keepSharedNouns, stripSharedNouns,
    scoreConfig, cfg0Bare,
  });
}

import { tokensForRow } from './arbiter.mjs';
import { naiveSingular } from './judge.mjs';

function bypassCount(pdpRowsIn, removedSharedWords) {
  if (removedSharedWords.size === 0) return { count: 0, rows: [] };
  const hits = [];
  for (const row of pdpRowsIn) {
    const sHead = headNounForRow(row);
    const oHead = operationIdHeadNoun(row);
    const { tokens } = tokensForRow(row);
    for (const t of tokens) {
      const word = naiveSingular(t.toLowerCase());
      if (removedSharedWords.has(word) && word !== sHead && word !== oHead) {
        hits.push({ row, word });
        break;
      }
    }
  }
  return { count: hits.length, rows: hits };
}

function continueMain(ctx) {
  const {
    lines, push, allRows, pdpRows, junkSet, stats, vendors,
    perVendorAllow20, perVendorAllow22, combinedClassify, classifyC15,
    keepNounSet, stripNounSet, keepSharedNouns, stripSharedNouns,
    scoreConfig, cfg0Bare,
  } = ctx;

  const removedSharedKeep = new Set([...SHARED_NOUNS].filter((w) => !keepSharedNouns.has(w)));
  const removedSharedStrip = new Set([...SHARED_NOUNS].filter((w) => !stripSharedNouns.has(w)));
  const bypassKeep = bypassCount(pdpRows, removedSharedKeep);
  const bypassStrip = bypassCount(pdpRows, removedSharedStrip);
  push(`variant KEEP: ${removedSharedKeep.size} SHARED_NOUNS words removed (${[...removedSharedKeep].join(', ') || '(none)'}); bypass rows = ${bypassKeep.count}.`);
  push(`variant STRIP: ${removedSharedStrip.size} SHARED_NOUNS words removed (${[...removedSharedStrip].join(', ') || '(none)'}); bypass rows = ${bypassStrip.count}.`);
  if (bypassKeep.count > 0 || bypassStrip.count > 0) {
    push('');
    push('These rows would still raise x today (via the real SHARED_NOUNS');
    push('opid-token fallback, which classifyWithNouns cannot suppress under');
    push('either variant) but are counted below AS IF the variant fully');
    push('applied, since classifyC15\'s own token fallback has this identical');
    push('hardcoding and no in-scope file may be edited to parameterise it.');
    push('cfg1/cfg2/cfg3 below are therefore a slight UNDER-estimate of how');
    push('many rows a real edit to PARTY_NOUNS/SHARED_NOUNS would move —');
    push('these specific bypass rows would still resolve to x in the real');
    push('list even after the edit, same as measured here. A bypass word');
    push('keeps a row at x, and a row held at x cannot become a leak, so');
    push('the bypass UNDER-counts leaks relative to a real edit. Measured');
    push('by the orchestrator with the bypass emulated off: goal-2 leaks');
    push('are KEEP 99 and STRIP 107, against 97 and 103 with the bypass on.');
  } else {
    push('Zero bypass rows for either variant — the third-fallback asymmetry');
    push('has no measurable effect on this specific word set. cfg1/2/3 below');
    push('can be trusted as a faithful measurement of the proposed cleanup.');
  }
  push('');

  // --- Part C: score cfg0-cfg3 -----------------------------------------------
  push('## Part C: four configurations, LOVO, all 5465 rows');
  push('');
  push('cfg 0 = today\'s shape (c15 + C20 layer + C22 layer, unchanged lists) — the control.');
  push('cfg 1 = same, PARTY_NOUNS/SHARED_NOUNS replaced by variant KEEP.');
  push('cfg 2 = same, replaced by variant STRIP.');
  push('cfg 3 = variant STRIP with the C22 layer DISABLED.');
  push('');
  push('goal-1 = truth w predicted x (over-tight, a usability cost) — split by');
  push('which rule produced the x, so a word moving from c15\'s `party-noun`');
  push('rule to C20\'s `no-own-noun` rule (the entire point of this pass) is');
  push('visible, not just the net total.');
  push('goal-2 (x-as-w) = truth x predicted w — the go/no-go gate. Reported');
  push('separately from all-loosening; never the same number.');
  push('all-loosening = every row where the predicted class is strictly');
  push('looser than truth (r<w<x order) — goal-2 plus a fixed 17 GET rows');
  push('whose truth label is w/x while GET is hard-locked to r (present in');
  push('every configuration identically, since nothing here ever touches GET).');
  push('');

  const cfgs = [
    { name: 'cfg 0 (control, unchanged lists)', base: classifyC15, useC20: true, useC22: true },
    { name: 'cfg 1 (variant KEEP)', base: (row) => classifyWithNouns(row, keepNounSet), useC20: true, useC22: true },
    { name: 'cfg 2 (variant STRIP)', base: (row) => classifyWithNouns(row, stripNounSet), useC20: true, useC22: true },
    { name: 'cfg 3 (variant STRIP, C22 disabled)', base: (row) => classifyWithNouns(row, stripNounSet), useC20: true, useC22: false },
  ];

  const cfgScores = cfgs.map((cfg) => ({
    ...cfg,
    score: scoreConfig(allRows, (row) => combinedClassify(row, cfg.base, cfg.useC20, cfg.useC22)),
  }));

  push(mdTable(
    cfgScores.map((c) => [
      c.name, c.score.n, c.score.goal2, c.score.allLoosening, c.score.goal1,
      ruleSplitString(c.score.goal1ByRule),
      c.score.goal2 - cfgScores[0].score.goal2, c.score.goal1 - cfgScores[0].score.goal1,
    ]),
    ['config', 'n', 'goal-2 (x-as-w)', 'all-loosening', 'goal-1 total', 'goal-1 by rule', 'delta goal-2 vs cfg0', 'delta goal-1 vs cfg0'],
  ));
  push('');
  push(`Sanity: cfg 0's goal-1/goal-2 above (${cfgScores[0].score.goal1}/${cfgScores[0].score.goal2}) must equal the earlier-proven cfg0 numbers (${cfg0Bare.goal1}/${cfg0Bare.goal2}).`);
  if (cfgScores[0].score.goal1 !== cfg0Bare.goal1 || cfgScores[0].score.goal2 !== cfg0Bare.goal2) {
    throw new Error('ESCALATE: cfg0 recomputed in Part C does not match the earlier-proven cfg0 numbers.');
  }
  push('Confirmed equal.');
  push('');

  push('### Same four configurations, PUT/DELETE/PATCH rows only (secondary view, cheap to add)');
  push('');
  const cfgScoresPdp = cfgs.map((cfg) => ({
    ...cfg,
    score: scoreConfig(pdpRows, (row) => combinedClassify(row, cfg.base, cfg.useC20, cfg.useC22)),
  }));
  push(mdTable(
    cfgScoresPdp.map((c) => [
      c.name, c.score.n, c.score.goal2, c.score.allLoosening, c.score.goal1, ruleSplitString(c.score.goal1ByRule),
    ]),
    ['config', 'n (PDP only)', 'goal-2 (x-as-w)', 'all-loosening', 'goal-1 total', 'goal-1 by rule'],
  ));
  push('');

  // --- Part D: the ruling condition ------------------------------------------
  push('## Part D: the ruling condition — does the cleanup break goal 2?');
  push('');
  push(`Goal-2 baseline = ${cfgScores[0].score.goal2} (cfg 0). Any variant whose goal-2 count rises above ${cfgScores[0].score.goal2} is a break; per the user's instruction, a break means leave the list alone for that variant.`);
  push('');
  for (const c of cfgScores.slice(1)) {
    const rose = c.score.goal2 > cfgScores[0].score.goal2;
    push(`${c.name}: goal-2 = ${c.score.goal2} vs cfg 0's ${cfgScores[0].score.goal2} — ${rose ? `ROSE by ${c.score.goal2 - cfgScores[0].score.goal2} (BREAK — leave this variant alone)` : (c.score.goal2 < cfgScores[0].score.goal2 ? `fell by ${cfgScores[0].score.goal2 - c.score.goal2} (no break)` : 'unchanged (no break)')}.`);
  }
  push('');
  push(`cfg 3 (STRIP, C22 disabled) is compared the same way — goal-2 = ${cfgScores[3].score.goal2} vs cfg 0's ${cfgScores[0].score.goal2} — and its goal-1 split (${ruleSplitString(cfgScores[3].score.goal1ByRule)}) is compared against cfg 2's (${ruleSplitString(cfgScores[2].score.goal1ByRule)}) to see whether C22 still does anything once the hand list no longer contains words C22 was rescuing.`);
  push('');
  const survivors = cfgScores.slice(1).filter((c) => c.score.goal2 <= cfgScores[0].score.goal2);
  let recommendation;
  if (survivors.length === 0) {
    recommendation = 'Leave the list alone. Every variant that touches PARTY_NOUNS/SHARED_NOUNS raised goal-2\'s leak count above cfg 0\'s baseline — the ruling condition (any rise in goal 2 means leave the list alone) is triggered for all of them.';
  } else {
    const best = survivors.reduce((b, c) => (c.score.goal1 < b.score.goal1 ? c : b), survivors[0]);
    recommendation = `Adopt ${best.name}: goal-2 does not rise above cfg 0's baseline (${best.score.goal2} vs ${cfgScores[0].score.goal2}), and goal-1 moves from ${cfgScores[0].score.goal1} to ${best.score.goal1} (delta ${best.score.goal1 - cfgScores[0].score.goal1}).`;
  }
  push(`**Recommendation:** ${recommendation}`);
  push('');

  // --- Part E: per-set breakdown for the best surviving variant (or KEEP) ---
  const bestForPartE = survivors.length
    ? survivors.reduce((b, c) => (c.score.goal1 < b.score.goal1 ? c : b), survivors[0])
    : cfgScores[1]; // variant KEEP, per the brief's fallback instruction
  push(`## Part E: per-set breakdown for ${bestForPartE.name}`);
  push('');
  push('All 8 sets are burned for scoring a rule CHANGE (every one of them');
  push('has already been read, or its words measured, during M1-C9 through');
  push('C23 — none is a genuinely unseen exam for this specific decision).');
  push('Exam 4 (being drawn separately, unlabelled as of now) is the set');
  push('that will score this change honestly.');
  push('');
  const perSetRows = SETS.map((setName) => {
    const setRows = allRows.filter((r) => r.set === setName);
    const cfg0Set = scoreConfig(setRows, (row) => combinedClassify(row, classifyC15, true, true));
    const bestSet = scoreConfig(setRows, (row) => combinedClassify(row, bestForPartE.base, bestForPartE.useC20, bestForPartE.useC22));
    return [setName, setRows.length, cfg0Set.goal1, cfg0Set.goal2, bestSet.goal1, bestSet.goal2];
  });
  push(mdTable(perSetRows, ['set', 'n', 'cfg0 goal-1', 'cfg0 goal-2', `${bestForPartE.name} goal-1`, `${bestForPartE.name} goal-2`]));
  push('');

  writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(`\nWrote ${OUT_MD}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
