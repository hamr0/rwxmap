# M1-C23: does the path tail name the object better than the operationId head noun?

TRIAL. Reading c22's 6 new-leak rows by hand at minN=5/minW=0.95
surfaced a candidate cause for two Discord rows (update_webhook_message,
update_original_webhook_message): the real object being edited is a
MESSAGE, the last real path segment, not "webhook". This pass reads
the object noun off the PATH TAIL instead, and re-runs c22's exact
sweep three ways (A: today's nouns, B: path-tail only, C: union) to
see whether that changes the trade. Not tuned to look good — a clean
negative is reported as such if that is what the numbers show.

Verification: judge.mjs's GENERIC_TAILS is now exported and imported directly here (15 entries) — no second copy of the list exists in this file.

Self-check: classifyC23(row, junkSet, allowlist, variant, nounsA) reproduces classifyC22(row, junkSet, allowlist, variant) exactly on all 5465 rows, both variants, at minN=5/minW=0.95 (0 mismatches). Trusted.

Baseline reproduced: 522 wrong-x rows (c15 fired a word rule, truth w), matching c21/c22's known figure of 522 exactly.

## Part 2: agreement census (diagnosis, no scoring)

Over all 4406 scorable PUT/DELETE/PATCH rows.

pathTailNoun: null on 353/4406 rows (8.0%).
operationIdHeadNoun: empty on 883/4406 rows (20.0%).
headNounForRow (summary): empty on 1025/4406 rows (23.3%).

vs operationIdHeadNoun (rows where both are non-null):
  agree: 1125, disagree: 2052.
  path-tail produces a noun where operationIdHeadNoun does not: 876.
  operationIdHeadNoun produces a noun where path-tail does not: 346.

vs headNounForRow / summary (rows where both are non-null):
  agree: 1435, disagree: 1699.
  path-tail produces a noun where the summary head noun does not: 919.
  summary head noun produces a noun where path-tail does not: 247.

15 real rows where path-tail and operationIdHeadNoun disagree:

| method | path | operationId | summary | truth | path-tail noun | operationId head noun |
| --- | --- | --- | --- | --- | --- | --- |
| PATCH | /v1/devices/{deviceId} | updateDevice | Update device information | x | devic | device |
| DELETE | /v1/devices/{deviceId} | deleteDevice | Delete device record | x | devic | device |
| PATCH | /trust-domains/{trustDomainId}/devices/{deviceId} | updateTrustDomainDevice | Update a device in a Trust Domain | w | devic | device |
| DELETE | /trust-domains/{trustDomainId}/devices/{deviceId} | deleteTrustDomainDevice | Remove a device from a Trust Domain | w | devic | device |
| DELETE | /slices/{sliceId} | deleteSlice | Delete a network slice | w | slic | slice |
| DELETE | /sponsorship/{sponsorId}/{campaignId}/{sessionId}/revoke | revokeSponsorship | Revocation of Sponsorship | x | revoke | sponsorship |
| PUT | /sessions/{registrationId} | updateRegistrationById | Refresh network registration. | w | session | registration |
| DELETE | /sessions/{registrationId} | deleteRegistrationById | Delete Registration Session. | w | session | registration |
| DELETE | /2010-04-01/Accounts/{AccountSid}/ConnectApps/{Sid}.json | DeleteConnectApp | Delete an instance of a connect-app | w | connectapp | app |
| DELETE | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{Sid}.json | DeleteIncomingPhoneNumber | Delete a phone-numbers belonging to the account used to make the request. | w | incomingphonenumber | number |
| DELETE | /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{ResourceSid}/AssignedAddOns/{Sid}.json | DeleteIncomingPhoneNumberAssignedAddOn | Remove the assignment of an Add-on installation from the Number specified. | w | assignedaddon | on |
| DELETE | /2010-04-01/Accounts/{AccountSid}/Messages/{Sid}.json | DeleteMessage | Deletes a Message resource from your account | w | messag | message |
| DELETE | /2010-04-01/Accounts/{AccountSid}/OutgoingCallerIds/{Sid}.json | DeleteOutgoingCallerId | Delete the caller-id specified from the account | w | outgoingcallerid | caller |
| DELETE | /2010-04-01/Accounts/{AccountSid}/Queues/{Sid}.json | DeleteQueue | Remove an empty queue | w | queu | queue |
| DELETE | /2010-04-01/Accounts/{AccountSid}/Recordings/{ReferenceSid}/AddOnResults/{Sid}.json | DeleteRecordingAddOnResult | Delete a result and purge all associated Payloads | w | addonresult | result |

## Part 3: does path-tail change the C22 rescue/leak trade?

Expectation stated before reading the numbers: config C (union) can
only make the allowlist rule HARDER to satisfy than A, never easier —
c22's rule requires EVERY noun on the row to be allowlisted, so a
union of nouns is a strict superset of constraints. Reported below
whether the data matches that.

### Config A (baseline)

Variant N (LOVO):

| minN | minW | allowlist size | rescued | new_leaks | remaining_wrong |
| --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 439 | 160 | 23 | 362 |
| 2 | 0.90 | 409 | 123 | 17 | 399 |
| 2 | 0.95 | 373 | 68 | 11 | 454 |
| 2 | 1.00 | 365 | 28 | 11 | 494 |
| 3 | 0.80 | 283 | 157 | 19 | 365 |
| 3 | 0.90 | 253 | 121 | 13 | 401 |
| 3 | 0.95 | 217 | 68 | 7 | 454 |
| 3 | 1.00 | 209 | 28 | 7 | 494 |
| 5 | 0.80 | 172 | 147 | 18 | 375 |
| 5 | 0.90 | 142 | 114 | 12 | 408 |
| 5 | 0.95 | 106 | 61 | 6 | 461 |
| 5 | 1.00 | 98 | 21 | 6 | 501 |
| 10 | 0.80 | 93 | 133 | 16 | 389 |
| 10 | 0.90 | 79 | 103 | 12 | 419 |
| 10 | 0.95 | 43 | 50 | 6 | 472 |
| 10 | 1.00 | 35 | 10 | 6 | 512 |

Variant NV (LOVO):

| minN | minW | allowlist size | rescued | new_leaks | remaining_wrong |
| --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 439 | 203 | 38 | 319 |
| 2 | 0.90 | 409 | 160 | 31 | 362 |
| 2 | 0.95 | 373 | 91 | 20 | 431 |
| 2 | 1.00 | 365 | 50 | 17 | 472 |
| 3 | 0.80 | 283 | 200 | 33 | 322 |
| 3 | 0.90 | 253 | 158 | 26 | 364 |
| 3 | 0.95 | 217 | 91 | 15 | 431 |
| 3 | 1.00 | 209 | 50 | 12 | 472 |
| 5 | 0.80 | 172 | 183 | 31 | 339 |
| 5 | 0.90 | 142 | 145 | 24 | 377 |
| 5 | 0.95 | 106 | 78 | 13 | 444 |
| 5 | 1.00 | 98 | 38 | 10 | 484 |
| 10 | 0.80 | 93 | 153 | 26 | 369 |
| 10 | 0.90 | 79 | 119 | 21 | 403 |
| 10 | 0.95 | 43 | 55 | 10 | 467 |
| 10 | 1.00 | 35 | 15 | 7 | 507 |

### Config B (path-tail only)

Variant N (LOVO):

| minN | minW | allowlist size | rescued | new_leaks | remaining_wrong |
| --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 452 | 169 | 33 | 353 |
| 2 | 0.90 | 424 | 127 | 20 | 395 |
| 2 | 0.95 | 418 | 106 | 17 | 416 |
| 2 | 1.00 | 414 | 73 | 14 | 449 |
| 3 | 0.80 | 253 | 164 | 31 | 358 |
| 3 | 0.90 | 225 | 122 | 18 | 400 |
| 3 | 0.95 | 219 | 101 | 15 | 421 |
| 3 | 1.00 | 215 | 68 | 12 | 454 |
| 5 | 0.80 | 148 | 151 | 27 | 371 |
| 5 | 0.90 | 120 | 109 | 14 | 413 |
| 5 | 0.95 | 114 | 88 | 11 | 434 |
| 5 | 1.00 | 110 | 55 | 8 | 467 |
| 10 | 0.80 | 67 | 120 | 23 | 402 |
| 10 | 0.90 | 56 | 85 | 11 | 437 |
| 10 | 0.95 | 50 | 64 | 8 | 458 |
| 10 | 1.00 | 46 | 31 | 5 | 491 |

Variant NV (LOVO):

| minN | minW | allowlist size | rescued | new_leaks | remaining_wrong |
| --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 452 | 215 | 49 | 307 |
| 2 | 0.90 | 424 | 166 | 32 | 356 |
| 2 | 0.95 | 418 | 142 | 25 | 380 |
| 2 | 1.00 | 414 | 108 | 22 | 414 |
| 3 | 0.80 | 253 | 206 | 43 | 316 |
| 3 | 0.90 | 225 | 157 | 26 | 365 |
| 3 | 0.95 | 219 | 133 | 19 | 389 |
| 3 | 1.00 | 215 | 99 | 16 | 423 |
| 5 | 0.80 | 148 | 193 | 38 | 329 |
| 5 | 0.90 | 120 | 144 | 21 | 378 |
| 5 | 0.95 | 114 | 120 | 14 | 402 |
| 5 | 1.00 | 110 | 86 | 11 | 436 |
| 10 | 0.80 | 67 | 144 | 31 | 378 |
| 10 | 0.90 | 56 | 103 | 16 | 419 |
| 10 | 0.95 | 50 | 79 | 9 | 443 |
| 10 | 1.00 | 46 | 45 | 6 | 477 |

### Config C (union)

Variant N (LOVO):

| minN | minW | allowlist size | rescued | new_leaks | remaining_wrong |
| --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 627 | 112 | 18 | 410 |
| 2 | 0.90 | 580 | 86 | 9 | 436 |
| 2 | 0.95 | 544 | 52 | 6 | 470 |
| 2 | 1.00 | 530 | 12 | 6 | 510 |
| 3 | 0.80 | 383 | 107 | 18 | 415 |
| 3 | 0.90 | 336 | 82 | 9 | 440 |
| 3 | 0.95 | 300 | 50 | 6 | 472 |
| 3 | 1.00 | 286 | 10 | 6 | 512 |
| 5 | 0.80 | 237 | 102 | 16 | 420 |
| 5 | 0.90 | 190 | 77 | 7 | 445 |
| 5 | 0.95 | 154 | 48 | 4 | 474 |
| 5 | 1.00 | 140 | 8 | 4 | 514 |
| 10 | 0.80 | 123 | 97 | 13 | 425 |
| 10 | 0.90 | 104 | 76 | 7 | 446 |
| 10 | 0.95 | 68 | 47 | 4 | 475 |
| 10 | 1.00 | 54 | 7 | 4 | 515 |

Variant NV (LOVO):

| minN | minW | allowlist size | rescued | new_leaks | remaining_wrong |
| --- | --- | --- | --- | --- | --- |
| 2 | 0.80 | 627 | 148 | 29 | 374 |
| 2 | 0.90 | 580 | 113 | 17 | 409 |
| 2 | 0.95 | 544 | 72 | 11 | 450 |
| 2 | 1.00 | 530 | 29 | 11 | 493 |
| 3 | 0.80 | 383 | 140 | 27 | 382 |
| 3 | 0.90 | 336 | 106 | 15 | 416 |
| 3 | 0.95 | 300 | 67 | 9 | 455 |
| 3 | 1.00 | 286 | 24 | 9 | 498 |
| 5 | 0.80 | 237 | 132 | 25 | 390 |
| 5 | 0.90 | 190 | 98 | 13 | 424 |
| 5 | 0.95 | 154 | 63 | 7 | 459 |
| 5 | 1.00 | 140 | 21 | 7 | 501 |
| 10 | 0.80 | 123 | 120 | 18 | 402 |
| 10 | 0.90 | 104 | 93 | 10 | 429 |
| 10 | 0.95 | 68 | 58 | 4 | 464 |
| 10 | 1.00 | 54 | 16 | 4 | 506 |

Expectation check: config C's rescued count is <= config A's rescued count at every grid point, both variants: VIOLATED.
The expectation as stated ("adding a noun can only make lowering harder") assumed a FIXED allowlist. It does not hold here because the
allowlist itself is rebuilt from a different candidate table per config (per the brief's own isolation rule) — config C's allowlist is
derived from union-table evidence, which is not the same allowlist config A gets, so the two are not being compared under a shared allowlist.
This is a data finding, not a plumbing bug — reported as such, not treated as fatal.

## Part 4: the two Discord rows, and c22's 6 named leak rows at minN=5/minW=0.95

Found 2 Discord row(s) by operationId in the combined corpus.

- `PATCH /webhooks/{webhook_id}/{webhook_token}/messages/@original` (update_original_webhook_message): path-tail noun = `messag`, operationIdHeadNoun = `message`, summary is empty so headNounForRow is empty. truth = x.
- `PATCH /webhooks/{webhook_id}/{webhook_token}/messages/{message_id}` (update_webhook_message): path-tail noun = `messag`, operationIdHeadNoun = `message`, summary is empty so headNounForRow is empty. truth = x.

Plain finding: **operationIdHeadNoun already resolves both Discord rows to "message"**, not "webhook" — its tail-stepback only steps back over
GENERIC_TAILS/"by", and "message" is the last operationId token, so it is returned directly. "message" is also already in c11.mjs's SHARED_NOUNS,
which is why c15 already classifies both rows correctly as x today (rule party-noun, evidence opid:message) — they are NOT among c22's 6
new-leak rows at minN=5/minW=0.95 (confirmed by grep against docs/logs/m1/c22-allowlist-wins.md and by direct row lookup above). The brief's
stated premise ("today the noun comes from the operationId head, which says webhook") does not hold for these two specific rows once measured.

Path-tail on these rows literally returns "messag", not "message" — a real, measured artifact of naiveSingular (imported unmodified, per the
brief), not a bug in pathTailNoun itself: naiveSingular strips a trailing "es" by removing the last TWO characters unconditionally, so plural
"messages" (ends "es") becomes "messag" (drops the stem's own final "e" along with the plural "s"), while operationId "...webhook_message"
was already singular in the source text and never goes through that stripping path, so it comes out "message" intact. Same underlying word,
different literal strings — this is exactly the kind of disagreement counted in Part 2's census and shown as row 1 of its 15 examples (Twilio's
DeleteMessage, /Messages/{Sid}.json -> "messag" vs "message"). It has no effect on scoring here (config B/C build their own noun table from the
same pathTailNoun function, so "messag" is used consistently on both sides), but it does mean neither configuration B nor C changes anything
about these two specific Discord rows: they were never at risk (already correctly x via SHARED_NOUNS today) and remain correctly x under A, B, and C.

c22's actual 6 new-leak rows at minN=5/minW=0.95, variant N (from docs/logs/m1/c22-allowlist-wins.md Part F) — checked here against configs A/B/C at the same point:

| operationId | method | path | truth | pred (A) | pred (B) | pred (C) |
| --- | --- | --- | --- | --- | --- | --- |
| deleteNetwork | DELETE | /networks/{networkId} | x | w | w | w |
| updateDevice | PATCH | /v1/devices/{deviceId} | x | w | w | w |
| deleteDevice | DELETE | /v1/devices/{deviceId} | x | w | w | w |
| validateWebhooks | PUT | /2/webhooks/{webhook_id} | x | w | w | w |
| PermissionProfiles_PutPermissionProfiles | PUT | /v2.1/accounts/{accountId}/permission_profiles/{permissionProfileId} | x | w | x | x |
| updateBookingContact | PUT | /bookings/{bookingId}/booking-contact | x | w | x | x |

(pred = this row's class under classifyC23 at minN=5/minW=0.95, variant N, using that row's own LOVO held-out-vendor allowlist for the named config — matching how c22 itself scored the original 6.)

## Part 5: per-set breakdown

No configuration beat baseline A's own best point, so per-set numbers below are reported at baseline's minN=5/minW=0.95, variant N (the same point c22 itself named as best).

| set | rescued | new_leaks |
| --- | --- | --- |
| camara | 4 | 3 |
| holdout1 | 5 | 0 |
| holdout2 | 0 | 0 |
| holdout3 | 1 | 0 |
| holdout4 | 2 | 1 |
| holdout5 | 0 | 0 |
| exam2 | 10 | 1 |
| exam3 | 39 | 1 |

## Verdict

Config A (baseline) best-known point: rescued=61, new_leaks=6 (minN=5, minW=0.95, variant N).
Config B (path-tail only) best point in this sweep: rescued=31, new_leaks=5 (minN=10, minW=1.00, variant N).
Config C (union) best point in this sweep: rescued=48, new_leaks=4 (minN=5, minW=0.95, variant N).

ONE-LINE VERDICT: path-tail (config B) loses to, or at best ties, the operationId head noun on this trade — a clean negative for this trial.

