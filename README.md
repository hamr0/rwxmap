```
          ####  #   # #   # #   #  ###  ####
          #   # #   #  # #  ## ## #   # #   #
          ####  # # #   #   # # # ##### ####
          #  #  ## ##  # #  #   # #   # #
          #   # #   # #   # #   # #   # #

              r ─ w ─ x  ·  what a call does, before it is made
```

**[WIP] Maps every OpenAPI operation to r / w / x, so an agent knows what a call does before it is made.**

## The world this is for

Automated traffic is already a large share of the web. Imperva/Thales put it at
53% of all web traffic in 2025 — 40% bad bots, 13% benign automation
([report](https://www.imperva.com/blog/bad-bot-report-2026-bots-agentic-age/),
[summary](https://www.helpnetsecurity.com/2026/04/30/thales-ai-driven-bot-traffic-rise-report/)).
Cloudflare's own measurement is lower, about 35% as of June 2026
([source](https://technologychecker.io/blog/web-traffic-statistics)).
The two numbers are far apart, so treat the exact share with care.
Either way, automation is a large and growing part of the traffic, not
a fringe of it.

That share is going to keep including more agents acting for a real
person: buying tickets, ordering groceries, filing forms. Today the
human is often still in the loop for one reason — getting past
anti-bot checks. That is a poor place for a human to be: not deciding
anything, just proving they exist.

Agents reach real systems through APIs and MCP servers, and that is a
good thing. Much of the industry — WebMCP and others — is working hard
on the *exposure* side: making APIs usable by agents in the first
place.

## Where rwxmap fits

This project works the other side of that: safety, not exposure. It
pairs with [RFC 9421](https://www.rfc-editor.org/rfc/rfc9421) (HTTP
Message Signatures) and with the author's Internet-Draft, "An
Attenuated Delegation Profile for Automated Agents"
([draft-hamr-oauth-agent-delegation-01](https://datatracker.ietf.org/doc/draft-hamr-oauth-agent-delegation/),
2 September 2026, an individual submission, not a standard), which puts
human authorization back into agentic flows — a person in the loop, not
just a click.

rwxmap's part in that: label every API operation r / w / x at the
point an agent discovers it, so an external arbiter can watch what an
agent is about to do, and so the same label can be handed to the agent
itself as an MCP hint.

- **r** — read. Nothing changes.
- **w** — write. Changes your own stuff.
- **x** — execute. Reaches beyond you (a third party), or isn't
  repeatable: running it twice is not the same as running it once.

## Where it is today

Measured on a labelled corpus of 5465 operations across 332 vendors.
This is a tuning number, not a shipped one — see
`docs/product/prd.md` and `docs/logs/learnings.md` for the full
picture.

- Gets the class right on about 78% of operations.
- Flags 36% as "I don't know" rather than guessing. Inside that pile,
  91% are in fact the safe answer (`w`), 7.9% should have been marked
  stricter, 1.1% too strict.
- Under 1% of all operations (0.9%) come out too loose with no flag at
  all — the number that matters for safety, and the one being worked
  on now.
- On a fresh exam of unseen rows, scored once: 70.2% exact, 3.2% too
  loose.

On doubt it picks the stricter class. It never loosens without
evidence.

## Use it for

- **Agentic automation** — give an agent, or the arbiter watching it,
  an answer for every call before the call is made.
- **Labelling your own API** — it does about three quarters of the job
  in seconds with safe defaults; you correct the rest by hand.
- **MCP hints** — feed the class straight to the agents already
  calling your API.

## Status

[WIP] — a proof of concept, not shipped. The classifier core is frozen
while the remaining work is measured. Design and numbers live in
`docs/product/prd.md`; every experiment is logged in
`docs/logs/learnings.md`.

## License

Apache License, Version 2.0 — LICENSE file to follow.
