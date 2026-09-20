# Provider corpus read-out (poc/flow, frozen)

4171 rows, 15 providers, 5 methods. These rows carry no ground truth — this is a read-out of what the frozen classifier decided, never an accuracy score.

## Per-provider class split

| provider | n | r | w | x |
|---|---|---|---|---|
| asana | 249 | 119 (47.8%) | 38 (15.3%) | 92 (36.9%) |
| canva | 59 | 35 (59.3%) | 4 (6.8%) | 20 (33.9%) |
| datadog | 235 | 121 (51.5%) | 53 (22.6%) | 61 (26.0%) |
| digitalocean | 684 | 354 (51.8%) | 156 (22.8%) | 174 (25.4%) |
| figma | 54 | 43 (79.6%) | 6 (11.1%) | 5 (9.3%) |
| intercom | 231 | 114 (49.4%) | 53 (22.9%) | 64 (27.7%) |
| jira | 610 | 296 (48.5%) | 124 (20.3%) | 190 (31.1%) |
| mailchimp | 298 | 150 (50.3%) | 51 (17.1%) | 97 (32.6%) |
| meta-whatsapp | 113 | 50 (44.2%) | 6 (5.3%) | 57 (50.4%) |
| openai | 346 | 153 (44.2%) | 26 (7.5%) | 167 (48.3%) |
| paypal | 115 | 40 (34.8%) | 15 (13.0%) | 60 (52.2%) |
| spotify | 96 | 60 (62.5%) | 7 (7.3%) | 29 (30.2%) |
| square | 332 | 145 (43.7%) | 43 (13.0%) | 144 (43.4%) |
| stripe | 594 | 265 (44.6%) | 29 (4.9%) | 300 (50.5%) |
| zoom | 155 | 80 (51.6%) | 19 (12.3%) | 56 (36.1%) |

## Per-method class split (all 15 providers)

| method | n | r | w | x |
|---|---|---|---|---|
| DELETE | 473 | 0 (0.0%) | 326 (68.9%) | 147 (31.1%) |
| GET | 1960 | 1960 (100.0%) | 0 (0.0%) | 0 (0.0%) |
| PATCH | 84 | 0 (0.0%) | 59 (70.2%) | 25 (29.8%) |
| POST | 1309 | 65 (5.0%) | 0 (0.0%) | 1244 (95.0%) |
| PUT | 345 | 0 (0.0%) | 245 (71.0%) | 100 (29.0%) |

## Per-provider x per-method: which step/rule decided each row

| provider | method | n | decision (label: n) |
|---|---|---|---|
| asana | DELETE | 23 | step2:yours-noun: 14, step2:floor: 5, step3:other-noun: 4 |
| asana | GET | 119 | step1:method: 119 |
| asana | POST | 81 | step3:floor: 81 |
| asana | PUT | 26 | step2:yours-noun: 13, step3:other-noun: 7, step2:floor: 6 |
| canva | DELETE | 2 | step2:yours-noun: 2 |
| canva | GET | 34 | step1:method: 34 |
| canva | PATCH | 2 | step2:yours-noun: 2 |
| canva | POST | 21 | step3:floor: 20, step1:read-verb: 1 |
| datadog | DELETE | 28 | step2:yours-noun: 12, step2:floor: 11, step3:live-verb: 3, step3:other-noun: 2 |
| datadog | GET | 117 | step1:method: 117 |
| datadog | PATCH | 7 | step2:floor: 3, step3:other-noun: 3, step2:yours-noun: 1 |
| datadog | POST | 53 | step3:floor: 49, step1:read-verb: 4 |
| datadog | PUT | 30 | step2:floor: 15, step2:yours-noun: 11, step3:other-noun: 4 |
| digitalocean | DELETE | 99 | step2:floor: 63, step2:yours-noun: 22, step3:other-noun: 10, step3:live-verb: 4 |
| digitalocean | GET | 354 | step1:method: 354 |
| digitalocean | PATCH | 16 | step2:yours-noun: 7, step2:floor: 7, step3:live-verb: 2 |
| digitalocean | POST | 148 | step3:floor: 148 |
| digitalocean | PUT | 67 | step2:floor: 43, step2:yours-noun: 14, step3:live-verb: 6, step3:other-noun: 4 |
| figma | DELETE | 4 | step2:yours-noun: 3, step2:floor: 1 |
| figma | GET | 42 | step1:method: 42 |
| figma | POST | 6 | step3:floor: 5, step1:read-verb: 1 |
| figma | PUT | 2 | step2:yours-noun: 2 |
| intercom | DELETE | 31 | step2:floor: 16, step2:yours-noun: 15 |
| intercom | GET | 108 | step1:method: 108 |
| intercom | PATCH | 1 | step2:floor: 1 |
| intercom | POST | 68 | step3:floor: 62, step1:read-verb: 6 |
| intercom | PUT | 23 | step2:yours-noun: 12, step2:floor: 9, step3:other-noun: 2 |
| jira | DELETE | 89 | step3:other-noun: 42, step2:floor: 25, step2:yours-noun: 22 |
| jira | GET | 273 | step1:method: 273 |
| jira | POST | 130 | step3:floor: 107, step1:read-verb: 23 |
| jira | PUT | 118 | step2:floor: 49, step3:other-noun: 40, step2:yours-noun: 28, step3:live-verb: 1 |
| mailchimp | DELETE | 35 | step2:floor: 20, step3:other-noun: 10, step2:yours-noun: 4, step3:live-verb: 1 |
| mailchimp | GET | 149 | step1:method: 149 |
| mailchimp | PATCH | 32 | step2:floor: 19, step3:other-noun: 8, step2:yours-noun: 4, step3:live-verb: 1 |
| mailchimp | POST | 75 | step3:floor: 74, step1:read-verb: 1 |
| mailchimp | PUT | 7 | step2:floor: 4, step3:other-noun: 3 |
| meta-whatsapp | DELETE | 12 | step3:other-noun: 4, step2:floor: 3, step2:yours-noun: 3, step3:live-verb: 2 |
| meta-whatsapp | GET | 48 | step1:method: 48 |
| meta-whatsapp | POST | 53 | step3:floor: 51, step1:read-verb: 2 |
| openai | DELETE | 50 | step3:other-noun: 22, step2:floor: 16, step2:yours-noun: 10, step3:live-verb: 2 |
| openai | GET | 152 | step1:method: 152 |
| openai | POST | 144 | step3:floor: 143, step1:read-verb: 1 |
| paypal | DELETE | 8 | step2:floor: 3, step3:other-noun: 2, step2:yours-noun: 2, step3:live-verb: 1 |
| paypal | GET | 38 | step1:method: 38 |
| paypal | PATCH | 8 | step2:yours-noun: 3, step2:floor: 3, step3:other-noun: 2 |
| paypal | POST | 57 | step3:floor: 55, step1:read-verb: 2 |
| paypal | PUT | 4 | step2:floor: 2, step2:yours-noun: 2 |
| spotify | DELETE | 10 | step3:other-noun: 10 |
| spotify | GET | 60 | step1:method: 60 |
| spotify | POST | 7 | step3:floor: 7 |
| spotify | PUT | 19 | step3:other-noun: 10, step2:floor: 5, step2:yours-noun: 2, step3:live-verb: 2 |
| square | DELETE | 27 | step2:yours-noun: 10, step2:floor: 9, step3:other-noun: 7, step3:live-verb: 1 |
| square | GET | 121 | step1:method: 121 |
| square | POST | 148 | step3:floor: 124, step1:read-verb: 24 |
| square | PUT | 36 | step2:yours-noun: 12, step2:floor: 12, step3:other-noun: 11, step3:live-verb: 1 |
| stripe | DELETE | 32 | step2:floor: 19, step2:yours-noun: 10, step3:live-verb: 3 |
| stripe | GET | 265 | step1:method: 265 |
| stripe | POST | 297 | step3:floor: 297 |
| zoom | DELETE | 23 | step3:other-noun: 16, step2:floor: 5, step3:live-verb: 1, step2:yours-noun: 1 |
| zoom | GET | 80 | step1:method: 80 |
| zoom | PATCH | 18 | step3:other-noun: 9, step2:floor: 7, step2:yours-noun: 2 |
| zoom | POST | 21 | step3:floor: 21 |
| zoom | PUT | 13 | step3:other-noun: 9, step2:floor: 4 |

## Evidence vs floor

"evidence" = an actual rule fired on the row's text (read-verb, live-verb, other-noun, money-noun, yours-noun). "floor" = the method-only default with no text read (step1 GET/HEAD/OPTIONS, step2's x-pile fallback, step3's POST fallback).

Overall: 582 evidence (14.0%), 3589 floor (86.0%). x-pile flag: 385 rows (9.2%).

| provider | n | evidence | floor | x-pile |
|---|---|---|---|---|
| asana | 249 | 38 (15.3%) | 211 (84.7%) | 11 (4.4%) |
| canva | 59 | 5 (8.5%) | 54 (91.5%) | 0 (0.0%) |
| datadog | 235 | 40 (17.0%) | 195 (83.0%) | 29 (12.3%) |
| digitalocean | 684 | 69 (10.1%) | 615 (89.9%) | 113 (16.5%) |
| figma | 54 | 6 (11.1%) | 48 (88.9%) | 1 (1.9%) |
| intercom | 231 | 35 (15.2%) | 196 (84.8%) | 26 (11.3%) |
| jira | 610 | 156 (25.6%) | 454 (74.4%) | 74 (12.1%) |
| mailchimp | 298 | 32 (10.7%) | 266 (89.3%) | 43 (14.4%) |
| meta-whatsapp | 113 | 11 (9.7%) | 102 (90.3%) | 3 (2.7%) |
| openai | 346 | 35 (10.1%) | 311 (89.9%) | 16 (4.6%) |
| paypal | 115 | 14 (12.2%) | 101 (87.8%) | 8 (7.0%) |
| spotify | 96 | 24 (25.0%) | 72 (75.0%) | 5 (5.2%) |
| square | 332 | 66 (19.9%) | 266 (80.1%) | 21 (6.3%) |
| stripe | 594 | 13 (2.2%) | 581 (97.8%) | 19 (3.2%) |
| zoom | 155 | 38 (24.5%) | 117 (75.5%) | 16 (10.3%) |

| method | n | evidence | floor |
|---|---|---|---|
| DELETE | 473 | 277 (58.6%) | 196 (41.4%) |
| GET | 1960 | 0 (0.0%) | 1960 (100.0%) |
| PATCH | 84 | 44 (52.4%) | 40 (47.6%) |
| POST | 1309 | 65 (5.0%) | 1244 (95.0%) |
| PUT | 345 | 196 (56.8%) | 149 (43.2%) |

## Providers ranked by share of rows that hit the floor with no evidence

| rank | provider | n | floor | floor share |
|---|---|---|---|---|
| 1 | stripe | 594 | 581 | 97.8% |
| 2 | canva | 59 | 54 | 91.5% |
| 3 | meta-whatsapp | 113 | 102 | 90.3% |
| 4 | digitalocean | 684 | 615 | 89.9% |
| 5 | openai | 346 | 311 | 89.9% |
| 6 | mailchimp | 298 | 266 | 89.3% |
| 7 | figma | 54 | 48 | 88.9% |
| 8 | paypal | 115 | 101 | 87.8% |
| 9 | intercom | 231 | 196 | 84.8% |
| 10 | asana | 249 | 211 | 84.7% |
| 11 | datadog | 235 | 195 | 83.0% |
| 12 | square | 332 | 266 | 80.1% |
| 13 | zoom | 155 | 117 | 75.5% |
| 14 | spotify | 96 | 72 | 75.0% |
| 15 | jira | 610 | 454 | 74.4% |

## Read confidently vs mostly guessed

No provider had a majority of rows decided by a fired rule. It mostly guesses from the method alone (most rows hit the floor with no evidence) for: stripe, canva, meta-whatsapp, digitalocean, openai, mailchimp, figma, paypal, intercom, asana, datadog, square, zoom, spotify, jira.
