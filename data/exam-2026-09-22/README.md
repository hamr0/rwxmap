# data/exam-2026-09-22 — the M3 clean exam (three complete provider APIs)

## What this is

The M3 clean exam: three complete, official provider OpenAPI specs —
Cloudflare, PagerDuty and Sentry — drawn 2026-09-22, none of which has
ever been labelled before. 4279 operations total. This directory carries
**no labels, no truth column, and no classifier prediction of any kind**.
`ops.csv` is the extract only.

It will be labelled blind under `data/relabel-2026-09-22/BRIEF-v3.md` —
that is the exact brief path, no other version may be used — and scored
**ONCE**. Once scored it is BURNED (D24): a rule change from here needs a
new exam, never a re-score of this one. The labelling plan, part split
and labeller assignments are not decided here; this directory only
provides the row extract for that next step.

## Providers

| provider | spec version | rows | GET | POST | PUT | DELETE | PATCH |
|---|---|---|---|---|---|---|---|
| cloudflare | OpenAPI 3.0.3 | 3575 | 1758 | 750 | 350 | 450 | 267 |
| pagerduty | OpenAPI 3.0.2 | 465 | 211 | 105 | 77 | 71 | 1 |
| sentry | OpenAPI 3.0.3 | 239 | 130 | 37 | 33 | 37 | 2 |
| **total** | | **4279** | 2099 | 892 | 460 | 558 | 270 |

**cloudflare is 84% of the rows** (3575 of 4279). Results must be
reported per vendor; a pooled number across all three is never quoted
alone, since it would mostly describe cloudflare.

## No labels, no predictions

These files carry no r/w/x information of any kind, and no classifier
prediction. A labeller working from files under here cannot see what the
tool guessed, because nothing here records it. The next step (drawing a
blind labelling split from `ops.csv`) is not part of this directory.

## The rule

Scored **once**. Never tuned on. A rule change means a new exam, not a
re-score of this one (D24).

## Exposure check (Task 1, before anything was built)

Checked cloudflare, pagerduty and sentry against every prior labelled or
extracted set, matching on the provider/vendor FIELD and on registrable
name — never on substring-in-text, since e.g. a digitalocean path
containing the literal string `dropbox` is not exposure of dropbox as a
vendor.

- `data/combined-2026-09-21/rows.json.gz` (6557 rows, `provider` field
  parsed from the gzipped JSON): 23 distinct providers — asana, auth0,
  canva, datadog, digitalocean, docusign, figma, hubspot, intercom, jira,
  klaviyo, mailchimp, meta-whatsapp, miro, okta, openai, paypal, spotify,
  square, stripe, xero, zendesk, zoom. **None of the three.**
- `data/provider-corpus-2026-09-16/specs.lock.json` (711 entries, mostly
  digitalocean/paypal split multi-file specs): 15 distinct providers —
  asana, canva, datadog, digitalocean, figma, intercom, jira, mailchimp,
  meta-whatsapp, openai, paypal, spotify, square, stripe, zoom. **None of
  the three.**
- `data/exam-2026-09-17/` (per its own README's provider table): okta,
  docusign, xero. **None of the three.**
- `data/exam5-2026-09-14/exam-key.csv` (`api_key` column, the apis-guru
  vendor domain): grepped case-insensitively for `cloudflare`,
  `pagerduty`, `sentry` — **zero matches** across all rows.
- `data/buildset-2026-09-18/ops.csv` (`provider` column): appcenter.ms,
  atlassian.com, box.com, clearblade.com, dracoon.team, gitea.io,
  github.com, gitlab.com, keycloak.local, launchdarkly.com,
  microsoft.com, netbox.dev, trello.com. **None of the three.**
- `data/relabel-2026-09-22/` is built entirely from
  `data/combined-2026-09-21/rows.json.gz` (per its own README) and has no
  provider set of its own beyond that — already covered above.
- `data/corpus/apis-guru-specs/` (2529 files): `find` for filenames
  containing `cloudflare`, `pagerduty` or `sentry` (case-insensitive) —
  **zero matches**.

**Result: cloudflare, pagerduty and sentry are unseen as providers in
every prior set checked.** No apis-guru spec file exists for any of the
three either.

## Layout

- `specs/<provider>.json.gz` — the original spec bytes, gzipped in place.
  `gunzip -c` returns the original byte-for-byte (round-tripped and
  checked against `specs.lock.json`'s sha256 before this README was
  written).
- `specs.lock.json` — per spec: `provider`, `path`, `url`, `bytes` and
  `sha256`, where `bytes` and `sha256` describe the **uncompressed**
  original (same convention as `data/provider-corpus-2026-09-16` and
  `data/exam-2026-09-17`). All three hashes and byte counts were verified
  against the pre-supplied values before gzipping.
- `ops.csv` / `ops.csv.gz` — one row per (path, method) operation across
  GET/POST/PUT/DELETE/PATCH, 4279 rows. Every row has a non-empty
  `operationId`; no (path, method) repeats within a provider's spec.
- `build.mjs` — the extraction script (see Reproduce).

## Columns

`ops.csv` has one column ahead of the schema used by
`data/exam-2026-09-17/ops.csv`: a leading `row_id`, prefix `x22-`,
zero-padded to 4 digits (`x22-0001` upward), assigned in emission order
(cloudflare rows first, then pagerduty, then sentry; within each
provider, in `paths` object iteration order, GET/POST/PUT/DELETE/PATCH
per path item). The remaining 11 columns are exactly the
`data/exam-2026-09-17/ops.csv` schema:

```
row_id,provider,spec_file,path,method,operationId,summary,description,has_summary,has_description,has_operationId,deprecated
```

## Reproduce

Specs must already be present, either uncompressed at
`specs/<provider>.json` or degzipped first from `specs/<provider>.json.gz`
(`gunzip -k specs/*.json.gz`) — `build.mjs` reads local files only and
never fetches over the network.

```
gunzip -k data/exam-2026-09-22/specs/*.json.gz
node data/exam-2026-09-22/build.mjs
```

Deterministic and re-runnable: given the same spec bytes, a second run
writes a byte-identical `ops.csv`. The script asserts the exact
per-provider, per-method counts in the table above and exits 1 on any
mismatch, on any (path, method) duplicate within a provider, on any row
missing an `operationId`, or on any operation present under a method
outside GET/POST/PUT/DELETE/PATCH.

## Calibration (calib/)

BRIEF-v3 (`data/relabel-2026-09-22/BRIEF-v3.md`) was calibrated only on the 3852 non-r rows of
the 2026-09-22 relabel (`data/relabel-2026-09-22/`). This exam is 1758 of
its 4279 rows GET (41%), so the brief has never been calibrated on the r
class it is about to be judged on here. The standing project rule is that
a brief is calibrated per method it covers before an exam relies on it.

This calibration draw does **not** come from the exam -- scoring it would
burn exam rows before they are ever labelled. It is drawn instead from
the TUNING corpus (`data/combined-2026-09-21/rows.json.gz`, 2705 rows
whose v1 truth is `r`), where v1 truth already stands as truth for r rows
(see `poc/d87/readout.mjs`'s `attachTruth`: a `row.truth === 'r'` row
keeps its v1 label directly, only non-r rows are relabelled under v3).

- `r-practice-blind.csv` (100 rows, seeded shuffle over the 2705-row
  v1-truth-r pool, independent of the exam's own shuffle): labelled blind
  under BRIEF-v3 to check the brief holds on the r class before the exam
  is scored.
- `r-practice-key.csv`: `row_id,provider,method,path,operationId` -- no
  class column.
- The existing v1 truth for these rows is used only inside
  `tools/make-exam-2026-09-22.js`'s own assertion/report path (to draw
  the r-truth pool and to print the disjointness check); it is never
  written to `r-practice-blind.csv` or `r-practice-key.csv`, and the
  script asserts neither file's header contains a truth/class/confidence
  column before it will report success.
- Disjoint from the exam by construction (different corpus entirely) and
  asserted anyway, on row_id and on provider.

## Split (label/)

- Seed: 20260923 (mulberry32, one shuffle over all 4279 exam rows).
- 4279 rows split into 10 parts: parts 1-9 have 428 rows each, part 10
  has 427 rows (9*428 + 427 = 4279).
- Rows are shuffled across all three providers before splitting, so no
  labeller receives one provider's rows in a block. Per-part provider mix:
  - part 1: cloudflare 358, pagerduty 46, sentry 24 (428 rows)
  - part 2: cloudflare 351, pagerduty 50, sentry 27 (428 rows)
  - part 3: cloudflare 366, pagerduty 41, sentry 21 (428 rows)
  - part 4: cloudflare 359, pagerduty 42, sentry 27 (428 rows)
  - part 5: cloudflare 353, pagerduty 43, sentry 32 (428 rows)
  - part 6: cloudflare 348, pagerduty 54, sentry 26 (428 rows)
  - part 7: cloudflare 363, pagerduty 42, sentry 23 (428 rows)
  - part 8: cloudflare 351, pagerduty 49, sentry 28 (428 rows)
  - part 9: cloudflare 359, pagerduty 52, sentry 17 (428 rows)
  - part 10: cloudflare 367, pagerduty 46, sentry 14 (427 rows)
- `blind-1.csv` … `blind-10.csv`: one file per labeller. Columns:
  `row_id,provider,method,path,operationId,summary,description`. No
  truth, class, confidence, part number, or classifier output.
- `key.csv`: `row_id,part,provider,method,path,operationId`, sorted by
  row_id -- no class column.
- Row ids are kept exactly as `ops.csv` has them (`x22-0001` …); nothing
  is renumbered.

## Rules for labellers

- Open only your own `blind-N.csv` file.
- Write only your own output file, named `labels-N.csv` (same N as your
  blind file), and use your own uniquely-named scratch files -- never a
  name another labeller might also use.
- Output columns are exactly `row_id,truth_class,confidence,reason`, as
  the brief specifies: `truth_class` is r, w, x or ?; `confidence` is
  EXACTLY `high` or `low` (there is no medium, and any other value means
  the file is rejected); `reason` is a short phrase under 15 words with
  no commas (or the whole reason double-quoted) naming the clause
  applied. One line per input row, same order, no rows skipped, no
  extras.
- Append output in batches of about 50 rows rather than holding all rows
  in memory, so a kill mid-run loses only the unflushed batch.
- Do not look at any other labeller's blind or output file.

## Reproduce (split + calibration)

```
node tools/make-exam-2026-09-22.js
```

Deterministic: same seed (20260923), same `ops.csv` and same
`data/combined-2026-09-21/rows.json.gz` -> byte-identical output files,
every run.

## Scored (2026-09-23)

Scored **once** via `node tools/score-exam-2026-09-22.js`. This set is
now **BURNED** (D24): no rule change may be evaluated by re-scoring
these rows, ever — a rule change needs a new exam.

Mechanical only (no Jev — this exam has no Jev answers of its own
yet), 4279 rows: exact 3520 (82.3%), leaks 37 (0.9%), over-tight 722
(16.9%). Full per-vendor, per-method, evidence-split and gate-item-1
detail is in `docs/logs/learnings.md` ("The M3 clean exam", 2026-09-23)
and `docs/product/prd.md` ("Where the work is").
