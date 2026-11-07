# D137 pilot: v4 truth, 200 w rows

Purpose. The step-4 pilot of the D137 truth-v4 plan (docs/wiki/truth-v4-plan.md). 200 rows that are w under v3 truth are labelled under BRIEF-v4 (data/relabel-v4-2026-11-05/BRIEF-v4.md) by two blind labellers and by Jev with a v4 question. This calibrates the brief and decides who does the full w pass.

## Pre-registered bar (set before running)

"Jev must catch at least 95% of the rows the labellers' truth calls x, with its false x reported separately."

## Rules

- Truth = the two Sonnet labellers' agreed label. Disputes go to the user.
- Jev is scored against that truth.
- The user ruled both labellers use Sonnet (2026-11-05).
- Labellers see only pilot-blind.csv (no label, stratum or source). pilot-key.csv is the answer key and stays out of their sight.

## Draw

- Script: poc/v4-pilot/draw.mjs (rerun gives byte-identical files).
- Pool: every row labelled w in the v3 sets: combined-2026-09-21/labelled.csv, relabel-buildset-2026-09-23/labelled.csv, exam-2026-09-22/labelled.csv, exam3-2026-11-04/truth-d136.csv and exam4-2026-11-04/truth-d136.csv (user ruling; joined to ops.csv), rwxlite-fresh-2026-11-03/truth.csv (joined to ops.csv.gz). Pool size: 6091 w rows (of 16486 rows read; 0 with no label).
- Strata, 100 rows each:
  - access: operationId, summary, description and path match, case-insensitive: `permission|polic(y|ies)|\brole|grant|\bacl\b|access|share|sharing|collaborator|member|owner|deploy.?key|\biam\b|binding|invite|token|api.?key|webhook|subscri|\buser|account|group|team|scope` (3629 w rows match)
  - random: w rows that do not match it (2462 rows)
- Seed: 20261105 (mulberry32). Each stratum is shuffled and taken in order; the final 200 are shuffled again to assign p001-p200.
- Cap: 8 rows per provider per stratum. Both strata reached 100 under the cap (access 100, random 100).

## Counts

- Per stratum: access 100, random 100.
- Per source set: buildset-2026-09-18 48, provider-corpus-2026-09-16 45, exam-2026-09-20 24, exam-2026-09-22 23, exam3-2026-11-04 18, exam4-2026-11-04 18, exam-2026-09-17 17, rwxlite-fresh-2026-11-03 7.
- Providers, access: cloudflare 8, docusign 5, pagerduty 5, asana 4, atlassian 4, dracoon 4, gitea 4, jira 4, openai 4, ory.sh 4, zulip.com 4, box 3, microsoft 3, netbird.io 3, appcenter 2, auth0 2, chatwoot.com 2, clearblade 2, getlago.com 2, github 2, hubspot 2, immich.app 2, miro 2, neon.com 2, okta 2, permit.io 2, spotify 2, square 2, stripe 2, zendesk 2, digitalocean 1, gitlab 1, goharbor.io 1, intercom 1, klaviyo 1, mailchimp 1, netbox 1, novu.co 1, sentry 1.
- Providers, random: cloudflare 8, digitalocean 7, okta 7, zendesk 7, hubspot 5, netbox 5, neon.com 4, square 4, trello 4, auth0 3, box 3, clearblade 3, coolify.io 3, datadog 3, mailchimp 3, stripe 3, xero 3, gitlab 2, goharbor.io 2, immich.app 2, intercom 2, microsoft 2, mux.com 2, resend.com 2, chatwoot.com 1, clerk.com 1, gitea 1, keycloak 1, launchdarkly 1, openai 1, pagerduty 1, paypal 1, polar.sh 1, render.com 1, supabase.com 1.
- Providers, both: cloudflare 16, okta 9, zendesk 9, digitalocean 8, hubspot 7, box 6, neon.com 6, netbox 6, pagerduty 6, square 6, auth0 5, clearblade 5, docusign 5, gitea 5, microsoft 5, openai 5, stripe 5, asana 4, atlassian 4, dracoon 4, immich.app 4, jira 4, mailchimp 4, ory.sh 4, trello 4, zulip.com 4, chatwoot.com 3, coolify.io 3, datadog 3, gitlab 3, goharbor.io 3, intercom 3, netbird.io 3, xero 3, appcenter 2, getlago.com 2, github 2, miro 2, mux.com 2, permit.io 2, resend.com 2, spotify 2, clerk.com 1, keycloak 1, klaviyo 1, launchdarkly 1, novu.co 1, paypal 1, polar.sh 1, render.com 1, sentry 1, supabase.com 1.

## Files

- pilot-key.csv: answer key (pilot_id, source_set, source_id, provider, method, path, operationId, summary, description, v3_label, stratum).
- pilot-blind.csv (+ .sha256): the file labellers and Jev see: row_id,provider,method,path,operationId,summary,description.
- jev-v4-question.json (+ .sha256): the v4 Jev question, built by poc/v4-pilot/jev-v4.mjs, not yet sent.

## Result (2026-11-05)

- Labellers: A (Sonnet) and B (Sonnet) agreed on 197 of 200 rows; 3 disputes (p164, p169, p186) were ruled x by the user (rulings.csv). Both labellers being Sonnet measures consistency, not two independent opinions (user's choice).
- Truth (truth-v4.csv + .sha256, built by poc/v4-pilot/build-truth.mjs): 31 x (28 agreed + 3 ruled), 169 w.
- Jev (jev-1.14.0, v4 question sha 4b241175..., about 559k input tokens) on the 197 agreed rows: caught 18 of 28 x (64.3%) against a 95% bar, with false x 0 of 169. FAIL. Seven of its 10 misses are the "widening not stated, x by doubt" case: p037 auth0 ACL, p092 atlassian share scope, p095 neon member, p099 ory API-key scopes, p114 pagerduty IP allow list, p165 openai role, p066 okta resource set. The other misses are p106 stripe accounts, p116 immich backup upload and p188 mux playback id. Lowering the cut-off does not rescue it: 0.3 gives 22/28 with 4 false x; 0.05 gives 27/28 with 81 false x. Picking a cut-off after seeing the results would be fitting anyway.
- Decision: per the user's ruling, the pass is labelled locally by two Sonnet labellers.
- Note: p116 (immich backup upload, e) and p188 (mux playback id, c) flip for reasons other than D137, which shows v3 mistakes on w rows also get caught. Flips are to be reported as D137 vs other.
