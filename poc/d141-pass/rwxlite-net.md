# D141 candidate net (from rwxlite, 2026-11-19)

rwxmap's export-v4-d141 relabel uses this same net so both halves match (PRD Next item 1). Received from the rwxlite session; regexes are Python re, search, and are also valid JS RegExp as written.

```
text = lowercase(method + " " + path + " " + operationId + " " + summary + " " + description[:600]), empty fields as "".
A row is a candidate if any family regex matches (search, not anchored unless shown):
(a) (?:log ?in\b|sign ?in|signin|sign-in|logon|refresh.?token|access.?token|oauth/token|/auth/token|/token\b|session.?token)
(b) (?:verif(?:y|ication).{0,30}(?:email|code|otp|token|phone|sms|account)|\botp\b|2fa|totp|\bmfa\b|one.?time.?(?:code|password)|is.?registered|email.{0,20}exist|exist.{0,20}email|(?:validate|check).?token|token.?(?:valid|check))
(c) ^(?:put|patch|post) \S*(?:/groups?\b|usergroup|user.?group)
(d) (?:callback.?url|/callback|webhook|endpoint.?(?:url|config|setting)|llm.?endpoint|device.?token|push.?token|\bfcm\b|\bapns\b|\.p8\b|signing.?key)
(e) ^(?:post|put|patch) .*(?:(?:remove|delete|kick|revoke|unassign).{0,40}(?:member|user|participant|personnel|collaborator|seat)|(?:member|participant|collaborator)s?.{0,30}(?:remove|delete|revoke))
Methods: all, except (c) and (e) are restricted to POST/PUT/PATCH by their anchors.
rwxlite counts on its 199,600 round 15 rows: 9,740 candidates; a 5,519, b 1,355, c 424, d 2,722, e 239 (overlaps allowed).
Labelling: Sonnet relabels every candidate blind with BRIEF-v4 + the D141 addendum; family tags are not shown to the labeller.
```

Addendum: data/relabel-v4-2026-11-05/BRIEF-v4-addendum-D141.md (commit 54355e1).
