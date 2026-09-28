---
type: reference
title: rwxmap — PRD
status: stable
---

# rwxmap — PRD

rwxmap reads an API description and gives every operation one letter —
`r`, `w` or `x` — so an agent, a gate or a harness knows what a call does
before it is made. It is a mechanical starting point and the proof of a
bet: that APIs can be made mostly safe mechanically, today, without
waiting for vendors to redesign their methods or for a standards body to
agree on something. It is not a standard and not a conformance harness.
Nobody should trust it 100%: a letter from rwxmap has the status of an
MCP hint, a suggestion the consumer weighs. The residual risk is real,
it is small, and it is stated loudly below rather than engineered away.
Both error directions are marked on every row, so a consumer decides
what to stop on.

History — superseded shapes, rejected candidates, how each decision was
reached — lives in `docs/logs/learnings.md`. Each ruling is a row in
[the decisions log](../wiki/decisions-log.md); a D-number here is the
pointer to its argument.

## Problem & goal

An agent handed an API key gets all of the API or none of it.
Filesystems solved the same problem with chmod — read, write, execute —
and APIs never got an equivalent. The HTTP method is not one: a POST may
be a search, a PUT may send an email, and a GET may change state. The
people who could publish the real answer (the API owner, a standards
body) have not, and an agent calling an API today cannot wait for them.

The goal: grade every operation of an API into the same three letters,
mechanically, so an agent can be given scoped access the way a process
is — read-only here, writes there, never execute — and publish the
grade in the slots the standards agents already read.

rwxmap is the author's own tool first. It also serves as a supporting
proof-of-concept for the author's Internet-Draft (the -02 delegation
profile's `actionClass` axis and declared menu), but it is not
load-bearing for that draft and not normative in it.

## Out of scope

- A model/LLM required to run. The ladder is deterministic and works
  fully on its own. The Jev tiers are optional and run only when a key
  is configured, each moving one direction on its own pile only (D88,
  D95); `jev.js`'s rules are core (D109), because they can move a
  letter.
- A default of `r`, or any guess path.
- Signing. A signature is the Resource Owner's act, never this tool's.
- Being a standard: nothing normative in an Internet-Draft, no third
  standards track, no mandated conformance harness.
- A claim of coverage beyond the vendors actually measured.

## The one invariant and the two error directions

Output classes are ordered `r < w < x`, per the -02 axis ordering. When
the tool does not know, the answer is the tighter class. It never
loosens without evidence. Defaulting to `r` would be fail-open: `r` is
the least restrictive class, so a grant restricted to reads would admit
whatever operation the tool guessed wrong on, including one that cannot
be undone. rwxmap answers every operation with the tightest class it
cannot rule out; it never omits one.

Two error directions, counted and reported separately, never collapsed
into one accuracy number:

| formal term | README word | what went wrong | cost |
|---|---|---|---|
| under-classification (a leak) | **too loose** | the letter is looser than what the call does | security — the go/no-go direction |
| over-classification | **too tight** | the letter is stricter than what the call does | usability — reported, never traded against the other |

Every figure in this document gives both, with counts and the
denominator.

## The definition (D87)

rwxmap and bareguard — the author's agent gate, one file of r/w/x
letters per tool — use one meaning of the three letters, the chmod
reading:

- **r** = read: changes nothing.
- **w** = write: changes things, the caller's own or anyone else's, in a
  way a later write can set back. Sets, edits, creates, toggles,
  archives, pauses, cancels of something that can be resumed. Posting a
  comment or a reaction the same API can delete is w (D98).
- **x** = execute: cannot be undone. Deletes and removals, revokes,
  expires, voids, sends, publishes, charges, pays, refunds, triggers a
  run. A create that also sends, charges or runs is x.
- Unsure → **x**.

"Whose thing is it" is not a class test: it cannot be read reliably
from a spec, because the words for "whose" mean different things per
vendor (D81). Only "what does the call do" is asked.

The labelling brief every truth label is made under is
`data/relabel-2026-09-22/BRIEF-v3.md` (amended by D98).

## The core (frozen)

### What frozen means

Core is the files that can change a row's letter or its review marker
(D109): `src/tokens.js`, `src/step1.js`, `src/step2.js`, `src/step3.js`,
`src/flow.js` (`classifyRow` and `reviewHint`), `src/jev.js`. Changing
any of them needs a new D-number and a fresh clean exam (D24, D96); the
M3 exam (cloudflare, pagerduty, sentry) is burned and cannot score a
change. `src/load.js`, `src/exporter.js`, `src/index.js` and `src/types.js`
(exports and type definitions) are not core, and neither are the coming
discovery, cache, request key, matcher and emitters — they change under
their own tests and proofs, with no exam. In one line: if a change can
move a row's letter or marker, it is core.

### The ladder

Three standalone steps, named by run order, each owning one letter and
its own word lists, then step 2's floor. `src/flow.js` decides only the
order: step 1, step 2, step 3, floor. The first step that claims a row
decides it.

| order | step | claims | rule | evidence |
|---|---|---|---|---|
| 1 | step 1, r | GET, HEAD, OPTIONS | `method` | floor |
| 1 | step 1, r | POST whose lead verb is in `READ_VERBS` | `read-verb` | list |
| 1 | step 1, r | POST with a `SAFE_VERBS` word at any position | `read-verb-anywhere` | list |
| 2 | step 2, x | DELETE, always, `destructive: true` | `method-delete` | floor |
| 2 | step 2, x | POST, PUT or PATCH whose verb is in `CANT_UNDO` | `cant-undo-verb`, `cant-undo-verb-summary` | list |
| 3 | step 3, w | PUT, PATCH | `method-floor` | floor |
| 3 | step 3, w | POST whose verb is in `KEEP_W` | `modify-verb`, `modify-verb-summary` | list |
| last | step 2's floor, x | anything unclaimed: a POST with no word, or any other method | `floor-post` | floor |

**The method floor, as the code has it.**

| method | floor | what can move it |
|---|---|---|
| GET, HEAD, OPTIONS | r | nothing in the mechanical core |
| DELETE | x, `destructive: true` | nothing — DELETE beats every word |
| PUT, PATCH | w | a `CANT_UNDO` verb raises it to x |
| POST | none — decided by its verb | `READ_VERBS`/`SAFE_VERBS` → r; `CANT_UNDO` → x; `KEEP_W` → w; no word → x |
| any other method, or none | x | nothing |

The labelling brief lets a DELETE be w when its text names a trash or
restore; the core does not read description text, so it cannot see
that and calls every DELETE x.

**Precedence.** Method DELETE beats every word. A word beats a floor.
`CANT_UNDO` and `KEEP_W` are disjoint by construction (asserted in the
tests), so steps 2 and 3 never both fire on one row. A POST claimed r
by step 1 is never reached by step 2.

**Word lists, and who owns each.**

| list | owner | size | matched where | moves the row to |
|---|---|---|---|---|
| `READ_VERBS` | step 1 | — | lead token only, after `LEAD_MODIFIERS` (bulk, batch, deprecated, beta, async); the plural-noun guard withholds a match reached only through `-s`/`-es`/`-ies` (D99) | r |
| `SAFE_VERBS` | step 1 | 10 | any token position — only words that are never nouns | r |
| `CANT_UNDO` | step 2 | 29 | the row's verb | x |
| `REMOVES` ⊂ `CANT_UNDO` | step 2 | 6 (delete purge revoke expire void redact) | the row's verb | sets `destructive: true` |
| `KEEP_W` | step 3 | 14 | the row's verb | w |

"The row's verb" (`verbForRow` in `src/tokens.js`) is the lead token of
the operationId, or of the path's last segment when there is no
operationId. When that lead token is a bare HTTP method word (stripe's
`PostCustomersCustomer`), the summary's first real word is used
instead, and the rule is named `…-summary`. `src/tokens.js` holds
readers only, no class list.

List decisions in force: deactivate, change, swap, archive and disable
are off `KEEP_W`, so their POST rows floor at x (D89); `create` is not
on it — it failed the bar at 6.99 fixed per leak against 10; the 13
fragile `CANT_UNDO` verbs stay (D90).

### The four published fields

Every verdict carries `class`, `destructive`, `evidence` and `review`.
The internal `step`, `rule` and `matched` fields exist on the verdict
for debugging and are never published (D28/D76/D77).

- **`class`** — `r`, `w` or `x`.
- **`destructive`** — `true` only inside x, for the `REMOVES` subset
  and every DELETE. On the verdict it is absent rather than `false`;
  the map and the sidecar spell it out as a boolean. It is a refinement
  flag inside x, not a fourth class (D86's ruling on D28).
- **`evidence`** — exactly three values: `floor` (the method alone
  decided, no word matched), `list` (a word list fired), `jev` (an
  optional Jev tier moved the row; appears only when a tier ran). It
  answers "did a word fire", which is a fact about the implementation,
  not a reliability signal: on the M3 exam `floor` was the cleanest
  bucket (5.6% error) and `list` the dirtiest (23.3%), because `floor`
  is mostly GET rows (D101).
- **`review`** — which rows a provider should look at (D101). Derived
  from method + class + evidence and nothing else; its one writer is
  `reviewHint` in `src/flow.js`, and `applyJev` recomputes it through
  the same function when a tier moves a row.
  - `tight` — class x on a POST. Likely tighter than needed; safe to
    review, since no too-loose row has been observed in this bucket.
  - `loose` — class w on a PUT or PATCH decided by the method floor.
    Where most of the too-loose rows live.
  - `settled` — neither of the other two. It is NOT signed or
    confirmed by anyone. A signed state would be a fourth value only a
    human writes after the export; rwxmap never emits it.

The tool emits no confidence score.

### The Jev tiers (optional, D82/D88/D95)

Three independent tiers. Each reads only its own pile of mechanical
verdicts, makes one one-way move, and keeps its own ledger; no two
piles overlap, so no tier can undo another.

| tier | pile (mechanical rule) | move | question | fires at |
|---|---|---|---|---|
| `jev-lower` | `floor-post`, class x | x → w | is this x? | p(x) ≤ 0.10 |
| `jev-raise-wx` | `method-floor`, class w | w → x | is this x? (x-only criteria) | p(x) ≥ 0.80 |
| `jev-raise-get` | `method`, class r | r → w, never x | does anything change? | p(changes) ≥ 0.50 |

`src/jev.js` makes no network call and holds no key: the caller obtains
the model's answer and passes it to `applyJev`. Any bad answer — p not a
finite number in [0, 1], no model string, below threshold — leaves the
verdict untouched: fail closed. A moved verdict records `jev: {p,
model}` so a map never changes silently when the model behind it does.
The criteria text is transcribed verbatim from BRIEF-v3. Opting in means
spec text (method, path, operationId, summary, description) goes to an
outside service, and the adopter must say so.

### Where the code lives

| file | owns |
|---|---|
| `src/tokens.js` | splitter, tokenizer, verb stemmer, `verbForRow`, `LEAD_MODIFIERS`, `METHOD_WORDS` — readers only |
| `src/step1.js` | step 1, r: `READ_VERBS`, `SAFE_VERBS`, the plural-noun guard (D74, D99) |
| `src/step2.js` | step 2, x: `method-delete`, `cant-undo-verb(-summary)`, `floor-post`; `CANT_UNDO` (29), `REMOVES` (6) |
| `src/step3.js` | step 3, w: `method-floor`, `modify-verb(-summary)`; `KEEP_W` (14) |
| `src/flow.js` | `classifyRow` (the order, written once) and `reviewHint` (the one writer of `review`) |
| `src/jev.js` | the three Jev tiers, thresholds, `applyJev`, `needsJev`, `jevState`, `jevQuestions` |
| `src/exporter.js` | the bareguard exporter: `operationsFrom`, `exportGate`, `exportSidecar` |
| `src/index.js` | the package entry: `classifyRow`, `reviewHint`, the Jev exports, the exporter exports |
| `src/types.js` | the `Operation`, `Verdict` and `StepVerdict` typedefs |
| `tools/corpus.js`, `tools/csv.js` | corpus loading and CSV reading, dev only, never shipped |
| `src/load.js` | `loadSpec` (file or URL, JSON or YAML, 64 MB caps, binary refusal, no `$ref` resolution, D106), shipped as `rwxmap/load` (D107), and the only file that imports `yaml` |

`poc/d87/` is the reference `src/` is proved against: `node
poc/d87/proof-src.mjs` compares both over all 6557 rows of the combined
set, must print 0 differences (checked to fail when broken), and
replays the recorded Jev answers through `applyJev` (804 lowered).
`tools/proof-step1.js` still passes after D99 but is blind to the
plural-noun guard, so it does not pin step 1's full behaviour (D99).

Run: `npm test`, `npm run typecheck`, `node poc/d87/proof-src.mjs`,
`node tools/proof-step1.js`.

## Measured results

### The sets

| set | rows | what it is |
|---|---|---|
| tuning pool | 8376 across 36 vendors | `combined-2026-09-21` (6557 rows, 23 providers) + `relabel-buildset-2026-09-23` (1819 rows, 13 vendors), all labelled under BRIEF-v3. Tuning data: the lists were written and priced on it, so every figure it gives reads better than an unseen vendor would (D24, D96). |
| M3 exam | 4279 | cloudflare 3575, pagerduty 465, sentry 239 — three complete official APIs the rules never saw, labelled blind under BRIEF-v3, scored once, burned (D92, D93, D24). **The honest generalization number.** |

### Headline

| set | run | exact | too loose | too tight |
|---|---|---|---|---|
| tuning pool, 8376 | mechanical | 6728 (80.3%) | 82 (1.0%) | 1566 (18.7%) |
| combined, 6557, fitted | mechanical | 5418 (82.6%) | 64 (1.0%) | 1075 (16.4%) |
| combined, 6557, LOVO over 23 providers | mechanical | — | 1.0% (0.0 points off fitted) | 16.8% (0.4 points off) |
| combined, 6557, fitted | + `jev-lower` only, t=0.10 | 94.2% | 72 (1.1%) | 309 (4.7%) |
| **M3 exam, 4279** | **mechanical** | **3520 (82.3%)** | **34 (0.8%)** | **725 (16.9%)** |
| **M3 exam, 4279** | **+ all three Jev tiers** | **3980 (93.0%)** | **22 (0.5%)** | **277 (6.5%)** |

On the 6557 combined rows, v3 truth is r 2712 / w 2378 / x 1467. Of the
64 fitted leaks, 23 sit on list rows and 41 on floor rows (39 of them
the PUT/PATCH w floor); 1036 of the 1075 too-tight rows are on the POST
floor. `jev-lower` alone lowered 804 rows there, 8 of them wrongly (D88).
Step 1 claims 2642 of 2645 rows right on the combined set.

On the exam both error directions fall with Jev; nothing is traded.
cloudflare is 84% of the exam's rows, so the pooled line is never quoted
alone (D92). Per vendor, mechanical:

| vendor | n | exact | too loose | too tight |
|---|---|---|---|---|
| cloudflare | 3575 | 81.8% | 0.9% | 17.3% |
| pagerduty | 465 | 83.2% | 0.4% | 16.3% |
| sentry | 239 | 87.4% | 0.4% | 12.1% |

Per method, M3 exam, mechanical:

| method | n | exact | too loose | too tight |
|---|---|---|---|---|
| GET | 2099 | 2094 (99.8%) | 5 (0.2%) | 0 (0.0%) |
| POST | 892 | 179 (20.1%) | 3 (0.3%) | 710 (79.6%) |
| PUT | 460 | 443 (96.3%) | 14 (3.0%) | 3 (0.7%) |
| DELETE | 558 | 548 (98.2%) | 0 (0.0%) | 10 (1.8%) |
| PATCH | 270 | 256 (94.8%) | 12 (4.4%) | 2 (0.7%) |

710 of the 725 too-tight rows are POST, because an unclaimed POST floors
at x by design — that is the pile `jev-lower` exists to lower. PUT and
PATCH carry 26 of the 34 too-loose rows, all on the wordless floor.

### The Jev tiers on the M3 exam (D100)

A rule that can loosen must get at least 91% of its flags right (the
original 10-leaks-closed-per-false-alarm bar, restated). A rule that can
only tighten, by one step, is adopted when it gets more right than wrong
and worsens neither error type overall (D100).

| tier | direction | rows flagged | correct | verdict |
|---|---|---|---|---|
| `jev-lower` (x→w, t=0.10) | loosens | 522 of 808 | 99.4% (3 became leaks) | PASS, 91% bar |
| `jev-raise-wx` (w→x, t=0.80) | tightens | 11 of 724 | 90.9% (10 of 11) | PASS |
| `jev-raise-get` (r→w, t=0.50) | tightens | 9 of 2099 | 55.6% by label, 77.8% after the D100 rulings | PASS |

`jev-raise-get`'s case rests on 9 flagged rows, 5 right by the labels:
a thin basis, unproven until a fresh exam. The three thresholds were
swept against direct HTTP calls; provider hardening shifted recorded
values by up to 0.17, so routing the calls through a hardened provider
invalidates all three and they must be re-swept. Jev is
non-deterministic: no threshold can be pinned from one run.

### The M3 gate (D89, item 1 replaced by D94)

On the M3 exam, scored once:
1. Too-loose at or under 2% of all rows, every one listed.
2. Too-tight at or under 20% of rows, reported, never traded against
   item 1.
3. LOVO on the tuning set within 2 points of the fitted number for
   every adopted list, or the list is not adopted.

**The M3 gate PASSES on all three items**, measured on this exam.
Item 1 (leaks at or under 2% of all rows): 22 of 4279 (0.5%) with Jev,
34 of 4279 (0.8%) mechanical. Item 2 (over-tight at or under 20%):
277 of 4279 (6.5%) with Jev, 725 (16.9%) mechanical. Item 3 (LOVO
within 2 points of fitted): held, at the LOVO figures in the headline
table above.

### The review markers

Mechanical, no Jev. The tuning-pool rows are the stronger reading; the
exam rows are fitted, because the rule was read off the exam's own
buckets (D101).

| set | marker | rows | exact | too loose | too tight |
|---|---|---|---|---|---|
| tuning, 8376 | `tight` | 2116 (25.3%) | 28.0% | 0 (0.0%) | 1524 (72.0%) |
| tuning, 8376 | `loose` | 1657 (19.8%) | 1601 (96.6%) | 55 (3.3%) | 1 (0.1%) |
| tuning, 8376 | `settled` | 4603 (55.0%) | 98.5% | 27 (0.6%) | 41 (0.9%) |
| M3 exam, 4279 (fitted) | `tight` | 835 (20%) | — | 0 | 710 |
| M3 exam, 4279 (fitted) | `loose` | 724 (17%) | — | 26 | 2 |
| M3 exam, 4279 (fitted) | `settled` | 2720 (64%) | — | 8 | 13 |

`tight` carries zero too-loose rows by construction — it is class x,
the tightest letter — so it is a build-time worklist meaning "review
this to loosen it", not a runtime stop (D103). `loose` is where the
danger is: 55 of the tuning pool's 82 too-loose rows, 26 of the exam's
34. Of the 4603 `settled` rows on the tuning pool, 3999 are pure
method-floor guesses: settled means only that neither marker fired.

### Input shape (D105)

What rwxmap sees changes exactness, not safety. Mechanical:

| input | M3 exam, 4279: exact / too loose / too tight | tuning pool, 8376: exact / too loose / too tight |
|---|---|---|
| full spec (method, path, operationId, summary) | 82.3% / 0.8% / 16.9% | 80.3% / 1.0% / 18.7% |
| method + path | 81.9% / 0.8% / 17.3% | 76.5% / 0.8% / 22.6% |
| method only | 81.1% / 0.8% / 18.1% | 73.9% / 0.9% / 25.2% |

Going without a spec costs exactness, all of it in the too-tight
direction. Method only is the same as dropping every word list: on the
tuning pool it is 6191 exact / 75 too loose / 2110 too tight, and on
the exam 3469 / 34 / 776. So the lists stay: dropping them costs 537
exact rows on the tuning pool to save 7 too-loose rows, and on the exam
saves none while costing 51 (D101).

### Known limits, stated loudly

- **The residual too-loose rate is real.** About one operation in a
  hundred is graded looser than it should be (D105): 34 of 4279 on the
  M3 exam mechanically, 22 of 4279 with Jev. It is published, not
  hidden.
- **The lead-position blind spot.** Word lists match the lead token
  only. On the APIs.guru copies of github, box, stripe and slack, whose
  operationIds are namespace-led or method-led and carry no summary
  verb, no word list fires at all and every row decides on the method
  floor (evidence `list` on 0 rows), while aws-ec2's verb-led ids fire
  260 of 1182. The same blind spot works the other way when a lead verb
  is really a noun: 3 of the M3 exam's 34 too-loose rows sit on
  `evidence: list` rows (3 of 90 list rows) — cloudflare's
  `EvaluateNewWebhook` and `EvaluateExistingWebhook` (step 1 reading
  `evaluate`) and sentry's `addOrganizationMember` (step 3 reading
  `add`).
- **GETs that change state leak.** GET floors at r. A site whose GETs
  change state leaks through that floor (5 of 2099 GET rows on the M3
  exam). `jev-raise-get` is the only thing that can catch them.
- **The review rule is fitted.** D101's `tight`/`loose`/`settled`
  rule was read off the M3 exam; it reproduces on the tuning pool and
  needs a fresh exam.
- **The tuning pool is a tuning set, not an exam** (D24). Its lists were
  written and priced on it.
- **An unknown method floors at x, and `jev-lower` can lower it.** A
  row whose method is none the ladder knows (TRACE, or missing) falls
  to `floor-post` and becomes x with `review: settled`, so it lands in
  `jev-lower`'s pile and a model answer can move it to w. Known, not
  changed: the core is frozen.
- **Spec quality matters.** Descriptions feed only Jev; a spec with
  little text gives Jev little to read.
- **A wrong discovered spec is a known, accepted limit (D117).** No
  request-count, path-count or operation-count test can tell a wrong
  spec from a right one; a "may only tighten" guard was rejected for
  failing the 10:1 bar (4 leaks closed against 213-348 correct letters
  wrongly tightened). A wrong spec that matches no real call is
  harmless; one that collides on an operation is not caught.

## Published output

rwxmap publishes no format for anyone to adopt. It keeps one map of its
own and fills the slot each existing standard already leaves open (D76).
The standards below were read on 2026-09-17; field names, defaults and
schema constraints must be re-checked against the targeted revision
before anything emits, because all four are moving.

### The map

One row per operation, keyed by method + path + operationId, carrying
the four fields:

```json
{
  "rwxmapVersion": "0.1",
  "source": "stripe/spec3.json",
  "operations": [
    { "method": "GET",    "path": "/v1/customers/{customer}", "operationId": "GetCustomersCustomer",
      "class": "r", "destructive": false, "evidence": "floor", "review": "settled" },
    { "method": "POST",   "path": "/v1/customers/{customer}", "operationId": "PostCustomersCustomer",
      "class": "w", "destructive": false, "evidence": "list",  "review": "settled" },
    { "method": "DELETE", "path": "/rest/api/2/filter/{id}/permission/{permissionId}", "operationId": "deleteSharePermission",
      "class": "x", "destructive": true,  "evidence": "floor", "review": "settled" },
    { "method": "POST",   "path": "/chat/completions", "operationId": "createChatCompletion",
      "class": "x", "destructive": false, "evidence": "floor", "review": "tight" }
  ]
}
```

All four are real corpus rows from `data/provider-corpus-2026-09-16/`,
carrying what the tool emits for them today. The fourth is wrong on
purpose: `createChatCompletion` is truth `r`, called `x` because nothing
spoke for it, and `review: "tight"` is how a consumer sees that.

### The bareguard gate file (D91, amended by D103)

bareguard owns the gate, the file format, agent grants (`r--`, `rw-`,
`rwx`), child ≤ parent, deny-by-absence and the `flags` deny primitive.
rwxmap owns the labels and the carriers. bareguard's own spec governs
on any disagreement; this is the copy.

- **Every row is exported.** No row is ever dropped (D103).
- **Keys** are `<vendor>.<operationId>`, dot-separated: bareguard
  matches a `tools` key literally against the harness's action `type`
  and does no namespacing. With no operationId the key falls back to the
  last path segment with braces stripped, then to the lowercased method.
  Two operations on one key keep the tighter letter and are reported as
  a collision, never silently overwritten.
- **An entry** is a bare letter (`"r"`, `"w"`, `"x"`), legal forever, or
  `{ "letter": "w", "marker": "loose" }`, where `marker` is `review`.
  Nothing else goes on a tool entry. The exporter emits the object form
  by default and the bare letter on request.
- **Never emitted:** `flags`, the `agents` section, any deny rule.
  Denial is the human's call at grant time.
- **The sidecar** carries `evidence` and `destructive` for every row, a
  review list (`loose` first, then `tight`), collisions, and the
  `destructive: true` rows as a clearly-labelled suggestion, never as
  config. It is human-facing only; bareguard never reads it (an unlisted
  tool already denies with `rwx.unlisted`).
- bareguard's opt-in `rwx.askOn` knob, default off, reads the marker;
  it is bareguard's design and its default is bareguard's call (D103).
  bareguard never runs rwxmap and never depends on it.

D28's case, "read and reply, never delete", is a grant of `r-x` plus a
`flags.type: deny` rule on the delete action in bareguard's own gate
config, written by the operator.

### Carrier 1 — OpenAPI, per operation

OpenAPI allows `x-` extension keys on any object, including an
operation. rwxmap writes a new file beside the original, never over it
(keep-originals rule; amends the earlier "writes back into the same
file it read"):

```yaml
/v1/accounts/{account}:
  delete:
    operationId: DeleteAccountsAccount
    x-rwx:
      class: x
      destructive: true
      evidence: floor
      review: settled
```

### Carrier 2 — MCP, per tool

Two slots, both the spec's own: `annotations` for MCP's hints, and
`_meta` for rwxmap's fields under a reverse-DNS key prefix (the MCP
2026-07-28 specification names `_meta` as the extension slot; prefixes
whose second label is `modelcontextprotocol` or `mcp` are reserved).

Hints are matched best-effort, not one-to-one (D102, amended by D104).
A hint rwxmap cannot determine is not emitted at all, which is safe
because an MCP consumer defaults an omitted hint to the tightest
reading (`readOnlyHint` false, `destructiveHint` true, `idempotentHint`
false, `openWorldHint` true).

- `readOnlyHint` — true when `class` is `r`, false otherwise.
- `destructiveHint` — `class === 'x'` (D104). It is not rwxmap's
  `destructive` flag, which covers only the `REMOVES` subset and would
  leave 2093 of 3599 predicted-x rows (58.2%) on the tuning pool reading
  like a plain update. The class mapping under-marks 79 rows (0.94% of
  the pool) and over-marks 1565, the safe direction.
- `idempotentHint` — closed, never emitted (D104). Idempotency cannot
  be read off a spec: 11 of the 15 provider specs never mention it, and
  where it appears it is a retry capability the caller may use, not a
  declaration about the operation.
- `openWorldHint` — not emitted. There is no evidence source (D87).

| class | `readOnlyHint` | `destructiveHint` |
|---|---|---|
| `r` | true | — |
| `w` | false | false |
| `x` | false | true |

`_meta` carries all four fields: `class`, `destructive`, `evidence` and
`review` (D110, amending D102's "`review` is not published to MCP").

```json
{ "name": "delete_share_permission",
  "annotations": { "readOnlyHint": false, "destructiveHint": true },
  "_meta": { "io.github.hamr0.rwxmap/class": "x",
             "io.github.hamr0.rwxmap/destructive": true,
             "io.github.hamr0.rwxmap/evidence": "floor",
             "io.github.hamr0.rwxmap/review": "settled" } }
```

`readOnlyHint` rests on step 1, which on the 4171-row provider corpus
claims 2052 rows with 3 wrong in the unsafe direction (0.07% of all
rows) and 33 more marked not-read-only when they are (D74).

The CLI's combined output emits this carrier as the `mcp` dict, keyed
by `"METHOD path"` (D122): each entry holds `operationId`,
`annotations` and `_meta` as above. An MCP server author, or an AI
building one, copies `annotations`/`_meta` per tool from this dict; a
proxy in front of an existing MCP server can merge them into a
`tools/list` reply. Every `mcp` letter equals the `bareguard` letter
for the same operation, since both come from one classification. These
hints are advice, not enforcement — a client may ignore them, and
bareguard is what enforces.

### Carrier 3 — WebMCP, per tool

WebMCP (W3C Web Machine Learning Community Group, Draft Community Group
Report of 2026-04-23) hands tools to the agent through
`navigator.modelContext`. Its `ToolAnnotations` are `readOnlyHint`,
`untrustedContentHint`, `consequentialHint` and `debugging`, with no
`_meta` and no extension slot. Two flags carry all three classes with
nothing left over:

| class | `readOnlyHint` | `consequentialHint` |
|---|---|---|
| `r` | true | false |
| `w` | false | false |
| `x` | false | true |

`consequentialHint` is the closest fit to `x` (cannot be undone) of any
hint in any carrier.

```js
navigator.modelContext.registerTool({
  name: "delete_account",
  annotations: { readOnlyHint: false, consequentialHint: true },
  execute: /* ... */
});
```

### Carrier 4 — Agentic Resource Discovery, per domain

ARD (Google and ten others, published 2026-06-17) has a domain serve
`/.well-known/ai-catalog.json` with `specVersion`, `host` and `entries`,
one entry per whole resource. Per-operation data cannot go inside an
entry: the entry schema sets `additionalProperties: false`, has no `x-`
support, and its one free slot, `metadata`, takes flat scalar values
only. So the map is its own resource, listed beside the OpenAPI
document it describes:

```json
{ "identifier": "urn:stripe:rwxmap",
  "displayName": "Stripe API — rwx map",
  "type": "application/vnd.rwxmap+json",
  "url": "https://stripe.com/.well-known/rwxmap.json",
  "metadata": { "rwxmapVersion": "0.1", "operations": 1309 } }
```

Only two of the four slots are rwxmap's own (OpenAPI `x-rwx`, MCP
`_meta`); in the other two it sets fields the spec already defines.
Today the exporter covers the bareguard file only; no carrier is
emitted yet (see What is next).

## How it runs (D105)

The harness — not a human — fetches, runs rwxmap and starts the gate.
The agent runs with the grant a human set, and there is no human review
step. The grant is the ceiling: nothing rwxmap adds can go beyond what
the human granted. The accepted cost is the published too-loose rate,
roughly 1 in 100.

1. **Spec first, always.** When a run touches a new site, the harness
   asks rwxmap to look for an OpenAPI/Swagger spec at the usual
   locations. The check is forced; there is no option to skip straight
   to per-request mode, because a harness allowed to skip would skip for
   speed and every run would be rougher — equally safe, more asks.
2. **Spec found:** every operation is classified and the whole set goes
   to the gate, keyed `<vendor>.<operationId>`.
3. **No spec found:** that result is cached, and from then on each
   request is classified on its own, before the call, with
   `classifyRow({method, path})`.
4. **Undocumented endpoint on a spec'd site:** a request matching none
   of the spec's operations takes the per-request path too.
5. **No GET special rule.** `classifyRow` already sends GET to r through
   the method floor; the harness carries no second copy of that
   decision.

**The cache** (built, `rwxmap/discover`), owned by rwxmap: one JSON file
per cache key under `opts.cacheDir ?? $XDG_CACHE_HOME/rwxmap ??
~/.cache/rwxmap`, keyed by the API host (or the caller-given spec
address), valid for 30 days AND the same rwxmap version — either one
aging out means a miss. A miss rediscovers and reclassifies from
scratch (D115): mechanical classification is cheap, so there is
nothing to save by reusing it, only the network round trips the cache
already saves. The entry still records the content sha256 and a
Jev model id (null today) against the day Jev runs at classification
time and a model call costs money. "No spec here" is cached too, so a
spec-less site is not probed every run.

**The key normalizer** (built, `rwxmap/discover`'s `requestKey`), owned
by rwxmap: one exported function the harness calls to build the
per-request key for a call without a matched spec operation,
`<host>.<METHOD> <normalized path>` (e.g. `api.example.com.POST
/v1/orders/{id}`). It drops the query string and turns id segments into
`{id}`. Spotting ids is a documented best guess — all-digit segments,
UUIDs, long hex strings — so a map does not grow one entry per order
id. rwxmap is the one writer of that key; the harness never builds it
by hand.

**Who owns what.**

| party | owns | never |
|---|---|---|
| rwxmap | spec discovery, the cache, classification, the key normalizer; returns letters and markers (`{ letter, marker }`) | a decision to allow or deny |
| harness | depends on rwxmap (npm), runs it, feeds the gate, owns the spec-discovery fetch; runs Jev at classification time when a key is configured | lets the agent reach the discovery fetch — that would make "go find the spec" a general-purpose fetcher around the gate |
| bareguard | every allow/deny decision | depends on rwxmap |

With no Jev key the results are mechanical and say so loudly; neither
case stops the run.

**bareguard's `add(entries)`** (bareguard 0.18.0 — bareguard's
primitive, bareguard's design and bareguard's to build; recorded so both
repos agree): tighten-only — a new key is added, and an existing key,
hand-written ones included, can only get stricter (r < w < x), never
looser, and the tighten-only rule covers the marker too; the tools map
only, never the bash map, agents or grants; validated exactly as at
construct time, a bad entry throws and the whole batch lands or none of
it; an `rwx.added` audit line (key, letter, marker) for every add; the
gate copies its rwx config at construct time and `add()` changes that
copy; a size cap on the tools map, past which `add()` refuses that one
batch — nothing from the batch lands, an `rwx.add_rejected` line goes
into the audit log, and the gate keeps working on its existing rules,
with no rebuild (D111, correcting D105's "the gate fails closed and the
harness has to rebuild"); every refused `add()` — a bad entry, an
attempt to loosen, or one over the cap — gets a loud audit line;
callable from harness code only. bareguard 0.17.0 ships unchanged.

**A known property of spec-less sites.** In per-request mode the agent
picks the method and URL `classifyRow` sees, so it can steer a call
toward r by using GET. The only case that actually slips through is a
site whose GETs change state — the same GET-floor leak already accepted
above.

## Where it stands

- **M0** — ground truth and the first arbiter: closed (D29).
- **M1** — the informed arbiter: closed as the mechanical offering, the
  D75/D78 flow, shipped as `rwxmap@0.3.0` (D83).
- **M2** — shape rules, only if justified (D5): no D-row records it as
  opened or closed.
- **M3** — the D87 ladder, the three Jev tiers (D95) and the bareguard
  exporter (D103), in `src/`: the M3 exam is scored and burned (D92,
  D93) and the gate passes (D89 as amended by D94). Released as
  `rwxmap@0.4.0` (2026-09-25).
- **Input and discovery** — `rwxmap/load` (D106, D107) and
  `rwxmap/discover` (D108, D112-D117) released as `rwxmap@0.5.0`
  (2026-09-28).

Module definitions: [module ladder](../wiki/module-ladder-and-shape.md).

## Input and discovery — released in 0.5.0

a. **Input.** Point it at a URL or a file path; JSON or YAML in, JSON
   out. URL fetching uses Node 22's built-in `fetch` (no dependency).
   YAML needs the `yaml` package, a runtime dependency of the I/O
   layer only, allowed by the dependency rule because the standard
   library cannot parse YAML in under 100 lines. The classifier
   library itself stays dependency-free. External `$ref`s are not
   followed (D106); those operations fall back to method+path, and a
   download over 64 MB (compressed or decoded) or binary content is
   refused. Built as `rwxmap/load` (D107); released in `rwxmap@0.5.0`.
b. **Spec discovery** at the usual locations (a best guess, not a
   standard), the 30-day cache, and the per-request key. Released in
   `rwxmap@0.5.0` as the subpath export
   `rwxmap/discover` (D113): `findSpec`, `classifyCall`, `requestKey`,
   `firstServerHost` (D123's vendor default for a local file).
   The discovery order is D108's; no curated list, and no third-party
   directory. It reads OpenAPI and Swagger only; Postman is not read
   (D112). Every discovery request is checked before it is sent — no
   non-https URL, IP-literal host, `localhost` or single-label host,
   checked on the API URL and on every redirect hop and service-desc
   link (D114); such a host gets `status: 'none'`
   uncached, and its calls fall through to per-request classification.
   A cache entry that passes 30 days or a version bump rediscovers and
   reclassifies from scratch rather than reusing the old verdict
   (D115, amends D105 item 2) — mechanical classification is cheap, so
   only the network trip was worth caching. Discovery is limited
   (D116): 3 guessed paths (`/openapi.json`, `/openapi.yaml`,
   `/swagger.json`), at most 3 service-desc links followed per
   api-catalog/Link list, and a 60 s wall-clock budget per `findSpec`
   call (up to one request timeout of overrun) — a live re-run over 25
   vendors cut discovery from 2758 requests to 675, per-site median 97
   to 26, with 0 unsafe requests and the right spec still found for
   intercom.

### Go/no-go for items a and b

No go/no-go bar was set before either item was built — a process gap.
The bars below were written after the fact (2026-09-28), each line
next to the number it was measured against.

**Item a (`rwxmap/load`)**, from "Input pass 3: the loader graduates
as rwxmap/load" (learnings, 2026-09-26) — no bar was set before
building; this reconstructs one from what pass 1-3 recorded:
1. Loaded operations match the labelled corpus exactly — 20 of 20
   sampled vendors, 9,149 operations, 0 missing, 0 extra.
2. `src/load.js` matches the frozen POC byte-for-byte — proof
   722/722 spec files, "All pins hold" (seen red under a swapped
   hash).
3. `import 'rwxmap'` never loads `yaml` — a resolve-hook test (seen
   red with `import 'yaml'` added).
4. A malformed or oversized URL body cannot crash the process — cap
   and binary-check tests (5/5), hubspot's 85 MB gunzip refused in
   1.6 s instead of dying out of heap.
5. A tarball smoke test loads a real spec end to end — figma YAML,
   54 operations.

**Item b (`rwxmap/discover`)**, set after building (2026-09-28), not
before:
1. Zero unsafe requests in a live run — 0 of 675 (D116).
2. A call matched to a discovered spec is never looser than truth in
   the live run — 0 of 165 (intercom).
3. A right spec reachable by the D108 discovery order is found —
   intercom found right.
4. The spec-less cost is bounded and cached — median 26 requests per
   site (D116), cache recheck 0 requests over 3 vendors.
5. bareguard's end-to-end check passes — all items pass (bareguard
   0.18.1).

## What is next

The forward plan for a standalone npm release, in this order: **d,
then c, then e.**

d. **CLI + combined output** (D121, D122, D123): BUILT on
   `docs/post-0.5.0`, not yet released. One command,
   `rwxmap <spec URL | local file | bare API address> [-o <dir>] [--vendor <name>] [--force]`
   (bin `rwxmap`, `src/cli.js`). A local path loads with `loadSpec`. An
   http(s) URL is tried as a spec first (`loadSpec`, at least 1
   operation); if that fails or finds zero operations it is treated as
   a bare API address and `findSpec` runs; nothing found → exit 1,
   writing no file. A URL the caller types is explicit input and is
   fetched as given (D114's exemption for a caller-given spec);
   discovery's own address safety rule (D114) still applies when
   `findSpec` runs. Vendor default (D123, approved 2026-09-28):
   `--vendor` wins; else a URL's own host; else, for a local file, the
   spec's first server host via `firstServerHost`; none → exit 1 asking
   for `--vendor`. Output, in `-o <dir>` (default cwd): `<vendor>.rwxmap.json`
   (`rwxmapVersion`, `source`, `vendor`, `bareguard.tools`, `mcp` keyed
   `"METHOD path"`, D122) and `<vendor>.rwxmap.review.json` (the
   sidecar, also carrying any gate-key collisions as `mcpCollisions`).
   An existing file without `--force` → exit 1, nothing written. Both
   files are written atomically (tmp file plus rename). stdout reports
   the files written, counts by letter, the review count, any
   collisions, and "Jev: off (mechanical)". Mechanical only; Jev is
   wired in with item c.

### Go/no-go for item d — approved 2026-09-28, all bars met

Each bar is checkable by a command (`node tools/proof-cli.js`, exit 0).

1. For every spec file in the tuning and exam spec sets that
   `tools/proof-cli.js` covers, the CLI's `bareguard.tools` deep-equals
   `exportGate` on the same operations: 0 differences. Met — 37 spec
   files, 11,505 operations. (The proof's own bar text once said "722
   files"; that count is the spec *entries* `proof-load` checks, of
   which 685 are digitalocean per-resource fragments and hubspot's
   tar.gz — files with no top-level paths, excluded here the same way
   `proof-match` excludes them.)
2. On those same files, the `mcp` dict has exactly one entry per
   operation (count equals the operation count), and every entry's
   class equals the bareguard letter for that operation: 0 mismatches.
   Met, including the tie-break rule: every gate key holds the
   tightest `classifyRow` letter of its operations — 521 collided
   operations across 178 collided gate keys, all checked. Seen to
   fail: mapping `mcp` x to w gave 3,619 and 3,830 mismatches on two
   independent broken builds; keeping a collided key's looser letter
   gave 143 mismatches.
3. The hint mapping matches D104's table on every row. There's a test
   for each of r, w and x, and the test is seen to fail when the
   mapping is broken by hand. Met.
4. A bare API address with no findable spec exits non-zero and writes
   no file. A load failure (a bad URL, a file over the cap, binary
   content) exits non-zero and writes no file. Output files are
   written atomically. Met — tests cover no spec found, a missing
   file, binary content, an existing file without `--force`, no
   vendor, and atomic-write failure; all exit 1 with no file.
5. No row's letter differs from the library's own classification
   (`classifyRow`, as used by `exportGate`): the CLI adds nothing and
   loosens nothing. Met.
6. One live run of a bare API address that discovery can resolve
   (intercom's API host) writes a JSON whose operation count equals the
   found spec's. Met — `rwxmap https://api.intercom.io` exit 0, found
   via discovery (developers.intercom.com bundle @2.15), 166
   operations, 166 mcp entries, 165 bareguard keys (1 collision), r 84
   / w 23 / x 59, 56 flagged for review. (An earlier discovery-only
   live run the same morning recorded 162 operations for the same URL;
   today's load gives 166 both through `operationsFrom` and a raw
   method+path count. Most likely cause: intercom updated the spec
   during the day; unconfirmed.)
7. The full suite, typecheck and both proofs still pass. Met — npm
   test 348/348, typecheck 0, `proof-load` 722/722, `proof-match` 0
   differences.

c. **Jev** (D118-D120), wired into the CLI: BUILT on `docs/post-0.5.0`,
   not yet released. Key configured → used; no
   key → mechanical, never stops, says loudly which mode ran and shows
   what it knows. rwxmap calls the Jev endpoint itself with plain Node
   `fetch` (D118): a per-request timeout, a retry with backoff on
   429/529 only, no bareagent dependency. The key is read from the
   environment via Node's built-in `process.loadEnvFile()`, no dotenv
   dependency; the variable name is fixed when this item is built. All
   three tiers (`jev-lower`, `jev-raise-wx`, `jev-raise-get`) ship on
   when a key is set (D119). Jev is separate and bring-your-own-key: the
   README and the CLI output both say Jev is optional, the key and cost
   are the adopter's own, and it sends spec text (method, path,
   operationId, summary, description) to an outside service (D120).

### Go/no-go for item c — approved 2026-09-28, all bars met

Design: the key variable is `RWXMAP_JEV_KEY`, read from the environment,
else from `.env` in the current directory via `process.loadEnvFile()`; an
already-set variable wins. With a key, every run prints: "Jev: on — sends
method, path, operationId, summary, description of N operations to
api.typesafe.ai. Your key, your cost." A row whose call fails keeps its
mechanical letter; the run never stops. The combined JSON gets a
top-level `jev: { mode: "on"|"off", model, sent, answered, failed,
changed, tokens: { input, output } }`. Each moved row's `p` and `model`
go into the review file (sidecar). The stdout summary is four lines, percentages over the
operation count:

```
rwxmap: api.intercom.io — 166 operations (r 84 · w 23 · x 59)
rwxmap: settled 110 (66%) · loose 16 (10%) · tight 40 (24%)
rwxmap: Jev: off (mechanical)            | or: Jev: on — 129 sent · 127 answered · 2 failed (kept mechanical) · 31 letters changed · <in> in / <out> out tokens
rwxmap: wrote <vendor>.rwxmap.json + .review.json
```

(settled = trust; loose = may be too permissive, review first; tight =
may be too strict). Collisions, if any, can be one extra line.

Bars: (1) no key → output identical to item d on all 37 spec files
(proof-cli passes) and "Jev: off (mechanical)"; (2) each tier moves only
its own way at its threshold (lower x→w p ≤ 0.10; raise-wx w→x p ≥ 0.80;
raise-get r→w p ≥ 0.50), tested against a stub Jev, each test seen to
fail when broken; (3) a bad answer never moves a letter: NaN, p outside
[0,1], missing model, HTTP error, timeout, malformed JSON, one test each;
(4) only rows in a tier are sent: request count == needsJev count,
checked with the stub; (5) only method, path, operationId, summary and
description (plus the tier question) leave the machine, checked by a
test on each request body, and the key never appears in output, sidecar,
stdout, stderr or error messages; (6) never stops: with every call
failing → exit 0, all letters mechanical, the failed count printed; (7)
after Jev moves rows, every mcp class equals its operation's final
letter, and every bareguard key holds the tightest final letter of its
operations; (8) live: intercom with the real key, run twice; both runs 0
failed; moved rows reported per tier for both runs; no move in the wrong
direction; the request count, time and cost measured and reported (the
orchestrator does this); (9) the suite, typecheck and all three proofs
pass. Not required: the same rows moving on both runs (Jev isn't
deterministic).

**Met.** Bars 1-7 and 9 by test and proof; each bar was broken by hand
once, seen to fail, and restored. The client is `src/jev-client.js` (not
core, D109). `src/cli.js` classifies once, asks Jev only about the rows
`needsJev` names, applies answers through the unchanged `applyJev`, and
hands the final letters to the exporter's `verdicts` option.
`proof-cli` adds a network-free fake-Jev pass over the same 37 files:
9266 of 11,505 operations in a tier's pile, 3287 moved, 0 differences.
`npm test` 386/386, typecheck 0, `proof-load` 722/722, `proof-match` and
`proof-cli` 0 differences.

Bar 8, live (the orchestrator's run). Intercom, 166 operations, 129 sent
per run (raise-get 78, lower 35, raise-wx 16), model `jev-1.13.0`.

| | r · w · x | settled · loose · tight | failed | changed | time |
|---|---|---|---|---|---|
| Mechanical | 84 · 23 · 59 | 110 (66%) · 16 (10%) · 40 (24%) | — | — | — |
| Run 1 | 84 · 41 · 41 | 77% · 10% · 13% | 0 of 129 | 18, all x→w | 12.6 s |
| Run 2 | 84 · 42 · 40 | — | 0 of 129 | 19, all x→w | 9.7 s |

Every move was x→w by the lower tier; no move went the wrong way. The
one row that differed between runs was `POST /contacts/{contact_id}/block`.
The two raise tiers moved 0 rows on intercom. A probe of 2 invented rows
(a GET that archives, a PUT that permanently deletes) came back with the
right answer keys at p 0.95 and 0.96, so the raise tiers can fire. Cost
is counted in tokens only, from the new `jev.tokens` field: a third
live run (after the tokens field was added) used 306,288 input / 2,631
output tokens for 129 rows (about 2,370 in and 20 out per row), 10.3 s,
18 changed, 0 failed; the per-token price is set by the Jev provider
and is not in rwxmap.

Two fixes found in review, both with a test seen to fail when broken:
(1) the exporter's `verdicts` option used to fall back to mechanical
when the list had the wrong length, silently dropping every Jev move
(fail-open); it now throws. (2) Jev token usage is now recorded: each
answered row's `usage` is summed into `jev.tokens: { input, output }`
and printed on the "Jev: on" line; a failed row adds nothing, and usage
never reaches a sidecar row.

e. **Remaining carriers**: OpenAPI `x-rwx`, WebMCP and ARD (MCP moved
   into item d, D122). Re-check all four standards against their
   current revisions before emitting. For OpenAPI output, write a new
   file beside the original, never over it (keep-originals rule); see
   the amended sentence in Carrier 1 below.
f. **Next:** c is built and its bar is met. e needs its go/no-go set
   before it is built.

## Open questions

- **`openWorldHint` has no evidence source.** It is the slot "touches
  others" would map to; it may return as an evidence-only flag beside
  `destructive`, never emitted as false, if a source is ever found (D87).
- **The fresh exam.** Shipping the two raise tiers (`jev-raise-wx`,
  `jev-raise-get`) is settled (D119). A fresh clean exam, drawn from
  vendors no set has seen, is still required for any future change to
  D100's tiers, D101's review rule, or the frozen core.
- **Hand-written MCP tools** (D122). A tool with a name and a
  description but no method or path has no method floor to classify
  from; this needs its own module, its own labelled set and its own
  exam.
- **The lead-position blind spot** is the first post-freeze candidate:
  a fix changes the core, so it needs a new D-number and a new exam.
- **Framework-default spec paths for self-hosted APIs.** Discovery
  guesses only `/openapi.json`, `/openapi.yaml` and `/swagger.json`
  (D116). Framework defaults were probed on public APIs and found 0:
  Spring `/v3/api-docs` (0 on 25 vendors, 0 on the 200-API sample),
  `/v2/api-docs`, .NET `/swagger/v1/swagger.json`, `/api-docs` (0 on
  25 and 0 on 200), `/swagger.yaml`, `/.well-known/openapi.json` (not
  an IANA-registered well-known URI; checked 2026-09-28). Some
  defaults were never probed: `/openapi`, `/v3/api-docs.yaml`, NestJS
  `/api-json`, Django drf-spectacular `/api/schema/`, Laravel
  `/api/documentation`. These defaults are where self-hosted and
  internal APIs serve their spec, and we have no self-hosted sample,
  so the 0s say nothing about them. Add them only after measuring them
  on a self-hosted sample.
