---
type: reference
title: rwxmap — PRD
status: stable
---

# rwxmap — PRD

## The floor (start here)

Every operation starts at its method's floor. The floor is each method's
own measured truth lean over the 1478-row labelled corpus. It is a
starting value, never an early return (D42).

| method | n | truth r | truth w | truth x | floor |
|---|---|---|---|---|---|
| GET / HEAD / OPTIONS | 550 | 97% | 1% | 2% | **r** |
| POST | 509 | 17% | 20% | 62% | **x** |
| PUT | 127 | 2% | 83% | 15% | **w** |
| DELETE | 250 | 0% | 81% | 19% | **w** |
| PATCH | 42 | 0% | 69% | 31% | **w** |

**Movement rule.** Raising is `w -> x` on PUT/DELETE/PATCH. Lowering is
`x -> r` on POST, by a read verb. `r` comes from the GET floor or from
a POST read verb — nowhere else (D43).

One direction of travel per method (D43):

- GET / HEAD / OPTIONS — no word rules run. The floor stands. Last in
  the attack order, after goals 2, 1 and 3.
- POST — lower only, `x -> r`.
- PUT / DELETE / PATCH — raise only, `w -> x`.

## The three goals

Work one goal at a time and bring them together afterwards. Attacking
several at once is what caused the repeated failures: they have
different shapes and need different evidence. Counts are the current
shape's errors over the 5465-row combined corpus (332 vendors),
leave-one-vendor-out. Truth split: 936 x, 3883 w, 646 r.

| # | error | count | where it lives | why it matters |
|---|---|---|---|---|
| 2 | **x dressed as w** | 37 (4.0% of truth-x) — FROZEN 2026-09-12 | DELETE 18, PUT 14, PATCH 5; all floor rows | a dangerous operation is treated as a safe write — this is the leak |
| 1 | **w dressed as x** | 2703 (69.6% of truth-w) — REOPENED | PUT/DELETE/PATCH floor rows raised by the yours-noun layer | a safe write is treated as dangerous, so it gets blocked when it should not be |
| 3 | **r dressed as x or w** | 49 | POST 24 (r->x), PUT 14, DELETE 5, PATCH 6 | a pure read is treated as a write. Deferred: smallest and least harmful |

Attack order is 2, then 1, then 3. One goal at a time: while a goal is
open, everything outside it — the other goals, other methods, other
vendors — is out of focus and is not chased. That isolation is what
stops the noise that caused the earlier repeated failures. (D47)

Goal 1 (w dressed as x) is open now. Goal 2 is frozen at 37, below.

### The shape (core in poc/m1/core, goal 2 layer in poc/m1/goal2)

Two word lists, not three. The hand-written third-party noun list is
gone.

| list | size | job |
|---|---|---|
| verbs — `LIVE_VERBS` (26) and `READ_VERBS` (14), hand-written | 40 | move a row off its floor |
| yours-nouns — mined allowlist, n>=2 rows, w-share>=0.80 | 439 | hold a floor row at `w` |

Flow for one row:

1. **Floor by method.** GET/HEAD/OPTIONS `r`; POST `x`; PUT/DELETE/PATCH `w`.
2. **Verbs.** GET: nothing runs. POST: a read verb lowers to `r`.
   PUT/DELETE/PATCH: a live verb (in the operationId, else the summary's
   lead verb) raises to `x`, unless the summary carries a caller phrase.
   No hit: stay at the floor, marked `floor`.
3. **Yours-nouns.** Only on PUT/DELETE/PATCH rows still at the `w`
   floor. Take every noun token in the operation name (both head nouns
   plus every other token, singularised, verbs stripped). All on the
   yours list → stay `w`. Any not → `x`, rule `no-own-noun`.

Nothing is hand-listed as "someone else's". Via negativa: a noun is
third-party unless the corpus says it is yours. Spec read from live
code: `docs/product/goal2-solution.md`.

The operationId is split on `_ - .`, camelCase, `/` and whitespace
before any rule reads it; the splitter lives in core (D58).

### How the goals stay separate

Goals 1 and 2 judge the same rows — PUT/DELETE/PATCH at the `w`
floor — from opposite sides: raise too much and goal 1 grows, hold too
much and goal 2 grows. No rule can move one and be unable to touch the
other. So separation is enforced in code, tests and ledgers, not
assumed.

| folder | owns | may move a row |
|---|---|---|
| `poc/m1/core/` | floor table, the operationId splitter, verb rules, noun extraction, corpus + allowlist setup | — (shared; changes need every pin green) |
| `poc/m1/goal2/` | the yours-noun layer | raise only (`w` → `x`) |
| `poc/m1/goal1/` | lower-back layer (empty today) | lower only (`x` → `w`), every lowered row flagged |
| `poc/m1/goal3/` | read layer (empty today) | lower to `r` only |
| `poc/m1/run/` | the one fixed order, the ledgers, the proof | — |

Rules:

1. **One order, written once** (`run/pipeline.mjs`): floor → verbs →
   goal 2 → goal 1 → goal 3. Nobody reorders.
2. **One direction per layer.** The pipeline throws if a layer moves a
   row the wrong way.
3. **A goal may not turn another goal's knob.** Goal 1 may not change
   the floor table, the verb lists or the allowlist bar; those belong to
   core and goal 2. It can only add its own evidence.
4. **Each goal's number is pinned by its own test**
   (`run/ledger.test.mjs`): goal 2 = 37, goal 1 = 2703, goal 3 = 49. A
   change that moves another goal's pin turns that test red; the pin
   moves only by a ruling recorded here.
5. **Each goal has its own ledger.** Goal 2 is measured through its own
   layer; goal 1 through its own; a goal's leak cost (rows its layer
   loosened into a leak) is charged to that goal. A stacked number
   appears only on a line labelled combined.
6. **Each goal owns its own word lists** (D57): a goal never imports
   another goal's list, though it may copy entries that genuinely
   apply. Core holds only what is truly shared — the floor and the
   splitter, no lists. Goal 2 owns `LIVE_VERBS` (26) and the
   yours-noun allowlist (439); goal 3 owns `READ_VERBS` (14); goal 1
   builds its own lists fresh. The lists still physically sit behind
   core's imports today; moving them out is a later step, not done
   yet.

Run: `node poc/m1/run/measure.mjs` (gate + scores),
`node --test poc/m1/run/ledger.test.mjs` (the five per-goal pins) and
`node poc/m1/run/proof.mjs` (row-level CSVs in `run-proof/`).

**Goal 2 is FROZEN at 37 (2026-09-12).** The shape above, measured
leave-one-vendor-out over the 5465-row combined corpus:

| shape | goal-2 leaks | goal-1 false alarms (charged to goal 1) | all-loosening |
|---|---|---|---|
| previous frozen (c15 + C20: hand list + two head nouns) | 89 (9.5% of truth-x) | 1936 | 106 |
| **current (poc/m1/goal2), at freeze** | **37 (4.0%)** | 2727 | 54 |

65 leaks rescued, 13 new; net −52. All 37 remaining leaks are floor
rows — no evidence fired, so the tool flags them as unresolved rather
than confidently wrong. 27 distinct vendors, none above 4.

The gate: the previous frozen shape reproduced its 89 exactly through
the new harness before the new number was trusted.

Known limits, stated plainly: this is a tuning-corpus number under
LOVO, the same footing as the 89 it replaces, so the comparison is
fair — but neither is a clean-exam number. Exams 1–4 are burned.
A fresh broad exam, with its labelling brief saved to the repo before
any row is labelled, is the only thing that turns 37 into a wild
number. "Flagged" is still not wired in code — `floor:true` exists
only on the row result, not as a reported state — and must be before
anything graduates. The shape is a POC; "never ship the POC" stands.
Row-level results for every goal: `run-proof/`, regenerated by `node poc/m1/run/proof.mjs`.

**Goal 1 is REOPENED (2026-09-12).** Its previous answer, M1-C22
(lower a row back to `w` when the party-noun rule raised it and every
head noun is on the tight yours list), is void: the party-noun rule no
longer exists, so there is nothing for C22 to undo. Under the current
shape goal 1 stood at 2727 false alarms at the freeze — up from 1936 —
because the yours-noun layer now reads every token and raises more
floor rows. That cost was charged to goal 1 when goal 2 was frozen.
The splitter fix (D58) then freed 24 of those, so goal 1 now stands at
2703. Goal 1 is next, as a lower-back layer in `poc/m1/goal1/` with its
own evidence and its own leak ledger.
Past result and numbers: `docs/logs/learnings.md` (M1-C21 to C23).

Ledgers stay separate. Goal 2 owns 37 leaks. Goal 1 owns 2703 false
alarms. At the freeze it was 2727, of which 791 were the charged cost
of goal 2's freeze (1936 before it). D58's splitter fix then freed 24.
POST's x floor gives 103 of those on its own. Goal 3 owns 49. A
blended number appears only on a line labelled combined, and there is
none yet for this shape.

Goal 3 (r dressed as x or w) is the same shape as goal 1, one step
further out, and waits behind it.

GET is last on the list. 97% of GET rows are truly r, GET runs no word
rules by design, and the 17 Slack GET leaks are not chased per-vendor.
GET is not touched until goals 2, 1 and 3 are closed.

Every row still gets a judgement — there is no "no answer" outcome —
and where the judge is unsure it moves in the safer direction (tighter
class).

## Where the work is

M1, the informed arbiter, is a POC and has not graduated. The full
module ladder, the M1 go/no-go gate, the labelled sets and the current
arbiter shape with its scores live in
[module ladder and arbiter shape](../wiki/module-ladder-and-shape.md).
Decisions D1-D59 are in [the decisions log](../wiki/decisions-log.md).
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
