# M1-C3 — APIs.guru corpus leans

Verb/noun "lean" table built from the APIs.guru openapi-directory (v2 API
list, snapshot fetched 2026-09-07) by HTTP method co-occurrence. This is
**prior evidence, not truth** — see PRD §8, D7.

`docs/logs/m1/corpus-leans.csv` is `leans.csv` filtered to rows with
`providers >= 3` (rarer tokens dropped as too thin to trust); everything
else in this summary that references leans.csv numbers uses the same
`providers >= 3` cut unless stated otherwise (the 22-token specific check
below is the one exception — it reports the pre-cut numbers).

## Do not interpret these numbers into r/w/x classifications — that is a later pass.

## Pipeline counts

- **Index size:** 2529 entries (confirmed from `list.json`'s key count).
- **Fetch outcome** (`fetch-log.csv`, one real run against the live APIs.guru
  API, wall time 40.2s): **ok 2518**, cached 0, skipped-size 11, failed 0.
- **Parse failures** (`extract.mjs` over the 2518 fetched spec files):
  **0**.
- **Providers / ops after the hold-out exclusion** (twilio.com, stripe.com,
  github.com, box.com, pagerduty.com, adyen.com — exact provider-prefix
  match, i.e. the index key's substring before the first `:`):
  - Included: **2435 index keys ("APIs"), 71829 ops**, spanning **667
    distinct providers**.
  - Removed by the exclusion: **77 index keys, 10315 ops** — this is much
    larger than "6 providers" because several of the excluded vendors
    ship many sub-APIs under the same provider prefix (e.g. `twilio.com:*`
    has 46 index keys, `adyen.com:*` has 24, `github.com:ghes-*` has 12).
  - Pre-exclusion total: 2512 index keys, 82144 ops. (2512, not 2518 — 6
    fetched spec files had no usable `paths` object and contributed 0 ops
    either way; see "Judgment calls" below.)

- **Top-3 providers by op count, share of total (post-exclusion) ops:**
  1. `amazonaws.com` — 13198 ops (18.37%)
  2. `azure.com` — 8083 ops (11.25%)
  3. `googleapis.com` — 5897 ops (8.21%)

  (Provider here means the aggregated prefix before the first `:`, the
  same granularity used for the `providers` / `perprov_*` columns in
  leans.csv — not the 2435 individual index keys, several of which belong
  to the same provider, e.g. `amazonaws.com:ec2`, `amazonaws.com:s3`, ...)

## Readout tables (position = `lead`, `providers >= 3`, share computed as `perprov_<method> / sum(perprov across the 7 methods)`)

Denominator note: shares below use **perprov** (distinct-provider) counts,
not raw op counts, so one API with thousands of GET operations for a
generic token like `get` cannot single-handedly dominate the share.

### (a) GET 90%+ of the time — 26 tokens found, all shown (no truncation)

| token | providers | ops_total | GET share |
|---|---|---|---|
| retrieve | 49 | 411 | 92.0% |
| all | 16 | 69 | 100.0% |
| status | 15 | 18 | 93.3% |
| health | 12 | 34 | 91.7% |
| a | 8 | 34 | 100.0% |
| current | 6 | 19 | 100.0% |
| balance | 6 | 7 | 100.0% |
| listing | 4 | 16 | 100.0% |
| are | 4 | 14 | 100.0% |
| region | 4 | 9 | 100.0% |
| see | 4 | 9 | 100.0% |
| latest | 4 | 7 | 100.0% |
| geocode | 4 | 6 | 100.0% |
| metadata | 4 | 6 | 100.0% |
| spec | 4 | 4 | 100.0% |
| usage | 3 | 23 | 100.0% |
| movie | 3 | 12 | 100.0% |
| dealer | 3 | 10 | 100.0% |
| trending | 3 | 6 | 100.0% |
| daily | 3 | 5 | 100.0% |
| default | 3 | 5 | 100.0% |
| browse | 3 | 4 | 100.0% |
| fare | 3 | 4 | 100.0% |
| fetches | 3 | 4 | 100.0% |
| currency | 3 | 3 | 100.0% |
| sample | 3 | 3 | 100.0% |

Note `get` itself does NOT appear in this table: its perprov GET share is
369/(369+70+2+0+0+0+1) = 83.5%, below the 90% cut — its (thin but
nonzero) POST tail is spread across 70 distinct providers, enough to pull
the perprov-share under 90% even though 369 of 377 providers use it at
all. Some single-letter/stopword-ish tokens (`a`, `are`, `see`) leaked through
tokenization of operationIds/summaries — see "Judgment calls."

### (b) POST 90%+ of the time — 31 tokens found, all shown (no truncation)

| token | providers | ops_total | POST share |
|---|---|---|---|
| post | 73 | 2517 | 95.9% |
| register | 32 | 90 | 91.4% |
| publish | 14 | 30 | 93.3% |
| invite | 14 | 19 | 100.0% |
| execute | 10 | 23 | 100.0% |
| authenticate | 9 | 13 | 100.0% |
| detect | 8 | 30 | 100.0% |
| clone | 8 | 15 | 100.0% |
| approve | 6 | 11 | 100.0% |
| recognize | 5 | 11 | 100.0% |
| shutdown | 5 | 5 | 100.0% |
| poll | 4 | 8 | 100.0% |
| grant | 4 | 7 | 100.0% |
| process | 4 | 6 | 100.0% |
| rebuild | 4 | 5 | 100.0% |
| capture | 4 | 4 | 100.0% |
| lookup | 3 | 9 | 100.0% |
| classify | 3 | 8 | 100.0% |
| insert | 3 | 8 | 100.0% |
| duplicate | 3 | 6 | 100.0% |
| evaluate | 3 | 6 | 100.0% |
| redact | 3 | 5 | 100.0% |
| resize | 3 | 5 | 100.0% |
| forget | 3 | 4 | 100.0% |
| rank | 3 | 4 | 100.0% |
| serp | 3 | 4 | 100.0% |
| buy | 3 | 3 | 100.0% |
| install | 3 | 3 | 100.0% |
| launch | 3 | 3 | 100.0% |
| refund | 3 | 3 | 100.0% |
| suppress | 3 | 3 | 100.0% |

### (c) Split — no single method's perprov share exceeds 60% — 257 tokens found, top 40 by providers shown (truncated)

| token | providers | ops_total | max method share |
|---|---|---|---|
| update | 188 | 2783 | 52.9% |
| set | 61 | 244 | 50.7% |
| cancel | 49 | 157 | 47.5% |
| check | 43 | 123 | 52.1% |
| user | 35 | 396 | 30.5% |
| change | 34 | 128 | 51.2% |
| export | 32 | 134 | 55.6% |
| account | 27 | 287 | 40.6% |
| stop | 26 | 171 | 42.4% |
| query | 22 | 111 | 46.4% |
| test | 20 | 111 | 56.7% |
| revoke | 19 | 36 | 52.4% |
| product | 17 | 219 | 43.2% |
| modify | 17 | 57 | 52.6% |
| replace | 16 | 132 | 55.6% |
| edit | 16 | 89 | 55.0% |
| file | 15 | 114 | 31.4% |
| bulk | 15 | 60 | 52.0% |
| mark | 15 | 39 | 45.0% |
| log | 15 | 38 | 47.8% |
| clear | 15 | 34 | 50.0% |
| api | 14 | 547 | 54.2% |
| order | 14 | 86 | 29.0% |
| image | 14 | 83 | 37.0% |
| report | 13 | 53 | 53.3% |
| email | 13 | 40 | 36.0% |
| accept | 13 | 37 | 60.0% |
| app | 12 | 610 | 30.3% |
| service | 12 | 328 | 34.4% |
| payment | 12 | 59 | 44.0% |
| new | 12 | 45 | 50.0% |
| ping | 12 | 16 | 53.8% |
| tag | 11 | 266 | 30.8% |
| project | 11 | 180 | 31.3% |
| notification | 11 | 136 | 29.0% |
| schedule | 11 | 46 | 47.1% |
| client | 11 | 43 | 40.0% |
| rename | 11 | 15 | 45.5% |
| contact | 10 | 150 | 31.3% |
| device | 10 | 117 | 33.3% |

## Specific check — 22 tokens, position = `lead`, pre-cut (before the `providers >= 3` filter)

All values below are `providers` / `ops_total` / raw per-method / perprov
per-method, methods in order GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.

| token | providers | ops_total | raw (G/PO/PU/PA/D/H/O) | perprov (G/PO/PU/PA/D/H/O) |
|---|---|---|---|---|
| get | 377 | 12908 | 11879/1026/2/0/0/0/1 | 369/70/2/0/0/0/1 |
| list | 136 | 3080 | 2027/1039/4/0/10/0/0 | 131/16/3/0/2/0/0 |
| create | 213 | 2809 | 24/2623/160/2/0/0/0 | 11/209/19/1/0/0/0 |
| update | 188 | 2783 | 17/840/1537/386/3/0/0 | 3/62/138/57/1/0/0 |
| delete | 217 | 3354 | 7/717/6/0/2624/0/0 | 4/29/2/0/205/0/0 |
| send | 49 | 142 | 12/122/7/0/1/0/0 | 6/45/5/0/1/0/0 |
| ask | — | — | — | **ABSENT** |
| query | 22 | 111 | 75/32/1/1/2/0/0 | 13/12/1/1/1/0/0 |
| search | 93 | 573 | 473/100/0/0/0/0/0 | 78/24/0/0/0/0/0 |
| verify | 30 | 66 | 9/51/6/0/0/0/0 | 7/23/4/0/0/0/0 |
| check | 43 | 123 | 68/51/0/1/0/3/0 | 20/25/0/1/0/2/0 |
| validate | 28 | 44 | 13/31/0/0/0/0/0 | 11/20/0/0/0/0/0 |
| generate | 43 | 100 | 28/72/0/0/0/0/0 | 16/34/0/0/0/0/0 |
| reboot | 3 | 11 | 0/10/1/0/0/0/0 | 0/3/1/0/0/0/0 |
| terminate | 3 | 11 | 0/10/1/0/0/0/0 | 0/2/1/0/0/0/0 |
| cancel | 49 | 157 | 3/87/22/5/40/0/0 | 2/28/7/3/19/0/0 |
| answer | — | — | — | **ABSENT** |
| submit | 18 | 34 | 0/31/2/1/0/0/0 | 0/16/2/1/0/0/0 |
| pay | 1 | 1 | 0/1/0/0/0/0/0 | 0/1/0/0/0/0/0 |
| confirm | 15 | 50 | 2/26/1/20/1/0/0 | 2/11/1/1/1/0/0 |
| retrieve | 49 | 411 | 403/8/0/0/0/0/0 | 46/4/0/0/0/0/0 |
| subscribe | 11 | 22 | 1/15/6/0/0/0/0 | 1/9/2/0/0/0/0 |

**Absent from leans.csv entirely at position=lead:** `ask`, `answer`. Every
other one of the 22 tokens was found. (`pay` and `reboot`/`terminate`
appear but with `providers` below the 3-cut, so they are in `leans.csv`
proper but not in the repo copy `corpus-leans.csv`.)

## Judgment calls / deviations from the brief

- **6 fetched spec files had no usable `paths` object** and were skipped
  by `extract.mjs` before being counted toward either the included or
  excluded API tally (so 2518 fetched files but 2512 counted APIs
  pre-exclusion). This wasn't explicitly specified; treating a spec with
  no `paths` as contributing zero ops and zero to the API count (rather
  than counting it as an "included API with 0 ops") seemed the more
  honest reading, since it never touches the corpus leans either way.
- **"Top-3 providers by op count"** was read as the aggregated provider
  prefix (before the first `:`) — the same granularity as leans.csv's
  `providers` column — rather than the 2435 individual index keys (many
  of which, e.g. `amazonaws.com:ec2` / `amazonaws.com:s3`, share one
  provider). Reported both readings above for the top-3 list to make the
  choice visible.
- **Tie-breaking** in leans.csv/table sorts: `providers` desc, then
  `ops_total` desc, then `token` asc — exactly as specified in the brief,
  no deviation.
- **Tokenization edge cases:** a handful of thin, low-provider `lead`
  tokens are single letters or stopword-like fragments (`a`, `are`,
  `see`) — these come from operationId/summary fallback tokenization
  exactly as specified (first sub-token of the first word), not a bug;
  flagged in table (a) above rather than filtered out, since the brief
  didn't ask for a stopword list and adding one unasked would be scope
  creep.
- **Stemming**: implemented literally per the brief's two-pass rule
  (raw token frequency set built first, then a token matching
  `/^.{3,}s$/` is replaced by its singular only if that singular is
  itself present somewhere in the raw token set). No additional stemming
  heuristics added.
