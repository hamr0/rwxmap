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

**M0 result, updated 2026-09-07.** Fourteen shapes were run
(`docs/logs/learnings.md`). On the CAMARA test bed, split into a BUILD half
(30 repos, 140 ops) and a TEST half (30 repos, 152 ops) from E7 on, the
shape E12b (method floor; hand-written tighten-only danger lexicon over
summary, description, operationId and path; hand read-verb list lowering
POST/PATCH to `r` at low confidence; structural markers) has zero wrong
loosenings on both halves, and both negative controls come out `x`. That
score is fitted: the lexicon was written after the E1–E8 failures were
seen. The honest score is the blind hold-out of 2026-09-07
(`data/holdout-2026-09-07/`, 207 Twilio, Stripe and GitHub operations, no
GET, read blind by five agents): E12b leaves 2 wrong loosenings of 207,
both GitHub PUTs (assign an enterprise team to an organisation; merge a
pull request), 0 of 126 on Twilio and Stripe, with 91 over-tightenings.
Forcing DELETE/PUT/PATCH to `x` gives 0 wrong loosenings and 140
over-tightenings, identical to "everything is `x`." The gate as written
(zero wrong loosenings) is met on CAMARA by a fitted shape and missed by
two on the hold-out; whether the gate counts low-confidence lowerings,
and what DELETE/PUT default to, are open decisions listed in §7.

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
the two error counts, keep or discard) recorded in `docs/logs/learnings.md` before the
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

### 4.4 What the method actually promises (M0 finding, 2026-09-06)

Method default vs hand-read ground truth, 292 CAMARA operations:

| method | n | draft default | truth r | truth w | truth x | default too loose | default too tight |
|---|---|---|---|---|---|---|---|
| GET | 96 | r | 96 | 0 | 0 | 0 | 0 |
| POST | 138 | x | 59 | 4 | 75 | 0 | 63 |
| PATCH | 9 | x | 0 | 6 | 3 | 0 | 6 |
| DELETE | 41 | w | 0 | 34 | 7 | 7 | 0 |
| PUT | 8 | w | 0 | 7 | 1 | 1 | 0 |

**The settled part.** RFC 9110 §9.2.1 makes safe a hard guarantee, and it
held on all 96 of 96 GET operations in the test bed. For safe methods the
method default is both a floor and a ceiling: nothing in the hand-read
ground truth ever needed a class looser or tighter than `r` for a GET.

**The contested part.** The -02 draft maps idempotent to `w`. RFC 9110
§9.2.2 idempotence is a statement about repetition only — it says
nothing about consequence. The test bed has 19 operations that are
idempotent and consequential at once, and 17 of those 19 reach a third
party. Terminating a live call is idempotent (calling it twice leaves the
call terminated, same as calling it once) and it is also consequential:
it drops a call a real person is on.

The draft is inconsistent with itself here. The axis registry (anchor
`action-class-values`) names `x` "a consequential, non-idempotent
action," but then defines the class solely as "an operation whose
repetition is not guaranteed to have the same effect as performing it
once." Consequence is in the name and not in the test. Scored against
the literal, idempotence-only reading, the method default leaks 3 times
in 292, all DELETE. Scored against the consequence reading, it leaks 8.
rwxmap adopts the consequence reading (see D16) because its consumers
are agents and guards deciding whether an action needs a human in the
loop, and because MCP already models the two properties as separate
fields — `idempotentHint` and `destructiveHint` — rather than collapsing
them into one.

**The formulation, stated plainly.** The HTTP method gives a floor on
the class and never a ceiling, except for safe methods, where the floor
is also the ceiling. The -02 draft treats the floor as an answer, and
that is the origin of every high-confidence wrong answer M0 found.

### 4.5 Floor from the method, ceiling from the text (supersedes D3)

What the method permits the text signal to do:

| method | RFC 9110 guarantee | floor | text may move the class |
|---|---|---|---|
| GET, HEAD, OPTIONS | safe: no state-changing semantics | r | not at all; locked at r |
| PUT, DELETE | idempotent: repetition is equivalent | w | up to x only |
| POST, PATCH | neither safe nor idempotent; no guarantee | x by policy, not by fact | up or down |

POST is the exception in both directions, and for one reason: RFC 9110
gives no guarantee for POST at all, so its `x` default is a fail-closed
policy choice, not a derived fact. Replacing a policy choice with
evidence read from the document is an upgrade, not a loosening. A safe
method's `r`, by contrast, is a derived fact — it is never revisited.

The arbiter, restated as an ordered procedure:

1. Take the floor from the method.
2. Read the operation's `summary` and `description`, plus structural
   markers present in the document: `callbacks`, a `sink` field in the
   request body, a 409 response indicating a repeat is not equivalent.
3. Evidence of consequence — reaching a third party, moving money,
   acting on a live session, network path, or device, or an effect that
   cannot be undone — raises the class to `x`.
4. For POST and PATCH only, clear evidence that the operation is a pure
   lookup, with no evidence of consequence, lowers the class to `r`.
5. Anything unresolved keeps the floor.

Never lower the class on a safe method, and never lower it below `w` for
PUT or DELETE.

**The shape as of 2026-09-07 (E12b)**

The procedure above, restated as implemented, in order:

- L0 safe method → `r`, high.
- L1 callbacks or sink → `x`, high.
- L2 any danger-verb stem in `summary`, `description`, `operationId` or
  `path` → `x`, high (the lexicon is hand-written, tighten-only, 43
  stems; `poc/m0/lexicon-v2.json`).
- L3 any live-noun stem in the same text, unless the leading verb is a
  read verb → `x` (high if the leading verb is a write verb, else low).
- L4 POST or PATCH whose leading verb is on the hand read-verb list and
  with no 409 response → `r`, low.
- L5 otherwise the method floor, confidence method-only.

Measured weaknesses, one line each:

- Live nouns are vendor-specific and fire on boilerplate (GitHub's
  "personal access tokens" sentence tightened 41 of 81 GitHub
  operations).
- Danger verbs transferred across three vendors but miss danger stated
  without a listed word ("assign a team to an organisation").
- Scanning beyond the operation's own text collapses to "everything x"
  because file-level boilerplate carries the stems.
- There is no path from POST to `w`, so vendors that update through POST
  (Twilio) are over-tightened.
- Vendor extensions such as `x-github.triggersNotification` are
  structural evidence the extractor does not yet read.
- 16 of 94 Twilio operations have no prose at all.

**Confidence.** Every row carries the class plus a confidence, so a
consumer can be configured to act only on high-confidence rows and refer
the rest to a human. The exact formula is still M0's to find; the PRD's
standing constraint holds regardless: the formula must be executable
identically twice by two people.

**The known weakness, stated honestly.** The text signal rests on prose
humans wrote, and that prose is sometimes wrong by omission. The
measured example: ModelAsAService `POST /answer` `queryAssistant` reads
as a lookup, while the assistant it fronts may invoke tools that reach
consumer-registered third-party URLs — a consequence the operation's own
text never mentions. This is why lowering is confined to POST and PATCH,
and is always reported at low confidence.

Operation-level field coverage, measured 2026-09-06:

| document | operations | has description | has callbacks |
|---|---|---|---|
| Stripe | 594 | 99% | 0% |
| Slack | 174 | 100% | 0% |
| CAMARA test bed | 292 | ~100% | 14% |
| Twilio, Stripe, GitHub hold-out | 207 | 92% (16 Twilio ops have no prose) | 0% |

Descriptions are close to universal and are the load-bearing text
signal, whereas `callbacks` is a strong positive marker where it appears
and is absent from most catalogues, so it can support a class but never
a coverage claim.

**Where the work is, by method (M0, 2026-09-07)**

| bucket | ops | method default | truth says | error direction if left at default |
|---|---|---|---|---|
| GET | 96 | r | 96 r | none; closed |
| POST | 138 | x | 59 r, 4 w, 75 x | 63 over-tightenings; never a leak |
| DELETE, PUT, PATCH | 58 | w | 50 w, 8 x | 8 wrong loosenings |

Two problems, not one. The security problem is small and lives entirely
in DELETE, PUT and PATCH: `x` dressed as `w`. The usability problem is
large and lives in POST: `r` dressed as `x`. The first fails the gate;
the second only costs false alarms.

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
- Whether the -02 draft's definition of `x` is amended to name
  consequence in the test and not only in the label (§4.4). This is
  rwxmap's first finding with a consequence for the draft text, and it
  belongs to the justabit track to accept or reject.
- Input adapters beyond OpenAPI. The arbiter is a function of a method,
  a name, and a text; GraphQL (`query` vs `mutation`), gRPC/AIP custom
  methods, AsyncAPI, and MCP tool lists can each feed those three
  through a small adapter, with the method empty where the format has
  none. Deferred until the output contract exists; the MCP tool-list
  adapter is the strongest candidate to go first.
- (open, prices measured 2026-09-07) The `x` definition — readers on all
  499 operations classed permanent deletion of the caller's own resource
  as `w` and any effect on another party as `x`, so "reach beyond the
  caller" matches the ground truth and "cannot be undone" alone would
  flip four CAMARA rows.
- (open, prices measured 2026-09-07) DELETE/PUT default — `w` plus
  lexicon (E12b) versus `x` with a declared menu as the only way down
  (E13): on CAMARA the `x` default costs 17 more over-tightenings of 292
  and buys no leak; on the hold-out it costs 49 more of 207 and buys the
  two GitHub leaks.
- (open, prices measured 2026-09-07) Whether the gate's zero applies to
  all rows or to high-confidence rows only, with the low-confidence leak
  rate reported (on CAMARA E12b makes it moot; on the hold-out both
  leaks are method-floor rows, not lowerings).

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
| D3 | Two mechanical signals (HTTP method per RFC 9110; verb library lookup) and one arbiter: agree → that class, high confidence; disagree → tighter class, low confidence; verb unknown → method default, method-only confidence. No model/LLM tier. **Superseded by D17 (2026-09-06).** |
| D4 | Direction is both: propose loosening (POST → r/w) and tightening (DELETE/PUT → x for destructive verbs). Whether tightening enters the -02 argument is open, pending M0's tighten-case count. |
| D5 | Inputs: method, operationId, path, regex-only to start; OpenAPI shape rules added only in M2, only for a divergence class appearing more than once. |
| D6 | Output: class, confidence, rule id, evidence, plus MCP's four tool-annotation hints mapped from class and method. |
| D7 | Verb corpus: APIs.guru `openapi-directory` (CC0), priors not truth; no corpus size cited until queried live. **Demoted by D18 (2026-09-06).** |
| D8 | Test bed: the 292-operation, SHA-pinned CAMARA set copied to `data/camara-2026-09-01/` (origin `justabit:ietf/v3/poc/spike-a/operations.csv`); known GET-template and 57/138-reader-judgement limits stay stated. |
| D9 | Verb-signal strength varies by catalogue style (CAMARA rich, AIP `:verb` strong, Zalando verb-free weak); go/no-go is not "works everywhere." |
| D10 | Prior art: openapi-mcp is method-only (the gap rwxmap fills); OpenAPI has no operation-level safety field (open issue #2649); unfetched sources are not evidence of absence. |
| D11 | Home: this repo, GitHub remote pending; not a standards track, not normative, not a mandated harness; zero dependencies (`node:crypto` + vanilla JS). |
| D12 | Ground truth for the 292 is read by an agent, one reason per row naming the spec field; the user reviews the divergence list and a random sample of agreements. Decided 2026-09-06. |
| D13 | Test bed lives in this repo at `data/camara-2026-09-01/`: a verbatim copy of `justabit:ietf/v3/poc/spike-a/` (operations.csv, disagreements.md, scripts, README) plus the 92 fetched CAMARA YAML specs under `specs/`, so experiments run against files in this tree, never against justabit. |
| D14 | The r/w/x to MCP-hint mapping is written into §4.3 now as M3's starting table, marked untested. |
| D15 | Module discipline: one module at a time, each works on its own before the next starts; M0 is many numbered experiments, each with a readout, and the winning arbiter shape is picked on the two error counts. |
| D16 | `x` is read as consequence, not merely non-idempotence: an operation that reaches a third party, moves money, acts on a live session, network path or device, or cannot be undone is `x` even when repeating it is equivalent. This diverges from the -02 draft's literal definition of `x` and is M0's proposed correction to that text; see §4.4. Decided 2026-09-06. |
| D17 | Supersedes D3. The HTTP method sets a floor and, for safe methods only, also the ceiling; the operation's own text sets the ceiling elsewhere. Three signals, not two: method, text (`summary`/`description`), and structural markers (`callbacks`, `sink`, 409). Lowering the class is confined to POST and PATCH, where RFC 9110 guarantees nothing; it is never permitted on a safe method and never below `w` on PUT or DELETE. See §4.5. Decided 2026-09-06. |
| D18 | The verb-library plan (D7, M1) is demoted from the primary signal to one input to the text signal. M0 measured that a verb table alone cannot reach the gate: with both signals agreeing on 7 of the 11 remaining wrong loosenings, no table over paths and operationIds can see the consequence those rows carry. Decided 2026-09-06. |
| — | Outline superseded: the outline's three-tier model (deterministic / model / silence) and "no default class, omit on unknown" framing are replaced by D2 and, as of 2026-09-06, by D17 below — a floor from the method, a ceiling from the operation's own text, tighter-on-unknown, no model tier. |
| D19 | Second test set: `data/holdout-2026-09-07/` (Twilio, Stripe, GitHub; 207 ops; SHA-pinned; blind-read ground truth) is kept as a hold-out for honest scoring; CAMARA remains the build bed. Any shape tuned on the hold-out loses that status and the fact is recorded in learnings. Decided 2026-09-07. (pending the user's confirmation) |
