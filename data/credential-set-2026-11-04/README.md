# credential-set rows, measured by rwxlite

Read-only copy of rwxlite's fixture: 32 rows where the lean rule is credential-set.

- Source repo: rwxlite, commit `2a5989f` on branch `m1`, file `test/fixtures/credential-set.jsonl`
- Generator: `m1/credential-set-file.mjs`
- Model: `rwxlite-0.1.0+8ad0a182` (int8 per-channel)
- Fields: `provider`, `method`, `path`, `operationId`, `summary`, `model`, and `before` / `after`, each `{isX, changes, argmax, maxP}`. `argmax` is the letter of max(1-changes, changes-isX, isX) (r, w, x).
- `before` = raw lean rule credential-set. `after` = rwxlite's guard (it reads the row as cant-undo-verb).
- No truth labels.

Used by `poc/credential-set-check/check.mjs`.
