# Hold-out set 2 — 2026-09-07

Three public OpenAPI 3 JSON files, none of them read or labelled by anyone
on this project before this extraction.

## Sources

- box: https://raw.githubusercontent.com/box/box-openapi/main/openapi.json
- pagerduty: https://raw.githubusercontent.com/PagerDuty/api-schema/main/reference/REST/openapiv3.json
- adyen: https://raw.githubusercontent.com/Adyen/adyen-openapi/main/json/CheckoutService-v71.json

## SHA-256 (whole raw source file)

- box: 0f8794edec1caf44761777f791b36388ec997f4220233a1a0166712e0d3b0a06
- pagerduty: b2e80f8b83b170f29702e96a69adf230702b4ec43dddab7e348a2985c707ef35
- adyen: fd59f89f18d134f901d6d42b7aabad1c8afd4e2eb733823ba50944c034f1095a

## Selection rule

box — every 3rd candidate; pagerduty — every 5th candidate; adyen — every
candidate. Index from 0 and select where `index % N === 0`. Candidates
are all path × method (get/post/put/patch/delete) pairs, sorted by path
(string sort) then method (string sort) for determinism.

## Row counts

### Per repo

- box: 99
- pagerduty: 93
- adyen: 28
- total: 220

### Per method

- DELETE: 22
- GET: 94
- PATCH: 3
- POST: 67
- PUT: 34

No one in this project had read or labelled these operations before
extraction. Unlike data/holdout-2026-09-07/, this set includes GET
operations, so it can measure correct lowerings and the usefulness half
of the gate.

## Ground truth (2026-09-07)

Read blind by five Sonnet agents, 44 rows each, round-robin over vendors
and methods. Input columns were repo, path, method, operationId only.
Readers used the CAMARA reading brief adapted for JSON (as the sibling
hold-out set's brief was), with the same three added sentences as
data/holdout-2026-09-07/README.md's ground-truth section, plus one more
sentence: sharing a file with a named person, inviting someone, paging
or notifying a user, and capturing or refunding a payment are
third-party effects. Note also: readers appended rows incrementally
because an earlier attempt was killed by a rate limit before writing
anything.

Class counts as read: total r=104, w=63, x=53. By vendor and method:
- adyen: GET 3 r; POST 6 r / 17 x; DELETE 1 w; PATCH 1 w
- box: GET 47 r; POST 2 r / 3 w / 19 x; PUT 15 w; PATCH 2 w; DELETE 7 w
  / 4 x
- pagerduty: GET 44 r; POST 2 r / 5 w / 13 x; PUT 19 w; DELETE 10 w

Every GET was classed r. 4 rows carry doubt, all classed to the tighter
option.

Orchestrator review: Zero orchestrator rulings. The orchestrator
reviewed the four DELETE x rows (each removes another person's access),
the ten POST r rows (each a lookup with no created resource), and the
doubt rows, and changed nothing.
