# Step 3 — the x step

Step 3 is a standalone classifier, like step 1 (r, frozen D74) and step 2
(w, frozen D75). It only ever emits `x`. It never emits `r` or `w` —
`r < w < x`, and step 3 only ever tightens what came before it, never
loosens.

## Two rules

1. **`raise-word`** — a row step 2 claimed with its WORDLESS method floor
   (`applyStep2(row).rule === 'method-floor'`, i.e. a plain PUT/DELETE/PATCH
   with no verb evidence) is raised `w -> x` when one of step 3's own words
   appears among the row's words. This is step 3's only reach into
   PUT/DELETE/PATCH.
2. **`floor-post`** — a row neither step 1 nor step 2 claimed at all becomes
   `x`. This is step 3's floor, and it is also the **named leftover pile**:
   no word fired, only the method is known (in this corpus, always POST —
   steps 1 and 2 between them claim every GET/PUT/DELETE/PATCH row).

Step 2's word claims (`modify-verb`, `modify-verb-summary`) are **final**.
Step 3 never overrides them, even when a raise word is present. A word
beats no word: step 2 read the row's verb and decided `w` on evidence, so
step 3's noun scan may only raise the *wordless* method floor, never a
claim step 2 already supported with a word of its own.

## The word list

`RAISE_WORDS` (17), owned by step 3, copied verbatim, none added or removed:

```
permission membership memberships panelist panelists watcher watchers
participants actor invites invitation invitations sso password grant
disassociate reject
```

These are **role/access nouns, not verbs** — worth saying explicitly, since
the PRD's step 3 sketch calls the mechanism "live verbs." Nothing in this
list is a verb; they name a permission, a membership, a credential, or
someone else's presence in the account.

## Word source

The match source is step 2's exported `wordsForRow(row)` (operationId/path
lead tokens plus summary words) **plus** the row's own path tokens: every
`/`-separated path segment that is not a `{param}` placeholder, run through
step 1's `splitTokens`. Path tokens are added because `wordsForRow`'s path
contribution is only the *lead* token — a raise word further back in the
path (e.g. `/users/{id}/permission`) would otherwise never be seen.

The match itself is a plain **exact match at any token position** — no
stemming, no lead-token restriction. These are nouns, not verbs to be
inflected.

## Pins (measured against `loadRows()` from `../step1/corpus.mjs`, 4171 rows)

- `raise-word`: 19 claimed, 19 truth `x`, 0 false alarms.
- `floor-post` (the leftover pile): 985 rows, every one a POST, truth
  r 33 / w 153 / x 799 (81.1% right); it holds all 186 of the whole flow's
  over-tight rows.
- Whole flow, n=4171: exact 3930 (94.2%), leaks 55 (1.3%), over-tight 186
  (4.5%).
- Emitted-class precision: r 2052 (2049 right, 3 loose-wrong) | w 1115
  (1063 right, 52 loose-wrong) | x 1004 (818 right, 0 loose-wrong).

Run `node poc/step3/proof.mjs` to re-check every number above. Run
`node poc/step3/readout.mjs` for the full tables and to write
`run-proof/step3.csv`.

## Honest limits

- **Fitted, not generalized.** All 19 `raise-word` rows are claimed on the
  corpus the words were read from. Leave-one-vendor-out — the word list
  rebuilt from the other 14 providers for each held-out one — closes only
  6 of those 19, all 0 false alarms, and **all 6 are the single word
  `permission`** (fired on openai and jira, held out from each other).
  The other 16 words each appear in only one provider in this corpus, so
  they never survive being excluded and re-derived from the rest. On a
  genuinely unseen vendor, expect roughly 6 raises, not 19.
- **No clean exam exists.** This corpus is a tuning set (D24): every number
  above is measured on rows the rules were built from, not on a held-out
  exam.
- **Step 3's scan is free in this configuration.** 0 false alarms in both
  the fitted and LOVO readings, so scanning step 2's 902 method-floor rows
  costs nothing here — though that's a property of this corpus, not a
  guarantee for an unseen one (see the LOVO number above).
- **The via-negativa yours-noun rule from the PRD's step 3 plan is
  deliberately not built.** Mining a "these nouns mean it's the caller's
  own thing" allowlist was measured at 9 rows of 380 recovered at 0 leaks —
  too weak to adopt. It is absent because it was tried and rejected, not
  because it was forgotten.
