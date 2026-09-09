---
type: reference
title: Go/no-go gate and M0 results
status: stable
---

# Go/no-go gate and M0 results

M0 is **closed** (docs/archive/prd.md:127-131). This page is the
historical record of the go/no-go gate as first stated, and of every
M0 result measured against it. M1 has its own gate; that gate lives on
the module ladder page, not here, and is not restated below.

## The gate (standing rule)

The gate text below is reproduced verbatim from the PRD. It is still
in force.

> Over all 292 test-bed operations against a hand-read ground truth,
> **no rule proposes a class below the ground truth.** Zero wrong
> loosenings.
>
> The two known read-named destructive operations from spike-a's
> `disagreements.md` must come out `x`:
>
> - ClickToDial `DELETE /calls/{callId}` `terminateCall`
> - WebRTC `PUT /sessions/{mediaSessionId}/status` `updateSessionStatus`
>
> One wrong loosening stops the work at the PRD; the arbiter is
> redesigned before anything else is built.
>
> Over-classification (wrong tightening) is counted and reported
> separately but does not fail the gate; it is a usability cost.
>
> Second half of the gate, usefulness: a "useful share" of the 138
> POSTs decided as `r` with high confidence. The number is not set in
> advance — that would be fitting to pass. M0 reports it and the user
> judges.
>
> The two error directions are never collapsed into one accuracy
> number. Report both counts, every time, as justabit's
> `docs/logs/findings.md` already does for leak-direction and
> usability findings.

(docs/archive/prd.md:51-72)

### The gate, restated after D22

> **The gate, restated after D22.** The gate is zero wrong loosenings
> among high-confidence rows; the wrong-loosening rate among
> low-confidence rows is reported beside it, and the over-tightening
> count is reported separately, as before. The two negative controls
> are unchanged and must still come out `x`. Three numbers are
> reported every time and never combined: wrong loosenings at high
> confidence, wrong loosenings at low confidence, and
> over-tightenings.

(docs/archive/prd.md:93-99)

## M0 results

### Result, updated 2026-09-07

Fourteen shapes were run (`docs/logs/learnings.md`)
(docs/archive/prd.md:74-75).

On the CAMARA test bed, split into a BUILD half (30 repos, 140 ops)
and a TEST half (30 repos, 152 ops) from E7 on, shape **E12b** —
method floor; hand-written tighten-only danger lexicon over summary,
description, operationId and path; hand read-verb list lowering
POST/PATCH to `r` at low confidence; structural markers — has zero
wrong loosenings on both halves, and both negative controls come out
`x` (docs/archive/prd.md:74-80).

That score is fitted: the lexicon was written after the E1-E8
failures were seen (docs/archive/prd.md:80-82).

The honest score is the blind hold-out of 2026-09-07
(`data/holdout-2026-09-07/`, 207 Twilio, Stripe and GitHub
operations, no GET, read blind by five agents)
(docs/archive/prd.md:82-84):

| Measure | Value |
|---|---|
| Wrong loosenings (E12b) | 2 of 207 |
| Which two | both GitHub PUTs (assign an enterprise team to an organisation; merge a pull request) |
| Wrong loosenings, Twilio + Stripe | 0 of 126 |
| Over-tightenings (E12b) | 91 |
| Forcing DELETE/PUT/PATCH to `x` | 0 wrong loosenings, 140 over-tightenings, identical to "everything is `x`" |

(docs/archive/prd.md:84-89)

The gate as written (zero wrong loosenings) is met on CAMARA by a
fitted shape and missed by two on the hold-out; whether the gate
counts low-confidence lowerings, and what DELETE/PUT default to, are
open decisions listed in PRD §7 (docs/archive/prd.md:89-91).

### Result on the clean exam, 2026-09-07 (E23)

A second hold-out, `data/holdout2-2026-09-07/` (Box 99, PagerDuty 93,
Adyen 28; 220 operations; 94 GET; ground truth read blind by five
agents with zero orchestrator rulings; r 104, w 63, x 53), was built
after every list in the repo was written, so no lexicon, verb table
or party list had seen it (docs/archive/prd.md:101-105).

With the four-token cap removed (D25), the irreversibility stems
dropped (D26) and collaboration added to the party list (D27), the
union shape scores, per set, pass 2 as follows
(agree / over-tight / wrong loosenings / correct lowerings)
(docs/archive/prd.md:106-112):

| Set | Ops | Agree | Over-tight | Wrong loosenings | Correct lowerings |
|---|---|---|---|---|---|
| CAMARA, build half | 140 | 98 | 42 | 0 | 10 |
| CAMARA, test half | 152 | 120 | 32 | 0 | 13 |
| Hold-out 1 | 207 | 106 | 101 | 0 | 0 |
| Clean exam (hold-out 2) | 220 | 187 | 33 | 0 | 4 |

CAMARA and hold-out 1 are 0 wrong loosenings at high or low
confidence; the clean exam is 0 at high confidence and 0 at low
(docs/archive/prd.md:108-112).

The last clean-exam wrong loosening, `delete_collaborations_id`, a
Box DELETE of a relationship object owned by another person ("Remove
collaboration"), stated in prose that names neither the person nor an
effect, was closed in E23 by a party-list word added after the clean
exam exposed it (taint stated in D27) (docs/archive/prd.md:113-117).

The gate as restated in D22 is met on all three sets at high and at
low confidence (docs/archive/prd.md:117-118). Reported per set, never
combined (docs/archive/prd.md:118-121):

| Confidence | CAMARA | Hold-out 1 | Clean exam |
|---|---|---|---|
| Wrong loosenings, high confidence | 0 | 0 | 0 |
| Wrong loosenings, low/method-only confidence | 0 | 0 | 0 |
| Over-tightenings | 74 of 292 | 101 of 207 | 33 of 220 |

Reference shapes on the clean exam, as (agree / over-tight / wrong
loosenings) (docs/archive/prd.md:121-123):

| Shape | Agree | Over-tight | Wrong loosenings |
|---|---|---|---|
| Word lists alone | 184 | 34 | 2 |
| Verb-led alone | 197 | 20 | 3 |

False-alarm dossier for the clean exam:
`docs/logs/m0/false-alarms-E23.csv` (33 rows)
(docs/archive/prd.md:123-124). Pass 2 is confidence-only (D23) and
does not reduce false alarms; it marks them
(docs/archive/prd.md:124-125).

### M0 closed, 2026-09-07 (D29)

M0 is closed as exploratory, not as a shape to keep. The numbers
above are the measured ceiling of prose-only rules — about 30
over-tightenings per 200 operations at zero wrong loosenings — not a
design to build on. M1 starts fresh with a new arbiter rather than
patching this one (docs/archive/prd.md:127-131).
