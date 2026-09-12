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

**Movement rule.** A rule moves a class exactly one step, and only
between `w` and `x`. Raising is `w -> x`. Lowering is `x -> w`. Nothing
lowers to `r`: `r` comes from the GET floor and nowhere else.

One direction of travel per method (D43):

- GET / HEAD / OPTIONS — no word rules run. The floor stands. Last in
  the attack order, after goals 2, 1 and 3.
- POST — lower only, `x -> w`.
- PUT / DELETE / PATCH — raise only, `w -> x`.

## The three goals

Work one goal at a time and bring them together afterwards. Attacking
several at once is what caused the repeated failures: they have
different shapes and need different evidence. Counts are the current
classifier's errors over the 1478 labelled rows.

| # | error | count | where it lives | why it matters |
|---|---|---|---|---|
| 2 | **x dressed as w** | 10 (1478 rows); 280 (5465 rows, combined corpus; 297 counts all loosening, including 17 GET rows) | PATCH, DELETE, PUT | a dangerous operation is treated as a safe write — this is the leak |
| 1 | **w dressed as x** | 178 | POST 103, DELETE 47, PUT 22, PATCH 6 | a safe write is treated as dangerous, so it gets blocked when it should not be |
| 3 | **r dressed as x or w** | 26 | POST 24 (r->x), PUT 2 (r->w) | a pure read is treated as a write. Deferred: smallest and least harmful |

Attack order is 2, then 1, then 3. One goal at a time: while a goal is
open, everything outside it — the other goals, other methods, other
vendors — is out of focus and is not chased. That isolation is what
stops the noise that caused the earlier repeated failures. (D47)

Goal 2 (x dressed as w) is open now: a risky operation treated as a safe
write. It is the leak and the one that fails the go/no-go gate.

**Goal 2 has a measured answer (2026-09-09): the via-negativa
allowlist, M1-C20.** Five passes (C16-C20) were run against goal 2 this
pass. C16 (hand-read description phrases) and C17 (hand-named nouns)
each closed every leak they were tuned on and then failed to transfer
under leave-one-vendor-out (LOVO) — C17 also breached D24 by naming a
word off a clean-exam row — so both are deleted. C18 and C19 tried the
corpus-derived alternative D30 rule 5 called for: a mechanically
admitted blocklist of third-party nouns, gated on surviving LOVO. C18
admitted zero words at 1478 and 2472 rows; C19, run again after a third
blind exam brought the corpus to 5465 rows, admitted exactly one
(`owner`), closing 6 of 280 leaks at that size. The blocklist shape is
real but starved — roughly one admission per 1800 evidence rows — and
would not reach zero leaks at any corpus size reachable soon.

C20 is the user's inversion: instead of learning which nouns mean
"someone else's thing," learn an allowlist of "yours" nouns (project,
file, record, config, zone, ...) and raise a PUT/DELETE/PATCH floor row
to x when it carries no word from that list. Adopted at the LOOSE bar
(n>=2 rows, minW 0.80 w-share, 439 words). Measured leave-one-vendor-out
over the full 5465-row combined corpus (the only honest number — fitted
numbers looked far better and collapsed going to LOVO, at one point 2
fitted leaks becoming 41):

| config | leaks | real over-tight (a rule fired and was wrong) | flagged unknown (no evidence, went safe) |
|---|---|---|---|
| c15 today | 280 (5.1%) | 522 (9.6%) | 152 (2.8%) |
| C20 loose (n>=2, minW 0.80, 439 words) — adopted | 89 (1.6%) | 522 (9.6%) | 1397 (25.6%) |
| C20 tight (n>=5, minW 0.95, 106 words) | 29 (0.5%) | 522 (9.6%) | 2725 (49.9%) |

Every point on the nine-point sweep (docs/logs/m1/c20-sweep.md) beats
the c15 baseline under LOVO — the opposite of what happened to the
blocklist attempts, which transferred nothing. The cost is steep:
flagged-unknown rows rise from a quarter to half of all rows as the bar
tightens. The user judged leaks in the 2-4% range acceptable, given
every leak is flagged (D49) — and the strongest single result of the
day held across every pass: every all-loosening row ever measured, 297
of 297 (280 goal-2 plus 17 GET rows), landed on a row the tool had
already flagged as unresolved (floor:true), never on a row where a
word rule actually fired.

Contested words shared with c11.mjs's hand-written PARTY_NOUNS
(network, device, person, customer, contact, partner) were settled by
measured lean rather than taste, per the user's instruction (D50): all
six lean "yours" (w) at 83.3%-100% w-share. This has no scored effect
yet — c15's own PARTY_NOUNS rule fires before a row can reach the C20
layer. The PARTY_NOUNS edit itself is now closed: M1-C24 measured the
via-negativa cleanup and found every variant raises goal-2 leaks above
goal 2's own baseline of 89 (KEEP 98, STRIP 106), so under the user's
advance ruling the list stays unchanged (D52, measured no).

C20 is a POC (poc/m1/arbiter/c20.mjs), not shipped; "never ship the
POC" stands. Open before it can graduate: a fresh exam 4 — exam 1,
exam 2 and exam 3 have all now been used to hand-pick, admit, or
sweep-score a rule change and are burned as blind material for scoring
any further change to this rule. Exam 4 is drawn, labelled (4000 rows, 318 providers) and scored
once by `poc/m1/arbiter/c25.mjs`, but its result is NOT comparable
to any earlier set — its truth is roughly twice as x-heavy (25.2% x
against exam 2's 14.9% and exam 3's 12.6%) because its labelling
brief was reconstructed after exam 3's was lost. Corrected for that
drift, goal 2's wild leak rate estimates at 2.5-5% against the 1.6%
corpus prediction, while goal 1 transferred cleanly at 58 rescued
and 11 leaks against 61 and 6 predicted. The next gate is now the
user's ruling between enlarging the calibration and relabelling
exam 4, and neither has been chosen. See
`docs/logs/learnings.md` (M1-C25),
`data/exam4-2026-09-12/LABELLING-BRIEF.md` and
`data/calibration-2026-09-12/`.
Also open: "flagged" is not wired in code — C20's raises carry
floor:false and C22's lowered rows are unmarked, so "flagged" exists
only in how passes are reported — and must be wired before anything
graduates. Full numbers, the deleted C16/C17 passes, and the C18/C19
derivation are in docs/logs/learnings.md (M1-C16 through M1-C20) and
D46-D50. Exams 1-3 are now further burned: C22 and C23 were scored on
them too, so any future change to this rule needs the fresh exam 4
before it can be scored honestly.

**Goal 1 has a measured answer (2026-09-10, the user's ruling): the
allowlist wins, M1-C22.** Three passes (C21-C23) were run against goal
1 this pass. C21 audited the hand-written danger lists word by word
and found the 522 false alarms sit disproportionately on nouns —
webhook, channel, device, contact, network, repository, customer —
and on verbs mismatched to nouns — trigger, run, transfer, pay — that
C20's measured "yours" allowlist already rates 87-100% truth-w; the
two lists disagree only where the evidence is genuinely mixed (user,
account, group, token).

C22 is the fix: on any PUT/DELETE/PATCH row c15 raised to x under rule
`live-verb` or `party-noun`, if every one of the row's cleaned head
nouns is on the allowlist, lower the class back to w with rule
`allowlist-wins`. This is the first rule in the project that loosens
(x -> w), the one direction the safety spine guards, so a wrong firing
here is a leak, not a usability cost. Adopted at variant N (party-noun
rule only, not live-verb) with the TIGHT bar minN=5, minW=0.95, a
106-word allowlist — deliberately tighter than goal 2's loose bar
(D48), because this is the project's first loosening rule. Measured
leave-one-vendor-out over the full 5465-row combined corpus: 61 of the
522 over-tight rows rescued, at a cost of 6 new leaks; against the
5465-row base, false alarms fall from 9.6% to 8.4% and new misses rise
from 0 to 0.11%. Adoption is conditional on flagging: every row
`allowlist-wins` lowers is marked review, never confident, so the 6
leaks stay visible and the project's standing property — never
confidently wrong in the loosening direction — survives.

C23 tried reading the object noun from the path tail instead of the
operationId head noun, and lost: 31 rescued / 5 leaks against C22's 61
rescued / 6 leaks, and a union of both sources (48 rescued / 4 leaks)
was offered as a safer alternative and not taken, since flagging
already keeps a leak from being silent. Description-marker phrases
(C21) were also measured and rejected — only one marker beat chance,
across 28 of 5465 rows, too thin to build on. C22 is a POC
(poc/m1/arbiter/c22.mjs), not shipped; "never ship the POC" stands.
Full numbers are in docs/logs/learnings.md (M1-C21 through M1-C23) and
D51.

The 8.4% (461-row) false-alarm figure above counts only the
hand-written word rules. Goal 1 owns those 461 word-rule false alarms
and, as goal 1's C22 fix, a cost of 6 leaks charged to goal 1's
ledger. Goal 2 owns 89 leaks and, as the price of its C20 fix, 1311
false alarms. POST's x default gives 103 false alarms on its own.
Combined: both shipped together (leave-one-vendor-out, 5465 rows)
gives 95 leaks (1.7%) and 1875 false alarms (34.3%); see D52.

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
Decisions D1-D45 are in [the decisions log](../wiki/decisions-log.md).
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
