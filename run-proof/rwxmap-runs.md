# rwxmap row-level proof

## What this is

Row-level proof of every step's current number: every truth-x, truth-w and
truth-r row, with its predicted class and verdict, next to what the
previously frozen shape would have predicted for the same row. Regenerate
with `node poc/m1/run/proof.mjs`.

## Corpus

5465 rows, 332 vendors. Truth split: r=646, w=3883, x=936.
Scored leave-one-vendor-out (each row scored against an allowlist built
from every OTHER vendor's rows). Allowlist bar: n>=2, w-share>=0.80.
Run date: 2026-09-13.

## Ledger

| step | error | previous frozen | current | delta |
|---|---|---|---|---|
| step 1 | over-tight (truth r, predicted not r) | 49 | 49 | 0 |
| step 2 | false alarm (truth w, predicted x) | 1936 | 803 | -1133 |
| step 3 | leak (truth x, predicted w) | 89 | 37 | -52 |
| step 2 (info) | leak (truth x, predicted w, step 2's own classifier) | 89 | 211 | 122 |

## How to read a CSV

- `set` — which labelled set the row came from.
- `vendor` — the API provider, leave-one-vendor-out unit.
- `method` — the HTTP method of the operation.
- `operationId` — the operation's id, as named in its spec.
- `path` — the operation's URL path template.
- `summary` — the operation's summary text, newlines flattened to spaces, truncated to 160 characters.
- `truth` — the ground-truth class (r/w/x) for this row.
- `predicted` — the class the current shape (classifyStep3) assigns.
- `rule` — which rule inside the current shape fired.
- `floor` — true when no evidence fired and the row sits at its method's default class; the tool would flag a floor row for review.
- `verdict` — this step's error label if this row is wrong, else `ok`. A `LEAK` is a safety cost (a wrong loosening). A `FALSE-ALARM` or `OVER-TIGHT` is a usability cost (a wrong tightening).
- `previous_predicted` / `previous_verdict` — the same two columns, but from the previously frozen shape (classifyC20 + c15), for comparison.

Note on step3.csv specifically: a truth-x row predicted `r` is an even
further loosening than predicted `w`, so it is also marked `LEAK` in the
`verdict` column (13 such rows here, present under both the
current and the previous shape — all GET rows sitting at the GET floor,
unchanged by this pass, not a regression). The ledger's step-3 number above stays the
frozen strict definition (predicted `w` only), matching the number already
committed to the repo.

## Per-step breakdown

### step3.csv — truth x (936 rows)

- error count (predicted w, ledger definition): 37 (4.0%)
- also marked LEAK in the table (predicted r, not in the ledger count): 13
- errors by method: DELETE=18, PUT=14, PATCH=5
- errors that are floor rows: 37
- distinct vendors among the errors: 27

### step2.csv — truth w, PUT/DELETE/PATCH only (3776 of 3883 truth-w rows)

Step 2 is a standalone classifier (its own live-verb list, then its own
other-party noun list), scored only on the methods it classifies — a
truth-w POST/GET/HEAD/OPTIONS row is excluded here, since step 2 never
touches it (classifyStep2 returns that row's untouched method floor).

- error count (false alarms): 803 (21.3%)
- errors by method: DELETE=419, PUT=291, PATCH=93
- errors that are floor rows: 0
- distinct vendors among the errors: 203

### step2-leaks.csv — truth x, PUT/DELETE/PATCH only (605 rows)

Step 2's other ledger number: truth-x rows its own classifier predicts w.

- error count (leaks): 211 (34.9%)
- errors by method: PUT=93, DELETE=76, PATCH=42
- errors that are floor rows: 211
- distinct vendors among the errors: 92

### step1.csv — truth r (646 rows)

- error count (over-tight): 49 (7.6%)
- errors by method: POST=24, PUT=14, PATCH=6, DELETE=5
- errors that are floor rows: 32
- distinct vendors among the errors: 13

## Shape

- floor by method: GET/HEAD/OPTIONS -> r, POST -> x, PUT/DELETE/PATCH -> w.
- verbs: a POST read-verb lowers to r; a PUT/DELETE/PATCH live-verb raises to x.
- yours-nouns: on a raise-only method left at the w floor, every extracted noun on the vendor's leave-one-vendor-out allowlist keeps it at w, otherwise it raises to x ("no-own-noun").

Full spec: `docs/product/goal2-solution.md`.
