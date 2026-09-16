# M1-C22: does the "yours" allowlist rescue "w dressed as x" rows?

Goal 1: c21 found 522 PUT/DELETE/PATCH rows where a hand-written
danger word (LIVE_VERBS/PARTY_NOUNS/SHARED_NOUNS) fired c15's raise
rule and was wrong (truth w). c20's independently measured "yours"
allowlist rates several of the same words (webhook, device, network,
contact, customer, channel, repository, trigger, run, ...) 87-100%
truth-w — but c20 only ever acts on rows c15 left at the w floor, so
that evidence never reaches these 522 rows today. This pass tests a
second layer, classifyC22, that reconsiders ONLY rows c15 raised to
x via party-noun (variant N) or party-noun/live-verb (variant NV),
and lowers back to w when every cleaned head noun on the row is on
the allowlist.

THIS RULE LOOSENS (x -> w) — the one direction the project's single
invariant (r < w < x, never loosen without evidence) exists to
guard. A wrong firing here is a LEAK, not a usability cost. Every
number below is reported under leave-one-vendor-out (LOVO); fitted
numbers appear only as a labelled, distrusted contrast (c20 already
showed 2 fitted leaks become 41 under LOVO on the same shape of
layer).

Self-check (variant N): classifyC22(row, allow-nothing) reproduces c15.classify(row) exactly on all 5465 rows (0 mismatches). Trusted.
Self-check (variant NV): classifyC22(row, allow-nothing) reproduces c15.classify(row) exactly on all 5465 rows (0 mismatches). Trusted.

## Part A: corpus and baseline

Combined corpus: 5465 rows. PUT/DELETE/PATCH rows: 4406.
c15-alone wrong-x rows (word rule fired, truth w) reproduced: 522 (party-noun: 441, live-verb: 81).
This matches c21's known figure of 522 exactly. Rescue baseline confirmed.

## Part B: allowlist derivation

Reused verbatim from c20: buildNounTable (c19) -> cleanNounTable (c20
junk rejection) -> nounStats (c20, PUT/DELETE/PATCH rows only) ->
deriveAllowlist(stats, minN, minW) at each grid point. 332 distinct vendors.

| minN | minW | allowlist size (fitted, full corpus) |
| --- | --- | --- |
| 2 | 0.80 | 439 |
| 2 | 0.90 | 409 |
| 2 | 0.95 | 373 |
| 2 | 1.00 | 365 |
| 3 | 0.80 | 283 |
| 3 | 0.90 | 253 |
| 3 | 0.95 | 217 |
| 3 | 1.00 | 209 |
| 5 | 0.80 | 172 |
| 5 | 0.90 | 142 |
| 5 | 0.95 | 106 |
| 5 | 1.00 | 98 |
| 10 | 0.80 | 93 |
| 10 | 0.90 | 79 |
| 10 | 0.95 | 43 |
| 10 | 1.00 | 35 |

## Part C: fitted (distrusted contrast) vs LOVO (the real number)

FITTED = allowlist built from ALL rows, scored on ALL rows —
reported ONLY as a labelled contrast. c20 already showed a fitted
number for this exact shape of layer collapses badly under LOVO (2
fitted leaks became 41) — a fitted number here must never be quoted
as the result.

LOVO = for each of the corpus's vendors, the allowlist is rebuilt
from every OTHER vendor's rows only, then that vendor's held-out
rows are scored with it, summed across all vendors. This is the
headline.

rescued = wrong-x rows (truth w, c15 fired a word rule) that the layer correctly drops to w. Baseline to beat: 522.
new_leaks = rows c15 alone got correctly to x (any reason) that the layer wrongly drops to w. THE DANGEROUS NUMBER.
remaining_wrong = 522 - rescued.

### Variant N (party-noun only)

FITTED:

| minN | minW | allowlist size | rescued | new_leaks | remaining_wrong | net (rescued - new_leaks) |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 439 | 170 | 13 | 352 | 157 |
| 2 | 0.90 | 409 | 127 | 9 | 395 | 118 |
| 2 | 0.95 | 373 | 73 | 2 | 449 | 71 |
| 2 | 1.00 | 365 | 24 | 0 | 498 | 24 |
| 3 | 0.80 | 283 | 165 | 13 | 357 | 152 |
| 3 | 0.90 | 253 | 122 | 9 | 400 | 113 |
| 3 | 0.95 | 217 | 69 | 2 | 453 | 67 |
| 3 | 1.00 | 209 | 20 | 0 | 502 | 20 |
| 5 | 0.80 | 172 | 158 | 13 | 364 | 145 |
| 5 | 0.90 | 142 | 117 | 9 | 405 | 108 |
| 5 | 0.95 | 106 | 67 | 2 | 455 | 65 |
| 5 | 1.00 | 98 | 19 | 0 | 503 | 19 |
| 10 | 0.80 | 93 | 142 | 13 | 380 | 129 |
| 10 | 0.90 | 79 | 107 | 9 | 415 | 98 |
| 10 | 0.95 | 43 | 57 | 2 | 465 | 55 |
| 10 | 1.00 | 35 | 9 | 0 | 513 | 9 |

LOVO (headline):

| minN | minW | allowlist size | rescued | new_leaks | remaining_wrong | net (rescued - new_leaks) |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 439 | 160 | 23 | 362 | 137 |
| 2 | 0.90 | 409 | 123 | 17 | 399 | 106 |
| 2 | 0.95 | 373 | 68 | 11 | 454 | 57 |
| 2 | 1.00 | 365 | 28 | 11 | 494 | 17 |
| 3 | 0.80 | 283 | 157 | 19 | 365 | 138 |
| 3 | 0.90 | 253 | 121 | 13 | 401 | 108 |
| 3 | 0.95 | 217 | 68 | 7 | 454 | 61 |
| 3 | 1.00 | 209 | 28 | 7 | 494 | 21 |
| 5 | 0.80 | 172 | 147 | 18 | 375 | 129 |
| 5 | 0.90 | 142 | 114 | 12 | 408 | 102 |
| 5 | 0.95 | 106 | 61 | 6 | 461 | 55 |
| 5 | 1.00 | 98 | 21 | 6 | 501 | 15 |
| 10 | 0.80 | 93 | 133 | 16 | 389 | 117 |
| 10 | 0.90 | 79 | 103 | 12 | 419 | 91 |
| 10 | 0.95 | 43 | 50 | 6 | 472 | 44 |
| 10 | 1.00 | 35 | 10 | 6 | 512 | 4 |

### Variant NV (party-noun OR live-verb)

FITTED:

| minN | minW | allowlist size | rescued | new_leaks | remaining_wrong | net (rescued - new_leaks) |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 439 | 222 | 25 | 300 | 197 |
| 2 | 0.90 | 409 | 170 | 16 | 352 | 154 |
| 2 | 0.95 | 373 | 99 | 3 | 423 | 96 |
| 2 | 1.00 | 365 | 47 | 0 | 475 | 47 |
| 3 | 0.80 | 283 | 214 | 25 | 308 | 189 |
| 3 | 0.90 | 253 | 163 | 16 | 359 | 147 |
| 3 | 0.95 | 217 | 95 | 3 | 427 | 92 |
| 3 | 1.00 | 209 | 43 | 0 | 479 | 43 |
| 5 | 0.80 | 172 | 200 | 25 | 322 | 175 |
| 5 | 0.90 | 142 | 151 | 16 | 371 | 135 |
| 5 | 0.95 | 106 | 88 | 3 | 434 | 85 |
| 5 | 1.00 | 98 | 37 | 0 | 485 | 37 |
| 10 | 0.80 | 93 | 171 | 22 | 351 | 149 |
| 10 | 0.90 | 79 | 132 | 16 | 390 | 116 |
| 10 | 0.95 | 43 | 69 | 3 | 453 | 66 |
| 10 | 1.00 | 35 | 19 | 0 | 503 | 19 |

LOVO (headline):

| minN | minW | allowlist size | rescued | new_leaks | remaining_wrong | net (rescued - new_leaks) |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 439 | 203 | 38 | 319 | 165 |
| 2 | 0.90 | 409 | 160 | 31 | 362 | 129 |
| 2 | 0.95 | 373 | 91 | 20 | 431 | 71 |
| 2 | 1.00 | 365 | 50 | 17 | 472 | 33 |
| 3 | 0.80 | 283 | 200 | 33 | 322 | 167 |
| 3 | 0.90 | 253 | 158 | 26 | 364 | 132 |
| 3 | 0.95 | 217 | 91 | 15 | 431 | 76 |
| 3 | 1.00 | 209 | 50 | 12 | 472 | 38 |
| 5 | 0.80 | 172 | 183 | 31 | 339 | 152 |
| 5 | 0.90 | 142 | 145 | 24 | 377 | 121 |
| 5 | 0.95 | 106 | 78 | 13 | 444 | 65 |
| 5 | 1.00 | 98 | 38 | 10 | 484 | 28 |
| 10 | 0.80 | 93 | 153 | 26 | 369 | 127 |
| 10 | 0.90 | 79 | 119 | 21 | 403 | 98 |
| 10 | 0.95 | 43 | 55 | 10 | 467 | 45 |
| 10 | 1.00 | 35 | 15 | 7 | 507 | 8 |

## Part D: isolation proofs (not asserted — counted)

D1: rows c15 left at the w floor (3559 rows): classifyC22 changes 0 of them, across both variants and all 16 grid points (expected 0 — c22 only acts where base.floor === false, i.e. never on a floor row).

D2: c20's classifyC20 (allow-everything allowlist, for a stable reference number) goal-2 leaks on the combined corpus while c22.mjs is loaded and its layer has been exercised above: 247. c22.mjs never imports classifyC20 into its own scoring path (Part C above calls only classifyC22) and never modifies c20.mjs, c15.mjs, or judge.mjs, so this number is unaffected by this pass by construction — the row sets are disjoint (a row is either at the w floor, where c20 acts, or raised to x by a fired rule, where c22 acts; D1 above further confirms c22 never touches a floor row).

## Part E: per-set breakdown at two display points (loosest and strictest), both variants

Every set listed, including zero counts.

### loosest (minN=2, minW=0.80 — goal 2's adopted bar) — variant N

| set | rescued | new_leaks |
| --- | --- | --- |
| camara | 6 | 4 |
| holdout1 | 13 | 3 |
| holdout2 | 1 | 0 |
| holdout3 | 3 | 3 |
| holdout4 | 3 | 1 |
| holdout5 | 0 | 0 |
| exam2 | 24 | 5 |
| exam3 | 110 | 7 |

### loosest (minN=2, minW=0.80 — goal 2's adopted bar) — variant NV

| set | rescued | new_leaks |
| --- | --- | --- |
| camara | 8 | 4 |
| holdout1 | 15 | 4 |
| holdout2 | 1 | 0 |
| holdout3 | 4 | 3 |
| holdout4 | 6 | 1 |
| holdout5 | 2 | 0 |
| exam2 | 30 | 11 |
| exam3 | 137 | 15 |

### strictest (minN=10, minW=1.00) — variant N

| set | rescued | new_leaks |
| --- | --- | --- |
| camara | 4 | 3 |
| holdout1 | 0 | 0 |
| holdout2 | 0 | 0 |
| holdout3 | 1 | 0 |
| holdout4 | 1 | 1 |
| holdout5 | 0 | 0 |
| exam2 | 1 | 1 |
| exam3 | 3 | 1 |

### strictest (minN=10, minW=1.00) — variant NV

| set | rescued | new_leaks |
| --- | --- | --- |
| camara | 4 | 3 |
| holdout1 | 1 | 0 |
| holdout2 | 0 | 0 |
| holdout3 | 1 | 0 |
| holdout4 | 1 | 1 |
| holdout5 | 0 | 0 |
| exam2 | 1 | 1 |
| exam3 | 7 | 2 |

## Part F: the safest grid point that still rescues meaningfully — full new-leak row listing

Chosen by scanning the full LOVO grid (both variants, all 16 points): the global minimum new_leaks observed anywhere in the grid is 6; among all (variant, point) combinations achieving that minimum, the one with the highest rescued count is variant N, minN=5, minW=0.95 — LOVO rescued=61, new_leaks=6, remaining_wrong=461.

Recount at this point (full corpus, LOVO, both directions confirmed against Part C's table): rescued=61, new_leaks=6.

Every new-leak row at this point (method, path, operationId, summary, truth class, letting noun(s)):

| method | path | operationId | summary | truth | letting noun(s) |
| --- | --- | --- | --- | --- | --- |
| DELETE | /networks/{networkId} | deleteNetwork | Delete a dedicated network | x | network |
| PATCH | /v1/devices/{deviceId} | updateDevice | Update device information | x | device |
| DELETE | /v1/devices/{deviceId} | deleteDevice | Delete device record | x | device |
| PUT | /2/webhooks/{webhook_id} | validateWebhooks | Validate webhook | x | webhook |
| PUT | /v2.1/accounts/{accountId}/permission_profiles/{permissionProfileId} | PermissionProfiles_PutPermissionProfiles | Updates a permission profile. | x | profile |
| PUT | /bookings/{bookingId}/booking-contact | updateBookingContact | Change a booking contact | x | contact |

## What the data supports

No (variant, grid point) combination in this sweep reaches 0 LOVO new_leaks — the best achievable is 6 new leak(s), at which point 61 of the 522 wrong-x rows are rescued. Whether that trade (61 rescued for 6 new leak(s), listed in full in Part F) is acceptable is a go/no-go judgement for the user, not a call this script makes.

Fitted numbers (Part C, labelled) are not quoted here as the result
for the reason stated at the top of this file: they overstate what
generalises to an unseen vendor, sometimes drastically so.

