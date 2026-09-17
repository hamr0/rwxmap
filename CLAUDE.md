# CLAUDE.md — agent doctrine for rwxmap

Repo-only; for whoever is *building* this. Adopters read `README.md` and
`docs/product/prd.md`.

## The one invariant

Output classes are `r < w < x`. When the tool does not know, the answer
is the tighter class; it never loosens without evidence. Defaulting to
`r` is fail-open and wrong. The two error directions —
under-classification (wrong loosening: a security cost, it fails the
go/no-go gate) and over-classification (wrong tightening: a usability
cost, reported) — are always counted and reported separately, never
collapsed into one accuracy number.

## What this is not

Not normative in any Internet-Draft. Not a third standards track. Not a
mandated conformance harness. No LLM/model tier, no guess path. Signing
is the Resource Owner's act, not this tool's.

## Test bed

`data/provider-corpus-2026-09-16/` is the only measurement set — 4171
operations across 15 complete official provider APIs. Every number that
counts is scored against it; experiments run against files in this tree,
never against `justabit`. The known limit stays stated: it is a tuning
set, not a clean exam (D24). Steps 1 and 2 were tuned on the rows they
are scored on and no clean exam exists for the current flow, so every
figure reads better than an unseen vendor would.

`data/camara-2026-09-01/` is the M0 test bed. It is historical: kept for
the record, not scored against, and not a gate for any current work. Its
limits belong with it — M0's GET half was judged by template, not read
operation by operation, and its 57-of-138 read-named-POST figure was a
reader's judgement, not a rule output. M0's two negative controls —
ClickToDial `DELETE /calls/{callId}` `terminateCall` and WebRTC
`PUT /sessions/{mediaSessionId}/status` `updateSessionStatus` — are
retired with it. They came out `x` under M0's arbiter shape; the current
word-list flow puts both at `w`, and that is measured and accepted, not
an open defect to chase.

## How work runs here

Build the PRD's module ladder one module at a time; each proves it works
on its own before the next starts. M0 is many numbered experiments, each
with its own readout, before the winning arbiter shape is picked.
Checkpoint after every module — the user validates before the next one
starts; never chain modules together on your own judgement. The main
session orchestrates; every file edit goes through a delegated agent
carrying an escalate-first brief, and the orchestrator reads every diff.
Verify by exit code and by re-running — an agent's "done" is not
evidence. The spec interview is prose, never choice boxes. Every
experiment is appended to `docs/logs/learnings.md` before the next one
starts, with its numbers and what it taught; a result that changes a
feature or a decision goes into `docs/product/prd.md`, never only into
the learnings file.

## Dev Rules

**Spec first.** Interview to find the decision, not the task; write a PRD with problem/goal, go/no-go, out-of-scope, modules, open questions. POCs refine it.

**POC first, one module at a time.** Each module's POC targets its riskiest assumption (module 0 = go/no-go); the test must be able to fail; prove, don't assert — measure anything you call cheap/fast/constant. No fitting to pass. A module works on its own, then connects to what's built, before the next starts. Never ship the POC.

**Dependency hierarchy — follow strictly:** vanilla language → standard library → external (only when stdlib can't do it in <100 lines). External deps must be maintained, lightweight, and widely adopted. Exception: always use vetted libraries for security-critical code (crypto, auth, sanitization).

**Lightweight over complex.** Fewer moving parts, fewer deps, less config. Express over NestJS, Flask over Django, unless the project genuinely needs the framework. Simple > clever. Readable > elegant.

**Open-source only.** No vendor lock-in. Every line of code earns its place — if you can't say what breaks when it's deleted, delete it. No speculative code, no premature abstractions.

**One writer per piece of state.** One function assigns each field; everything else calls it. Grep who writes it before you write it — and if a write can land from a callback, thread, or lifecycle, the reader must tell stale from fresh.

**Surgical changes only.** Touch what the task requires. Dead code, nits, bugs you pass: if it's inside or affects the code you're already changing and the fix changes no behavior, fix it and say so — otherwise report it and say what it costs to leave it. A problem you don't fix goes in the report, never in a comment.

**Responsive web UI is mandatory.** Any web UI must work on mobile by default — fluid layouts, viewport meta, breakpoints, no horizontal scroll. Verify in DevTools device emulation before claiming a UI task is done. POCs exempt; real projects are not.

For full development and testing standards, see `.claude/remember/AGENT_RULES.md`.

<!-- MEMORY:START -->
@.claude/remember/MEMORY.md
<!-- MEMORY:END -->

<!-- AGENT_RULES:START -->
**One writer per piece of state.** One function assigns each field; everything else
calls it. Grep who writes it before you write it — and if a write can land from a
callback, thread, or lifecycle, the reader must tell stale from fresh.

**Surgical changes only.** Touch what the task requires. Dead code, nits, bugs you
pass: if it's inside or affects the code you're already changing and the fix changes
no behavior, fix it and say so — otherwise report it and say what it costs to leave
it. A problem you don't fix goes in the report, never in a comment.

Standards guide (read when designing/building something new, not hot context):
.claude/remember/AGENT_RULES.md
<!-- AGENT_RULES:END -->
