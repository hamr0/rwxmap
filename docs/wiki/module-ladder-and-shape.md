---
type: reference
title: Module ladder and arbiter shape
status: stable
---

# Module ladder and arbiter shape

This page holds the module ladder (M0-M4), the M1 go/no-go gate and
its current status, the labelled sets, and the current per-method
arbiter shape (C15, D42-D44) with its floor table, its rules, its
scores, and the wild reading over the APIs.guru corpus.
(docs/archive/prd.md:146-477)

## Module ladder

Modules are built one at a time; the next never starts while the
current is unproven. Every POC result updates the PRD. Never ship the
POC; graduate it. (docs/archive/prd.md:148-150)

**M0 — Ground truth + first arbiter run.** Re-read all 292 operations
one by one, both halves (GET and non-GET), one reason per row that
names the spec field it rests on, no template. Run the two-signal
arbiter (§4.1), regex-only, tighter default. Produce a divergence
list: rule vs reader, one verdict per row. Riskiest assumption: that
method plus verb yields a confidence that separates safe loosenings
from unsafe ones on real data. M0 answers the go/no-go and is the only
module where trying different arbiter shapes is in scope.
(docs/archive/prd.md:152-165)

**M1 — The informed arbiter (fresh POC).** A new arbiter in `poc/m1/`,
nothing imported from `poc/m0/` except plumbing. Riskiest assumption,
tested first: that structural fields are present often enough and
split the truth classes cleanly enough to carry a rule; a census over
the 719 operations is the first artefact.
(docs/archive/prd.md:167-178)

**M2 — Shape rules, only if justified.** For each divergence class
from M0/M1 that appears more than once, add one deterministic
OpenAPI-shape rule (request body present, response schema, status
codes); re-run. Riskiest assumption: coverage without a new wrong
loosening. (docs/archive/prd.md:296-299)

**M3 — Output contract + vectors.** The per-operation output (§4.3)
with MCP fields; a frozen labelled vector set including a negative
control (the two destructive read-named operations) so a consumer can
check its own reading of the map. Riskiest assumption: that the MCP
mapping is lossless enough for a real client.
(docs/archive/prd.md:301-305)

**M4 — Findings entry.** A dated entry in `docs/logs`: what the table
decides, what it cannot, the two error counts, and what that means for
the -02 text. Then decide whether tightening enters the -02 argument
(see D4, open). (docs/archive/prd.md:307-310)

## M1 go/no-go (D30)

Every operation gets a class and a floor flag (D44): floor:false when
a word rule read the operation and fired, floor:true when the class
came from the method alone. "Assigned" means floor:false; "sent to
review" means floor:true on PUT/DELETE/PATCH, the bucket where every
measured leak lives. Go means all of:
(docs/archive/prd.md:180-185)

1. Zero leaks (wrong loosenings) among assigned rows, on every set.
2. Rows sent to review plus over-tightened rows, together, land near 5%
   of each of CAMARA and hold-out 1. M0's 11% over-tight on CAMARA is
   not acceptable. The threshold is tuned on CAMARA and hold-out 1; the
   clean exam is scored once and reported (D24).
3. Every remaining false flag must be one a human reader also finds
   confusing. M0's last false flags were plain words a reader resolved at
   a glance; a list like that fails the gate even at a low count.
4. A field is a primary signal in a set only if present on 90% or more
   of that set's rows, per method. Below 90% it is secondary: weighed
   only when present, never on absence (D2). By the census this makes
   per-operation scopes primary for CAMARA only (M1-C2); PagerDuty's
   `x-pd-requires-scope` and the rest are secondary.
5. Verb and noun leans come from a broader corpus (APIs.guru, D7) as
   method co-occurrence — which methods a verb or noun travels with —
   with CAMARA usable as one signal among them. No hand lists.

(docs/archive/prd.md:187-202)

**Gate status, 2026-09-09.** Rule 1 fails: 27 leaks (17 Slack GET, 10
x-dressed-as-w on PUT/DELETE/PATCH). Rule 2 fails by a wide margin:
floor:true rows on PUT/DELETE/PATCH number 275 of 419 across all six
sets, plus 204 over-tightenings, against a 5% target. Rules 3-5 not
yet assessed for the current shape; rule 5 is the next step (M1 step
3). (docs/archive/prd.md:204-209)

M1 is a POC, not graduated. The D30 gate is NOT met: 27 leaks, of
which 17 are Slack GET rows (one vendor; GET runs no rules by design)
and 10 are x-dressed-as-w on PUT/DELETE/PATCH, all vocabulary gaps.
Next step is M1 step 3: derive the POST-lowering and
PUT/DELETE/PATCH-raising lists from the corpus (D30 rule 5) and
re-measure. Prior statuses (C10, C11) are in learnings.
(docs/archive/prd.md:211-217)

## Labelled sets

| set | ops | providers | bucket |
|---|---|---|---|
| camara | 292 | 60 CAMARA repos | tuned |
| holdout1 | 207 | twilio 94, github 81, stripe 32 | tuned |
| holdout2 | 220 | box 99, pagerduty 93, adyen 28 | reference |
| holdout3 | 226 | discord 81, sentry 76, vercel 69 | tuned |
| holdout4 | 210 | linode 75, cloudflare 71, x 64 | clean exam |
| holdout5 | 323 | slack 174, amazon 125, notion 24 | tuned (was clean; D40) |

Truth is model-read, blind, per D-series notes; "tuned" means code was
changed while its scores were visible; "clean exam" means scored once
and never used to choose. Canonical file: data/corpus/labelled.csv
(D45). (docs/archive/prd.md:219-233)

## M1 arbiter shape (current, C15, D42-D44)

Floor per method = that method's own measured truth lean, a starting
value, never an early return: (docs/archive/prd.md:237-238)

| method | n | truth r | truth w | truth x | floor |
|---|---|---|---|---|---|
| GET / HEAD / OPTIONS | 550 | 97% | 1% | 2% | r |
| POST | 509 | 17% | 20% | 62% | x |
| PUT | 127 | 2% | 83% | 15% | w |
| DELETE | 250 | 0% | 81% | 19% | w |
| PATCH | 42 | 0% | 69% | 31% | w |

(docs/archive/prd.md:240-246)

One direction of travel per method:

- GET / HEAD / OPTIONS: no word rules run. Return the floor.
- POST: LOWER only. A read verb in lead position lowers x to r. No
  raise runs (the floor is already the top).
- PUT / DELETE / PATCH: RAISE only. A live verb, or a party/shared
  noun (suppressed by a caller phrase), raises w to x. No lowering
  runs.

(docs/archive/prd.md:248-255)

Vocabulary is split to match: one lowering list used only on POST; one
raising list used only on PUT/DELETE/PATCH. Both lists are to be
derived from the APIs.guru corpus (data/corpus/apis-guru-ops.csv.gz,
123,339 operations, 673 providers; read with `zcat`), per D30 rule 5,
not hand-written; the hand lists in poc/m1/arbiter/c11.mjs are the
placeholder until M1 step 3 replaces them.
(docs/archive/prd.md:257-263)

Output per row: class, rule, evidence, and floor:true/false (whether a
word rule fired). No confidence score (D44).
(docs/archive/prd.md:265-266)

Score over 1478 rows: exact 84.4%, leaks 27 (1.8%), over-tight 204
(13.8%). Per method: GET 533/550 exact, 17 leaks (all Slack GET, one
vendor), 0 over; POST 382/509, 0 leaks, 127 over; PUT 102/127, 1 leak,
24 over; DELETE 200/250, 3 leaks, 47 over; PATCH 30/42, 6 leaks, 6
over. (docs/archive/prd.md:268-272)

### Wild reading (2026-09-09)

c15 run over 92,049 APIs.guru operations with every labelled-set
provider excluded; no truth exists on the wild, so this compares what
truth says on the labelled 1478 against what the classifier outputs on
the wild: (docs/archive/prd.md:274-277)

| method | truth r | truth w | truth x | wild output r | wild output w | wild output x | rules fired on wild | reading |
|---|---|---|---|---|---|---|---|---|
| GET | 97% | 1% | 2% | 100% | 0% | 0% | 0% | aligned by design |
| PUT | 2% | 83% | 15% | 0% | 87% | 13% | 13% | aligned |
| DELETE | 0% | 81% | 19% | 0% | 86% | 14% | 14% | close, slightly under-raising |
| PATCH | 0% | 69% | 31% | 0% | 88% | 12% | 12% | under-raising: a third are x, the list catches an eighth |
| POST | 17% | 20% | 62% | 2% | 0% | 98% | 2% | way off: 37% are not x, the lowering list fires on 2% |

(docs/archive/prd.md:279-285)

What it says: the floors hold on the wild for GET, PUT and DELETE;
PATCH under-raises (the six leaks); POST is the largest gap (the 127
over-tightenings). The vocabulary job, by size, is POST-lowering
first, then PATCH-raising. (docs/archive/prd.md:287-290)

## Superseded shapes

E12b (M0), the C7-C10 weighted arbiter, and the C11 blanket cascade
are superseded. They are recorded in docs/logs/learnings.md under
their own headings and are not restated here.
(docs/archive/prd.md:292-294)

## Archived: §4.5 floor from the method, ceiling from the text

Superseded by the current M1 arbiter shape above (D42). The RFC-9110
framing — safe methods locked at r, idempotent methods floored at w,
POST/PATCH x by policy — was replaced by floors set at each method's
measured truth lean, which moved PATCH from x to w. The 2026-09-07
E12b shape and its measured weaknesses are in learnings under E12b.
This section describes the archived M0 arbiter (D29), kept as the
measured ceiling of prose-only rules.
(docs/archive/prd.md:420-429)

The two roads to `x` are not interchangeable. Over the 499 labelled
operations, 43 of 153 `x` rows reach beyond the caller while remaining
perfectly repeatable, and 20 DELETE rows are `x` despite being
idempotent, so an arbiter that tests only for non-idempotence cannot
reach the gate. (docs/archive/prd.md:431-435)

Operation-level field coverage, measured 2026-09-06:

| document | operations | has description | has callbacks |
|---|---|---|---|
| Stripe | 594 | 99% | 0% |
| Slack | 174 | 100% | 0% |
| CAMARA test bed | 292 | ~100% | 14% |
| Twilio, Stripe, GitHub hold-out | 207 | 92% (16 Twilio ops have no prose) | 0% |

Descriptions are close to universal and are the load-bearing text
signal; `callbacks` is a strong positive marker where present, absent
from most catalogues, so it can support a class but never a coverage
claim. (docs/archive/prd.md:451-463)

**Where the work is, by method (M0, 2026-09-07)**

| bucket | ops | method default | truth says | error direction if left at default |
|---|---|---|---|---|
| GET | 96 | r | 96 r | none; closed |
| POST | 138 | x | 59 r, 4 w, 75 x | 63 over-tightenings; never a leak |
| DELETE, PUT, PATCH | 58 | w | 50 w, 8 x | 8 wrong loosenings |

(docs/archive/prd.md:465-471)

Two problems, not one. The security problem is small and lives
entirely in DELETE, PUT and PATCH: `x` dressed as `w`. The usability
problem is large and lives in POST: `r` dressed as `x`. The first
fails the gate; the second only costs false alarms.
(docs/archive/prd.md:473-476)
