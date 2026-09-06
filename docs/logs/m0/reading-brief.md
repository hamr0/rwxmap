Brief given verbatim to the seven reading agents on 2026-09-06 (groups of 18-50 operations, whole repositories per group, input columns repo,file,path,method,operationId only, no prior labels). Classes were then ruled by the orchestrator; see ground-truth.csv vs ground-truth-as-read.csv.

# Ground-truth reading brief (M0, rwxmap)

You are producing ground truth for a classifier. Read carefully; do not skim. Do not use any prior label or heuristic based on the HTTP method or the operation's name: the point is to record what the spec text says the operation DOES.

## Input
A CSV at INPUT (columns repo,file,path,method,operationId). For each row, open the spec at /home/hamr/PycharmProjects/rwxmap/data/camara-2026-09-01/specs/<repo>/<file> and locate that operation under `paths:` -> path -> method. Read its `summary`, `description`, `requestBody` (schema, required fields), `responses` (status codes, response schema), `callbacks`, and any `x-` extensions, plus the `info.description` of the document if the operation's own text is thin. Read the referenced schemas when they decide the answer (e.g. whether a POST body carries a query or a state change).

## Classes (from the Internet-Draft, anchor action-class-values)
- r: a read-only operation, one that does not modify state.
- w: an idempotent write: modifies state, but repeating it has the same effect as doing it once (create-or-replace, set status, delete a resource).
- x: a consequential, non-idempotent action: repeating it is not guaranteed to have the same effect as doing it once. This includes: sending a message or code, moving money, triggering a live network or device action, creating a new resource on every call (a new session, subscription, booking, reservation), or any effect on a third party.

Two cross-checks you must record separately, because the class definition rests on both:
- state_effect: none | idempotent | non-idempotent. What the operation does to server-side or network-side state.
- external_effect: none | notifies (creates a subscription/webhook or sends a notification) | third-party (reaches a person, a device, a call, money, or a network path that others feel).

Class rule: state_effect none and external_effect none -> r. state_effect idempotent and external_effect none -> w. Anything non-idempotent, or any external_effect other than none -> x. If the spec is silent or contradictory, record gt_class as the tighter option AND write `unclear` in the doubt column with what is missing. Doubt is data; never smooth it over.

Note: a POST whose body is only a query (device identifier, phone number, filter) and whose response is a value with no created resource is state_effect none -> r, even though it is POST. A DELETE that terminates a live call or session someone else is on is external_effect third-party -> x. A GET is r unless the spec text says otherwise; if a GET says it changes anything, flag it loudly in reason and set the class the text supports.

## Output
Write a CSV at OUTPUT with header exactly:
repo,file,path,method,operationId,gt_class,state_effect,external_effect,spec_field,doubt,reason
- spec_field: the field your reason rests on, e.g. `description`, `requestBody.schema.Device`, `responses.201`, `callbacks`, `summary`, `info.description`. Name the most specific one.
- doubt: empty, or `unclear` (spec insufficient) or `conflict` (fields disagree), followed by a short note.
- reason: ONE sentence, specific to this operation, quoting or paraphrasing the spec text that decides it. No template. No two rows may share the same reason text.
Quote fields containing commas. One row per input row, same order, same count. Do not add or drop rows.

Do not edit anything under the repo. Write only OUTPUT. When done, report the row count, the class counts, the rows marked doubt, and any operation you could not find in its spec file (report those with an empty gt_class rather than guessing).
