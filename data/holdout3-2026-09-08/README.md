# Hold-out set 3 — 2026-09-08

Three public OpenAPI 3 JSON files, none of them read or labelled by anyone
on this project before this extraction.

## Sources

- discord: https://raw.githubusercontent.com/discord/discord-api-spec/main/specs/openapi.json
- sentry: https://raw.githubusercontent.com/getsentry/sentry-api-schema/main/openapi-derefed.json
- vercel: https://openapi.vercel.sh/

## SHA-256 (whole raw source file)

- discord: e39f35fbbca3e76ab90aef015c5a756529853b13e018f0dacae8ed3f28ef7310
- sentry: 9e51ca9fc2e160b2c6b1d4a8516b7e367081365b2656c8c3c731ad1cae7c7fe9
- vercel: 4206077957641fa5eb03cbbc2b0fb05116aca4a1363273838def42a6b9fb59fe

## Selection rule

N per vendor chosen so each vendor yields roughly 60-80 rows:
N = round(candidates / 70), minimum 1. discord — every 3rd candidate
(242 candidates); sentry — every 3rd candidate (227 candidates); vercel —
every 6th candidate (413 candidates). Index from 0 and select where
`index % N === 0`. Candidates are all path × method (get/post/put/patch/
delete) pairs, sorted by path (string sort) then method (string sort) for
determinism. A path item that is $ref-only, or a method entry that is not
an operation object, is skipped and not counted as a candidate.

## Row counts

### Per repo

- discord: 81
- sentry: 76
- vercel: 69
- total: 226

### Per method

- DELETE: 37
- GET: 102
- PATCH: 19
- POST: 48
- PUT: 20

No one in this project had read or labelled these operations before
extraction. Like data/holdout2-2026-09-07/, this set includes GET
operations, so it can measure correct lowerings and the usefulness half
of the gate.

## Ground truth (2026-09-08)

Read blind by five Sonnet agents, 45-46 rows each, round-robin over the
operations.csv order (row i to group i mod 5). Input columns were repo,
path, method, operationId only. Readers used the CAMARA reading brief
(docs/logs/m0/reading-brief.md) adapted for JSON specs, with the hold-out
1 and 2 added sentences, plus one more: a DELETE or PUT that removes or
changes another person's access, membership, role, or shared resource is
third-party -> x; sending a message, inviting someone, kicking or
banning a member, notifying a user, triggering a deployment or a webhook
delivery, and capturing or refunding a payment are third-party. Ops with
no text are classed from schemas and marked doubt.

Class counts as read: total r=104, w=54, x=68. By vendor and method:
- discord: GET 38 r; POST 2 w / 11 x; PUT 3 w / 5 x; PATCH 4 w / 5 x;
  DELETE 3 w / 10 x
- sentry: GET 42 r; POST 3 w / 8 x; PUT 8 w / 2 x; DELETE 9 w / 4 x
- vercel: GET 22 r; POST 2 r / 3 w / 19 x; PUT 2 w; PATCH 7 w / 3 x;
  DELETE 10 w / 1 x

Every GET was classed r. 46 rows carry doubt, 45 of them Discord
operations with no summary or description in the spec (Discord's
OpenAPI omits prose on most operations), classed from schema and path
alone and tightened; one Vercel conflict (updateSandbox, resume=true
creates a new instance).

Readers noted that Discord guild resources (channels, messages, pins,
emojis, stickers, bans, permission overwrites) were read as shared
resources other members feel, hence x on delete/replace; this is a
broader line than hold-out 1's readers drew for GitHub organization
settings (w). Recorded as-is; no orchestrator rulings.
ground-truth.csv equals ground-truth-as-read.csv.
