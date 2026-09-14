# data/exam5-2026-09-14 — exam 5

Drawn 2026-09-14, seed 20260914, by `poc/exam/make-exam5.mjs`, from
`data/corpus/apis-guru-ops.csv.gz` (123339 pool rows / 673 providers, deduped on
provider|method|path to 96063 rows, dropping 27276).

## What exam 5 is

Exam 5 has three strata: W (writes: PUT/DELETE/PATCH, 1500 rows), POST
(300 rows), and GET (200 rows).

Stratum W is ROW-disjoint, not vendor-disjoint, because the APIs.guru
pool has no unseen write vendors: only 327 pool providers have any
write row at all, and 325 of those (316 by exact provider string, 9 by
registrable name) already map onto one of the 332 corpus
vendors, leaving only 2 truly unseen write providers — far short of
1500 rows. See `docs/logs/learnings.md`, "Exam 5 draw: the APIs.guru
pool has no unseen write vendors", for the full measurement. Every
drawn W row's provider maps onto a corpus vendor
(recorded as `corpus_vendor`), but the exact row (matched by method+path
or method+operationId) is excluded if the corpus, exam 1, or exam 4
already has it. It is scored with the flow's leave-one-vendor-out lists
keyed on `corpus_vendor`, so a row's own vendor never feeds the mined
lists — but the hand lists were shaped on that vendor's OTHER rows,
which is the stated weakness of this stratum.

Strata POST and GET are vendor-disjoint: every drawn row's provider
fails `mapVendor` (does not match any of the 332 corpus
vendors, exact or by registrable name) and is not an exam 1 or exam 4
provider under either name form, checked in both directions.

## Run numbers (from the actual run that produced this directory)

- Pool: 123339 rows / 673 providers; deduped on provider|method|path
  -> 27276 dropped, 96063 remain.
- Write-provider mapping (providers with any PUT/DELETE/PATCH row):
  327 total -> 316 exact, 9 by registrable name, 0 ambiguous,
  2 unmatched.
- Stratum W eligible rows: 15284 (excluded as already-seen: 5623 by
  (a) same method+path, 4493 by (b) same method+operationId; a row
  can match both, so these are not additive).
- Stratum POST eligible rows: 1782 from 159 unseen providers.
- Stratum GET eligible rows: 4298 from 293 unseen providers.
- POST/GET candidate providers excluded for matching MORE THAN ONE corpus
  vendor by registrable name (ambiguous; not thrown, just excluded from
  the unseen pool per the orchestrator's ruling 2026-09-14: a name that
  matches any corpus vendor counts as seen, the tighter reading): 1
  (apiz.ebay.com).
- Overlap re-checked independently by the orchestrator with its own
  name normaliser (2026-09-14): 2000 rows, 0 overlapping rows, 0
  burned POST/GET providers, 0 duplicate paths. Shared hosting domains
  (azurewebsites.net, herokuapp.com, appspot.com) are split per app;
  tl-api.azurewebsites.net (corpus) and faceidentity-beta.azurewebsites.net
  (exam 5) are different apps.

| Stratum | Target | Eligible rows / providers | Final per-provider cap | Distinct providers drawn |
|---|---|---|---|---|
| W | 1500 | 15284 / 104 | 23 | 103 |
| POST | 300 | 1782 / 159 | 12 | 89 |
| GET | 200 | 4298 / 293 | 12 | 103 |

- Method split within W: PUT=603, DELETE=638, PATCH=259.
- Distinct providers in the final 2000-row sample: 267 (W 103, POST 89, GET 103).

## Reproduce

```
node poc/exam/make-exam5.mjs
```

Same seed (20260914), same input files -> byte-identical output files
every run.

## Labelling

Use the calibrated, adopted brief at
`data/calibration-2026-09-14/BRIEF.md` (adopted 2026-09-14).

## Files

- `exam-blind.csv` — all 2000 rows (row_id, provider, method, path,
  operationId, summary, description). No stratum, no corpus_vendor, no
  class column.
- `exam-key.csv` — row_id, provider, corpus_vendor, api_key, method,
  path, operationId, stratum (for joining back to the pool and for
  LOVO scoring after labelling; no class column). `corpus_vendor` and
  `stratum` are empty/`POST`/`GET` for the POST and GET strata.
- `exam-blind-part1.csv` .. `exam-blind-part10.csv` — 200 rows each, in
  row_id order, same header as `exam-blind.csv`, for parallel blind
  labellers.
- `exam-truth-part1.csv` .. `exam-truth-part10.csv` — NOT produced by
  this script; written later by blind labellers, one per part.
