# F1 gate-2 score, 2026-11-04

This folder holds the one-time exam score of the F1 build (D129) on
rwxlite's fresh gate-2. It is an exam score, not a tuning set: do not
re-score it to pick a shape, and do not tune on it.

## Files

- `build.mjs`: reads rwxlite `data/gate-2026-11-04/blind.csv` and writes
  one OpenAPI 3.0.3 file per provider (219 providers, 600 rows, 0
  duplicate method+path, 0 missing joins), plus `vendors.json`.
- `score.mjs`: joins the CLI outputs to rwxlite `truth.csv` (frozen,
  commit f6c985b) and prints exact / too loose / too tight for
  mechanical, shipped (0.8.1) and F1, on all 600 rows and on the 483
  vendor-clean rows.
- `score.txt`: the printed result.
- `run.tar.gz`: the CLI outputs, logs and vendor index of the run.

## How it was produced

1. `node build.mjs <dir>` writes the specs to `<dir>/specs/`.
2. For each spec, with `RWXMAP_JEV_KEY` set:
   `node src/cli.js <spec> --vendor vNNN -o out --force`
3. `node score.mjs <dir>` scores the outputs.

## Source

- Code: branch `feat/d128-rwxlite-takeback`, uncommitted F1 build on top
  of c503b05 (cut pre-registered there).
- Model: `jev-1.14.0` on every answer.
- Date: 2026-11-04. 654 requests, 0 failed, 1,360,315 input tokens.
- The shipped line comes from the same run: rows F1 moved to r are put
  back to w.

## Result

All 600 rows, exact / too loose / too tight: shipped 550 (91.7%) / 3 /
47; F1 567 (94.5%) / 3 / 30. F1 moved 17 rows, 17 right, 0 wrong. See
`docs/logs/learnings.md` (2026-11-04) and D129.
