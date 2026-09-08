```
          ####  #   # #   # #   #  ###  ####
          #   # #   #  # #  ## ## #   # #   #
          ####  # # #   #   # # # ##### ####
          #  #  ## ##  # #  #   # #   # #
          #   # #   # #   # #   # #   # #

              r ─ w ─ x  ·  what a call does, before it is made
```

**[WIP] Maps every OpenAPI operation to r / w / x, with a confidence, so an agent knows what a call does before it is made.**

Status: [WIP] — PRD stage, nothing built yet. See `docs/product/prd.md`.

rwxmap reads an OpenAPI document and classifies each operation as a read,
a write, or an execute — the strictest, most consequential class — so
agents, guards, and harnesses have an answer for every call, not just the
ones a human got around to labeling.

## What it does

Reads an OpenAPI document and maps each operation to `r` (read), `w`
(write), or `x` (execute), with a confidence, from two mechanical
signals — HTTP method per RFC 9110 safe/idempotent semantics, and the
verb in the path or operationId, looked up in a verb library — and one
arbiter: agree → that class, high confidence; disagree → the tighter
class, low confidence; verb unknown → the method default. Emits MCP
tool-annotation hints (`readOnlyHint`, `destructiveHint`,
`idempotentHint`, `openWorldHint`) so any MCP client can consume the map
unchanged. Zero dependencies.

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

1155 operations labelled by blind LLM reading — five Sonnet agents per
hold-out, each working from a fixed reading brief, no human expert
labels — the CAMARA catalogue (292 ops, 60 repositories) plus 12 vendor
APIs — in five SHA-pinned sets under `data/`, each with a deterministic
selection rule.

The sets fall into three buckets:

- **tuned** (camara, hold-out 1: GitHub, Stripe, Twilio; hold-out 3:
  Discord, Sentry, Vercel) — the word lists were fitted on these rows;
  numbers here are upper bounds, not evidence of transfer.
- **reference** (hold-out 2: Adyen, Box, PagerDuty) — never used to
  pick a rule, but scored repeatedly, so not blind either.
- **clean-exam** (hold-out 4: Linode, Cloudflare, X) — scored once,
  never fitted on. The headline below is quoted from this set only.

Clean-exam result (hold-out 4, n=210):

| classifier | exact | leaks | over-tight |
|---|---|---|---|
| c11 | 182 (86.7%) | 0 (0.0%) | 28 (13.3%) |
| method-prior | 187 (89.0%) | 3 (1.4%) | 20 (9.5%) |
| get-else-x | 142 (67.6%) | 0 (0.0%) | 68 (32.4%) |

A leak is a wrong loosening — a robot takes an action it should not
have. An over-tighten is a false flag — a human glances at a row that
was fine. The two are never merged into one accuracy number: they cost
different things and a reader needs both.

Two negative controls must come out `x`: ClickToDial `DELETE
/calls/{callId}` `terminateCall`, and WebRTC `PUT
/sessions/{mediaSessionId}/status` `updateSessionStatus`. c11 gets both
right; the plain method prior gets both wrong (`w`, should be `x`).

**On the clean exam, c11 is not more accurate than the plain method
prior.** What it buys over the method prior is leaks going to zero
(from 3) and both negative controls correct, at a cost of 2.3 points
of exactness and 3.8 points of extra review.

**How to re-run:** `node poc/m1/arbiter/run-benchmark.mjs`

**What these numbers do not say:**

- The truth is itself model-generated — blind LLM readers on a fixed
  brief — so the scores measure agreement with that reading process,
  not with a human expert or with any standard.
- No row has been read twice by an independent reader, so the truth's
  own noise is unmeasured and none of these numbers carries an error
  bar.
- CAMARA's GET half was judged by template, not operation by
  operation.
- The 57-of-138 read-named-POST figure (above) is a reader's
  judgement, not a rule output.
- Tuned-set numbers are upper bounds, not transfer.
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
