<!-- Moved 2026-09-06 from justabit:docs/product/prd-actionclass-classifier-outline.md
     (commit fcca38f). This is the OUTLINE the rwxmap PRD is being shaped from.
     Its "actionClass classifier" framing, three-tier model, and "no default class"
     spine are superseded by decisions recorded in the rwxmap PRD rewrite that
     follows; until that rewrite lands, read this as history, not as the contract. -->
# ActionClass Classifier — outline PRD

**Status: OUTLINE. Not the contract. Not approved. Not started.** This
document records a proposal discussed in one session, for the user to
shape properly next session. `docs/product/prd.md` remains THE contract
for this project — its gates, sequence, and no-go list are unaffected by
anything below. Nothing here has a go/no-go decision, a module ladder, or
a timeline; those are exactly what the next session is for. Treat every
"the tool would" sentence below as a proposal, not a spec.

**Date:** 2026-09-06. **Doctrine:** `CLAUDE.md`, `.claude/remember/AGENT_RULES.md`.

---

## 1. The problem

The -02 draft (`ietf/v3/docs/draft-hamr-oauth-agent-delegation-02.xml`,
anchor `classification`) defines two ways a request's `actionClass` gets
decided. Under `classSource` **method**, the class is derived from the
HTTP method alone: GET, HEAD, and OPTIONS default to `r`; PUT and DELETE
default to `w`; POST and PATCH default to `x` (lines 810–816). Under
`classSource` **declared**, a Resource Owner publishes a JWS-signed menu
(anchor `declared-menu`) naming each operation's class explicitly, and
where that menu verifies and matches, "the declared value alone governs,
replacing the method default rather than being compared against it"
(lines 826–830).

The method default is a reliable floor in one direction and not the
other. The 2026-09-01 CAMARA catalogue survey in this repo
(`ietf/v3/poc/spike-a/`, 292 operations across 60 repositories) found
zero operations judged `x` behind a safe method — the leak direction is
closed. But it also found the cost in the other direction was real: **57
of 138 POST operations are named as reads** — `retrieve-`, `check-`,
`verify-`, `status-`prefixed, the exact predicate catalogue this project
targets (SimSwap `/check`, NumberVerification `/verify`,
`retrieve-location`, KYC match) — and every one of the 57 classes as `x`
under `classSource` method, because POST defaults to `x` regardless of
what the operation actually does
(`ietf/v3/poc/spike-a/README.md`; `docs/logs/findings.md`, 2026-09-01
entries recording the same 57/138 figure).

The declared menu already exists in the spec to fix exactly this. The
bottleneck is not the spec — it is that nobody wants to hand-classify
hundreds of operations across dozens of repositories to author the menu
in the first place. A tool that produces a first-pass classification
would make authoring a menu tractable. This document outlines what such
a tool could be, not what it will be.

## 2. What the tool would be

It reads an OpenAPI specification and produces a **candidate menu** as
JSON for one origin: per operation, a proposed `actionClass`, the rule
that fired, and the evidence for that rule. A candidate menu is a
proposal, not a menu. It becomes a menu, in the -02 sense, only when a
human at the Resource Owner reviews it and signs it. The JWS signature
is what carries the trust (`declared-menu`, "A menu MUST be verified
against the Resource Owner's public key" — the signing key, never the
classifier, is the trust anchor). **The classifier is never in the trust
path.** Nothing it emits reaches a verifier without a human signature in
between.

## 3. The three-tier decision model

In order, each tier only runs on what the tier before it could not
decide:

1. **Deterministic rules.** HTTP method, operation-id prefix, response
   shape. Emits a class and the rule id that fired. This tier is the
   product: reproducible, auditable, diffable — two people running it
   against the same spec get the same answer. Per AGENT_RULES's testing
   principle, "a requirement that cannot be executed the same way twice
   is worse than one that is absent" — this is why tier 1 carries the
   weight and tier 2 does not.
2. **Model proposal.** Only for what tier 1 cannot decide. Emits a
   FLAGGED proposal that cannot reach a signed menu without a human
   acting on it. It shortens a review queue; it never replaces the
   reviewer.
3. **Silence.** Everything else. The operation is **omitted** from the
   candidate menu entirely.

## 4. The safety argument (the spine of this document)

The tool has **no default class and no guess path.**

Defaulting an unknown operation to `r` would be fail-open, and it would
be a security hole: `r` is the least restrictive class on the actionClass
axis (`floors`/`axis-registry`, "ordered set r < w < x"), so a delegation
restricted to reads would admit whatever operation the classifier
guessed wrong on — including a destructive one.

Omission is already the safe answer, because the spec handles it. The
-02 draft states this normatively, and the classifier does not need to
invent a fallback — the fallback already exists upstream of it. Quoted
from `ietf/v3/docs/draft-hamr-oauth-agent-delegation-02.xml`:

> "On any failure of the menu: the menu is absent, its signature does
> not verify, the verifier has no key for the claimed owner, or the
> menu's issuer does not match the request's target as required by
> [declared-menu]; the verifier MUST fall back to the method default
> given above." (anchor `classification`, lines 826–827)

> "A verifier MUST NOT construct or synthesize a menu entry, or a menu,
> on behalf of a resource owner that has not published one." (anchor
> `classification`, lines 837–839)

The method default for POST is `x` (`classification`, line 812). So an
operation the classifier omits — because it fell to tier 3 rather than
being decided at tier 1 or reviewed out of a tier-2 flag — lands at the
most restrictive class by construction, the same place it would land
today with no classifier at all. The classifier can only ever narrow a
menu that a human then signs; it cannot widen what a verifier accepts
in its absence.

## 5. Measurement

Two error directions, counted and reported **separately, never
collapsed into one accuracy number**:

- **Over-classification** — a rule proposes a class stricter than the
  operation's actual behavior warrants. Cost: usability. A Resource
  Owner who signs an over-classified menu makes their own catalogue
  harder to delegate against than it needs to be.
- **Under-classification** — a rule proposes a class looser than the
  operation's actual behavior warrants. Cost: security. This is the
  failure the whole safety argument in §4 exists to keep out of the
  trust path — which is why tier 1 must be conservative enough that
  under-classification, if it happens at all, happens at tier 2 (a
  flagged, human-reviewed proposal) rather than tier 1 (a rule that
  fires silently).

A single accuracy figure hides the one that matters. Report both counts,
every time, the way this repo already reports leak-direction findings
separately from usability findings elsewhere (`docs/logs/findings.md`).

## 6. The proof-of-concept, before any build

Per AGENT_RULES ("POC everything first," "aim the POC at the load-bearing
claim"), any spike here targets the riskiest assumption — that tier 1's
rules do not silently under-classify a destructive operation — not the
easy part (that they correctly label an obvious GET as `r`).

1. Use the 292 operations already gathered in `ietf/v3/poc/spike-a/`
   (`operations.csv`, SHA-pinned, reproducible per the file's own
   provenance note).
2. Hand-label a sample as ground truth, **both halves** — GET and
   non-GET — not just the POSTs (see §7, known limit).
3. Run the rule table against the sample.
4. Measure the two error directions from §5 separately.

A **negative control is mandatory**: feed the classifier operations that
are genuinely destructive but read-named — the exact pattern the
2026-09-01 survey already flagged for the safe-method side (ClickToDial
`DELETE /calls/{callId}` `terminateCall` and WebRTC
`PUT /sessions/{mediaSessionId}/status` `updateSessionStatus`, both
judged stricter than their method default in `disagreements.md`). If the
classifier labels any genuinely destructive, read-named operation `r`,
the rule table is unsafe and the work stops there — per AGENT_RULES, "the
test must be able to FAIL," and a rule table that cannot produce this
negative has not been tested at all.

**The spike-a labels are a reader's judgement, not a mechanical
classification — and that changes what the spike is measuring.** The
`ietf/v3/poc/spike-a/README.md`'s own words for the 57-of-138 figure are
"judgement is one reader's call, not a WG consensus," and this is not
a hedge — it checked out under a fresh attempt to reproduce the number.
A prefix pass over `operations.csv` matching each POST's path segment or
operationId against `retrieve-`/`check`/`verify`/`status` gives **54**;
loosening it to a substring match anywhere in the path or operationId
gives **43**. Neither reproduces 57. The gap is not noise to be
squared away before the spike runs — it is the first thing worth
reading. It is a direct, already-available measure of what a
prefix/substring rule cannot see: some operations a human reader called
a read are not spelled that way in their path or operationId at all, and
some the rule catches, the human reader may have judged differently for
a reason the rule has no access to. **The spike's real output is
therefore not a score against 57 — a rule table that happened to land
on exactly 57 by coincidence would tell us nothing about whether it
agrees with the reader for the right reasons.** The output that matters
is the **divergence list**: which operations the rule and the reader's
judgement disagree on, and why, read case by case the same way the
POST/write side of the original survey already was.

## 7. Known limit, stated on purpose

The GET side of the 2026-09-01 survey was judged by template rather than
read operation by operation — `ietf/v3/poc/spike-a/README.md`'s own
caveat: "the R3 readout below were templated — every GET got the same
boilerplate reason." Any rule derived from that data inherits an
unaudited assumption on the GET half, even though the POST/write side
was read case by case. A rule table built only from the audited half
would be building on data half as solid as it looks. Any spike under §6
must read both halves — this is not cleaned up, it is named so the next
session does not build on an assumption it doesn't know it inherited.

A second, related limit: the survey's judgements are not uniformly
mechanical to begin with. The 57-of-138 read-named-POST figure (§6) came
from a per-operation reading, not from a rule a classifier could run —
a fresh prefix pass over `operations.csv` reproduces 54, a substring
pass 43, neither 57. A rule table trained or tuned against spike-a's
labels inherits a human's unreproducible judgement calls as if they were
ground truth, on top of the templated-GET assumption above. Both limits
are the same class of problem — the data a rule table would be built or
checked against is not as uniformly mechanical as "292 operations,
judged" makes it sound — and both are named here rather than smoothed
over.

## 8. No-go list

1. **The classifier is not normative and never appears in the Internet-
   Draft.** A spec owns the verification procedure; the -02 draft already
   states in `classification` that classSource `declared` is verified
   against a signed menu, never against any one implementation's
   classifier. This tool, if built, is tooling around the spec, not part
   of it.
2. **A model verdict does not compose across a trust boundary.** Per
   this repo's standing finding on rubric/LLM judging, a tier-2 output is
   meaningful only to whoever ran it; a later hop cannot re-derive it.
   This is exactly why tier 2 can never be authoritative and every tier-2
   proposal needs a human signature before it reaches a menu.
3. **A requirement that cannot be executed the same way twice is worse
   than one that is absent.** This is why tier 1 (deterministic, diffable)
   is the product and the model is an assistant to it, never the other
   way round.
4. **Do not start a third standards track for this.** Two tracks already
   exist (CAMARA operator/attestation side, IETF OAuth WG agent/delegation
   side) and cannot be diluted by a third. The natural home for this tool
   is the OpenAPI vendor-extension work alongside CAMARA Commonalities
   (`menu-publication` names an OpenAPI extension plus a detached JWS as
   one publication option), or a repo of its own — not a new submission
   track.
5. **Do not ship it as a mandated conformance harness.** Per this repo's
   standing rule, ship test vectors, never a mandated conformance harness
   — a spec owns the verification procedure, not any one implementation's
   assumptions. The same applies here: this tool assists authoring a
   menu; it does not become the thing a verifier is required to run.

## 9. Open questions — left for the user to settle next session

These are questions, not answers. Nothing below is pre-decided.

- Does the tool live in this repo, or its own?
- Is the output format the declared menu's own JSON payload shape
  (`declared-menu`'s `{iss, menu}` object), or an intermediate format the
  Resource Owner converts before signing?
- Which model, if any, for tier 2 — and does tier 2 exist at all in a
  first version, or does a first version ship tier 1 and tier 3 only?
- How is a reviewer's approval recorded, so an unreviewed tier-2
  proposal cannot leak into a signed menu?
- What is the smallest useful first deliverable?
