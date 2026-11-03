# Gate-4 score of the 0.9.0 candidate, 2026-11-04

One-time exam score of rwxmap branch `feat/d128-rwxlite-takeback` (HEAD
7c3432c: F1/D129 jev-lower->r and F2/D131 credential-set) against shipped
rwxmap 0.8.1, on rwxlite's frozen gate-4. Exam, not tuning: do not re-score
it to pick a shape.

## Source

- Gate: `~/PycharmProjects/rwxlite/data/gate-2026-11-07/` (blind.csv, truth.csv,
  part.csv), rwxlite commit f1b8a2b. 800 rows, 250 providers, 0 duplicate
  method+path, 0 missing joins.
- Candidate: this repo at 7c3432c. Shipped: `rwxmap@0.8.1` from npm
  (`npx rwxmap --version` printed 0.8.1).

## Files

- `build.mjs`: blind.csv to one OpenAPI file per provider (`specs/`, `vendors.json`).
- `run.sh <cli> <outdir> <jev|mech>`: runs the real CLI on every spec.
- `score.mjs`, `score.txt`: the scorer and its printed result.
- `run.tar.gz`: the four output dirs (out-081-mech, out-branch-mech, out-081, out-branch).

## How

1. `node build.mjs .`
2. `./run.sh "node <repo>/src/cli.js" out-branch jev` and the same for the 0.8.1
   copy under `scratch/` (jev = RWXMAP_JEV_KEY exported from the repo .env).
3. Mechanical lines: same with the key unset, from this folder (no .env);
   all 250 logs per line say "Jev: off (mechanical)".
4. `node score.mjs .`

## Run facts

- Model: `jev-1.14.0` on every Jev run.
- 0.8.1 + Jev: 743 requests, 0 failed, 1,493,626 input tokens.
- branch + Jev: 883 requests, 0 failed, 1,790,298 input tokens (F1 adds second calls).
- Total about 3.28M input tokens, about $0.14.

## Result (exact / too loose / too tight, counts)

| set | 0.8.1 mech | branch mech | 0.8.1 + Jev | branch + Jev |
|---|---|---|---|---|
| all 800 | 598 / 11 / 191 | 599 / 10 / 191 | 687 / 10 / 103 | 734 / 9 / 57 |
| write 200 | 125 / 6 / 69 | 125 / 6 / 69 | 161 / 4 / 35 | 177 / 4 / 19 |
| general 600 | 473 / 5 / 122 | 474 / 4 / 122 | 526 / 6 / 68 | 557 / 5 / 38 |
| vendor-clean 641 | 458 / 11 / 172 | 459 / 10 / 172 | 537 / 10 / 94 | 579 / 9 / 53 |

All 800: exact 74.8 / 74.9 / 85.9 / 91.8 %; too loose 1.4 / 1.3 / 1.3 / 1.1 %.

Pre-set bar (branch + Jev not more too-loose than 0.8.1 + Jev, on all 800
and on vendor-clean): 9 vs 10 and 9 vs 10. PASS.

Changed rows (branch + Jev vs 0.8.1 + Jev, plus mech differences): F1 moved
46 rows to r, 46 right, 0 wrong. F2 changed 1 row (appwrite PATCH
/account/password, w to x, truth x), right. 8 more rows differ only by Jev
run-to-run noise (not F1 or F2): 3 became exact, 3 became wrong
(gate4-0141, 0380, 0596: w to x, truth w), 2 stayed wrong (0055, 0338).
Full row list in `score.txt`.
