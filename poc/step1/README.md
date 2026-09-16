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
3. Method `POST` and **any** token of the name stem-matches a word in
   `SAFE_VERBS` -> `r`, rule `read-verb-anywhere`. Lower priority: a row only
   reaches it when rule 2 did not claim it.
4. Anything else -> not claimed; the row passes down to step 2.

`READ_VERBS` is the 13 words carried over from `poc/flow`'s step 1 list
**minus `verify`**, plus 10 compute/dry-run verbs (`validate`, `evaluate`,
`analyse`, `analyze`, `parse`, `calculate`, `introspect`, `suggest`,
`sanitise`, `sanitize`). `verify` is off the list because it fires 4 times
on POST here and is wrong 3 of those times (meta-whatsapp
`verifyPhoneNumberCode`, meta-whatsapp `verifyPreVerifiedPhoneNumberCode`,
mailchimp `verifyDomain` are all truth w).

`SAFE_VERBS` is the 10 compute/dry-run verbs only — read verbs that are never
nouns in an API name, so they can be matched at any token position. The full
`READ_VERBS` list cannot be read this way: `list`, `get`, `count` and `check`
are object nouns as often as verbs, and matching the full list anywhere scores
31 leaks instead of 0 (mailchimp `postLists`, `postListsIdMembers`, and 18
more).

**The price of rule 3, accepted by the user on 2026-09-16.** It claims 5 rows,
4 right, **1 leak** — stripe
`PostPaymentMethodDomainsPaymentMethodDomainValidate` (truth w, confidence
low; validating a payment method domain stores the result). All 4 gains are
digitalocean (`apps_validate_appSpec`, `apps_validate_rollback`,
`registries_validate_name`, `registry_validate_name`). Under LOVO the rule is
83/82/1 against the previous 78/78/0 — the leak generalizes, the gains do not.
Adopted anyway, deliberately, on the user's explicit decision: 4 right rows
bought for 1 leak.

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
| read-verb-anywhere | 5 | 4 | 1 |
| total | 2052 | 2049 | 3 |

Of the 2082 truth-r rows in the corpus, step 1 finds 2049 (98.4%). Missed
reads (truth-r rows step 1 did not claim): 124 - 87 - 4 = **33**, all POST.

**LOVO** (leave-one-vendor-out, the honest generalization number; both lists
are rebuilt per held-out provider — a `READ_VERBS` word is kept only if it
fires on some other provider's lead token, the carried-over 13 always kept; a
`SAFE_VERBS` word only if it fires on any token of some other provider's POST
rows): claimed 83, right 82, leaks 1.

**Per word on POST** (fires / right / providers): search 27/27/4,
get 16/16/3, retrieve 15/15/1, validate 5/5/3, read 4/4/1, list 4/4/3,
calculate 2/2/1, evaluate 2/2/1, fetch 2/2/2, check 2/2/1, find 1/1/1,
analyse 1/1/1, match 1/1/1, parse 1/1/1, sanitise 1/1/1, suggest 1/1/1,
count 1/1/1, introspect 1/1/1. `query`, `lookup`, `assess`, `analyze` and
`sanitize` never fire.

**Per word on the anywhere rule** (POST rows the lead rule left behind):
validate 5/4/2 (digitalocean, stripe). No other `SAFE_VERBS` word fires there.
