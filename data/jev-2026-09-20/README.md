# data/jev-2026-09-20 — raw Jev runs

## What these are

Four gzipped files holding both halves of the 2026-09-20 Jev
measurement — the raise-only tier POC (A) and the cold whole-job POC
(B).

- `outA-full.jsonl.gz`, `outB-full.jsonl.gz` — the raw Jev API
  responses, one JSON object per line, keyed by `row_id`.
- `rowsA-full.json.gz`, `rowsB-full.json.gz` — the input rows that
  produced them, each carrying its truth label.

POC A's rows are the 1113 build-set rows the D75 flow labels `w`.
POC B's rows are all 4171 rows of the 15-provider corpus.

They are kept in the repo rather than a scratchpad because they cost
money to produce: re-running them spends the cost again.

## The exam run

Three more gzipped files hold a third run: the same two criteria over
the clean exam in `data/exam-2026-09-20/`.

- `rowsE-exam.json.gz` — the 1003 input rows.
- `outE-A.jsonl.gz`, `outE-B.jsonl.gz` — the raw responses, one JSON
  object per line, keyed by `row_id`.

The rows are all 1003 rows of the exam: auth0 250, hubspot 250,
zendesk 250, klaviyo 141, miro 112. Write methods only — POST 339,
DELETE 280, PATCH 206, PUT 178 — no GET.

`rowsE-exam.json.gz` carries no `truth` field. The exam was unlabelled
when these ran, and that is the whole point: the predictions exist
before any labeller has seen a row.

It does carry `flowClass`, the frozen mechanical tool's own prediction
per row, recorded at the same moment and never sent to Jev. Its
distribution is POST r:10 w:14 x:315, DELETE w:267 x:13, PATCH w:202
x:4, PUT w:171 x:7 — so 654 rows sit on the flow's `w`, the subset the
raise-only tier will be scored on, and 349 on `x`.

Both runs used the frozen criteria in `poc/jev/criteria.mjs`,
unchanged: `questionsA` and `questionsB` exactly as POCs A and B used
them. Two separate calls per row set, deliberately not a combined-question
harness, so the criteria are byte-identical to what was measured on
2026-09-20. No tuning loop, no re-writing.

- Run A: 1003 rows, 0 failed, 40.7s, 3,432,727 input tokens, ~$0.1442.
- Run B: 1003 rows, 0 failed, 39.4s, 2,619,294 input tokens, ~$0.1100.

sha256 of the uncompressed contents, recorded so the predictions can be
proven to predate the labels:

- `rowsE-exam.json` —
  `9c20637c670c39e5226a1a1a52bc438fd1c153b2c5eb6c9158b75757dc1ad27b`
- `outE-A.jsonl` —
  `33ad2ad48d91c36321711f568d297c46e092e44244a551c10e5ae57c1614f46c`
- `outE-B.jsonl` —
  `db43859e2ccde74c6bf223d5830a19ce95e8dd4a5a4216b84abf893da695b140`

No accuracy, leak, threshold or score number appears here for this run
because none exists yet.

## Harness

`poc/jev/`:

- `criteria.mjs` — the criteria.
- `run.mjs` — the runner.
- `make-rows.mjs` — builds the row sets.
- `make-rows-exam.mjs` — builds the exam row set.
- `score-full.mjs` — scores them.

The model requested was `jev-latest`, which answered as `jev-1.13.0` —
the same version for all three runs.

## Reproduce

Re-run `poc/jev/run.mjs`. It needs a TypeSafe API key and will
re-spend the cost.

For the exam run: `node poc/jev/make-rows-exam.mjs`, then

    node poc/jev/run.mjs A data/jev-2026-09-20/rowsE-exam.json data/jev-2026-09-20/outE-A.jsonl 8

and the same with `B` and `outE-B.jsonl`. The runner reads and writes
the ungzipped paths; the files are gzipped for storage afterwards.

## Status of the build set

The moment a threshold was swept on those 1113 rows, the build set
became a tuning set for this tier. It is never an exam for it. The
number that counts must come from a fresh exam drawn from the ten
locked vendors.

## Standing of the exam run

Because the build set is a tuning set for this tier, these 1003 exam
rows are the only honest generalization number this tier will get.

The exam is scored once and burned (D24). Scoring cannot happen until
the nine blind labellers produce truth in `data/exam-2026-09-20/label/`.
