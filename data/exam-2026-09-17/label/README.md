# data/exam-2026-09-17/label — blind labelling files

## What these are

Blind labelling files for the clean exam corpus
(`data/exam-2026-09-17/ops.csv.gz`, 1383 rows across okta, docusign and
xero). This corpus has **no truth labels** — the labels 7 blind labellers
produce here will BECOME its truth.

These files carry no r/w/x information of any kind. The frozen
classifier's predictions for these rows exist elsewhere in the repo and
are never read, joined or hinted at here: a labeller must not be able to
see what the tool guessed.

## Brief

Label every row under `data/calibration-2026-09-14/BRIEF.md`. That is the exact brief path; no
other version of the brief may be used.

## Split

- Seed: 20260917 (mulberry32, one shuffle over all 1383 rows).
- 1383 rows split into 7 parts: parts 1-6 have 198 rows each,
  part 7 has 195 rows (6*198 + 195 = 1383).
- Rows are shuffled across all 3 providers before splitting, so no
  labeller receives one provider's rows in a block.
- `blind-1.csv` … `blind-7.csv`: one file per labeller, single-digit
  naming. Columns: `row_id,provider,method,path,operationId,summary,description`.
  No truth, class, confidence, part number, or classifier output.
- `key.csv`: `row_id,part,provider,method,path,operationId` — no class
  column, since there is no truth yet.
- Row ids run `e0001`..`e1383`, assigned in `ops.csv` order before the
  shuffle. The `e` prefix is deliberate, so an exam row id can never be
  confused with a 15-provider-corpus `rNNNN` id.

## Rules for labellers

- Open only your own `blind-N.csv` file.
- Write only your own output file, named `labels-N.csv` (same N as your
  blind file).
- Output columns are exactly `row_id,truth_class,confidence,reason`, as the
  brief specifies: `truth_class` is r, w, x or ?; `confidence` is EXACTLY
  `high` or `low` (there is no medium, and any other value means the file
  is rejected); `reason` is a short phrase under 15 words with no commas
  (or the whole reason double-quoted) naming the rule or road applied. One
  line per input row, same order, no rows skipped, no extras.
- Do not look at any other labeller's blind or output file.

## Stated limits of this exam

**xero has no description text at all.** 0 of its 235 rows carry a
`description`, and 231 of 235 carry a `summary`. The brief leans heavily
on description text — most of its roads ask what the text *says* about
reach — so xero rows have to be judged from summary, path and
operationId alone. Expect to mark more xero rows low-confidence than
okta or docusign rows. That is the correct behaviour on thin evidence,
not a failure of the labeller and not a reason to guess high.

xero was kept in this exam deliberately rather than dropped. Dropping the
one provider whose text is thin would be choosing the exam to flatter the
tool, and the exam exists precisely to avoid that.

For contrast, the other two providers are text-rich: docusign has 403 of
414 summaries and 387 of 414 descriptions; okta has 734 of 734 of each.

## Reproduce

```
node tools/make-exam-blind.js
```

Deterministic: same seed (20260917), same `ops.csv.gz` -> byte-identical
output files, every run.
