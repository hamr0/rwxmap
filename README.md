```
██████╗ ██╗    ██╗██╗  ██╗███╗   ███╗ █████╗ ██████╗ 
██╔══██╗██║    ██║╚██╗██╔╝████╗ ████║██╔══██╗██╔══██╗
██████╔╝██║ █╗ ██║ ╚███╔╝ ██╔████╔██║███████║██████╔╝
██╔══██╗██║███╗██║ ██╔██╗ ██║╚██╔╝██║██╔══██║██╔═══╝ 
██║  ██║╚███╔███╔╝██╔╝ ██╗██║ ╚═╝ ██║██║  ██║██║     
╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     

   r ─ w ─ x   what a call does, before it is made

**[WIP] Scopes every API operation as r / w / x, so an agent knows what a call does before it is made.**

> rwxmap is a head start, not a standard and not a conformance harness.
> A label here has the status of an MCP hint: a suggestion the consumer
> weighs, and nobody should trust it 100%. What it gets wrong is
> published below, and both error directions are marked so you can
> decide what to stop on.

## r / w / x

Every operation gets one letter, the same three chmod taught you:

- **r** — reads. Changes nothing.
- **w** — writes. It changes things, and a later write can set it back.
  Sets, edits, creates, toggles, archives, pauses.
- **x** — executes. It cannot be undone. Deletes, revokes, sends,
  publishes, charges, refunds, triggers a run.

On doubt it picks the tighter letter, never the looser. Every verdict
also carries `destructive`: true when an x removes something (a delete,
purge, revoke, expire, void or redact), never on an r or w. bareguard,
the author's agent gate, uses the same meaning of the three letters.

## How good it is

| | exact | too loose | too tight |
|---|---|---|---|
| **mechanical** — method + word lists, offline | 82.3% | 0.8% | 16.9% |
| **+Jev** — an optional model pass | 93.0% | 0.5% | 6.5% |

One scored exam: cloudflare, pagerduty and sentry, 4279 operations across
three complete official APIs the rules had never seen. Too loose is the
one that matters, and it is under 1%. Too tight costs usability and
nothing else. A full Jev pass over the 4279 operations cost $0.31.

## Two ways to use it

**API providers.** Grade all your APIs, look at the rows the review
markers point to, and correct them. rwxmap does not keep your edits:
a re-run labels the spec afresh.

**Agentic automation.** Scope APIs on the fly for an agent that runs
with scoped permissions, through bareguard. rwxmap only labels; the gate
decides.

Secondary: the same letters ride in each standard's existing extension
slot, so nobody adopts a new format. OpenAPI gets `x-rwx`, MCP gets
`annotations` and `_meta`, WebMCP gets its two hints. MCP hints default
to the tightest reading when omitted. WebMCP defaults to false, so both
WebMCP flags are always written.

## What it takes

- A spec URL.
- A local OpenAPI file, JSON or YAML.
- A bare API address. Discovery tries the common places for a spec. It
  often finds nothing: discovery is hard.
- Per-request classification when there is no spec. It costs exactness,
  not safety. That is for library use, a harness classifying call by call;
  the CLI needs a spec and exits 1 when it finds none.

Each works with or without a Jev key.

**The shape it reads.** rwxmap reads OpenAPI 3.x or Swagger 2.0, JSON or
YAML. If your API is described some other way, convert it to OpenAPI
first and pass the file. With no spec at all, per-request classification
still works, less exactly.

## Quick start

```
npx rwxmap <spec URL | file | API address> [-o dir] [--vendor name] [--force]
```

```
npx rwxmap ./openapi.yaml
npx rwxmap https://api.example.com/openapi.json
npx rwxmap https://api.example.com
```

`rwxmap --help` lists everything.

It writes three files, in `-o` (default: the current folder):

- `<vendor>.rwxmap.json` — the combined map: bareguard, MCP, WebMCP.
- `<vendor>.rwxmap.review.json` — per-row evidence and review marker.
- `<vendor>.openapi.rwx.json` — a copy of your spec with `x-rwx` on
  every operation. Your own file is never written.

Trimmed example of the combined JSON, one entry each:

```json
{
  "rwxmapVersion": "0.6.0",
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
  "webmcp": {
    "DELETE /v1/orders/{id}": {
      "annotations": { "readOnlyHint": false, "consequentialHint": true }
    }
  },
  "jev": { "mode": "off", "model": null, "sent": 0, "answered": 0, "failed": 0, "changed": 0, "tokens": { "input": 0, "output": 0 } }
}
```

Exit 0 on success, 1 on any failure. An existing output file is not
overwritten without `--force`.

Only bareguard reads `bareguard.tools` directly. The MCP, WebMCP and
OpenAPI parts are hints you copy into place; a client may ignore them.

## Review markers

Each verdict carries `review`, which rows to look at first. Measured on
the 4279-operation exam with Jev running:

| | what it is | rows | how many are wrong |
|---|---|---|---|
| **`tight`** | `x` on a POST | 7% of the API | 61% |
| **`loose`** | `w` on a PUT/PATCH with no word evidence | 17% | 3% |
| **`settled`** | everything else | 76% | 3% |

- `tight` is where the fishing is: six in ten are tighter than needed.
- `loose` is mostly false alarms, but its 3% are three quarters of every
  too-loose row. It turns a 4279-row search into a 713-row one.
- `settled` only means neither of the other two fired. It is not signed
  and not verified.

## Jev (optional)

Jev is an optional model pass that can move a letter one step. Bring
your own key; your key, your cost. Without one, rwxmap runs mechanically
and says so.

- **The key.** Set `RWXMAP_JEV_KEY`, or put it in a `.env` in the folder
  you run from. Only that one variable is read from `.env`.
- **Careful:** unsetting the variable does not turn Jev off if a `.env`
  with the key sits in the folder you run from. Run from another
  folder, or remove the line.
- **What leaves your machine.** For each row Jev checks: method, path,
  operationId, summary and description, plus the question and the model
  name. They go to `https://api.typesafe.ai/v1/systemone`. Nothing else
  is sent, and the key never appears in any output.
- **A failed call** keeps that row's mechanical letter. The run never
  stops.

## Library use

```js
import { classifyRow, operationsFrom } from 'rwxmap';
import { loadSpec } from 'rwxmap/load';
import { findSpec, classifyCall, requestKey } from 'rwxmap/discover';
```

- `rwxmap` — `operationsFrom(doc)` lists a spec's operations;
  `classifyRow(op)` returns a verdict: its class, its evidence
  source and its review marker.
- `rwxmap/load` — `loadSpec(urlOrPath)` reads JSON or YAML.
- `rwxmap/discover` — `findSpec(apiUrl)` looks for a spec;
  `classifyCall(found, method, url)` classifies one live call;
  `requestKey(method, url)` builds the per-request key.

**For a harness using bareguard.** A found spec's `entries` go straight
into `gate.add()`. A per-request key must be added with
`gate.add({ [key]: { letter, marker } })` before the matching
`gate.check({ type: key, url })`; an unlisted key is denied. `add()` only
tightens and is all-or-nothing per batch, so catch a refused batch and
carry on. Spec keys (`<host>.<operationId>`) and per-request keys are
separate keyspaces; never build one from the other. A gate holds at most
10,000 keys.

**Known limit.** Discovery can land on a spec for a different API on the
same domain, and a call that matches it takes that spec's letter (4 of
414,180 cross-vendor test calls came out looser). Pass the spec URL to
avoid it.

## Status

WIP. `rwxmap@0.6.0` is on npm.

The author's Internet-Draft, [An Attenuated Delegation Profile for
Automated Agents](https://datatracker.ietf.org/doc/draft-hamr-oauth-agent-delegation/),
describes how a delegation grant is scoped. rwxmap is not normative in it.

## License

Apache License, Version 2.0 — see [`LICENSE`](LICENSE).
