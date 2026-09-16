---
type: reference
title: Design notes carried from the outline
status: stable
---

# Design notes carried from the outline

These are notes someone deliberately kept, so they would not be
forgotten or rediscovered later. Each one is a weakness, an aside,
or a caveat, stated on purpose. Nothing here is softened.
(docs/archive/prd.md:587)

## Verb corpus (D7)

APIs.guru's `openapi-directory` (CC0) is the corpus for the verb
library. The corpus gives priors, not truth: it tells how often a
verb co-occurs with a method, not what the verb does. Ground truth
comes only from a human reading. Treating corpus frequency as truth
would repeat the templated-GET mistake (see D8) at scale.
(docs/archive/prd.md:589-594)

Do not cite a corpus size until it is queried live —
`docs/logs/prior-art-2026-09-06.md` found no live count in the
sources fetched (H6, judgement call).
(docs/archive/prd.md:594-596)

## Test bed (D8)

The test bed is 292 CAMARA operations from
`justabit:ietf/v3/poc/spike-a/operations.csv` (SHA-pinned
per-repo), copied into rwxmap with its provenance note in M0.
(docs/archive/prd.md:598-600)

Known limits stay stated on purpose:
- the GET half was judged by template, not read operation by
  operation
  (docs/archive/prd.md:600-602)
- the 57-of-138 read-named-POST figure is a reader's judgement, not
  a rule output; a fresh prefix pass over `operations.csv` gives 54,
  a substring pass gives 43, and neither reproduces 57
  (docs/archive/prd.md:602-604)
- a rule table built or checked against these labels inherits both
  the templated-GET assumption and a human's unreproducible
  judgement calls as if they were ground truth
  (docs/archive/prd.md:604-607)

Both limits are named here, not smoothed over.
(docs/archive/prd.md:607)

## Known limit from prior art (D9)

Zalando guideline rule 141 ("keep URLs verb-free") and Google AIP
custom methods (`:verb` suffix on POST) mean the verb signal has
three strengths by catalogue style:
(docs/archive/prd.md:609-611)

- CAMARA-style verb paths: rich
- AIP `:verb` suffixes: exact, strong
- Zalando-style verb-free paths: operationId only; if that is a
  noun too, method alone decides, so POST is `x`
  (docs/archive/prd.md:611-614)

Coverage differs by catalogue. CAMARA is the friendly case. The
go/no-go in section 2 must not be read as "works everywhere." See
`docs/logs/prior-art-2026-09-06.md`, H2, H4.
(docs/archive/prd.md:614-616)

## Prior art (D10)

See `docs/logs/prior-art-2026-09-06.md` in full.
(docs/archive/prd.md:618)

Highlights:
- `openapi-mcp` (MIT) derives MCP hints from method alone with no
  verb signal — that is the gap rwxmap fills (H5)
  (docs/archive/prd.md:618-620)
- OpenAPI has no operation-level safety field — `readOnly` and
  `writeOnly` are schema-property only, open issue
  OAI/OpenAPI-Specification#2649 (H8)
  (docs/archive/prd.md:620-622)
- "Not found in the sources fetched" is never "does not exist"; the
  Spectral rules page and the primary Claude Code permissions page
  were not fetched (H4, H9)
  (docs/archive/prd.md:622-624)

## Home (D11)

This repo, `/home/hamr/PycharmProjects/rwxmap`, GitHub remote
pending (see section 7). Not a third standards track. Not
normative in any draft. Not a mandated conformance harness — ship
vectors, never a harness.
(docs/archive/prd.md:626-629)

Zero dependencies: `node:crypto` and vanilla JS only, per the
author's standing rule. This is the build constraint for when a
build starts, not yet exercised.
(docs/archive/prd.md:629-631)

## No-go list, carried from the outline, unchanged

1. The classifier is not normative and never appears in the
   Internet-Draft. The -02 draft already states in
   `classification` that `classSource` declared is verified
   against a signed menu, never against any implementation's
   classifier. This tool, if built, is tooling around the spec,
   not part of it.
   (docs/archive/prd.md:635-639)

2. Do not start a third standards track for this. Two tracks
   already exist (CAMARA operator/attestation side, IETF OAuth WG
   agent/delegation side). The natural home for this tool is the
   OpenAPI vendor-extension work alongside CAMARA Commonalities,
   or a repo of its own — not a new submission track.
   (docs/archive/prd.md:640-644)

3. Do not ship it as a mandated conformance harness. This tool
   assists a human who authors a menu, or a guard that consumes a
   map; it never becomes the thing a verifier is required to run.
   (docs/archive/prd.md:645-647)
