# M1-C20: invert the noun rule — an allowlist of "yours" nouns

Every prior pass (c16-c19) tried to learn a BLOCKLIST of
"third-party" nouns and failed under leave-one-vendor-out (LOVO) —
each vendor invents its own noun for someone else's stuff, so
third-party words never repeat across vendors. This pass tests the
inversion: learn an ALLOWLIST of "yours" nouns (project, file,
record, config, zone, ...) instead, and treat the ABSENCE of a known
"yours" noun as the evidence for x. Common own-nouns are hypothesised
to repeat across vendors where third-party nouns don't.

This is a LAYER on top of c15, not a modification of it — c15.mjs and
judge.mjs are never touched. classifyC20 calls c15's real classify()
unchanged and only reconsiders rows c15 left at the w floor on
PUT/DELETE/PATCH (i.e. rows where c15's own LIVE_VERBS/PARTY_NOUNS/
SHARED_NOUNS rules did NOT already fire).

## Part A: the combined corpus

Total: 5465 rows (original 1478 + exam2 994 + exam3 2993).
Distinct vendors: 332.
Truth split: r=646, w=3883, x=936.
PUT/DELETE/PATCH rows: 4406.

Self-check: classifyC20(row, allow-everything) reproduces c15.classify(row) on all 1478 original rows except 3 rows that carry zero extractable head nouns (both headNounForRow and operationIdHeadNoun empty/junk) — expected, since the rule raises on noun-absence regardless of the allowlist. 0 unexplained mismatches. Trusted.

c15 baseline over the full 5465-row corpus: goal-2 leaks=280, goal-1 errors=625, over-tight=674, exact=4494.

## Part B: junk rejection

Raw candidate table: 1282 distinct head nouns (from headNounForRow + operationIdHeadNoun, over all 5465 rows, all methods).
Rejected as junk: 119. Surviving: 1163.

Full rejected list (every token thrown away, with its total count and reason):

| noun | allCount | reason |
| --- | --- | --- |
| the | 30 | stopword |
| rul | 24 | stem-artifact |
| id | 21 | too-short |
| v2 | 14 | non-alphabetic |
| devic | 13 | stem-artifact |
| ip | 9 | too-short |
| not | 9 | stem-artifact |
| an | 9 | too-short |
| messag | 8 | stem-artifact |
| servic | 7 | stem-artifact |
| nod | 7 | stem-artifact |
| me | 7 | too-short |
| fil | 7 | stem-artifact |
| instanc | 6 | stem-artifact |
| rol | 6 | stem-artifact |
| templat | 6 | stem-artifact |
| all | 6 | stopword |
| variabl | 6 | stem-artifact |
| imag | 6 | stem-artifact |
| 1 | 6 | non-alphabetic |
| profil | 5 | stem-artifact |
| in | 5 | too-short |
| base | 5 | stopword |
| resourc | 5 | stem-artifact |
| a | 5 | too-short |
| v3 | 5 | non-alphabetic |
| typ | 5 | stem-artifact |
| to | 5 | too-short |
| rat | 5 | stem-artifact |
| alt1 | 5 | non-alphabetic |
| 3 | 5 | non-alphabetic |
| specified | 4 | stopword |
| updat | 3 | stem-artifact |
| dn | 3 | too-short |
| invoic | 3 | stem-artifact |
| existing | 3 | stopword |
| nam | 3 | stem-artifact |
| it | 3 | too-short |
| given | 3 | stopword |
| zon | 2 | stem-artifact |
| on | 2 | too-short |
| sourc | 2 | stem-artifact |
| cach | 2 | stem-artifact |
| v4 | 2 | non-alphabetic |
| stat | 2 | stem-artifact |
| packag | 2 | stem-artifact |
| cod | 2 | stem-artifact |
| schedul | 2 | stem-artifact |
| i | 2 | too-short |
| schem | 2 | stem-artifact |
| episod | 2 | stem-artifact |
| with | 2 | stopword |
| ad | 2 | too-short |
| bundl | 2 | stem-artifact |
| dat | 2 | stem-artifact |
| file2 | 2 | non-alphabetic |
| file1 | 2 | non-alphabetic |
| bas | 1 | stem-artifact |
| scor | 1 | stem-artifact |
| slic | 1 | stem-artifact |
| qo | 1 | too-short |
| influenc | 1 | stem-artifact |
| organizations/add | 1 | non-alphabetic |
| current | 1 | stopword |
| levels:append | 1 | non-alphabetic |
| respons | 1 | stem-artifact |
| other | 1 | stopword |
| invit | 1 | stem-artifact |
| lik | 1 | stem-artifact |
| sample10 | 1 | non-alphabetic |
| new | 1 | stopword |
| spac | 1 | stem-artifact |
| ko | 1 | too-short |
| usernam | 1 | stem-artifact |
| dm | 1 | too-short |
| for | 1 | stopword |
| single | 1 | stopword |
| modul | 1 | stem-artifact |
| payment4 | 1 | non-alphabetic |
| planting3 | 1 | non-alphabetic |
| planting2 | 1 | non-alphabetic |
| transaction1 | 1 | non-alphabetic |
| shar | 1 | stem-artifact |
| mt4username | 1 | non-alphabetic |
| view' | 1 | non-alphabetic |
| fa | 1 | too-short |
| sms allowed address | 1 | non-alphabetic |
| offset4 | 1 | non-alphabetic |
| planting4 | 1 | non-alphabetic |
| transaction4 | 1 | non-alphabetic |
| offset3 | 1 | non-alphabetic |
| payment3 | 1 | non-alphabetic |
| transaction3 | 1 | non-alphabetic |
| offset1 | 1 | non-alphabetic |
| payment1 | 1 | non-alphabetic |
| offset5 | 1 | non-alphabetic |
| payment5 | 1 | non-alphabetic |
| planting5 | 1 | non-alphabetic |
| transaction5 | 1 | non-alphabetic |
| http2 | 1 | non-alphabetic |
| u | 1 | too-short |
| runner' | 1 | non-alphabetic |
| pric | 1 | stem-artifact |
| n | 1 | too-short |
| id4n | 1 | non-alphabetic |
| by | 1 | too-short |
| id} | 1 | non-alphabetic |
| sampl | 1 | stem-artifact |
| table' | 1 | non-alphabetic |
| primary state tax | 1 | non-alphabetic |
| account' | 1 | non-alphabetic |
| card' | 1 | non-alphabetic |
| user' | 1 | non-alphabetic |
| 2 | 1 | non-alphabetic |
| tl | 1 | too-short |
| track' | 1 | non-alphabetic |
| employe | 1 | stem-artifact |
| languag | 1 | stem-artifact |
| ap | 1 | too-short |

Rejection reason counts: stopword=12, stem-artifact=45, too-short=21, non-alphabetic=41.

## Part C: allowlist derivation (PUT/DELETE/PATCH rows only, surviving nouns)

Sweep: minN in {2, 3, 5} x minW in {0.80, 0.90, 0.95} = 9 points.
A noun joins the allowlist at a point when n >= minN AND w-share >= minW.

| minN | minW | allowlist size (fitted, full corpus) |
| --- | --- | --- |
| 2 | 0.80 | 439 |
| 2 | 0.90 | 409 |
| 2 | 0.95 | 373 |
| 3 | 0.80 | 283 |
| 3 | 0.90 | 253 |
| 3 | 0.95 | 217 |
| 5 | 0.80 | 172 |
| 5 | 0.90 | 142 |
| 5 | 0.95 | 106 |

## Part D: contested words — settled by measured lean, not by taste

Six words sit in BOTH the general candidate pool and c11.mjs's
hand-written PARTY_NOUNS: network, device, person, customer, contact,
partner. Ruling: a word belongs on the allowlist when its measured
lean (over PUT/DELETE/PATCH rows) is toward w; PARTY_NOUNS would lose
it in that case. The user expected device, person, contact to land
as "yours" and network, customer, partner as third-party — reported
here whether the data agrees, without bending the numbers either way.

| word | n | w-share | x-share | # vendors | measured lean | vs user expectation |
| --- | --- | --- | --- | --- | --- | --- |
| network | 16 | 93.8% | 6.3% | 8 | w (allowlist / "yours") | DISAGREES with expectation (expected third-party) |
| device | 24 | 91.7% | 8.3% | 15 | w (allowlist / "yours") | agrees with expectation (yours) |
| person | 7 | 100.0% | 0.0% | 4 | w (allowlist / "yours") | agrees with expectation (yours) |
| customer | 15 | 86.7% | 13.3% | 9 | w (allowlist / "yours") | DISAGREES with expectation (expected third-party) |
| contact | 21 | 95.2% | 4.8% | 13 | w (allowlist / "yours") | agrees with expectation (yours) |
| partner | 6 | 83.3% | 16.7% | 4 | w (allowlist / "yours") | DISAGREES with expectation (expected third-party) |

Caveat, stated plainly: c11.mjs's PARTY_NOUNS is never modified by
this pass. Because c15's own party-noun rule checks PARTY_NOUNS
directly and fires BEFORE a row can reach the w floor, any
PUT/DELETE/PATCH row whose head noun is one of these six words is
already resolved to x by c15 itself and never becomes eligible for
classifyC20's allowlist layer. The ruling above is an honest
measurement of these six words' lean, but it has no effect on this
pass's own scored numbers unless/until a future pass actually edits
PARTY_NOUNS in c11.mjs.

## Part F: fitted vs leave-one-vendor-out, per sweep point

FITTED = allowlist built from ALL rows, scored on ALL rows (inflated,
labelled as such). LOVO = for each vendor, allowlist rebuilt from
every OTHER vendor's rows only, that vendor's rows then scored with
it, summed across all vendors (the honest number).

c15 baseline (no allowlist layer at all), full corpus: goal-2 leaks=280 (5.1%), goal-1 errors=625, over-tight=674 (12.3%), exact=4494.

### FITTED (inflated — allowlist built from all rows, scored on all rows)

| minN | minW | allowlist size | goal-2 leaks | leak % | goal-1 errors | over-tight | over-tight % | exact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 439 | 71 | 1.3% | 1424 | 1473 | 27.0% | 3904 |
| 2 | 0.90 | 409 | 39 | 0.7% | 1671 | 1720 | 31.5% | 3689 |
| 2 | 0.95 | 373 | 2 | 0.0% | 2587 | 2636 | 48.2% | 2810 |
| 3 | 0.80 | 283 | 71 | 1.3% | 1700 | 1749 | 32.0% | 3628 |
| 3 | 0.90 | 253 | 39 | 0.7% | 1944 | 1993 | 36.5% | 3416 |
| 3 | 0.95 | 217 | 2 | 0.0% | 2812 | 2861 | 52.4% | 2585 |
| 5 | 0.80 | 172 | 71 | 1.3% | 2000 | 2049 | 37.5% | 3328 |
| 5 | 0.90 | 142 | 39 | 0.7% | 2237 | 2286 | 41.8% | 3123 |
| 5 | 0.95 | 106 | 2 | 0.0% | 3065 | 3114 | 57.0% | 2332 |

### LOVO (honest — allowlist rebuilt per vendor-fold, that vendor scored held out)

| minN | minW | allowlist size | goal-2 leaks | leak % | goal-1 errors | over-tight | over-tight % | exact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 439 | 89 | 1.6% | 1936 | 1985 | 36.3% | 3374 |
| 2 | 0.90 | 409 | 68 | 1.2% | 2233 | 2282 | 41.8% | 3098 |
| 2 | 0.95 | 373 | 41 | 0.8% | 2963 | 3012 | 55.1% | 2395 |
| 3 | 0.80 | 283 | 80 | 1.5% | 2067 | 2116 | 38.7% | 3252 |
| 3 | 0.90 | 253 | 59 | 1.1% | 2361 | 2410 | 44.1% | 2979 |
| 3 | 0.95 | 217 | 33 | 0.6% | 3083 | 3132 | 57.3% | 2283 |
| 5 | 0.80 | 172 | 76 | 1.4% | 2256 | 2305 | 42.2% | 3067 |
| 5 | 0.90 | 142 | 55 | 1.0% | 2546 | 2595 | 47.5% | 2798 |
| 5 | 0.95 | 106 | 29 | 0.5% | 3247 | 3296 | 60.3% | 2123 |

### LOVO broken out by source: original 1478 rows only

| minN | minW | goal-2 leaks | leak % | goal-1 errors | over-tight | over-tight % |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 4 | 0.3% | 263 | 289 | 19.6% |
| 2 | 0.90 | 2 | 0.1% | 305 | 331 | 22.4% |
| 2 | 0.95 | 2 | 0.1% | 352 | 378 | 25.6% |
| 3 | 0.80 | 4 | 0.3% | 278 | 304 | 20.6% |
| 3 | 0.90 | 2 | 0.1% | 320 | 346 | 23.4% |
| 3 | 0.95 | 2 | 0.1% | 366 | 392 | 26.5% |
| 5 | 0.80 | 3 | 0.2% | 296 | 322 | 21.8% |
| 5 | 0.90 | 1 | 0.1% | 335 | 361 | 24.4% |
| 5 | 0.95 | 1 | 0.1% | 379 | 405 | 27.4% |

### LOVO broken out by source: exam2 rows only

| minN | minW | goal-2 leaks | leak % | goal-1 errors | over-tight | over-tight % |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 29 | 2.9% | 394 | 401 | 40.3% |
| 2 | 0.90 | 21 | 2.1% | 461 | 468 | 47.1% |
| 2 | 0.95 | 16 | 1.6% | 632 | 639 | 64.3% |
| 3 | 0.80 | 26 | 2.6% | 425 | 432 | 43.5% |
| 3 | 0.90 | 18 | 1.8% | 491 | 498 | 50.1% |
| 3 | 0.95 | 13 | 1.3% | 659 | 666 | 67.0% |
| 5 | 0.80 | 25 | 2.5% | 462 | 469 | 47.2% |
| 5 | 0.90 | 17 | 1.7% | 528 | 535 | 53.8% |
| 5 | 0.95 | 12 | 1.2% | 691 | 698 | 70.2% |

### LOVO broken out by source: exam3 rows only

| minN | minW | goal-2 leaks | leak % | goal-1 errors | over-tight | over-tight % |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 56 | 1.9% | 1279 | 1295 | 43.3% |
| 2 | 0.90 | 45 | 1.5% | 1467 | 1483 | 49.5% |
| 2 | 0.95 | 23 | 0.8% | 1979 | 1995 | 66.7% |
| 3 | 0.80 | 50 | 1.7% | 1364 | 1380 | 46.1% |
| 3 | 0.90 | 39 | 1.3% | 1550 | 1566 | 52.3% |
| 3 | 0.95 | 18 | 0.6% | 2058 | 2074 | 69.3% |
| 5 | 0.80 | 48 | 1.6% | 1498 | 1514 | 50.6% |
| 5 | 0.90 | 37 | 1.2% | 1683 | 1699 | 56.8% |
| 5 | 0.95 | 16 | 0.5% | 2177 | 2193 | 73.3% |

### LOVO broken out by confidence: all rows vs high-confidence only

All rows:

| minN | minW | goal-2 leaks | leak % | goal-1 errors | over-tight | over-tight % |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 89 | 1.6% | 1936 | 1985 | 36.3% |
| 2 | 0.90 | 68 | 1.2% | 2233 | 2282 | 41.8% |
| 2 | 0.95 | 41 | 0.8% | 2963 | 3012 | 55.1% |
| 3 | 0.80 | 80 | 1.5% | 2067 | 2116 | 38.7% |
| 3 | 0.90 | 59 | 1.1% | 2361 | 2410 | 44.1% |
| 3 | 0.95 | 33 | 0.6% | 3083 | 3132 | 57.3% |
| 5 | 0.80 | 76 | 1.4% | 2256 | 2305 | 42.2% |
| 5 | 0.90 | 55 | 1.0% | 2546 | 2595 | 47.5% |
| 5 | 0.95 | 29 | 0.5% | 3247 | 3296 | 60.3% |

High-confidence rows only:

| minN | minW | goal-2 leaks | leak % | goal-1 errors | over-tight | over-tight % |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 34 | 0.7% | 1560 | 1607 | 35.0% |
| 2 | 0.90 | 24 | 0.5% | 1808 | 1855 | 40.5% |
| 2 | 0.95 | 15 | 0.3% | 2443 | 2490 | 54.3% |
| 3 | 0.80 | 30 | 0.7% | 1681 | 1728 | 37.7% |
| 3 | 0.90 | 20 | 0.4% | 1926 | 1973 | 43.0% |
| 3 | 0.95 | 11 | 0.2% | 2553 | 2600 | 56.7% |
| 5 | 0.80 | 29 | 0.6% | 1845 | 1892 | 41.3% |
| 5 | 0.90 | 19 | 0.4% | 2086 | 2133 | 46.5% |
| 5 | 0.95 | 10 | 0.2% | 2693 | 2740 | 59.8% |

## Top 25 head nouns most often on remaining LOVO leaks (minN=3, minW=0.90)

| noun | leak rows |
| --- | --- |
| update | 8 |
| delete | 4 |
| key | 4 |
| list | 3 |
| field | 2 |
| mapping | 2 |
| policy | 2 |
| document | 2 |
| conversation | 2 |
| setting | 2 |
| state | 2 |
| credential | 2 |
| sandbox | 1 |
| note | 1 |
| registration | 1 |
| booking | 1 |
| address | 1 |
| attribut | 1 |
| card | 1 |
| secret | 1 |
| campaign | 1 |
| application | 1 |
| associated | 1 |
| put | 1 |
| source | 1 |

## What the data supports

Best FITTED point: minN=2, minW=0.95, 2 goal-2 leaks (0.0%), 48.2% over-tight.
Same point under LOVO: 41 goal-2 leaks (0.8%) — 21x more leaks than the fitted number at the same point.
Best LOVO point outright: minN=5, minW=0.95, 29 goal-2 leaks (0.5%), 60.3% over-tight.

Two things are both true and need to be held together. First, the
fitted number genuinely collapses: the point that looks best fitted
(near-zero leaks) is the point that overfits hardest, and every
sweep point loses ground going from fitted to LOVO — the gap in the
two tables above is real overfitting, not noise, and the tightest
fitted-looking configuration should not be trusted on its own.

Second — and this is the actual test of the user's hypothesis —
every single LOVO point still beats the c15 baseline (280 leaks,
5.1%) by a wide margin: LOVO goal-2 leaks range 29-89
across all nine points. That is the opposite of what happened to the
blocklist attempts in c16-c19, where LOVO admitted ZERO transferable
third-party nouns at every corpus size tried. An allowlist of "yours"
words does appear to carry real, non-zero signal across held-out
vendors where a blocklist of "their" words carried none — but the
honest cost is steep over-tightening (35-60% of all rows over-tight
at every LOVO point), and the fitted-vs-LOVO gap means the specific
threshold cannot be picked from the fitted numbers alone.

