# Exam #4 vendor shortlist (PROPOSAL, nothing frozen or labelled)

Retrieved 2026-11-04. Specs fetched only into the scratchpad
(`.../scratchpad/exam4/<name>.spec`, original bytes). Counts come from
`fetch-and-count.mjs` (dedupe key = METHOD + path with `{param}` collapsed to `{}`,
same as exam #3; HEAD counted as a method, no external `$ref` followed). Re-run:
`node fetch-and-count.mjs [--cached] [name...]` then `node build-exclusions.mjs`
then `node check-exclusions.mjs`. Full numbers (sha256, bytes, no-operationId and
no-summary counts, servers) are in `results.json`.

## Shortlist (12; the user picks about 7)

| # | vendor | domain | spec URL (official) | format | deduped ops | GET/POST/PUT/PATCH/DELETE | exclusion check (aliases checked) | caveat |
|---|---|---|---|---|---|---|---|---|
| 1 | permit.io | identity / authorization admin (users, tenants, roles, API keys) | https://api.permit.io/v2/openapi.json | openapi 3.1.0, info 2.0.0 | 263 | 113/61/22/21/46 | clear (permit, permitio) | served from vendor API host; 8 ops deprecated |
| 2 | fusionauth | identity (users, tenants, API keys, applications, consents) | https://raw.githubusercontent.com/FusionAuth/fusionauth-openapi/main/openapi.yaml | openapi 3.0.3, info 1.70.0 | 364 | 107/138/44/32/43 | clear (fusionauth) | OVER the 120-300 range; all 364 ops lack `summary` (operationId present) |
| 3 | immich | file / photo sharing (albums, shared links, users, API keys) | https://raw.githubusercontent.com/immich-app/immich/main/open-api/immich-openapi-specs.json | openapi 3.0.0, info 3.4.0-rc.0 | 287 | 126/70/43/3/45 | clear (immich) | spec is a release candidate on `main`; self-hosted product, official org `immich-app`; 10 deprecated |
| 4 | paddle | billing (subscriptions, transactions, customers, discounts) | https://raw.githubusercontent.com/PaddleHQ/paddle-openapi/main/v1/openapi.yaml | openapi 3.1.0, info 1.0 | 126 | 71/29/0/23/3 | clear (paddle, paddlehq) | only 3 DELETE; PATCH is the update verb; 7.9 MB file; spec lives in the vendor's `paddle-openapi` repo |
| 5 | polar | billing (products, subscriptions, benefits, orders, org tokens) | https://raw.githubusercontent.com/polarsource/polar/main/docs/openapi/2026-10.openapi.json | openapi 3.1.0, info 2026-10 | 190 | 94/50/1/26/19 | clear (polar, polarsource, polar-sh) | live `api.polar.sh/openapi.json` 404s; the repo holds dated snapshots 2026-04 (190 ops), 2026-10 (190), 2027-01 (194, future-dated). Pick one and pin it |
| 6 | harbor | devtools / credentials (container registry, users, robot accounts, projects) | https://raw.githubusercontent.com/goharbor/harbor/main/api/v2.0/swagger.yaml | swagger 2.0, info 2.0 | 208 | 116/35/32/4/20 (+HEAD 1) | clear (harbor, goharbor) | Swagger 2.0 not 3; 3 deprecated |
| 7 | grafana | devtools / observability (users, orgs, teams, service accounts, API keys, datasources) | https://raw.githubusercontent.com/grafana/grafana/main/public/openapi3.json | openapi 3.0.3, info 0.0.1 | 314 | 143/81/35/11/44 | clear (grafana, grafanacloud) | slightly over 300; 64 ops deprecated; 18 lack `summary`; generated from code, version field is a placeholder |
| 8 | zulip | comms (chat: messages, streams, users, bots, invites) | https://raw.githubusercontent.com/zulip/zulip/main/zerver/openapi/zulip.yaml | openapi 3.0.1, info 1.0.0 | 165 | 47/68/1/20/29 | clear (zulip, zulipchat) | 167 raw, 2 duplicates removed; 1 op lacks operationId and summary; spec lives in main repo of official org |
| 9 | front | comms / support inbox (conversations, contacts, teammates, rules) | https://raw.githubusercontent.com/frontapp/front-api-specs/main/core-api/core-api.json | openapi 3.0.0, info 1.0.0 | 246 | 124/71/1/23/27 | clear (front, frontapp); "front" is also a substring of cloudfront/frontdoor, label match only, not a hit | Core API only (spec title "Core API"; Front may publish other APIs separately, unchecked); 11 deprecated |
| 10 | chatwoot | comms / support (accounts, agents, inboxes, conversations, webhooks) | https://raw.githubusercontent.com/chatwoot/chatwoot/develop/swagger/swagger.json | openapi 3.1.0, info 1.1.0 | 157 | 67/45/2/24/19 | clear (chatwoot) | spec built from `develop` branch; file name says swagger but the doc is openapi 3.1 |
| 11 | render | infra / PaaS (services, deploys, env vars, disks, postgres, keys) | https://api-docs.render.com/openapi/render-public-api-1.json | openapi 3.0.2, info 1.0.0 | 252 | 124/56/16/20/36 | clear (render, onrender); rwxlite's SHORTLIST.md mentions render as "not located", never downloaded, not in any data file | 8 deprecated; rwxlite session had failed to find this URL, so it is a fresh find |
| 12 | planetscale | infra / database (orgs, branches, passwords, service tokens, backups) | https://api.planetscale.com/v1/openapi-spec | swagger 2.0, info v1 | 291 | 149/64/8/30/40 | clear (planetscale, pscale) | Swagger 2.0; served from vendor API host; many "password" resources are connection credentials, relevant to D130 |

Domain spread: identity/authorization 2 (permit, fusionauth), file sharing 1
(immich), billing 2 (paddle, polar), credentials/devtools 2 (harbor, grafana),
comms 3 (zulip, front, chatwoot), infra 2 (render, planetscale). Credential-ish
resources also sit in permit (API keys), polar (org tokens), planetscale
(passwords, service tokens), grafana (service-account tokens), harbor (robot
accounts), immich (API keys).

Alternates measured and clear, not in the 12: langfuse 120 ops (LLM observability,
org/project/API keys; no `summary` on any op, spec title "server"), hookdeck 135
(webhooks infra, PUT-heavy 38), bunny.net 113 (CDN/storage, all `summary`),
ringcentral 347 (comms, over range), invoiceninja 379 (billing, over range),
cloudsmith 376 (package registry with entitlement tokens, over range),
casdoor 233 (identity, but only GET 102 + POST 131, so no PUT/PATCH/DELETE: fails
the method-mix test), vikunja 172 (tasks; 171 of 172 ops lack operationId).

## Exclusion list

`excluded-vendors.txt`: 4267 distinct names, one per line as
`name<TAB>first file<TAB>all sources`. Built by `build-exclusions.mjs` (vanilla
node; reads CSV provider/vendor/api_key/host/repo columns, JSONL provider fields,
JSON vendor keys, gz files, spec-file names in every `*specs*` folder, plus
hand-added names from prose docs). Distinct names per source (a name can appear
in several sources, so the rows do not sum to 4267; `exclusion-counts.txt`):

- rwxmap data: corpus 2676 (apis-guru spec names + ops), markers-2026-11-04 2657,
  gate4-2026-11-04 500, calibration-2026-09-14 221, discover-limits-2026-09-28 55,
  jev-tiers-2026-09-23 36, jev-2026-09-20 33, discover-live (both) 25 each,
  credential-set 24, buildset 22, combined 23, jev-2026-09-22 23, relabel-2026-09-22 23,
  exam-2026-09-22 21, provider-corpus-2026-09-16 15, exam3-2026-11-04 14,
  relabel-buildset 13, formats-2026-09-27 6, exam-2026-09-20 5, rwxlite-fresh 4,
  exam-2026-09-17 3, jev-exam 3.
- rwxmap prose and logs: docs/logs 193, poc/conformance 243, poc/discover 577,
  docs/.docs-builder 44.
- rwxlite data: m0 2658, round10 1402, train (train/val/v3eval) 1338, r9-hand 492,
  gate-2026-11-03/04/06/07 227/263/257/250, fresh-exam-specs 16 (includes
  calcom, coolify, infisical, knock, lago, posthog, resend, workos, the 7 exam #3
  names), exam-2026-11-03-fresh 8, exam3 7, exam3-smoke 4, exam-fresh-r8soft 4,
  exam-r8soft 3, m1-r10 3; rwxlite test fixtures 24.
- hand-added from docs: pre-registered split 24 (the ten locked vendors: auth0,
  cloudflare, hubspot, zendesk, pagerduty, dropbox, shopify, linear, miro, sentry;
  plus the build pile), exam3 README aliases 14 (neon.tech = neon.com, ory.sh =
  ory.com = oryapis.com, novu.co ...), CLAUDE.md 3 (okta, docusign, xero), brand
  aliases 30 (hubapi.com = HubSpot, bitbucket/jira/confluence = atlassian, ...).

`check-exclusions.mjs` matches each candidate's alias set (aliases.json) against
whole domain labels (split on `. : _ / @`) of every excluded name; `exclusion-check.json`
keeps hits and substring-only near-misses.

## Considered and rejected

- Seen (hit in exclusion list):
  - discord: provider "discord" in the M0 `holdout3` rows (docs/logs/m1/c15-leaks.csv etc.). First draft had it in the shortlist; the first exclusion run, which covered data/ only, missed it. Extending the scan to docs/ and poc/ caught it.
  - square (combined-2026-09-21 labelled.csv, discover-limits, rwxlite round10), figma, datadog (combined-2026-09-21, discover-limits), airflow (apache.org seen in rwxlite m0/gate/r9-hand).
  - Already in the exam #3 / rwxlite fresh exam / rwxlite shortlist: clerk, neon, supabase, mux, netbird, ory, novu, coolify, lago, resend, workos, knock, calcom, infisical, posthog, unkey.
  - Locked: auth0, cloudflare, hubspot, zendesk, pagerduty, dropbox, shopify, linear, miro, sentry. Seen: okta, docusign, xero, github, gitlab, box, trello, atlassian, launchdarkly, stripe, digitalocean, twilio, slack, sendgrid, netlify, vercel and the rest of apis-guru.
- Too big: authentik 1196 ops, datadog 1706 (also seen), windmill 948, rootly 643, dokploy 554, aiven 512, coder 490, growthbook 453, prefect 442, mattermost not fetched (~500).
- Too small: qdrant 69, typesense 79, adguard 81, listmonk 72, nextcloud core 69 / files_sharing 23 (one spec per app, no single complete API), owncloud libre-graph 91, figma 59 (also seen), openfga 24, budibase 45, argo-cd 106 (gRPC gateway, title "Consolidate Services").
- Wrong method mix (RPC style): outline (153 ops, all POST), dokploy (POST 356 + GET 198, no PUT/PATCH/DELETE), casdoor (GET and POST only), unkey (115 POST + 1 GET per rwxlite).
- Not found or not usable: mattermost (spec URL 404), cockroach cloud (404), hanko (no spec file in repo), chargebee, moov, mailgun, uploadcare, gocardless, phrase (no spec path found in the repos), firehydrant (401), incident.io (410), koyeb and logto (URL returns an HTML page), polar's live URL (404).
- Unofficial or doubtful: none of the shortlist is APIs.guru or third-party. airflow's generated spec is official but the vendor name (apache.org) is seen.
- GraphQL-only, not probed: linear, railway, hygraph, saleor.

## Uncertain (the orchestrator should decide)

1. The seen scan found discord only after widening to docs/ and poc/. The task named data/**, so other names that live only in prose may still be missed. I grepped docs, poc and rwxlite (md, txt, js, mjs, json) for all 12 vendors: no further hits (paddle and harbor appear only as word-piece tokens in rwxlite's `vocab.txt`; grafana and zulip only inside the novu spec text).
2. "Official" is judged by host or GitHub org: all 12 come from vendor-owned GitHub orgs or vendor API/docs hosts. immich, chatwoot, harbor, grafana, zulip, casdoor are open-source projects whose "vendor" is the project org; permit, front, render, planetscale, paddle, polar, fusionauth are commercial vendors.
3. Polar needs a snapshot pick (see row 5); immich's current file is an RC (3.4.0-rc.0); grafana's `info.version` is a placeholder, so the exam should pin by sha256 (in `results.json`).
4. fusionauth (364) and grafana (314) are over the 120-300 aim; paddle (126) sits at the low edge and has only 3 DELETE ops.
5. Some "Uses PUT/PATCH/DELETE" counts differ from method conventions: paddle updates via PATCH, hookdeck via PUT, so method floors will fire differently there.
6. Domain label matching may miss a seen vendor whose training rows are stored under a corporate parent only (for example a Microsoft or Google property). None of the 12 is a sub-brand of a seen parent as far as I know: front is Front (not Frontegg), render is Render (not Azure rendering), zulip belongs to Kandra Labs/Zulip.
7. Not checked: whether a vendor changed its spec between my fetch and freezing; specs are mutable `main` files, pin by sha256 at freeze.
