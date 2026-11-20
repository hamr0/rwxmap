# Exam #7 vendor shortlist check (PROPOSAL, nothing frozen or labelled)

Retrieved 2026-11-18 on branch `main`. Specs fetched fresh into `specs/` (original
bytes, untrusted data, only parsed, never executed). No classifier, rwxlite, Jev or
rwxmap CLI was run on any candidate; only fetch, parse, count and text grep. Tooling
is the exam #6 tooling copied here (changes: specs path, `exam7-shortlist` skipped by
the tree walk, a named skip of `rwxlite/data/r15`, candidates, aliases, new
`grep-data.mjs`). Re-run from this folder: `node build-exclusions.mjs >
exclusion-counts.txt`, `node check-exclusions.mjs`, `node fetch-and-count.mjs`,
`node pin-github.mjs <names>`, `node load-check.mjs`, `node grep-data.mjs`.
Counts: dedupe key METHOD + path with `{param}` collapsed, same as exams #3 to #6.

## Exclusion list

`excluded-vendors.txt`: 6,513 distinct names (exam #6 had 6,499; +14, all exam #6's
own vendors: cloudsmith, cloudsmith.io, grafana, grafana.com, grafana/grafana,
invoiceninja, invoiceninja.com, invoiceninja/invoiceninja, nocodb, nocodb.com,
nocodb/nocodb, radarr, radarr/radarr, radarr.video; none removed). Rebuilt from the
same roots as exam #6 (rwxmap data, docs, poc; rwxlite data, test) as they are on disk
today. Nothing from rwxlite round 14 or any branch is in `rwxlite/data` (its newest
folders are the round 13 and exam #5 ones, already counted), so no other source added
names. Per-source counts in `exclusion-counts.txt`.

Named skip: `/home/hamr/PycharmProjects/rwxlite/data/r15/` (round 15 raw GitHub
quarantine, coordinator ruling 2026-11-18). On disk today it holds 3 files (12 KB:
`raw/search.log`, `raw/candidates.jsonl`, `raw/search_shards.jsonl`); both
`build-exclusions.mjs` and `grep-data.mjs` skip it and print the count. No other
quarantine-like folder found. The list does not contain bunny, bunny.net or langfuse
(blocked by instruction; they are not candidates).

## Candidates

All 12: whole-label exclusion check = clear against `excluded-vendors.txt` and all
aliases in `aliases.json`. All 12 load in `src/load.js` `loadSpec` (parse only), op
count and sha256 matching. ringcentral is byte-identical to exam #6's fetch (sha256
2115f9a7a5c5). baserow drifted since exam #6 (455 ops, 7 MB then; 488 ops, 7.55 MB
now).

| vendor | domain | spec URL | pin / sha256 | format | deduped ops | GET/POST/PUT/PATCH/DELETE | exclusion | loader | caveats |
|---|---|---|---|---|---|---|---|---|---|
| ringcentral | communications (telephony, SMS, fax, meetings) | https://raw.githubusercontent.com/ringcentral/ringcentral-api-docs/main/specs/ringcentral_openapi3.json | commit 417e8815a4506e6e265e2d190518f2ec2cc13ff0 (2021-03-28); sha256 2115f9a7a5c5... | openapi 3.0.1, info 1.0.46 | 347 | 167/99/39/10/32 | clear | OK json | exam #6 leftover; file last touched 2021 (may lag the live API); 4 MB; 18 deprecated; "ring-central" text in other vendors, see grep |
| baserow | no-code database | https://api.baserow.io/api/schema.json | no commit pin (vendor host); sha256 8b39cc5a79b0... | openapi 3.0.3, info 2.4.3 | 488 | 180/176/6/70/56 | clear | OK json | exam #6 leftover; over the 450 target; 7.5 MB; no summary on any of 488 ops; mutable live URL |
| vikunja | task management (tasks, projects, teams, shares, API tokens) | https://raw.githubusercontent.com/go-vikunja/vikunja/main/pkg/swagger/swagger.json | commit 99b5cad2052b87ac8cc0272bf66250dc91537770 (2026-11-12); sha256 7ad9ec73c953... | swagger 2.0, no info.version | 172 | 60/51/32/4/25 | clear | OK json | 171 of 172 ops have no operationId; code-generated (swaggo) |
| openziti | identity / zero-trust networking (identities, policies, services, certs) | https://raw.githubusercontent.com/openziti/edge-api/main/management.yml | commit 73793ea612a2d432cb92eb593a10691cf84a0340 (2026-08-25); sha256 11fe24e6c3ff... | swagger 2.0, info 0.36.0 | 204 | 105/38/19/18/24 | clear | OK yaml | 1 op no operationId; YAML carries `!!float` tags (parser warnings only, loader OK); Edge Management API only (the Client API is a separate spec) |
| gitness | devops (Harness Code: repos, pipelines, users, secrets, webhooks) | https://raw.githubusercontent.com/harness/gitness/main/web/src/services/code/swagger.yaml | commit 71005497269fecb8f389f360a75436e305583e9f (2026-10-19); sha256 eb35162ad46f... | openapi 3.0.0, info 0.0.0 | 257 | 109/75/12/25/36 | clear | OK yaml | 245 of 257 ops no summary; spec lives in the web client folder (generated for the UI, may not cover every server route); "harness" word is common (see grep) |
| huggingface | ML hub (models, datasets, repos, orgs, tokens, webhooks) | https://huggingface.co/.well-known/openapi.json | no commit pin (vendor host); sha256 6bf228121081... | openapi 3.1.0, info 0.0.1 | 386 | 171/144/19/15/37 | clear | OK json | all 386 ops no operationId; mutable live URL; placeholder version |
| pipedrive | CRM (deals, persons, orgs, activities, webhooks, users) | https://developers.pipedrive.com/docs/api/v1/openapi.yaml | no commit pin (vendor host); sha256 89f8bbe23516... | openapi 3.0.1, info 1.0.0 | 213 | 114/39/23/2/35 | clear | OK yaml | v1 API only (v2 is a separate spec); 9 deprecated; mutable live URL |
| looker | BI (users, roles, groups, content, scheduled plans, API keys) | https://raw.githubusercontent.com/looker-open-source/sdk-codegen/main/spec/Looker.4.0.oas.json | commit 4adbcc24b74b87b7aed567b257c6abac3e866e2e (2026-11-09); sha256 1b61c42f9414... | openapi 3.0.0, info 4.0.26.24 | 502 | 238/107/23/65/69 | clear | OK json | over the 450 target; 7 deprecated; Google-owned product, no "google" alias hit |
| gitbook | docs / knowledge (spaces, collections, orgs, members, integrations) | https://api.gitbook.com/openapi.json | no commit pin (vendor host); sha256 05048d92a4fb... | openapi 3.1.0, info 0.0.1-beta | 403 | 204/94/19/41/45 | clear | OK json | 5 deprecated; beta version string; mutable live URL; its URL appears as a discovery-probe false positive in two old data files, see grep |
| wekan | kanban / project mgmt | https://raw.githubusercontent.com/wekan/wekan/main/public/api/wekan.yml | commit c739eaeeee5d086d4f218090522b96e4358680a1 (2026-11-18); sha256 443e582d93a1... | swagger 2.0, info v13.15 | 157 | 65/47/25/0/20 | clear | OK yaml | no PATCH; 87 of 157 ops no summary; spec is hand-written in the app repo and may lag the code; pinned commit is today's, file moves often |
| shortcut | project mgmt (stories, epics, members, webhooks) | https://developer.shortcut.com/api/rest/v3/shortcut.swagger.json | no commit pin (vendor host); sha256 fbe6a42a75c7... | swagger 2.0, info 3.0 | 143 | 70/26/26/0/21 | clear | OK json | below the 150 target; no PATCH; 6 deprecated; mutable live URL; formerly Clubhouse (alias checked, substring hit only `clubhouseapi`) |
| bitrise | CI/CD (apps, builds, workflows, secrets, webhooks, org members) | https://api-docs.bitrise.io/docs/swagger.json | no commit pin (vendor host); sha256 859a161f2622... | swagger 2.0, info 0.1 | 128 | 64/31/5/12/16 | clear | OK json | below the 150 target; 2 deprecated; mutable live URL |

Totals: 12 vendors, 3,400 deduped ops. Full sha256, bytes, URL,
per-method counts, no-operationId, no-summary, deprecated: `results.json`. GitHub
pins: `pins.json` (null = not a GitHub URL, sha256 is the pin). A pin is the latest
commit touching the file at pin time, not proven to be the commit of the fetched
bytes; the sha256 is authoritative.

Domain spread: communications 1, no-code db 1, task/project mgmt 3 (vikunja, wekan,
shortcut), identity/zero-trust 1, devops/CI 2 (gitness, bitrise), ML hub 1, CRM 1,
BI 1, docs 1. Gaps: no billing and no file-sharing vendor survived (see below).

## Dropped candidates and why

Seen in the data (whole-label hit in `excluded-vendors.txt`), checked by
`check-exclusions.mjs` or by a name grep: svix, hetzner, meilisearch, jellyfin,
pinecone, appwrite, snyk, linode, openai, rediscloud (redis), moby (docker) from the
exam #5 pool; discord, netlify, vercel, asana, square, datadog, lago, resend, coolify,
elevenlabs, tyk, calcom, peertube, vimeo, telnyx, figma, ably found while looking for
more. Not usable: sonarr (twin of radarr, exam #6 vendor; servarr alias), bunny and
langfuse (blocked by instruction).

Clear but unusable:
- Too large: langsmith 633 ops, pulumi 673, lightdash 923, windmill 954, dokploy 554
  (no PUT or PATCH at all), authentik 1203.
- Too small: replicate 37, gotify 42, loops 73, flowise 46, budibase 45, algolia 78,
  listmonk 72, qdrant 69, typesense 79, nextcloud 69, coda 123, argocd 106, openfga 24,
  spicedb 27.
- All POST: outline (153 of 153), plaid (345 of 351, if not already seen; its name
  was not run through the check).
- Proto-derived swagger (gRPC gateway, effectively an IDL): temporal (224 ops),
  openfga, spicedb.
- Parse gives 0 ops (paths are `$ref` files): camunda, camunda2, n8n, openproject.
- Parse error: ably (YAML quote error, also seen).
- URL dead (HTTP 404 or fetch failed) on the exam #5 list URL: flyio, recurly,
  humanitec, mistral, dub, dub2, mailcow, haproxy, kinde, litellm, zerotier, grist.
- Tried and 404 (guessed URLs): about 45 other vendors; not listed one by one.
- Fetched but never run through the exclusion check, dropped on size or shape alone:
  intercom (108 ops), lob (105), airbyte (92), adyen (28), plaid, outline, argocd,
  authentik, nextcloud, qdrant, typesense. Some may be seen; do not assume clear.

## Raw text grep of both data trees

`grep-data.mjs` searches every file under `rwxmap/data` and `rwxlite/data` (5,350
text files, 1,646 MB; gz decompressed; npy/npz/pkl/onnx/parquet/safetensors/pt/bin/
tar.gz/log and NUL-containing files skipped: 130; `rwxlite/data/r15` skipped by name),
case-insensitive substring, for every alias in `aliases.json`. Results: `grep-hits.json`
(per alias: files with counts, substring count, whole-word count, one sample).

Real overlap (a spec or labelled rows of the candidate's own API): none found for any
of the 12. Hits are mentions inside other vendors' text:

- ringcentral: "ring-central" 265 hits in 26 files and "ringcentral" 295 in 27 files:
  alertersystem.com `TransportRingCentral` (`/api/transport-ring-central`), mist.com
  (`"name":"RingCentral"`), amazonaws alexaforbusiness enum, novu and hookdeck enums
  (same files as the exam #6 grep). No RingCentral API spec or rows. Its URL
  `ringcentral.com`: 0 hits.
- baserow: 25 hits in 3 files: hookdeck.json enum (23), azure servicefabric
  ("DatabaseRowCountEstimate", substring false hit), exam6 README (mention of the
  leftover). `api.baserow.io`: 0.
- huggingface: 138 hits in 8 files: cloudsmith spec and its exam #6 rows (Hugging
  Face format support, `huggingface.co/...` text), hookdeck enum, public-apis README.
  Not Hugging Face's own operations. `huggingface.co` as a bare host: 0 hits in the
  final run (the 138 are the word "huggingface" in other APIs' text).
- pipedrive: 113 hits in 18 files: auth0 management API description text (50), hookdeck
  enum, apideck unified-API files (the word as a supported connector), data2crm. No
  Pipedrive spec. `pipedrive.com`: 0.
- gitbook: 761 hits in 77 files: documentation links `*.gitbook.io` inside github.com
  and other specs, mechanical/train copies of those rows, hookdeck enum. Also
  `api.gitbook.com/openapi.json` and `.yaml` appear 6 times in
  `discover-limits-2026-09-28/results.json` and `formats-2026-09-27/results.json` as
  guessed-path discovery false positives (`knownFalsePositive: true`, filed under the
  vendor "Sportmonks Cricket"): a probe result, not operations. A ruling, since the
  tool once resolved that URL; no rows of GitBook's API exist there.
- looker: 21 hits in 3 files: google datacatalog (`lookerColumnSpec`), datalineage,
  mist.com. bitrise: 26 hits in 2 files: hookdeck enum (24) and public-apis README.
- shortcut: 507 hits (generic word: "keyboard shortcuts" in posthog and mailchimp,
  etc.), 331 whole-word; no Shortcut API content. "clubhouse" 1,154 hits (club
  houses in unrelated APIs). `api.app.shortcut.com`, `clubhouse.io`: 0.
- gitness: alias "harness" 548 hits (testHarness in gamesparks, dataflow, posthog;
  the word, not Harness). `gitness`, `harness.io`, `harnessio`: 0.
- openziti: "ziti" 1 hit (a base64 blob in linqr.app). vikunja, wekan, `openziti`,
  `netfoundry`: 0 hits anywhere.
- Noise note: the first run also scanned "hf" (11,498 substring hits, 14 whole-word);
  it was dropped from `aliases.json` as meaningless.

Nothing under `poc/` or `docs/` was part of the grep (scope: both data trees); the
exclusion build already reads poc and docs.

## Open points for the orchestrator

1. gitbook: the discovery-probe false positive above is the only data touch; a ruling
   on whether it counts as "seen".
2. Three vendors are under the 150 target (shortcut 143, bitrise 128) or above 450
   (baserow 488, looker 502). 12 vendors total 3,400 ops, so exam #7 needs a subset
   or a cap; combos are not enumerated here.
3. Six specs are mutable vendor-host URLs (baserow, huggingface, pipedrive, gitbook,
   shortcut, bitrise) pinned by sha256 only; ringcentral is a 2021 file.
4. No billing, file-sharing or email vendor made it: every unseen billing and email
   spec found was too small or had a dead URL.
5. If 12 is too few for the subset, clear-but-oversize reserves are pulumi (673 ops)
   and langsmith (633).

## Pick (2026-11-18)

Exam #7 vendors (frozen names only; specs are re-fetched and frozen later, at exam build time):
ringcentral 347, openziti 204, gitness 257, huggingface 386, pipedrive 213, vikunja 172 deduped ops. Total 1579.

Why: six different domains (communications, identity/zero-trust, devops/code hosting, ML hub, CRM, task management). Each is 150-450 ops. The total is close to exam #6's 1588. The orchestrator picked them after the user delegated the choice ("choose whichever fits, right mix").

Reserve: gitbook, baserow, looker, wekan, shortcut, bitrise. They are not in exam #7. They are held back for a later exam and stay excluded from rwxlite training sets, like the exam #7 vendors.

gitbook: its spec URL appears only as a guessed-path discovery false positive under another vendor (data/discover-limits-2026-09-28, data/formats-2026-09-27). No gitbook operations are in any data set. That is not ruled as "seen", and it stays in reserve.

rwxlite quarantine: rwxlite/data/r15/ was skipped by name in build-exclusions.mjs. On 2026-11-18 it listed 7 providers and none of the 12.
