# M1-C26: one job per word — hand list becomes a NOT-YOURS filter

Combined corpus: 5465 rows, 332 vendors. Both asserted before scoring.

## Four configurations, LOVO, all 5465 rows

A = frozen baseline: classifyC20(row, junkSet, vendorAllowlist), default base (real c15.classify). MUST reproduce goal-2 = 89.
B = c15 base kept, allowlist made exclusive (excludeNotYours applied).
C = c26 base (no party-noun rule), allowlist NOT made exclusive.
D = c26 as designed — c26 base + exclusive allowlist. The candidate.

| config | n | goal-2 leaks (x->w) | goal-1 false alarms (info only) | goal-1 fa: floor | goal-1 fa: live-verb | goal-1 fa: no-own-noun | goal-1 fa: other | all-loosening |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A. frozen baseline (c15 + C20, default) | 5465 | 89 (1.6%) | 1936 (35.4%) | 103 | 81 | 1311 | 441 | 106 (1.9%) |
| B. c15 base + exclusive allowlist | 5465 | 89 (1.6%) | 1937 (35.4%) | 103 | 81 | 1312 | 441 | 106 (1.9%) |
| C. c26 base (no party-noun) + full allowlist | 5465 | 112 (2.0%) | 1776 (32.5%) | 103 | 81 | 1592 | 0 | 129 (2.4%) |
| D. c26 as designed (c26 base + exclusive allowlist) | 5465 | 95 (1.7%) | 1902 (34.8%) | 103 | 81 | 1718 | 0 | 112 (2.0%) |

Goal-1 false-alarm columns are informational only (goal 1 is not this pass's job) — reported, not optimised.

## excludeNotYours: what it removed

NOT_YOURS (PARTY_NOUNS ∪ SHARED_NOUNS from c11.mjs): 43 words.
Across all 332 per-vendor LOVO allowlists (minN=2, minW=0.8), the union of words actually removed by excludeNotYours: 14 words.

`access`, `account`, `assignment`, `channel`, `contact`, `customer`, `device`, `network`, `partner`, `person`, `pin`, `reaction`, `repository`, `webhook`

## PASS/FAIL

Config D goal-2 leaks: 95. Baseline A goal-2 leaks: 89. FAIL (D <= A required).

## Regression rows (goal-2 leak under D, not under A)

| vendor | method | operationId | path | truth | predicted | rule |
| --- | --- | --- | --- | --- | --- | --- |
| discord | PUT | update_guild_incident_actions | /guilds/{guild_id}/incident-actions | x | w | floor |
| docusign.net | PUT | PermissionProfiles_PutPermissionProfiles | /v2.1/accounts/{accountId}/permission_profiles/{permissionProfileId} | x | w | floor |
| trello.com | PUT | updateBoardsPrefsPermissionLevelByIdBoard | /boards/{idBoard}/prefs/permissionLevel | x | w | floor |
| windows.net | DELETE | OAuth2PermissionGrant_Delete | /{tenantID}/oauth2PermissionGrants/{objectId} | x | w | floor |
| googleapis.com | DELETE | tagmanager.accounts.user_permissions.delete | /tagmanager/v2/{path} | x | w | floor |
| walletobjects.googleapis.com | PUT | walletobjects.permissions.update | /walletobjects/v1/permissions/{resourceId} | x | w | floor |

## Rescued rows (goal-2 leak under A, not under D)

(none — empty list)

