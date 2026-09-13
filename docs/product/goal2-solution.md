# Goal 2 — the solution as it actually runs today

Naming note (2026-09-13, D64): what this document calls goal 2 is now
step 3 (x); code lives in poc/m1/step3/.

Read from the live code on 2026-09-12 (`c15.mjs`, `c20.mjs`, `c11.mjs`,
`judge.mjs`, `arbiter.mjs`), not from any pass log. This is the spec the
clean rebuild must reproduce. Goal 2 only: truth `x` predicted `w`.

Frozen number to reproduce: **89 goal-2 leaks**, 5465 rows, 332 vendors,
leave-one-vendor-out.

## Input

One row: `method`, `operationId`, `summary`, `description`, `path`,
`vendor`, `gt_class`.

## Step 1 — base classify

Floor by method, then move off it. One direction of travel per method.

| method | floor | allowed move |
|---|---|---|
| GET / HEAD / OPTIONS | `r` | none — no word rule runs |
| POST | `x` | lower only |
| PUT / DELETE / PATCH | `w` | raise only |

**POST.** Lead verb of the operationId stem-matches `READ_VERBS` (14
words) → `r`, rule `read-verb`. Else the `x` floor, rule `floor`.

**PUT / DELETE / PATCH.** Two raise rules, first hit wins.

1. **live-verb** — any operationId token stem-matching `LIVE_VERBS` (26
   words); failing that, the summary's lead verb. Hit → `x`.
2. **party-noun** — three probes against the 43-word hand list:
   summary head noun ∈ `PARTY_NOUNS ∪ SHARED_NOUNS`; else operationId
   head noun ∈ the same; else **any operationId token** (singularised)
   ∈ `SHARED_NOUNS` only. Hit → `x`.

Both rules are suppressed when the summary contains a caller phrase
(`CALLER_PHRASES`, 5 entries: "your ", "authenticated user", …). A
suppressed hit leaves `caller-phrase` in the evidence and falls through.

No hit → the `w` floor, rule `floor`, `floor: true`.

The third probe is the one that bit us: it scans **every** token, not
just the head noun, and only against `SHARED_NOUNS`. It is the only
reason `permission`-in-the-middle rows are caught. Dropping it costs 6
leaks (M1-C26).

## Step 2 — the goal-2 layer

Runs **only** on rows where method is PUT/DELETE/PATCH **and** step 1
returned `w` **and** `floor === true`. Every other row passes through
untouched.

- nouns = { summary head noun, operationId head noun } minus `junkSet`
- nouns non-empty **and** every noun on the yours-allowlist → stay `w`
- otherwise → `x`, rule `no-own-noun`

## The two word lists

| list | size | source | job |
|---|---|---|---|
| `PARTY_NOUNS` + `SHARED_NOUNS` | 32 + 11 = 43 | hand-written | raise in step 1 |
| yours-allowlist | 439 | mined | hold at `w` in step 2 |

14 words are on both and mean opposite things. Step 1 fires first, so
the hand list wins. This is the known design conflict, still open.

Allowlist derivation, once per corpus:
`buildNounTable(allRows)` → `cleanNounTable` (drops stopwords,
non-alphabetic, stem artifacts; yields `junkSet`) → `nounStats`
(per noun: n, w-share over PUT/DELETE/PATCH rows) → `deriveAllowlist(
stats, minN = 2, minW = 0.80)`. For an honest score, rebuilt per vendor
with that vendor's rows excluded (LOVO).

## What is dead

`arbiter.mjs` exports 39 functions; this path uses 6 (`CLASS_ORDER`,
`methodPrior`, `isLockedMethod`, `tokensForRow`, `leadVerbForRow`,
`pathParamKeysForRow`). The other 33 are M0's abandoned seven-layer
arbiter. `judge.mjs` exports 22; this path uses 7.

Five files define their own copy of `METHOD_FLOOR` and their own
variant of step 1: `c15.mjs`, `c18.mjs`, `c19.mjs`, `c26.mjs`,
`derive-nouns.mjs`. They have drifted. Measuring against one copy and
editing another is what produced the 89-vs-95 contradiction.

## Rebuild gate

One module, one copy of step 1, one copy of step 2, one list each.
It must print **89** on the 5465-row corpus under LOVO. Not close —
exactly. If it cannot, the old numbers were not reproducible and that
is the finding.
