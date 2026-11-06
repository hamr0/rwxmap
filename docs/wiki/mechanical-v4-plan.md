# Mechanical v4 plan (D137 alignment)

## Why

D137 (truth v4) widened x. Against v4 truth the current mechanical (v3 code) is 81.8% exact / 5.2% too loose / 13.0% too tight on six complete sets, 16,486 ops (against v3 truth: 80.9 / 0.9 / 18.1). The truth shifted per method but the floors and lists did not move. 682 of the 861 leaks are PUT/PATCH rows decided by the method floor. Rebuilding the per-method floors and lists against v4 truth is the fix.

## How we run it (user rulings 2026-11-06)

- v3 stays intact in src/ (shipped, frozen). v4 is a parallel copy of the same code in poc/, changing only what is inside, until it is clean against v4 truth. It imports nothing from src/ (copy what is used, with its own tests). First step proves the copy is byte-identical to v3 before anything changes. When clean: new D-number, exam #5, then v3 is archived.
- Start from the method floor, then one extraction pass per method. Each floor and each pass is standalone, with its own word lists and its own ledger.
- "Extraction pass" is the name for these per-method passes; "second pass" stays the name for rwxlite in mode a.
- Too loose is counted in two buckets: loose-1 (one step: x read as w, w read as r) and loose-2 (two steps: x read as r), plus too tight, each separately; a w grant is less common than r, so the two are not equated. Ledger only for now; any new published marker value is a later decision.
- POST floor stays x (ruling): on the 3,586 no-word POST rows under v4 truth (r 253 / w 1,795 / x 1,538), floor x gives 1,538 exact, 2,048 too tight, 0 too loose; floor w would give 1,795 exact, 1,538 too loose, 253 too tight. A w floor breaks the invariant (on doubt, the tighter class). POST's pass pulls w and r out by evidence.
- Bar (ruling): a candidate (word or rule) is adopted only if under leave-one-vendor-out it fires on truth-x rows more often than on truth-w rows (D100 tighten rule). For a pass that lowers a class (x to w, w to r), the D100 loosening rule applies: adopt only above 10 right lowerings per new leak. A pass is GO if it closes at least 1 point of its method's leaks and too tight rises by less than the leaks it closes. NO-GO: the method keeps v3 behaviour and its leaks are left to rwxlite (mode a), provided the marker is right.
- If everything fails: keep mechanical as it is and let rwxlite correct the gap; 849 of the 861 leaks already carry the loose marker; the 12 unflagged are AWS-style action GETs (two steps loose).
- Marker rule (ruling 2026-11-06, v4 copy only): every PUT, PATCH and POST row is marked by which way it could be wrong: class x is tight, class w or r is loose. GET, HEAD, QUERY and DELETE are settled. The second-pass overrides are unchanged. Against the old rule this only moves the 65 PUT/PATCH rows that a word raised to x from settled to tight; it is what lets rwxlite (mode a) and a reviewer see the rows step 2 raises. User's reason: a marker by direction is more honest and makes rows easy to spot and prioritise, especially on the loose end.
- Settled means (ruling 2026-11-06, v4 copy only): the method alone decides the class with near certainty, so the row is not flagged and is never sent to the second pass. Under the marker rule that is every GET, HEAD and QUERY row (class r; GET is 99.8% r under v4 truth, 6,271 of 6,283) and every DELETE row (class x; 98.5% x, 2,517 of 2,556). A write method (PUT, PATCH, POST) is never settled. Settled is not a promise the row is right: on the six sets 12 GET rows (truth x or w) and 39 DELETE rows (truth w or r) are settled and wrong; steps 4 and 5 target them.
- Partial matching (ruling 2026-11-06): path words match by stem (stemMatches) or anywhere inside a token (substring scan), so registrycredentials matches credential. Jaccard was considered and not used (it needs a fitted cut-off and cannot name the matched word).
- Rules grow (ruling 2026-11-06): each observation becomes a rule with its own named word list, adopted when it passes its bar. Lists are expected to gain words later as evidence appears; whatever the words miss is left for rwxlite (mode a) to correct, which the markers make visible.
- Second word (ruling 2026-11-06): a word that fails alone can be rescued by a second word that marks the exception (a veto). Only veto words with x rows at two or more vendors are kept; single-vendor veto words do nothing under leave-one-vendor-out.

## The two tables (current code, six sets, 16,486 ops; HEAD 2 rows omitted)

v3 truth:

| method | n | truth r | truth w | truth x | floor | exact | too loose | too tight |
|---|---|---|---|---|---|---|---|---|
| GET | 6283 | 6271 (99.8%) | 8 (0.1%) | 4 (0.1%) | r | 6271 (99.8%) | 12 (0.2%) | 0 |
| POST | 4653 | 431 (9.3%) | 3197 (68.7%) | 1025 (22.0%) | x | 1703 (36.6%) | 36 (0.8%) | 2914 (62.6%) |
| DELETE | 2556 | 4 (0.2%) | 42 (1.6%) | 2510 (98.2%) | x | 2510 (98.2%) | 0 | 46 (1.8%) |
| PUT | 1956 | 3 (0.2%) | 1833 (93.7%) | 120 (6.1%) | w | 1847 (94.4%) | 86 (4.4%) | 23 (1.2%) |
| PATCH | 1036 | 0 | 1011 (97.6%) | 25 (2.4%) | w | 1006 (97.1%) | 22 (2.1%) | 8 (0.8%) |

v4 truth:

| method | n | truth r | truth w | truth x | floor | exact | too loose | too tight |
|---|---|---|---|---|---|---|---|---|
| GET | 6283 | 6271 (99.8%) | 3 (0.0%) | 9 (0.1%) | r | 6271 (99.8%) | 12 (0.2%) | 0 |
| POST | 4653 | 431 (9.3%) | 2233 (48.0%) | 1989 (42.7%) | x | 2405 (51.7%) | 167 (3.6%) | 2081 (44.7%) |
| DELETE | 2556 | 4 (0.2%) | 35 (1.4%) | 2517 (98.5%) | x | 2517 (98.5%) | 0 | 39 (1.5%) |
| PUT | 1956 | 3 (0.2%) | 1435 (73.4%) | 518 (26.5%) | w | 1467 (75.0%) | 475 (24.3%) | 14 (0.7%) |
| PATCH | 1036 | 0 | 825 (79.6%) | 211 (20.4%) | w | 822 (79.3%) | 207 (20.0%) | 7 (0.7%) |

## User analysis, corrected

v3 leanings: GET r 99.8 / w 0.1 / x 0.1; POST r 9.3 / w 68.7 / x 22.0; DELETE r 0.2 / w 1.6 / x 98.2; PUT r 0.2 / w 93.7 / x 6.1; PATCH r 0 / w 97.6 / x 2.4.

v4 leanings: GET r 99.8 / w 0.0 / x 0.1; POST r 9.3 / w 48.0 / x 42.7; DELETE r 0.2 / w 1.4 / x 98.5; PUT r 0.2 / w 73.4 / x 26.5; PATCH r 0 / w 79.6 / x 20.4.

The user's first layout put POST on a w floor; corrected (ruling above) to x. PATCH added to the x-extraction pass (20.4% x). Corrected layout:

| floor | methods | extraction pass |
|---|---|---|
| r | GET, QUERY (D134), HEAD | pull out x, then w (AWS-style action GETs: 12 leaks, all unflagged) |
| w | PUT, PATCH | pull out x (PUT 518 x of 1,956; PATCH 211 of 1,036; 682 leaks) |
| x | DELETE, POST | DELETE: pull out w for trash/restore (35 w of 2,556; 39 too tight). POST: pull out w and r (2,233 w and 431 r of 4,653; KEEP_W today pulls 570 rows to w, 162 of them truth x) |

## Steps

| # | Step | Status |
|---|---|---|
| 0 | Rulings above | done 2026-11-06 |
| 1 | Copy v3 core to poc (parallel v4), prove byte-identical output on the 16,486 rows | done 2026-11-06 (poc/mech-v4/, proof 0 differences) |
| 2 | PUT/PATCH x-extraction (682 leaks) | done 2026-11-06 (path-x-word rule + marker rule in poc/mech-v4/; LOVO 360 closed / 120 new too tight) |
| 3 | POST w/r-extraction, re-tune KEEP_W (162 leaks, 2,081 too tight) | done 2026-11-06 (A: path-x-word on POST; B: content-noun + veto; LOVO B 233 right / 15 leaks) |
| 4 | GET x-extraction (12 unflagged two-step leaks; overlaps the parked GET-twin POC) | not started |
| 5 | DELETE w-extraction (39 too tight) | not started |
| 6 | D-number, exam #5 (truth-v4-plan step 7), archive v3 | not started |

Each step: candidates fixed before measuring; one learnings entry per step before the next starts.

## Rules

- The six sets are tuning sets under v4 (exam3, exam4, exam-2026-09-22 and rwxlite-fresh are burned exams, usable as tuning, D24). Exam #5 scores v4 once.
- Leave-one-vendor-out is the only number quoted for a candidate.
- No word dropped from a v3 list without measuring and the user's approval.
