# M1-C24: via-negativa cleanup of the hand-written PARTY_NOUNS/SHARED_NOUNS list

Measurement only. Every number below is computed from the 5465-row
combined corpus (loadCombinedCorpus, six original sets + exam2 +
exam3). PUT/DELETE/PATCH rows only for word statistics (n=4406),
matching where c15's party-noun raise rule actually fires.

## Proof: the authorized c20.mjs/c22.mjs edit is faithful, and cfg 0 reproduces the real combined-stack numbers

Reference (coordinator's independent re-measurement, all 5465 rows,
LOVO): c15 alone goal-2=280, all-loosening=297 (280 + 17 fixed GET
mismatches), goal-1=625 (floor 103, live-verb 81, party-noun 441);
c15+C20 goal-2=89, goal-1=1936 (floor 103, live-verb 81, no-own-noun
1311, party-noun 441); c15+C22 goal-2=286, goal-1=564 (floor 103,
live-verb 81, party-noun 380); c15+C20+C22 (= cfg 0) goal-2=95,
goal-1=1875 (floor 103, live-verb 81, no-own-noun 1311, party-noun 380).

c15 alone: goal-2=280, goal-1=625 (party-noun 441, floor 103, live-verb 81).
c15+C20: goal-2=89, goal-1=1936 (no-own-noun 1311, party-noun 441, floor 103, live-verb 81).
c15+C22: goal-2=286, goal-1=564 (party-noun 380, floor 103, live-verb 81).
cfg 0 (c15+C20+C22, default path): goal-2=95, goal-1=1875 (no-own-noun 1311, party-noun 380, floor 103, live-verb 81).
All four intermediate configurations reproduce the coordinator's independently-measured numbers exactly, including the full goal-1 rule split. Trusted.

cfg 0 via the INJECTED path (classifyBase = classifyWithNouns(row, PARTY_NOUNS ∪ SHARED_NOUNS), the real, unmodified noun set): goal-1=1875, goal-2=95.
Injected path matches the default path exactly, same noun set. Injection is faithful. Trusted.

## Part C-0: the classifyWithNouns third-fallback asymmetry, measured

classifyWithNouns's buried-operationId-token fallback always tests the
REAL, hardcoded SHARED_NOUNS import (this matches c15's own
partyNounHit, which has the identical asymmetry by design — neither
ever extends the token fallback with PARTY_NOUNS or a substituted
set). Consequence for this pass: a SHARED_NOUNS word removed under
a cleanup variant can still raise x via this fallback. Counted below,
not assumed.

## Part A: word-by-word measurement

Bar: YOURS = n >= 5 and w-share >= 0.8; THIRD-PARTY = w-share < 0.5; MIXED = everything else (including n < 5); DEAD = n = 0 (never a candidate head noun on a PUT/DELETE/PATCH row).

c11.mjs adds 'repository' to PARTY_NOUNS (it is not in judge.mjs's
own PARTY_NOUNS) — counted under PARTY_NOUNS below, as that is where
c11.mjs places it.

### PARTY_NOUNS (32 words)

| word | n | truth-w | truth-x | w-share | # vendors | group | also passes at w-share>=0.95 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| access | 3 | 2 | 1 | 66.7% | 3 | MIXED | no |
| account | 68 | 52 | 16 | 76.5% | 39 | MIXED | no |
| assignment | 6 | 4 | 2 | 66.7% | 5 | MIXED | no |
| call | 8 | 2 | 6 | 25.0% | 5 | THIRD-PARTY | no |
| collaboration | 2 | 0 | 2 | 0.0% | 2 | THIRD-PARTY | no |
| collaborator | 7 | 0 | 7 | 0.0% | 6 | THIRD-PARTY | no |
| contact | 21 | 20 | 1 | 95.2% | 13 | YOURS | yes |
| customer | 15 | 13 | 2 | 86.7% | 9 | YOURS | no |
| device | 24 | 22 | 2 | 91.7% | 15 | YOURS | no |
| group | 69 | 49 | 20 | 71.0% | 37 | MIXED | no |
| installation | 2 | 1 | 1 | 50.0% | 2 | MIXED | no |
| invitation | 4 | 0 | 4 | 0.0% | 4 | THIRD-PARTY | no |
| member | 37 | 7 | 30 | 18.9% | 24 | THIRD-PARTY | no |
| membership | 9 | 2 | 7 | 22.2% | 6 | THIRD-PARTY | no |
| network | 16 | 15 | 1 | 93.8% | 8 | YOURS | no |
| organization | 23 | 17 | 6 | 73.9% | 10 | MIXED | no |
| participant | 5 | 0 | 5 | 0.0% | 4 | THIRD-PARTY | no |
| partner | 6 | 5 | 1 | 83.3% | 4 | YOURS | no |
| people | 0 | 0 | 0 | n/a | 0 | DEAD | no |
| person | 7 | 7 | 0 | 100.0% | 4 | YOURS | yes |
| recipient | 0 | 0 | 0 | n/a | 0 | DEAD | no |
| repository | 16 | 14 | 2 | 87.5% | 3 | YOURS | no |
| restriction | 2 | 0 | 2 | 0.0% | 1 | THIRD-PARTY | no |
| role | 31 | 17 | 14 | 54.8% | 23 | MIXED | no |
| seat | 0 | 0 | 0 | n/a | 0 | DEAD | no |
| session | 14 | 7 | 7 | 50.0% | 8 | MIXED | no |
| sponsorship | 1 | 0 | 1 | 0.0% | 1 | THIRD-PARTY | no |
| subscriber | 0 | 0 | 0 | n/a | 0 | DEAD | no |
| team | 13 | 6 | 7 | 46.2% | 8 | THIRD-PARTY | no |
| tenant | 0 | 0 | 0 | n/a | 0 | DEAD | no |
| token | 34 | 25 | 9 | 73.5% | 26 | MIXED | no |
| user | 153 | 68 | 85 | 44.4% | 73 | THIRD-PARTY | no |

### SHARED_NOUNS (11 words)

| word | n | truth-w | truth-x | w-share | # vendors | group | also passes at w-share>=0.95 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ban | 0 | 0 | 0 | n/a | 0 | DEAD | no |
| channel | 15 | 13 | 2 | 86.7% | 10 | YOURS | no |
| emoji | 2 | 1 | 1 | 50.0% | 2 | MIXED | no |
| guild | 1 | 0 | 1 | 0.0% | 1 | THIRD-PARTY | no |
| message | 17 | 11 | 6 | 64.7% | 13 | MIXED | no |
| overwrite | 1 | 0 | 1 | 0.0% | 1 | THIRD-PARTY | no |
| permission | 12 | 3 | 9 | 25.0% | 10 | THIRD-PARTY | no |
| pin | 3 | 2 | 1 | 66.7% | 3 | MIXED | no |
| reaction | 3 | 2 | 1 | 66.7% | 3 | MIXED | no |
| sticker | 2 | 1 | 1 | 50.0% | 2 | MIXED | no |
| webhook | 36 | 35 | 1 | 97.2% | 24 | YOURS | yes |

**YOURS** (9): `contact` (PARTY_NOUNS), `customer` (PARTY_NOUNS), `device` (PARTY_NOUNS), `network` (PARTY_NOUNS), `partner` (PARTY_NOUNS), `person` (PARTY_NOUNS), `repository` (PARTY_NOUNS), `channel` (SHARED_NOUNS), `webhook` (SHARED_NOUNS)

**THIRD-PARTY** (14): `call` (PARTY_NOUNS), `collaboration` (PARTY_NOUNS), `collaborator` (PARTY_NOUNS), `invitation` (PARTY_NOUNS), `member` (PARTY_NOUNS), `membership` (PARTY_NOUNS), `participant` (PARTY_NOUNS), `restriction` (PARTY_NOUNS), `sponsorship` (PARTY_NOUNS), `team` (PARTY_NOUNS), `user` (PARTY_NOUNS), `guild` (SHARED_NOUNS), `overwrite` (SHARED_NOUNS), `permission` (SHARED_NOUNS)

**MIXED** (14): `access` (PARTY_NOUNS), `account` (PARTY_NOUNS), `assignment` (PARTY_NOUNS), `group` (PARTY_NOUNS), `installation` (PARTY_NOUNS), `organization` (PARTY_NOUNS), `role` (PARTY_NOUNS), `session` (PARTY_NOUNS), `token` (PARTY_NOUNS), `emoji` (SHARED_NOUNS), `message` (SHARED_NOUNS), `pin` (SHARED_NOUNS), `reaction` (SHARED_NOUNS), `sticker` (SHARED_NOUNS)

**DEAD** (6): `people` (PARTY_NOUNS), `recipient` (PARTY_NOUNS), `seat` (PARTY_NOUNS), `subscriber` (PARTY_NOUNS), `tenant` (PARTY_NOUNS), `ban` (SHARED_NOUNS)

Of the YOURS words, 3 would ALSO pass at the stricter w-share>=0.95 bar: `contact`, `person`, `webhook`.

## Part B: the proposed cleaned lists

**variant KEEP** — removes only YOURS words (9 removed), MIXED and DEAD stay:

PARTY_NOUNS (25 of 32): `access`, `account`, `assignment`, `call`, `collaboration`, `collaborator`, `group`, `installation`, `invitation`, `member`, `membership`, `organization`, `participant`, `people`, `recipient`, `restriction`, `role`, `seat`, `session`, `sponsorship`, `subscriber`, `team`, `tenant`, `token`, `user`

SHARED_NOUNS (9 of 11): `ban`, `emoji`, `guild`, `message`, `overwrite`, `permission`, `pin`, `reaction`, `sticker`

**variant STRIP** — removes YOURS, MIXED and DEAD; only THIRD-PARTY survives (14 words total):

PARTY_NOUNS (11 of 32): `call`, `collaboration`, `collaborator`, `invitation`, `member`, `membership`, `participant`, `restriction`, `sponsorship`, `team`, `user`

SHARED_NOUNS (3 of 11): `guild`, `overwrite`, `permission`

Bypass check (Part C-0, continued): for each variant, rows where a
removed SHARED_NOUNS word would still fire x via the hardcoded
opid-token fallback (i.e. it is NOT the row's head noun, only a
buried operationId token) — this is the count classifyWithNouns
cannot suppress even under that variant's reduced noun set:

variant KEEP: 2 SHARED_NOUNS words removed (channel, webhook); bypass rows = 39.
variant STRIP: 8 SHARED_NOUNS words removed (message, channel, emoji, sticker, pin, ban, webhook, reaction); bypass rows = 52.

These rows would still raise x today (via the real SHARED_NOUNS
opid-token fallback, which classifyWithNouns cannot suppress under
either variant) but are counted below AS IF the variant fully
applied, since classifyC15's own token fallback has this identical
hardcoding and no in-scope file may be edited to parameterise it.
cfg1/cfg2/cfg3 below are therefore a slight UNDER-estimate of how
many rows a real edit to PARTY_NOUNS/SHARED_NOUNS would move —
these specific bypass rows would still resolve to x in the real
list even after the edit, same as measured here. A bypass word
keeps a row at x, and a row held at x cannot become a leak, so
the bypass UNDER-counts leaks relative to a real edit. Measured
by the orchestrator with the bypass emulated off: goal-2 leaks
are KEEP 99 and STRIP 107, against 97 and 103 with the bypass on.

## Part C: four configurations, LOVO, all 5465 rows

cfg 0 = today's shape (c15 + C20 layer + C22 layer, unchanged lists) — the control.
cfg 1 = same, PARTY_NOUNS/SHARED_NOUNS replaced by variant KEEP.
cfg 2 = same, replaced by variant STRIP.
cfg 3 = variant STRIP with the C22 layer DISABLED.

goal-1 = truth w predicted x (over-tight, a usability cost) — split by
which rule produced the x, so a word moving from c15's `party-noun`
rule to C20's `no-own-noun` rule (the entire point of this pass) is
visible, not just the net total.
goal-2 (x-as-w) = truth x predicted w — the go/no-go gate. Reported
separately from all-loosening; never the same number.
all-loosening = every row where the predicted class is strictly
looser than truth (r<w<x order) — goal-2 plus a fixed 17 GET rows
whose truth label is w/x while GET is hard-locked to r (present in
every configuration identically, since nothing here ever touches GET).

| config | n | goal-2 (x-as-w) | all-loosening | goal-1 total | goal-1 by rule | delta goal-2 vs cfg0 | delta goal-1 vs cfg0 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cfg 0 (control, unchanged lists) | 5465 | 95 | 112 | 1875 | no-own-noun 1311, party-noun 380, floor 103, live-verb 81 | 0 | 0 |
| cfg 1 (variant KEEP) | 5465 | 97 | 114 | 1811 | no-own-noun 1319, party-noun 308, floor 103, live-verb 81 | 2 | -64 |
| cfg 2 (variant STRIP) | 5465 | 103 | 120 | 1811 | no-own-noun 1488, party-noun 139, floor 103, live-verb 81 | 8 | -64 |
| cfg 3 (variant STRIP, C22 disabled) | 5465 | 101 | 118 | 1852 | no-own-noun 1488, party-noun 180, floor 103, live-verb 81 | 6 | -23 |

Sanity: cfg 0's goal-1/goal-2 above (1875/95) must equal the earlier-proven cfg0 numbers (1875/95).
Confirmed equal.

### Same four configurations, PUT/DELETE/PATCH rows only (secondary view, cheap to add)

| config | n (PDP only) | goal-2 (x-as-w) | all-loosening | goal-1 total | goal-1 by rule |
| --- | --- | --- | --- | --- | --- |
| cfg 0 (control, unchanged lists) | 4406 | 95 | 95 | 1772 | no-own-noun 1311, party-noun 380, live-verb 81 |
| cfg 1 (variant KEEP) | 4406 | 97 | 97 | 1708 | no-own-noun 1319, party-noun 308, live-verb 81 |
| cfg 2 (variant STRIP) | 4406 | 103 | 103 | 1708 | no-own-noun 1488, party-noun 139, live-verb 81 |
| cfg 3 (variant STRIP, C22 disabled) | 4406 | 101 | 101 | 1749 | no-own-noun 1488, party-noun 180, live-verb 81 |

## Part D: the ruling condition — does the cleanup break goal 2?

Goal-2 baseline = 95 (cfg 0). Any variant whose goal-2 count rises above 95 is a break; per the user's instruction, a break means leave the list alone for that variant.

cfg 1 (variant KEEP): goal-2 = 97 vs cfg 0's 95 — ROSE by 2 (BREAK — leave this variant alone).
cfg 2 (variant STRIP): goal-2 = 103 vs cfg 0's 95 — ROSE by 8 (BREAK — leave this variant alone).
cfg 3 (variant STRIP, C22 disabled): goal-2 = 101 vs cfg 0's 95 — ROSE by 6 (BREAK — leave this variant alone).

cfg 3 (STRIP, C22 disabled) is compared the same way — goal-2 = 101 vs cfg 0's 95 — and its goal-1 split (no-own-noun 1488, party-noun 180, floor 103, live-verb 81) is compared against cfg 2's (no-own-noun 1488, party-noun 139, floor 103, live-verb 81) to see whether C22 still does anything once the hand list no longer contains words C22 was rescuing.

**Recommendation:** Leave the list alone. Every variant that touches PARTY_NOUNS/SHARED_NOUNS raised goal-2's leak count above cfg 0's baseline — the ruling condition (any rise in goal 2 means leave the list alone) is triggered for all of them.

## Part E: per-set breakdown for cfg 1 (variant KEEP)

All 8 sets are burned for scoring a rule CHANGE (every one of them
has already been read, or its words measured, during M1-C9 through
C23 — none is a genuinely unseen exam for this specific decision).
Exam 4 (being drawn separately, unlabelled as of now) is the set
that will score this change honestly.

| set | n | cfg0 goal-1 | cfg0 goal-2 | cfg 1 (variant KEEP) goal-1 | cfg 1 (variant KEEP) goal-2 |
| --- | --- | --- | --- | --- | --- |
| camara | 292 | 22 | 3 | 22 | 3 |
| holdout1 | 207 | 85 | 1 | 78 | 3 |
| holdout2 | 220 | 32 | 0 | 32 | 0 |
| holdout3 | 226 | 25 | 2 | 25 | 2 |
| holdout4 | 210 | 28 | 2 | 27 | 2 |
| holdout5 | 323 | 59 | 0 | 59 | 0 |
| exam2 | 994 | 384 | 30 | 375 | 30 |
| exam3 | 2993 | 1240 | 57 | 1193 | 57 |

