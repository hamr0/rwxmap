---
type: reference
title: rwxmap — PRD
status: stable
---

# rwxmap — PRD

## The floor (start here)

Every operation starts at its method's floor. The floor is each method's
own measured truth lean over the 4171-row provider corpus
(`data/provider-corpus-2026-09-16/`, 15 complete official API specs —
stripe, openai, square, zoom, paypal, meta-whatsapp, spotify,
digitalocean, jira, mailchimp, asana, datadog, intercom, canva, figma —
labelled blind under `data/calibration-2026-09-14/BRIEF.md`). This
replaced the prior 5465-row corpus on 2026-09-16: that corpus never saw
one complete API (319 of its 332 providers had zero GET rows, 58
contributed exactly 24 write rows and nothing else), so it could not
give a per-provider truth read; the old table and its numbers are in
`docs/logs/learnings.md`. It is a starting value, never an early return
(D42).

| method | n | truth r | truth w | truth x | floor | holds? |
|---|---|---|---|---|---|---|
| GET | 1960 | 100% | 0% | 0% | **r** | yes |
| POST | 1309 | 9% | 29% | 61% | **x** | yes |
| PUT | 345 | 0% | 93% | 7% | **w** | yes |
| DELETE | 473 | 0% | 92% | 8% | **w** | yes |
| PATCH | 84 | 0% | 98% | 2% | **w** | yes |

Every floor holds on the new corpus, including POST at 61% x — unlike
exam 5's unseen-vendor draw against the old corpus, where POST
inverted (x 62% to 23%, r 17% to 63%); that inversion and its
vendor-by-vendor recheck are recorded in `docs/logs/learnings.md` and
are not repeated here since this table supersedes them as the current
per-method truth read.

## Truth by provider (new — the old corpus could not give this)

No single-corpus provider had enough rows to read a per-provider truth
lean before; the 4171-row provider corpus's 15 complete specs can:

| provider | n | r | w | x |
|---|---|---|---|---|
| digitalocean | 684 | 53% | 30% | 17% |
| jira | 610 | 50% | 35% | 15% |
| stripe | 594 | 46% | 29% | 25% |
| openai | 346 | 48% | 24% | 28% |
| square | 332 | 48% | 33% | 20% |
| mailchimp | 298 | 50% | 31% | 19% |
| asana | 249 | 48% | 27% | 25% |
| datadog | 235 | 52% | 29% | 19% |
| intercom | 231 | 49% | 32% | 19% |
| zoom | 155 | 52% | 28% | 21% |
| paypal | 115 | 37% | 24% | 39% |
| meta-whatsapp | 113 | 43% | 22% | 35% |
| spotify | 96 | 63% | 29% | 8% |
| canva | 59 | 61% | 8% | 31% |
| figma | 54 | 80% | 13% | 7% |

32 rows overlap the old corpus (all stripe, every stripe row the old
corpus had); 29 of 32 agree (90.6%), and all 3 disagreements are
x → w — the new labels lean slightly looser.

**How the flow works (the user's reading, 2026-09-13).** One sequence,
three steps. Each step takes the rows the step before left behind.

1. **Step 1, r.** Start every GET / HEAD / OPTIONS row at r. Then look
   at POST, twice: a POST whose **lead token** is a read verb is r; and
   a POST the lead rule did not claim, carrying a never-a-noun compute
   verb **anywhere** in its name, is r too. Built and frozen 2026-09-16
   (D74) — 2052 claimed, 3 leaks, 2049 of the corpus's 2082 truth-r
   rows found (98.4%).
2. **Step 2, w.** Start every PUT / DELETE / PATCH row at w. Then look
   at the POST rows step 1 left behind: a POST whose lead token is a
   modify verb from `MODIFY_VERBS` is w, and so is one whose
   operationId carries no verb at all (a bare `PostThing` name) but
   whose summary leads with one. Either way the lowering is blocked
   when the row names someone who is not the caller, from
   `OTHER_PARTY`. Built and frozen 2026-09-17 (D75) — 1134 claimed,
   71 leaks, reaching 227 of the 380 truth-w POST rows. See learnings,
   "One-flow ladder".
3. **Step 3, x.** Two rules. `raise-word` scans the PUT / DELETE /
   PATCH rows step 2 floored WITHOUT a word and raises them to x when
   one of the 17 `RAISE_WORDS` nouns fires at any token position — 19
   claimed, 19 right, 0 false alarms. `floor-post` is the named
   leftover pile: every row steps 1 and 2 left, 985 of them, all POST,
   called x because x is the tightest class and nothing spoke for the
   row. Built and frozen 2026-09-17 (D78) — 1004 claimed, 818 right,
   **0 leaks, structurally**, since x is the tightest class and there
   is nothing looser for step 3 to be wrong toward.

**Superseded — what follows describes the retired core.** The shape that
replaced it is in "The new core" further down, and it is what the code
implements today. All three steps are now built, frozen and living in
`src/`: step 1 (D74), step 2 (D75), step 3 (D78), graduated from `poc/`
to `src/` on 2026-09-17 (D79). The freeze is on the rules and the word
lists, not on where the files sit — `src/` reproduces them with 0 class
/ 0 rule / 0 source / 0 matched differences over all 4171 corpus rows —
so graduation re-housed the frozen core, it did not thaw it.

**The build, step by step, in plain words (the user's ruling
2026-09-14: keep it all as is, this is the best measured shape).**

1. **Step 1, r.** GET is r. POST with a read verb is r. Unchanged.
2. **Step 2, w.** PUT / DELETE / PATCH start at w. Then, in order,
   the first hit decides:
   - a live verb (send, cancel, pay) → give up, x.
   - a 3p noun → give up, x.
   - a money noun (payment) → give up, x.
   - every noun yours → keep, w, marked "evidence".
   - none of the above → keep, w, marked "x-pile" (no evidence fired).
     This is the 1972-row pile, and it is the leaks marker: 155 of
     step 2's 187 leaks sit in it.
3. **Step 3, x.** Only what step 2 gave up. No rules.
4. **Output.** One CSV, all 5465 rows: the step that claimed the row,
   class, flag, truth, verdict.
5. **Ledger pins.** Step 1: 49 over-tight / 0 leaks. Step 2: 805 false
   alarms / 187 leaks, with 155 of the 187 in the x-pile (1972 rows).
   Whole flow: exact 78.8%, leaks 3.7%, over-tight 17.5%.

The four checks in step 2 run one after another, each on what the
one before left. Dropping the 3p check sends its 1034 rows to the
x-pile: 82 false alarms / 524 leaks. Dropping the x-pile flag
changes no count; it only hides the 155 leaks among 3183 w rows
instead of a 1972-row pile. Sending the x-pile to x instead (shape A)
doubles the x pile to 3572 rows, 2645 of them safe writes, for 37
leaks.

**Step 2 in order (measured 2026-09-13, the chosen shape B plus a flag;
the money-noun raiser added 2026-09-14, D66).**
A PUT / DELETE / PATCH row is checked in this order; the first hit
decides and the rest are not consulted:

- a. a live verb (send, cancel, pay, ...) → give up, x.
- b. a someone-else's noun (the mined 3p blocklist) → give up, x.
- b2. a money noun (payment) → give up, x.
- c. every noun on the yours list → keep, w, flagged "evidence".
- d. none of the above → keep, w, flagged "x-pile".

Both mined noun lists have a bar: a noun is "yours" when it was seen
on 2+ other-vendor rows over write rows (every method but
GET/HEAD/OPTIONS) and was safe 80%+ of the time — GET is truth r no
matter whose thing it touches, so it carries no yours signal and only
dilutes the w-share; it is "someone else's" when 2+ other vendors used
it over PUT/DELETE/PATCH rows and it was dangerous 30%+ of the time. A
noun that meets neither bar is on no mined list, and its row lands in
d unless it is on the hand-picked money-noun list (payment). Step 2
group table on the 4406 PUT/DELETE/PATCH rows:

| group | rows | truly w | truly x |
|---|---|---|---|
| a. live verb → x | 184 | 84 | 100 |
| b. other-party or money noun → x | 1039 | 721 | 318 |
| c. every noun yours → w | 1211 | 1176 | 32 |
| d. neither → w, x-pile | 1972 | 1795 | 155 |

Of group b's 1039 rows, 5 are money-noun rows (rule money-noun),
all truth x.

Why a row lands in d, measured on this 1972-row pile:

| reason | rows | truly x | what it means |
|---|---|---|---|
| between bars | 1046 | 104 | the noun had enough other-vendor rows but its w-share fell short of 0.8 |
| too few rows | 240 | 16 | fewer than 2 other-vendor write rows carried the noun |
| vendor-only | 670 | 35 | no other vendor ever wrote the noun on a write row |
| no noun | 16 | 0 | the row carries no noun at all |

Group d is 91% safe and holds 155 of step 2's 187 leaks; it is the
pile a human or a per-API hint sorts later (D44), not a list problem.

Sequential beats joint. Letting a yours noun override a live verb
(live + all-yours → w) gives 772 false alarms / 221 leaks against
803 / 211 sequential (pre-money-noun baseline): 31 freed for 10 leaks,
under the 10-for-1 curve. Letting "no 3p noun" override a live verb:
738 / 260. The yours-beats-3p candidate (762 / 212) is parked, to be
re-measured. A hand raiser is admitted only above that same 10-for-1
line and only after a logged measurement — "confirm" and "payment"
together closed 24 leaks for 2 false alarms, 12 per 1 (D66).

Step 2's ledger on this shape: 805 false alarms / 187 leaks. Whole
flow on all 5465 rows: exact 78.8%, leaks 3.7%, over-tight 17.5%.
The alternative (d → x, the yours-list-only shape A) is 37 leaks /
2645 false alarms, exact 49.7%; rejected by the user 2026-09-13.

On the 5465 rows PATCH is no longer the outlier it was on 42 rows (31%
x); it sits with PUT and DELETE at 14-15% x, so it keeps the w floor.

In code, src/flow.js runs step 1 -> step 2 -> step 3, one order
written once; there is no second lens.

**Movement rule.** Raising is `w -> x` on PUT/DELETE/PATCH. Lowering is
`x -> r` on POST, by a read verb. `r` comes from the GET floor or from
a POST read verb — nowhere else (D43).

One direction of travel per method (D43):

- GET / HEAD / OPTIONS — no word rules run. The floor stands. Last in
  the attack order, after step 3, step 2 and step 1.
- POST — lower only, `x -> r`.
- PUT / DELETE / PATCH — raise only, `w -> x`.

### The new core (all three steps frozen)

The user's model, 2026-09-16, corrected where the 2026-09-16 floor POC
contradicts it; the gist and the structure are the user's. Three
steps; each step takes the rows the step before left behind, and every
row comes out with a class and a flag.

1. **Step 1, r floor** = GET 99.9% (1958 of 1960) > POST 9.5% (124 of
   1309). **FROZEN 2026-09-16 (D74)** — no rule or word-list change
   until the user lifts the freeze. Built and measured, `src/step1.js`.
   How: the method
   floor (GET / HEAD / OPTIONS -> r; the corpus has no HEAD or OPTIONS
   rows, so those two are carried on principle, not on evidence), plus
   two read-verb rules on POST: the **lead token** of the operationId,
   after skipping the `LEAD_MODIFIERS` words `bulk` / `batch` /
   `deprecated` / `beta` / `async`, matched stem-aware against
   `READ_VERBS`, the 23-word read-verb list; and, on a POST the
   lead-token rule did not claim, a `SAFE_VERBS` word — the 10
   never-a-noun compute verbs, a subset of the 23 — matched at any
   token position. Every other POST passes down to step 2 unclaimed.
   Ledger over all 4171 rows: `method` 1960 claimed / 2 leaks;
   `read-verb` 87 claimed / 0 leaks; `read-verb-anywhere` 5 claimed /
   1 leak; total 2052 claimed / 3 leaks / 33 truth-r rows missed. Of
   the corpus's 2082 truth-r rows, 2049 are found (98.4%).
   Leave-one-vendor-out: 83 claimed / 1 leak. Two of the 3 leaks are
   on the GET floor (`datadog GetGraphSnapshot`, `intercom
   listContactBanners`, both labelled low confidence) and are out of
   reach of a method floor by construction. The lead-token rule is
   positional on purpose: the same 23-word list read at any token
   position scores 31 leaks instead of 0, because `list`, `get`,
   `count` and `check` are nouns in API names as often as verbs —
   which is why only the safe subset may be read that way.
   The third rule is the tool's first deliberate leak, adopted on the
   user's explicit decision 2026-09-16 at a priced cost of 4 right
   rows for 1 leak, with the gains in one vendor (digitalocean) and
   the leak in another (stripe), so LOVO expects the cost to
   generalize and the gain not to. See `docs/logs/learnings.md`.
2. **Step 2, w** — **FROZEN 2026-09-17 (D75)** — no rule or
   word-list change until the user lifts the freeze. `src/step2.js`,
   built and verified. Three rules. (a) `method-floor`: every PUT /
   DELETE / PATCH row starts at w, no words involved. (b)
   `modify-verb`: on the POST rows step 1 left behind, a **modify
   verb** from `MODIFY_VERBS` at the operationId's lead token lowers
   x to w. (c) `modify-verb-summary`: the same list read against the
   summary's lead verb instead, when the operationId's lead token is a
   bare HTTP method word, as in stripe's `PostTaxCalculations` and
   mailchimp's `postLists`. Both POST rules, (b) and (c), are BLOCKED
   if any word of the row is in `OTHER_PARTY`. Two lists, both owned
   by step 2:
   `MODIFY_VERBS` (24 verbs that act on a thing that already exists)
   and `OTHER_PARTY` (21 role nouns naming someone who is not the
   caller). Ledger over the 2119 rows step 1 left it: `method-floor`
   902 claimed / 836 right / 66 leaks (7.3%); `modify-verb` 114 /
   113 / 1; `modify-verb-summary` 118 / 114 / 4; total 1134 claimed /
   1063 right / 71 leaks (6.3% of claims). It claims 53.5% of what it
   inherits and passes on 985 rows (46.5%, truth r 33 / w 153 / x
   799). Step 2 has zero over-tight rows. The POST rules reach 227 of
   the 380 truth-w POST rows (59.7%), against zero before, at 232
   claimed / 5 leaks — 2.2% fitted, and **3.2% leave-one-vendor-out
   with both lists rebuilt per holdout**, which is the honest figure.
   66 of its 71 leaks are the wordless method floor, not the lists:
   they are PUT / DELETE / PATCH rows whose truth is x, they cluster
   in openai and zoom account/user administration, and raising them is
   step 3's job, not something better words here can do. See
   `docs/logs/learnings.md`.
3. **Step 3, x** = the fallback, not a floor. **FROZEN 2026-09-17
   (D78)** — built and measured, `src/step3.js`. How: `RAISE_WORDS`, 17
   role/access nouns read at any token position, raising a row that
   step 2 floored WITHOUT a word from w to x — 19 claimed, 19 right, 0
   false alarms, fitted; 6 of 66 leave-one-vendor-out and all 6 the
   single word `permission`. Then the named leftover pile for
   everything still unclaimed. The via-negativa yours noun this plan
   called for is deliberately NOT built, and step 3's README says so:
   mining it was measured at 9 rows of 380 at 0 leaks, too weak to
   adopt, because 15 providers yield only 36 nouns against the old
   corpus's 439 from 332 vendors. What made step 3 work was not its
   words but the wiring — step 2's wordless floor became a DEFAULT
   that passes through, where before it returned and step 3 never saw
   the rows it exists to fix. For PUT 7% / DELETE 8% / PATCH
   2% (Table 1, provider corpus) this is evidence-raised x. For POST,
   the 61% x lean is the measured truth on 15 complete APIs (Table 1)
   and holds under LOVO; the earlier reading that this lean inverts to
   23% on unseen vendors was a property of exam 5's draw
   (89 vendors, median 1 POST row each, drawn from APIs.guru
   fragments), not of POST itself — see `docs/logs/learnings.md`. An
   unclaimed POST lands at x because x is the tightest class and the
   floor holds; the measured gap is not that the floor is wrong, it is
   how many POSTs never get moved off it. Step 2 now moves 232 of them
   to w (227 right, 5 leaks), reaching 227 of the 380 truth-w POST
   rows; the other 153 are still on this x floor, over-tight.

### Which list runs in which step

| step | claims | lists it runs, in order | direction |
|---|---|---|---|
| 1 — r | GET/HEAD/OPTIONS, and POST reads | `LEAD_MODIFIERS` (5, plumbing) → `READ_VERBS` (23, lead token only) → `SAFE_VERBS` (10, a subset of the 23, any token position) | lowers to r |
| 2 — w | PUT/DELETE/PATCH, and POST edits | method floor (no list) → `MODIFY_VERBS` (24, lead token, or the summary's verb when the operationId lead is a bare method word) → `OTHER_PARTY` (21, blocks the lowering) | lowers to w |
| 3 — x | step 2's wordless floor rows, and everything left | `RAISE_WORDS` (17 nouns, any token position, and only on a row step 2 floored without a word) → the leftover pile (no list) | raises to x; nothing looser than x to be wrong toward |

Six lists, 100 words in total, and every list runs in exactly one
step — no list is shared between steps, which is D57 still holding.
One of the six is plumbing (`LEAD_MODIFIERS`), two are verb lists that
lower a row, one is a noun list that blocks a lowering, and one is a
noun list that raises a row. Where each lives: `LEAD_MODIFIERS` (5) in
`src/tokens.js`, `READ_VERBS` (23) and `SAFE_VERBS` (10) in
`src/step1.js`, `MODIFY_VERBS` (24) and `OTHER_PARTY` (21) in
`src/step2.js`, and `RAISE_WORDS` (17) in `src/step3.js`.

### What the tool would say today

Every answer the tool gives comes from exactly one of two sources, and
the CSV names which in a `source` column beside the rule:

- **floor** — the HTTP method alone. No word matched. A floor is a
  *default*, so a later step's evidence may override it; that is exactly
  how step 3's `raise-word` turns step 2's `method-floor` `w` into `x`.
- **list** — a word list fired. A list claim is *evidence* and it is
  final; nothing downstream overrides it.

The full ledger over all 4171 corpus rows, both frozen steps plus step
3, split by step and by source:

| step | source | claims | right | right % | leaks | over-tight |
|---|---|---|---|---|---|---|
| **1** (r) | list | 92 | 91 | 98.9% | 1 | 0 |
| | floor | 1960 | 1958 | 99.9% | 2 | 0 |
| | **total** | **2052** | **2049** | **99.9%** | **3** | **0** |
| **2** (w) | list | 232 | 227 | 97.8% | 5 | 0 |
| | floor | 883 | 836 | 94.7% | **47** | 0 |
| | **total** | **1115** | **1063** | **95.3%** | **52** | **0** |
| **3** (x) | list | 19 | 19 | **100.0%** | 0 | 0 |
| | floor | 985 | 799 | 81.1% | 0 | **186** |
| | **total** | **1004** | **818** | **81.5%** | **0** | **186** |
| **ALL** | list | 343 | 337 | 98.3% | 6 | 0 |
| | floor | 3828 | 3593 | 93.9% | 49 | 186 |
| | **TOTAL** | **4171** | **3930** | **94.2%** | **55** | **186** |

Read per emitted class instead:

| the tool says | rows | right | wrong in the loose direction |
|---|---|---|---|
| `r` | 2052 | 99.9% | 3 (0.1%) |
| `w` | 1115 | 95.3% | 52 (4.7%) |
| `x` | 1004 | 81.5% | **0** |

Whole flow: **exact 94.2%, leaks 1.3% (55 rows), over-tight 4.5% (186
rows)**. The goal is 90%+ on providers it has not seen; this corpus is
a tuning set (D24) and 94.2% is a fitted number, not a generalization
claim. What has changed is that a clean exam now exists —
`data/exam-2026-09-17/`, 1383 rows across okta, docusign and xero,
labelled blind on 2026-09-18 — and it has not been scored. The
classifier's predictions on those rows were pre-registered at commit
66c68f1 before any truth existed, so the exam can be scored once
without anyone having to promise the rules were not fitted to it.
Scoring it is a single deliberate act still to be taken (D24).

Four things this table says that no single accuracy number can:

1. **The tool is mostly an HTTP method table.** 3593 of its 3930 correct
   answers — 91.4% — come from floors. Word lists are a thin layer of
   evidence on top: excellent when they fire (98.3% right) but firing on
   only 343 rows, 8% of the corpus.
2. **Words are where the tool is confident, floors are where the risk
   is.** 49 of the 55 leaks fired no word at all, and 47 of those 49 sit
   in one cell: step 2's wordless PUT / DELETE / PATCH floor. That cell
   is the whole remaining dangerous error.
3. **All 186 over-tight rows sit in one other cell**, step 3's
   `floor-post` pile. Safety errors and usability errors live in two
   different boxes and never mix.
4. **"Floor" does not mean "guess" everywhere.** GET → `r` is 99.9%
   right and PUT / DELETE / PATCH → `w` is 94.7%; both are strong priors.
   Only step 3's leftover-POST floor, at 81.1%, is a genuine shrug, and
   it is the pile the output names rather than emitting a silent `x`.

This is a guess tool that is mostly accurate and never claims certainty.
It emits no confidence score — only the `source` column, which says
whether a word was read or only the method was known. A row called `x`
when it is really `w` costs the caller an extra ask and nothing else;
the only dangerous error is a row called looser than it is, which is why
the two directions are always counted and reported separately.

The open work, stated plainly:

- **47 leaks** on step 2's remaining 883-row wordless floor. Words have
  been measured out: every candidate list either failed the 10-per-1
  adoption bar or collapsed under leave-one-vendor-out (relationship
  nouns 22 closed / 11 false alarms; un-verbs 12 / 8; description-mined
  words 10 / 37 under LOVO). What closed the last 19 was the wiring, not
  the vocabulary.
- **153 truth-w POST rows** that never get off step 3's x floor — the
  remainder of step 2's prize, and where a via-negativa yours-noun rule
  would pay if one could be mined. It cannot be, on 15 providers: 36
  nouns against the old corpus's 439 from 332 vendors, best settings 9
  rows of 380.
- **33 truth-r POST rows** sitting in step 3's pile. These are step 1's
  known misses, not step 3's to fix: only step 1 assigns `r`, and
  anything → `r` is the loosening direction. Reaching them means
  unfreezing step 1 (D74).

Step 3's honest reach: its word list closes 19 of the 66 floor leaks
fitted, 6 leave-one-vendor-out, at 0 false alarms in both readings — and
all 6 LOVO closures are the single word `permission`, because the other
16 words each appear in only one provider.

### Where the code lives (src/)

| file | owns |
|---|---|
| `src/tokens.js` | the splitter, tokenizer, verb stemmer — readers only, no classification list |
| `src/step1.js` | step 1, the r step: `method`, `read-verb`, `read-verb-anywhere`; owns `READ_VERBS`, `SAFE_VERBS` |
| `src/step2.js` | step 2, the w step: `method-floor`, `modify-verb`, `modify-verb-summary`; owns `MODIFY_VERBS`, `OTHER_PARTY` |
| `src/step3.js` | step 3, the x step: `raise-word`, `floor-post`; owns `RAISE_WORDS` |
| `src/flow.js` | the ladder — step order and precedence, written once |
| `src/index.js` | the package entry point |
| `src/types.js` | the shared `Operation` and `Verdict` typedefs |
| `tools/corpus.js`, `tools/csv.js` | corpus loading and CSV read, test/dev only, never shipped |
| `tools/proof-*.js` | the proofs (see below) |

- One order, written once, in `src/flow.js`.
- Each step owns its own word lists; `src/tokens.js` holds readers
  only, never a list.
- Each rule returns its own `source` (floor/list) and `matched` (the
  member that fired) at the moment it matches. Nothing re-derives them
  afterwards, which is what let `sourceForRule` and
  `matchedWordsForRule` be deleted rather than ported (D79).
- `poc/` is retained deliberately, byte-untouched, as the FROZEN
  REFERENCE the src code is proved against — not as live code and not
  as a second implementation. `tools/proof-step1.js`,
  `tools/proof-step2.js` and `tools/proof-step3.js` are the
  equivalence proofs: they run both sides over all 4171 corpus rows and
  compare class, rule, source and matched, row by row.

The public surface is ONE export: `classifyRow`, from `src/index.js`,
which returns a `Verdict` (`class`, `step`, `rule`, `source`,
`matched`). The steps, the word lists, the tokeniser, `wordsForStep3`
and `floorPost` are internals, sealed by the package's `exports` map
rather than merely undocumented. The D76/D77 published map and its
`evidence` field are NOT built: that emitter is the next pass, and
nothing emits yet.

Run: `npm test` (153 tests); `npm run typecheck` (`tsc --noEmit` over
`src/`); and the five proofs, each printing "All pins hold." and
exiting 0 or printing its mismatches and exiting 1 —
`node tools/proof-tokens.js`, `node tools/proof-step1.js`,
`node tools/proof-step2.js`, `node tools/proof-step3.js` (the four
equivalence proofs against frozen `poc/`) and
`node tools/proof-flow.js` (every pinned flow number, recomputed from
`src/` alone).

Current shape, n=4171: **exact 3930 (94.2%), leaks 55 (1.3%),
over-tight 186 (4.5%).** Per step and per source — step 1 list
92/91/1 leak and floor 1960/1958/2; step 2 list 232/227/5 and floor
883/836/47; step 3 list 19/19/0 and floor 985/799/0 with all 186
over-tight rows. Known limits: there is NO CLEAN EXAM — all three steps
were measured on the same 4171 rows they were tuned on, which under D24
makes this corpus a tuning set, so an unseen vendor will score worse;
47 of the 55 leaks sit on step 2's wordless PUT/DELETE/PATCH floor and
all 186 over-tight rows on step 3's `floor-post` pile. Leaks can only
be created where a step stops at a loose class — step 1's `r` and step
2's `w` — which is why step 3's leak count is 0 by construction rather
than by luck. `poc/m1` is archived at `poc/archive/m1/` (D65).
Superseded shapes and their numbers are in `docs/logs/learnings.md`,
not here.

GET is last on the list; it runs no word rules by design. On the new
provider corpus GET truth is 100% r (Table 1) and the frozen core
scores 99.9% exact with 2 leaks (0.1%) on GET's 1960 rows.

Every row still gets a judgement — there is no "no answer" outcome —
and where the judge is unsure it moves in the safer direction (tighter
class).

## Where the work is

M1, the informed arbiter, has graduated: the classifier lives in
`src/` (D79) and the package exposes it as one export. What has not
shipped is the published map — no emitter is built and nothing emits
yet. The clean exam that was owed is now drawn and fully labelled but
unscored: `data/exam-2026-09-17/`, 1383 rows across three complete
official provider APIs, with the classifier's predictions
pre-registered before any truth existed. Scoring it is the next
deliberate act. The full
module ladder, the M1 go/no-go gate, the labelled sets and the current
arbiter shape with its scores live in
[module ladder and arbiter shape](../wiki/module-ladder-and-shape.md).
Decisions D1-D70 are in [the decisions log](../wiki/decisions-log.md).
M0 is closed; its gate statement and results are in
[go/no-go gate and M0 results](../logs/gate-and-m0-results.md). Notes
carried from the original outline are in
[design notes](../logs/design-notes.md).

## Problem & goal

The -02 draft
(`justabit:ietf/v3/docs/draft-hamr-oauth-agent-delegation-02.xml`, anchor
`classification`) defines two ways a request's `actionClass` gets
decided. Under `classSource` **method**, the class comes from the HTTP
method alone: GET, HEAD, and OPTIONS default to `r`; PUT and DELETE
default to `w`; POST and PATCH default to `x` (lines 810-816). Under
`classSource` **declared**, a Resource Owner publishes a JWS-signed menu
(anchor `declared-menu`) naming each operation's class explicitly, and
where that menu verifies and matches, "the declared value alone governs,
replacing the method default rather than being compared against it"
(lines 826-830). (docs/archive/prd.md:10-21)

The method default is a reliable floor in one direction and not the
other. The 2026-09-01 CAMARA catalogue survey in the other repo
(`justabit:ietf/v3/poc/spike-a/`, 292 operations across 60 repositories)
found zero operations judged `x` behind a safe method — the leak
direction is closed. But 57 of 138 POST operations are named as reads
(`retrieve-`, `check-`, `verify-`, `status-`prefixed — the exact
predicate catalogue this project targets: SimSwap `/check`,
NumberVerification `/verify`, `retrieve-location`, KYC match), and every
one classes as `x` under `classSource` method, because POST defaults to
`x` regardless of what the operation actually does.
(docs/archive/prd.md:22-31)

The declared menu already exists in the spec to fix this. The
bottleneck is that nobody wants to hand-classify hundreds of operations
across dozens of repositories to author the menu in the first place.
(docs/archive/prd.md:33-35)

**rwxmap is the author's own tool, first.** It reads an OpenAPI document
and draws a map of which operation is `r`, `w`, or `x`, so an agent, a
guard, a harness, or a classic workflow knows what a call does before it
is made, and so a mechanical arbiter outside the auth agent can see what
agents do. It is a discovery tool, not a proof. It also serves as a
supporting proof-of-concept for -02's actionClass axis and declared
menu, but it is **not load-bearing** for that draft or for any CAMARA
filing — it may ship imperfect. It is also useful on its own as a
stopgap "upfront" map when an API owner is slow to publish a declared
menu, or has none. (docs/archive/prd.md:37-48)

## Out of scope

- A model/LLM tier. There is no tier 2 and no tier 3 in this design.
- A default of `r`, or any guess path.
- Signing. Output stops at a candidate map; a signature is the Resource
  Owner's act.
- Anything normative in an Internet-Draft.
- A third standards track.
- A mandated conformance harness.
- A CLI, packaging, or UI before M3 passes.
- A claim of coverage outside the CAMARA test bed.

(docs/archive/prd.md:133-145)

For the module ladder that M3 refers to, see the
[module ladder page](../wiki/module-ladder-and-shape.md).

## The safety spine

Output classes are `r < w < x`, per the -02 axis-registry ordering
(anchor `action-class-values`: "actionClass is an ordered enumeration
with three values, r, w, and x, ranked r < w < x"). (docs/archive/prd.md:478-480)

When the tool does not know, or when its confidence is below the set
line, **the answer is the tighter class.** The tool never loosens
without evidence. Defaulting to `r` would be fail-open and a security
hole: `r` is the least restrictive class on the actionClass axis, so a
delegation restricted to reads would admit whatever operation the
classifier guessed wrong on — including a destructive one.
(docs/archive/prd.md:482-487)

This changes the outline's framing. The outline said "omit the
operation" — that was right for a signed menu a Resource Owner authors,
and is still what a verifier does per the -02 quotes above (on any menu
failure, or on no menu at all, "the verifier MUST fall back to the
method default," and "A verifier MUST NOT construct or synthesize a
menu entry ... on behalf of a resource owner that has not published
one," anchor `classification`, lines 826-827, 837-839). rwxmap's
consumers are agents and guards that need an answer for every
operation, not a verifier consuming a signed menu, so rwxmap answers
with the tightest class instead of omitting. Both are the same rule: no
loosening without evidence. (docs/archive/prd.md:489-499)

Two error directions, counted and reported separately, never collapsed
into one accuracy number:

- **Over-classification** — a rule proposes a class stricter than the
  operation's actual behavior warrants. Cost: usability. A Resource
  Owner who signs an over-classified menu makes their own catalogue
  harder to delegate against than it needs to be.
- **Under-classification** — a rule proposes a class looser than the
  operation's actual behavior warrants. Cost: security. This is the
  failure the safety spine exists to keep out of the trust path.

(docs/archive/prd.md:501-510)

A single accuracy figure hides the one that matters. Report both
counts, every time, as justabit's `docs/logs/findings.md` already does
for leak-direction and usability findings. This repo's own log starts
at M4. (docs/archive/prd.md:512-514)

For the module that produces these counts and the go/no-go gate built
on them, see the [module ladder page](../wiki/module-ladder-and-shape.md)
and the [go/no-go gate page](../logs/gate-and-m0-results.md).

## Direction

Both directions are in scope. The tool proposes loosening (POST → `r`
or `w`) and tightening (DELETE or PUT → `x` when the verb says
destructive, e.g. `terminateCall`). For the -02 story this means "a
menu replaces the method default in both directions," not only "fixes
POST over-classification." Whether tightening becomes part of the -02
argument or stays a demonstration is open — see Open questions below —
and depends on how many tighten cases M0 finds. (docs/archive/prd.md:518-527)

This is D4; see the [decisions log](../wiki/decisions-log.md) for the
full ruling record.

## The output shape (agreed 2026-09-17, D76)

rwxmap does not publish a format for anyone to adopt. It keeps one small
map of its own and fills the slot that each existing standard already
leaves open for other people's data. Four carriers, one map, no new
standards track — which is the same commitment CLAUDE.md makes about the
draft: this is not a third standards track.

The standards below were fetched and read on 2026-09-17, not recalled.
Field names, defaults and schema constraints MUST be re-checked against
the targeted revision before anything emits, because all four are moving.

### The map (the one file rwxmap owns)

One row per operation, keyed by method + path + operationId, carrying
three fields:

```json
{
  "rwxmapVersion": "0.1",
  "source": "stripe/spec3.json",
  "operations": [
    { "method": "GET",    "path": "/v1/customers/{customer}", "operationId": "GetCustomersCustomer",
      "class": "r", "destructive": false, "evidence": "floor" },
    { "method": "POST",   "path": "/v1/customers/{customer}", "operationId": "PostCustomersCustomer",
      "class": "w", "destructive": false, "evidence": "list" },
    { "method": "DELETE", "path": "/rest/api/2/filter/{id}/permission/{permissionId}", "operationId": "deleteSharePermission",
      "class": "x", "destructive": true,  "evidence": "list" },
    { "method": "POST",   "path": "/chat/completions", "operationId": "createChatCompletion",
      "class": "x", "destructive": false, "evidence": "floor" }
  ]
}
```

All four rows are real corpus rows from
`data/provider-corpus-2026-09-16/`, carrying what the tool actually
emits for them today.

`evidence` has exactly two values and they are the same floor/list axis
the internal sheet records:

- `list` — a word list fired. The tool read a word and claimed the row
  on evidence. 343 of the 4171 corpus rows, 98.3% right.
- `floor` — no word matched; only the HTTP method was known, and the
  class is that method's default. 3828 rows, 93.9% right, and the
  honesty flag the project already measured: every one of the 55 leaks
  that fired no word, and all 186 over-tight rows, are `floor` rows.

The fourth row above is a `floor` row from step 3's leftover pile and
it is wrong: `createChatCompletion` is truth `r`, called `x` because
nothing spoke for it. Showing it is the point — `evidence: "floor"` is
how a consumer sees that for itself.

What the map does NOT carry: the rule name (`method-floor`,
`modify-verb-summary`, `raise-word`, …) and the specific word that
matched. Those are rwxmap's internal vocabulary, they live in the
debugging sheet `run-proof/step3.csv` alongside truth and the `matched`
column, and they are deliberately unpublished — an adopter cannot act
on them, and publishing them would freeze this project's own naming
into someone else's contract.

There is no `confident` field. `evidence` already carries it: `floor`
IS the unconfident case, and two fields saying one thing can contradict
each other.

`destructive` is the separate axis of D28 and is never read off the
class. `class` is `r < w < x` per the one invariant.

### Carrier 1 — OpenAPI, per operation

OpenAPI allows `x-` extension keys on any object, including an
operation. rwxmap reads these files already; it writes back into the
same file it read:

```yaml
/v1/accounts/{account}:
  delete:
    operationId: DeleteAccountsAccount
    x-rwx:
      class: w
      destructive: true
      evidence: floor
```

### Carrier 2 — MCP, per tool

Two slots, both the spec's own. The four hints ride together in one
`annotations` object (see the MCP hints entry under Open questions for
what each hint is worth today); rwxmap's own three fields go in `_meta`,
which the MCP 2026-07-28 specification names as the extension slot and
where reverse-DNS key prefixes are the stated convention (prefixes whose
second label is `modelcontextprotocol` or `mcp` are reserved):

```json
{ "name": "delete_share_permission",
  "annotations": { "readOnlyHint": false, "destructiveHint": true, "idempotentHint": false },
  "_meta": { "io.github.hamr0.rwxmap/class": "x",
             "io.github.hamr0.rwxmap/evidence": "list" } }
```

### Carrier 3 — WebMCP, per tool

WebMCP (W3C Web Machine Learning Community Group, Draft Community Group
Report of 2026-04-23) has a page hand tools to the agent through
`navigator.modelContext`. Its `ToolAnnotations` dictionary is NOT MCP's
four; as read on 2026-09-17 it is `readOnlyHint`, `untrustedContentHint`,
`consequentialHint` and `debugging`, and the IDL admits defined members
only — no `_meta`, no extension slot. Nothing custom is needed, because
the two flags that matter carry all three classes with nothing left
over:

| class | `readOnlyHint` | `consequentialHint` |
|---|---|---|
| `r` | true | false |
| `w` | false | false |
| `x` | false | true |

`consequentialHint` is a closer fit to this project's `x` (reach beyond
the caller, or not repeatable) than any MCP hint is: MCP's
`destructiveHint` was measured and rejected as a reading of the class
(D28), and `idempotentHint` cannot be read off the specs at all. This
makes WebMCP the carrier where the r/w/x ladder maps cleanly, and it
raises the value of step 3 — `consequentialHint` IS the x step.

```js
navigator.modelContext.registerTool({
  name: "delete_account",
  annotations: { readOnlyHint: false, consequentialHint: true },
  execute: /* ... */
});
```

### Carrier 4 — Agentic Resource Discovery, per domain

ARD (Google and ten others, published 2026-06-17) has a domain serve
`/.well-known/ai-catalog.json` with `specVersion`, `host` and `entries`,
one entry per whole resource — an MCP server, an A2A agent, an OpenAPI
document.

Per-operation data cannot go inside an entry, and this is a schema fact,
not a preference: the published entry schema sets
`additionalProperties: false`, there is no `x-` support and no
extensions object, and the one free slot, `metadata`, takes flat
key-value pairs whose values are limited to string, number, boolean or
null. A map of 1309 operations does not fit in a flat scalar.

So the map is its own resource with its own URL, listed beside the
OpenAPI document it describes:

```json
{ "identifier": "urn:stripe:rwxmap",
  "displayName": "Stripe API — rwx map",
  "type": "application/vnd.rwxmap+json",
  "url": "https://stripe.com/.well-known/rwxmap.json",
  "metadata": { "rwxmapVersion": "0.1", "operations": 1309 } }
```

### What this means for the work

- rwxmap is a **build-time annotator**, not a runtime component. It runs
  once over a spec and produces the map; the map feeds whichever carrier
  the Resource Owner publishes. This keeps signing the Resource Owner's
  act, per Out of scope.
- Only two of the four slots are rwxmap's own: OpenAPI's `x-rwx` and
  MCP's `_meta` keys. In the other two it sets fields the spec already
  defines.
- What is shippable today is unchanged by this decision: `readOnlyHint`
  (and therefore WebMCP's `readOnlyHint`) is ready at 3 unsafe-wrong
  rows in 4171 (0.07%); `consequentialHint` follows directly from the
  class, since WebMCP's two flags carry r/w/x with nothing left over
  (carrier 3 above). Neither waits on step 3 any longer — it is built
  (D78) and the classifier has graduated to `src/` (D79).
  `idempotentHint` is blocked on something else entirely: its two
  readings are still unchosen (see the hints section below for the
  numbers on both), and step 3 does not decide between them.
- The four carriers are an output contract, not code. Step 3 is now
  built (D78) and the classifier has graduated to `src/` (D79), but
  nothing emits yet: the emitter is the next pass, and the
  input-adapter question under Open questions stays open.

## Open questions

Non-blocking; never silently assumed.

- Is the POST floor (x) wrong? No — on the 4171-row provider corpus of
  15 complete official APIs the POST floor holds: truth x is 61%
  (804 of 1309), close to the old corpus's 62%, not to exam 5's 23%;
  the inversion recorded 2026-09-14/15 is now read as a property of
  exam 5's draw (89 vendors, median 1 POST row each, drawn from
  APIs.guru fragments) rather than of POST itself. How a POST row
  reaches w is no longer open either: step 2 (`src/step2.js`) answers it
  with a modify verb plus the `OTHER_PARTY` block, reaching 227 of the
  380 truth-w POST rows, against zero before. What stays open is the
  remaining 153 POST rows that never get off the `x` floor, and step
  3: the 66 PUT / DELETE / PATCH rows sitting on step 2's method floor
  at `w` that are truth `x`, which are 93% of step 2's leaks and the
  only dangerous part of the tool's error. See list item 2 of "The new
  core" above and `docs/logs/learnings.md`. Raised 2026-09-14, updated
  2026-09-15, updated 2026-09-16 with the provider-corpus read,
  updated 2026-09-16 when step 2 was built.
- Can the "I don't know" pile be shrunk by reading the description?
  Answer so far: no — mining the yours list from description text
  resolves at best 130 of 1972 rows (6.6%) and leaks 8; the safe
  settings clear 2-5%. Rejected 2026-09-16, POC kept at
  `poc/desc-yours/`. The pile stays as the flag because it holds 155
  of 204 leaks.
- MCP hints (future feature, M3; the user's end goal is to feed them).
  Nothing emits hints yet. The shape of the hint output IS now decided
  — see "The output shape (agreed 2026-09-17, D76)" above, which names
  MCP's `annotations` plus `_meta` as one of four carriers. What
  follows is only what is now known about each hint from the 4171-row
  provider corpus with step 1 and step 2 as they stand.
  - **The four hints ride together.** An MCP tool carries one
    `annotations` object holding all four booleans at once — they are
    independent axes, not a choice between them. Omitting a field is
    not silence: the consumer assumes `readOnlyHint` false,
    `destructiveHint` true, `idempotentHint` false, `openWorldHint`
    true. Those defaults are all the tight reading, so partial
    emission is safe by this project's own invariant.
    `destructiveHint` is only meaningful when `readOnlyHint` is false,
    so the `r` class settles two of the four at once. These annotation
    names and defaults are from the MCP spec **as recalled, not from a
    fetched copy**, and must be checked against the exact spec
    revision targeted before anything emits.
  - `readOnlyHint`: **the one that is ready.** True when the class is
    `r`; GET follows its `r` floor (D59). 2052 rows, 3 wrong in the
    unsafe direction (0.07% of all 4171 rows, 0.15% of the trues) —
    the three being the known low-confidence GET rows `datadog
    GetGraphSnapshot` and `intercom listContactBanners` plus one more.
    33 further rows are marked not-read-only when they are read-only,
    which is the safe direction. Step 3 cannot improve this hint at
    all, because step 3 only raises `w` to `x` and `readOnlyHint` is
    already false for both — so waiting for step 3 buys
    `readOnlyHint` nothing.
  - `idempotentHint`: **not ready, and step 3 is not what would fix
    it.** Step 3 is built (D78), and the block is the choice below, not
    the ladder. Two readings, still not chosen. Reading A, from the
    class: true for `r` or `w`, since by D20 an operation you can't
    safely repeat is
    `x` — says true on 3186 rows, 72 unsafe-wrong (1.73% of all rows,
    2.26% of the trues); the 2026-09-17 `OTHER_PARTY` trim grew the
    `w` pile by 16 rows without adding one unsafe-wrong row, since all
    16 are truth `w`. Reading B, from the method, per RFC 9110
    §9.2.2: true for GET / HEAD / OPTIONS plus PUT and DELETE
    (`docs/archive/prd.md:363`, §4.3) — says true on 2778 rows, 65
    unsafe-wrong (1.56% of all rows, 2.34% of the trues), those 65
    being GET 1, PUT 25, DELETE 39. The two readings disagree on
    idempotent-but-`x` rows (D20 counted 20 such DELETE rows on its
    499-row set). Reading A's gap is exactly the 71 rows step 2 now
    calls `w` that are truth `x` — the rows step 3 exists to raise —
    so step 3 closes it.
  - **Idempotency cannot be read off the specs.** Measured across all
    15 provider specs: 11 of the 15 never mention idempotency at all.
    The four that do are paypal (103 mentions), square (16), openai
    (6) and intercom (1), and even there it is prose in descriptions
    plus an `Idempotency-Key` / `PayPal-Request-Id` request header,
    not a machine-readable property. That header is a *capability* —
    the API offering to make retries safe if the caller supplies a key
    — not a declaration that the operation is idempotent. If anything
    it is evidence the operation is NOT naturally idempotent, which
    points toward `x`, so it is a candidate raiser for step 3 rather
    than an idempotency source. It cannot be measured honestly on 4
    vendors.
  - `destructiveHint`: **the class cannot carry it, measured again.** A
    separate axis from r/w/x (D28), not built; MCP default `true`
    until then. D28 already rejected `destructiveHint = (class == x)`
    as wrong on 352 of 719 rows. The broader reading "every non-`r`
    row is destructive" was measured on this corpus: it would mark all
    2119 non-`r` rows destructive, but only 584 of them (27.6%) carry
    any wrecking signal at all — a DELETE method, or a verb such as
    delete / remove / purge / revoke / expire / void / archive — while
    1535 rows (72.4%) destroy nothing, being creates, updates, sends
    and publishes. That reading is safe, because it is identical to
    the MCP default, and it therefore emits no information. The useful
    signal is the inverse: which of the non-reads are NOT destructive.
    That is the second axis D28 named, derived from method plus verb
    and never from the class; `poc/m0/destructive.json` exists from
    the M0 work and has never been measured against this corpus.
  - `openWorldHint`: no signal; MCP default `true`.
- Closed 2026-09-17 (D76): the output file format. rwxmap keeps one map
  of its own, one row per operation, and publishes nothing of its own —
  it fills the extension slot each existing standard already leaves
  open: OpenAPI's `x-rwx` per operation, MCP's `annotations` plus a
  reverse-DNS `_meta` key per tool, WebMCP's `readOnlyHint` /
  `consequentialHint` per tool, and one Agentic Resource Discovery
  `ai-catalog.json` entry per domain pointing at the map file. See
  "The output shape" above. This supersedes the archived bullet below
  that offered the -02 declared menu's `{iss, menu}` shape or rwxmap's
  own JSON with a converter.
- Whether tightening enters the -02 argument, or stays a demonstration
  (D4, M4).
- The exact confidence formula and line — M0 finds it.
- The output file format: the -02 declared menu's `{iss, menu}` shape
  (anchor `declared-menu`), or rwxmap's own JSON with a converter.
- The GitHub remote is `hamr0/rwxmap`; visibility (public with a WIP
  marker, like the author's other repos, or private) is decided at the
  first push.
- Whether the -02 draft's definition of `x` is amended to name
  consequence in the test and not only in the label. This is rwxmap's
  first finding with a consequence for the draft text, and it belongs
  to the justabit track to accept or reject.
- Input adapters beyond OpenAPI. The arbiter is a function of a method,
  a name, and a text; GraphQL (`query` vs `mutation`), gRPC/AIP custom
  methods, AsyncAPI, and MCP tool lists can each feed those three
  through a small adapter, with the method empty where the format has
  none. Deferred until the output contract exists; the MCP tool-list
  adapter is the strongest candidate to go first.
- The three questions opened on 2026-09-07 — the `x` definition, the
  DELETE/PUT default, and the gate's treatment of low-confidence rows —
  were decided the same day; see D20, D21 and D22 in the decisions log.
- Preflight against a mock: run an agent against a mock server built
  from the OpenAPI file (e.g. Prism), record which operations it
  reaches for, look each up in the map, and show the x calls before any
  token is issued. HTTP has no dry run; vendor test modes exist for
  some APIs only. Raised by the user 2026-09-07; a later module, not
  M1.
- Closed 2026-09-07 (D31): queryAssistant is truth `r`; ask-an-assistant
  reads back an answer and reaches no one. It is not a negative
  control.
- Does the ordered r < w < x scale still hold once `destructive` is a
  separate axis? A grant of `x` currently implies `w`; with two axes a
  consumer may want "`x`, non-destructive only." The draft's scope
  grammar needs a word for that. Raised 2026-09-07.
- Closed 2026-09-07 (D32): a read whose result arrives by callback is
  `r`; the caller named the sink, so it reaches no one else. Callbacks
  raise only when the lead verb is not a read (M1-C7).
- Which structural fields qualify for a rule, per set, by the user's
  criterion "present consistently or almost always"? Answered by the
  M1 census, pending 2026-09-07.
- Truth re-read owed (raised by M1-C9/C10): the judge names the E24
  arguable rows and three GitHub rows (repos/delete,
  issues/set-issue-field-values, issues/remove-sub-issue) as the only
  leaks that block the summary-verb source. The user re-reads; nothing
  is re-labelled by the tool.
- Over-tight rows are a usability cost invisible to humans at run time;
  how a consumer surfaces or overrides them is open.
- Closed 2026-09-08 (D35): the no-text tighten rule (Rule A) is
  adopted — a PUT/DELETE/PATCH with no summary and no description ->
  x, marked no-text. Hold-out 3 became a tuning set to decide it;
  hold-out 4 is the new clean exam.
- Owner-declared notify flags (e.g. x-github.triggersNotification:
  true) as a raise-only step: zero leaks, tiny coverage; admit as an
  exact vendor-key list?

(docs/archive/prd.md:528-586)

For the decisions named above (D4, D20-D22, D31, D32, D35) and any
decision numbers not yet resolved here, see the
[decisions log page](../wiki/decisions-log.md).
For the module numbers (M0-M4) referenced throughout, see the
[module ladder page](../wiki/module-ladder-and-shape.md). For the
arbiter's shape and rules (e.g. Rule A, the summary-verb source), see
the [arbiter shape page](../wiki/module-ladder-and-shape.md).
