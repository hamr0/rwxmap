# M1-C16 sweep: description reach-phrase raise pass (goal 2) vs c15

Measurement only — nothing here is adopted. c16 = c15 + one extra
raise-only pass on PATCH/DELETE/PUT rows whose description matches a
small hand-derived phrase list (see poc/m1/arbiter/c16.mjs).

Phrase list (3): "notification will be sent", "organization-level", "shareable link"

Total labelled rows: 1478.

## 1-2. Baseline (c15) vs with c16, all 1478 labelled rows

| configuration | n | exact | goal2_leaks (truth x, pred w) | goal1_errors (truth w, pred x) |
| --- | --- | --- | --- | --- |
| c15 (baseline) | 1478 | 1247 | 10 | 178 |
| c16 (c15 + reach-phrase) | 1478 | 1250 | 7 | 178 |

## 3. Leave-one-vendor-out transfer (the important one)

9 tuned-set PATCH/DELETE/PUT rows are c15 goal-2 leaks (truth x, c15 says w). They belong to 5 vendors: camara, discord, github, notion, vercel.

For each such vendor, the phrase list is rebuilt using only the other
vendors' contributions (PHRASE_SOURCE_VENDOR in c16.mjs records which
leak row each phrase came from), then that reduced list is used to
score the held-out vendor's own leak rows.

| vendor | leak_rows | caught_by_held_out_list | held_out_list_size |
| --- | --- | --- | --- |
| camara | 2 | 0 | 2 |
| discord | 1 | 0 | 3 |
| github | 2 | 0 | 2 |
| notion | 1 | 0 | 3 |
| vercel | 3 | 0 | 2 |

**Transfer: 0 of 9 tuned leak rows caught by a phrase list that never saw their own vendor.**

Finding, reported as measured: every phrase in the list was contributed
by exactly one vendor's own leak row, and none of the three phrases
appears in any other vendor's leak-row description. The list does not
transfer at all across vendors in this sample.

## 4. Cost: new goal-1 errors c16 creates

c16 turns 0 row(s) that c15 correctly called w (truth w) into a wrong x.

## 5. Clean exam (holdout4) + reference (holdout2), c16

| set | n | exact | goal2_leaks | goal1_errors |
| --- | --- | --- | --- | --- |
| holdout4 (clean exam) | 210 | 185 | 1 | 21 |
| holdout2 (reference) | 220 | 197 | 0 | 15 |

## 6. Per-set leaks and goal-1 errors, c15 vs c16

| set | n | c15_goal2_leaks | c16_goal2_leaks | c15_goal1_errors | c16_goal1_errors |
| --- | --- | --- | --- | --- | --- |
| camara | 292 | 2 | 1 | 17 | 17 |
| holdout1 | 207 | 2 | 1 | 55 | 55 |
| holdout2 | 220 | 0 | 0 | 15 | 15 |
| holdout3 | 226 | 4 | 3 | 15 | 15 |
| holdout4 | 210 | 1 | 1 | 21 | 21 |
| holdout5 | 323 | 1 | 1 | 55 | 55 |
| all | 1478 | 10 | 7 | 178 | 178 |

