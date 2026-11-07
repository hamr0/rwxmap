# D137 pilot 2: v4 truth, 200 rows, factual Jev questions

Purpose. Pilot 1's Jev question was unfair to it (access rules in "ignore", a probability model cannot express "unclear, so x"). Pilot 2 asks Jev five FACTS per row (poc/v4-pilot2/jev-facts.mjs); our code applies the rule (poc/v4-pilot2/rule.mjs). The rows are labelled under BRIEF-v4 (data/relabel-v4-2026-11-05/BRIEF-v4.md) by two blind Sonnet labellers.

## Pre-registered bar (set before running)

"Jev's rule label must catch at least 95% of the rows the two Sonnet labellers agree are x; false x is reported separately. The cut-off is p >= 0.5 for every question, fixed before running. Truth = the two blind Sonnet labellers' agreed label under BRIEF-v4; disputes go to the user. Pilot 1's rows were not reused, because they shaped this question."

## Draw

- Script: poc/v4-pilot2/draw.mjs (rerun gives byte-identical files).
- Pool: data/pass-v4-2026-11-05/pass-key.csv, 33321 rows (it already excludes the pilot 1 rows).
- Strata, 100 rows each:
  - access: operationId, summary, description and path match, case-insensitive: `permission|polic(y|ies)|\brole|grant|\bacl\b|access|share|sharing|collaborator|member|owner|deploy.?key|\biam\b|binding|invite|token|api.?key|webhook|subscri|\buser|account|group|team|scope` (16738 pool rows match)
  - random: pool rows that do not match it (16583 rows)
- Seed: 20261106 (mulberry32). Each stratum is shuffled and taken in order; the final 200 are shuffled again to assign q001-q200.
- Cap: 8 rows per provider per stratum. Strata sizes: access 100, random 100.

## Counts

- Per stratum: access 100, random 100.
- Per pass stratum: w-v3 187, pre-v3 13
- Providers, access: amazonaws.com 8, azure.com 8, microsoft.com 8, cloudflare 7, googleapis.com 7, docusign 3, jira 3, microsoft 3, appwrite.io 2, atlassian 2, atlassian.com 2, clerk.com 2, coolify.io 2, github.com 2, klaviyo 2, twilio.com 2, zoom.us 2, asana 1, auth0 1, autotask.net 1, box 1, britbox.co.uk 1, bungie.net 1, chatwoot.com 1, citrixonline.com 1, codat.io 1, contribly.com 1, figma 1, getpostman.com 1, gitea 1, github 1, hubspot 1, immich.app 1, linode.com 1, mailchimp 1, meraki.com 1, meshery.local 1, mist.com 1, novu.co 1, okta 1, rumble.run 1, sentry 1, spotify 1, square 1, turbinelabs.io 1, twilio 1, vercel 1, vercel.com 1, vimeo.com 1, watchful.li 1, workos.com 1, zuora.com 1.
- Providers, random: amazonaws.com 8, microsoft.com 8, googleapis.com 7, kubernetes.io 4, okta 4, autotask.net 3, magento.com 3, xero 3, alertersystem.com 2, cloudflare 2, digitalocean 2, frankiefinancial.io 2, gambitcomm.local 2, gsmtasks.com 2, jira.local 2, netboxdemo.com 2, trello 2, vimeo.com 2, walletobjects.googleapis.com 2, adyen 1, adyen.com 1, apideck.com 1, apple.com 1, azure.com 1, brex.io 1, climate.com 1, credas.co.uk 1, datadog 1, discord 1, dracoon.team 1, gerermesaffaires.com 1, getgo.com 1, here.com 1, hetzner.cloud 1, hubspot 1, id4i.de 1, intercom 1, jellyfin.local 1, loket.nl 1, netbox 1, netbox.dev 1, netlify.com 1, osisoft.com 1, paypal 1, payrun.io 1, probely.com 1, quotes.rest 1, rebilly.com 1, render.com 1, tl-api.azurewebsites.net 1, vmware.local 1, vocadb.net 1, waterlinked.com 1, x 1, xtrf.eu 1, zeno.fm 1, zuora.com 1.
- Providers, both: amazonaws.com 16, microsoft.com 16, googleapis.com 14, azure.com 9, cloudflare 9, okta 5, autotask.net 4, kubernetes.io 4, docusign 3, jira 3, magento.com 3, microsoft 3, vimeo.com 3, xero 3, alertersystem.com 2, appwrite.io 2, atlassian 2, atlassian.com 2, clerk.com 2, coolify.io 2, digitalocean 2, frankiefinancial.io 2, gambitcomm.local 2, github.com 2, gsmtasks.com 2, hubspot 2, jira.local 2, klaviyo 2, netboxdemo.com 2, trello 2, twilio.com 2, walletobjects.googleapis.com 2, zoom.us 2, zuora.com 2, adyen 1, adyen.com 1, apideck.com 1, apple.com 1, asana 1, auth0 1, box 1, brex.io 1, britbox.co.uk 1, bungie.net 1, chatwoot.com 1, citrixonline.com 1, climate.com 1, codat.io 1, contribly.com 1, credas.co.uk 1, datadog 1, discord 1, dracoon.team 1, figma 1, gerermesaffaires.com 1, getgo.com 1, getpostman.com 1, gitea 1, github 1, here.com 1, hetzner.cloud 1, id4i.de 1, immich.app 1, intercom 1, jellyfin.local 1, linode.com 1, loket.nl 1, mailchimp 1, meraki.com 1, meshery.local 1, mist.com 1, netbox 1, netbox.dev 1, netlify.com 1, novu.co 1, osisoft.com 1, paypal 1, payrun.io 1, probely.com 1, quotes.rest 1, rebilly.com 1, render.com 1, rumble.run 1, sentry 1, spotify 1, square 1, tl-api.azurewebsites.net 1, turbinelabs.io 1, twilio 1, vercel 1, vercel.com 1, vmware.local 1, vocadb.net 1, watchful.li 1, waterlinked.com 1, workos.com 1, x 1, xtrf.eu 1, zeno.fm 1.

## Files

- pilot-key.csv: answer key (pilot_id, pass_id, origins, provider, method, path, operationId, summary, description, stratum, pass_stratum).
- pilot-blind.csv (+ .sha256): the file labellers and Jev see: row_id,provider,method,path,operationId,summary,description.
- jev-facts-question.json (+ .sha256): the five factual questions, built by poc/v4-pilot2/jev-facts.mjs.

## Result

All numbers recomputed from the files in this folder (labels-A.csv, labels-B.csv, rulings.csv, jev-facts.jsonl, truth-v4.csv).

- Labellers (two blind Sonnets) agree on 197 of 200 rows. The 3 disputes were ruled by the user.
- Truth (poc/v4-pilot2/build-truth.mjs): x 31, w 164, r 5 (192 agreed, 8 ruled). truth-v4.csv has a .sha256.
- Jev's rule label on the 197 agreed rows catches 27 of 28 x (96.4%). Bar was 95%: PASS. False x: 23 of the 169 agreed non-x rows (164 w, 5 r).
- The one miss is q026 adyen PATCH termsOfService (d): otherX p 0.22, below the 0.5 cut-off.
- Cost: 621,105 input and 21,800 output tokens; 41 s for 200 rows; 0 errors.

### Rulings (user, 2026-11-05/06; rulings.csv)

1. The three disputes are x: q045 azure content key policy set (direction not stated, g); q075 docusign update authorization dates (a new end date can extend access, g); q129 aws email event destination update (changes where events are sent, c).
2. Rows both Sonnet labellers call r are corrected to r and reported separately as "fixes": q016, q021, q044, q071, q106 (each a v3 w).

### The 23 false-x rows, as the orchestrator read them row by row

- Likely real x the Sonnets missed: q116 xero payments; q039, q066, q086, q091, q200 (webhooks or integrations whose destination changes); q136 gitea GPG key; q143 azure activation keys; q054 clerk API key update.
- Likely Jev overreach: q003, q004, q038, q078, q080, q103, q120.
- Unread: q032, q052, q152, q165, q175, q177, q197.

### Design for the full pass (user ruling)

Jev labels the full pass with these factual questions and the rule in rule.mjs. Sonnet does a second pass on the SUSPECT rows only, fixed before the run as:

- (a) every row Jev labels x;
- (b) Jev-w rows where any of the five questions has p >= 0.2 (and < 0.5);
- (c) a seeded random 5% of the remaining Jev-w rows, to measure misses.

Where Sonnet and Jev disagree, the rows go to the user grouped by pattern. The AWS/GitHub vendor cross-check runs afterwards.
