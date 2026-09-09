# M1-C18: party-noun derivation over the combined corpus

Measurement only. judge.mjs and c15.mjs are never modified — c18.mjs
copies c15's classify logic verbatim (imports every primitive from
judge.mjs/arbiter.mjs/c11.mjs unchanged) and parameterises only the
noun Set, so the extended-set scoring is comparable to c15 itself.

c16 and c17 (two prior noun/switch POCs) are deleted this pass — both
were measured three times and closed nothing outside the set they were
read from. docs/logs/m1/c16-*.{md,csv} and c17-*.{md,csv} stay in place
as the evidence they failed.

## Part B: the combined corpus

Original 6 sets (camara, holdout1, holdout2, holdout3, holdout4, holdout5): 1478 rows.
Exam 2: 1000 blind rows, 6 dropped for truth_class '?', 994 usable.
Combined: 2472 rows.

Truth split, combined: r=630, w=1284, x=558 (25.5% / 51.9% / 22.6%).
Truth split, original 1478: r=623, w=445, x=410.
Truth split, exam2 994: r=7, w=839, x=148.
Exam2 confidence split: high=690, low=304.

## Part C: candidate head nouns (PUT/DELETE/PATCH rows only)

Qualification rule: n >= 3 PUT/DELETE/PATCH rows carrying the noun
(as headNounForRow or operationIdHeadNoun), AND x-share >= 75%
among those rows. Not tuned — run once as specified.
PUT/DELETE/PATCH base rate for truth x, combined corpus: 227/1413 = 16.1%.

| noun | allCount (all methods) | PDP n | r | w | x | x-share | lift over base | already in PARTY/SHARED_NOUNS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| member | 27 | 17 | 0 | 2 | 15 | 88.2% | 5.49x | yes |
| role | 8 | 8 | 0 | 1 | 7 | 87.5% | 5.45x | yes |
| team | 15 | 6 | 0 | 1 | 5 | 83.3% | 5.19x | yes |
| membership | 6 | 5 | 0 | 1 | 4 | 80.0% | 4.98x | yes |
| order | 15 | 5 | 0 | 1 | 4 | 80.0% | 4.98x | no |
| rol | 5 | 4 | 0 | 1 | 3 | 75.0% | 4.67x | no |
| appointment | 5 | 4 | 0 | 1 | 3 | 75.0% | 4.67x | no |
| password | 4 | 4 | 0 | 1 | 3 | 75.0% | 4.67x | no |
| collaborator | 3 | 3 | 0 | 0 | 3 | 100.0% | 6.22x | yes |
| owned | 3 | 3 | 0 | 0 | 3 | 100.0% | 6.22x | no |
| security | 3 | 3 | 0 | 0 | 3 | 100.0% | 6.22x | no |

11 nouns qualified.

## Part D: leave-one-vendor-out admission

Each vendor = camara (one vendor for all camara rows), every other
original set's `repo` column, or one of exam2's `provider` values (up to
246 distinct providers in the blind file; fewer if dropping '?' rows
happened to remove a provider's only row).
For each qualifying noun, its PDP evidence rows are grouped by vendor;
for each contributing vendor, qualification is rebuilt on the OTHER
vendors' rows only. ADMITTED only if it still qualifies with EVERY
vendor removed in turn — a noun that only qualifies with its sole
propping vendor included is memorisation, listed separately, not admitted.

| noun | PDP n | # vendors | survives LOVO | verdict |
| --- | --- | --- | --- | --- |
| member | 17 | 14 | yes | already known — excluded from candidate set |
| role | 8 | 7 | yes | already known — excluded from candidate set |
| team | 6 | 3 | no | already known — excluded from candidate set |
| membership | 5 | 3 | no | already known — excluded from candidate set |
| order | 5 | 4 | no | rejected (memorisation) |
| rol | 4 | 4 | no | rejected (memorisation) |
| appointment | 4 | 3 | no | rejected (memorisation) |
| password | 4 | 4 | no | rejected (memorisation) |
| collaborator | 3 | 3 | no | already known — excluded from candidate set |
| owned | 3 | 1 | no | rejected (memorisation) |
| security | 3 | 1 | no | rejected (memorisation) |

**0 nouns ADMITTED** (survive LOVO, not already in PARTY_NOUNS/SHARED_NOUNS):
(none)

**6 nouns rejected as memorisation** (qualify on the full set but fail with at least one vendor removed):
`order`, `rol`, `appointment`, `password`, `owned`, `security`

## Part E: scoring

Self-check: classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS) matched
c15.classify(row) on all 1478 original rows (0 mismatches) before any
"after" number below was trusted.

Goal-2 leak = truth x predicted w (under-classification, the go/no-go gate).
Goal-1 error = truth w predicted x (over-classification, a usability cost).
over-tight = every predicted-tighter-than-truth row (goal-1 errors plus any r->w/x rows).
floor leaks = of the goal-2 leaks, how many landed on the unresolved floor (res.floor true), not a fired word rule.

### Full combined corpus (and high-confidence subset for config 3)

| config | n | goal-2 leaks (x->w) | of which floor leaks | goal-1 errors (w->x) | total over-tight | exact |
| --- | --- | --- | --- | --- | --- | --- |
| c15 as-is | 2472 | 91 | 91 | 277 | 310 | 2054 |
| c15 + admitted nouns | 2472 | 91 | 91 | 277 | 310 | 2054 |
| c15 + admitted nouns, high-confidence rows only | 2168 | 30 | 30 | 237 | 269 | 1852 |

### Broken out: original 1478 rows only

| config | n | goal-2 leaks (x->w) | of which floor leaks | goal-1 errors (w->x) | total over-tight | exact |
| --- | --- | --- | --- | --- | --- | --- |
| c15 as-is | 1478 | 10 | 10 | 178 | 204 | 1247 |
| c15 + admitted nouns | 1478 | 10 | 10 | 178 | 204 | 1247 |
| c15 + admitted nouns, high-confidence rows only | 1478 | 10 | 10 | 178 | 204 | 1247 |

### Broken out: exam2 rows only

| config | n | goal-2 leaks (x->w) | of which floor leaks | goal-1 errors (w->x) | total over-tight | exact |
| --- | --- | --- | --- | --- | --- | --- |
| c15 as-is | 994 | 81 | 81 | 99 | 106 | 807 |
| c15 + admitted nouns | 994 | 81 | 81 | 99 | 106 | 807 |
| c15 + admitted nouns, high-confidence rows only | 690 | 20 | 20 | 59 | 65 | 605 |

## Top 25 head nouns still appearing on leaks after admitted nouns are added

Input to the next pass. Counted over the full combined corpus, config 2
(c15 + admitted nouns). A leak row can contribute up to two nouns (summary
head noun and operationId head noun, deduped per row).

| noun | leak rows |
| --- | --- |
| (no head noun) | 4 |
| batch | 3 |
| password | 3 |
| owned | 3 |
| security | 3 |
| email | 3 |
| trafficinfluence | 2 |
| influence | 2 |
| instance | 2 |
| mapping | 2 |
| delete | 2 |
| relationship | 2 |
| verification | 2 |
| invoice | 2 |
| order | 2 |
| destroy | 2 |
| payment | 2 |
| domain | 2 |
| key | 2 |
| stream | 2 |
| update | 2 |
| field | 1 |
| issue | 1 |
| bypass | 1 |
| redirect | 1 |

