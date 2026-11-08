# Exam #6 vendor shortlist check (PROPOSAL, nothing frozen or labelled)

Retrieved 2026-11-08 on branch `exam6-prep`. Specs fetched fresh into
`.claude/scratchpad/exam6/<name>.spec` (original bytes, gitignored). No classifier,
rwxlite, Jev or rwxmap CLI was run on any candidate; only fetch, parse and count.
Tooling is the exam #5 tooling copied here (changes: scratch path, header comment,
`exam6-shortlist` skipped by the tree walk, candidates, aliases). Re-run:
`node fetch-and-count.mjs`, `node build-exclusions.mjs > exclusion-counts.txt`,
`node check-exclusions.mjs`, `node pin-github.mjs <names>`, `node load-check.mjs`.
Counts: dedupe key METHOD + path with `{param}` collapsed, same as exams #3 to #5.

## Exclusion list

`excluded-vendors.txt`: 6,499 distinct names (exam #5 had 6,480; +19, all exam #5's
own vendors: front, frontapp.com, frontapp/front-api-specs, fusionauth, fusionauth.io,
fusionauth/fusionauth-openapi, hookdeck, hookdeck.com, paddle, paddle.com,
paddlehq/paddle-openapi, planetscale, planetscale.com, semaphore, semaphoreui.com,
semaphoreui/semaphore, weaviate, weaviate.io, weaviate/weaviate). Rebuilt from
rwxmap data, docs, poc and rwxlite data, test as they are today. Round 13 training,
val and the exam #5 files all sit under `rwxlite/data` (round13, round13-t2, m1-r13,
v4, exam5-2026-11-07, gate-2026-11-07), so no root was added. The list does not
contain bunny, bunny.net or langfuse (they are blocked by instruction, not by data;
bunny appears only in `poc/cutoff-r13/bunny-run.md` prose). Per-source counts in
`exclusion-counts.txt`.

## Candidates

All 7: whole-label exclusion check = clear. Every sha256 and per-method count is
byte-identical to the exam #5 fetch of 2026-11-06. All 7 load in `src/load.js`
`loadSpec` (parse only), op count and sha256 matching.

| vendor | domain | spec URL | pin / sha256 | format | deduped ops | GET/POST/PUT/PATCH/DELETE | exclusion | loader | caveats |
|---|---|---|---|---|---|---|---|---|---|
| grafana | observability (users, orgs, teams, service accounts, API keys, datasources) | https://raw.githubusercontent.com/grafana/grafana/main/public/openapi3.json | commit 80b97080eb103911ad0bc56d858e3cc0966950ea (2026-11-04); sha256 6ed068bc50bb... | openapi 3.0.3, info 0.0.1 | 314 | 143/81/35/11/44 | clear | OK json | 64 deprecated; 18 no summary; version field is a placeholder; slightly over 300 |
| nocodb | no-code database (bases, tables, records, views, webhooks, tokens) | https://raw.githubusercontent.com/nocodb/nocodb/develop/packages/nocodb/src/schema/swagger.json | commit 86760b0bd01b99625c93ac00c550a6498ea96e3c (2026-11-04); sha256 62970061ab3d... | openapi 3.1.0, info 1.0 | 278 (279 raw) | 110/100/0/37/31 | clear | OK json | no PUT; spec on `develop`; 1 op no operationId, 3 no summary |
| radarr | media management (movies, quality profiles, indexers, tags) | https://raw.githubusercontent.com/Radarr/Radarr/develop/src/Radarr.Api.V3/openapi.json | commit a8d55ddd7ab318081d60cd3351f60aa3697fc9b6 (2026-10-18); sha256 01520188df1e... | openapi 3.0.4, info 3.0.0 | 240 | 127/46/36/0/30 (+HEAD 1) | clear (aliases radarr, sonarr, servarr) | OK json | all 240 ops no operationId and no summary; no PATCH; sonarr is its twin, use one only |
| ringcentral | communications (telephony, SMS, fax, meetings) | https://raw.githubusercontent.com/ringcentral/ringcentral-api-docs/main/specs/ringcentral_openapi3.json | commit 417e8815a4506e6e265e2d190518f2ec2cc13ff0 (2021-03-28); sha256 2115f9a7a5c5... | openapi 3.0.1, info 1.0.46 | 347 | 167/99/39/10/32 | clear | OK json | file last touched 2021 (may lag live API); 4 MB; 18 deprecated |
| cloudsmith | package registry (repos, entitlement tokens, members, webhooks) | https://api.cloudsmith.io/v1/?format=openapi | no commit pin (vendor API host); sha256 06332edcfb5b... | swagger 2.0, info v1 | 376 | 129/137/31/42/37 | clear | OK json | mutable live URL, pin by sha256 only; 5 deprecated, 5 no summary |
| invoiceninja | billing / invoicing | https://raw.githubusercontent.com/invoiceninja/invoiceninja/v5-stable/openapi/api-docs.yaml | commit 15f56bc9fc4c02c18b07e450e18b76bbe893b4f8 (2026-09-08); sha256 bcda1f823746... | openapi 3.0.1, info 5.12.55 | 379 | 156/155/33/0/35 | clear | OK yaml | no PATCH; 5 deprecated; YAML (loader parses it with default alias cap, fine) |
| baserow | no-code database | https://api.baserow.io/api/schema.json | no commit pin (vendor API host); sha256 5c7fa0574c12... | openapi 3.0.3, info 2.4.1 | 455 | 173/160/6/64/52 | clear | OK json | 7 MB; no summary on any of 455 ops; mutable live URL; largest, only fits no 5-7 combo |

Full sha256, bytes, URL, per-method counts, no-operationId, no-summary, deprecated:
`results.json`. GitHub pins: `pins.json`. A pin is the latest commit touching the
file at pin time, not proven to be the commit of the fetched bytes; the sha256 is
authoritative.

## Raw text grep of both data trees (step 4)

Searched every file under `rwxmap/data` and `rwxlite/data` (gz decompressed; onnx,
npy, parquet, pkl, bin, log skipped), case-insensitive, for all aliases plus the
extra spellings (noco, ring-central, invoice_ninja). No file in either tree is a
spec or a labelled row set of any of the 7 vendors. Hits are mentions inside other
vendors' text, listed here for the user to judge (I did not rule on "seen"):

- grafana: meshery.local (apis-guru) has operations `/api/system/meshsync/grafana`,
  `/api/telemetry/metrics/grafana/{ping,boards,config}` ("Handle GET request for
  Grafana..."); these are Meshery integration endpoints, not Grafana's API. They sit
  in apis-guru-ops.csv.gz, apis-guru-specs/meshery.local.json, pass-v4 batches
  (038, 042, 106, gbatch-001/037/078), pass-key.csv, export-v4 (and -gap),
  markers.csv.gz, and rwxlite round10/11/12/13/13-t2/train, m0/mechanical.jsonl.gz,
  m1/corpus-parity.jsonl, v4/rwxlite-w-unique.csv. Also enum or schema names in
  exam3 novu.json (CreateGrafanaOnCallIntegrationEndpointDto), rwxlite
  fresh-exam-specs/novu, exam4 render.json (`"GRAFANA"` enum), exam5 hookdeck.json
  (`"GRAFANA"` enum, x30), rwxlite posthog.json.gz ("Import a Grafana dashboard JSON
  model"). These train/val rows with grafana text mean the labelled sets contain
  operations about Grafana from other vendors, not Grafana's own operations.
- ringcentral: alertersystem.com (apis-guru) resource `TransportRingCentral`, path
  `/api/transport-ring-central` (GET/POST/PUT...), in the same files as the meshery
  rows plus pass-v4 batch-040/055, sbatch-060, gbatch-054, pilot2-v4 pilot-blind
  and pilot-key; mist.com.json (`"key":"ringcentral","name":"RingCentral"`);
  amazonaws alexaforbusiness (`"RINGCENTRAL"` enum); novu.json (`"ring-central"` SMS
  provider enum); hookdeck.json (`SourceConfigWebhookAuthRingCentral`).
- invoiceninja: only hookdeck.json (`"INVOICE_NINJA"` enum, `SourceConfigWebhookAuthInvoiceNinja`).
- cloudsmith: only hookdeck.json (`"CLOUDSMITH"` enum). baserow: hookdeck.json
  (`"BASEROW"` enum) and a substring false hit in azure servicefabric ("DatabaseRowCountEstimate").
- sonarr/radarr/noco substring false positives only: `JSONARRAY` (auth0 management
  API text, copied into exam-2026-09-20, relabel, pass-v4, jev, combined rows),
  `RadarReviewList`/`RadarRadarOptions` (stripe), `radarRank` (cloudflare), `sonarr`
  inside unicourt "sosDataArray", `Conoco` (ljaero dflight).
- nocodb, servarr: no hit anywhere.

Nothing in `poc/` or `docs/` outside the two shortlist dirs was part of this grep
(step 4 scope was data/). The prior exclusion build already reads poc and docs.

## Combos of 5 to 7 vendors totalling 1,300-1,600 deduped ops

Enumerated over all 7 candidates (radarr only, no sonarr). Only these qualify; every
6- or 7-vendor set exceeds 1,600 and every combo with baserow does too.

| vendors | count | total ops |
|---|---|---|
| grafana, nocodb, radarr, ringcentral, cloudsmith | 5 | 1555 |
| grafana, nocodb, radarr, ringcentral, invoiceninja | 5 | 1558 |
| grafana, nocodb, radarr, cloudsmith, invoiceninja | 5 | 1587 |

No 6- or 7-vendor combo exists in range from these candidates. All three combos
contain grafana, nocodb and radarr. Combos are listed, not recommended.

## Open points for the orchestrator

1. Whether the meshery.local grafana operations and the alertersystem
   `TransportRingCentral` operations make grafana or ringcentral "seen" is a ruling.
   Facts: they are other vendors' operations; no Grafana or RingCentral spec is in
   either tree.
2. Neither bunny nor langfuse is in the exclusion data, so the list alone does not
   block them; they stay out by instruction.
3. Mutable live URLs (cloudsmith, baserow) and a 2021 file (ringcentral) mean the
   bytes can drift or lag; sha256 is the pin.
4. All three in-range combos share grafana, nocodb and radarr, whose specs are
   code-generated (radarr has no operationId or summary at all).
