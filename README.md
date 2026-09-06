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

292 operations across 60 CAMARA repositories, SHA-pinned, under
`data/camara-2026-09-01/`.

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
