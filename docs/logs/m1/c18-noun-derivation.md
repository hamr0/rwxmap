# M1-C18: deriving a party-noun list from the corpus

Measurement only. judge.mjs and c15.mjs are never modified — this file
copies c15's classify logic verbatim (imports every primitive from
judge.mjs/arbiter.mjs/c11.mjs unchanged) and parameterises only the
noun Set, so the extended-set scoring is comparable to c15 itself.
Self-check: classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS) matched
c15.classify(row) on all 1478 rows (0 mismatches) before any
"after" number below was trusted.

All 1478 labelled rows, 6 sets: camara, holdout1, holdout2, holdout3, holdout4, holdout5.
PUT/DELETE/PATCH base rate for truth x: 79/419 = 18.9%.

## Step 1-2: ranked candidate table

Qualification rule: n >= 3 PUT/DELETE/PATCH rows carrying the noun
(as headNounForRow or operationIdHeadNoun), AND x-share >= 75%
among those rows. Ranked by n (evidence volume) desc, then x-share desc.
allCount is the whole-corpus count (every method) so rare words stay visible.

| noun | allCount (all methods) | PDP n | r | w | x | x-share | lift over base | already known |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| member | 17 | 7 | 0 | 0 | 7 | 100.0% | 5.30x | yes (PARTY_NOUNS/SHARED_NOUNS) |
| team | 15 | 6 | 0 | 1 | 5 | 83.3% | 4.42x | yes (PARTY_NOUNS/SHARED_NOUNS) |
| role | 4 | 4 | 0 | 0 | 4 | 100.0% | 5.30x | yes (PARTY_NOUNS/SHARED_NOUNS) |
| message | 14 | 4 | 0 | 1 | 3 | 75.0% | 3.98x | yes (PARTY_NOUNS/SHARED_NOUNS) |
| membership | 5 | 4 | 0 | 1 | 3 | 75.0% | 3.98x | yes (PARTY_NOUNS/SHARED_NOUNS) |
| rol | 4 | 3 | 0 | 0 | 3 | 100.0% | 5.30x | no |

6 nouns qualified.

## Step 3: leave-one-vendor-out

For each qualifying noun, its PUT/DELETE/PATCH evidence rows are grouped
by vendor; for each contributing vendor, qualification is rebuilt on the
OTHER vendors' rows only. "survives LOVO" = yes only if the noun still
qualifies with EVERY vendor removed in turn — i.e. no single vendor's
rows are propping it up alone. A noun that only qualifies when its own
(sole) vendor is included is memorisation, marked below.

| noun | PDP n | vendors | survives LOVO | verdict |
| --- | --- | --- | --- | --- |
| member | 7 | box, discord, github, sentry, vercel | yes | already known — excluded from candidate set |
| team | 6 | box, github, sentry | no | already known — excluded from candidate set |
| role | 4 | discord, github, sentry | no | already known — excluded from candidate set |
| message | 4 | discord, twilio, x | no | already known — excluded from candidate set |
| membership | 4 | box, github | no | already known — excluded from candidate set |
| rol | 3 | discord, github, sentry | no | rejected (memorisation) |

Per-vendor detail (qualifying nouns only):

**member** (PDP n=7, x-share=100.0%):
| held-out vendor | its own n | its own x-share | n w/o vendor | x-share w/o vendor | still qualifies w/o it |
| --- | --- | --- | --- | --- | --- |
| box | 1 | 100.0% | 6 | 100.0% | yes |
| discord | 3 | 100.0% | 4 | 100.0% | yes |
| github | 1 | 100.0% | 6 | 100.0% | yes |
| sentry | 1 | 100.0% | 6 | 100.0% | yes |
| vercel | 1 | 100.0% | 6 | 100.0% | yes |

**team** (PDP n=6, x-share=83.3%):
| held-out vendor | its own n | its own x-share | n w/o vendor | x-share w/o vendor | still qualifies w/o it |
| --- | --- | --- | --- | --- | --- |
| box | 1 | 0.0% | 5 | 100.0% | yes |
| github | 1 | 100.0% | 5 | 80.0% | yes |
| sentry | 4 | 100.0% | 2 | 50.0% | no |

**role** (PDP n=4, x-share=100.0%):
| held-out vendor | its own n | its own x-share | n w/o vendor | x-share w/o vendor | still qualifies w/o it |
| --- | --- | --- | --- | --- | --- |
| discord | 2 | 100.0% | 2 | 100.0% | no |
| github | 1 | 100.0% | 3 | 100.0% | yes |
| sentry | 1 | 100.0% | 3 | 100.0% | yes |

**message** (PDP n=4, x-share=75.0%):
| held-out vendor | its own n | its own x-share | n w/o vendor | x-share w/o vendor | still qualifies w/o it |
| --- | --- | --- | --- | --- | --- |
| discord | 2 | 100.0% | 2 | 50.0% | no |
| twilio | 1 | 0.0% | 3 | 100.0% | yes |
| x | 1 | 100.0% | 3 | 66.7% | no |

**membership** (PDP n=4, x-share=75.0%):
| held-out vendor | its own n | its own x-share | n w/o vendor | x-share w/o vendor | still qualifies w/o it |
| --- | --- | --- | --- | --- | --- |
| box | 1 | 100.0% | 3 | 66.7% | no |
| github | 3 | 66.7% | 1 | 100.0% | no |

**rol** (PDP n=3, x-share=100.0%):
| held-out vendor | its own n | its own x-share | n w/o vendor | x-share w/o vendor | still qualifies w/o it |
| --- | --- | --- | --- | --- | --- |
| discord | 1 | 100.0% | 2 | 100.0% | no |
| github | 1 | 100.0% | 2 | 100.0% | no |
| sentry | 1 | 100.0% | 2 | 100.0% | no |

**0 nouns survive LOVO and are new (not already in PARTY_NOUNS/SHARED_NOUNS):**
(none)

## Step 4: scoring the LOVO-surviving set as an addition to PARTY_NOUNS

Same c15-equivalent logic, whole corpus (all 1478 rows), before (PARTY_NOUNS
∪ SHARED_NOUNS as-is) vs after (plus the LOVO survivors above). Goal-2 leak =
truth x predicted w (under-classification). Goal-1 error = truth w predicted x
(over-classification). over-tight = every predicted-tighter-than-truth row
(goal-1 errors plus any r->w/x rows).

|  | n | goal-2 leaks (x->w) | goal-1 errors (w->x) | total over-tight | exact |
| --- | --- | --- | --- | --- | --- |
| before | 1478 | 10 | 178 | 204 | 1247 |
| after | 1478 | 10 | 178 | 204 | 1247 |

Per-set:

| set | n | leaks before | leaks after | goal-1 before | goal-1 after | over-tight before | over-tight after | exact before | exact after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 2 | 2 | 17 | 17 | 25 | 25 | 265 | 265 |
| holdout1 | 207 | 2 | 2 | 55 | 55 | 55 | 55 | 150 | 150 |
| holdout2 | 220 | 0 | 0 | 15 | 15 | 23 | 23 | 197 | 197 |
| holdout3 | 226 | 4 | 4 | 15 | 15 | 17 | 17 | 205 | 205 |
| holdout4 | 210 | 1 | 1 | 21 | 21 | 24 | 24 | 185 | 185 |
| holdout5 | 323 | 1 | 1 | 55 | 55 | 60 | 60 | 245 | 245 |

## Step 5: owner, credential, username, password

Checked with no hinting — whatever the derivation above found on its own.

- **owner**: does not qualify (PDP n=0, x-share=n/a, whole-corpus count=1).
- **credential**: does not qualify (PDP n=1, x-share=0.0%, whole-corpus count=5).
- **username**: not found as a head noun anywhere in the 1478-row corpus. The corpus does not support it — that is a finding, not a failure.
- **password**: not found as a head noun anywhere in the 1478-row corpus. The corpus does not support it — that is a finding, not a failure.

## Plain-English summary

Of 6 nouns that clear n>=3 and x-share>=75% on
PUT/DELETE/PATCH rows, the data supports adding these words to PARTY_NOUNS
(they survive leave-one-vendor-out, so no single vendor is carrying the
evidence alone):
(none survive)

Adding them changes the whole-corpus score from 10 goal-2 leaks / 178 goal-1 errors to 10 goal-2 leaks / 178 goal-1 errors.

Of the four hinted words (owner, credential, username, password), the
data on its own supports: (none).
