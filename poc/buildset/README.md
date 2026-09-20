# poc/buildset

POC for drawing the write-heavy BUILD SET from
`data/corpus/apis-guru-ops.csv.gz`, per the vendor split pre-registered in
`docs/logs/pre-registered-split-2026-09-18.md`. The gates are the point:
this POC must be able to fail, and a failing gate is reported, never
loosened to pass.

Imports nothing from `poc/step1`, `poc/step2`, `poc/step3`, `poc/flow`,
`poc/archive` or `src/`. The pure modules (`draw.mjs`, `gates.mjs`) import
nothing outside this directory; only `run.mjs` reaches out, to
`../../tools/csv.js` (dev tooling) and the gzipped corpus file.

## Files

- `split.mjs` — the pre-registered split as data: per-vendor caps
  (`BUILD_CAPS`), the locked exam vendor list (`EXAM_VENDORS`), the
  already-seen vendor list (`SEEN_VENDORS`), and the write methods
  (`WRITE_METHODS`). No logic. Changing a cap here is an amendment to the
  split doc, never a silent edit.
- `draw.mjs` — pure: `registrableName`, a deterministic `seededShuffle`
  (mulberry32), and `drawBuildSet` (filter to write methods + pre-
  registered vendors, per-vendor seeded draw up to its cap).
- `gates.mjs` — pure: `runGates` runs the seven checks against a drawn set
  (methods-only, vendors-are-pre-registered, no-exam-vendor-overlap,
  no-seen-vendor-overlap, giant-share, no-duplicate-rows,
  every-vendor-present).
- `run.mjs` — the runner. Reads and gunzips the corpus, draws with seed
  `20260918`, prints the per-vendor table and every gate result, exits 1
  if any gate fails, 0 otherwise.
- `draw.test.mjs` — `node --test` unit tests on hand-built fixture rows
  (never the real corpus).

## Running it

```sh
node poc/buildset/run.mjs
node --test poc/buildset/*.test.mjs
```

`run.mjs` is dry-run by default — it never writes a file. Pass
`--write <dir>` to also write `<dir>/ops.csv` with the drawn rows (not
run that way by default). `--methods=PUT,DELETE,PATCH`,
`--cap-github=N` and `--cap-microsoft=N` let you explore other caps
without editing `split.mjs`.
