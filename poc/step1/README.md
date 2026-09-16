# poc/step1 — the r step

Step 1 of the three-step r/w/x flow, measured over the whole
15-provider corpus (`data/provider-corpus-2026-09-16`, 4171 rows).

Step 1 is a standalone classifier. It claims only the rows it can call
**r** and hands every other row down to step 2 untouched; it never
assigns w or x. It imports nothing from `poc/flow` or `poc/archive` —
the code it needs (`csv.mjs`, the tokenizer and the verb-stem matcher in
`words.mjs`) is copied here and tested here.

## The rule

1. Method `GET`, `HEAD` or `OPTIONS` -> `r`, rule `method`.
2. Method `POST` and the lead verb — after skipping a run of lead
   modifiers (`bulk`, `batch`, `deprecated`, `beta`, `async`) — stem-matches
   a word in `READ_VERBS` -> `r`, rule `read-verb`.
3. Anything else -> not claimed; the row passes down to step 2.

`READ_VERBS` is the 13 words carried over from `poc/flow`'s step 1 list
**minus `verify`**, plus 10 compute/dry-run verbs (`validate`, `evaluate`,
`analyse`, `analyze`, `parse`, `calculate`, `introspect`, `suggest`,
`sanitise`, `sanitize`). `verify` is off the list because it fires 4 times
on POST here and is wrong 3 of those times (meta-whatsapp
`verifyPhoneNumberCode`, meta-whatsapp `verifyPreVerifiedPhoneNumberCode`,
mailchimp `verifyDomain` are all truth w).

## Run it

```
node poc/step1/readout.mjs   # tables + writes run-proof/step1.csv
node poc/step1/proof.mjs     # asserts every pinned number
node --test poc/step1/*.test.mjs
```

## The pinned numbers

Corpus: 4171 rows, 15 providers, 0 missing truth.

| method | n | r | w | x | r-share |
|---|---|---|---|---|---|
| GET | 1960 | 1958 | 1 | 1 | 99.9% |
| POST | 1309 | 124 | 381 | 804 | 9.5% |
| PUT | 345 | 0 | 320 | 25 | 0.0% |
| DELETE | 473 | 0 | 434 | 39 | 0.0% |
| PATCH | 84 | 0 | 82 | 2 | 0.0% |

No HEAD or OPTIONS rows exist in this corpus.

**The r floor:** 1958 of 1960 GET rows are truth r (99.9%). The two
exceptions are `datadog GetGraphSnapshot` (truth x, confidence low) and
`intercom listContactBanners` (truth w, confidence low). GET r-share is
100% for 13 of the 15 providers; datadog 116/117, intercom 107/108.

**Step 1 ledger:**

| rule | claimed | right | leaks |
|---|---|---|---|
| method | 1960 | 1958 | 2 |
| read-verb | 87 | 87 | 0 |
| total | 2047 | 2045 | 2 |

Missed reads (truth-r rows step 1 did not claim): 124 - 87 = **37**, all POST.

**LOVO** (leave-one-vendor-out, the honest generalization number; a mined
word is kept for a held-out provider only if it fires on some other
provider's POST rows, the carried-over 13 always kept): claimed 78,
right 78, leaks 0.

**Per word on POST** (fires / right / providers): search 27/27/4,
get 16/16/3, retrieve 15/15/1, validate 5/5/3, read 4/4/1, list 4/4/3,
calculate 2/2/1, evaluate 2/2/1, fetch 2/2/2, check 2/2/1, find 1/1/1,
analyse 1/1/1, match 1/1/1, parse 1/1/1, sanitise 1/1/1, suggest 1/1/1,
count 1/1/1, introspect 1/1/1. `query`, `lookup`, `assess`, `analyze` and
`sanitize` never fire.
