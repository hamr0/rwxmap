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

**Scopes every API operation as r / w / x, so an agent knows what a call does before it is made.**

> A label is a hint, like an MCP hint. It is not a standard and not a
> conformance harness. What it gets wrong is published below, in both directions.

## r / w / x

One letter per operation, like chmod:

- **r** reads. Changes nothing.
- **w** writes. A later write can set it back. Sets, edits, creates, toggles, archives, pauses.
- **x** executes. It cannot be undone. Deletes, revokes, sends, publishes, charges, refunds, triggers a run.

On doubt it picks the tighter letter, never the looser. Each verdict also
has `destructive`: true when an x removes something (delete, purge, revoke,
expire, void, redact). Never on r or w. bareguard, the author's agent
gate, uses the same three letters.

## What it does

```
IN                         DECIDE                        OUT
OpenAPI file or URL    →   mechanical rules          →   bareguard grants
API address (finds the     (method + first verb)          MCP annotations + _meta
 spec: RFC 9727            + optional model pass          WebMCP hints
 api-catalog, Link                                        OpenAPI copy with x-rwx
 header, usual paths)                                     review sidecar → rwxmap/match
one live call, no spec
```

rwxmap reads specs and writes every format. The deciding is rules, plus a model if you pick one.

How it decides:

- Method floor: GET, HEAD, OPTIONS and QUERY are r, unless the name is a one-way action (logout, revoke, close), which raises it to x. DELETE is x. PUT and PATCH are w, raised to x by a path word (role, member, token, webhook and the like) or a credential-set verb. POST is x, lowered to w by a content noun (tag, file, comment and the like) or a short list of verbs, or to r by a read verb (list, get, search and the like).
- Unsure rows get a marker. `loose`: the rules lowered the letter; a reviewer checks if it should be x (most too-loose rows live here). `tight`: an x that may be stricter than needed, including rows the second pass could not decide; too tight costs usability, not safety. `settled`: nothing lowered it, nothing is doubtful; not signed, not verified.
- Still unsure: x plus review. Never a looser guess.

## Modes

| mode | command | what decides | cost / network | use when |
|---|---|---|---|---|
| **a** (default) | `rwxmap spec.json` | rules, then rwxlite on the loose and tight rows | free; one model download | the normal run |
| **b** | `rwxmap spec.json --engine rwxlite [--confidence 0-99]` (default 95) | rwxlite alone judges every row; rwxmap only reads the input and writes the outputs; under the confidence a row is x + review | free; one model download | you want the model's view of every row |
| **c** | `rwxmap spec.json --engine jev` | rules, then Jev (paid, your key) re-checks the rows the method alone decided: a POST at x can drop to w (or r), a PUT or PATCH at w can rise to x, a GET at r can rise to w | your key, your cost; each checked row goes to Jev | you already pay for Jev |
| mechanical | `rwxmap spec.json --engine mechanical` | rules only | offline; nothing downloaded; same answer every run | no model at all |

rwxlite is a small local model, a separate project: [github.com/hamr0/rwxlite](https://github.com/hamr0/rwxlite), npm package `rwxlite`.
Install it with `ONNXRUNTIME_NODE_INSTALL=skip npm install rwxlite@0.2`. Without it, modes a and b run mechanically and say `rwxlite: off (mechanical)`.

What leaves your machine: mechanical, nothing. Modes a and b, only the model download from GitHub. Mode c, each checked row's method, path, operationId, summary and description go to Jev.

## How good it is

Exam #5: 1443 operations, 7 complete official APIs (frontapp, planetscale, paddle, hookdeck, fusionauth, semaphoreui, weaviate), labelled blind, scored once on 2026-11-07. Counts are of those 1443 operations.

| mode | exact | too loose | too tight |
|---|---|---|---|
| mechanical (v4) | 1201 (83.2%) | 59 (4.1%) | 183 (12.7%) |
| a (default, rwxlite 0.2.0) | 1272 (88.1%) | 94 (6.5%) | 77 (5.3%) |

- Too loose (looser than the truth label) is the safety cost. Too tight (stricter) is a usability cost. They are kept apart.
- On this exam mode a is looser than mechanical alone (94 against 59 too loose). rwxlite 0.2.0 was trained before x was widened to cover anything that cannot be put back, so it lowers rows that are now x. A newer model is decided and will replace it.
- Mechanical v4 shipped by choice although it failed its own too-tight gate: 183 too tight against 178 for the older rules. It has 59 too-loose rows against 77, and every added too-tight row is marked for review.
- The exam was scored once and is used up. Any rule or model change needs a new exam.
- Modes b and c were not scored on this exam.

Older numbers for modes b and c, from exam #3 (1377 operations, 7 other APIs, scored 2026-11-04, older truth, older rules). Not comparable with the table above.

| mode | exact | too loose | too tight |
|---|---|---|---|
| b at 95 | 1181 (85.8%) | 14 (1.0%) | 182 (13.2%) |
| c (Jev, one run) | 1250 (90.8%) | 16 (1.2%) | 111 (8.1%) |

- Jev is one run of a model that can answer differently next time.

## Ways to use it

- **With bareguard.** rwxmap labels, the gate decides.
- **On its own.** An API provider grades its APIs and checks the rows the markers point to. rwxmap keeps no edits; a re-run labels afresh.
- **As hints.** The letters go in each standard's existing slot: OpenAPI `x-rwx`, MCP `annotations` + `_meta`, WebMCP's two hints. MCP hints default to the tightest reading when omitted. WebMCP defaults to false, so both flags are always written. Only bareguard reads `bareguard.tools` directly; the rest are hints a client may ignore.
- **In a proxy.** `rwxmap/match`, METHOD + URL only.
- **As a library.**

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

`rwxmap --help` lists everything. A local spec with no `servers` needs `--vendor <name>`.

It writes three files, in `-o` (default: the current folder):

- `<vendor>.rwxmap.json`: the combined map (bareguard, MCP, WebMCP).
- `<vendor>.rwxmap.review.json`: per-row evidence and review marker, plus the spec's `servers` (read by `rwxmap/match`).
- `<vendor>.openapi.rwx.json`: a copy of your spec with `x-rwx` on every operation. Your own file is never written.

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

Exit 0 on success, 1 on any failure. An existing output file is not overwritten without `--force`.

## Reference

<details><summary>Flags and errors</summary>

- `--engine` picks who looks at the rows (see Modes).
- `--confidence <0-99>` is valid only with `--engine rwxlite` (default 95). A row the model is less sure of is x + review.
- `--model small` (modes a and b only) uses the int8 model instead of the exact default.
- An unknown `--engine`, a bad `--confidence`, or a `--model` other than `small` (or used with `--engine jev` or `mechanical`) exits 1 with nothing written.
- `evidence` is `floor` (the method alone decided), `list` (a word list fired), `jev` (Jev moved the row) or `rwxlite` (the second pass moved the row).
- The `rwxlite` block in the combined JSON records the model string and the pass's counts.
- HTTP QUERY (RFC 10008, safe like GET) is r, handled exactly like GET. OpenAPI 3.2 `query` operations and `additionalOperations` entries keyed QUERY are read. Other `additionalOperations` keys are counted, not read.

</details>

<details><summary>Input shapes</summary>

- A spec URL, or a local OpenAPI file (JSON or YAML). Each works without a key.
- A bare API address: discovery tries the common places for a spec. It often finds nothing.
- Reads OpenAPI 3.x or Swagger 2.0. For any other description, convert it to OpenAPI first and pass the file.
- The CLI needs a spec and exits 1 when it finds none.
- Per-request classification (no spec) is library-only. It costs exactness, not safety.

</details>

<details><summary>rwxlite model</summary>

- A run that uses rwxlite fetches the manifest of the pinned rwxlite release, v0.2.0 (a small request), downloads the model if it is not cached, checks every sha256, and only then puts it in place.
- Default: the exact fp32 model, about 91 MB, downloaded once. `--model small`: the int8 model, about 23 MB.
- Cache: `$XDG_CACHE_HOME/rwxmap`, else `~/.cache/rwxmap/`, one folder per model.
- Downloads are https only, from github.com and its githubusercontent.com hosts, capped at 200 MB. A failed or tampered download installs nothing.
- Offline (manifest unreachable): the run uses the verified cached model of the pinned version and says "using cached <model>, could not reach the release". With none cached it prints `rwxlite: off (mechanical) — <reason>` and runs mechanically. It never stops the run.
- The model is pinned in each rwxmap release. A new model ships only after it passes a fresh exam. The combined JSON records the model string.
- The `rwxlite` package is optional; you install it. Use `ONNXRUNTIME_NODE_INSTALL=skip npm install rwxlite@0.2`: on Linux x64, `onnxruntime-node` otherwise downloads about 285 MB of GPU (CUDA/TensorRT) libraries.
- Only rwxlite package versions 0.2.x are accepted (D135). Any other version turns the second pass off (mechanical alone, reason printed).
- Without the package: `rwxlite: off (mechanical) — the rwxlite package is not installed (npm install rwxlite@0.2)`.

</details>

<details><summary>Jev (optional, paid)</summary>

Jev re-checks the rows the method alone decided. It can lower a POST from x to w, or on a second question to r; raise a PUT or PATCH from w to x; and raise a GET from r to w. Bring your own key; your key, your cost. It runs only with `--engine jev`. A key alone does not turn it on: the run says so and sends nothing. `--engine jev` without a key exits 1.

- **The key.** Set `RWXMAP_JEV_KEY`, or put it in a `.env` in the folder you run from. Only that one variable is read from `.env`.
- **Careful.** Unsetting the variable does not stop `--engine jev` if a `.env` with the key sits in the folder you run from. Run from another folder, or remove the line.
- **What leaves your machine.** For each row Jev checks: method, path, operationId, summary and description, plus the question and the model name. They go to `https://api.typesafe.ai/v1/systemone`. Nothing else is sent. The key never appears in any output.
- **A failed call** never stops the run. If either call for a row fails, or the second answer is malformed (p missing, not a number, or outside 0 to 1), the row is x, marked for review.

</details>

<details><summary>Library use</summary>

```js
import { classifyRow, operationsFrom } from 'rwxmap';
import { loadSpec } from 'rwxmap/load';
import { findSpec, classifyCall, requestKey } from 'rwxmap/discover';
```

- `rwxmap`: `operationsFrom(doc)` lists a spec's operations; `classifyRow(op)` returns a verdict (class, evidence source, review marker).
- `rwxmap/load`: `loadSpec(urlOrPath)` reads JSON or YAML.
- `rwxmap/discover`: `findSpec(apiUrl)` looks for a spec; `classifyCall(found, method, url)` classifies one live call; `requestKey(method, url)` builds the per-request key.

**For a harness using bareguard.**

- A found spec's `entries` go straight into `gate.add()`.
- A per-request key must be added with `gate.add({ [key]: { letter, marker } })` before the matching `gate.check({ type: key, url })`. An unlisted key is denied.
- `add()` only tightens and is all-or-nothing per batch. Catch a refused batch and carry on.
- Spec keys (`<host>.<operationId>`) and per-request keys are separate keyspaces. Never build one from the other.
- A gate holds at most 10,000 keys.

**Known limit.** Discovery can land on a spec for a different API on the same domain, and a call that matches it takes that spec's letter (4 of 414,180 cross-vendor test calls came out looser). Pass the spec URL to avoid it.

</details>

<details><summary>Proxy use (rwxmap/match)</summary>

For a proxy that sees only METHOD + absolute URL, with no spec, no YAML and no network at runtime. Feed it the `<vendor>.rwxmap.review.json` sidecars the CLI wrote:

```js
import { matcherFrom } from 'rwxmap/match';
const m = matcherFrom([sidecarA, sidecarB]);   // parsed sidecar objects
m.match('POST', 'https://api.example.com/v1/orders/123');
// -> { key, letter: 'r'|'w'|'x', marker: 'tight'|'loose'|'settled', source: 'spec'|'request', tie: boolean }
```

- It never returns null. `source: 'spec'` means a sidecar documents the call: `key` is that operation's gate key and `letter`/`marker` are its gate entry. `source: 'request'` means nothing documents it: the label comes from the method and path alone.
- The request-only key format `<host>.<METHOD> <path with ids as {id}>` (e.g. `api.anthropic.com.POST /v1/messages`) is stable and public. Consumers may key their lists on it.
- A call matches a sidecar only on the exact host and port its servers name, and only the base paths of the servers on that host apply (a call to `a.com` never tries `b.com`'s `/admin`).
- One more route: a server written as one or more leading `{var}` labels over a fixed suffix of at least 2 labels (sentry's `https://{region}.sentry.io`) is stored in the sidecar's `serverTemplates`. It also routes every host ending in `.<suffix>` (`de.sentry.io`, `a.b.sentry.io`; same port rule, not the bare `sentry.io`). Any other templated host gets no such route: a whole-host variable such as okta's `{subdomain}.{site}`, a variable in the suffix or mid-label, a one-label suffix such as `{subdomain}.{domain}.com`.
- Limit: a per-tenant vendor whose spec names a placeholder host without braces (jira's `your-domain.atlassian.net`, mailchimp's `server.api.mailchimp.com`) or a host with no fixed suffix is not covered. There is no placeholder-word guessing. Set the sidecar's `servers` (or `serverTemplates`) to your tenant before passing it to `matcherFrom`. A call no route claims takes the request-only label.
- Limit: the 2-label rule cannot tell a vendor's own domain from a shared one. A spec that writes a template over a public suffix such as `{x}.github.io` or `{x}.co.uk` routes every host under it, and a stranger's host there gets that spec's letter (which can be looser than the request-only label). No spec in the corpus does this. There is no public-suffix list by design (no hand-curated lists).
- Limit: the call URL is matched as written. A trailing host dot (`api.acme.com.`), a percent-escaped letter or digit in the path (`%74hings`), or a `;params` tail (`/state;x=1`) does not match the spec row, so the call takes the request-only label, which can be looser (a PUT the spec calls x comes back w). Seen only in tests, never in live traffic. A consumer that wants the tighter answer should apply its own per-method letter to every `source: 'request'` call (barebox does).
- `tie` is true when several operations (or several sidecars) matched equally well and the tightest was taken.
- Sidecars from rwxmap 0.8.0 on carry a top-level `servers` list. A sidecar without one (written before 0.8.0) makes `matcherFrom` throw, naming the sidecar; regenerate it with 0.8.0 or later. `servers: []` is valid and means `https://<vendor>`.
- Bad sidecars throw at `matcherFrom`. `match` throws only on a URL that is not http(s).

Cost, measured: loading the import is about 1 MB, a 166-operation sidecar adds about 0.1 MB, and a call takes about 7 µs.

</details>

## Status

WIP. Published on npm as `rwxmap`.

The author's Internet-Draft, [An Attenuated Delegation Profile for
Automated Agents](https://datatracker.ietf.org/doc/draft-hamr-oauth-agent-delegation/),
describes how a delegation grant is scoped. rwxmap is not normative in it.

## License

Apache License, Version 2.0 — see [`LICENSE`](LICENSE).
