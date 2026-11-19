# Shared clean exam #7 - frozen inputs

Status: INPUTS FROZEN. NOT LABELLED. Nothing here has been run through any
rwxmap classifier, the CLI or rwxlite; no letters exist before truth is built.
Bytes fetched 2026-11-18 during shortlisting (`poc/exam7-shortlist/`); frozen 2026-11-19.
`sources.json` has the URLs, pins and sha256 of the original bytes. The
shortlist did not record fetch timestamps, so `retrieved_at` there says
"unknown" and gives the local file mtime (2026-11-18 20:23 +0100).

exam #7 rwxmap code ref: `96ebb46` (frozen 2026-11-19: mechanical identical to
`1c25be1` plus D140, mode b default confidence 85). Labellers: A = Sonnet,
B = Opus, blind, on `data/relabel-v4-2026-11-05/BRIEF-v4.md` plus
`data/relabel-v4-2026-11-05/BRIEF-v4-addendum-D141.md` (commit `54355e1`).

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
| ringcentral | ringcentral.com | RingCentral Connect Platform API | openapi 3.0.1, info 1.0.46 | ringcentral/ringcentral-api-docs main, last commit touching file 417e8815a4506e6e265e2d190518f2ec2cc13ff0 (2021-03-28), specs/ringcentral_openapi3.json | 347 | 0 | GET 167, POST 99, PUT 39, DELETE 32, PATCH 10 | 0 | 0 | 18 |
| openziti | openziti.io | Ziti Edge Management | swagger 2.0, info 0.36.0 | openziti/edge-api main, last commit touching file 73793ea612a2d432cb92eb593a10691cf84a0340 (2026-08-25), management.yml | 204 | 0 | GET 105, POST 38, DELETE 24, PUT 19, PATCH 18 | 1 | 0 | 0 |
| gitness | harness.io | API Specification (Gitness) | openapi 3.0.0, info 0.0.0 | harness/gitness main, last commit touching file 71005497269fecb8f389f360a75436e305583e9f (2026-10-19), web/src/services/code/swagger.yaml | 257 | 0 | GET 109, POST 75, DELETE 36, PATCH 25, PUT 12 | 0 | 245 | 0 |
| huggingface | huggingface.co | Hub API Endpoints | openapi 3.1.0, info 0.0.1 | https://huggingface.co/.well-known/openapi.json (live URL, no commit), sha256 pin only | 386 | 0 | GET 171, POST 144, DELETE 37, PUT 19, PATCH 15 | 386 | 0 | 0 |
| pipedrive | pipedrive.com | Pipedrive API v1 | openapi 3.0.1, info 1.0.0 | https://developers.pipedrive.com/docs/api/v1/openapi.yaml (live URL, no commit), sha256 pin only | 213 | 0 | GET 114, POST 39, DELETE 35, PUT 23, PATCH 2 | 0 | 0 | 9 |
| vikunja | vikunja.io | Vikunja API | swagger 2.0, no info.version | go-vikunja/vikunja main, last commit touching file 99b5cad2052b87ac8cc0272bf66250dc91537770 (2026-11-12), pkg/swagger/swagger.json | 172 | 0 | GET 60, POST 51, PUT 32, DELETE 25, PATCH 4 | 171 | 0 | 0 |
| total | | | | | 1579 | 0 | | 559 | 245 | 27 |

(The "no operationId", "no summary" and "deprecated" columns were counted over the same op set; they are informational and not enforced by the build script.)

## Issues and judgment calls

- Order and ids follow exam #6's code: rows sorted by provider domain, then
  path, then method; ids are `ex7-0001` onward. The first rows are harness.io.
- The shortlist counted 1,579 deduped ops (347+204+257+386+213+172). Raw equals
  deduped for every vendor, so the build total is also 1,579; no difference.
  There are 0 collapsed-param pairs.
- Provider values are the user-specified registrable domains, a choice made for
  this build: ringcentral.com (servers `platform.ringcentral.com`); openziti.io
  (the spec has no servers and only `host: demo.ziti.dev`; openziti.io is the
  project's own domain); harness.io for gitness (the repo is in the `harness`
  GitHub org; the spec's only server is the relative `/api/v1`); huggingface.co
  (server and URL host); pipedrive.com (server `api.pipedrive.com`); vikunja.io
  (the project's domain; the spec has no servers or host).
- GitHub pins are weaker than exam #6's: the bytes were fetched from the branch
  URL (`main`), not from a commit URL, and the recorded commit is the latest
  commit touching the file as of the survey (`pins.json`). If the file changed
  between survey and fetch the pin would not describe the bytes; the sha256 is
  the real pin. ringcentral's last file commit is 2021-03-28. huggingface and
  pipedrive are live vendor URLs with no commit, so the sha256 is the only pin.
- gitness lives in the `harness` GitHub org (the vendor's own); it is Harness's
  open-source Gitness code-hosting API.
- huggingface has no operationId on any of its 386 ops, vikunja on 171 of 172,
  openziti on 1; gitness lacks a summary on 245 of 257. Kept as published.
- loadSpec on openziti prints many YAML warnings (`Unresolved tag
  tag:yaml.org,2002:float` for `!!float` in schema examples/limits). They are
  in schemas, not in paths; the 204 ops load and equal the shortlist count.
- Specs hold 27 deprecated ops (ringcentral 18, pipedrive 9), all kept;
  deprecated is not a filter.
- One spec file per vendor was used; other official APIs a vendor may publish
  were not checked (pipedrive also publishes a v2 spec; not used). Counts are of
  the specs as published; no external `$ref` was followed (loader policy D106).
- Reserve vendors from the shortlist (gitbook, baserow, looker, wekan, shortcut,
  bitrise) are not part of this exam and are not copied here.
- Custody: exam #6 had no .gitignore for truth.csv or labelling/out/ (they were
  kept out by not running `git add` until scoring finished). Same here: no
  .gitignore was added; do not `git add` truth.csv or labelling/out/ until both
  sides have scored.

## Frozen ops

- Date: 2026-11-19.
- Script: `build-ops.mjs` (loads `specs/` with `src/load.js`, checks each spec's sha256 against `sources.json`, writes `ops.csv` and `ops.csv.sha256`; deterministic, two runs byte-identical).
- Rows: 1579 total. ringcentral.com 347, openziti.io 204, harness.io 257, huggingface.co 386, pipedrive.com 213, vikunja.io 172.
- sha256 of ops.csv: `abe5e6cd410c72d0bee1b85948ccb12b7d898873f9cb032eb5d27bcd5e447ea3`
- Brand aliases (for excluding these vendors from future draws): ringcentral.com = ringcentral, ring central; openziti.io = openziti, ziti, netfoundry, demo.ziti.dev; harness.io = gitness, harness; huggingface.co = huggingface, hugging face, hf; pipedrive.com = pipedrive; vikunja.io = vikunja.
- Leakage checks must match on the provider/vendor fields (and registrable domain labels), never on free text: the names appear in descriptions of other vendors' specs.
