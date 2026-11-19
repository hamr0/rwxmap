# exam #7 lean

`lean.csv` is rwxmap's mechanical verdict for every exam #7 operation (1579 rows, ops.csv order), produced by `classifyOperations` from `src/exporter.js` at code ref 96ebb46 (`src/` identical to 96ebb46; mechanical identical to 1c25be1). Same logic as `poc/d141-pass/lean.mjs`.

Columns: `id` (ops.csv id), `lean_letter` (r, w or x), `lean_rule` (rule that decided it). Alias: `credential-set` is written as `cant-undo-verb`.

Rebuild (from the repo root): `node data/exam7-2026-11-19/lean/build-lean.mjs` (asserts row count, id order, letters, non-empty rules; exits non-zero on failure).

sha256 of lean.csv: `8334bbe66d1965f79cbd9ad13e17fcabd904c548832d803f7da053c005fc3a70`

Custody: lean.csv is never shown to labellers and stays out of git until both labellers have finished. Only `build-lean.mjs`, `README.md` and `lean.csv.sha256` get committed.
