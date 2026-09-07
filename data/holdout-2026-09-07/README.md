# Hold-out set — 2026-09-07

Three public OpenAPI 3 JSON files, none of them read or labelled by anyone
on this project before this extraction.

## Sources

- twilio: https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json
- stripe: https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json
- github: https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json

## SHA-256 (whole raw source file)

- twilio: 6b6ffccef14cd55fd6d2fd38c3fde68585e1937eead4c099a92c5efe696b882c
- stripe: f0e0fc8fffbffda45bf5f3df59846443c1d47a3cfcbfae232eedf4743124ebee
- github: 531b05749a9f86c7be01330e6d89d052fd3102ff31df4e0c765d9550b11bbad8

## Selection rule

- twilio: select every op whose method is DELETE or POST.
- stripe: select every op whose method is DELETE.
- github: first collect every op whose method is DELETE or PUT, sorted by
  path (string sort) then method (string sort, so DELETE before PUT
  alphabetically — the secondary order doesn't matter, it only needs to be
  deterministic and reproducible). Assign each a 0-based index in that
  sorted order. Select the op if `index % 4 === 0` (i.e., every 4th one:
  indices 0, 4, 8, ...).

## Row counts

- twilio: 94
- stripe: 32
- github: 81
- total: 207

No one in this project had read or labelled these operations before extraction; they exist to give the lexicon arbiter an untainted score.

## Ground truth (2026-09-07)

Read blind by five Sonnet agents in groups of 41–42 rows, input columns
repo, path, method, operationId only, each agent given the CAMARA reading
brief (docs/logs/m0/reading-brief.md) adapted for JSON specs with three
added sentences: a DELETE that removes the caller's own record with no
one else affected is w; permanence alone does not decide w vs x; ops
with no text are classed from schemas and marked doubt.

Class counts as read: github DELETE 35 w / 14 x, github PUT 26 w / 6 x,
stripe DELETE 28 w / 4 x, twilio DELETE 31 w / 1 x, twilio POST 19 w /
43 x; no r (no GET was selected and every POST creates or acts). 19
rows carry doubt. One orchestrator ruling (the row above).

Consistency checks done by the orchestrator: all three GitHub ops
carrying x-github.triggersNotification were classed x; the CAMARA
precedents (a DELETE ending a live call or revoking access others rely
on is x; own-resource deletion is w) were applied the same way by all
five readers.
