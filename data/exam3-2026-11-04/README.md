# Shared clean exam #3 - candidate inputs (D133)

Status: CANDIDATES. NOT FROZEN. NOT LABELLED. No ops.csv exists yet, and
nothing here has been run through any rwxmap classifier. Fetched and counted
only (retrieved 2026-11-04, UTC; see `sources.json` for exact timestamps,
final URLs and sha256 of the original bytes).

Rule (D132): each spec is the vendor's OWN official OpenAPI, taken from the
vendor's domain or the vendor's official GitHub org. Not APIs.guru, no
third-party mirrors, no GraphQL/IDL. Files in `specs/` are the original
bytes, untouched (none exceeded 5 MB, so none gzipped).

Counts come from `src/load.js` (loadSpec) on each file. An operation = a
path item key that is an HTTP method. Dedupe key = (METHOD, path with every
`{param}` collapsed to `{}`).

| vendor | API | version | source | ops raw | ops deduped | dups removed | method split (raw) | no operationId | no summary |
|---|---|---|---|---|---|---|---|---|---|
| clerk | Clerk Backend API | openapi 3.0.3, info 2026-08-20 | raw.githubusercontent.com/clerk/openapi-specs/main/bapi/2026-08-20.yml | 263 | 263 | 0 | GET 87, POST 97, PUT 10, PATCH 29, DELETE 40 | 0 | 0 |
| neon | Neon API v2 | openapi 3.0.3, info v2 | neon.tech/api_spec/release/v2.json (redirects to neon.com) | 193 | 193 | 0 | GET 79, POST 53, PUT 6, PATCH 22, DELETE 33 | 0 | 0 |
| supabase | Supabase Management API v1 | openapi 3.0.0, info 1.0.0 | api.supabase.com/api/v1-json | 170 | 170 | 0 | GET 77, POST 49, PUT 9, PATCH 16, DELETE 18, HEAD 1 | 0 | 0 |
| mux | Mux API (Video + Data) | openapi 3.1.0, info v1 | www.mux.com/api-spec.json | 192 | 192 | 0 | GET 107, POST 50, PUT 12, PATCH 5, DELETE 18 | 0 | 0 |
| netbird | NetBird REST (Management) API | openapi 3.1.0, info 0.0.1 | raw.githubusercontent.com/netbirdio/netbird/main/shared/management/http/api/openapi.yml | 231 | 231 | 0 | GET 98, POST 56, PUT 37, DELETE 40 | 177 | 0 |
| ory | Ory Network API ("Ory APIs", all public + admin) | openapi 3.0.3, info v1.22.91 | raw.githubusercontent.com/ory/sdk/master/spec/client/v1.22.91.json | 179 | 179 | 0 | GET 80, POST 46, PUT 18, PATCH 9, DELETE 26 | 0 | 0 |
| novu | Novu API | openapi 3.0.0, info 3.19.2 | api.novu.co/openapi.json | 149 | 149 | 0 | GET 46, POST 50, PUT 7, PATCH 24, DELETE 22 | 0 | 0 |
| total | | | | 1377 | 1377 | 0 | | 177 | 0 |

## Issues and judgment calls

- Several vendors publish more than one official REST API; only the main
  one was downloaded. Alternates (counted, not downloaded into `specs/`):
  - clerk: Frontend API (github clerk/openapi-specs fapi/2026-08-20.yml, 214 ops);
    Platform API (platform/beta.yml, 70 ops, BETA).
  - supabase: Storage (108 ops), Auth/gotrue (21, swagger 2.0), Analytics/logflare (18),
    Functions (18, identical title and count to analytics - looks like a copy);
    all in github supabase/supabase apps/docs/spec. The Management API
    (170 ops) is the one downloaded; its op count and method split match the
    docs-repo copy api_v1_openapi.json.
  - ory: the downloaded file is the unified Ory Network spec (Kratos,
    Hydra, Keto, projects/admin). Separate self-hosted specs in ory/sdk:
    kratos 56, hydra 50, keto 15 ops. Use the unified one, not both.
- netbird: 177 of 231 ops have no operationId (the spec simply omits them);
  summaries are present on all. Matters for any step that reads operationId.
- ory: the spec file path is `spec/client/v1.22.91.json`, which is what the
  repo's `spec/client/latest` pointer names at fetch time (ory/sdk is the
  official Ory org). The folder also holds a stray `false.json` (ignored).
- clerk: bapi/2026-08-20.yml and 2026-05-12.yml are the same size; the
  newest dated file was taken. Older dated versions exist in the repo.
- supabase v1: one HEAD op is counted as a method (HEAD 1). No OPTIONS/TRACE
  present in any downloaded spec.
- novu: spec mixes /v1 and /v2 routes of the same resources (v1 + v2
  subscribers, topics, etc.); they are distinct paths, so dedupe removed none.
- Zero duplicates after dedupe in all seven specs.
- Mux served from www.mux.com (docs.mux.com/api-spec.json 404s); that is the
  vendor's own domain. The GitHub org muxinc holds no raw spec repo.
- All seven pass the D132 rule: no vendor failed.
- Counts of ops are of the specs as published; no external `$ref` was
  followed (loader policy D106).

## Frozen ops

- Date: 2026-11-04.
- Script: `build-ops.mjs` (loads `specs/` with `src/load.js`, writes `ops.csv` and `ops.csv.sha256`; deterministic, two runs byte-identical).
- Rows: 1377 total. clerk.com 263, neon.com 193, supabase.com 170, mux.com 192, netbird.io 231, ory.sh 179, novu.co 149.
- sha256 of ops.csv: `fff7afa983c7fc85e2073e5662c4c317c69e37a1dd92a04c7e5dc04ecf43d790`
- Vendor list frozen 2026-11-04 (user approved, main API per vendor); already-seen scan clear by domain and bare name across rwxmap data/.
- Brand aliases (for excluding these vendors from future draws): neon.com = neon.tech (API host console.neon.tech); ory.sh = ory.com and oryapis.com (API host {project}.projects.oryapis.com); novu.co also eu.api.novu.co.
