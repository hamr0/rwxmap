# data/jev-2026-09-22 — D87 floor-post rows for Jev

## What this is

`rows-floor.json.gz` — every row of `data/combined-2026-09-21/rows.json.gz`
that the D87 flow (`poc/d87/flow.mjs`) sends to step 2's named leftover
pile, rule `floor-post`: a POST with no word evidence anywhere in the
ladder, currently floored at `x`. This POC measures whether Jev can
safely LOWER some of that pile to `w`.

Each row carries only `row_id, provider, method, path, operationId,
summary, description`. No truth, no confidence, no tool class — Jev
must not see the answer, and the mining that follows must not fit to
it either.

## Criteria

Criteria come only from `data/relabel-2026-09-22/BRIEF-v3.md` (the
D87 definition, adopted 2026-09-22). Nothing here is derived from any
label, key, ruling or truth file. See `poc/jev-d87/criteria.mjs` for
the transcription.

## Raw Jev responses

`out-floor.jsonl.gz` — the real run against all 1336 rows, model
jev-1.13.0, 0 errors, 2630945 input tokens, about $0.11. Raw Jev API
responses (`out*.jsonl`) are kept here gzipped once a real run has
been made — they cost money to produce, so re-running them spends the
cost again. This POC's harness (`poc/jev-d87/run.mjs`) is not to be
run against the real endpoint by an agent — only the orchestrator
runs it.

## Harness

`poc/jev-d87/`:

- `criteria.mjs` — the criteria (transcribed from BRIEF-v3.md).
- `make-rows.mjs` — builds `rows-floor.json(.gz)`.
- `run.mjs` — the runner.
- `score.mjs` — scores a run: fitted thresholds, LOVO, leak list,
  calibration table.
