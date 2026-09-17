# data/exam-2026-09-17 — clean exam corpus (three complete provider APIs)

Three complete, official provider API specs drawn 2026-09-17 to serve as a
clean exam for the r/w/x step ladder. Fetch and extract only: this
directory carries **no labels and no truth column**. `ops.csv` has the same
11 columns as the 15-provider corpus (`data/provider-corpus-2026-09-16`),
and truth, when it exists, lives only in a `label/` directory — as it does
there.

## Providers

| provider | spec version | rows | GET | POST | PUT | DELETE | PATCH |
|---|---|---|---|---|---|---|---|
| okta | OpenAPI 3.0.3 | 734 | 290 | 235 | 85 | 111 | 13 |
| docusign | Swagger 2.0 | 414 | 167 | 65 | 105 | 77 | 0 |
| xero | OpenAPI 3.0.0 | 235 | 126 | 46 | 53 | 10 | 0 |
| **total** | | **1383** | 583 | 346 | 243 | 198 | 13 |

DocuSign's spec is Swagger 2.0, not OpenAPI 3; its `paths`, methods,
`operationId`, `summary` and `description` sit in the same places, so
extraction is identical.

## The rule

Scored **once per provider per step**. Never tuned on. A rule change means
a new exam, not a re-score of this one (D24).

## Stated limits

- **xero carries no description text at all**: 0 of 235 rows have a
  `description`, and 231 of 235 have a `summary`. Any step that needs the
  description text is blind on every xero row.
- docusign has 403 of 414 summaries and 387 of 414 descriptions; okta has
  734 of 734 of each.
- 4 okta rows are marked `deprecated`; no docusign or xero row is.

## Vendor overlap with earlier sets

Checked, not assumed:

- **15-provider corpus (`data/provider-corpus-2026-09-16`): zero overlap.**
  Its 15 provider keys are asana, canva, datadog, digitalocean, figma,
  intercom, jira, mailchimp, meta-whatsapp, openai, paypal, spotify,
  square, stripe, zoom — none of okta, docusign or xero. Its
  `specs.lock.json` has 0 source urls mentioning any of the three.
- **`data/corpus/labelled.csv` (the M0-era tuning set): zero overlap** on
  its `repo` field.
- **The APIs.guru corpus (`data/corpus/apis-guru-ops.csv.gz`) is NOT
  clean of these vendors.** It holds 393 docusign.net rows, 284 xero.com
  rows across six xero api_keys, and 19 okta.local rows, out of 123,339.
  Exams 1-5 were drawn from it, so each carries a handful of rows from
  these vendors: exam 1 5 rows, exam 2 16, exam 3 34, exam 4 46, exam 5
  46. Those specs are different files and different versions from the
  three fetched here, but the vendors are not previously unseen in the
  strict sense. This is a stated limit of this exam, not a clean claim.

How it was checked: both corpora parsed with `tools/csv.js` and their
provider/api_key/repo columns matched case-insensitively against `okta`,
`docusign` and `xero`; the 15-provider `specs.lock.json` urls matched the
same way.

## Layout

- `specs/<provider>/<original-filename>.gz` — the original spec bytes,
  gzipped in place. `gunzip -c` returns the original byte-for-byte.
- `specs.lock.json` — per spec: `provider`, `path`, `url`, `bytes` and
  `sha256`, where `bytes` and `sha256` describe the **uncompressed**
  original (same convention as the 15-provider lock, verified against its
  asana entry).
- `ops.csv` / `ops.csv.gz` — one row per operation, 1383 rows.

## Reproduce

```
node tools/build-exam.js
```

Deterministic and re-runnable: a spec already on disk is read, never
re-fetched, and a second run writes a byte-identical `ops.csv`. The script
exits 1 if any per-provider total or per-method count moves off the table
above.
