# data/provider-corpus-2026-09-16/label — blind labelling files

## What these are

Blind labelling files for the new 15-provider corpus
(`data/provider-corpus-2026-09-16/ops.csv.gz`, 4171 rows). This corpus
has **no truth labels yet** — the labels 21 blind labellers produce here
will BECOME the corpus's truth.

## Brief

Label every row under `data/calibration-2026-09-14/BRIEF.md`. That is the
exact brief path; do not use any other version.

## Split

- Seed: 20260916 (mulberry32, one shuffle over all 4171 rows).
- 4171 rows split into 21 parts: parts 1-20 have 199 rows each, part 21 has
  191 rows (20*199 + 191 = 4171).
- Rows are shuffled across all 15 providers before splitting, so
  no labeller receives one provider's rows in a block.
- `blind-01.csv` … `blind-21.csv`: one file per labeller. Columns:
  `row_id,provider,method,path,operationId,summary,description`. No truth,
  class, confidence, part number, or classifier output.
- `key.csv`: `row_id,part,provider,method,path,operationId` — no class
  column, since there is no truth yet.

## Rules for labellers

- Open only your own `blind-NN.csv` file.
- Write only your own output file, named `labels-NN.csv` (same NN as your
  blind file), with columns `row_id,class,confidence`.
- Do not look at any other labeller's blind or output file.

## Reproduce

```
node poc/provider-corpus/make-blind.mjs
```

Deterministic: same seed (20260916), same `ops.csv.gz` -> byte-identical
output files, every run.
