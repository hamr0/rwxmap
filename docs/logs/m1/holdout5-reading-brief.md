Brief to give to the reading agents for hold-out set 5 (slack, notion,
amazon SP-API), 2026-09-08. Starts from docs/logs/m0/reading-brief.md
verbatim, with every accumulated adaptation from hold-out sets 1-4 carried
across in one place (see data/holdout-2026-09-07/README.md,
data/holdout2-2026-09-07/README.md, data/holdout3-2026-09-08/README.md
ground-truth sections), plus this set's own Input adaptation for JSON
specs, two of which are Swagger 2.0. Input columns for readers: repo,
path, method, operationId only, no prior labels.

# Ground-truth reading brief (M1, hold-out set 5, rwxmap)

You are producing ground truth for a classifier. Read carefully; do not
skim. Do not use any prior label or heuristic based on the HTTP method or
the operation's name: the point is to record what the spec text says the
operation DOES.

## Input
A CSV at INPUT (columns repo,path,method,operationId). For each row, open
the spec at data/holdout5-2026-09-08/specs/<repo>/<file> and locate that
operation under `paths:` -> path -> method. The specs/ folder is no
longer committed (removed from this branch's git history, 2026-09-16 —
see data/holdout5-2026-09-08/README.md); re-download the source specs
from the vendor repositories named there before reading against this
brief.

This set has three vendors, two of them Swagger 2.0 rather than OpenAPI 3:
- slack: `specs/slack/slack_web_openapi_v2.json` — **Swagger 2.0**.
- amazon: `specs/amazon/models/<section>/<file>.json` — **Swagger 2.0**,
  one file per API section (67 files); use the file named in the row's
  source_url/path context, under the original repo-relative directory
  layout.
- notion: `specs/notion/notion-openapi.json` — OpenAPI 3.1.

Swagger 2.0 field differences you must account for:
- There is no `requestBody`. The request body, when present, lives among
  the operation's `parameters` as an entry with `in: body`; that entry's
  `schema` is what to read for what the body carries.
- Schemas are not under `components/schemas` — they are under the
  document's top-level `definitions`, referenced as `#/definitions/Name`.
- There is no `callbacks` keyword in Swagger 2.0 at all. Its absence in a
  slack or amazon operation means nothing about the operation — do not
  read a missing `callbacks` field as evidence of anything, and do not
  flag it as thin spec text on that basis alone.

For all three vendors, read the operation's `summary`, `description`,
request body (via `requestBody`/`components` for notion, via the `in: body`
parameter/`definitions` for slack and amazon), `responses` (status codes,
response schema), `callbacks` (notion only — see above), and any `x-`
extensions, plus the document's `info.description` if the operation's own
text is thin. Read the referenced schemas when they decide the answer
(e.g. whether a POST body carries a query or a state change).

## Classes (from the Internet-Draft, anchor action-class-values)
- r: a read-only operation, one that does not modify state.
- w: an idempotent write: modifies state, but repeating it has the same
  effect as doing it once (create-or-replace, set status, delete a
  resource).
- x: a consequential, non-idempotent action: repeating it is not
  guaranteed to have the same effect as doing it once. This includes:
  sending a message or code, moving money, triggering a live network or
  device action, creating a new resource on every call (a new session,
  subscription, booking, reservation), or any effect on a third party.

Two cross-checks you must record separately, because the class definition
rests on both:
- state_effect: none | idempotent | non-idempotent. What the operation
  does to server-side or network-side state.
- external_effect: none | notifies (creates a subscription/webhook or
  sends a notification) | third-party (reaches a person, a device, a call,
  money, or a network path that others feel).

Class rule: state_effect none and external_effect none -> r. state_effect
idempotent and external_effect none -> w. Anything non-idempotent, or any
external_effect other than none -> x. If the spec is silent or
contradictory, record gt_class as the tighter option AND write `unclear`
in the doubt column with what is missing. Doubt is data; never smooth it
over.

Note: a POST whose body is only a query (device identifier, phone number,
filter) and whose response is a value with no created resource is
state_effect none -> r, even though it is POST. A DELETE that terminates a
live call or session someone else is on is external_effect third-party ->
x. A GET is r unless the spec text says otherwise; if a GET says it
changes anything, flag it loudly in reason and set the class the text
supports.

Added sentences carried forward from hold-out sets 1-4, in the order they
accumulated (apply all of them together):

From hold-out set 1 (data/holdout-2026-09-07/README.md):
- A DELETE that removes the caller's own record with no one else affected
  is w.
- Permanence alone does not decide w vs x.
- Ops with no text are classed from schemas and marked doubt.

From hold-out set 2 (data/holdout2-2026-09-07/README.md):
- Sharing a file with a named person, inviting someone, paging or
  notifying a user, and capturing or refunding a payment are third-party
  effects.

From hold-out set 3 (data/holdout3-2026-09-08/README.md):
- A DELETE or PUT that removes or changes another person's access,
  membership, role, or shared resource is third-party -> x.
- Sending a message, inviting someone, kicking or banning a member,
  notifying a user, triggering a deployment or a webhook delivery, and
  capturing or refunding a payment are third-party.

(Hold-out set 4 added no new sentences beyond these; it reused hold-out
3's brief unchanged.)

## Output
Write a CSV at OUTPUT with header exactly:
repo,file,path,method,operationId,gt_class,state_effect,external_effect,spec_field,doubt,reason
- spec_field: the field your reason rests on, e.g. `description`,
  `parameters[in=body].schema.Device` (Swagger 2.0) or
  `requestBody.schema.Device` (OpenAPI 3), `responses.201`, `callbacks`
  (notion only), `summary`, `info.description`. Name the most specific
  one.
- doubt: empty, or `unclear` (spec insufficient) or `conflict` (fields
  disagree), followed by a short note.
- reason: ONE sentence, specific to this operation, quoting or
  paraphrasing the spec text that decides it. No template. No two rows
  may share the same reason text.
Quote fields containing commas. One row per input row, same order, same
count. Do not add or drop rows.

Do not edit anything under the repo. Write only OUTPUT. When done, report
the row count, the class counts, the rows marked doubt, and any operation
you could not find in its spec file (report those with an empty gt_class
rather than guessing).
