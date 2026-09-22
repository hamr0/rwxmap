# data/relabel-2026-09-22 — relabel of the v1 truth-w rows under BRIEF-v2

## What this is

Blind relabelling files for the 2266 rows of the combined set
(`data/combined-2026-09-21/rows.json.gz`, 6557 rows across
23 providers) whose v1 truth is `w`, to be relabelled under
`data/relabel-2026-09-22/BRIEF-v2.md` — the D86 definition, where "cannot be
undone" is a third road to x.

Only the v1 truth-w rows are relabelled. v2 moves a row w->x and never
the other way, so v1 truth-r and truth-x labels stand as they are.

**This stays TUNING DATA.** Every source in the combined set is either
the tuning corpus (`pc-`) or a burned exam (`x17-`, `x20-`; D24).
Relabelling burned exam rows does not unburn them: no number computed
over these rows is a generalization claim.

These files carry no r/w/x information of any kind. The classifier's
predictions for these rows are never read, joined or hinted at here: a
labeller must not be able to see what the tool guessed, nor the v1 label.

## Brief

Label every row under `data/relabel-2026-09-22/BRIEF-v2.md`. That is the exact brief
path; no other version of the brief may be used.

## Calibration (`calib/`)

BRIEF-v2 is a DRAFT until it is calibrated. Two draws off the front of
the one seeded shuffle:

- `practice-blind.csv` (100 rows, shuffled positions 1-100): two
  labellers label it blind under BRIEF-v2; their disagreements are read
  row by row and ruled by the user; the brief is revised if a ruling
  shows a gap.
- `holdback-blind.csv` (100 rows, shuffled positions 101-200): measured
  ONCE against the calibrated brief, then burned as a calibration set.
- `practice-key.csv`, `holdback-key.csv`: `row_id,provider,method,path,operationId`
  — no class column.

The two draws are disjoint (asserted). Both are also part of the main
relabel below: the calibration rows get relabelled in the main run too.

## Split (`label/`)

- Seed: 20260922 (mulberry32, one shuffle over all 2266 rows; the
  calibration draws are the first 200 rows of that same shuffle).
- 2266 rows split into 9 parts: parts 1-8 have 251 rows each,
  part 9 has 258 rows (8*251 + 258 = 2266).
- Rows are shuffled across all 23 providers before splitting, so no
  labeller receives one provider's rows in a block.
- `blind-1.csv` … `blind-9.csv`: one file per labeller, single-digit
  naming. Columns: `row_id,provider,method,path,operationId,summary,description`.
  No truth, class, confidence, part number, or classifier output.
- `key.csv`: `row_id,part,provider,method,path,operationId`, sorted by
  row_id — no class column.
- Row ids are kept exactly as the combined set has them (`pc-r0001`,
  `x17-e0001`, `x20-e0001`); nothing is renumbered, so a relabel joins
  back to `rows.json.gz` on `row_id` alone.

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
node tools/make-relabel-2026-09-22.js
```

Deterministic: same seed (20260922), same `rows.json.gz` -> byte-identical
output files, every run. The uncompressed `rows.json` has sha256
`3d07a5a410c91d2ef10494d8d91bcb01290acb1e67f7a89d85866781d1d38c5f`; the tool escalates on any other value.
