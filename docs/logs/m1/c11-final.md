# M1-C11 final: the adopted c11.mjs flow, scored

c11.mjs's classify(row) — the C11 floor + raise-only shape frozen as V3a in
the M1-C11v sweep — scored against census-ops.csv (camara, holdout1,
holdout2) and, when present, holdout3 (data/holdout3-2026-09-08/).

holdout3: present, 226 rows.
holdout4: not present.

## Per-set summary

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 262 | 1 | 29 | 89.7 | 0.3 | 9.9 |
| holdout1 | 207 | 151 | 2 | 54 | 72.9 | 1.0 | 26.1 |
| holdout2 | 220 | 195 | 0 | 25 | 88.6 | 0.0 | 11.4 |
| holdout3 | 226 | 199 | 2 | 25 | 88.1 | 0.9 | 11.1 |

## Per-rule, per-set breakdown

| rule | set | hit | exact | leaks | over_tight |
| --- | --- | --- | --- | --- | --- |
| locked | camara | 96 | 96 | 0 | 0 |
| locked | holdout1 | 0 | 0 | 0 | 0 |
| locked | holdout2 | 94 | 94 | 0 | 0 |
| locked | holdout3 | 102 | 102 | 0 | 0 |
| live-verb | camara | 19 | 12 | 0 | 7 |
| live-verb | holdout1 | 11 | 8 | 0 | 3 |
| live-verb | holdout2 | 12 | 11 | 0 | 1 |
| live-verb | holdout3 | 4 | 3 | 0 | 1 |
| party-noun | camara | 12 | 5 | 0 | 7 |
| party-noun | holdout1 | 45 | 16 | 0 | 29 |
| party-noun | holdout2 | 10 | 4 | 0 | 6 |
| party-noun | holdout3 | 13 | 13 | 0 | 0 |
| read-verb | camara | 50 | 50 | 0 | 0 |
| read-verb | holdout1 | 0 | 0 | 0 | 0 |
| read-verb | holdout2 | 2 | 2 | 0 | 0 |
| read-verb | holdout3 | 0 | 0 | 0 | 0 |
| no-text | camara | 0 | 0 | 0 | 0 |
| no-text | holdout1 | 4 | 0 | 0 | 4 |
| no-text | holdout2 | 0 | 0 | 0 | 0 |
| no-text | holdout3 | 21 | 13 | 0 | 8 |
| floor | camara | 115 | 99 | 1 | 15 |
| floor | holdout1 | 147 | 127 | 2 | 18 |
| floor | holdout2 | 102 | 84 | 0 | 18 |
| floor | holdout3 | 86 | 68 | 2 | 16 |

## Negative controls

Both must be x.

| set | repo | method | path | operationId | class | rule | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | ClickToDial | DELETE | /calls/{callId} | terminateCall | x | live-verb | opid:terminate |
| camara | WebRTC | PUT | /sessions/{mediaSessionId}/status | updateSessionStatus | x | party-noun | opid:session |

PASS — both controls x.

## Leaking rows — 5 rows

| set | repo | method | path | operationId | gt | pred | rule | evidence | summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camara | TrafficInfluence | DELETE | /traffic-influences/{trafficInfluenceID} | deleteTrafficInfluence | x | w | floor |  | Delete an existing TrafficInfluence resource |
| holdout1 | github | PUT | /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values | issues/set-issue-field-values | x | w | floor |  | Set issue field values for an issue |
| holdout1 | github | DELETE | /repos/{owner}/{repo}/issues/{issue_number}/sub_issue | issues/remove-sub-issue | x | w | floor |  | Remove sub-issue |
| holdout3 | discord | PUT | /guilds/{guild_id}/incident-actions | update_guild_incident_actions | x | w | floor |  |  |
| holdout3 | vercel | DELETE | /v1/bulk-redirects | deleteRedirects | x | w | floor |  | Delete project-level redirects. |

