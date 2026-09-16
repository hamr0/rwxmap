# M1-C21: word-by-word audit of the hand-written danger-word lists

Goal 1 of this pass: find "w dressed as x" — rows where a
hand-written danger word (LIVE_VERBS, PARTY_NOUNS, SHARED_NOUNS, all
imported unchanged from c11.mjs) fired c15's raise rule and was
WRONG (truth w or r, not x). Direct measurement, no
leave-one-vendor-out this pass — these lists were hand-written months
ago and never saw this corpus, so a straight read of how each word
performs on it is already honest; LOVO is left for a later pass.

DIAGNOSIS ONLY. c15.mjs, c11.mjs and judge.mjs are never modified —
classify(row) is c15's own function, called unchanged. No rule
changes land in this file.

How to re-run: `node poc/m1/arbiter/c21.mjs`

## Part A: corpus and firing counts

Total combined-corpus rows: 5465.
Excluded (gt_class not one of r/w/x): 0.
Scorable rows: 5465.
Scorable PUT/DELETE/PATCH rows (the only rows c15 can raise on): 4406.
Fired a word rule (live-verb or party-noun): 847.
Left at the floor (no word rule fired): 3559.
Check: firings + floor = 4406 vs PDP rows = 4406 (match).

Of the 847 firings: 325 right (truth x), 522 wrong_w (truth w), 0 wrong_r (truth r).
Total wrong (wrong_w + wrong_r) = 522.
This reproduces the known figure of 522 over-tight rows (a word rule fired and was wrong) on the combined corpus.

## Part B: overall table (all PUT/DELETE/PATCH rows), sorted by wrong_w + wrong_r descending

| word | list | fires | right (x) | wrong_w | wrong_r | precision | vendors | wrong vendors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| user | party | 140 | 78 | 62 | 0 | 0.557 | 72 | 37 |
| webhook | shared | 55 | 1 | 54 | 0 | 0.018 | 38 | 38 |
| account | party | 65 | 15 | 50 | 0 | 0.231 | 39 | 34 |
| group | party | 64 | 16 | 48 | 0 | 0.250 | 34 | 26 |
| channel | shared | 30 | 4 | 26 | 0 | 0.133 | 13 | 12 |
| token | party | 28 | 6 | 22 | 0 | 0.214 | 20 | 14 |
| device | party | 23 | 2 | 21 | 0 | 0.087 | 15 | 15 |
| cancel | live-verb | 48 | 28 | 20 | 0 | 0.583 | 31 | 15 |
| contact | party | 20 | 1 | 19 | 0 | 0.050 | 13 | 12 |
| role | party | 28 | 12 | 16 | 0 | 0.429 | 20 | 10 |
| message | shared | 22 | 7 | 15 | 0 | 0.318 | 17 | 13 |
| network | party | 16 | 1 | 15 | 0 | 0.063 | 8 | 8 |
| organization | party | 18 | 5 | 13 | 0 | 0.278 | 10 | 8 |
| repository | party | 15 | 2 | 13 | 0 | 0.133 | 3 | 3 |
| customer | party | 14 | 2 | 12 | 0 | 0.143 | 9 | 8 |
| trigger | live-verb | 12 | 0 | 12 | 0 | 0.000 | 6 | 6 |
| revoke | live-verb | 17 | 8 | 9 | 0 | 0.471 | 13 | 8 |
| run | live-verb | 11 | 2 | 9 | 0 | 0.182 | 7 | 5 |
| member | party | 35 | 28 | 7 | 0 | 0.800 | 23 | 5 |
| session | party | 12 | 5 | 7 | 0 | 0.417 | 7 | 4 |
| transfer | live-verb | 9 | 2 | 7 | 0 | 0.222 | 8 | 6 |
| person | party | 7 | 0 | 7 | 0 | 0.000 | 4 | 4 |
| team | party | 12 | 6 | 6 | 0 | 0.500 | 8 | 5 |
| pay | live-verb | 6 | 0 | 6 | 0 | 0.000 | 3 | 3 |
| permission | shared | 21 | 16 | 5 | 0 | 0.762 | 15 | 2 |
| guild | shared | 8 | 3 | 5 | 0 | 0.375 | 1 | 1 |
| terminate | live-verb | 6 | 1 | 5 | 0 | 0.167 | 3 | 3 |
| partner | party | 5 | 1 | 4 | 0 | 0.200 | 4 | 3 |
| reaction | shared | 5 | 1 | 4 | 0 | 0.200 | 4 | 3 |
| assignment | party | 5 | 2 | 3 | 0 | 0.400 | 4 | 2 |
| end | live-verb | 5 | 2 | 3 | 0 | 0.400 | 5 | 3 |
| pin | shared | 5 | 2 | 3 | 0 | 0.400 | 4 | 3 |
| merge | live-verb | 4 | 1 | 3 | 0 | 0.250 | 3 | 2 |
| accepted | live-verb | 2 | 0 | 2 | 0 | 0.000 | 1 | 1 |
| start | live-verb | 9 | 8 | 1 | 0 | 0.889 | 6 | 1 |
| membership | party | 7 | 6 | 1 | 0 | 0.857 | 5 | 1 |
| invite | live-verb | 4 | 3 | 1 | 0 | 0.750 | 3 | 1 |
| access | party | 2 | 1 | 1 | 0 | 0.500 | 2 | 1 |
| installation | party | 2 | 1 | 1 | 0 | 0.500 | 2 | 1 |
| notify | live-verb | 2 | 1 | 1 | 0 | 0.500 | 2 | 1 |
| reboot | live-verb | 2 | 1 | 1 | 0 | 0.500 | 1 | 1 |
| sticker | shared | 2 | 1 | 1 | 0 | 0.500 | 2 | 1 |
| submit | live-verb | 2 | 1 | 1 | 0 | 0.500 | 2 | 1 |
| collaborator | party | 6 | 6 | 0 | 0 | 1.000 | 5 | 0 |
| publish | live-verb | 5 | 5 | 0 | 0 | 1.000 | 2 | 0 |
| send | live-verb | 5 | 5 | 0 | 0 | 1.000 | 5 | 0 |
| accept | live-verb | 4 | 4 | 0 | 0 | 1.000 | 4 | 0 |
| participant | party | 4 | 4 | 0 | 0 | 1.000 | 3 | 0 |
| call | party | 3 | 3 | 0 | 0 | 1.000 | 2 | 0 |
| invitation | party | 3 | 3 | 0 | 0 | 1.000 | 3 | 0 |
| approve | live-verb | 2 | 2 | 0 | 0 | 1.000 | 2 | 0 |
| collaboration | party | 2 | 2 | 0 | 0 | 1.000 | 2 | 0 |
| kick | live-verb | 2 | 2 | 0 | 0 | 1.000 | 2 | 0 |
| restriction | party | 2 | 2 | 0 | 0 | 1.000 | 1 | 0 |
| accepts | live-verb | 1 | 1 | 0 | 0 | 1.000 | 1 | 0 |
| convert | live-verb | 1 | 1 | 0 | 0 | 1.000 | 1 | 0 |
| emoji | shared | 1 | 1 | 0 | 0 | 1.000 | 1 | 0 |
| overwrite | shared | 1 | 1 | 0 | 0 | 1.000 | 1 | 0 |

## Part C: per-method breakdown, same words, same sort

Each cell is `fires/right/wrong_w/wrong_r/precision` for that method.
A word right on one method and wrong on another shows up as a big
precision gap between its three cells — the key question of this
pass.

| word | list | PUT (fires/right/wrong_w/wrong_r/prec) | DELETE (fires/right/wrong_w/wrong_r/prec) | PATCH (fires/right/wrong_w/wrong_r/prec) |
| --- | --- | --- | --- | --- |
| user | party | 47/22/25/0/0.468 | 78/50/28/0/0.641 | 15/6/9/0/0.400 |
| webhook | shared | 14/1/13/0/0.071 | 35/0/35/0/0.000 | 6/0/6/0/0.000 |
| account | party | 27/6/21/0/0.222 | 28/9/19/0/0.321 | 10/0/10/0/0.000 |
| group | party | 22/4/18/0/0.182 | 30/11/19/0/0.367 | 12/1/11/0/0.083 |
| channel | shared | 10/2/8/0/0.200 | 14/2/12/0/0.143 | 6/0/6/0/0.000 |
| token | party | 7/1/6/0/0.143 | 16/4/12/0/0.250 | 5/1/4/0/0.200 |
| device | party | 7/0/7/0/0.000 | 12/1/11/0/0.083 | 4/1/3/0/0.250 |
| cancel | live-verb | 13/8/5/0/0.615 | 33/19/14/0/0.576 | 2/1/1/0/0.500 |
| contact | party | 10/1/9/0/0.100 | 9/0/9/0/0.000 | 1/0/1/0/0.000 |
| role | party | 13/6/7/0/0.462 | 14/5/9/0/0.357 | 1/1/0/0/1.000 |
| message | shared | 5/2/3/0/0.400 | 12/3/9/0/0.250 | 5/2/3/0/0.400 |
| network | party | 5/0/5/0/0.000 | 9/1/8/0/0.111 | 2/0/2/0/0.000 |
| organization | party | 9/1/8/0/0.111 | 7/4/3/0/0.571 | 2/0/2/0/0.000 |
| repository | party | 6/0/6/0/0.000 | 9/2/7/0/0.222 | 0/0/0/0/n/a |
| customer | party | 6/0/6/0/0.000 | 7/2/5/0/0.286 | 1/0/1/0/0.000 |
| trigger | live-verb | 4/0/4/0/0.000 | 5/0/5/0/0.000 | 3/0/3/0/0.000 |
| revoke | live-verb | 0/0/0/0/n/a | 17/8/9/0/0.471 | 0/0/0/0/n/a |
| run | live-verb | 2/1/1/0/0.500 | 3/0/3/0/0.000 | 6/1/5/0/0.167 |
| member | party | 14/8/6/0/0.571 | 17/16/1/0/0.941 | 4/4/0/0/1.000 |
| session | party | 2/2/0/0/1.000 | 10/3/7/0/0.300 | 0/0/0/0/n/a |
| transfer | live-verb | 4/1/3/0/0.250 | 4/0/4/0/0.000 | 1/1/0/0/1.000 |
| person | party | 3/0/3/0/0.000 | 4/0/4/0/0.000 | 0/0/0/0/n/a |
| team | party | 4/1/3/0/0.250 | 8/5/3/0/0.625 | 0/0/0/0/n/a |
| pay | live-verb | 3/0/3/0/0.000 | 2/0/2/0/0.000 | 1/0/1/0/0.000 |
| permission | shared | 14/9/5/0/0.643 | 6/6/0/0/1.000 | 1/1/0/0/1.000 |
| guild | shared | 2/1/1/0/0.500 | 2/1/1/0/0.500 | 4/1/3/0/0.250 |
| terminate | live-verb | 0/0/0/0/n/a | 5/1/4/0/0.200 | 1/0/1/0/0.000 |
| partner | party | 2/0/2/0/0.000 | 3/1/2/0/0.333 | 0/0/0/0/n/a |
| reaction | shared | 1/0/1/0/0.000 | 4/1/3/0/0.250 | 0/0/0/0/n/a |
| assignment | party | 3/2/1/0/0.667 | 2/0/2/0/0.000 | 0/0/0/0/n/a |
| end | live-verb | 2/0/2/0/0.000 | 3/2/1/0/0.667 | 0/0/0/0/n/a |
| pin | shared | 4/2/2/0/0.500 | 1/0/1/0/0.000 | 0/0/0/0/n/a |
| merge | live-verb | 3/1/2/0/0.333 | 1/0/1/0/0.000 | 0/0/0/0/n/a |
| accepted | live-verb | 2/0/2/0/0.000 | 0/0/0/0/n/a | 0/0/0/0/n/a |
| start | live-verb | 8/7/1/0/0.875 | 0/0/0/0/n/a | 1/1/0/0/1.000 |
| membership | party | 1/1/0/0/1.000 | 5/4/1/0/0.800 | 1/1/0/0/1.000 |
| invite | live-verb | 3/3/0/0/1.000 | 1/0/1/0/0.000 | 0/0/0/0/n/a |
| access | party | 1/0/1/0/0.000 | 1/1/0/0/1.000 | 0/0/0/0/n/a |
| installation | party | 0/0/0/0/n/a | 2/1/1/0/0.500 | 0/0/0/0/n/a |
| notify | live-verb | 2/1/1/0/0.500 | 0/0/0/0/n/a | 0/0/0/0/n/a |
| reboot | live-verb | 0/0/0/0/n/a | 1/0/1/0/0.000 | 1/1/0/0/1.000 |
| sticker | shared | 0/0/0/0/n/a | 2/1/1/0/0.500 | 0/0/0/0/n/a |
| submit | live-verb | 1/1/0/0/1.000 | 1/0/1/0/0.000 | 0/0/0/0/n/a |
| collaborator | party | 1/1/0/0/1.000 | 4/4/0/0/1.000 | 1/1/0/0/1.000 |
| publish | live-verb | 2/2/0/0/1.000 | 0/0/0/0/n/a | 3/3/0/0/1.000 |
| send | live-verb | 5/5/0/0/1.000 | 0/0/0/0/n/a | 0/0/0/0/n/a |
| accept | live-verb | 3/3/0/0/1.000 | 0/0/0/0/n/a | 1/1/0/0/1.000 |
| participant | party | 1/1/0/0/1.000 | 3/3/0/0/1.000 | 0/0/0/0/n/a |
| call | party | 3/3/0/0/1.000 | 0/0/0/0/n/a | 0/0/0/0/n/a |
| invitation | party | 0/0/0/0/n/a | 3/3/0/0/1.000 | 0/0/0/0/n/a |
| approve | live-verb | 1/1/0/0/1.000 | 0/0/0/0/n/a | 1/1/0/0/1.000 |
| collaboration | party | 0/0/0/0/n/a | 2/2/0/0/1.000 | 0/0/0/0/n/a |
| kick | live-verb | 0/0/0/0/n/a | 2/2/0/0/1.000 | 0/0/0/0/n/a |
| restriction | party | 0/0/0/0/n/a | 2/2/0/0/1.000 | 0/0/0/0/n/a |
| accepts | live-verb | 1/1/0/0/1.000 | 0/0/0/0/n/a | 0/0/0/0/n/a |
| convert | live-verb | 1/1/0/0/1.000 | 0/0/0/0/n/a | 0/0/0/0/n/a |
| emoji | shared | 0/0/0/0/n/a | 1/1/0/0/1.000 | 0/0/0/0/n/a |
| overwrite | shared | 1/1/0/0/1.000 | 0/0/0/0/n/a | 0/0/0/0/n/a |

## Part D: per list

### LIVE_VERBS hits (rule live-verb)

| word | list | fires | right (x) | wrong_w | wrong_r | precision | vendors | wrong vendors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cancel | live-verb | 48 | 28 | 20 | 0 | 0.583 | 31 | 15 |
| trigger | live-verb | 12 | 0 | 12 | 0 | 0.000 | 6 | 6 |
| revoke | live-verb | 17 | 8 | 9 | 0 | 0.471 | 13 | 8 |
| run | live-verb | 11 | 2 | 9 | 0 | 0.182 | 7 | 5 |
| transfer | live-verb | 9 | 2 | 7 | 0 | 0.222 | 8 | 6 |
| pay | live-verb | 6 | 0 | 6 | 0 | 0.000 | 3 | 3 |
| terminate | live-verb | 6 | 1 | 5 | 0 | 0.167 | 3 | 3 |
| end | live-verb | 5 | 2 | 3 | 0 | 0.400 | 5 | 3 |
| merge | live-verb | 4 | 1 | 3 | 0 | 0.250 | 3 | 2 |
| accepted | live-verb | 2 | 0 | 2 | 0 | 0.000 | 1 | 1 |
| start | live-verb | 9 | 8 | 1 | 0 | 0.889 | 6 | 1 |
| invite | live-verb | 4 | 3 | 1 | 0 | 0.750 | 3 | 1 |
| notify | live-verb | 2 | 1 | 1 | 0 | 0.500 | 2 | 1 |
| reboot | live-verb | 2 | 1 | 1 | 0 | 0.500 | 1 | 1 |
| submit | live-verb | 2 | 1 | 1 | 0 | 0.500 | 2 | 1 |
| publish | live-verb | 5 | 5 | 0 | 0 | 1.000 | 2 | 0 |
| send | live-verb | 5 | 5 | 0 | 0 | 1.000 | 5 | 0 |
| accept | live-verb | 4 | 4 | 0 | 0 | 1.000 | 4 | 0 |
| approve | live-verb | 2 | 2 | 0 | 0 | 1.000 | 2 | 0 |
| kick | live-verb | 2 | 2 | 0 | 0 | 1.000 | 2 | 0 |
| accepts | live-verb | 1 | 1 | 0 | 0 | 1.000 | 1 | 0 |
| convert | live-verb | 1 | 1 | 0 | 0 | 1.000 | 1 | 0 |

### PARTY_NOUNS hits (rule party-noun, word only in PARTY_NOUNS)

| word | list | fires | right (x) | wrong_w | wrong_r | precision | vendors | wrong vendors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| user | party | 140 | 78 | 62 | 0 | 0.557 | 72 | 37 |
| account | party | 65 | 15 | 50 | 0 | 0.231 | 39 | 34 |
| group | party | 64 | 16 | 48 | 0 | 0.250 | 34 | 26 |
| token | party | 28 | 6 | 22 | 0 | 0.214 | 20 | 14 |
| device | party | 23 | 2 | 21 | 0 | 0.087 | 15 | 15 |
| contact | party | 20 | 1 | 19 | 0 | 0.050 | 13 | 12 |
| role | party | 28 | 12 | 16 | 0 | 0.429 | 20 | 10 |
| network | party | 16 | 1 | 15 | 0 | 0.063 | 8 | 8 |
| organization | party | 18 | 5 | 13 | 0 | 0.278 | 10 | 8 |
| repository | party | 15 | 2 | 13 | 0 | 0.133 | 3 | 3 |
| customer | party | 14 | 2 | 12 | 0 | 0.143 | 9 | 8 |
| member | party | 35 | 28 | 7 | 0 | 0.800 | 23 | 5 |
| session | party | 12 | 5 | 7 | 0 | 0.417 | 7 | 4 |
| person | party | 7 | 0 | 7 | 0 | 0.000 | 4 | 4 |
| team | party | 12 | 6 | 6 | 0 | 0.500 | 8 | 5 |
| partner | party | 5 | 1 | 4 | 0 | 0.200 | 4 | 3 |
| assignment | party | 5 | 2 | 3 | 0 | 0.400 | 4 | 2 |
| membership | party | 7 | 6 | 1 | 0 | 0.857 | 5 | 1 |
| access | party | 2 | 1 | 1 | 0 | 0.500 | 2 | 1 |
| installation | party | 2 | 1 | 1 | 0 | 0.500 | 2 | 1 |
| collaborator | party | 6 | 6 | 0 | 0 | 1.000 | 5 | 0 |
| participant | party | 4 | 4 | 0 | 0 | 1.000 | 3 | 0 |
| call | party | 3 | 3 | 0 | 0 | 1.000 | 2 | 0 |
| invitation | party | 3 | 3 | 0 | 0 | 1.000 | 3 | 0 |
| collaboration | party | 2 | 2 | 0 | 0 | 1.000 | 2 | 0 |
| restriction | party | 2 | 2 | 0 | 0 | 1.000 | 1 | 0 |

### SHARED_NOUNS hits (rule party-noun, word only in SHARED_NOUNS)

| word | list | fires | right (x) | wrong_w | wrong_r | precision | vendors | wrong vendors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| webhook | shared | 55 | 1 | 54 | 0 | 0.018 | 38 | 38 |
| channel | shared | 30 | 4 | 26 | 0 | 0.133 | 13 | 12 |
| message | shared | 22 | 7 | 15 | 0 | 0.318 | 17 | 13 |
| permission | shared | 21 | 16 | 5 | 0 | 0.762 | 15 | 2 |
| guild | shared | 8 | 3 | 5 | 0 | 0.375 | 1 | 1 |
| reaction | shared | 5 | 1 | 4 | 0 | 0.200 | 4 | 3 |
| pin | shared | 5 | 2 | 3 | 0 | 0.400 | 4 | 3 |
| sticker | shared | 2 | 1 | 1 | 0 | 0.500 | 2 | 1 |
| emoji | shared | 1 | 1 | 0 | 0 | 1.000 | 1 | 0 |
| overwrite | shared | 1 | 1 | 0 | 0 | 1.000 | 1 | 0 |

### Words in BOTH PARTY_NOUNS and SHARED_NOUNS

(no words are in both lists)

## Dead words — zero fires across the whole corpus

13 words never fired at all (cost nothing, catch nothing on this corpus):

| word | list |
| --- | --- |
| dial | live-verb |
| execute | live-verb |
| hangup | live-verb |
| launch | live-verb |
| refund | live-verb |
| reject | live-verb |
| people | party |
| recipient | party |
| seat | party |
| sponsorship | party |
| subscriber | party |
| tenant | party |
| ban | shared |

## Below-chance words — precision under 0.50, worst first

| word | list | fires | right (x) | wrong_w | wrong_r | precision | vendors | wrong vendors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| webhook | shared | 55 | 1 | 54 | 0 | 0.018 | 38 | 38 |
| account | party | 65 | 15 | 50 | 0 | 0.231 | 39 | 34 |
| group | party | 64 | 16 | 48 | 0 | 0.250 | 34 | 26 |
| channel | shared | 30 | 4 | 26 | 0 | 0.133 | 13 | 12 |
| token | party | 28 | 6 | 22 | 0 | 0.214 | 20 | 14 |
| device | party | 23 | 2 | 21 | 0 | 0.087 | 15 | 15 |
| contact | party | 20 | 1 | 19 | 0 | 0.050 | 13 | 12 |
| role | party | 28 | 12 | 16 | 0 | 0.429 | 20 | 10 |
| message | shared | 22 | 7 | 15 | 0 | 0.318 | 17 | 13 |
| network | party | 16 | 1 | 15 | 0 | 0.063 | 8 | 8 |
| organization | party | 18 | 5 | 13 | 0 | 0.278 | 10 | 8 |
| repository | party | 15 | 2 | 13 | 0 | 0.133 | 3 | 3 |
| customer | party | 14 | 2 | 12 | 0 | 0.143 | 9 | 8 |
| trigger | live-verb | 12 | 0 | 12 | 0 | 0.000 | 6 | 6 |
| revoke | live-verb | 17 | 8 | 9 | 0 | 0.471 | 13 | 8 |
| run | live-verb | 11 | 2 | 9 | 0 | 0.182 | 7 | 5 |
| session | party | 12 | 5 | 7 | 0 | 0.417 | 7 | 4 |
| transfer | live-verb | 9 | 2 | 7 | 0 | 0.222 | 8 | 6 |
| person | party | 7 | 0 | 7 | 0 | 0.000 | 4 | 4 |
| pay | live-verb | 6 | 0 | 6 | 0 | 0.000 | 3 | 3 |
| guild | shared | 8 | 3 | 5 | 0 | 0.375 | 1 | 1 |
| terminate | live-verb | 6 | 1 | 5 | 0 | 0.167 | 3 | 3 |
| partner | party | 5 | 1 | 4 | 0 | 0.200 | 4 | 3 |
| reaction | shared | 5 | 1 | 4 | 0 | 0.200 | 4 | 3 |
| assignment | party | 5 | 2 | 3 | 0 | 0.400 | 4 | 2 |
| end | live-verb | 5 | 2 | 3 | 0 | 0.400 | 5 | 3 |
| pin | shared | 5 | 2 | 3 | 0 | 0.400 | 4 | 3 |
| merge | live-verb | 4 | 1 | 3 | 0 | 0.250 | 3 | 2 |
| accepted | live-verb | 2 | 0 | 2 | 0 | 0.000 | 1 | 1 |

