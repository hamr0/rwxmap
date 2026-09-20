# Pre-registered vendor split — 2026-09-18

## Why this exists

The clean exam of 2026-09-17 is burned (D24, scored once). The next
exam must be virgin by construction, not by promise. If we browse
every candidate vendor, keep the ones that look good for mining, and
leave the rest for the exam, the leftovers are not unseen any more —
the choice itself leaked information. So the split is committed before
a single row of either pile is read. This file is that commitment.
Anything not in the build pile below is unavailable for mining, tuning
or word-list work, permanently.

## Finding: apis-guru is build-only, permanently

Every large apis-guru vendor already had rows drawn into exams 1
through 5 (microsoft.com, github.com, azure.com, netbox.dev, gitea.io,
keycloak.local, trello.com, gitlab.com, atlassian.com all appear).
Exam exclusion is by vendor name, both raw token and registrable name,
so those vendors are burned for exam use whether or not the specific
rows were drawn. Conclusion: apis-guru is the build pile's only source
and can never again supply an exam. The next exam must come from fresh
official complete specs, as okta/docusign/xero did.

## The build pile — read, mine, tune

13 vendors from apis-guru. github.com and microsoft.com are capped
because github alone holds 5492 of the 6454 access-ish write rows in
the small-vendor pile (85%); mining it uncapped would produce a
github word list, which is how three previous lists died. github.com,
microsoft.com and azure.com are also one corporate family, so
azure.com is left out entirely for naming diversity.

| vendor | draw | why |
|---|---|---|
| github.com | cap 300 | 4791 PUT/DEL/PATCH, 5492 access-ish write rows; capped so it cannot dominate |
| microsoft.com | cap 200 | 8730 PUT/DEL/PATCH, 6796 access-ish; different naming family (graph, dynamics) from github |
| gitea.io | all | 131 access-ish write rows |
| appcenter.ms | all | 121 |
| netbox.dev | all | 121 |
| clearblade.com | all | 117 |
| keycloak.local | all | 103 |
| atlassian.com | all | 89 |
| dracoon.team | all | 81 |
| trello.com | all | 58 |
| box.com | all | 49 |
| gitlab.com | all | 46 |
| launchdarkly.com | all | 46 |

Target size roughly 1450 rows, comparable to the 1383-row exam. Write
methods only (POST, PUT, DELETE, PATCH) — step 1 and the r class
scored 583 of 583 on the exam and are not the problem.

## The exam pile — locked

These ten vendors appear in NO apis-guru row, NO row of the
15-provider corpus, and NO earlier exam or holdout. Nobody opens
them, reads them, or mines them until an exam is drawn from fresh
official complete specs. Vendors: auth0, cloudflare, hubspot, zendesk,
pagerduty, dropbox, shopify, linear, miro, sentry. Note that auth0,
cloudflare and pagerduty are the access-and-permission-heavy ones,
which is exactly where 96 of the burned exam's 171 leaks lived, so
they are the valuable exam rows and the most tempting to peek at.

## What would falsify this plan

- If the labelled build set turns out to hold roughly the corpus's
  7.3% truth-x on PUT/DELETE/PATCH rather than something near the
  exam's ~40%, the set does not contain the failure mode and no list
  mined on it can be trusted.
- If a mined list scores well on the build set but collapses under
  leave-one-vendor-out, it is a vendor list, not a rule, and is
  rejected as three previous lists were.
- If github and microsoft rows dominate the fires despite the caps,
  the cap was too loose.

## Status

This split is pre-registered and not yet drawn. No row of either
pile has been read at the time of this commit.

## Amendment — 2026-09-18, after measuring the pool

The original draw of "cap github 300, microsoft 200, everyone else
whole, roughly 1450 rows" measured at 2722 rows, and measurement
found two things the pre-registration could not have known.

First, apis-guru carries the same endpoint many times over under
different spec variants — github.com's 7136 write rows are only 544
unique endpoints, repeated across api.github.com, ghec and the
ghes-N releases, and microsoft.com's 16878 are 11866 unique; the 11
small vendors carry no duplicates at all. The draw now dedupes on
provider+method+path+operationId before capping.

Second, the caps are amended to a UNIFORM 150 rows per vendor for
all 13 vendors, giving 1819 rows. Reason: a uniform cap removes
github and microsoft dominance by construction rather than by a
share bar, and it gives every vendor equal weight, which is the only
way leave-one-vendor-out scores mean the same thing for each vendor
left out.

All four write methods stay in: PUT/DELETE/PATCH carry 151 of the
burned exam's 171 leaks, but step 2 also claims POST rows, and a
list mined without POST present cannot be priced for false alarms on
the method it fires on most.

The vendor membership of neither pile changed — only the per-vendor
row cap and the dedupe. No exam-pile row has been read.
