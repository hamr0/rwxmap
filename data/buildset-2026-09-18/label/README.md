# data/buildset-2026-09-18/label — blind labelling files

## What these are

Blind labelling files for the write-heavy BUILD SET corpus
(`data/buildset-2026-09-18/ops.csv.gz`, 1819 rows across 13
apis-guru vendors). This corpus has **no truth labels** — the labels 9
blind labellers produce here will BECOME its truth.

**This is a build/tuning set for MINING word lists. It is NEVER an exam.**
The ten locked exam vendors — auth0, cloudflare, hubspot, zendesk,
pagerduty, dropbox, shopify, linear, miro, sentry — are named in
`docs/logs/pre-registered-split-2026-09-18.md` and none of them appears
here. Nobody opens, reads, or mines the exam vendors until a fresh exam is
drawn from official complete specs.

These files carry no r/w/x information of any kind. The frozen
classifier's predictions for these rows exist elsewhere in the repo and
are never read, joined or hinted at here: a labeller must not be able to
see what the tool guessed.

## Brief

Label every row under `data/calibration-2026-09-14/BRIEF.md`. That is the exact brief path; no
other version of the brief may be used.

## Split

- Seed: 20260918 (mulberry32, one shuffle over all 1819 rows).
- 1819 rows split into 9 parts: parts 1-8 have 202 rows each,
  part 9 has 203 rows (8*202 + 203 = 1819).
- Rows are shuffled across all 13 vendors before splitting, so no
  labeller receives one vendor's rows in a block.
- `blind-1.csv` … `blind-9.csv`: one file per labeller, single-digit
  naming. Columns: `row_id,provider,method,path,operationId,summary,description`.
  No truth, class, confidence, part number, or classifier output.
- `key.csv`: `row_id,part,provider,method,path,operationId` — no class
  column, since there is no truth yet.
- Row ids run `b0001`..`b1819`, assigned in `ops.csv` order before the
  shuffle. The `b` prefix is deliberate, so a build-set row id can never be
  confused with a 15-provider-corpus `rNNNN` id or the exam's `eNNNN` id.

## Rules for labellers

- Open only your own `blind-N.csv` file.
- Write only your own output file, named `labels-N.csv` (same N as your
  blind file), and use your own uniquely-named scratch files — never a name
  another labeller might also use.
- Output columns are exactly `row_id,truth_class,confidence,reason`, as the
  brief specifies: `truth_class` is r, w, x or ?; `confidence` is EXACTLY
  `high` or `low` (there is no medium, and any other value means the file
  is rejected); `reason` is a short phrase under 15 words with no commas
  (or the whole reason double-quoted) naming the rule or road applied. One
  line per input row, same order, no rows skipped, no extras.
- Do not look at any other labeller's blind or output file.

## Reproduce

```
node tools/make-buildset-blind.js
```

Deterministic: same seed (20260918), same `ops.csv.gz` -> byte-identical
output files, every run.
