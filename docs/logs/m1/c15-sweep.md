# M1-C15 sweep: per-method-floor arbiter vs c11

Measurement only — nothing here is adopted.

camara+holdout1+holdout2 (census): 719 rows. holdout3: 226 rows. holdout4: 210 rows. holdout5: 323 rows. all: 1478 rows.

## Configuration: c11

### Per set

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 260 | 1 | 31 | 89.0 | 0.3 | 10.6 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 194 | 0 | 26 | 88.2 | 0.0 | 11.8 |
| holdout3 | 226 | 198 | 1 | 27 | 87.6 | 0.4 | 11.9 |
| holdout4 | 210 | 182 | 0 | 28 | 86.7 | 0.0 | 13.3 |
| holdout5 | 323 | 241 | 17 | 65 | 74.6 | 5.3 | 20.1 |
| all | 1478 | 1221 | 21 | 236 | 82.6 | 1.4 | 16.0 |

### Per method (all sets pooled)

| method | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | 550 | 533 | 17 | 0 | 96.9 | 3.1 | 0.0 |
| POST | 509 | 380 | 0 | 129 | 74.7 | 0.0 | 25.3 |
| PUT | 127 | 101 | 1 | 25 | 79.5 | 0.8 | 19.7 |
| DELETE | 250 | 194 | 3 | 53 | 77.6 | 1.2 | 21.2 |
| PATCH | 42 | 13 | 0 | 29 | 31.0 | 0.0 | 69.0 |
| all | 1478 | 1221 | 21 | 236 | 82.6 | 1.4 | 16.0 |

### Evidence vs floor

| bucket | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| evidence | 259 | 172 | 0 | 87 | 66.4 | 0.0 | 33.6 |
| floor | 1219 | 1049 | 21 | 149 | 86.1 | 1.7 | 12.2 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Configuration: c15 (noTextRaise off)

### Per set

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 265 | 2 | 25 | 90.8 | 0.7 | 8.6 |
| holdout1 | 207 | 150 | 2 | 55 | 72.5 | 1.0 | 26.6 |
| holdout2 | 220 | 197 | 0 | 23 | 89.5 | 0.0 | 10.5 |
| holdout3 | 226 | 205 | 4 | 17 | 90.7 | 1.8 | 7.5 |
| holdout4 | 210 | 185 | 1 | 24 | 88.1 | 0.5 | 11.4 |
| holdout5 | 323 | 245 | 18 | 60 | 75.9 | 5.6 | 18.6 |
| all | 1478 | 1247 | 27 | 204 | 84.4 | 1.8 | 13.8 |

### Per method (all sets pooled)

| method | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | 550 | 533 | 17 | 0 | 96.9 | 3.1 | 0.0 |
| POST | 509 | 382 | 0 | 127 | 75.0 | 0.0 | 25.0 |
| PUT | 127 | 102 | 1 | 24 | 80.3 | 0.8 | 18.9 |
| DELETE | 250 | 200 | 3 | 47 | 80.0 | 1.2 | 18.8 |
| PATCH | 42 | 30 | 6 | 6 | 71.4 | 14.3 | 14.3 |
| all | 1478 | 1247 | 27 | 204 | 84.4 | 1.8 | 13.8 |

### Evidence vs floor

| bucket | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| evidence | 208 | 133 | 0 | 75 | 63.9 | 0.0 | 36.1 |
| floor | 1270 | 1114 | 27 | 129 | 87.7 | 2.1 | 10.2 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Configuration: c15 (noTextRaise on)

### Per set

| set | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camara | 292 | 265 | 2 | 25 | 90.8 | 0.7 | 8.6 |
| holdout1 | 207 | 146 | 2 | 59 | 70.5 | 1.0 | 28.5 |
| holdout2 | 220 | 197 | 0 | 23 | 89.5 | 0.0 | 10.5 |
| holdout3 | 226 | 202 | 3 | 21 | 89.4 | 1.3 | 9.3 |
| holdout4 | 210 | 185 | 1 | 24 | 88.1 | 0.5 | 11.4 |
| holdout5 | 323 | 245 | 18 | 60 | 75.9 | 5.6 | 18.6 |
| all | 1478 | 1240 | 26 | 212 | 83.9 | 1.8 | 14.3 |

### Per method (all sets pooled)

| method | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | 550 | 533 | 17 | 0 | 96.9 | 3.1 | 0.0 |
| POST | 509 | 382 | 0 | 127 | 75.0 | 0.0 | 25.0 |
| PUT | 127 | 101 | 1 | 25 | 79.5 | 0.8 | 19.7 |
| DELETE | 250 | 194 | 3 | 53 | 77.6 | 1.2 | 21.2 |
| PATCH | 42 | 30 | 5 | 7 | 71.4 | 11.9 | 16.7 |
| all | 1478 | 1240 | 26 | 212 | 83.9 | 1.8 | 14.3 |

### Evidence vs floor

| bucket | n | exact | leaks | over_tight | exact_pct | leak_pct | over_tight_pct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| evidence | 208 | 133 | 0 | 75 | 63.9 | 0.0 | 36.1 |
| floor | 1270 | 1107 | 26 | 137 | 87.2 | 2.0 | 10.8 |

Negative controls — terminateCall: x, updateSessionStatus: x — PASS

## Negative controls, all configurations

| configuration | terminateCall | updateSessionStatus | result |
| --- | --- | --- | --- |
| c11 | x | x | PASS |
| c15 (noTextRaise off) | x | x | PASS |
| c15 (noTextRaise on) | x | x | PASS |

PASS — both controls x in every configuration.

## Review pile: floor:true rows on PUT/DELETE/PATCH

| configuration | review_pile_n | truly_x |
| --- | --- | --- |
| c11 | 275 | 10 |
| c15 (noTextRaise off) | 275 | 10 |
| c15 (noTextRaise on) | 275 | 10 |

## Leaks, full listing

### c11 — 21 leak(s)

| set | method | operationId | truth | predicted | rule | label |
| --- | --- | --- | --- | --- | --- | --- |
| camara | DELETE | deleteTrafficInfluence | x | w | floor | x-dressed-as-w |
| holdout1 | PUT | issues/set-issue-field-values | x | w | floor | x-dressed-as-w |
| holdout1 | DELETE | issues/remove-sub-issue | x | w | floor | x-dressed-as-w |
| holdout3 | DELETE | deleteRedirects | x | w | floor | x-dressed-as-w |
| holdout5 | GET | apps_permissions_request | x | r | locked |  |
| holdout5 | GET | apps_permissions_users_request | x | r | locked |  |
| holdout5 | GET | apps_uninstall | w | r | locked |  |
| holdout5 | GET | auth_revoke | w | r | locked |  |
| holdout5 | GET | dialog_open | x | r | locked |  |
| holdout5 | GET | files_remote_share | x | r | locked |  |
| holdout5 | GET | oauth_access | x | r | locked |  |
| holdout5 | GET | oauth_token | x | r | locked |  |
| holdout5 | GET | oauth_v2_access | x | r | locked |  |
| holdout5 | GET | rtm_connect | x | r | locked |  |
| holdout5 | GET | views_open | x | r | locked |  |
| holdout5 | GET | views_publish | x | r | locked |  |
| holdout5 | GET | views_push | x | r | locked |  |
| holdout5 | GET | views_update | w | r | locked |  |
| holdout5 | GET | workflows_stepCompleted | x | r | locked |  |
| holdout5 | GET | workflows_stepFailed | x | r | locked |  |
| holdout5 | GET | workflows_updateStep | w | r | locked |  |

### c15 (noTextRaise off) — 27 leak(s)

| set | method | operationId | truth | predicted | rule | label |
| --- | --- | --- | --- | --- | --- | --- |
| camara | PATCH | patchTrafficInfluence | x | w | floor | x-dressed-as-w |
| camara | DELETE | deleteTrafficInfluence | x | w | floor | x-dressed-as-w |
| holdout1 | PUT | issues/set-issue-field-values | x | w | floor | x-dressed-as-w |
| holdout1 | DELETE | issues/remove-sub-issue | x | w | floor | x-dressed-as-w |
| holdout3 | PATCH | update_stage_instance | x | w | floor | x-dressed-as-w |
| holdout3 | PATCH | patchUrlProtectionBypass | x | w | floor | x-dressed-as-w |
| holdout3 | DELETE | deleteRedirects | x | w | floor | x-dressed-as-w |
| holdout3 | PATCH | updateSandbox | x | w | floor | x-dressed-as-w |
| holdout4 | PATCH | ssl-verification-edit-ssl-certificate-pack-validation-method | x | w | floor | x-dressed-as-w |
| holdout5 | GET | apps_permissions_request | x | r | floor |  |
| holdout5 | GET | apps_permissions_users_request | x | r | floor |  |
| holdout5 | GET | apps_uninstall | w | r | floor |  |
| holdout5 | GET | auth_revoke | w | r | floor |  |
| holdout5 | GET | dialog_open | x | r | floor |  |
| holdout5 | GET | files_remote_share | x | r | floor |  |
| holdout5 | GET | oauth_access | x | r | floor |  |
| holdout5 | GET | oauth_token | x | r | floor |  |
| holdout5 | GET | oauth_v2_access | x | r | floor |  |
| holdout5 | GET | rtm_connect | x | r | floor |  |
| holdout5 | GET | views_open | x | r | floor |  |
| holdout5 | GET | views_publish | x | r | floor |  |
| holdout5 | GET | views_push | x | r | floor |  |
| holdout5 | GET | views_update | w | r | floor |  |
| holdout5 | GET | workflows_stepCompleted | x | r | floor |  |
| holdout5 | GET | workflows_stepFailed | x | r | floor |  |
| holdout5 | GET | workflows_updateStep | w | r | floor |  |
| holdout5 | PATCH | patch-block-children | x | w | floor | x-dressed-as-w |

### c15 (noTextRaise on) — 26 leak(s)

| set | method | operationId | truth | predicted | rule | label |
| --- | --- | --- | --- | --- | --- | --- |
| camara | PATCH | patchTrafficInfluence | x | w | floor | x-dressed-as-w |
| camara | DELETE | deleteTrafficInfluence | x | w | floor | x-dressed-as-w |
| holdout1 | PUT | issues/set-issue-field-values | x | w | floor | x-dressed-as-w |
| holdout1 | DELETE | issues/remove-sub-issue | x | w | floor | x-dressed-as-w |
| holdout3 | PATCH | patchUrlProtectionBypass | x | w | floor | x-dressed-as-w |
| holdout3 | DELETE | deleteRedirects | x | w | floor | x-dressed-as-w |
| holdout3 | PATCH | updateSandbox | x | w | floor | x-dressed-as-w |
| holdout4 | PATCH | ssl-verification-edit-ssl-certificate-pack-validation-method | x | w | floor | x-dressed-as-w |
| holdout5 | GET | apps_permissions_request | x | r | floor |  |
| holdout5 | GET | apps_permissions_users_request | x | r | floor |  |
| holdout5 | GET | apps_uninstall | w | r | floor |  |
| holdout5 | GET | auth_revoke | w | r | floor |  |
| holdout5 | GET | dialog_open | x | r | floor |  |
| holdout5 | GET | files_remote_share | x | r | floor |  |
| holdout5 | GET | oauth_access | x | r | floor |  |
| holdout5 | GET | oauth_token | x | r | floor |  |
| holdout5 | GET | oauth_v2_access | x | r | floor |  |
| holdout5 | GET | rtm_connect | x | r | floor |  |
| holdout5 | GET | views_open | x | r | floor |  |
| holdout5 | GET | views_publish | x | r | floor |  |
| holdout5 | GET | views_push | x | r | floor |  |
| holdout5 | GET | views_update | w | r | floor |  |
| holdout5 | GET | workflows_stepCompleted | x | r | floor |  |
| holdout5 | GET | workflows_stepFailed | x | r | floor |  |
| holdout5 | GET | workflows_updateStep | w | r | floor |  |
| holdout5 | PATCH | patch-block-children | x | w | floor | x-dressed-as-w |

