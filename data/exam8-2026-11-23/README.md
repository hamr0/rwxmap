# Shared clean exam #8 - frozen inputs

Status: INPUTS FROZEN. NOT LABELLED. Nothing here has been run through any
rwxmap classifier, the CLI or rwxlite; no letters exist before truth is built.
Bytes fetched 2026-11-18 during shortlisting (`poc/exam7-shortlist/`, the six
`role=reserve` vendors in its `picked.tsv`); frozen 2026-11-23.
`sources.json` has the URLs, pins and sha256 of the original bytes. The
shortlist did not record fetch timestamps, so `retrieved_at` there says
"unknown" and notes that the local file mtime was not preserved.

exam #8 rwxmap code ref: TBD (set at prereg). Labellers: A = TBD (set at
prereg), B = TBD (set at prereg), blind, on
`data/relabel-v4-2026-11-05/BRIEF-v4.md` plus the D141 addendum
(`data/relabel-v4-2026-11-05/BRIEF-v4-addendum-D141.md`) and the D143 addendum
(bookings are x).

Rule (D132): each spec is the vendor's OWN official OpenAPI, from the vendor's
domain or the vendor's official GitHub org. Not APIs.guru, no mirrors, no
GraphQL/IDL. `specs/` holds the original bytes of all six, each gzipped
(`gzip -n -9`; GitHub push protection flagged placeholder values in exam #6
specs, so all six are gzipped up front). In `sources.json` `sha256` and `bytes`
are of the UNCOMPRESSED original; `sha256_gz` and `bytes_gz` describe the file
on disk. Every sha256 equalled `poc/exam7-shortlist/picked.tsv` and
`results.json`; the gunzipped files were checked byte-identical to the shortlist
copies. Nothing was re-fetched.

Counts come from `src/load.js` (loadSpec) on each file. An operation = a path
item key that is an HTTP method. Uniqueness is asserted on (provider, METHOD,
raw path); nothing is deduped by collapsing `{param}`.

| vendor | provider | API | version | pinned source | ops raw | collapsed-param pairs | method split (raw) | no operationId | no summary | deprecated |
|---|---|---|---|---|---|---|---|---|---|---|
| gitbook | gitbook.com | GitBook API | openapi 3.1.0, info 0.0.1-beta | https://api.gitbook.com/openapi.json (live URL, no commit), sha256 pin only | 403 | 0 | GET 204, POST 94, DELETE 45, PATCH 41, PUT 19 | 0 | 0 | 5 |
| baserow | baserow.io | Baserow API spec | openapi 3.0.3, info 2.4.3 | https://api.baserow.io/api/schema.json (live URL, no commit), sha256 pin only | 488 | 0 | GET 180, POST 176, PATCH 70, DELETE 56, PUT 6 | 0 | 488 | 0 |
| looker | looker.com | Looker API 4.0 Reference | openapi 3.0.0, info 4.0.26.24 | looker-open-source/sdk-codegen main, last commit touching file 4adbcc24b74b87b7aed567b257c6abac3e866e2e (2026-11-09), spec/Looker.4.0.oas.json | 502 | 0 | GET 238, POST 107, DELETE 69, PATCH 65, PUT 23 | 0 | 0 | 7 |
| wekan | wekan.team | WeKan REST API | swagger 2.0, info v13.15 | wekan/wekan main, last commit touching file c739eaeeee5d086d4f218090522b96e4358680a1 (2026-11-18), public/api/wekan.yml | 157 | 0 | GET 65, POST 47, PUT 25, DELETE 20 | 0 | 87 | 0 |
| shortcut | shortcut.com | Shortcut API | swagger 2.0, info 3.0 | https://developer.shortcut.com/api/rest/v3/shortcut.swagger.json (live URL, no commit), sha256 pin only | 143 | 0 | GET 70, POST 26, PUT 26, DELETE 21 | 0 | 0 | 6 |
| bitrise | bitrise.io | Bitrise API | swagger 2.0, info 0.1 | https://api-docs.bitrise.io/docs/swagger.json (live URL, no commit), sha256 pin only | 128 | 0 | GET 64, POST 31, DELETE 16, PATCH 12, PUT 5 | 0 | 0 | 2 |
| total | | | | | 1821 | 0 | | 0 | 575 | 20 |

(The "no operationId", "no summary" and "deprecated" columns were counted over the same op set; they are informational and not enforced by the build script.)

## Issues and judgment calls

- Order and ids follow exam #7's code: rows sorted by provider domain, then
  path, then method; ids are `ex8-0001` onward. The first rows are baserow.io.
- The shortlist counted 1,821 deduped ops (403+488+502+157+143+128). Raw equals
  deduped for every vendor, so the build total is also 1,821; no difference.
  There are 0 collapsed-param pairs.
- Provider values are registrable domains, a choice made for this build:
  gitbook.com (info.contact and termsOfService on gitbook.com; server default
  `https://api.gitbook.com`); baserow.io (spec URL host `api.baserow.io`; docs
  links on baserow.io; the spec has no servers); looker.com (see next bullet);
  wekan.team (see the wekan bullet); shortcut.com (URL host
  `developer.shortcut.com`, spec `host: api.app.shortcut.com`); bitrise.io
  (URL host `api-docs.bitrise.io`, spec `host: api.bitrise.io`, description
  "Official REST API for Bitrise.io").
- looker: the spec is the Looker SDK's own `Looker.4.0.oas.json`, published in
  Google's `looker-open-source` GitHub org (repo `sdk-codegen`). The only
  server is `https://localhost:20000/api/4.0`, the spec's docs link to
  `docs.cloud.google.com`. looker.com is the product's domain, a chosen
  provider value; the spec itself names no looker.com host. Looker is
  Google-owned; no "google" alias was used.
- wekan: neither the spec nor the shortlist data names `wekan.team`. The spec
  has no servers or host (`schemes: http` only) and its one link to the project
  is `https://github.com/wekan/wekan/issues/new`; `aliases.json` carries
  `wekan` and `wekan.github.io`. wekan.team is a user-specified project domain,
  not evidenced in any file on disk; no network check was made.
- GitHub pins are weaker than exam #6's: the bytes were fetched from the branch
  URL (`main`), not from a commit URL, and the recorded commit is the latest
  commit touching the file as of the survey (`pins.json`). If the file changed
  between survey and fetch the pin would not describe the bytes; the sha256 is
  the real pin. wekan's pinned commit is dated 2026-11-18, the survey day, and
  the file moves often. gitbook, baserow, shortcut and bitrise are live vendor
  URLs with no commit, so the sha256 is the only pin.
- baserow has no summary on any of its 488 ops (the largest spec, 7.5 MB);
  wekan lacks a summary on 87 of 157. Kept as published.
- Specs hold 20 deprecated ops (gitbook 5, looker 7, shortcut 6, bitrise 2),
  all kept; deprecated is not a filter.
- wekan and shortcut have no PATCH ops; gitbook's version string is
  `0.0.1-beta`.
- One spec file per vendor was used; other official APIs a vendor may publish
  were not checked. Counts are of the specs as published; no external `$ref`
  was followed (loader policy D106).
- The six exam #7 vendors (ringcentral, openziti, gitness, huggingface,
  pipedrive, vikunja) are not part of this exam. Exam #8 uses the six reserve
  vendors held back at exam #7.
- Custody: no .gitignore for truth.csv or labelling/out/ (kept out by not
  running `git add` until scoring finished). Same here: do not `git add`
  truth.csv or labelling/out/ until both sides have scored.

## Frozen ops

- Date: 2026-11-23.
- Script: `build-ops.mjs` (loads `specs/` with `src/load.js`, checks each spec's sha256 against `sources.json`, writes `ops.csv` and `ops.csv.sha256`; deterministic, two runs byte-identical).
- Rows: 1821 total. gitbook.com 403, baserow.io 488, looker.com 502, wekan.team 157, shortcut.com 143, bitrise.io 128.
- sha256 of ops.csv: `e695006e0f36f5440de2832f5381e1965418d813aea0bf3fc2e07362294d5d2e`
- Brand aliases (for excluding these vendors from future draws): gitbook.com = gitbook; baserow.io = baserow; looker.com = looker, looker-open-source; wekan.team = wekan, wekan.github.io; shortcut.com = shortcut, clubhouse; bitrise.io = bitrise.
- Leakage checks must match on the provider/vendor fields (and registrable domain labels), never on free text: the names appear in descriptions of other vendors' specs.
