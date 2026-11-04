```
██████╗ ██╗    ██╗██╗  ██╗███╗   ███╗ █████╗ ██████╗ 
██╔══██╗██║    ██║╚██╗██╔╝████╗ ████║██╔══██╗██╔══██╗
██████╔╝██║ █╗ ██║ ╚███╔╝ ██╔████╔██║███████║██████╔╝
██╔══██╗██║███╗██║ ██╔██╗ ██║╚██╔╝██║██╔══██║██╔═══╝ 
██║  ██║╚███╔███╔╝██╔╝ ██╗██║ ╚═╝ ██║██║  ██║██║     
╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     

   r ─ w ─ x   what a call does, before it is made
```

<p align="center">
  <a href="https://github.com/hamr0/rwxmap/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/hamr0/rwxmap/ci.yml?label=CI" alt="CI"></a>
  <img src="https://img.shields.io/github/package-json/v/hamr0/rwxmap?label=version&color=2a4f8c" alt="version (auto from package.json)">
  <img src="https://img.shields.io/badge/license-Apache%202.0-2a4f8c" alt="license: Apache 2.0">
</p>

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

## How rwxmap decides

Four steps:

1. **Mechanical letter.** The HTTP method and the first verb of the
   operation name give a letter. Offline, free, the same answer every run.
2. **Mechanical marks what it is unsure of.** `loose` means it lowered
   the letter. `tight` means an x that may be stricter than needed.
3. **A second pass looks again at only those rows.** rwxlite is a small
   model that runs on your machine. It is free and needs no key.
4. **Still unsure? It becomes x, marked for review.** The tool never
   guesses a looser letter.

```
spec -> mechanical letter -> unsure rows (loose / tight)
                                   |
                       second pass (rwxlite, local)
                                   |
                   sure: its letter    unsure: x + review
```

HTTP methods: GET, HEAD, OPTIONS and QUERY (RFC 10008) start at r.
PUT and PATCH start at w. DELETE starts at x. POST has no default; its
first verb decides. A word can raise a PUT or PATCH to x.

**Modes.** Pick one with `--engine`.

| mode | command | what runs | cost | network | when to use |
|---|---|---|---|---|---|
| **a** (default) | `rwxmap spec.json` | mechanical, then rwxlite on the loose and tight rows | free | model download once | the normal run |
| **b** | `rwxmap spec.json --engine rwxlite [--confidence 0-99]` (default 95) | rwxlite judges every row; under the confidence it is x + review | free | model download once | more asks, fewer too-loose rows; raise `--confidence` to be stricter |
| **c** | `rwxmap spec.json --engine jev` | mechanical, then Jev | your key, your cost | each checked row goes to Jev | you already pay for Jev; needs `RWXMAP_JEV_KEY` |
| mechanical only | `rwxmap spec.json --engine mechanical` | method and verbs only | free | none | offline, or you want no model at all |

`--model small` (a and b only) uses the 23 MB int8 model instead of the
91 MB exact default.

**Not live yet.** The rwxlite model is not published. Today every mode
except c runs mechanically and prints `rwxlite: off (mechanical)`; the
numbers below are from the model run as a test. Once it is published, the
first run downloads it (from rwxlite's GitHub releases, sha256-checked)
into `$XDG_CACHE_HOME/rwxmap`, else `~/.cache/rwxmap/`, and later runs
reuse it. With no network and no cached model the run is mechanical and
never stops. Details are under "rwxlite model" below.

**Markers.** Each row carries a `review` marker.

- `settled`: nothing lowered it and nothing is doubtful. Not signed, not
  verified. Look at it last.
- `loose`: mechanical lowered the letter (a PUT or PATCH left at w, or a
  POST a word list lowered). A reviewer checks whether it should be x.
  This is where most too-loose rows live.
- `tight`: x that may be stricter than needed, including any row the
  second pass could not decide. A reviewer checks whether it can be w or
  r. Too tight costs usability, not safety.

**Quick reference, measured.** The same 949 operations for every row
(coolify, workos, lago, resend). rwxlite built this set as its own exam
and used it up; here it is tuning data, not an exam for rwxmap. Too
loose (looser than the truth label) and too tight (stricter) are kept
apart. Asked is the rows made x and marked for review.

| mode | exact | too loose | too tight | asked (x + review) |
|---|---|---|---|---|
| mechanical only | 736 (77.6%) | 6 (0.6%) | 207 (21.8%) | none |
| a | 826 (87.0%) | 6 (0.6%) | 117 (12.3%) | 99 (10.4%) |
| b at 95 (default) | 837 (88.2%) | 6 (0.6%) | 106 (11.2%) | 134 (14.1%) |
| b at 70 | 870 (91.7%) | 18 (1.9%) | 61 (6.4%) | 52 (5.5%) |
| b at 97 | 811 (85.5%) | 3 (0.3%) | 135 (14.2%) | 173 (18.2%) |
| c (Jev, one run, jev-1.14.0) | 870 (91.7%) | 8 (0.8%) | 71 (7.5%) | none |

- Percentages are of 949. The model answers come from the small int8
  model; the default exact model differs on a handful of rows.
- These are tuning numbers. A shared fresh exam will replace them.
- 5 risky rows no mode fixes yet: 3 credential replaces on PUT or PATCH
  and 2 logout GETs. Two mechanical rules are being tested for them.
- Mode c is one run of a model that can answer differently next time.

**What leaves your machine.** Mechanical: nothing. Modes a and b: only
the model download from GitHub; your spec stays local. Mode c: for each
row Jev checks, the method, path, operationId, summary and description go
to Jev.

## How good it is

The one clean exam so far. It is scored and used up; the rules were not
changed to fit it. Today's numbers on newer data are in "Quick
reference, measured" above.

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

Each works without a key.

**The shape it reads.** rwxmap reads OpenAPI 3.x or Swagger 2.0, JSON or
YAML. If your API is described some other way, convert it to OpenAPI
first and pass the file. With no spec at all, per-request classification
still works, less exactly.

## Quick start

```
npx rwxmap <spec URL | file | API address> [-o dir] [--vendor name]
  [--engine rwxlite|jev|mechanical] [--confidence 0-99] [--model small] [--force]
```

```
npx rwxmap ./openapi.yaml
npx rwxmap https://api.example.com/openapi.json
npx rwxmap https://api.example.com
```

`rwxmap --help` lists everything.

It writes three files, in `-o` (default: the current folder):

- `<vendor>.rwxmap.json` — the combined map: bareguard, MCP, WebMCP.
- `<vendor>.rwxmap.review.json` — per-row evidence and review marker,
  plus the spec's `servers` (read by `rwxmap/match`, below).
- `<vendor>.openapi.rwx.json` — a copy of your spec with `x-rwx` on
  every operation. Your own file is never written.

Trimmed example of the combined JSON, one entry each:

```json
{
  "rwxmapVersion": "x.y.z",
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
  "jev": { "mode": "off", "model": null, "sent": 0, "answered": 0, "failed": 0, "changed": 0, "tokens": { "input": 0, "output": 0 } },
  "rwxlite": { "mode": "off", "model": null, "reason": "could not get the model (fetch failed); none in the cache", "sent": 0, "raised": 0, "lowered": 0, "kept": 0, "undecided": 0 }
}
```

Exit 0 on success, 1 on any failure. An existing output file is not
overwritten without `--force`.

**Engines.** `--engine` picks who looks at the rows. The table in "How
rwxmap decides" lists every mode. `--confidence <0-99>` is valid only
with `--engine rwxlite` (default 95): a row the model is less sure of
than that is x, marked for review.

An unknown `--engine` value, a bad `--confidence`, or a `--model` other
than `small` (or used with `--engine jev` or `mechanical`) exits 1 with
nothing written.

`evidence` is `floor` (the method alone decided), `list` (a word list
fired), `jev` (Jev moved the row) or `rwxlite` (the rwxlite second pass
moved the row). The `rwxlite` block in the combined JSON records the
model string and the pass's counts.

HTTP QUERY (RFC 10008, safe like GET) is r, handled exactly like GET;
OpenAPI 3.2's `query` operations and `additionalOperations` entries keyed
QUERY are read. Other `additionalOperations` keys are counted, not read.

**rwxlite model.** A run that uses rwxlite fetches the latest manifest
from rwxlite's GitHub releases (a small request), downloads the model if
it is not already cached, checks every sha256, and only then puts it in
place. The default is the exact fp32 model, about 91 MB, downloaded once;
`--model small` uses the int8 model, about 23 MB. The cache is
`$XDG_CACHE_HOME/rwxmap`, else `~/.cache/rwxmap/`, one folder per
model. Downloads are https only, from github.com and its
githubusercontent.com hosts, capped at 200 MB, and a failed or tampered
download installs nothing.

If the manifest cannot be fetched (offline, rwxlite not published yet), the
run uses the highest verified model already cached and says "using cached
<model>, could not check for a newer one". With none cached it prints
`rwxlite: off (mechanical) — <reason>` and runs mechanically. It never
stops the run. The model is not pinned to the rwxmap version, so the same
spec can get different letters after a model update; the combined JSON
records the model string.

The model runs through the `rwxlite` npm package, which will be an
optional dependency of rwxmap. It is not on npm yet, so today it is not
declared and not installed; without it the run prints
`rwxlite: off (mechanical) — the rwxlite package is not installed (npm
install rwxlite)`. When it is published, install with
`ONNXRUNTIME_NODE_INSTALL=skip`: on Linux x64, `onnxruntime-node`
otherwise downloads about 285 MB of GPU (CUDA/TensorRT) libraries. Nothing
here is live until rwxlite publishes.

Only bareguard reads `bareguard.tools` directly. The MCP, WebMCP and
OpenAPI parts are hints you copy into place; a client may ignore them.

## Jev (optional)

Jev is an optional paid model pass that can lower an x to w, or on a
second question to r. Bring
your own key; your key, your cost. Jev runs only with `--engine jev`.
A key alone does not turn it on: the run says so and sends nothing.
`--engine jev` without a key exits 1.

- **The key.** Set `RWXMAP_JEV_KEY`, or put it in a `.env` in the folder
  you run from. Only that one variable is read from `.env`.
- **Careful:** unsetting the variable does not make `--engine jev`
  work if a `.env` with the key sits in the folder you run from. Run
  from another folder, or remove the line.
- **What leaves your machine.** For each row Jev checks: method, path,
  operationId, summary and description, plus the question and the model
  name. They go to `https://api.typesafe.ai/v1/systemone`. Nothing else
  is sent, and the key never appears in any output.
- **A failed call** never stops the run. If either call for a row fails,
  the row is x, marked for review.

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

## Proxy use (`rwxmap/match`)

For a proxy that sees only METHOD + absolute URL, with no spec, no YAML and
no network at runtime. Feed it the `<vendor>.rwxmap.review.json` sidecars
the CLI wrote:

```js
import { matcherFrom } from 'rwxmap/match';
const m = matcherFrom([sidecarA, sidecarB]);   // parsed sidecar objects
m.match('POST', 'https://api.example.com/v1/orders/123');
// -> { key, letter: 'r'|'w'|'x', marker: 'tight'|'loose'|'settled', source: 'spec'|'request', tie: boolean }
```

- It never returns null. `source: 'spec'` means a sidecar documents the
  call: `key` is that operation's gate key and `letter`/`marker` are its
  gate entry. `source: 'request'` means nothing documents it: the label
  comes from the method and path alone.
- The request-only key format `<host>.<METHOD> <path with ids as {id}>`
  (e.g. `api.anthropic.com.POST /v1/messages`) is stable and public;
  consumers may key their lists on it.
- A call matches a sidecar only on the exact host and port its servers
  name, and only the base paths of the servers on that host apply (a call
  to `a.com` never tries `b.com`'s `/admin`). One more route: a server
  written as one or more leading `{var}` labels over a fixed suffix of at
  least 2 labels (sentry's `https://{region}.sentry.io`) is stored in the
  sidecar's `serverTemplates` and also routes every host ending in
  `.<suffix>` (`de.sentry.io`, `a.b.sentry.io`; same port rule, not the bare
  `sentry.io`). Any other templated host (a whole-host variable such as
  okta's, `{subdomain}.{site}`, a variable in the suffix or mid-label, a
  one-label suffix such as `{subdomain}.{domain}.com`) gets no such route.
- Limit: a per-tenant vendor whose spec names a placeholder host without
  braces (jira's `your-domain.atlassian.net`, mailchimp's
  `server.api.mailchimp.com`) or a host with no fixed suffix is not
  covered; there is no placeholder-word guessing. Set the sidecar's
  `servers` (or `serverTemplates`) to your tenant before passing it to
  `matcherFrom`; a call no route claims takes the request-only label.
  Also a limit: the 2-label rule cannot tell a vendor's own domain from
  a shared one, so a spec that writes a template over a public suffix
  such as `{x}.github.io` or `{x}.co.uk` routes every host under it, and
  a stranger's host there gets that spec's letter (which can be looser
  than the request-only label). No spec in the corpus does this; there
  is no public-suffix list by design (no hand-curated lists).
- Limit: the call URL is matched as written. A trailing host dot
  (`api.acme.com.`), a percent-escaped letter or digit in the path
  (`%74hings`), or a `;params` tail (`/state;x=1`) does not match the
  spec row, so the call takes the request-only label, which can be looser
  (a PUT the spec calls x comes back w). Seen only in tests, never in
  live traffic; a consumer that wants the tighter answer should apply its
  own per-method letter to every `source: 'request'` call (barebox
  does).
- `tie` is true when several operations (or several sidecars) matched
  equally well and the tightest was taken.
- Sidecars from rwxmap 0.8.0 on carry a top-level `servers` list. A sidecar
  without one (written before 0.8.0) makes `matcherFrom` throw, naming the
  sidecar; regenerate it with 0.8.0 or later. `servers: []` is valid and
  means `https://<vendor>`.
- Bad sidecars throw at `matcherFrom`; `match` throws only on a URL that
  is not http(s).

Cost, measured: loading the import is about 1 MB, a 166-operation sidecar
adds about 0.1 MB, and a call takes about 7 µs.

## Status

WIP. Published on npm as `rwxmap`.

The author's Internet-Draft, [An Attenuated Delegation Profile for
Automated Agents](https://datatracker.ietf.org/doc/draft-hamr-oauth-agent-delegation/),
describes how a delegation grant is scoped. rwxmap is not normative in it.

## License

Apache License, Version 2.0 — see [`LICENSE`](LICENSE).
