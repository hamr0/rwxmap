# M1 — archived

M1's home was 2026-09-07 to 2026-09-14. Frozen 2026-09-14 (D65): this
directory is frozen, nothing here is edited further.

## What it contains and why it is kept

The arbiter passes `arbiter/c2.mjs` through `c26.mjs`, the verb/noun
`judge`, the field `census`, the `corpus` builder (APIs.guru), and the
`core`/`step1`/`step2`/`step3`/`run` shape that `poc/flow/` replaced —
floor -> step 1 (r) -> step 2 (w) -> step 3 (x).

## Its last measured numbers

Step 1: 49 over-tight / 0 leaks. Step 2: 803 false alarms / 211
leaks (frozen, D63). Step 3, the yours-only lens: 37 leaks / 2727
false alarms, frozen 2026-09-12 (D54); the previous frozen shape
(c15+c20) was 89 leaks / 1936 false alarms.

## Successor

`poc/flow/` (D65). Classes proven identical to this code on all 5465
rows at commit `dc01be0` before the switch.

## Running this code

Relative imports here (to `../../m0` and the data paths) no longer
resolve from this location — the directory moved but its imports did
not change. To run anything in it, check out commit `dc01be0` or
earlier, where it still lived at `poc/m1/`.

## Where the record lives

`docs/logs/learnings.md`, `docs/product/prd.md`, `docs/wiki/decisions-log.md`
D30-D65.
