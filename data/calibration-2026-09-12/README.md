# Calibration — exam 4 brief drift (2026-09-12)

Purpose: measure how much exam 4's reconstructed labelling brief
drifted from the standard used for exams 1-3, by relabelling known
rows under the new brief.

## Sample

200 rows drawn from `data/exam3-2026-09-11/exam-blind.csv` with a
mulberry32 PRNG, seed 20260913. Method mix: DELETE 96, PUT 73,
PATCH 31. The draw was done inline by the orchestrator, not by a
committed script — note this as a reproducibility gap.

## Files

- `calib-blind.csv` — the 200-row sample.
- `calib-labels-new-brief.csv` — one blind agent's labels on that
  sample under exam 4's brief (r=1, w=141, x=58; high=132, low=68).

The old-standard labels for these same rows live in
`data/exam3-2026-09-11/exam-truth-part*.csv`, keyed by row_id.

## Result

177 of 200 rows agree (89%). Confusion old -> new:
w->w 150, x->x 26, w->x 21, x->w 2, r->r 1.

Flip rates: old w -> new x is 21/171 = 12.3%; old x -> new w is
2/28 = 7.1%. Of rows the new brief called x, 26 of 47 (55.3%) were
also x under the old standard. x-share on these rows moved
14.0% -> 23.5%.

Same 200 rows, same classifier, truth swapped: c15+C20 leaks 3
under stored truth vs 11 under new-brief truth (factor 3.67x); c15
alone 8 vs 21 (2.63x).

Corrected estimates for exam 4's measured 9.1% goal-2 leak rate:
2.5% by the leak-ratio estimator (based on only 3 leaks, too thin
to trust) and 5.0% by the surviving-x-rows estimator (based on 47
rows, sturdier). The corpus LOVO prediction is 1.6%.

## Status

200 rows is a small calibration; whether to enlarge it or relabel
exam 4 outright was an open question at the time of writing.
