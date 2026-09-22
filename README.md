```
██████╗ ██╗    ██╗██╗  ██╗███╗   ███╗ █████╗ ██████╗ 
██╔══██╗██║    ██║╚██╗██╔╝████╗ ████║██╔══██╗██╔══██╗
██████╔╝██║ █╗ ██║ ╚███╔╝ ██╔████╔██║███████║██████╔╝
██╔══██╗██║███╗██║ ██╔██╗ ██║╚██╔╝██║██╔══██║██╔═══╝ 
██║  ██║╚███╔███╔╝██╔╝ ██╗██║ ╚═╝ ██║██║  ██║██║     
╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     

   r ─ w ─ x   what a call does, before it is made
```

**[WIP] Maps every OpenAPI operation to r / w / x, so an agent knows what a call does before it is made.**

## The world this is for

Automated traffic is already a large share of the web. Imperva/Thales
put it at 53% of all web traffic in 2025 — 40% bad bots, 13% benign
automation. Cloudflare's own measurement is lower, about 35% (both
figures as of September 2026). The two numbers are far apart, so treat
the exact share with care. Either way, automation is a large and
growing part of the traffic, not a fringe of it.

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

Measured on 4171 operations from 15 complete official provider APIs.

- Right on 3930 of those 4171 operations (94.2%).
- Too loose on 55 of 4171 (1.3%). This is the direction that matters
  for safety: it is the tool saying a call is tamer than it is.
- Too strict on 186 of 4171 (4.5%) — annoying, never dangerous.

Every answer comes from one of two places. **Known** means a word in the
operation's name matched a word list — the tool read something. **Unknown**
means nothing matched and the HTTP method alone decided it.

| Step | Evidence | Rows | Right | Right % | Too loose | Loose % | Too strict | Strict % |
|---|---|---|---|---|---|---|---|---|
| **1 — r** | known | 92 | 91 | 98.9% | 1 | 1.1% | 0 | 0.0% |
| **1 — r** | unknown | 1960 | 1958 | 99.9% | 2 | 0.1% | 0 | 0.0% |
| **1 — r** | **total** | **2052** | **2049** | **99.9%** | **3** | **0.1%** | **0** | **0.0%** |
| **2 — w** | known | 232 | 227 | 97.8% | 5 | 2.2% | 0 | 0.0% |
| **2 — w** | unknown | 883 | 836 | 94.7% | 47 | 5.3% | 0 | 0.0% |
| **2 — w** | **total** | **1115** | **1063** | **95.3%** | **52** | **4.7%** | **0** | **0.0%** |
| **3 — x** | known | 19 | 19 | 100.0% | 0 | 0.0% | 0 | 0.0% |
| **3 — x** | unknown | 985 | 799 | 81.1% | 0 | 0.0% | 186 | 18.9% |
| **3 — x** | **total** | **1004** | **818** | **81.5%** | **0** | **0.0%** | **186** | **18.5%** |
| all | known | 343 | 337 | 98.3% | 6 | 1.7% | 0 | 0.0% |
| all | unknown | 3828 | 3593 | 93.9% | 49 | 1.3% | 186 | 4.9% |
| **all** | **total** | **4171** | **3930** | **94.2%** | **55** | **1.3%** | **186** | **4.5%** |

Four things that table says, and they are the whole shape of the tool:

- **Words are rare, and nearly always right.** 343 of 4171 operations
  (8%) match a word; those are right 337 of 343 times (98.3%). The other
  92% are decided by the HTTP method alone.
- **Almost every dangerous mistake is in one cell.** 47 of the 55
  too-loose answers are step 2's unknown row — a PUT, DELETE or PATCH
  with no word to read, called `w` where the truth was `x`. No other
  cell leaks above 2.2%.
- **Every too-strict answer is in one other cell.** All 186 are step 3's
  unknown row: a POST nothing spoke for, left at `x`. That pile is right
  799 of 985 times (81.1%); the rest is a usability cost, not a safety
  one.
- **Step 3 cannot leak.** It only ever assigns `x`, and there is nothing
  looser than `x` for it to be wrong toward. That is structural, not luck.

This is a tuning number, not a clean exam (D24): the rules were built
from these same 4171 rows, so an API the tool has not seen will score
worse. See `docs/product/prd.md` and `docs/logs/learnings.md` for the
full picture.

The clean-exam number, scored once and burned: `data/exam-2026-09-17/`
(1383 operations from three complete official APIs the rules never
saw — okta, docusign, xero) came out 85.3% exact, 12.4% leaks (171
rows), 2.3% too strict. Step 1 scored 583/583; every one of the 171
leaks belongs to step 2 (30.2% of its claims), all truth `x` called
`w`. Leave-one-vendor-out is the only honest generalization number —
the tuning number above looks far better and does not survive it.

On doubt it picks the stricter class. It never loosens without
evidence.

## Use it for

- **Agentic automation** — give an agent, or the arbiter watching it,
  an answer for every call before the call is made.
- **Labelling your own API** — it gets 3930 of 4171 operations right
  (94.2%) in seconds, with safe defaults where it is unsure; you review
  the rest by hand, mostly to loosen the 186 it left stricter than they
  needed to be.
- **MCP hints** — feed the class straight to the agents already
  calling your API.

## How an agent should read the output

Every verdict carries three fields: `class` (`r`, `w` or `x`, the
tool's best guess), `destructive` (true when the call cannot be
undone, whatever the class) and `evidence` (`list` when a word
fired, `floor` when only the HTTP method decided). The recommended
reading:

| verdict | agent does |
|---|---|
| `r` | allow |
| `w`, evidence `list` | allow |
| `w`, evidence `floor` | ask once, then remember the answer for that operation |
| `x` | ask every time |
| `destructive: true` | ask every time, whatever the class |

The class stays accurate by default; `evidence: floor` marks the guess
so the agent asks about it; `x` and `destructive` are the reach-beyond
and can't-undo cases, always asked. This policy is the recommended
reading and is not carried in the map itself — the map holds only the
three fields. The tool cannot know which operations you call heavily;
it gives the head start and you tighten from traffic.

## Status

[WIP] — a proof of concept, not shipped. The classifier core is frozen
while the remaining work is measured. Design and numbers live in
`docs/product/prd.md`; every experiment is logged in
`docs/logs/learnings.md`.

`rwxmap@0.1.0` on npm is a name reservation: that tarball shipped this
README, the changelog and the license — no code, nothing to `require` or
`import`. The repo now has a real entry point, `src/index.js`, with a
single export, `classifyRow`. It has not been published yet. `poc/` keeps
the earlier step-by-step builds (`archive`, `step1`, `step2`, `step3`) as
the frozen reference the current code is proved against.

## License

Apache License, Version 2.0 — see [`LICENSE`](LICENSE).
