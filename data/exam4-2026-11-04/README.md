# Shared clean exam #4 - frozen inputs (D135 next-model gate)

Status: INPUTS FROZEN. NOT LABELLED. Nothing here has been run through any
rwxmap classifier, the CLI or rwxlite; no letters exist before truth is built.
Retrieved 2026-11-04 UTC (see `sources.json` for exact timestamps, final URLs,
commit SHAs and sha256 of the original bytes).

Rule (D132): each spec is the vendor's OWN official OpenAPI, from the vendor's
domain or the vendor's official GitHub org. Not APIs.guru, no mirrors, no
GraphQL/IDL. Files in `specs/` are the original bytes, untouched (none exceeded
5 MB, so none gzipped). GitHub-hosted specs are fetched from
raw.githubusercontent.com at the commit SHA (immutable); the tag or branch it
came from is recorded beside the SHA.

Counts come from `src/load.js` (loadSpec) on each file. An operation = a path
item key that is an HTTP method. As in exam #3, uniqueness is asserted on
(provider, METHOD, raw path); nothing is deduped by collapsing `{param}`.

| vendor | provider | API | version | pinned source | ops raw | collapsed-param pairs | method split (raw) | no operationId | no summary | deprecated |
|---|---|---|---|---|---|---|---|---|---|---|
| permit | permit.io | Permit.io API | openapi 3.1.0, info 2.0.0 | api.permit.io/v2/openapi.json (no redirect, retrieved 2026-11-04T21:01:59.916Z) | 263 | 0 | GET 113, POST 61, PUT 22, PATCH 21, DELETE 46 | 0 | 0 | 8 |
| immich | immich.app | Immich | openapi 3.0.0, info 3.3.6 | immich-app/immich tag v3.3.6, commit 587f549f46f1cd1822a06e16dcccecef04ea4565, open-api/immich-openapi-specs.json | 279 | 0 | GET 124, POST 66, PUT 43, PATCH 2, DELETE 44 | 0 | 0 | 24 |
| polar | polar.sh | Polar API | openapi 3.1.0, info 2026-10 | polarsource/polar main, commit 338031ae9df5294a4622e08515c8e8fcb02d0639, docs/openapi/2026-10.openapi.json | 190 | 0 | GET 94, POST 50, PUT 1, PATCH 26, DELETE 19 | 0 | 0 | 0 |
| harbor | goharbor.io | Harbor API v2.0 | swagger 2.0, info 2.0 | goharbor/harbor tag v2.15.4, commit 0a6bf30d54e779962ad5b862fc67e3e9f6b010d8, api/v2.0/swagger.yaml | 203 | 0 | GET 114, POST 34, PUT 31, PATCH 4, DELETE 19, HEAD 1 | 0 | 2 | 3 |
| zulip | zulip.com | Zulip REST API | openapi 3.0.1, info 1.0.0 | zulip/zulip tag 12.3 ("Zulip Server 12.3"), commit b31982251ff82d0b02e59f63ad21f19204e37aea, zerver/openapi/zulip.yaml | 161 | 2 (GET, PATCH) | GET 48, POST 65, PUT 1, PATCH 21, DELETE 26 | 1 | 1 | 9 |
| chatwoot | chatwoot.com | Chatwoot | openapi 3.1.0, info 1.1.0 | chatwoot/chatwoot tag v4.19.1, commit caab07a8f00032d5205b5a5d7e2eb0ba2f3d2d82, swagger/swagger.json | 157 | 0 | GET 67, POST 45, PUT 2, PATCH 24, DELETE 19 | 0 | 0 | 0 |
| render | render.com | Render Public API | openapi 3.0.2, info 1.0.0 | api-docs.render.com/openapi/render-public-api-1.json (no redirect, retrieved 2026-11-04T21:02:01.607Z) | 252 | 0 | GET 124, POST 56, PUT 16, PATCH 20, DELETE 36 | 0 | 0 | 8 |
| total | | | | | 1505 | 2 | | 1 | 3 | 52 |

(The "no summary" and "deprecated" columns were counted over the same op set; they are informational and not enforced by the build script.)

## Issues and judgment calls

- Order and ids follow exam #3's code, not the first brief: rows are sorted
  by provider domain, then path, then method; ids are `ex4-0001` onward. So
  the first rows are chatwoot.com, not permit.io.
- Collapsed-param pairs, kept as distinct routes (exam #3 rule: no
  collapsing). Zulip only: `GET /users/{email}` and `GET /users/{user_id}`,
  and `PATCH /users/{email}` and `PATCH /users/{user_id}`. They are distinct
  paths in the spec, likely real alternate routes; 2 pairs, 4 rows. No other
  vendor has any.
- harbor pin: v2.15.4, not v2.14.6. v2.14.6 is GitHub's "Latest" release, but
  its `api/v2.0/swagger.yaml` has an unclosed single quote at line 7327 and
  does not load in `src/load.js`. v2.15.4 is the newest release tried whose
  spec loads (main also loads, but a tag is preferred to a moving branch).
  Swagger 2.0 loads like any other spec; the spec has host `localhost` and no
  `servers`.
- immich pin: latest full release tag v3.3.6, not `main` (3.4.0-rc.0). It has
  279 ops, against the shortlist's 287, which was counted on the rc.
- chatwoot: the spec file exists at the latest release tag v4.19.1, so
  `develop` was not used.
- polar: 2026-10 snapshot at the main SHA. 2027-01 is future-dated and not
  used; the live `api.polar.sh/openapi.json` 404s, so the repo snapshot is
  the pin.
- zulip: latest release tag 12.3 (the file exists there). 161 ops, against
  the shortlist's 165 deduped at main, because the tag is older than main.
  The server list includes dev entries (localhost, testserver). 1 op has
  neither operationId nor summary.
- harbor: 2 ops lack a summary (operationId present on all).
- permit.io and render.com are served from vendor hosts; neither redirected,
  so the final URL equals the source URL. Their versions are not tied to a
  tag; the sha256 in `sources.json` is the pin.
- Provider values are the vendor's registrable domain as asked. immich.app is
  the project's site (the project runs on `immich-app` GitHub org); polar.sh
  hosts the API at api.polar.sh; goharbor.io is Harbor's site (the spec has no
  host of its own).
- One spec file per vendor was used; other official APIs a vendor may publish were not checked. Counts are of the specs as published; no external `$ref` was followed (loader policy D106).
- Specs hold 52 deprecated ops, all kept; deprecated is not a filter.

## Frozen ops

- Date: 2026-11-04.
- Script: `build-ops.mjs` (loads `specs/` with `src/load.js`, checks each spec's sha256 against `sources.json`, writes `ops.csv` and `ops.csv.sha256`; deterministic, two runs byte-identical).
- Rows: 1505 total. permit.io 263, immich.app 279, polar.sh 190, goharbor.io 203, zulip.com 161, chatwoot.com 157, render.com 252.
- sha256 of ops.csv: `e9836ff2f9e8288e3721f97506ed666b871a3486f7b781c544b5234a0b5da0b4`
- Brand aliases (for excluding these vendors from future draws): permit.io = permit, permitio, api.permit.io; immich.app = immich, immich-app; polar.sh = polar, polarsource, polar-sh, app.polar.sh, api.polar.sh, sandbox-api.polar.sh; goharbor.io = harbor, goharbor; zulip.com = zulip, zulipchat.com, chat.zulip.org; chatwoot.com = chatwoot, app.chatwoot.com; render.com = render, onrender.com, api.render.com, api-docs.render.com.
- Leakage checks must match on the provider/vendor fields (and registrable domain labels), never on free text: render, polar, harbor and paddle are ordinary words and appear in descriptions of other vendors' specs (rwxlite's suggestion).

- `truth-d136.csv`: a derived copy for D136 (restart is w). Two rows changed, ex4-1237 and ex4-1308, x to w; nothing else differs. `truth.csv` remains the scored record and every committed score uses `truth.csv`. The copy is for rwxlite round 12 training/testing and is never used to re-score this exam.
