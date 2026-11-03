# f1-post-r-2026-11-03 — "changes" answers on the floor-post pile (F1 POC)

Tuning data only. Never an exam.

- Date: 2026-11-03.
- Source rows: `data/jev-tiers-2026-09-23/rows-lower.json.gz`: 1906 rows,
  every row of the 8376-row tuning pool (combined-2026-09-21 6557 +
  relabel-buildset-2026-09-23 1819) that `classifyRow` puts on rule
  `floor-post` (a POST with no word evidence, floored to x). 1336 of them are
  combined rows; 570 are buildset rows.
- Question: `poc/jev-tiers/criteria-changes.mjs` ("Does this operation change
  anything?"). The runner sends only method, path, operationId, summary and
  description, never truth.
- Runner: `poc/jev-tiers/run.mjs criteria-changes`, concurrency 8, model
  requested `jev-latest`.
- Model version seen: `jev-1.14.0` on all 1906 rows of both runs. The isX
  answers these are paired with (`data/jev-tiers-2026-09-23/out-lower*.jsonl`)
  are `jev-1.13.0`, so the POC pairs answers from two model versions.

| file | rows | errors | input tokens |
|---|---|---|---|
| out-changes-run1.jsonl | 1906 | 0 | 4,121,386 |
| out-changes-run2.jsonl | 1906 | 0 | 4,121,386 |

`run1.log` and `run2.log` are the runner's stderr. Scorer:
`node poc/f1-post-r/score.mjs`.
