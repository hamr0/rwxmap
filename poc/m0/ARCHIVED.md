# M0 — archived

M0 closed 2026-09-07 as exploratory (PRD D29). This directory is
frozen: nothing here is promoted, nothing here is edited further.

## What it contains and why it is kept

The rule variants E1-E25 (`rules*.mjs`, `exp-e25/`), the runners
(`run-*.mjs`), the hand lists (`lexicon*.json`, `verbs.json`,
`parties.json`, `destructive.json`), and 97 tests.

## Its results

The measured ceiling of prose-only rules: zero wrong loosenings on
all three sets — CAMARA, hold-out 1, and the clean exam — with
74 / 101 / 33 over-tightenings respectively (E23). E25's unpromoted
variants reach 33 / 85 / 31.

## Where the record lives

`docs/logs/learnings.md` E1-E25, `docs/logs/m0/`,
`docs/product/prd.md` §4.4-4.5 and D1-D29.

## What M1 borrows by import only

`spec-text.mjs` `loadOps`, `split.mjs`, `run-holdout.mjs` loaders, the
scorer's two-error-direction counting.

Ground truth is NOT here; it lives in `data/` and is shared by every
module.

Point to `poc/m1/` as the successor once it exists.
