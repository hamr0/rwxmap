# exam4-2026-09-12

**WARNING (2026-09-14):** this set is NOT a virgin draw. 316 of its 318
providers (all but apidapp.com and openlinksw.com) and 2702 of its 4000
rows are the same corpus operations as exams 2 and 3 (593 from exam 2,
2109 from exam 3), plus 1298 more rows from the same burned providers.
Cause: the exclusion script compared registrable provider names against
raw corpus vendor tokens, which never matched for the full-string tokens
exams 2/3 use, so its own "intersection must be 0" self-check passed
while comparing the wrong things. Any scoring or truth-drift finding
made against this set before 2026-09-14 is void as a generalisation
number. See `docs/logs/learnings.md`, "Exam 4 was never virgin; frozen
shape scored, per-set stability measured (2026-09-14)".

Fourth virgin blind exam, drawn 2026-09-10. Set name (`exam4-2026-09-12`)
follows the exams 1-3 naming convention and is not the draw date.

- **Script:** `poc/m1/arbiter/make-exam4.mjs`
- **Seed:** 20260912 (mulberry32; distinct from exam-1's 20260909, exam-2's
  20260910, exam-3's 20260911)
- **Rows:** 4000
- **Distinct providers in the draw:** 318
- **Methods:** PUT/DELETE/PATCH only (same as exams 2 and 3), method split
  PUT=1582, DELETE=1842, PATCH=576
- **Source pool:** `data/corpus/apis-guru-ops.csv.gz` (same as exams 1-3)

## Exclusion rule

Excludes every provider that appears anywhere in the 5465-row combined
corpus (all 8 sets loaded by `loadCombinedCorpus()` in
`poc/m1/arbiter/c19.mjs`: camara, holdout1, holdout2, holdout3, holdout4,
holdout5, exam2, exam3 — 332 distinct provider tokens), UNION every
provider in exam-1's blind file (`data/exam-2026-09-09/exam-blind.csv`,
105 provider tokens, not part of `loadCombinedCorpus` but still burned).
The two sets fully overlap (105 of 105 exam-1 tokens are already inside
the 332), so the union is 332 tokens, not 437.

Matching is by registrable domain name (not substring), case-insensitive,
with a small multi-label-suffix table (co.uk, gov.uk, etc.) and the
`amazonaws -> amazon` alias — copied verbatim from `make-exam3.mjs` to
avoid the earlier substring bug that stripped ~50 innocent providers
(names like "box" and "x").

Pool before exclusion: 123339 rows / 673 providers. Pool after exclusion:
92409 rows / 663 providers. Eligible pool after also restricting to
PUT/DELETE/PATCH: 21643 rows / 318 providers. Cap search landed at 22
rows/provider. Rows left unused in the eligible pool after this draw:
17657.

A computed intersection check confirms zero of the 318 drawn providers'
registrable-name tokens collide with the 332-token burned set.

## Status

Exam 4 is unlabelled and unscored as of this commit — it is virgin
material reserved for scoring the C22 `allowlist-wins` layer and an
upcoming PARTY_NOUNS cleanup pass.
