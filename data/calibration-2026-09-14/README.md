# Calibration 2026-09-14

## Purpose

Check whether the calibrated brief (`BRIEF.md`) reproduces the corpus
standard, before it is used for exam 5.

## Background

Exam 3's labelling brief was lost. Exam 4's brief was reconstructed
from memory, stricter than the original, and produced truth that came
out twice as x-heavy as exam 3's (2109 shared rows, joined on
provider|method|path|operationId: w->w 1541, x->x 242, w->x 272,
x->w 33, r->r 16, and 5 rows marked '?' on exam 3). The
2026-09-12 calibration, labelled under exam 4's (reconstructed,
stricter) brief, scored 89% agreement with exam 3 truth on 200 random
rows (21 flipped w->x, 2 flipped x->w against exam 3).

`BRIEF.md` in this directory was written afterward, by reading the
2109 shared rows and the 305 where the two briefs disagreed, to try to
land closer to exam 3's original standard than the reconstructed
brief did.

## Files

- `BRIEF.md` — the calibrated labelling brief, to be used verbatim by
  both blind labellers.
- `calibA-blind.csv` — 200 random exam-3 rows. This is the same sample
  as `data/calibration-2026-09-12/calib-blind.csv`, byte-for-byte, so
  its score under `BRIEF.md` is directly comparable to that run's 89%.
- `calibB-blind.csv` — 150 of the 305 exam3/exam4 drift rows, drawn
  with seed 20260914 by `poc/exam/make-calib5.mjs`.
- `calibB-key.csv` — both old labels (exam 3 and exam 4, class and
  confidence) for sample B's 150 rows. Labellers must never open this
  file.
- `calibA-labels.csv`, `calibB-labels.csv` — written 2026-09-14 by two
  blind labellers working from `BRIEF.md`.

## How to reproduce

```
node poc/exam/make-calib5.mjs
```

Deterministic: same seed (20260914), same exam-3/exam-4 inputs, same
output bytes every run.

## Scoring

Score each sample's labels against exam 3 truth
(`data/exam3-2026-09-11/exam-truth-part*.csv`, keyed by row_id):

- Sample A: agreement with exam 3 truth. The bar is at least the 89%
  the reconstructed brief scored on the same 200 rows, with fewer
  w->x flips than that run's 21.
- Sample B: these are exactly the rows where exam 3 and exam 4
  disagreed, so score is a majority of the 150 rows landing on the
  exam 3 label rather than the exam 4 label — evidence that
  `BRIEF.md` pulls labelling back toward the original corpus
  standard rather than the reconstructed one.

## Status

Labelling run 2026-09-14, one blind mid-tier labeller per sample.
Sample A: 185/200 (92.5%) agree with exam 3 truth (old brief 177/200,
88.5%, on the same rows; w->x flips 21 -> 5, x->w flips 2 -> 10).
Sample B: 123/150 (82.0%) land on the exam 3 label. Full results and
remaining misses are in `docs/logs/learnings.md` under "Calibrated
labelling brief, first measure (2026-09-14)". `BRIEF.md` is not yet
adopted for exam 5 — four fixes are pending the user.
