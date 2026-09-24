# Jev learnings

A standing reference for everything this project has tried with Jev, the
LLM tier. It is organised by theme rather than by date, so it can be read
top to bottom before designing the next tier. The chronological record
stays in `docs/logs/learnings.md`; this file is the distilled version,
and every number in it was measured on this project's own data.

## What Jev is, and how it is called

Jev is reached over HTTP: `POST https://api.typesafe.ai/v1/systemone`,
Bearer auth, model `jev-latest`, which answers as `jev-1.13.0`. Cost is
$42 per billion input tokens.

It offers three primitives:

| primitive | returns | confidence field |
|---|---|---|
| noul | a yes/no probability, 0-1 | none |
| choice | a choice plus a probability per option | yes |
| score | an ordered set of levels | yes |

`instructions` and the criteria accept a string, an object, an array or
null.

Every measurement in this project used **noul** except the one cold
whole-job run, which used **choice**.

## Non-determinism

Jev does not return the same answer twice. Same package, same 200 rows,
two runs: 114 of the 200 answers differed, the largest gap was 0.080,
and 3 of the 200 crossed a 0.6 threshold.

Three rules follow, and they are not negotiable:

- No byte-identical proof is possible on a Jev-backed step. The
  equivalence proofs that pin the mechanical steps cannot be written here.
- A threshold can never be pinned from one run.
- A "zero cost" reading must be shown on more than one run before it is
  believed.

This rule is what caught an earlier jev-raise-wx result at t=0.90 as
noise: run 1 closed 3 leaks for 0 false alarms, run 2 closed 1 for 0
false alarms — same threshold, same rows, and nothing to choose between
them.

## Hardening changes the answers

The same call through bareagent's provider hardening is not the same
call. Of 1113 noul values, 749 differed between a raw fetch and the
hardened provider, with a largest gap of 0.17. On identical data the
useful cutoff was 0.70 unhardened and 0.5-0.6 hardened.

So a threshold is only valid for the exact call path it was swept on.
Changing the client changes the number.

## A bug found upstream

bareagent rejected structured (object or array) `instructions` at
`src/provider-jev.js:142`, because the hardening at `:168` built the
prompt by string concatenation and produced `"[object Object]"`. That
project fixed and shipped it as 0.46.1, then 0.46.2. Afterwards this
project put 1759 live `classify()` calls through the provider with zero
failures.

## What Jev is asked, and what it is never asked

Jev is never asked to write anything. It answers yes/no or picks. All
orchestration stays in code.

The state sent is **five fields only**: method, path, operationId,
summary, description. No step verdict, no tool class, no truth. The
coldness is deliberate — naming the tool's own verdict anchors the answer
towards w, and w is the fail-open direction.

Thresholds live in code, never in the prompt. Jev never sees a threshold
and never says a class.

## Jev cannot do the whole job (rejected)

A cold `choice` over r/w/x on all 4171 provider-corpus rows scored 88.2%
exact (3679 rows), 11.0% leaks (459) and 0.8% over-tight (33).

The confusion matrix:

| truth | n | said r | said w | said x |
|---|---|---|---|---|
| r | 2082 | 2077 | 2 | 3 |
| w | 1218 | 4 | 1186 | 28 |
| x | 871 | 3 | 452 | 416 |

Per provider, exact ran from 84.3% (asana) to 96.3% (figma), and leaks
from 3.7% (figma) to 15.3% (asana).

The error is concentrated in a single cell: 452 of the 871 truth-x rows
were called w. That gives x recall of 47.8% but x precision of 416/447 =
93%.

**Lesson.** That asymmetry — high precision, poor recall — is exactly why
a one-way tier works and a replacement does not. Believe the positive,
ignore the negative.

## Jev cannot replace step 2 (rejected)

Over the same 1113 build-set rows, step 2 scored 966 right and 147
dangerous. Jev swept:

| cut | right | dangerous | over-tight |
|---|---|---|---|
| 0.3 | 996 | 25 | 92 |
| 0.4 | 1022 | 46 | 45 |
| 0.5 | 1023 | 63 | 27 |
| 0.6 | 1027 | 75 | 11 |
| 0.7 | 1019 | 93 | 1 |

Under leave-one-vendor-out with the cut picked per fold on the other 12
vendors, Jev scored 1012 right / 72 dangerous / 29 over-tight against
step 2's 966 right / 147 dangerous. Jev beat or tied step 2 on danger in
all 13 vendors and won on "right" in 10 of the 13.

It was still rejected as a replacement. A replacement means the
fail-open direction is owned by a non-deterministic component, and that
is not a trade this project makes on a headline score.

## The criteria ablation

This is the single most important result in this document. All 4171
corpus rows, three arms, cold whole-job:

| arm | criteria | tokens/row | exact | leaks | over-tight | mean conf |
|---|---|---|---|---|---|---|
| LOADED | the full brief | ~2594 | 88.2% | 11.0% | 0.8% | 0.90 |
| SHARP | three sentences, x has a real test | ~486 | 76.1% | 6.3% (264) | 17.6% (733) | 0.77 |
| MINIMAL | three sentences, x = "neither r nor w" | ~472 | 70.5% | 16.7% (697) | 12.8% (533) | 0.57 |

Brevity is not what broke MINIMAL — the junk-drawer definition of x was.
SHARP is the same length and beats it by 6 points.

The full brief wins the headline, but the twelve rules buy precision and
cost recall: SHARP catches 609 of the 871 truth-x rows against LOADED's
416, while wrongly flagging 711 truth-w rows against LOADED's 28. And
254 real x rows are found by SHARP and missed by LOADED entirely.

A naive two-stage funnel asking the **same** question twice was tested
and rejected: it returns the intersection, 355 real x, which is worse
than LOADED alone at 416. A funnel only helps if each stage asks a
different question.

## Raise-only over step 2 (worked, under the old brief)

Over the 1113 build-set rows that the D75 flow labels w — 147 truth-x
and 966 truth-w:

| t | leaks closed | false alarms | ratio |
|---|---|---|---|
| 0.50 | 84 | 27 | 3.11 |
| 0.60 | 69 | 13 | 5.31 |
| 0.70 | 51 | 1 | 51.0 |
| 0.80 | 34 | 0 | — |

Under leave-one-vendor-out across the 13 vendors with the threshold
picked per fold: 43 closed, 1 false alarm, ratio 43.0 against the
adoption bar of 10. All 13 folds picked 0.70 or 0.80, and the single
false alarm was a gitlab row.

Why this mattered: it was the first thing measured in this project that
did not collapse under LOVO. D81's mined word lists went from 8.17
fitted to 0.83 LOVO; this went from 51.0 fitted to 43.0 LOVO.

The honest limit: under LOVO it closes only 29% of the leaks. A partial
fix, not a solve.

Note that 0.60 scored better on whole-set exact (86.2%) but failed the
10:1 bar at 5.31 and was rejected. A rule below its bar stays pending
even when it improves the headline.

## Scored once on a clean exam (worked)

The 1003-row five-vendor exam (auth0, hubspot, zendesk, klaviyo, miro):

| configuration | exact | leaks | over-tight |
|---|---|---|---|
| frozen flow | 83.8% | 8.2% (82) | 8.0% (80) |
| Jev cold, alone | 79.4% | 20.6% (207) | 0.0% |
| flow + Jev raise | 86.9% | 5.1% (51) | 8.0% |

Jev ran on the 654 rows the flow calls w, of which 82 (12.5%) are truth
x, and closed 31 of those 82 (37.8%) for 0 false alarms. Per provider,
counting closed leaks out of that provider's truth-x flow-w rows:

| provider | closed | of | rate | flow-w rows |
|---|---|---|---|---|
| auth0 | 8 | 34 | 23.5% | 171 |
| hubspot | 2 | 4 | 50.0% | 181 |
| zendesk | 9 | 22 | 40.9% | 163 |
| klaviyo | 0 | 8 | 0.0% | 69 |
| miro | 12 | 14 | 85.7% | 70 |

Zero false alarms on every provider.

**Lesson.** The tier held on genuinely unseen vendors, and over-tight was
unchanged — the raise direction cannot create over-tightness on rows it
does not touch.

## A vendor Jev cannot help (unsolved)

On the burned okta/docusign/xero exam's 446 step-2 method-floor rows
(151 truth-x, 294 truth-w, 1 truth-r), at cut 0.5 per vendor:

| vendor | Jev right | Jev dangerous | step 2 right | step 2 dangerous |
|---|---|---|---|---|
| okta | 182 | 18 | 143 | 61 |
| docusign | 166 | 10 | 143 | 36 |
| xero | 15 | 48 | 9 | 54 |

54 of xero's 63 floor rows are truth-x, and Jev recovers only 6 of them.
Xero carries no description text at all.

**Lesson.** A model tier reads text. Where the spec has no text, no tier
of any kind can help, and that is a property of the corpus, not a prompt
problem.

This is a read of a burned exam, not a clean score.

## The D88 lowering tier (adopted)

Jev may **lower** x to w on floor-post rows only, at t=0.10 — that is,
lower only when Jev is at least 90% sure the row is w. It never raises.
It is opt-in, the core works without it, and the model version is
recorded with the output.

A fail-**open** bug was found and fixed in `applyJev`: an answer of
`{p: NaN}` lowered to w, because `NaN > 0.10` is false, and an answer
carrying no model lowered too.

**Standing warning.** A threshold comparison written the wrong way round
fails open silently. Every guard on a Jev answer must be written to fail
**closed**, and must be tested with NaN, missing and malformed answers.

## D95 — three independent tiers

Jev splits into tiers. Each has its own ledger, and none can undo
another:

| tier | reads rule | direction |
|---|---|---|
| jev-lower | `floor-post` | x -> w only |
| jev-raise-wx | `method-floor` (PUT/PATCH) | w -> x only |
| jev-raise-get | `method` GET rows | r -> w only |

Measured on the 8376-row tuning pool (the combined 6557 rows plus the
relabelled buildset's 1819), two full runs each, at about $0.63 and
60-100 seconds per pile per run.

- **jev-lower at t=0.10.** Run 1: 1065 over-tight rows fixed for 14 new
  leaks, ratio 76. Run 2: 1067 for 16, ratio 66.69. Stable, and passes
  the bar of 10.
- **jev-raise-get at t=0.50 through 0.80.** Both runs identical: exactly
  2 rows moved, 2 leaks closed, 0 false alarms, 100.0% exact on its 2543
  rows. Stable.
- **jev-raise-wx.** Failed on both runs. Its pile is 1657 PUT/PATCH rows,
  truth 1 r / 1601 w / 55 x.

The jev-raise-wx sweep, as (leaks closed, false alarms):

| t | run 1 | run 2 |
|---|---|---|
| 0.50 | 14, 4 | 14, 4 |
| 0.60 | 14, 3 | 14, 3 |
| 0.70 | 12, 2 | 13, 2 |
| 0.80 | 8, 1 | 9, 1 |
| 0.90 | 3, 0 | 1, 0 |
| 0.95 | 1, 0 | 1, 0 |
| 0.98 | 0, 0 | 0, 0 |

The best real ratio is 8-9 at t=0.80, against the bar of 10.

## Why jev-raise-wx failed, and the fix (2026-09-23)

This is the headline finding of the whole file.

**Diagnosis: the LOADED criteria suppress the raise on this specific
pile.** Measuring the composition of the ~2190-token prompt, by what
each part argues for:

| part | tokens | argues |
|---|---|---|
| cannot_be_undone clauses | ~437 | FOR x |
| x-side examples | ~94 | FOR x |
| the method table | ~351 | AGAINST |
| can_be_set_back | ~353 | AGAINST |
| not-x examples | ~135 | AGAINST |
| tripwires (`ignore`) | ~390 | AGAINST |
| definition, framing, focus | ~328 | mixed |

Roughly 530 tokens argue for x and 1230 against, on a question that only
asks about x.

It is worse than that on this pile in particular. The method table says
"PUT and PATCH are w unless the text says the call does one of the x
things", which pre-answers the question for every row in a pile that is
entirely PUT and PATCH. The tripwires then forbid inferring anything the
text does not name. The evidence shows it: 1544 of the 1657 rows landed
under p(x)=0.1.

This is the prompt doing what it says, not the model failing to find
signal.

The contrast proves it. **jev-lower uses the same criteria file and asks
the same question, and it works** — because its pile is POST rows, and
for POST the method table says "POST has no default: label it by what it
does". No prior.

**The fix** is `poc/jev-tiers/criteria-x-raise.mjs`: an ablation that
keeps the x letter, the six cannot-be-undone clauses (a) to (f), and the
x-side examples, and drops the method table, the tripwires, the w-side
`can_be_set_back` list and the not-x examples. 743 tokens against
LOADED's 2191.

Two full runs on the same 1657 rows, as (leaks closed, false alarms):

| t | run 1 | run 2 |
|---|---|---|
| 0.50 | 27, 13 | 27, 14 |
| 0.60 | 22, 7 | 24, 8 |
| 0.70 | 20, 6 | 20, 5 |
| **0.80** | **13, 1** | **13, 1** |
| 0.90 | 3, 1 | 3, 1 |
| 0.95 | 1, 0 | 1, 0 |
| 0.98 | 0, 0 | 0, 0 |

t=0.80 gives a ratio of 13.00 and passes the bar of 10 on both runs.

Stability: 13 of the 14 moved rows are identical across the two runs. The
two that differ — jira `exportArchivedIssues` and digitalocean
`genai_patch_cancel_simulation_run` — both sit on the 0.80 boundary and
both are truth x. The same single false alarm appears in both runs: box
`put_metadata_templates_enterprise_security`.

The 13 closed rows span 7 vendors — gitea, appcenter, digitalocean, jira,
docusign, auth0 and zendesk — so this is not one vendor's quirk.

The distribution moved the way the diagnosis predicts: rows under
p(x)=0.1 fell from 1544 to 1303, and the [0.8, 0.9) bucket went from 6
rows to 10, all 10 of them truth x.

Operational detail: 4 of the 1657 rows return HTTP 403 from a WAF,
reproducibly, on every run. The scorer is fail-closed so those rows stay
w, but they are never actually answered.

**13.00 is FITTED** — the threshold was swept on this pool — and the
ablation is **not adopted**. It needs a clean exam.

## A scorer display bug, recorded, not yet fixed

`poc/jev-tiers/score.mjs` computes its ratio as
`leaks_closed / max(1, false_alarms)`, so a change with **zero** false
alarms prints a small finite ratio and is then labelled "fail". It
printed "ratio 2.00 ... fail" for jev-raise-get while that tier was
delivering 100% exact, 0 leaks and 0 over-tight on its 2543 rows.

The ratio is undefined at zero alarms, not small.

## Rules that came out of this

- Ask a one-way question and let code own the threshold.
- Send no verdict of the tool's own.
- Never let the prompt pre-answer the question for the pile it runs on.
- Match the criteria to the pile, not to the project — the same question
  needs different criteria in different directions.
- Anything read off one run is noise until a second run agrees.
- Every guard on a model answer must fail closed and be tested with NaN
  and missing answers.
- A model tier reads text and cannot help where the spec has none.
