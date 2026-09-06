# rwxmap

Classifies each operation in an OpenAPI document as `r` (read), `w` (write),
or `x` (execute, the strictest), with a confidence, from two signals: the HTTP
method (RFC 9110 safe/idempotent semantics) and the verb in the path or
operationId, looked up in a verb library. When the signals disagree or the verb
is unknown, the tighter class wins. Output is a map that agents, guards, and
harnesses read before a call is made.

Status: PRD in progress. Nothing built. See `docs/product/prd.md`.
