# exam #8 lean

`lean.csv` is rwxmap's mechanical verdict for every exam #8 operation (1821 rows, ops.csv order), produced by `classifyOperations` from `src/exporter.js` at code ref ecee4f1 (mechanical v4 plus D144). Same logic as `poc/d141-pass/lean.mjs` and exam #7's `build-lean.mjs`.

Columns: `id` (ops.csv id), `lean_letter` (r, w or x), `lean_rule` (rule that decided it). Alias: `credential-set` is written as `cant-undo-verb`.

Rebuild (from the repo root): `node data/exam8-2026-11-23/lean/build-lean.mjs` (asserts row count, id order, letters, non-empty rules; exits non-zero on failure). Two runs give the same bytes.

sha256 of lean.csv: `87a6e8978534fb37e5d24e76034720c481e2c8417e91b3e6eaf64eb4317a1502`

Custody: lean.csv is never read against truth and stays out of git until both sides have scored. This README states no counts by letter or rule. Only `build-lean.mjs`, `README.md` and `lean.csv.sha256` get committed.
