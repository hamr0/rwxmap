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
