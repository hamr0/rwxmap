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
- **w** — write. Changes something a later write can set back.
- **x** — execute. Cannot be undone.

## The shared definition

Since 2026-09-22 (D87) rwxmap and bareguard — the author's agent
gate, which reads one r/w/x letter per tool — use one meaning of the
three letters, and it is the one chmod already taught you:

- **r** = read: changes nothing.
- **w** = write: changes things — yours or anyone else's — in a way
  a later write can set back. Sets, edits, creates, toggles,
  archives, pauses, cancels of something that can be resumed.
- **x** = execute: cannot be undone. Deletes and removals, revokes,
  expires, voids, sends, publishes, charges, pays, refunds, triggers
  a run. `destructive: true` when it removes.
- Unsure → **x**.

One caveat: whether a call touches someone other than you is not a
class test. It cannot be read reliably from a spec (the words for
"whose" mean different things in every API), so it stays out of the
letter. It may come back as an evidence-only flag beside
`destructive`, set only when there is evidence and never emitted as
false; today there is none. Every number below was measured under the
earlier definition and predates this one; the rows are being
relabelled, and the honest number under it is not known yet.

## Where it is today

Measured on 4171 operations from 15 complete official provider APIs.

- Right on 3930 of those 4171 operations (94.2%).
- Under-classified on 55 of 4171 (1.3%). This is the direction that
  matters for safety: it is the tool saying a call is tamer than it is.
- Over-classified on 186 of 4171 (4.5%) — annoying, never dangerous.

*Under-classified* and *over-classified* are the names used for the two
error directions everywhere below ("leak" is used for an
under-classified row where the safety reading is the point). Neither is
the published `review` value `loose` or `tight`: those are review
buckets — which rows to look at first — not error counts. See "How an
agent should read the output".

Every answer comes from one of two places. **Known** means a word in the
operation's name matched a word list — the tool read something. **Unknown**
means nothing matched and the HTTP method alone decided it.

| Step | Evidence | Rows | Right | Right % | Under-classified | Under % | Over-classified | Over % |
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
  under-classified answers are step 2's unknown row — a PUT, DELETE or PATCH
  with no word to read, called `w` where the truth was `x`. No other
  cell leaks above 2.2%.
- **Every over-classified answer is in one other cell.** All 186 are step 3's
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
rows), 2.3% over-classified. Step 1 scored 583/583; every one of the 171
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
  the rest by hand, mostly to loosen the 186 it over-classified.
- **MCP hints** — feed the class straight to the agents already
  calling your API.

## How an agent should read the output

Every verdict carries four fields: `class` (`r`, `w` or `x`, the
tool's best guess), `destructive` (true when the call cannot be
undone — always inside class `x`, never on an `r` or `w` row),
`evidence` (`list` when a word fired, `floor` when only the HTTP
method decided) and `review` (which rows to look at first). The
recommended reading:

- The letter is the answer. A gate such as bareguard reads the letter
  and never asks at runtime; `destructive: true` is a refinement of
  `x` for MCP's `destructiveHint`, not a fourth class.
- `evidence: floor` rows are reviewed once by a human before the map
  is deployed. They are the rows the tool guessed from the method
  alone, and the leaks live there.
- The exporter (planned) writes a draft `tools` section for bareguard
  keyed by operationId, one letter per row, and leaves floor rows out
  so a missed row is a loud deny, never a leak; a sidecar report lists
  every omitted row with its class and evidence for the reviewer.

### `review` — which rows to look at first

`review` is one of three values, and it is a review bucket, not an
error count and not a confidence score. The tool still emits no
confidence score.

- **`loose`** — class `w` on a PUT or PATCH that the method floor
  decided, with no word either way.
- **`tight`** — class `x` on a POST.
- **`settled`** — everything else.

It is derived from `method`, `class` and `evidence` — all three already
published — and asserts nothing new. Any reader could compute it; the
field just saves them the rule.

How to use it: review the `loose` rows first, because that is where the
under-classified rows are; then the `tight` rows, which are dense with
over-classified rows and where nothing under-classified has ever been
observed.

From one scored exam of three vendors (cloudflare, pagerduty and
sentry, 4279 rows, Jev tiers on) — one exam, three vendors, so read it
as a shape and not as a guarantee:

| `review` | Rows | Under-classified | Over-classified |
|---|---|---|---|
| `loose` | 713 | 16 | — |
| `tight` | 313 | 0 | 191 |
| `settled` | 3253 | — | — |

This reading is not carried in the map itself — the map holds only
the four fields. The tool cannot know which operations you call
heavily; it gives the head start and you tighten from traffic.

## Status

[WIP] — a proof of concept, not shipped. The classifier core is frozen
while the remaining work is measured. Design and numbers live in
`docs/product/prd.md`; every experiment is logged in
`docs/logs/learnings.md`.

`rwxmap@0.3.0` is on npm with one real export, `classifyRow`, from
`src/index.js` (the 0.1.0 tarball was a name reservation that shipped
only this README, the changelog and the license). `poc/` keeps
the earlier step-by-step builds (`archive`, `step1`, `step2`, `step3`) as
the frozen reference the current code is proved against.

## License

Apache License, Version 2.0 — see [`LICENSE`](LICENSE).
