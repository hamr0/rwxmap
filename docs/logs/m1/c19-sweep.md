# M1-C19: does more data admit more party nouns?

c18 derived party nouns over 2472 rows (six original sets + exam2) and
admitted ZERO — every qualifier was already known or failed
leave-one-vendor-out (LOVO), and the stated cause was corpus sparsity
(e.g. "password" had only 4 examples in the whole corpus). Exam3 is now
labelled, giving ~5465 rows across the combined corpus. This pass
re-runs c18's exact derivation (same 3/75% bar, not tuned) on the
bigger pile to test whether sparsity was really the cause.

Measurement only. judge.mjs and c15.mjs are never modified — c19.mjs
copies c15's classify logic verbatim (imports every primitive from
judge.mjs/arbiter.mjs/c11.mjs unchanged) and parameterises only the
noun Set, so the extended-set scoring is comparable to c15 itself.

## Part A: the combined corpus

Original 6 sets (camara, holdout1, holdout2, holdout3, holdout4, holdout5): 1478 rows.
Exam 2: 1000 blind rows, 6 dropped for truth_class '?', 994 usable.
Exam 3: 3000 blind rows, 7 dropped for truth_class '?', 2993 usable.
Combined: 5465 rows.

Distinct providers/vendors across the combined corpus: 332.

Truth split, combined: r=646, w=3883, x=936 (11.8% / 71.1% / 17.1%).
Truth split, original 1478: r=623, w=445, x=410.
Truth split, exam2 994: r=7, w=839, x=148.
Truth split, exam3 2993: r=16, w=2599, x=378.

Self-check: classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS) matched c15.classify(row) on all 1478 original rows (0 mismatches). Trusted.

## Part B: candidate head nouns over the full combined corpus (PUT/DELETE/PATCH rows only)

Qualification rule: n >= 3 PUT/DELETE/PATCH rows carrying the noun
(as headNounForRow or operationIdHeadNoun), AND x-share >= 75%
among those rows. NOT tuned — run once as specified, same bar as c18.
PUT/DELETE/PATCH base rate for truth x, combined corpus: 605/4406 = 13.7%.

| noun | allCount (all methods) | PDP n | r | w | x | x-share | lift over base | already in PARTY/SHARED_NOUNS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| member | 47 | 37 | 0 | 7 | 30 | 81.1% | 5.90x | yes |
| permission | 13 | 12 | 0 | 3 | 9 | 75.0% | 5.46x | yes |
| owned | 11 | 11 | 0 | 0 | 11 | 100.0% | 7.28x | no |
| security | 11 | 11 | 0 | 0 | 11 | 100.0% | 7.28x | no |
| membership | 10 | 9 | 0 | 2 | 7 | 77.8% | 5.66x | yes |
| call | 12 | 8 | 0 | 2 | 6 | 75.0% | 5.46x | yes |
| collaborator | 7 | 7 | 0 | 0 | 7 | 100.0% | 7.28x | yes |
| owner | 8 | 7 | 0 | 1 | 6 | 85.7% | 6.24x | no |
| participant | 8 | 5 | 0 | 0 | 5 | 100.0% | 7.28x | yes |
| organizer | 5 | 5 | 0 | 0 | 5 | 100.0% | 7.28x | no |
| subuser | 4 | 4 | 0 | 0 | 4 | 100.0% | 7.28x | no |
| invitation | 4 | 4 | 0 | 0 | 4 | 100.0% | 7.28x | yes |
| admin | 5 | 4 | 0 | 1 | 3 | 75.0% | 5.46x | no |
| webinar | 3 | 3 | 0 | 0 | 3 | 100.0% | 7.28x | no |
| psu | 3 | 3 | 0 | 0 | 3 | 100.0% | 7.28x | no |

15 nouns qualified.

## Part C: leave-one-vendor-out admission (full combined corpus)

Each vendor = camara (one vendor for all camara rows), every other
original set's `repo` column, or one of exam2/exam3's `provider`
values. For each qualifying noun, its PDP evidence rows are grouped by
vendor; for each contributing vendor, qualification is rebuilt on the
OTHER vendors' rows only. ADMITTED only if it still qualifies with
EVERY vendor removed in turn — a noun that only qualifies with its
sole propping vendor included is memorisation, listed separately, not
admitted.

| noun | PDP n | # vendors | survives LOVO | verdict |
| --- | --- | --- | --- | --- |
| member | 37 | 24 | yes | already known — excluded from candidate set |
| permission | 12 | 10 | no | already known — excluded from candidate set |
| owned | 11 | 1 | no | rejected (memorisation) |
| security | 11 | 1 | no | rejected (memorisation) |
| membership | 9 | 6 | no | already known — excluded from candidate set |
| call | 8 | 5 | no | already known — excluded from candidate set |
| collaborator | 7 | 6 | yes | already known — excluded from candidate set |
| owner | 7 | 5 | yes | ADMITTED |
| participant | 5 | 4 | yes | already known — excluded from candidate set |
| organizer | 5 | 2 | no | rejected (memorisation) |
| subuser | 4 | 2 | no | rejected (memorisation) |
| invitation | 4 | 4 | yes | already known — excluded from candidate set |
| admin | 4 | 3 | no | rejected (memorisation) |
| webinar | 3 | 2 | no | rejected (memorisation) |
| psu | 3 | 1 | no | rejected (memorisation) |

**1 nouns ADMITTED** (survive LOVO, not already in PARTY_NOUNS/SHARED_NOUNS):
`owner`

**7 nouns rejected as memorisation** (qualify on the full set but fail with at least one vendor removed):
`owned`, `security`, `organizer`, `subuser`, `admin`, `webinar`, `psu`

## Part D: scoring

Goal-2 leak = truth x predicted w (under-classification, the go/no-go gate).
Goal-1 error = truth w predicted x (over-classification, a usability cost).
over-tight = every predicted-tighter-than-truth row (goal-1 errors plus any r->w/x rows).
floor leaks = of the goal-2 leaks, how many landed on the unresolved floor (res.floor true), not a fired word rule.

### Full combined corpus, all rows

| config | n | goal-2 leaks (x->w) | of which floor leaks | goal-1 errors (w->x) | total over-tight | exact |
| --- | --- | --- | --- | --- | --- | --- |
| c15 as-is | 5465 | 280 | 280 | 625 | 674 | 4494 |
| c15 + admitted nouns | 5465 | 274 | 274 | 626 | 675 | 4499 |

### Full combined corpus, high-confidence rows only

| config | n | goal-2 leaks (x->w) | of which floor leaks | goal-1 errors (w->x) | total over-tight | exact |
| --- | --- | --- | --- | --- | --- | --- |
| c15 as-is | 4585 | 129 | 129 | 497 | 544 | 3895 |
| c15 + admitted nouns | 4585 | 123 | 123 | 498 | 545 | 3900 |

### Broken out by source: original 1478 rows only

| config | n | goal-2 leaks (x->w) | of which floor leaks | goal-1 errors (w->x) | total over-tight | exact |
| --- | --- | --- | --- | --- | --- | --- |
| c15 as-is | 1478 | 10 | 10 | 178 | 204 | 1247 |
| c15 + admitted nouns | 1478 | 10 | 10 | 178 | 204 | 1247 |

### Broken out by source: exam2 rows only

| config | n | goal-2 leaks (x->w) | of which floor leaks | goal-1 errors (w->x) | total over-tight | exact |
| --- | --- | --- | --- | --- | --- | --- |
| c15 as-is | 994 | 81 | 81 | 99 | 106 | 807 |
| c15 + admitted nouns | 994 | 80 | 80 | 100 | 107 | 807 |

### Broken out by source: exam3 rows only

| config | n | goal-2 leaks (x->w) | of which floor leaks | goal-1 errors (w->x) | total over-tight | exact |
| --- | --- | --- | --- | --- | --- | --- |
| c15 as-is | 2993 | 189 | 189 | 348 | 364 | 2440 |
| c15 + admitted nouns | 2993 | 184 | 184 | 348 | 364 | 2445 |

## Part E: learning curve — does more data admit more words?

Same derivation (Parts B+C), re-run at three corpus sizes, each a
superset of the last. Not tuned between sizes — the same 3/75% bar
every time.

| corpus size | # qualifiers | # admitted (LOVO) | admitted list |
| --- | --- | --- | --- |
| original (1478) | 6 | 0 | (none) |
| original + exam2 (2472) | 11 | 0 | (none) |
| original + exam2 + exam3 (5465) | 15 | 1 | `owner` |

## Top 25 head nouns still appearing on leaks after admitted nouns are added

Counted over the full combined corpus, "c15 + admitted nouns" config.
A leak row can contribute up to two nouns (summary head noun and
operationId head noun, deduped per row).

| noun | leak rows |
| --- | --- |
| update | 13 |
| (no head noun) | 12 |
| order | 12 |
| owned | 11 |
| security | 11 |
| delete | 10 |
| password | 6 |
| project | 6 |
| instance | 5 |
| organizer | 5 |
| batch | 4 |
| payment | 4 |
| key | 4 |
| email | 4 |
| subuser | 4 |
| setting | 4 |
| invoice | 3 |
| document | 3 |
| appointment | 3 |
| list | 3 |
| admin | 3 |
| stream | 3 |
| psu | 3 |
| an | 3 |
| trafficinfluence | 2 |

## What the data supports

1 noun(s) admitted at ~5465 rows, vs 0 at 2472. More data DID
admit new words at this bar — see the admitted list above and the
learning-curve table for how the count moved with corpus size.

