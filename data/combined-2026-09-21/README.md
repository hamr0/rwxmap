# data/combined-2026-09-21 — combined labelled corpus (DIAGNOSTIC)

**This is a tuning/diagnostic set, not an exam.** Every source in it has
already been tuned on or scored: the provider corpus is the tuning set the
rules were fitted on, and both exams are burned (D24). No number computed
over this set is a generalization claim. The only honest generalization
numbers remain the ones each exam gave when it was scored once.

## What it is

6557 labelled operations across 23 providers, joined from the
three sets whose specs this project pulled itself from official sources and
labelled blind under `data/calibration-2026-09-14/BRIEF.md`:

| prefix | source | rows | providers | truth r / w / x |
|---|---|---|---|---|
| `pc-` | `data/provider-corpus-2026-09-16` | 4171 | asana, canva, datadog, digitalocean, figma, intercom, jira, mailchimp, meta-whatsapp, openai, paypal, spotify, square, stripe, zoom | 2082 / 1218 / 871 |
| `x17-` | `data/exam-2026-09-17` | 1383 | docusign, okta, xero | 594 / 415 / 374 |
| `x20-` | `data/exam-2026-09-20` | 1003 | auth0, hubspot, klaviyo, miro, zendesk | 29 / 633 / 341 |

- `x17`: the D80 rulings are already baked into its `labels-N.csv` files.
- `x20`: `label/rulings.csv` is overlaid on the raw labels exactly as
  `tools/score-exam-2026-09-20.js` does (13 rulings, each asserting the raw
  label it replaces). A ruled row keeps its labeller's `confidence`.

Only these three, deliberately: the build set (`data/buildset-2026-09-18`)
is apis-guru specs this project did not pull from official sources; CAMARA
is deleted; everything older is superseded.

No provider appears in more than one source. Duplicate operations
(same provider|method|path|operationId) inside the set: 0.

## Row ids

Exams 09-17 and 09-20 both number their rows `e0001...`, so every
`row_id` is prefixed with its source: `pc-`, `x17-`, `x20-` (e.g.
`pc-r0001`, `x17-e0001`, `x20-e0001`). Uniqueness is asserted after
prefixing.

## Files

- `rows.json.gz` — array of
  `{row_id, source, provider, method, path, operationId, summary, description, truth, confidence}`.
  Full description text, never truncated. sha256 of the **uncompressed**
  JSON: `3d07a5a410c91d2ef10494d8d91bcb01290acb1e67f7a89d85866781d1d38c5f`.
- `jev-rows.json` — uncompressed, what `poc/jev/run.mjs` reads: array of
  `{row_id, method, path, operationId, summary, description}`. No truth,
  no source, no provider.
- `outA.jsonl` / `outB.jsonl` (when present) — raw Jev output, scored by
  `tools/score-combined-2026-09-21.js`.

## Rebuild

```
node tools/build-combined-2026-09-21.js
```

Deterministic: `zlib.gzipSync` writes mtime 0, so two runs give identical
bytes. The builder hard-fails on any per-source truth total other than the
recorded one, a non-1:1 ops/key join, a total other than 6557, a provider
count other than 23, a provider in two sources, a repeated prefixed
row_id, or a duplicate operation with conflicting truth.
