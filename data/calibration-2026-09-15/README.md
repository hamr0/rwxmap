# data/calibration-2026-09-15 — POST calibration

## Purpose

Exam 5's POST rows scored badly, but the labelling brief's POST guidance
(`data/calibration-2026-09-14/BRIEF.md`, "Methods" paragraph) was never
checked against the corpus's own POST truth. This prepares blind files so
labellers can label the corpus's POST rows under the brief, to be compared
with corpus truth. A third is held back unlabelled, so a fixed brief can
later be checked once on rows it has not seen.

## Counts (this run)

- Total corpus POST rows: 509
- Measure (about 2/3, split across two labelling parts): 339
  - Part 1: 170
  - Part 2: 169
- Holdback (about 1/3, unlabelled for now): 170
- Seed: 20260916

## Per-vendor split

| vendor | n | measure | holdback |
|---|---|---|---|
| adyen | 23 | 15 | 8 |
| amazon | 43 | 29 | 14 |
| box | 24 | 16 | 8 |
| camara | 138 | 92 | 46 |
| cloudflare | 13 | 9 | 4 |
| discord | 13 | 9 | 4 |
| linode | 24 | 16 | 8 |
| notion | 6 | 4 | 2 |
| pagerduty | 20 | 13 | 7 |
| sentry | 11 | 7 | 4 |
| slack | 94 | 63 | 31 |
| twilio | 62 | 41 | 21 |
| vercel | 24 | 16 | 8 |
| x | 14 | 9 | 5 |

## Files

- `postcal-blind-part1.csv`, `postcal-blind-part2.csv`: blind rows to label
  under `data/calibration-2026-09-14/BRIEF.md`. Columns: row_id, provider,
  method, path, operationId, summary, description. No truth, set, or
  confidence columns.
- `postcal-holdback-blind.csv`: same columns, holdback rows. Not to be
  labelled now — held back for a single later check of a revised brief.
- `postcal-key.csv`: row_id, corpus_index, set, vendor, method, path,
  operationId, split. No gt_class — truth is read from the corpus at score
  time via corpus_index.
- Labellers will produce `postcal-labels-part1.csv` and
  `postcal-labels-part2.csv` under this same directory.

## Reproduce

```
node poc/exam/make-postcal.mjs
```

Deterministic: same seed (20260916), same corpus -> same output files, every
run (byte-identical).

## Pre-registered reading (fixed before labelling)

Reading, fixed before labelling: if the brief agrees with corpus truth on
the measure rows at about the write-row rate (185 of 200, 92.5%) and calls
a similar share of rows x, the POST drop on exam 5 belongs to the tool. If
the brief calls clearly fewer rows x than corpus truth, the brief is loose
on POST and exam 5's POST score is not trustworthy until the brief is
fixed and checked once on the holdback.
