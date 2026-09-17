# provider-corpus

Fetch + extract stage for a new 15-provider corpus of complete, official API
specs (Stripe, OpenAI, Square, Zoom, PayPal, Meta WhatsApp, Spotify,
DigitalOcean, Jira Cloud, Mailchimp, Asana, Datadog v1, Intercom, Canva
Connect, Figma). Labelling r/w/x is a later, separate step — not part of
this POC.

## Usage

```
npm install
node poc/provider-corpus/fetch.mjs           # downloads specs to data/provider-corpus-2026-09-16/specs/ (resumable)
node poc/provider-corpus/fetch.mjs --verify  # re-reads every stored .gz, checks sha256 against specs.lock.json
node poc/provider-corpus/extract.mjs         # writes ops.csv(.gz), verifies counts against providers.json
```

`fetch.mjs` is resumable (skips a file whose `.gz` already exists on disk)
and stores every spec gzipped in place as `<original-name>.gz` — the gzip
of the exact original bytes, so `gunzip -c <file>.gz` returns the original
byte-for-byte. It writes `data/provider-corpus-2026-09-16/specs.lock.json`
(tracked) recording each fetched file's url, the uncompressed byte length
and the sha256 of the uncompressed original, so the snapshot is checkable
and reproducible even after a live spec drifts upstream. `--verify` runs
that check with no network calls, printing a pass/fail line per provider
and exiting 1 on any mismatch.

`extract.mjs` reads the `.gz` files directly (gunzip, then parse) and exits
1 if any provider's extracted total or per-method count
(GET/POST/PUT/DELETE/PATCH) doesn't match the verified `expected` values in
`providers.json` exactly.

## providers.json

One entry per provider: `key`, `name`, `format` (json|yaml), `specVersion`,
`urls`, `externalRefs` (DigitalOcean only — its path-items are `$ref`'d out
to per-operation files), `licence`, `expected` counts, and `notes`.

## Data layout

- `data/provider-corpus-2026-09-16/specs/<key>/...` — original specs,
  each stored gzipped in place as `<original-name>.gz` (tracked; 42MB raw,
  3.6MB gzipped — cheap enough to keep). Read one with
  `gunzip -c <path>.gz`.
- `data/provider-corpus-2026-09-16/specs.lock.json` — tracked; url, byte
  length and sha256 of each UNCOMPRESSED original.
- `data/provider-corpus-2026-09-16/ops.csv` — gitignored (raw, unzipped).
- `data/provider-corpus-2026-09-16/ops.csv.gz` — tracked.
