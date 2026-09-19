# poc/vendorprofile

POC for a per-DOCUMENT steer on top of the method floor. It does not
touch, replace, or reinterpret the method floor (`GET -> r`, `POST -> x`,
`PUT/DELETE/PATCH -> w`) — it only asks: given everything else known
about one API spec, should this vendor's `PUT/DELETE/PATCH` floor move
from `w` up to `x`? Passing `threshold` above 1 to `steeredFloor` always
recovers the unsteered original floor exactly (covered by
`profile.test.mjs`).

Motivation (measured on the build set,
`data/buildset-2026-09-18/`): truth-x share of `PUT/DELETE/PATCH` runs
from netbox 0.9% to keycloak 32.5%, a 36-fold spread across 13 vendors,
while per-operation word lists collapse under leave-one-vendor-out
(fitted 8.17, LOVO 0.83 — see `docs/logs/learnings.md`). A vendor-level
signal might transfer where a per-operation one doesn't; this POC
measures whether it does.

**The profile never reads truth.** `profile.mjs`'s `profileScore` and
`steeredFloor` take only `provider, path, method, operationId, summary,
description` — never `truth_class`, never a labels file. Truth is read
only in `run.mjs`, only to score predictions after the fact.

Imports nothing from `src/`, `poc/step1`, `poc/step2`, `poc/step3`,
`poc/flow`, `poc/archive`. The pure modules (`signal.mjs`, `profile.mjs`,
`score.mjs`) import nothing outside this directory; only `run.mjs`
reaches out, to `../../tools/csv.js` (dev tooling) and the corpus files
under `data/buildset-2026-09-18/`.

## Files

- `signal.mjs` — `SIGNAL_WORDS`: a hand-written, flat, lowercase,
  deduped array of object-nouns that name things another party depends
  on (identity/account, access, credential, sharing). Pure data.
- `profile.mjs` — pure: `rowTokens` (camelCase + punctuation splitter,
  copied in, not imported), `profileScore` (document-level: share of a
  vendor's operations, every method, that contain at least one
  `SIGNAL_WORD`), `steeredFloor` (the floor logic described above).
- `score.mjs` — pure: `tally` (exact/leaks/over-tight under `r < w < x`)
  and `perVendor`.
- `run.mjs` — the runner. Loads `ops.csv.gz` joined to the 9
  `labels-N.csv` blind-labeller files by row order (`ops` row N, 1-based,
  is id `bNNNN`), drops the 2 `?` truth rows, then prints six blocks:
  1. baselines (method floor only, all-x)
  2. per-vendor profile scores, sorted, with truth x-share shown for the
     reader only (labelled "not used by the profile")
  3. a threshold sweep, 0.10-0.90 step 0.05, **fitted on the whole set**
  4. leave-one-vendor-out: threshold chosen on the other 12 vendors only,
     applied to the held-out vendor's own profile score
  5. option 2 — an evidence flag: what share of method-floor leaks sit on
     `PUT/DELETE/PATCH` rows with no signal word anywhere in the row
     (changes no class, measures how much a "no evidence" flag would
     catch)
  6. option 3 — a blunt raise (`PUT/DELETE/PATCH -> x` for everyone, no
     profile), printed for direct comparison against blocks 3 and 4
- `profile.test.mjs` — `node --test`, hand-built fixtures only.

## Running it

```sh
node poc/vendorprofile/run.mjs
node --test poc/vendorprofile/*.test.mjs
```

## Reading the numbers

**A fitted number here means nothing without the LOVO block.** Block 3
is fit on the same rows it's scored on and will always look better than
block 4. On this build set, LOVO's per-vendor fitting procedure picked
the top of the grid (0.90) for every held-out vendor except the two
whose own score already clears it (keycloak, launchdarkly) — the
"other 12" fit never found a threshold inside the swept range that beat
just going higher, which is itself informative: on this set the fitted
sweep (block 3) keeps improving exact% all the way to the top of the
0.10-0.90 range, above the method-floor baseline's own 80.5%. Read the
LOVO total against the method-floor baseline on the same rows, not
against block 3.
