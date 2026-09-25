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

> rwxmap is a mechanical starting point, not a standard and not a
> conformance harness. A label here has the status of an MCP hint: a
> suggestion the consumer weighs, and nobody should trust it 100%. What
> it gets wrong is published below rather than hidden, and both error
> directions are marked so you can decide what to stop on. The
> alternative it beats is not perfection — it is waiting for API vendors
> to redesign their methods, or for a standards body to agree on
> something, and an agent calling an API today does not have to wait for
> either.

## What it does

Every operation gets one letter:

- **r** — reads. Nothing changes.
- **w** — writes, and a later call of the same API can put it back.
- **x** — executes, and nothing can put it back: deletes, revokes,
  sends, charges, runs a job.

On doubt it picks the tighter letter, because being too tight annoys
people and being too loose lets an agent do something irreversible.

## The goal

Filesystems solved this with chmod: read, write, execute, three letters
everyone understands. APIs never got that. An agent handed an API key
gets all of it or none of it. rwxmap grades every operation of an API
into the same three letters, so an agent can be given scoped access the
way a process is — read-only here, writes there, never execute.

## Who it is for

**1. Running agents with scoped permissions.** This works today. The
mechanical pass is offline, needs no network, and is too loose on 0.8%
of operations. Pair it with bareguard, the author's agent gate, which
owns the gate and the grants — or read the labels and enforce them
yourself.

rwxmap only labels. It never decides to refuse. That decision belongs
to whatever gates the call.

**2. API providers publishing MCP hints.** This is the one that scales:
a provider grades once and every agent calling that API benefits. But a
provider who publishes without reviewing ships an API that is too tight
on roughly one operation in six. The `tight` and `loose` markers exist
for exactly that — grading and reviewing are one workflow, not two
features, and the review pass is where the too-tight rows get loosened
before anything is published.

The bareguard exporter is built (`exportGate`, `exportSidecar`). The CLI
and the emitters for the MCP, OpenAPI, WebMCP and ARD slots are not yet.

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
false; today there is none.

## Two ways to run it

| | exact | too loose | too tight |
|---|---|---|---|
| **mechanical** — method + word lists, no network | 82.3% | 0.8% | 16.9% |
| **+Jev** — an optional model pass; moves about 13% of rows | 93.0% | 0.5% | 6.5% |

These come from one scored exam — cloudflare, pagerduty and sentry,
4279 operations across three complete official APIs the rules had never
seen. On a separate 36-provider, 8376-operation tuning set the same
figures land within about 3 points, and +Jev matches exactly.

Mechanical is free and runs offline; +Jev costs a few cents and sends
your operation names and descriptions to a third-party model. A full
pass over the 4279-operation exam cost $0.31 — about $0.07 per thousand
operations — so a few thousand operations is roughly a quarter.

What those numbers add up to: about one operation in a hundred is graded
looser than it should be, and about one in two hundred once Jev runs.
That is the number to decide against. Too tight — 16.9% mechanical, 6.5%
with Jev — costs usability and nothing else. Too loose is the one that
matters, it is small, and it is stated here rather than engineered out
of sight; the `loose` marker below says where most of it sits.

## What to review

Each verdict carries `review`, saying which rows to look at:

Measured on the 4279-operation M3 exam with Jev running (the
mechanical-only figures are in the bullets below):

| | what it is | rows | how many are wrong |
|---|---|---|---|
| **`tight`** | `x` on a POST | 7% of the API | 61% |
| **`loose`** | `w` on a PUT/PATCH with no word evidence | 17% | 3% |
| **`settled`** | everything else | 76% | 3% |

- `tight` is where the fishing is: six of every ten are genuinely
  tighter than they need to be, and nothing too loose has ever been
  observed there, so reviewing it can only improve things.
- `loose` is mostly false alarms, and that is the point: only 3% are
  wrong, but those are the dangerous ones and they are three quarters
  of every dangerous row in the API. It turns a 4279-row search into a
  713-row one.
- `settled` means only that neither of the other two fired. It is not
  signed, not verified, not confirmed by anyone, and most settled rows
  are pure method-floor guesses. A confirmed state would be a fourth
  value that only a person writes: signing is the Resource Owner's act,
  never this tool's.
- Running mechanical instead, `tight` is bigger (19.5% of the exam,
  835 rows) and richer (85.0% wrong) — Jev has already fixed the easy ones, so what it
  leaves is the harder residue.
- How useful `tight` is depends on your spec: across 36 providers the
  hit rate ran from 33% (xero and figma, little or no description text)
  to 97-100% (netbox and spotify). The more your spec says, the better
  this works.

## How an agent should read the output

Every verdict carries four fields: `class` (`r`, `w` or `x`, the
tool's best guess), `destructive` (true when the call removes
something — a delete, purge, revoke, expire, void or redact — always
inside class `x`, never on an `r` or `w` row),
`evidence` (`list` when a word fired, `floor` when only the HTTP
method decided, `jev` when the optional model tier moved the row) and `review` (which rows to look at first). The
recommended reading:

- The letter is the answer. A gate such as bareguard reads the letter
  and, unless its operator turns on asking, never asks at runtime; `destructive: true` is a refinement inside
  `x`, not a fourth class. MCP's `destructiveHint` follows the class —
  true on every `x` — not this flag (D104).
- `review` is the field that says which rows to look at; the buckets
  and their hit rates are in **What to review** above. `evidence` is
  not a reliability signal: it answers a different question — whether
  a word fired or the HTTP method alone decided. Most leaks do sit on
  `floor` rows, but `floor` is most of the API, so it is far too broad
  a pile to review from.
- The exporter writes a draft `tools` section for bareguard
  keyed `<vendor>.<operationId>`, every row exported (D103) — either a
  bare letter or `{ "letter": "w", "marker": "loose" }`, the marker
  being `review`. A sidecar report carries each row's evidence for the
  reviewer, plus the `destructive: true` rows as a suggestion. It never
  writes bareguard's deny rules: that is the operator's call.

### `review` — which rows to look at first

The three values, and how many of the rows each one flags are actually
wrong, are in **What to review** above. `review` is a review bucket,
not an error count and not a confidence score — the tool still emits no
confidence score.

It is derived from `method`, `class` and `evidence` — all three already
published — and asserts nothing new. Any reader could compute it; the
field just saves them the rule.

This reading is not carried in the map itself — the map holds only
the four fields. The tool cannot know which operations you call
heavily; it gives the head start and you tighten from traffic.

## How it publishes

rwxmap does not invent a format. Every standard an agent already reads
leaves an extension slot open, and rwxmap fills that slot: OpenAPI
`x-`, MCP `_meta`, WebMCP hints, and the Agentic Resource Discovery
catalog pointer. The four carriers are described in
`docs/product/prd.md`.

Two consequences worth stating:

- A provider adopting rwxmap agrees to no new spec. The labels ride in
  fields their existing documents already allow.
- MCP hints default to the tightest reading when a field is omitted, so
  publishing only the rows you are confident in is safe — a row you
  leave out is read as the tight answer, not the loose one.

## The delegation draft

The author's Internet-Draft, "An Attenuated Delegation Profile for
Automated Agents"
([draft-hamr-oauth-agent-delegation](https://datatracker.ietf.org/doc/draft-hamr-oauth-agent-delegation/),
an individual submission, not a standard), describes how a delegation
grant is scoped. rwxmap produces the per-operation labels such a grant
needs. It is not normative in that draft, and this project is not a
standards track.

It sits in the same neighbourhood as
[RFC 9421](https://www.rfc-editor.org/rfc/rfc9421) (HTTP Message
Signatures) — signing is the resource owner's act, not this tool's.

## The world this is for

Automated traffic is already a large share of the web. Imperva/Thales
put it at 53% of all web traffic in 2025 — 40% bad bots, 13% benign
automation. Cloudflare's own measurement is lower, about 35% (both
figures as of September 2026). The two numbers are far apart, so treat
the exact share with care. Either way, automation is a large and
growing part of the traffic, not a fringe of it.

That share is going to keep including more agents acting for a real
person: buying tickets, ordering groceries, filing forms. Agents reach
real systems through APIs and MCP servers, and much of the industry —
WebMCP and others — is working hard on the *exposure* side: making APIs
usable by agents in the first place. This project works the other side
of that: safety, not exposure.

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
