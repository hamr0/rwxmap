# Shared clean exam #6 - frozen inputs

Status: INPUTS FROZEN. NOT LABELLED. Nothing here has been run through any
rwxmap classifier, the CLI or rwxlite; no letters exist before truth is built.
Retrieved 2026-11-08 UTC (see `sources.json` for exact timestamps, final URLs,
commit SHAs and sha256 of the original bytes).

Rule (D132): each spec is the vendor's OWN official OpenAPI, from the vendor's
domain or the vendor's official GitHub org. Not APIs.guru, no mirrors, no
GraphQL/IDL. Files in `specs/` are the original bytes, untouched; none is over
5 MB, so none is gzipped. GitHub-hosted specs are fetched from
raw.githubusercontent.com at the commit SHA (immutable); the branch it came from
is recorded beside the SHA. cloudsmith is fetched from its vendor API host
(`api.cloudsmith.io`), a live URL with no commit, so its sha256 is the only pin.
Every fetched sha256 equalled the shortlist's `poc/exam6-shortlist/results.json`
and the earlier scratch copies.

Counts come from `src/load.js` (loadSpec) on each file. An operation = a path
item key that is an HTTP method. Uniqueness is asserted on (provider, METHOD,
raw path); nothing is deduped by collapsing `{param}`.

| vendor | provider | API | version | pinned source | ops raw | collapsed-param pairs | method split (raw) | no operationId | no summary | deprecated |
|---|---|---|---|---|---|---|---|---|---|---|
| grafana | grafana.com | Grafana HTTP API | openapi 3.0.3, info 0.0.1 | grafana/grafana main, commit 80b97080eb103911ad0bc56d858e3cc0966950ea, public/openapi3.json | 314 | 0 | GET 143, POST 81, DELETE 44, PUT 35, PATCH 11 | 0 | 18 | 64 |
| nocodb | nocodb.com | nocodb | openapi 3.1.0, info 1.0 | nocodb/nocodb develop, commit 86760b0bd01b99625c93ac00c550a6498ea96e3c, packages/nocodb/src/schema/swagger.json | 279 | 1 | GET 111, POST 100, PATCH 37, DELETE 31 | 1 | 3 | 0 |
| radarr | radarr.video | Radarr | openapi 3.0.4, info 3.0.0 | Radarr/Radarr develop, commit a8d55ddd7ab318081d60cd3351f60aa3697fc9b6, src/Radarr.Api.V3/openapi.json | 240 | 0 | GET 127, POST 46, PUT 36, DELETE 30, HEAD 1 | 240 | 240 | 2 |
| cloudsmith | cloudsmith.io | Cloudsmith API (v1) | swagger 2.0, info v1 | api.cloudsmith.io/v1/?format=openapi (final URL api.cloudsmith.io/v1/openapi/?format=openapi, retrieved 2026-11-08T19:38:12Z), sha256 pin only | 376 | 0 | POST 137, GET 129, PATCH 42, DELETE 37, PUT 31 | 0 | 5 | 5 |
| invoiceninja | invoiceninja.com | Invoice Ninja API Reference | openapi 3.0.1, info 5.12.55 | invoiceninja/invoiceninja v5-stable, commit 15f56bc9fc4c02c18b07e450e18b76bbe893b4f8, openapi/api-docs.yaml | 379 | 0 | GET 156, POST 155, DELETE 35, PUT 33 | 0 | 0 | 5 |
| total | | | | | 1588 | 1 | | 241 | 266 | 76 |

(The "no operationId", "no summary" and "deprecated" columns were counted over the same op set; they are informational and not enforced by the build script.)

## Issues and judgment calls

- Order and ids follow exam #5's code: rows are sorted by provider domain, then
  path, then method; ids are `ex6-0001` onward. The first rows are cloudsmith.io.
- The shortlist counted 1,587 deduped ops. This build keeps raw ops, so the total
  is 1,588: nocodb has one pair of paths that differ only in a parameter name
  (279 raw, 278 deduped). Both rows are kept, as exam #5 did.
- Provider values are the vendor's registrable domain. grafana.com is the spec's
  contact (`hello@grafana.com`; its servers are relative `/api`). nocodb.com is
  the server `app.nocodb.com`. cloudsmith.io is the swagger host
  `api.cloudsmith.io`. invoiceninja.com is the contact email and the demo server
  `demo.invoiceninja.com`. radarr.video is the user's ruling: the radarr spec has
  only a localhost server template and no contact, so no domain in the spec says
  otherwise.
- radarr has no operationId and no summary on any of its 240 ops; nocodb has one
  op without operationId. Kept as published.
- Specs hold 76 deprecated ops (grafana 64, cloudsmith 5, invoiceninja 5, radarr
  2), all kept; deprecated is not a filter.
- radarr has one HEAD op. Swagger 2.0 cloudsmith has no `servers`; it loads like
  any other spec.
- One spec file per vendor was used; other official APIs a vendor may publish
  were not checked. Counts are of the specs as published; no external `$ref` was
  followed (loader policy D106).
- Specs were also fetched for baserow and ringcentral during shortlisting; they
  are not part of this exam and are not copied here.

## Frozen ops

- Date: 2026-11-08.
- Script: `build-ops.mjs` (loads `specs/` with `src/load.js`, checks each spec's sha256 against `sources.json`, writes `ops.csv` and `ops.csv.sha256`; deterministic, two runs byte-identical).
- Rows: 1588 total. cloudsmith.io 376, grafana.com 314, invoiceninja.com 379, nocodb.com 279, radarr.video 240.
- sha256 of ops.csv: `4a4854fad8bd1a3fdc57ff23bb3e9c6eb7d0ab7dc8d5f1d7947c87b0b346233d`
- Brand aliases (for excluding these vendors from future draws): grafana.com = grafana, grafana labs; nocodb.com = nocodb, app.nocodb.com; radarr.video = radarr; cloudsmith.io = cloudsmith, api.cloudsmith.io; invoiceninja.com = invoiceninja, invoice ninja, invoicing.co.
- Leakage checks must match on the provider/vendor fields (and registrable domain labels), never on free text: the names appear in descriptions of other vendors' specs.
