---
type: reference
title: rwxmap — PRD
status: stable
---

# rwxmap — PRD

## The floor (start here)

Every operation starts at its method's floor. The floor is each method's
own measured truth lean over the 5465-row labelled corpus (refreshed
2026-09-13; the original 1478-row table is in docs/logs/learnings.md).
It is a starting value, never an early return (D42).

| method | n | truth r | truth w | truth x | floor | unseen (exam 5) | holds? |
|---|---|---|---|---|---|---|---|
| GET / HEAD / OPTIONS | 550 | 97% | 1% | 2% | **r** | r 97% / w 3% / x 1% (200 rows) | yes |
| POST | 509 | 17% | 20% | 62% | **x** | r 63% / w 13% / x 23% (300 rows) | **no — inverts** |
| PUT | 1696 | 1% | 85% | 15% | **w** | r 0% / w 87% / x 12% (603 rows) | yes |
| DELETE | 2079 | 0% | 87% | 13% | **w** | r 0% / w 89% / x 11% (638 rows) | yes |
| PATCH | 631 | 1% | 85% | 14% | **w** | r 0% / w 92% / x 8% (259 rows) | yes |

Measured 2026-09-16 against exam 5, whose GET and POST strata are drawn
from vendors the corpus has never seen; its write stratum is
row-disjoint but not vendor-disjoint, so PUT / DELETE / PATCH are
tested on unseen rows from known vendors, not unseen vendors. Four
floors hold with the dominant class unchanged and the share stable or
better. POST does not drift, it inverts: x 62% to 23%, r 17% to 63%.
The flip is not a big-vendor artifact — corpus POST is only 14 vendors
and 14 of the 14 are x-dominant, while exam 5 POST is 89 vendors split
57 r-dominant / 27 x-dominant / 5 w-dominant, and vendor-weighting
leaves the gap about two-fold.

Every possible POST floor was priced on both sets. Floor r leaks 83%
on the corpus and 37% on exam 5. Floor w leaks 62% on the corpus and
23% on exam 5, and is over-tight 17% then 63%. Floor x never leaks,
and is over-tight 38% then 77%. So x stays the only permissible POST
floor, by the invariant and not by the corpus lean: it is the tightest
class, and both alternatives are fail-open. Had the corpus leaned r,
floor r would still be forbidden. The price of floor x is up to 77%
over-tight on unseen vendors, which is safe but close to useless, so
POST cannot be a floor-driven method in the new shape.

**How the flow works (the user's reading, 2026-09-13).** One sequence,
three steps. Each step takes the rows the step before left behind.

1. **Step 1, r.** Start every GET / HEAD / OPTIONS row at r. Then look
   at POST: a POST whose lead verb is a read verb is r too.
2. **Step 2, w.** Start every PUT / DELETE / PATCH row at w. Then look
   at the POST rows step 1 left behind: a POST with a modify verb plus
   a yours noun is w. (Measured 2026-09-13: 10 right, 4 wrong on 14
   rows; the verb alone is a coin flip, 77 to 69. Not adopted today —
   POST leftover stays x. See learnings, "One-flow ladder".)
3. **Step 3, x.** Not a step of its own — x is the byproduct: every
   POST / PUT / DELETE / PATCH row that step 1 and step 2 did not
   claim. Step 2 gives a w row up (a live verb or a not-yours noun
   fires) and it lands here.

**Superseded 2026-09-16 — the core is reopened.** What follows describes
the frozen shape that `poc/flow` still implements today. It stays until
the POST POC below answers; the target shape is in "The new core"
further down.

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

In code, poc/flow/flow.mjs runs step 1 -> step 2 -> floor x, one order
written once; there is no second lens.

**Movement rule.** Raising is `w -> x` on PUT/DELETE/PATCH. Lowering is
`x -> r` on POST, by a read verb. `r` comes from the GET floor or from
a POST read verb — nowhere else (D43).

One direction of travel per method (D43):

- GET / HEAD / OPTIONS — no word rules run. The floor stands. Last in
  the attack order, after step 3, step 2 and step 1.
- POST — lower only, `x -> r`.
- PUT / DELETE / PATCH — raise only, `w -> x`.

### The new core (target shape, not built)

The user's model, 2026-09-16, corrected where the 2026-09-16 floor POC
contradicts it; the gist and the structure are the user's. Three
steps; each step takes the rows the step before left behind, and every
row comes out with a class and a flag.

1. **Step 1, r floor** = GET / HEAD / OPTIONS 97% > POST 17%. How: read
   verbs. A POST whose lead verb is a read verb is r; every other POST
   passes down to step 2 unclaimed. Corrected here: the model said a
   non-r POST goes to w. POST floored to w leaks 62% on the corpus and
   23% on exam 5, which is fail-open and breaks the one invariant, so
   failing the read test does not earn a POST a class.
2. **Step 2, w floor** = PUT 85% / DELETE 87% / PATCH 85% > POST 20%.
   How: live verbs plus yours noun. PUT / DELETE / PATCH start at w,
   and evidence raises them to x. A POST can reach w here too, but
   only on evidence — a modify verb plus a yours noun — never by
   default. The 20% is real and today no path reaches it at all.
3. **Step 3, x** = the fallback, not a floor. How: live verbs plus the
   via-negativa yours noun; anything still unknown goes to the pile.
   Corrected here: for PUT 15% / DELETE 13% / PATCH 14% this is
   evidence-raised x, but POST's 62% is not a floor the tool may lean
   on. An unclaimed POST lands at x because x is the tightest class,
   not because POST leans x — that lean holds only on the corpus's 14
   vendors and inverts to 23% on 89 unseen ones. Those rows are marked
   unsure.

The pile widens. Today only step 2 carries a sure/unsure flag, and
2282 of 5465 rows (42%) carry none, including the 614 step 1 rows that
hold all 17 GET leaks. In the new core every step flags every row.

The riskiest piece, and the one the next POC targets: step 1's POST
read-verb list catches only 42 of the 189 truth-r POSTs on unseen
vendors, 22%. It was mined on a corpus where read-POSTs barely
existed. If that cannot be raised, POST stays mostly unsure and rwxmap
is a four-method tool that shrugs at POST.

## The three steps

Counts are the current shape's errors over the 5465-row combined
corpus (332 vendors), leave-one-vendor-out. Truth split: 936 x, 3883
w, 646 r.

| rows | ok | leaks | too tight | decided by |
|---:|---:|---:|---:|---|
| 1972 | 1795 | 155 | 22 | step 2 · `w` · floor |
| 1211 | 1176 | 32 | 3 | step 2 · `w` · yours-noun |
| 550 | 533 | 17 | 0 | step 1 · `r` · method floor |
| 64 | 64 | 0 | 0 | step 1 · `r` · read-verb |
| 1034 | 313 | 0 | 721 | step 3 · `x` · other-noun |
| 184 | 100 | 0 | 84 | step 3 · `x` · live-verb |
| 445 | 318 | 0 | 127 | step 3 · `x` · floor |
| 5 | 5 | 0 | 0 | step 3 · `x` · money-noun |

Every row of the corpus is decided by exactly one of these eight, so the
columns sum to the ledger: 5465 rows, 4304 ok, 204 leaks, 957 too tight.
Regenerate from `run-proof/flow.csv`.

Leaks stop at step 3 by construction, not by luck. A leak is a class
looser than truth, step 3 only ever assigns `x`, and there is nothing
looser than `x` to be wrong toward. So leaks can only be created where a
step stops at a loose class: step 1's `r` and step 2's `w`. Of the 204,
172 come from a floor — no evidence fired and the step defaulted — and 32
come from `yours-noun` firing and being wrong. The 17 on step 1's method
floor are the parked GET leaks (D59).

### Where the code lives (poc/flow)

| file | owns |
|---|---|
| `corpus.mjs` | corpus loading |
| `csv.mjs` | CSV read/write |
| `words.mjs` | the splitter, tokenizer, verb stemmer, noun reader — readers only, no lists |
| `floor.mjs` | the per-method floor |
| `step1.mjs` | the read-verb rule (r) |
| `step2.mjs` | the live-verb, other-noun and yours-noun rules (w/x) |
| `flow.mjs` | the one classifier entry point, step order |
| `ledger.mjs` | every pin, in one place |
| `proof.mjs` | the one CSV + the one markdown report |

- One order, written once, in `flow.mjs`.
- Each step owns its own word lists; `words.mjs` holds readers only,
  never a list.
- Every pin lives in `ledger.mjs` PINS and moves only with a logged
  re-measure and the user's word.
- The proof is one CSV, `run-proof/flow.csv`.

Run: `node poc/flow/proof.mjs` (one CSV + one markdown report, exits 1
if a pin moves); `node --test poc/flow/*.test.mjs` (the pins).

Known limits: this is a tuning-corpus number under LOVO; exams 1-3 were
used to tune and exam 4 was found to be drawn from
already-burned providers; exam 5 (D68) is the first exam scored once on
unseen rows — row-disjoint for writes, vendor-disjoint for POST and
GET — and came out 70.2% exact / 3.2% leaks / 26.7% over-tight overall,
writes 73.3 / 3.7 / 23.0, POST 36.8 / 0.3 / 62.9 (POST relabelled under
the brief fixed 2026-09-15)
(`docs/logs/learnings.md`, "Exam 5 scored once"); this is a POC, never shipped as one; the
x-pile flag is reported in the CSV, not yet wired to any consumer;
poc/m1 is archived at poc/archive/m1/ (D65). The core is FROZEN as of
2026-09-16 at these numbers: 78.8% exact / 3.7% leaks / 17.5% over-tight
on the corpus under LOVO; exam 5 70.2 / 3.2 / 26.7. The x-pile holds
1972 rows (36.1% of the corpus); inside it, 91.0% are truth w, 7.9% are
flagged leaks, and 1.1% are over-tight; 49 leaks (0.9% of rows) are
unflagged. No word list or rule changes while the core is frozen.

GET is last on the list. 97% of GET rows are truly r, GET runs no word
rules by design, and the 17 Slack GET leaks are not chased per-vendor.

Every row still gets a judgement — there is no "no answer" outcome —
and where the judge is unsure it moves in the safer direction (tighter
class).

## Where the work is

M1, the informed arbiter, is a POC and has not graduated. The full
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

## Open questions

Non-blocking; never silently assumed.

- Is the POST floor (x) wrong? After fixing the brief (POST create x)
  and relabelling, exam 5's unseen-vendor POSTs are still only 23%
  truth x against the corpus's 62%, and 63% are reads; POST scores
  36.8 / 0.3 / 62.9; 148 of 188 over-tight rows are reads step 1's
  POST read-verb list misses, 40 are own writes the x floor
  over-tightens; leaks 1. So the gap is mostly step 1's read list, not
  the x floor; whether the floor should move stays open, and
  read-verb candidates are measured on the corpus, never on exam 5
  rows (D40). The two raising rules
  also lose precision on exam 5 (other-party noun 24% right, live verb
  32%); those rows are PUT/DELETE/PATCH and stand. Nothing is adopted
  from exam 5; candidates are measured on the corpus first (D40).
  Raised 2026-09-14, updated 2026-09-15.
- Can the "I don't know" pile be shrunk by reading the description?
  Answer so far: no — mining the yours list from description text
  resolves at best 130 of 1972 rows (6.6%) and leaks 8; the safe
  settings clear 2-5%. Rejected 2026-09-16, POC kept at
  `poc/desc-yours/`. The pile stays as the flag because it holds 155
  of 204 leaks.
- MCP hints (future feature, M3; the user's end goal is to feed them).
  Nothing emits hints yet.
  - `readOnlyHint`: true when class is `r`; GET follows its `r` floor
    (D59).
  - `idempotentHint`: two readings, not yet chosen. From the class: true
    for `r` or `w`, since by D20 an operation you can't safely repeat is
    `x`. From the method, per RFC 9110 §9.2.2: true for safe methods
    plus PUT and DELETE (`docs/archive/prd.md:363`, §4.3). The method
    reading disagrees with D20 on idempotent-but-`x` rows (D20 counted
    20 such DELETE rows on its 499-row set).
  - `destructiveHint`: a separate axis from r/w/x (D28), not built; MCP
    default `true` until then.
  - `openWorldHint`: no signal; MCP default `true`.
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
