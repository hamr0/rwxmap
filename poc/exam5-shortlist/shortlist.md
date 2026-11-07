# Exam #5 vendor shortlist (PROPOSAL, nothing frozen or labelled)

Retrieved 2026-11-06. Specs fetched only into the scratchpad
(`.../scratchpad/exam5/<name>.spec`, original bytes). No classifier, rwxlite or
Jev was run on any candidate. Counts come from `fetch-and-count.mjs` (dedupe key =
METHOD + path with `{param}` collapsed to `{}`, same as exam #3 and #4; HEAD counted
as a method; no external `$ref` followed). Re-run: `node fetch-and-count.mjs
[--cached] [name...]`, `node build-exclusions.mjs > exclusion-counts.txt`,
`node check-exclusions.mjs`, `node pin-github.mjs <names>`. Full numbers (sha256,
bytes, URL, retrieved time, version, per-method counts, no-operationId, no-summary,
deprecated) are in `results.json`; GitHub commit pins in `pins.json`.

## Pool count

51 distinct candidates checked (11 carried over from exam #4's measured-but-unused
list, 40 new). 13 are clear of every exclusion and have a usable single-file spec
with real PUT/PATCH/DELETE: 10 inside 120-300 ops (front, planetscale, paddle,
langfuse, hookdeck, weaviate, nocodb, semaphore, radarr, sonarr), 3 just outside
(bunny 113, grafana 314, fusionauth 364). Sonarr and Radarr are one codebase family
(same API, 240 ops each), so only one is listed in the 12. A further 7 are clear but
well out of range (ringcentral, invoiceninja, cloudsmith, baserow, langsmith, pulumi,
lightdash; see Alternates).

## Shortlist (12; the user picks about 7)

All 12: exclusion check = clear on whole domain labels, plus a raw text grep of both
trees (below). "no opId" = ops with no operationId.

| # | vendor | domain | spec URL (official) | format | deduped ops | GET/POST/PUT/PATCH/DELETE | aliases checked | caveat |
|---|---|---|---|---|---|---|---|---|
| 1 | front | comms / support inbox (conversations, contacts, teammates, rules) | https://raw.githubusercontent.com/frontapp/front-api-specs/main/core-api/core-api.json (pin 7a62cc93709d34b602910145090f1880ab062ecb) | openapi 3.0.0, info 1.0.0 | 246 | 124/71/1/23/27 | front, frontapp | Core API only; 11 deprecated; "front" is a substring of cloudfront/frontdoor, label match only, not a hit |
| 2 | planetscale | infra / database (orgs, branches, passwords, service tokens, backups) | https://api.planetscale.com/v1/openapi-spec | swagger 2.0, info v1 | 291 | 149/64/8/30/40 | planetscale, pscale | Swagger 2.0; served from vendor API host (no commit pin; pin by sha256); "password" resources are connection credentials (D130) |
| 3 | paddle | billing (subscriptions, transactions, customers, discounts) | https://raw.githubusercontent.com/PaddleHQ/paddle-openapi/main/v1/openapi.yaml (pin c8207382fa0fa660620a02a23a6a2806ae8894fb) | openapi 3.1.0, info 1.0 | 126 | 71/29/0/23/3 | paddle, paddlehq | only 3 DELETE, PATCH is the update verb; 7.9 MB file; word "paddle" appears only in rwxlite tokenizer files and exam #4 README prose, not as a vendor |
| 4 | langfuse | LLM observability (projects, organisations, API keys, prompts, datasets) | https://cloud.langfuse.com/generated/api/openapi.yml | openapi 3.0.1, info (empty) | 120 | 58/22/7/11/22 | langfuse | at the low edge; no `summary` on any op (operationId present); spec title "server"; served from vendor host (pin by sha256) |
| 5 | hookdeck | webhook infrastructure (connections, sources, destinations, transformations, API keys) | https://api.hookdeck.com/2025-01-01/openapi | openapi 3.0.1, info 1.0.0 | 135 | 61/25/38/0/11 | hookdeck | PUT is the update verb (38 PUT, no PATCH); date-versioned URL 2025-01-01 may lag the live API |
| 6 | weaviate | vector database (schema, objects, batch, backups, users, roles) | https://raw.githubusercontent.com/weaviate/weaviate/main/openapi-specs/schema.json (pin 60409d842c2949fd7e67f774ad690784283dc4ae) | swagger 2.0, info 1.41.0-dev | 126 | 43/48/11/2/19 (+HEAD 3) | weaviate | Swagger 2.0; dev version on `main`; 10 deprecated; 1 op lacks operationId; has users/roles/API-key endpoints; only 2 PATCH |
| 7 | nocodb | no-code database (bases, tables, records, views, webhooks, API tokens) | https://raw.githubusercontent.com/nocodb/nocodb/develop/packages/nocodb/src/schema/swagger.json (pin 86760b0bd01b99625c93ac00c550a6498ea96e3c) | openapi 3.1.0, info 1.0 | 278 | 110/100/0/37/31 | nocodb | no PUT at all (PATCH updates); spec on `develop` branch; 279 raw, 1 duplicate removed; 1 op lacks operationId |
| 8 | semaphore | devops / CI (Ansible UI: projects, keys, users, tokens, environments, runners) | https://raw.githubusercontent.com/semaphoreui/semaphore/develop/api-docs.yml (pin ee38ce6eb04657cbce12fb4882fe680870b33778) | swagger 2.0, info 2.16.14 | 155 | 68/40/20/0/27 | semaphore, semaphoreui | Swagger 2.0; ALL 155 ops lack operationId (summary present); no PATCH; has access keys, user tokens, user admin |
| 9 | radarr | media management (movies, quality profiles, download clients, indexers, tags) | https://raw.githubusercontent.com/Radarr/Radarr/develop/src/Radarr.Api.V3/openapi.json (pin a8d55ddd7ab318081d60cd3351f60aa3697fc9b6) | openapi 3.0.4, info 3.0.0 | 240 | 127/46/36/0/30 (+HEAD 1) | radarr, servarr | ALL 240 ops lack operationId and summary (path+method+tags only); self-hosted app; no PATCH; sonarr is the twin spec (also 240 ops), not both |
| 10 | grafana | devtools / observability (users, orgs, teams, service accounts, API keys, datasources) | https://raw.githubusercontent.com/grafana/grafana/main/public/openapi3.json (pin 80b97080eb103911ad0bc56d858e3cc0966950ea) | openapi 3.0.3, info 0.0.1 | 314 | 143/81/35/11/44 | grafana, grafanacloud | slightly over 300; 64 ops deprecated; 18 lack `summary`; generated from code, version field is a placeholder; brand name appears as text in some meshery rows (not a vendor hit) |
| 11 | fusionauth | identity (users, tenants, API keys, applications, consents) | https://raw.githubusercontent.com/FusionAuth/fusionauth-openapi/main/openapi.yaml (pin f9889ee0457daa76749aff68213c23d6c18d1930) | openapi 3.0.3, info 1.70.0 | 364 | 107/138/44/32/43 | fusionauth | OVER the 120-300 range; all 364 ops lack `summary` (operationId present); the best identity/access-heavy option available |
| 12 | bunny.net | CDN / storage (pull zones, DNS zones, storage zones, API keys) | https://core-api-public-docs.b-cdn.net/docs/v3/public.json | openapi 3.0.0, info 1.0.0 | 113 | 42/52/4/0/15 | bunny, bunnycdn, b-cdn, bunnynet | just under 120; only 4 PUT, no PATCH; served from vendor CDN host (pin by sha256) |

Domain spread: comms/support 1 (front), database/infra 3 (planetscale, weaviate,
nocodb), billing 1 (paddle), LLM/observability 2 (langfuse, grafana), webhooks 1
(hookdeck), devops 1 (semaphore), media 1 (radarr), identity 1 (fusionauth), CDN 1
(bunny). Identity/access-heavy is thin: fusionauth is the only pure identity
product here; credential-ish resources also sit in grafana (service-account tokens),
planetscale (passwords, service tokens), semaphore (access keys), weaviate (users,
roles), langfuse and hookdeck (API keys), paddle/nocodb (tokens). If the user wants
more identity rows, no further unseen identity vendor with a usable spec was found
(see rejected).

A 7-vendor pick that stays in range and spreads domains: front, planetscale, paddle,
hookdeck, nocodb, semaphore, radarr = 1,471 ops
Swap in fusionauth or grafana for identity weight (both over 300).

## Alternates (clear, measured, not in the 12)

- sonarr 240 ops (124/48/36/0/31 + HEAD 1), twin of radarr, same caveats (no opId, no summary); use instead of radarr, not with it.
- ringcentral 347 (comms; 167/99/39/10/32), over range. Text mention of "ringcentral" in an unrelated alertersystem row only.
- invoiceninja 379 (billing; 156/155/33/0/35), over range, no PATCH.
- cloudsmith 376 (package registry, entitlement tokens; 129/137/31/42/37), over range.
- baserow 455 (no-code DB; 173/160/6/64/52), over range, 7 MB, no `summary` on any op.
- langsmith 622, pulumi 671, lightdash 879: clear but far too big.

## Considered and rejected

- Seen (hit in exclusion list):
  - svix (rwxlite r9-hand, gate-2026-11-03), hetzner (hetzner.cloud, same sources), meilisearch (meilisearch.com), jellyfin (jellyfin.local), pinecone (pinecone.io, gate-2026-11-06), openai (rwxmap discover-limits, rwxlite gate-2026-11-04, klarna.com:openai in m0), moby/docker (docker.com in rwxlite gate and m0). These were found by the exclusion check, not by eye; svix, hetzner and meilisearch were the strongest in-range candidates before the check.
  - Carried-over seen from exam #4's rejections: discord, square, figma, datadog, airflow (apache), plus all exam #3 and exam #4 vendors (permit, immich, polar, harbor, zulip, chatwoot, render).
  - appwrite: in APIs.guru as appwrite.io:server (rwxmap corpus), so seen; not fetched.
- Out of range: jellyfin 364 (also seen; GET/POST/DELETE/HEAD only), moby 108 (also seen; no PATCH), replicate 37, gotify 42, loops 73, pinecone 18 (also seen), authentik 1196, windmill 948, rootly 643, dokploy 554, aiven 512, coder 490, growthbook 453, prefect 442, plus exam #4's small ones (qdrant 69, typesense 79, adguard 81, listmonk 72, nextcloud, owncloud 91, openfga 24, budibase 45, argo-cd 106).
- Wrong method mix: outline (all POST), dokploy (POST+GET only), casdoor (GET+POST only), openai (no PUT/PATCH; also seen).
- Not usable as one file: n8n, openproject, camunda (paths are external `$ref` files, 0 ops counted; the counter does not follow external refs), snyk (versioned REST endpoint, no paths object at the bare URL).
- No official spec found at the guessed URL (HTTP 404/401/fetch failed): fly.io machines (docs.machines.dev spec path 404), recurly, humanitec, mistral, linode, litellm, mailcow, haproxy dataplane, redis cloud (401), kinde, dub, zerotier, grist, appwrite spec path, plus exam #4's earlier failures (mattermost, cockroach, directus, hanko, flagsmith, unleash, chargebee, moov, mailgun, uploadcare, logto, paperless, mealie, phrase, polar live URL).
- Unofficial or doubtful: none of the 12 is APIs.guru or third-party. "Official" is judged by vendor host or the vendor's GitHub org (frontapp, PaddleHQ, weaviate, nocodb, semaphoreui, Radarr, grafana, FusionAuth).
- GraphQL/IDL-only, not probed: linear, railway, hygraph, saleor.

## Exclusion list

`excluded-vendors.txt`: 6,480 distinct names, one per line as
`name<TAB>first file<TAB>all sources`; per-source counts are in
`exclusion-counts.txt`. Rebuilt fresh from both trees as they are today
(rwxmap data, docs, poc; rwxlite data and test), with these additions over exam #4:
`data/exam5-pool/rwxlite-providers.csv` (provider and aliases columns, aliases split
on `;`), the exam #4 vendors (permit, immich, polar, harbor, zulip, chatwoot, render
plus brand aliases, also read from `data/exam4-2026-11-04`), exam #3 vendors, and
all the new data dirs (pass-v4, pilot, relabel-v4, export-v4, exam4, exam5-pool).
Matching is on whole domain labels (split on `. : _ / @`); substring-only near
misses are reported separately in `exclusion-check.json`.

## Uncertain (the orchestrator should decide)

1. The scan keys on provider/vendor/api_key/host/providers/repo/aliases columns and spec file names. As a cross-check I also grepped raw text of both trees (excluding specs/ folders and tokenizer vocab) for every clear name: only unrelated mentions (a grafana/gotify/ringcentral integration inside another vendor's operation text, "paddle" in tokenizer files, "replicate" as a mailchimp endpoint word, "planetscale" in a cloudflare hyperdrive description). `.gz` files were covered only by the structured scan, not the raw grep.
2. Brand-parent risk: aliases were chosen by me from knowledge; a vendor stored under a corporate parent would be missed. None of the 12 is known to be a sub-brand of a seen parent.
3. GitHub pins are the latest commit touching the file at pin time, not necessarily the exact commit of the bytes fetched (weaviate's file changed today, 2026-11-06 12:33 UTC). The authoritative pin is the sha256 in `results.json`; non-GitHub specs (planetscale, langfuse, hookdeck, bunny) are mutable live URLs.
4. Ops without operationId (semaphore 155, radarr 240) and without summary (fusionauth 364, langfuse 120, radarr 240) give labellers and any text tier less to read; this may make those vendors harder or atypical.
5. Method mix differs by vendor: hookdeck/semaphore/radarr update by PUT with no PATCH; nocodb/paddle by PATCH with no PUT; paddle has only 3 DELETE. Identity weight is thin (see domain spread).
6. The 7-vendor example total (1,471) is near the top of the 1,300-1,500 target; dropping semaphore for bunny or langfuse gives about 1,430-1,440.
