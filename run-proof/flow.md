# rwxmap row-level proof

This is the row-by-row proof of poc/flow's classifier: every one of the
5465 corpus rows, run through `classifyRow`, with its truth class, the
step/rule/flag that decided it, and its verdict against truth. Regenerate
with `node poc/flow/proof.mjs`.

## Corpus

5465 rows, 332 vendors. Truth split: r 646 (11.8%), w 3883 (71.1%), x 936 (17.1%). Leave-one-vendor-out. Mining bars: other-party nouns admitted at >= 2 vendors and x-share >= 0.3 over PUT/DELETE/PATCH; yours nouns admitted at n >= 2 and w-share >= 0.8 over write rows (every method but GET/HEAD/OPTIONS). Run date: 2026-09-14.

## How the flow runs

- Step 1, r: every GET/HEAD/OPTIONS row is r; a POST whose lead verb is a read verb is r.
- Step 2, w: PUT/DELETE/PATCH rows start at w — a live verb raises to x, an other-party noun raises to x, every noun on the row being a "yours" noun keeps it w flagged "evidence", otherwise it stays w flagged "x-pile".
- Step 3, x: whatever step 1 and step 2 leave behind (POST with no read verb) floors to x.

## Ledger

| step | error | count | pin |
| --- | --- | --- | ---: |
| step 1 | over-tight | 49 | 49 |
| step 1 | leaks (read-verb rule) | 0 | 0 |
| GET floor | leaks (parked D59, charged to the floor) | 17 | 17 |
| step 2 | false alarms | 803 | 803 |
| step 2 | leaks | 211 | 211 |
| step 2 | x-pile rows | 1998 | 1998 |
| step 2 | x-pile leaks | 179 | 179 |
| whole flow | exact | 4282 (78.4%) | 4282 (78.4%) |
| whole flow | leaks | 228 (4.2%) | 228 (4.2%) |
| whole flow | over-tight | 955 (17.5%) | 955 (17.5%) |

## Per method

| method | n | leaks | over-tight |
| --- | ---: | ---: | ---: |
| GET | 550 | 17 | 0 |
| POST | 509 | 0 | 127 |
| PUT | 1696 | 93 | 305 |
| DELETE | 2079 | 76 | 424 |
| PATCH | 631 | 42 | 99 |

## Where the rows sit

| step | class | flag | rows | truth r | truth w | truth x |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | r | (none) | 614 | 597 | 4 | 13 |
| 2 | w | evidence | 1211 | 3 | 1176 | 32 |
| 2 | w | x-pile | 1998 | 22 | 1797 | 179 |
| 3 | x | (none) | 1642 | 24 | 906 | 712 |

## Why a row sits in the x-pile

Every x-pile row gets ONE reason: 'no noun' when the row carries no noun at
all; otherwise, among the row's nouns not already admitted as "yours" for
its vendor, the strongest reason wins ('between bars' beats 'too few rows'
beats 'vendor-only') — 'vendor-only' means no other vendor ever wrote that
noun on a write row (n=0), 'too few rows' means fewer than 2 other-vendor
write rows carried it (n<2), 'between bars' means it had enough other-vendor
rows but its w-share fell short of 0.8.

| reason | rows | truth r | truth w | truth x | share of pile |
| --- | ---: | ---: | ---: | ---: | ---: |
| between bars | 1072 | 11 | 933 | 128 | 53.7% |
| too few rows | 240 | 4 | 220 | 16 | 12.0% |
| vendor-only | 670 | 7 | 628 | 35 | 33.5% |
| no noun | 16 | 0 | 16 | 0 | 0.8% |
| **total** | **1998** | 22 | 1797 | 179 | 100.0% |

## CSV columns (run-proof/flow.csv)

- `set`: which labelled set the row comes from (camara, holdout1..5, exam2, exam3).
- `vendor`: the vendor/repo the row belongs to.
- `method`: the HTTP method.
- `path`: the operation's path.
- `operationId`: the operation's id, as given.
- `summary`: the operation's summary, flattened to one line and truncated to 160 chars.
- `truth`: the labelled ground-truth class (r/w/x).
- `step`: which flow step decided the row (1, 2, or 3).
- `class`: the class the flow assigned (r/w/x).
- `rule`: the rule within that step that fired.
- `flag`: the flag the rule left (`evidence`, `x-pile`, or empty).
- `verdict`: `ok`, `LEAK`, `FALSE-ALARM`, or `OVER-TIGHT` against truth.
- `reason`: for x-pile rows, why the row sits there (`no noun`, `vendor-only`, `too few rows`, `between bars`); empty for every other row.

## Pins

All pins hold.
