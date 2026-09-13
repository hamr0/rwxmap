# rwxmap row-level proof

## What this is

Row-level proof of every goal's current number: every truth-x, truth-w and
truth-r row, with its predicted class and verdict, next to what the
previously frozen shape would have predicted for the same row. Regenerate
with `node poc/m1/run/proof.mjs`.

## Corpus

5465 rows, 332 vendors. Truth split: r=646, w=3883, x=936.
Scored leave-one-vendor-out (each row scored against an allowlist built
from every OTHER vendor's rows). Allowlist bar: n>=2, w-share>=0.80.
Run date: 2026-09-13.

## Ledger

| goal | error | previous frozen | current | delta |
|---|---|---|---|---|
| goal 2 | leak (truth x, predicted w) | 89 | 37 | -52 |
| goal 1 | false alarm (truth w, predicted x) | 1936 | 2531 | 595 |
| goal 3 | over-tight (truth r, predicted not r) | 49 | 49 | 0 |

## How to read a CSV

- `set` — which labelled set the row came from.
- `vendor` — the API provider, leave-one-vendor-out unit.
- `method` — the HTTP method of the operation.
- `operationId` — the operation's id, as named in its spec.
- `path` — the operation's URL path template.
- `summary` — the operation's summary text, newlines flattened to spaces, truncated to 160 characters.
- `truth` — the ground-truth class (r/w/x) for this row.
- `predicted` — the class the current shape (classifyGoal2) assigns.
- `rule` — which rule inside the current shape fired.
- `floor` — true when no evidence fired and the row sits at its method's default class; the tool would flag a floor row for review.
- `verdict` — this goal's error label if this row is wrong, else `ok`. A `LEAK` is a safety cost (a wrong loosening). A `FALSE-ALARM` or `OVER-TIGHT` is a usability cost (a wrong tightening).
- `previous_predicted` / `previous_verdict` — the same two columns, but from the previously frozen shape (classifyC20 + c15), for comparison.

Note on goal2.csv specifically: a truth-x row predicted `r` is an even
further loosening than predicted `w`, so it is also marked `LEAK` in the
`verdict` column (13 such rows here, present under both the
current and the previous shape — all GET rows sitting at the GET floor,
unchanged by this pass, not a regression). The ledger's goal-2 number above stays the
frozen strict definition (predicted `w` only), matching the number already
committed to the repo.

## Per-goal breakdown

### goal2.csv — truth x (936 rows)

- error count (predicted w, ledger definition): 37 (4.0%)
- also marked LEAK in the table (predicted r, not in the ledger count): 13
- errors by method: DELETE=18, PUT=14, PATCH=5
- errors that are floor rows: 37
- distinct vendors among the errors: 27

### goal1.csv — truth w (3883 rows)

- error count (false alarms): 2531 (65.2%)
- errors by method: DELETE=1135, PUT=942, PATCH=351, POST=103
- errors that are floor rows: 103
- distinct vendors among the errors: 292

### goal3.csv — truth r (646 rows)

- error count (over-tight): 49 (7.6%)
- errors by method: POST=24, PUT=14, PATCH=6, DELETE=5
- errors that are floor rows: 32
- distinct vendors among the errors: 13

## Shape

- floor by method: GET/HEAD/OPTIONS -> r, POST -> x, PUT/DELETE/PATCH -> w.
- verbs: a POST read-verb lowers to r; a PUT/DELETE/PATCH live-verb raises to x.
- yours-nouns: on a raise-only method left at the w floor, every extracted noun on the vendor's leave-one-vendor-out allowlist keeps it at w, otherwise it raises to x ("no-own-noun").

Full spec: `docs/product/goal2-solution.md`.
