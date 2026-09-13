```
          ####  #   # #   # #   #  ###  ####
          #   # #   #  # #  ## ## #   # #   #
          ####  # # #   #   # # # ##### ####
          #  #  ## ##  # #  #   # #   # #
          #   # #   # #   # #   # #   # #

              r ─ w ─ x  ·  what a call does, before it is made
```

**[WIP] Maps every OpenAPI operation to r / w / x, so an agent knows what a call does before it is made.**

Status: [WIP] — a POC in progress, not shipped. See `docs/product/prd.md`.

rwxmap reads an OpenAPI document and classifies each operation as a read,
a write, or an execute — the strictest, most consequential class — so
agents, guards, and harnesses have an answer for every call, not just the
ones a human got around to labeling.

## What it does

Reads an OpenAPI document and maps each operation to `r` (read), `w`
(write), or `x` (execute): every operation starts at its HTTP method's
floor (GET/HEAD/OPTIONS -> `r`, POST -> `x`, PUT/DELETE/PATCH -> `w`),
then a verb rule can move it (a read verb lowers a POST to `r`; a live
verb raises a PUT/DELETE/PATCH to `x`), then a yours-noun layer looks
only at PUT/DELETE/PATCH rows still at the `w` floor and raises such a
row to `x` unless every noun in its operation name is on the tool's
allowlist of "yours" words. On doubt the
answer is the tighter class; floor rows (no word rule fired) are
flagged for review rather than trusted. rwxmap emits no confidence
score (D44). MCP tool-annotation hints are not built yet (M3). Zero
dependencies.

## Why

POST hides reads. On the CAMARA catalogue, 57 of 138 POST operations are
read-shaped — retrieve, check, verify — yet class as `x` under a
method-only rule; an agent restricted to reads cannot call them, and a
guard cannot tell them from a real trigger. rwxmap draws the map so
agents, guards, harnesses, and the human authoring a signed declared menu
know what each call does. It is a discovery tool, not a proof.

## The safety spine

Classes are `r < w < x`. When the tool does not know, the answer is the
tighter class — never a loosening without evidence. The two error
directions are reported separately, never as one accuracy number; wrong
loosening is the one that fails the gate.

## Where it sits

The author's own tool, first. A supporting, non-load-bearing
proof-of-concept for the `actionClass` axis and declared menu in the
justabit Internet-Draft
([github.com/hamr0/justabit](https://github.com/hamr0/justabit)). A
stopgap map when an API owner has not published a declared menu. Not
normative anywhere; not a standards track; not a conformance harness.

## Test bed

5465 rows across 332 vendors — the CAMARA catalogue plus a growing set
of vendor APIs and four blind-drawn exams — labelled by blind LLM
reading, scored leave-one-vendor-out (LOVO): every vendor's rows are
scored by rules built from every other vendor's rows, never their own.
This is a tuning corpus, not exam-checked; exams 1-4 are burned —
exams 1-3 were used to tune, and exam 4's truth drifted because its
labelling brief was lost — so none is a clean exam (see
`docs/logs/learnings.md`, M1-C25).

Current per-step numbers (5465 rows, LOVO):

| step | error | count |
|---|---|---|
| step 1 (r) | r dressed as x or w | 49 over-tight, 0 leaks |
| step 2 (w) | w dressed as x (false alarm) | 803 false alarms / 211 leaks — standalone lens, parked |
| step 3 (x) | x dressed as w (leak) | 37 (4.0% of truth-x) — frozen |

A leak is a wrong loosening — a robot takes an action it should not
have. A false alarm (over-tighten) is a usability cost — a human
glances at a row that was fine. The two are never merged into one
accuracy number: they cost different things and a reader needs both.
Full detail: `docs/product/prd.md`, "The three steps".

Two negative controls must come out `x`: ClickToDial `DELETE
/calls/{callId}` `terminateCall`, and WebRTC `PUT
/sessions/{mediaSessionId}/status` `updateSessionStatus`. Both come out
`x` under the current shape.

**How to re-run:** `node poc/m1/run/measure.mjs` (gate + scores),
`node --test poc/m1/run/ledger.test.mjs` (per-step pins),
`node poc/m1/run/proof.mjs` (row-level CSVs in `run-proof/`).

**What these numbers do not say:**

- The truth is itself model-generated — blind LLM readers on a fixed
  brief — so the scores measure agreement with that reading process,
  not with a human expert or with any standard.
- This is a tuning-corpus number under LOVO, not a clean-exam number.
  Exams 1-4 are burned — exams 1-3 were used to tune, and exam 4's
  truth drifted because its labelling brief was lost (`docs/logs/learnings.md`, M1-C25).
- CAMARA's GET half was judged by template, not operation by
  operation.
- The 57-of-138 read-named-POST figure (`docs/product/prd.md`) is a
  reader's judgement, not a rule output.
- This is a proof-of-concept, not a shipped tool.

## The bare ecosystem

Local-first, composable agent infrastructure. Same API patterns throughout —
mix and match, each module works standalone.

**Core** — the brain, the gate, the memory.

- **[bareagent](https://npmjs.com/package/bare-agent)** — the think→act→observe loop. *Goal in → coordinated actions out.* Replaces LangChain, CrewAI, AutoGen.
- **[bareguard](https://npmjs.com/package/bareguard)** — the single gate every action passes through. *Action in → allow / deny / ask-a-human out.* Replaces hand-rolled allowlists and scattered policy code.
- **[litectx](https://npmjs.com/package/litectx)** — tree-sitter code + memory graph with activation decay, plus lightweight context engineering (write · select · compress · isolate). *Query in → ranked context out.*

**Optional reach** — give the agent hands.

- **[barebrowse](https://npmjs.com/package/barebrowse)** — a real browser for agents. *URL in → pruned snapshot out.* Replaces Playwright, Selenium, Puppeteer.
- **[baremobile](https://npmjs.com/package/baremobile)** — Android + iOS device control. *Screen in → pruned snapshot out.* Replaces Appium, Espresso, XCUITest.
- **[beeperbox](https://github.com/hamr0/beeperbox)** — 50+ messaging networks via one MCP server (headless Beeper Desktop in Docker). *Chat in → unified message stream out.* Replaces Twilio, per-platform bot APIs.

**What you can build:**

- **Headless automation** — scrape sites, fill forms, extract data, monitor pages on a schedule
- **QA & testing** — automated test suites for web and Android apps without heavyweight frameworks
- **Personal AI assistants** — chatbots that browse the web or control your phone on your behalf
- **Remote device control** — manage Android devices over WiFi, including on-device via Termux
- **Agentic workflows** — multi-step tasks where an AI plans, browses, and acts across web and mobile

**Why this exists:** Most automation stacks ship 200MB of opinions before you write a line of code. These don't. Install, import, go.

## License

Apache License, Version 2.0 — LICENSE file to follow.
