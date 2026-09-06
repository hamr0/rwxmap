<!-- Moved 2026-09-06 from justabit:docs/product/prd-actionclass-classifier-outline.md
     (commit fcca38f). That outline's "actionClass classifier" framing, three-tier
     model, and "no default class" spine are superseded by the decisions recorded
     below. The rewrite that follows is now the working PRD; the outline as filed
     is preserved at commit dbd24d5. -->
# rwxmap — PRD

**Status: DRAFT, 2026-09-06. Not approved. Nothing built.**

## 1. Problem & goal

The -02 draft
(`justabit:ietf/v3/docs/draft-hamr-oauth-agent-delegation-02.xml`, anchor
`classification`) defines two ways a request's `actionClass` gets decided.
Under `classSource` **method**, the class is derived from the HTTP method
alone: GET, HEAD, and OPTIONS default to `r`; PUT and DELETE default to
`w`; POST and PATCH default to `x` (lines 810-816). Under `classSource`
**declared**, a Resource Owner publishes a JWS-signed menu (anchor
`declared-menu`) naming each operation's class explicitly, and where that
menu verifies and matches, "the declared value alone governs, replacing
the method default rather than being compared against it" (lines
826-830).

The method default is a reliable floor in one direction and not the
other. The 2026-09-01 CAMARA catalogue survey in the other repo
(`justabit:ietf/v3/poc/spike-a/`, 292 operations across 60 repositories)
found zero operations judged `x` behind a safe method — the leak
direction is closed. But 57 of 138 POST operations are named as reads
(`retrieve-`, `check-`, `verify-`, `status-`prefixed — the exact predicate
catalogue this project targets: SimSwap `/check`, NumberVerification
`/verify`, `retrieve-location`, KYC match), and every one classes as `x`
under `classSource` method, because POST defaults to `x` regardless of
what the operation actually does.

The declared menu already exists in the spec to fix this. The bottleneck
is that nobody wants to hand-classify hundreds of operations across
dozens of repositories to author the menu in the first place.

**rwxmap is the author's own tool, first.** It reads an OpenAPI document
and draws a map of which operation is `r`, `w`, or `x`, so an agent, a
guard, a harness, or a classic workflow knows what a call does before it
is made, and so a mechanical arbiter outside the auth agent can see what
agents do. It is a discovery tool, not a proof. It also serves as a
supporting proof-of-concept for -02's actionClass axis and declared menu,
but it is **not load-bearing** for that draft or for any CAMARA filing —
it may ship imperfect. It is also useful on its own as a stopgap "upfront"
map when an API owner is slow to publish a declared menu, or has none.

## 2. Go/no-go

Over all 292 test-bed operations against a hand-read ground truth, **no
rule proposes a class below the ground truth.** Zero wrong loosenings.

The two known read-named destructive operations from spike-a's
`disagreements.md` must come out `x`:

- ClickToDial `DELETE /calls/{callId}` `terminateCall`
- WebRTC `PUT /sessions/{mediaSessionId}/status` `updateSessionStatus`

One wrong loosening stops the work at the PRD; the arbiter is redesigned
before anything else is built.

Over-classification (wrong tightening) is counted and reported
separately but does not fail the gate; it is a usability cost.

Second half of the gate, usefulness: a "useful share" of the 138 POSTs
decided as `r` with high confidence. The number is not set in advance —
that would be fitting to pass. M0 reports it and the user judges.

The two error directions are never collapsed into one accuracy number.
Report both counts, every time, as justabit's `docs/logs/findings.md`
already does for leak-direction and usability findings.

## 3. Out of scope

- A model/LLM tier. There is no tier 2 and no tier 3 in this design —
  see §4/D3.
- A default of `r`, or any guess path.
- Signing. Output stops at a candidate map; a signature is the Resource
  Owner's act.
- Anything normative in an Internet-Draft.
- A third standards track.
- A mandated conformance harness.
- A CLI, packaging, or UI before M3 passes.
- A claim of coverage outside the CAMARA test bed.

## 4. Modules

Modules are built one at a time, never the next while the current is
unproven. Every POC result updates this PRD. Never ship the POC;
graduate it.

**M0 — Ground truth + first arbiter run.** Re-read all 292 operations one
by one, both halves (GET and non-GET), one reason per row that names the
spec field it rests on, no template. An agent reads; the user reviews the
divergence list plus a random sample of agreements. Run the two-signal arbiter (§4.1),
regex-only, tighter default. Produce the divergence list: rule vs
reader, one verdict per row — rule wrong / reader wrong / undecidable.
Riskiest assumption: that method plus verb yields a confidence that
separates safe loosenings from unsafe ones on real data. M0 answers the
go/no-go. M0 is exploratory — trying different arbiter shapes is in
scope here and nowhere else in the module ladder. Expect many experiments
in M0. Each one is a numbered POC with its own readout (what was tried,
the two error counts, keep or discard) recorded in the M0 log before the
next one starts, so the shape that wins is chosen on evidence, not on the
last thing tried.

**M1 — Verb library from the corpus.** Pull APIs.guru's
`openapi-directory` (CC0), extract verbs from paths and operationIds with
their method co-occurrence, produce the library as data (priors, not
truth — see D7), re-run M0's arbiter with it, re-read the divergence
list. Riskiest assumption: that corpus priors raise coverage on CAMARA
without adding a wrong loosening.

**M2 — Shape rules, only if justified.** For each divergence class from
M0/M1 that appears more than once, add one deterministic OpenAPI-shape
rule (request body present, response schema, status codes); re-run.
Riskiest assumption: coverage without a new wrong loosening.

**M3 — Output contract + vectors.** The per-operation output (§4.3) with
MCP fields; a frozen labelled vector set including a negative control
(the two destructive read-named operations) so a consumer can check its
own reading of the map. Riskiest assumption: that the MCP mapping is
lossless enough for a real client.

**M4 — Findings entry.** A dated entry in `docs/logs`: what the table
decides, what it cannot, the two error counts, and what that means for
the -02 text. Then decide whether tightening enters the -02 argument
(see D4, open).

### 4.1 The two signals and the arbiter (D3)

**Signal 1 — HTTP method,** per RFC 9110 §9.2.1 (safe: GET, HEAD,
OPTIONS, TRACE) and §9.2.2 (idempotent: safe + PUT, DELETE); POST is
neither. Method defaults follow the -02 draft: GET/HEAD/OPTIONS → `r`,
PUT/DELETE → `w`, POST/PATCH → `x`.

**Signal 2 — the verb** in the path segment or operationId, looked up in
a verb library (e.g. retrieve/check/verify/get/list → `r`;
create/update/register → `w`; send/trigger/terminate/dial → `x` —
illustrative; the library is built in M1, not hand-written here).

**Arbiter:**
- Both signals agree → that class, high confidence.
- They disagree → the tighter class, low confidence.
- Verb unknown → method default, confidence marked method-only.

The confidence line and the exact formula are M0's to find. This PRD
states only the constraint: the formula must be executable identically
twice by two people — "a requirement that cannot be executed the same
way twice is worse than one that is absent."

There is no model/LLM tier. Two outcomes only: a rule fires and names
itself, or the tightest class applies.

### 4.2 Inputs (D5)

Method, operationId, path, and — in a later module only, if the
divergence list justifies it — the OpenAPI shape (request body present,
response schema, status codes). Start regex-only over the three strings;
add a shape rule only for a divergence class that appears more than
once, so every shape rule has a row that justifies it.

### 4.3 Output contract (D6)

Per operation: class (`r`/`w`/`x`), confidence, rule id, evidence (the
matched verb and the method), plus the four MCP tool-annotation fields
`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`,
mapped from the class and the method so any MCP client can consume the
map unchanged.

Starting mapping, untested; M3 verifies it against a real client and may
change it.

| class | readOnlyHint | destructiveHint | note |
|---|---|---|---|
| r | true | false | a read; nothing changes |
| w | false | false | changes state, not destructively |
| x | false | true | consequential or destructive |

`idempotentHint` comes from the method, per RFC 9110 §9.2.2: true for
GET, HEAD, OPTIONS, PUT, DELETE; false for POST and PATCH.
`openWorldHint` stays MCP's default, true; rwxmap has no signal for it.

MCP's own defaults (`readOnlyHint` false, `destructiveHint` true) are
already fail-closed and match §5/D2. MCP's spec text says clients MUST
treat tool annotations as untrusted unless the server is trusted;
rwxmap's map is advisory in the same sense. See
`docs/logs/prior-art-2026-09-06.md`, H1.

## 5. The safety spine

Output classes are `r < w < x`, per the -02 axis-registry ordering
(anchor `action-class-values`: "actionClass is an ordered enumeration
with three values, r, w, and x, ranked r < w < x").

When the tool does not know, or when its confidence is below the set
line, **the answer is the tighter class.** The tool never loosens without
evidence. Defaulting to `r` would be fail-open and a security hole: `r`
is the least restrictive class on the actionClass axis, so a delegation
restricted to reads would admit whatever operation the classifier
guessed wrong on — including a destructive one.

This changes the outline's framing. The outline said "omit the
operation" — that was right for a signed menu a Resource Owner authors,
and is still what a verifier does per the -02 quotes above (on any menu
failure, or on no menu at all, "the verifier MUST fall back to the
method default," and "A verifier MUST NOT construct or synthesize a menu
entry ... on behalf of a resource owner that has not published one,"
anchor `classification`, lines 826-827, 837-839). rwxmap's consumers are
agents and guards that need an answer for every operation, not a
verifier consuming a signed menu, so rwxmap answers with the tightest
class instead of omitting. Both are the same rule: no loosening without
evidence.

Two error directions, counted and reported separately, never collapsed
into one accuracy number:

- **Over-classification** — a rule proposes a class stricter than the
  operation's actual behavior warrants. Cost: usability. A Resource
  Owner who signs an over-classified menu makes their own catalogue
  harder to delegate against than it needs to be.
- **Under-classification** — a rule proposes a class looser than the
  operation's actual behavior warrants. Cost: security. This is the
  failure the safety spine exists to keep out of the trust path.

A single accuracy figure hides the one that matters. Report both counts,
every time, as justabit's `docs/logs/findings.md` already does for
leak-direction and usability findings. This repo's own log starts at M4.

## 6. Direction (D4)

Both directions are in scope. The tool proposes loosening (POST → `r` or
`w`) and tightening (DELETE or PUT → `x` when the verb says destructive,
e.g. `terminateCall`). For the -02 story this means "a menu replaces the
method default in both directions," not only "fixes POST
over-classification." Whether tightening becomes part of the -02
argument or stays a demonstration is open — see §7 — and depends on how
many tighten cases M0 finds.

## 7. Open questions

Non-blocking; never silently assumed.

- Whether tightening enters the -02 argument, or stays a demonstration
  (D4, M4).
- The exact confidence formula and line — M0 finds it.
- The output file format: the -02 declared menu's `{iss, menu}` shape
  (anchor `declared-menu`), or rwxmap's own JSON with a converter.
- The GitHub remote is `hamr0/rwxmap`; visibility (public with a WIP
  marker, like the author's other repos, or private) is decided at the
  first push.

## 8. Notes carried from the outline, stated on purpose

**Verb corpus (D7).** APIs.guru's `openapi-directory` (CC0) is the corpus
for the verb library. The corpus gives priors, not truth: it tells how
often a verb co-occurs with a method; it does not tell what the verb
does. Ground truth comes only from a human reading. Treating corpus
frequency as truth would repeat the templated-GET mistake (see D8
below) at scale. Do not cite a corpus size until it is queried live —
`docs/logs/prior-art-2026-09-06.md` found no live count in the sources
fetched (H6, judgement call).

**Test bed (D8).** The 292 CAMARA operations from
`justabit:ietf/v3/poc/spike-a/operations.csv` (SHA-pinned per-repo).
Copy it into rwxmap with its provenance note in M0. Known limits stay
stated: the GET half was judged by template, not read operation by
operation; the 57-of-138 read-named-POST figure is a reader's judgement,
not a rule output — a fresh prefix pass over `operations.csv` gives 54,
a substring pass gives 43, neither reproduces 57. A rule table built or
checked against these labels inherits both the templated-GET assumption
and a human's unreproducible judgement calls as if they were ground
truth. Both limits are named here, not smoothed over.

**Known limit from prior art (D9).** Zalando guideline rule 141 ("keep
URLs verb-free") and Google AIP custom methods (`:verb` suffix on POST)
mean the verb signal has three strengths by catalogue style: CAMARA-style
verb paths (rich), AIP `:verb` suffixes (exact, strong), Zalando-style
verb-free paths (operationId only; if that is a noun too, method alone,
so POST is `x`). Coverage differs by catalogue. CAMARA is the friendly
case. The go/no-go in §2 must not be read as "works everywhere." See
`docs/logs/prior-art-2026-09-06.md`, H2, H4.

**Prior art (D10).** See `docs/logs/prior-art-2026-09-06.md` in full.
Highlights: `openapi-mcp` (MIT) derives MCP hints from method alone with
no verb signal — that is the gap rwxmap fills (H5). OpenAPI has no
operation-level safety field — `readOnly`/`writeOnly` are schema-property
only, open issue OAI/OpenAPI-Specification#2649 (H8). "Not found in the
sources fetched" is never "does not exist"; the Spectral rules page and
the primary Claude Code permissions page were not fetched (H4, H9).

**Home (D11).** This repo, `/home/hamr/PycharmProjects/rwxmap`, GitHub
remote pending (see §7). Not a third standards track. Not normative in
any draft. Not a mandated conformance harness — ship vectors, never a
harness. Zero dependencies: `node:crypto` and vanilla JS only, per the
author's standing rule; this is the build constraint for when a build
starts, not yet exercised.

**No-go list, carried from the outline, unchanged:**

1. The classifier is not normative and never appears in the
   Internet-Draft. The -02 draft already states in `classification` that
   `classSource` declared is verified against a signed menu, never
   against any implementation's classifier. This tool, if built, is
   tooling around the spec, not part of it.
2. Do not start a third standards track for this. Two tracks already
   exist (CAMARA operator/attestation side, IETF OAuth WG
   agent/delegation side). The natural home for this tool is the OpenAPI
   vendor-extension work alongside CAMARA Commonalities, or a repo of
   its own — not a new submission track.
3. Do not ship it as a mandated conformance harness. This tool assists
   a human who authors a menu, or a guard that consumes a map; it
   never becomes the thing a verifier is required to run.

## 9. Decisions log — 2026-09-06

| # | Decision |
|---|---|
| D1 | Purpose: rwxmap is the author's own discovery tool first (maps r/w/x per operation for agents/guards/harnesses), a supporting but non-load-bearing PoC for -02's actionClass axis, and a stopgap map when a declared menu is absent or slow. |
| D2 | Classes `r < w < x`; safety spine is tighter-on-unknown, never loosen without evidence; changes the outline's "omit on unknown" (right for a verifier consuming a signed menu) to "answer with the tightest class" (rwxmap's consumers need an answer for every operation) — same rule, different consumer. |
| D3 | Two mechanical signals (HTTP method per RFC 9110; verb library lookup) and one arbiter: agree → that class, high confidence; disagree → tighter class, low confidence; verb unknown → method default, method-only confidence. No model/LLM tier. |
| D4 | Direction is both: propose loosening (POST → r/w) and tightening (DELETE/PUT → x for destructive verbs). Whether tightening enters the -02 argument is open, pending M0's tighten-case count. |
| D5 | Inputs: method, operationId, path, regex-only to start; OpenAPI shape rules added only in M2, only for a divergence class appearing more than once. |
| D6 | Output: class, confidence, rule id, evidence, plus MCP's four tool-annotation hints mapped from class and method. |
| D7 | Verb corpus: APIs.guru `openapi-directory` (CC0), priors not truth; no corpus size cited until queried live. |
| D8 | Test bed: the 292-operation, SHA-pinned CAMARA set copied to `data/camara-2026-09-01/` (origin `justabit:ietf/v3/poc/spike-a/operations.csv`); known GET-template and 57/138-reader-judgement limits stay stated. |
| D9 | Verb-signal strength varies by catalogue style (CAMARA rich, AIP `:verb` strong, Zalando verb-free weak); go/no-go is not "works everywhere." |
| D10 | Prior art: openapi-mcp is method-only (the gap rwxmap fills); OpenAPI has no operation-level safety field (open issue #2649); unfetched sources are not evidence of absence. |
| D11 | Home: this repo, GitHub remote pending; not a standards track, not normative, not a mandated harness; zero dependencies (`node:crypto` + vanilla JS). |
| D12 | Ground truth for the 292 is read by an agent, one reason per row naming the spec field; the user reviews the divergence list and a random sample of agreements. Decided 2026-09-06. |
| D13 | Test bed lives in this repo at `data/camara-2026-09-01/`: a verbatim copy of `justabit:ietf/v3/poc/spike-a/` (operations.csv, disagreements.md, scripts, README) plus the 92 fetched CAMARA YAML specs under `specs/`, so experiments run against files in this tree, never against justabit. |
| D14 | The r/w/x to MCP-hint mapping is written into §4.3 now as M3's starting table, marked untested. |
| D15 | Module discipline: one module at a time, each works on its own before the next starts; M0 is many numbered experiments, each with a readout, and the winning arbiter shape is picked on the two error counts. |
| — | Outline superseded: the outline's three-tier model (deterministic / model / silence) and "no default class, omit on unknown" framing are replaced by D2/D3 above — two mechanical signals, one arbiter, tighter-on-unknown, no model tier. |
