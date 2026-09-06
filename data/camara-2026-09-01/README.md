> **Provenance, second move.** Copied verbatim into rwxmap on 2026-09-06
> from `justabit:ietf/v3/poc/spike-a/` at justabit commit 9c731f2 (the CSV
> last changed in justabit commit 198d971), together with the 92 fetched
> CAMARA YAML specs that the first move omitted, restored under `specs/`
> from the justabit session's research directory. Nothing was edited.
> `operations.csv` sha256
> cf65035f64aca81116a9aa5af239144c46f9f56aa693983044afd281dda1b558.
> rwxmap's experiments run against these files only; the note below about
> `specs/` being omitted no longer applies here.
>
> **Provenance.** This dataset was run 2026-09-01 in a session scratchpad
> and moved into the repo on 2026-09-01 by user decision. The `specs/`
> directory (65 fetched CAMARA YAML copies, ~4 MB) was omitted on the
> move — every file it held is SHA-pinned in `operations.csv` and
> `repos.json`, so it is reproducible from those columns rather than
> carried as a binary copy. The "this scratchpad directory" reference
> below no longer applies; everything here now lives at
> `ietf/v3/poc/spike-a/`.
>
> **Caveat (recorded in `docs/logs/findings.md`).** The GET judgements
> behind the R3 readout below were templated — every GET got the same
> boilerplate reason — so "no `x` behind GET" rests on CAMARA Design
> Guide §6.5 rather than a per-operation reading. Separately, the cost
> side was never audited: 57 of the 138 POSTs (named `retrieve-*`/
> `check`/`verify`/`status` — the predicate catalogue this project
> targets) default to `x` under the method rule, and that cost was not
> reviewed by the agent's own report.

---

# Spike: does an `actionClass` default-from-HTTP-method hold on real CAMARA APIs?

Spike date: 2026-09-01. READ-ONLY against the `justabit` repo tree
(confirmed clean at the end — see below). All output lives under this
scratchpad directory.

## Readout

**R2** — some operations were judged `x` when the method default was `w`
(idempotent PUT/DELETE), and the "declare to tighten" mechanism is exactly
designed for that case. **R3 did not occur**: zero operations judged `x`
were found behind a safe method (GET/HEAD/OPTIONS), across all 96 GET
operations in the 60 CAMARA API repos that have published OpenAPI YAML.

The method default is **sound as measured on this catalogue**: no CAMARA
API currently hides a consequential (`x`-class: sends a message, moves
money, changes subscriber/device state, creates a subscription/webhook,
triggers a live network action) operation behind a safe method. The two
tightening cases found (below) are both PUT/DELETE -> judged `x`, which is
the path the proposal's own "declare a tighter class, never looser" rule
was built to handle.

## Totals

```
Repos in camaraproject org (gh repo list):            95
Active (non-archived):                                 90
Repos with code/API_definitions/ present:               70
  of which test/template scaffolding (excluded):         5  (CommonalitiesTest, ReleaseTest,
                                                              Template_API_Repository,
                                                              test-repo-w-linting, test-repo-wo-linting)
  of which real API-catalogue candidates:                65
    of which zero .yaml/.yml files present yet:           5  (EdgeCloud, QoSProfiles,
                                                              RainfallIntensity, VoiceNotification,
                                                              VoiceVerificationCode — incubation-stage,
                                                              directory scaffolded, only README.MD/.DS_Store)
    of which contributed >=1 parsed operation:            60

YAML spec files fetched:                                92
YAML parse errors:                                       0

Total operations parsed:                               292
  GET:      96   (default r)
  PUT:       8   (default w)
  DELETE:   41   (default w)
  POST:    138   (default x)
  PATCH:     9   (default x)

Default class counts:   r=96  w=49   x=147
Judged class counts:    r=96  w=47   x=149

Stricter-than-default (any tightening):                  2
  x behind a safe method (R3 table):                      0
  w behind a safe method:                                 0
  x behind PUT/DELETE (R2, designed path):                2
    - ClickToDial DELETE /calls/{callId} terminateCall
    - WebRTC PUT /sessions/{mediaSessionId}/status updateSessionStatus
Looser-than-default (judged class weaker than default):  0
```

## R3 table (would be here if non-empty — it's empty)

See `disagreements.md` section 1. Zero rows.

## Exact commands used

```
gh repo list camaraproject --limit 200 --json name,isArchived > repos.json

# per-repo existence check of code/API_definitions/
gh api "repos/camaraproject/<repo>/contents/code/API_definitions" --jq '[.[].name] | length'

# per-repo commit pin + file list + download
gh api "repos/camaraproject/<repo>/commits/HEAD" --jq .sha
gh api "repos/camaraproject/<repo>" --jq .default_branch
gh api "repos/camaraproject/<repo>/git/trees/<sha>?recursive=1" \
  --jq '.tree[] | select(.path | startswith("code/API_definitions/")) | select(.path | test("\\.ya?ml$")) | .path'
curl -sf "https://raw.githubusercontent.com/camaraproject/<repo>/<sha>/<path>" -o <outfile>
```
Full scripts: `check_repo.sh`, `fetch_repo.sh`, `parse.py` (mechanical
`default_class` from method + OpenAPI `paths:` walk), `judge.py`
(judgement pass + overrides + counts), all in this directory.

## Skipped repos and why

**No `code/API_definitions/` directory at all (20, non-API/meta repos):**
APIBacklog, camara-landscape, camaraproject.github.io, Commonalities,
ConnectivityQualityManagement, EasyCLA, EnergyFootprintNotification_PI,
.github, Governance, IdentityAndConsentManagement, IoTNetworkOptimization_PI,
Marketing, MCPEnablement_PI1, project-administration, QualityOnDemand_PI1,
QualityOnDemand_PI2, QualityOnDemand_PI3, ReleaseManagement,
Template_PI_Repository, tooling.

**Has the directory but is test/template scaffolding, not a real catalogue
API (5, excluded on inspection):** CommonalitiesTest, ReleaseTest,
Template_API_Repository, test-repo-w-linting, test-repo-wo-linting.

**Has the directory, zero `.yaml`/`.yml` files committed yet (5,
incubation-stage — genuinely nothing to parse, not a fetch failure):**
EdgeCloud, QoSProfiles, RainfallIntensity, VoiceNotification,
VoiceVerificationCode. Verified directly: their `code/API_definitions/`
contains only `README.MD` (or, for EdgeCloud, a stray `.DS_Store`).

**Archived repos (5, skipped per instructions):** SiteToCloudVPN,
ShortMessageService, HomeDevicesQoD, TestRepo, WorkingGroups.

No `gh` rate-limiting was encountered; all 65 real candidate repos were
checked and all 60 with published specs were fully fetched and parsed.

## What this spike does NOT prove

- **Not exhaustive over method+judgement space.** The judgement pass in
  step 4 concentrated scrutiny on GET (all 96, for R3) and PUT/DELETE (all
  49, for R2/the w-behind-GET check). POST/PATCH operations (147, already
  `x` by default) were tabulated and skimmed but not individually
  second-guessed for a downward (looser-than-default) judgement — a POST
  that turns out to be a harmless read-shaped operation misclassified as
  `x` would be a cost/UX finding, not a safety finding, and this spike does
  not claim to have found all such cases (it claims to have found none in
  a targeted pass, not to have exhaustively hunted for them).
- **Not a live-behavior test.** Judgement is from `summary`/`description`/
  request-response *shape* in the OpenAPI YAML, not from calling the live
  API and observing actual side effects. A spec's prose can undersell or
  oversell true behavior; this spike trusts the spec text as the
  best-available signal, which is a real limitation for a working-group
  proposal that will eventually need implementer self-attestation anyway.
- **Not a legal/complete reading of every field.** For each operation the
  summary and (truncated to 600 chars) description were read; very long
  descriptions, deeply nested request/response schemas, and webhook/
  callback bodies were not fully parsed line-by-line for hidden triggers
  (e.g. a callback schema that itself declares a further side-effecting
  call). The `MediaSessionStatusChange` / `terminateCall` findings were
  caught because they were flagged on a targeted follow-up read, which
  means a similarly-hidden case elsewhere could exist unflagged.
- **Not a sample of unpublished/private CAMARA work.** Only what is public
  on the org's default branches, at the commit SHAs recorded in
  `operations.csv`, on 2026-09-01, was examined. wip-version specs
  (`info.version: wip`) are included — several repos are pre-release.
  A repo can add a new operation, or change an operation's true behavior
  without changing its method, at any point after these SHAs.
- **Two findings is a small base rate.** 2 tightening cases out of 49
  PUT/DELETE operations (4%) is not enough to generalize a rate; it is
  enough to establish that the tightening mechanism is load-bearing (not
  hypothetical) and that the two cases share a pattern — live, real-time,
  third-party-affecting telephony/session control hidden behind PUT/DELETE,
  both in the telephony-adjacent repos (ClickToDial, WebRTC). Anyone
  extending the axiom to a new telephony/real-time-media repo should
  specifically re-check for this pattern.
- **Judgement is one reader's call, not a WG consensus.** The two flagged
  operations and their reasons are stated plainly in `disagreements.md` so
  they can be independently checked, disputed, or overturned.

## Files

- `operations.csv` — every operation (292 rows): repo, file, version, sha,
  path, method, operationId, default_class, judged_class, reason.
- `disagreements.md` — R3 table (empty) first, then x-behind-PUT/DELETE (2
  rows), then w-behind-GET (empty), then looser-than-default count (0).
- `README.md` — this file.
- Supporting/intermediate: `repos.json`, `active_repos.txt`,
  `api_repos.txt`, `skipped_repos.txt`, `final_repos.txt`, `check_repo.sh`,
  `fetch_repo.sh`, `fetch_results.txt`, `fetch_errors.log` (empty),
  `specs/<repo>/*.yaml` + `.sha` (raw fetched files, one dir per repo),
  `parse.py`, `operations_raw.csv` (pre-judgement), `judge.py`,
  `summary_counts.json`.
