# data/exam-2026-09-20/label — blind labelling files

## What these are

Blind labelling files for the CLEAN EXAM corpus
(`data/exam-2026-09-20/ops.csv`, 1003 rows across 5
never-seen vendors: auth0, hubspot, zendesk, klaviyo, miro). Write
methods only — POST, PUT, PATCH, DELETE, no GET. This corpus has **no
truth labels** — the labels 9 blind labellers produce here will BECOME
its truth.

**This is a CLEAN EXAM. It is scored ONCE and burned afterwards (D24).**
It is never used to pick, tune or re-score a rule shape: a rule change
from here needs a fresh exam, never a re-score of this one.

**cloudflare, pagerduty and sentry are burned by vendor name and must
never be added to this exam**, now or in any later draw from it.

These files carry no r/w/x information of any kind. The classifier's
predictions for these rows are never read, joined or hinted at here: a
labeller must not be able to see what the tool guessed.

## Brief

Label every row under `data/calibration-2026-09-14/BRIEF.md`. That is the exact brief path; no
other version of the brief may be used.

## Split

- Seed: 20260920 (mulberry32, one shuffle over all 1003 rows).
- 1003 rows split into 9 parts: parts 1-8 have 111 rows each,
  part 9 has 115 rows (8*111 + 115 = 1003).
- Rows are shuffled across all 5 vendors before splitting, so no
  labeller receives one vendor's rows in a block.
- `blind-1.csv` … `blind-9.csv`: one file per labeller, single-digit
  naming. Columns: `row_id,provider,method,path,operationId,summary,description`.
  No truth, class, confidence, part number, or classifier output.
- `key.csv`: `row_id,part,provider,method,path,operationId` — no class
  column, since there is no truth yet.
- Row ids run `e0001`..`e1003`, assigned in `ops.csv` order before the
  shuffle. The `e` prefix is deliberate, so an exam row id can never be
  confused with a build-set `bNNNN` id or a 15-provider-corpus `rNNNN` id.

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
node tools/make-exam-blind-2026-09-20.js
```

Deterministic: same seed (20260920), same `ops.csv` -> byte-identical
output files, every run.
