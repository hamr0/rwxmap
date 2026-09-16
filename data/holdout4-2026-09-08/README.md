# Hold-out set 4 — 2026-09-08

Three public OpenAPI 3 JSON files, none of them read or labelled by anyone
on this project before this extraction.

## Sources

- linode: https://raw.githubusercontent.com/linode/linode-api-docs/development/openapi.json
- cloudflare: https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json
- x: https://api.twitter.com/2/openapi.json

## SHA-256 (whole raw source file)

- linode: c057aa23ec74f53c70ceebc95e06dd8951c078e5b2139cd6b85597e44e0608d6
- cloudflare: 76fc4f9abb4e07da1ddeb33d0eb2c41b1c98a4a4441d44e8d7551f77b9233a5a
- x: 8930cd6777c5429c3ffbb0d0c55925cde17bc8cb66dd0a6c8b8ea6b6302802c5

## Selection rule

N per vendor chosen so each vendor yields roughly 60-80 rows:
N = round(candidates / 70), minimum 1. linode — every 6th candidate
(449 candidates); cloudflare — every 49th candidate (3451 candidates); x —
every 3rd candidate (190 candidates). Index from 0 and select where
`index % N === 0`. Candidates are all path × method (get/post/put/patch/
delete) pairs, sorted by path (string sort) then method (string sort) for
determinism. A path item that is $ref-only, or a method entry that is not
an operation object, is skipped and not counted as a candidate.

## Row counts

### Per repo

- linode: 75
- cloudflare: 71
- x: 64
- total: 210

### Per method

- DELETE: 29
- GET: 102
- PATCH: 5
- POST: 51
- PUT: 23

No one in this project had read or labelled these operations before
extraction. Like data/holdout2-2026-09-07/ and data/holdout3-2026-09-08/,
this set includes GET operations, so it can measure correct lowerings and
the usefulness half of the gate.

## Ground truth (2026-09-08)

Read blind by five Sonnet agents, 42 rows each, round-robin over the
operations.csv order (row i to group i mod 5). Input columns were repo,
path, method, operationId only. Readers used the same brief as hold-out 3
(CAMARA reading brief adapted for JSON specs, with the hold-out 1/2/3
added sentences).

Class counts as read: total r=106, w=64, x=40. By vendor and method:
- cloudflare: GET 33 r; POST 2 r / 1 w / 10 x; PUT 1 r / 12 w; PATCH 4 w /
  1 x; DELETE 7 w
- linode: GET 33 r; POST 1 r / 6 w / 17 x; PUT 7 w; DELETE 10 w / 1 x
- x: GET 36 r; POST 5 w / 9 x; PUT 2 w / 1 x; DELETE 10 w / 1 x

Every GET was classed r. 16 rows carry doubt: mostly X operations with a
bare summary and no description; one Cloudflare conflict
(accounts-turnstile-widget-create, whose description says "Lists
challenge widgets" while everything else says create; classed x). No
operation had empty summary and empty description.

No orchestrator rulings; ground-truth.csv equals ground-truth-as-read.csv.
This set is the clean exam for M1-C11 after Rule A (D35): scored once,
never used to choose a rule or a word.
