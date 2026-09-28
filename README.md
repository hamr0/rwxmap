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

## Loading a spec

```js
import { loadSpec } from 'rwxmap/load';
import { operationsFrom, classifyRow } from 'rwxmap';

const { doc } = await loadSpec('https://example.com/openapi.yaml');
const verdicts = operationsFrom(doc).map((op) => classifyRow(op));
```

`loadSpec` takes a URL or a file path, JSON or YAML, gzipped or not, and
refuses anything over 64 MB (compressed or decoded) before it is fully
read, and any binary content, so one bad link can't take the process down.
It never follows an external `$ref` — an operation split into another
file classifies on method+path alone (D106). It ships as the separate
`rwxmap/load` subpath, not from the package root, so `import 'rwxmap'`
never loads its one dependency, the `yaml` parser (D107).

## Command line [unreleased]

```
rwxmap <spec URL | local file | bare API address> [-o <dir>] [--vendor <name>] [--force]
```

Not yet published to npm — built, not released.

The address can be three kinds of input:

- a **local file**, JSON or YAML, loaded with `loadSpec`.
- a **spec URL**, tried as a spec first (`loadSpec`, at least one
  operation found); a URL you type is explicit input, so it's fetched
  as given.
- a **bare API address**, anything else — an http(s) URL that fails to
  load as a spec, or loads with zero operations. Discovery
  (`findSpec`) runs instead, with its own address safety rule still in
  force (no non-https URL, IP-literal host, `localhost` or
  single-label host). Nothing found → exit 1, no file written.

**Vendor**, in this order: `--vendor` if given; else, for a URL, the
URL's own host; else, for a local file, the spec's first declared
server host (`firstServerHost`); if none resolve, exit 1 asking for
`--vendor`.

**Output**, written to `-o <dir>` (default: the current directory):

- `<vendor>.rwxmap.json` — the combined bareguard + MCP map:

  ```json
  {
    "rwxmapVersion": "0.5.0",
    "source": "https://api.example.com/openapi.yaml",
    "vendor": "api.example.com",
    "bareguard": {
      "tools": { "api.example.com.deleteOrder": { "letter": "x", "marker": "settled" } }
    },
    "mcp": {
      "DELETE /v1/orders/{id}": {
        "operationId": "deleteOrder",
        "annotations": { "readOnlyHint": false, "destructiveHint": true },
        "_meta": {
          "io.github.hamr0.rwxmap/class": "x",
          "io.github.hamr0.rwxmap/destructive": true,
          "io.github.hamr0.rwxmap/evidence": "floor",
          "io.github.hamr0.rwxmap/review": "settled"
        }
      }
    },
    "jev": { "mode": "off", "model": null, "sent": 0, "answered": 0, "failed": 0, "changed": 0, "tokens": { "input": 0, "output": 0 } }
  }
  ```

  The `mcp` dict is hints only, never full tool definitions — no
  `inputSchema` — meant for an MCP server generated from the same
  OpenAPI spec. It is advisory: a client may ignore it. bareguard is
  what enforces, reading `bareguard.tools`.
- `<vendor>.rwxmap.review.json` — the human-facing sidecar: per-row
  evidence and review marker, counts, and the review list.

Both files are written atomically (nothing partial on a crash). An
existing file at either path is left alone unless you pass `--force`.

**Exit codes**: 0 on success, 1 on any failure (no spec found, a load
error, an existing file without `--force`, no vendor resolvable) —
never a partial write.

### Jev (optional)

Jev is an optional LLM tier. It re-checks some rows and can move a
letter one step. It is bring-your-own-key: your key, your cost (D120).
Without a key, rwxmap runs mechanically and says so.

**The key.** Set `RWXMAP_JEV_KEY`. rwxmap also reads a `.env` file in
the folder you run it from. A variable already set in your shell wins.

Careful: unsetting the variable does **not** turn Jev off if a `.env`
with the key sits in the folder you run from. To run without Jev, run
from another folder, or remove that line from `.env`.

**What leaves your machine.** For each row Jev checks, five fields from
the spec: method, path, operationId, summary and description, plus the
question for that row and the model name. They go to `https://api.typesafe.ai/v1/systemone`.
Nothing else is sent. The key goes only in the request header and never
appears in any output or error.

**When a call fails** (or its answer is unusable), that row keeps its mechanical letter. The run
never stops.

**stdout.** With a key (illustrative numbers):

```
rwxmap: Jev: on — sends method, path, operationId, summary, description of 40 operation(s) to api.typesafe.ai. Your key, your cost.
rwxmap: api.example.com — 50 operations (r 20 · w 18 · x 12)
rwxmap: settled 38 (76%) · loose 5 (10%) · tight 7 (14%)
rwxmap: Jev: on — 40 sent · 39 answered · 1 failed (kept mechanical) · 6 letters changed · 41200 in / 2100 out tokens
rwxmap: wrote api.example.com.rwxmap.json + api.example.com.rwxmap.review.json
```

Without a key, the Jev line reads `rwxmap: Jev: off (mechanical)`.

**The `jev` field** in `<vendor>.rwxmap.json`:

- `mode` — `"on"` or `"off"`.
- `model` — the Jev model that answered, or `null` when off.
- `sent` — rows asked about.
- `answered` — rows with a usable answer.
- `failed` — rows that kept their mechanical letter because the call
  failed or the answer was unusable.
- `changed` — rows whose letter Jev moved.
- `tokens` — `{ input, output }`, summed over answered rows; your cost.

A row Jev moved carries its `p` and `model` in the review file.

## Discovering a spec, for harness authors

`rwxmap/discover` finds an API's spec on its own and classifies calls
against it, for a harness or gate that wants whole-API coverage
instead of one URL at a time.

If you know the API's spec URL, or have the file, pass it as
`findSpec(apiUrl, { spec })`. That's the best case: nothing is
guessed. Big public vendors mostly publish their spec in their own
GitHub repo or on a docs site, which discovery does not look at — the
live run found 2 of 25.

Otherwise, `findSpec` tries, in order:

1. the given spec, with nothing else tried.
2. the 30-day cache.
3. `/.well-known/api-catalog` (RFC 9727).
4. the `Link: rel="service-desc"` header (RFC 8631).
5. `/openapi.json`, `/openapi.yaml`, `/swagger.json`.
6. nothing found → every call is classified on its own.

Steps 3-4 run on the API host, then walk up to its parent domain,
stopping at two labels. Step 5's fixed paths run on the API host, and
on `docs.`, `developer.` and `developers.` of that two-label parent
(for `api.cloudflare.com`, that's `docs.cloudflare.com`,
`developer.cloudflare.com` and `developers.cloudflare.com`).

The spec-or-not decision is made per call, not per API: a call that
matches no operation in the found spec — for example because the spec
is incomplete — is classified on its own, so an incomplete spec costs
exactness, never a looser letter (see the test "classifyCall: an
undocumented endpoint on a found spec falls back to per-request
classification" in `src/discover.test.js`).

```js
import { findSpec, classifyCall } from 'rwxmap/discover';

const found = await findSpec('https://api.example.com');
const verdict = classifyCall(found, 'POST', 'https://api.example.com/v1/orders');
// { key, letter, marker, source: 'spec' | 'request' }
```

- `findSpec(apiUrl, { spec?, cacheDir? })` looks for an OpenAPI/Swagger
  document at the usual locations (D108), caches the result for 30
  days, and refuses to probe a non-https URL, an IP-literal host,
  `localhost` or a single-label host (D114).
- `classifyCall(found, method, url)` matches the call to a spec
  operation when it can, else falls back to per-request classification
  (`classifyRow`), and always returns `{ key, letter, marker, source }`.
- `requestKey(method, url)` is the per-request key builder on its own,
  for a caller that already has a `letter`/`marker` from elsewhere.
- `firstServerHost(doc, specAddr)` reads a spec's own declared server
  (OpenAPI 3 `servers[]`, with variable substitution, or Swagger 2
  `host`+`basePath`) and returns its host, or `null` if none resolves.
  It is the one writer of that resolution, shared with `findSpec`'s own
  vendor default and with the CLI's local-file vendor default.

A discovered spec's keys (`<host>.<operationId>`) and per-request keys
(`requestKey`) are separate keyspaces — a harness must never build one
from the other (a bareguard guard-session finding).

Discovery is limited: at most 3 guessed paths, at most 3 service-desc
links followed, and a 60 s wall-clock budget per `findSpec` call (up
to one request timeout of overrun). A spec-less site costs about 26
requests, measured live, then cached for 30 days.

Discovery can occasionally land on a spec for a different API on the
same domain. Live, cloudflare's `www.cloudflare.com/openapi.json` was
a 3-operation file for something else, and it matched 0 calls. A call
that happens to match such a spec takes that spec's letter — in
testing that made 4 of 414,180 cross-vendor calls looser. No test
tells a wrong spec from a right one, so this is an accepted, known
limit (D117). Passing the spec URL avoids it.

For bareguard: a found spec's `entries` go straight into `gate.add()`
unchanged. A per-request key must be added with
`gate.add({ [key]: { letter, marker } })` *before* the matching
`gate.check({ type: key, url })`, with the real URL in `url` — an
unlisted key is denied. `add()` is tighten-only and all-or-nothing per
batch: a refused batch throws and is audited, so catch it and keep
going, and the stricter existing entry stays in force. A gate caps out
at 10,000 keys.

It ships as its own `rwxmap/discover` subpath (D113), never from the
package root, so `import 'rwxmap'` stays offline and dependency-free.

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
