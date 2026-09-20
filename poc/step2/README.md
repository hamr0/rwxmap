# poc/step2 — the w step

Step 2 is the second of three standalone classifiers. It takes the rows
**step 1** (`poc/step1/`, frozen, D74) left behind, claims the ones it can
call `w`, and hands everything else down to step 3. It never assigns `r` or
`x`.

It imports `corpus.mjs`, `csv.mjs`, `words.mjs` and `step1.mjs` from
`poc/step1/`, and nothing at all from `poc/flow/` or `poc/archive/`.

## The two rules

**`method-floor`** — `PUT`, `DELETE` and `PATCH` are `w` by the method
itself. No words involved. 902 claimed, 836 right, 66 leaks.

**`modify-verb` / `modify-verb-summary`** — a `POST` whose verb says the
thing *already exists* is lowered `x -> w`. Two word lists decide it:

- **`MODIFY_VERBS` (24)** — verbs that act on a thing that already exists
  (`cancel`, `archive`, `restore`, `disable`, `update`, `remove`, …). Hand-read
  from the corpus pile by the orchestrator and priced word by word.
- **`OTHER_PARTY` (21)** — role nouns naming someone who is **not** the
  caller (`user`, `member`, `collaborator`, `permissions`, …). If any word of the
  row is one of these, the lowering is **blocked** and the row goes on to step
  3. Blocking is not a classification: step 2 simply declines.

The verb normally comes from the operationId lead token. When that lead token
is a bare HTTP method word — stripe and mailchimp name every operation
`PostSomething`, so the operationId carries no verb — the verb is read from
the summary instead, and the rule is recorded as `modify-verb-summary`.

## What it cost, measured before the code was written

These were measured against the **25-word** gate, before the build and before
the 2026-09-17 trim: they are history, not current. The current POST-rule
figure is **5 leaks of 232 claimed**.

- The modify verb **alone** claims 156 rows with 14 leaks (9.0%).
- Adding the `OTHER_PARTY` gate takes that to **3 leaks**.
- Adding the summary fallback then **doubles the reach**.
- Three verbs were measured and **rejected** for paying most of the leaks:
  `set` (3 leaks), `attach` (2), `finalize` (1). Dropping all three cost 13
  right rows and saved 6 leaks.
- Five `OTHER_PARTY` words written from imagination — `guest`, `guests`,
  `invitee`, `teammate`, `attendee` — appear nowhere in the corpus and were
  deleted before adoption.

## Four gate words removed, 2026-09-17

`customer`, `contact`, `agent` and `person` came out of `OTHER_PARTY`, taking
it from 25 words to 21. Priced in Bash before the edit: `customer` blocks 8
POST rows (all 8 truth `w`), `contact` 5 (all `w`), `agent` 3 (all `w`),
`person` 2 (all `w`) — **18 rows vetoed between them for zero leaks caught.**

They were added because they name a human, and that was the wrong test. The
gate asks *whose data it is*, not whether a person is involved, and your own
customer record, your own contact and your own agent are your data.

Removing them takes reach from **211 to 227** of the 380 truth-w POST rows,
with **leaks unchanged at 5**, and LOVO from 3.4% to **3.2%**. All 16 rows
that moved in `run-proof/step2.csv` went from unclaimed to `w`, and every one
of them is truth `w`.

## How to run

```
node poc/step2/readout.mjs        # every table, and writes run-proof/step2.csv
node poc/step2/proof.mjs          # asserts every pin; "All pins hold." / exit 0
node --test poc/step2/*.test.mjs  # 17 unit tests
```

## The pins

Step 2 inherits **2119** rows from step 1:

| method | n | r | w | x |
|---|---|---|---|---|
| POST | 1217 | 33 | 380 | 804 |
| DELETE | 473 | 0 | 434 | 39 |
| PUT | 345 | 0 | 320 | 25 |
| PATCH | 84 | 0 | 82 | 2 |

Ledger (right = truth w, leaks = truth x, over-tight = truth r):

| rule | claimed | right | leaks | over-tight |
|---|---|---|---|---|
| method-floor | 902 | 836 | 66 | 0 |
| modify-verb | 114 | 113 | 1 | 0 |
| modify-verb-summary | 118 | 114 | 4 | 0 |
| **total** | **1134** | **1063** | **71 (6.3%)** | **0** |

- Step 2 claims **53.5%** of what it inherits.
- The POST rule on its own: **232 claimed / 227 right / 5 leaks**.
- Truth-w POST rows found: **227 of 380** (59.7%).
- Rows left for step 3: **985** (46.5%) — truth `r` 33, `w` 153, `x` 799.
- The 5 POST leaks, exactly: `square BatchChangeInventory`,
  `stripe PostClimateOrdersOrderCancel`, `stripe PostPaymentIntentsIntentCancel`,
  `stripe PostSubscriptionsSubscriptionExposedId`,
  `mailchimp postCampaignsIdActionsCancelSend`.
- Words that never fire on a POST row — kept anyway, an unfired word costs
  nothing: `MODIFY_VERBS` `unpause`, `suspend`; `OTHER_PARTY` `roles`,
  `participant`, `assignee`, `owner`, `recipient`.

## The honest number

**LOVO: 219 claimed / 212 right / 7 leaks — 3.2%.**

For each of the 15 providers in turn both word lists are rebuilt from the
other 14 providers' corpus rows only (a modify verb is kept if it fires as
another provider's row verb; a gate word if it appears in another provider's
row words), then only the held-out provider's POST rows are classified.
Nothing the held-out provider taught is used on it.

**3.2% is the leak rate to expect from the POST rule on a provider the tool
has never seen.** The all-15 fitted figure for the same rule is 5 leaks of
232 (2.2%) — better, and not the number to quote. The `method-floor` rule
uses no words, so it has no LOVO number; its 66 leaks (7.3%) are the same on
seen and unseen providers.

## Whole flow so far

`flow.mjs` runs step 1, then step 2, then a **placeholder floor**: every row
neither step claimed is called `x`. Step 3 is not built; that line is a
placeholder, not a rule — `x` because the invariant says the tighter class
wins when the tool has no evidence.

Over all 4171 rows: **93.8% exact / 1.8% leaks (74) / 4.5% over-tight (186)**.
The over-tight rows are all POST (186 of them, 14.2% of POST) and all sit on
the placeholder floor — they are step 3's job, not step 2's.

Precision per class the flow emits (loose-wrong = the truth is tighter than
what was said, i.e. a leak):

| says | rows | right | loose-wrong |
|---|---|---|---|
| `r` | 2052 | 99.9% | 3 |
| `w` | 1134 | 93.7% | 71 |
| `x` | 985 | 81.1% | 0 |

The `x` column is the step-3 placeholder, so it cannot leak by construction.
