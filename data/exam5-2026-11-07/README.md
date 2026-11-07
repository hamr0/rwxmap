# Shared clean exam #5 - frozen inputs

Status: INPUTS FROZEN. NOT LABELLED. Nothing here has been run through any
rwxmap classifier, the CLI or rwxlite; no letters exist before truth is built.
Retrieved 2026-11-07 UTC (see `sources.json` for exact timestamps, final URLs,
commit SHAs and sha256 of the original bytes).

Rule (D132): each spec is the vendor's OWN official OpenAPI, from the vendor's
domain or the vendor's official GitHub org. Not APIs.guru, no mirrors, no
GraphQL/IDL. Files in `specs/` are the original bytes, untouched, except paddle
(over 5 MB), which is gzipped (see below). GitHub-hosted specs are fetched from
raw.githubusercontent.com at the commit SHA (immutable); the branch it came
from is recorded beside the SHA. Every fetched sha256 equalled the shortlist's
`results.json`; the four GitHub ones and weaviate also equalled the earlier
scratch copies.

Counts come from `src/load.js` (loadSpec) on each file. An operation = a path
item key that is an HTTP method. Uniqueness is asserted on (provider, METHOD,
raw path); nothing is deduped by collapsing `{param}`.

| vendor | provider | API | version | pinned source | ops raw | collapsed-param pairs | method split (raw) | no operationId | no summary | deprecated |
|---|---|---|---|---|---|---|---|---|---|---|
| front | frontapp.com | Front Core API | openapi 3.0.0, info 1.0.0 | frontapp/front-api-specs main, commit 7a62cc93709d34b602910145090f1880ab062ecb, core-api/core-api.json | 246 | 0 | GET 124, POST 71, PATCH 23, DELETE 27, PUT 1 | 0 | 0 | 11 |
| planetscale | planetscale.com | PlanetScale API | swagger 2.0, info v1 | api.planetscale.com/v1/openapi-spec (no redirect, retrieved 2026-11-07T15:05:02.531Z) | 291 | 0 | GET 149, POST 64, DELETE 40, PATCH 30, PUT 8 | 0 | 0 | 0 |
| paddle | paddle.com | Paddle API (Billing v1) | openapi 3.1.0, info 1.0 | PaddleHQ/paddle-openapi main, commit c8207382fa0fa660620a02a23a6a2806ae8894fb, v1/openapi.yaml | 126 | 0 | GET 71, POST 29, PATCH 23, DELETE 3 | 0 | 0 | 0 |
| hookdeck | hookdeck.com | Hookdeck Admin REST API (2025-01-01) | openapi 3.0.1, info 1.0.0 | api.hookdeck.com/2025-01-01/openapi (no redirect, retrieved 2026-11-07T15:05:01.291Z) | 135 | 0 | GET 61, PUT 38, POST 25, DELETE 11 | 0 | 0 | 0 |
| fusionauth | fusionauth.io | FusionAuth API | openapi 3.0.3, info 1.70.0 | FusionAuth/fusionauth-openapi main, commit f9889ee0457daa76749aff68213c23d6c18d1930, openapi.yaml | 364 | 0 | GET 107, POST 138, PUT 44, DELETE 43, PATCH 32 | 0 | 364 | 0 |
| semaphore | semaphoreui.com | Semaphore API | swagger 2.0, info 2.16.14 | semaphoreui/semaphore develop, commit ee38ce6eb04657cbce12fb4882fe680870b33778, api-docs.yml | 155 | 0 | GET 68, POST 40, DELETE 27, PUT 20 | 155 | 0 | 0 |
| weaviate | weaviate.io | Weaviate REST API | swagger 2.0, info 1.41.0-dev | weaviate/weaviate main, commit 60409d842c2949fd7e67f774ad690784283dc4ae, openapi-specs/schema.json | 126 | 0 | GET 43, POST 48, DELETE 19, PUT 11, HEAD 3, PATCH 2 | 1 | 2 | 10 |
| total | | | | | 1443 | 0 | | 156 | 366 | 21 |

(The "no operationId", "no summary" and "deprecated" columns were counted over the same op set; they are informational and not enforced by the build script.)

## Issues and judgment calls

- Order and ids follow exam #4's code: rows are sorted by provider domain, then
  path, then method; ids are `ex5-0001` onward. The first rows are frontapp.com.
- langfuse was dropped (user ruling). Its official spec
  (`cloud.langfuse.com/generated/api/openapi.yml`, 120 ops) is rejected by
  `src/load.js` because the loader's default YAML alias cap (D106) trips on its
  about 146 aliases; the shortlist counted it with the cap disabled
  (`maxAliasCount: -1`). weaviate replaced it. The loader was not changed.
- paddle is 7,937,575 bytes, over 5 MB, so it is stored as `specs/paddle.yaml.gz`
  (`gzip -n -9` of the original; the plain file was removed). In `sources.json`
  `sha256` and `bytes` are of the UNCOMPRESSED original; `sha256_gz`
  (`fd3d27f3f029db60f9a9741dad9b8211654c12b315f91a33698e716f67f77015`) and
  `bytes_gz` (782,653) describe the file on disk. `loadSpec` hashes the bytes on
  disk, so `build-ops.mjs` compares against `sha256_gz` when present, else
  `sha256` (the only change from exam #4's script besides the vendor list and
  ids). `loadSpec` reads the gzip directly.
- Provider values are the vendor's registrable domain. frontapp.com is the
  `api2.frontapp.com` server host (the product is Front). semaphoreui.com has no
  host in the spec (`basePath /api` only); it is taken from the GitHub org
  `semaphoreui` and the site, confirmed by the user. weaviate.io is from the
  spec's contact email; the spec has no host (`basePath /v1`). planetscale.com
  is the swagger host's domain. fusionauth.io is from its sandbox server.
- Swagger 2.0 specs (planetscale, semaphore, weaviate) have no `servers`; they
  load like any other spec.
- Branch pins: front, paddle, fusionauth and weaviate come from `main`;
  semaphore from `develop`. No release tags were checked; the commit SHA is the
  pin. weaviate's info version is `1.41.0-dev` (a development snapshot).
- Semaphore has no operationId on any of its 155 ops; fusionauth has no summary
  on any of its 364. Both kept as published.
- Specs hold 21 deprecated ops (front 11, weaviate 10), all kept; deprecated is
  not a filter.
- One spec file per vendor was used; other official APIs a vendor may publish
  were not checked. Counts are of the specs as published; no external `$ref` was
  followed (loader policy D106).

## Frozen ops

- Date: 2026-11-07.
- Script: `build-ops.mjs` (loads `specs/` with `src/load.js`, checks each spec's sha256 against `sources.json`, writes `ops.csv` and `ops.csv.sha256`; deterministic, two runs byte-identical).
- Rows: 1443 total. frontapp.com 246, fusionauth.io 364, hookdeck.com 135, paddle.com 126, planetscale.com 291, semaphoreui.com 155, weaviate.io 126.
- sha256 of ops.csv: `f6e245ed8e6953b8a7170a0bf6b6a371860460fc7206db6a5cbe23fbba1f26ea`
- Brand aliases (for excluding these vendors from future draws): frontapp.com = front, frontapp, api2.frontapp.com; planetscale.com = planetscale, api.planetscale.com; paddle.com = paddle, paddlehq, sandbox-api.paddle.com, api.paddle.com; hookdeck.com = hookdeck, api.hookdeck.com; fusionauth.io = fusionauth, sandbox.fusionauth.io; semaphoreui.com = semaphore, semaphoreui; weaviate.io = weaviate.
- Leakage checks must match on the provider/vendor fields (and registrable domain labels), never on free text: front, paddle and semaphore are ordinary words and appear in descriptions of other vendors' specs.
